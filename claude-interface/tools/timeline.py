# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""Voice-over edit for « Projets, Code, Artéfacts, Tâches planifiées » (claude-interface).

    uv run agent-ia-90/tools/timeline.py long    -> agent-ia-90/{timeline.json, audio/vo.wav, docs/sous-titres.srt}
    uv run agent-ia-90/tools/timeline.py short   -> agent-ia-court/{...}

Each scene plays one voice clip (a whole ElevenLabs take, or a range of its phrases). Word times are
estimated: the take is cut into phrases at punctuation, each phrase boundary is snapped to the
nearest real pause in the take's envelope, and words share their phrase by length. Scenes start on
the 120 BPM grid (0.5 s), so every cut lands on a beat of the music bed.
"""
import json, math, re, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
VO = ROOT / 'claude-interface' / 'audio' / 'vo'
SR = 48000
BEAT = 0.5

TEXT = {
 'V1': "Vous utilisez Claude, mais vous ne savez pas à quoi servent Projets, Code, Artéfacts et Tâches planifiées ? En deux minutes, je vous montre tout.",
 'V2': "Tout se trouve dans le menu à gauche. Quatre rubriques, quatre façons de travailler plus vite.",
 'V3': "Commençons par Projets. Un projet, c'est un espace de travail dédié à un sujet : votre entreprise, un client, une formation. Vous y ajoutez vos fichiers et vos instructions, par exemple le ton à utiliser, et toutes vos conversations restent rangées au même endroit. Claude garde le contexte du projet : plus besoin de tout réexpliquer à chaque fois.",
 'V4': "Deuxième rubrique : Code. C'est Claude Code, l'assistant de programmation. Vous connectez votre projet GitHub, vous décrivez ce que vous voulez — corriger un bug, ajouter une page à votre site — et Claude écrit le code, le vérifie et vous propose les modifications. Tout tourne dans le cloud : vous pouvez fermer la page et revenir plus tard.",
 'V5': "Troisième rubrique : Artéfacts. Ce sont les créations que Claude réalise pour vous : documents, présentations, tableaux, pages web ou petites applications. Elles sont toutes regroupées ici. Vous pouvez les rouvrir, les modifier, les exporter ou les partager avec un simple lien.",
 'V6': "Enfin, Tâches planifiées. Vous confiez à Claude un travail qui se répète — un résumé chaque lundi, une veille quotidienne — vous choisissez la fréquence, et Claude l'exécute automatiquement, même quand votre ordinateur est éteint.",
 'V7': "Projets pour organiser, Code pour développer, Artéfacts pour créer, Tâches planifiées pour automatiser. Abonnez-vous pour d'autres tutoriels !",
}
# the script's own timing: scene key, take, start (s), voice lead after the cut
SCENES = [('hook', 'V1', 0, 0.5), ('menu', 'V2', 12, 0.5), ('projets', 'V3', 20, 0.8), ('code', 'V4', 45, 0.8),
          ('artefacts', 'V5', 70, 0.8), ('taches', 'V6', 95, 0.8), ('fin', 'V7', 112, 0.4)]
END_HOLD = 2.5

def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(VO / f'{name}.mp3'), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def envelope(x, hop=480):
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12)

def analyse(x):
    e = 20 * np.log10(envelope(x) / (np.abs(x).max() + 1e-9))
    on = np.where(e > -38)[0]
    a, b = on[0] * 0.01, (on[-1] + 1) * 0.01
    quiet = e < -40; pauses = []; run = None
    for i, q in enumerate(quiet):
        if q: run = i if run is None else run
        else:
            if run is not None and i - run >= 9: pauses.append(((run + i) / 2 * 0.01, (i - run) * 0.01))
            run = None
    return a, b, [p for p in pauses if a + 0.2 < p[0] < b - 0.2]

def phrases_of(text):
    return [p.strip() for p in re.split(r'(?<=[,:;?.!…])\s+', text) if p.strip()]

def words_of(phrase):
    return [w for w in phrase.split() if re.search(r'\w', w)]

def align(name):
    """phrase list [(text, t0, t1)] and word list, times relative to the take."""
    x = load(name); a, b, ps = analyse(x)
    parts = phrases_of(TEXT[name])
    w = [max(6, len(p)) for p in parts]; tot = sum(w); rate = (b - a) / tot
    bounds = [a]; cum = 0
    for j, c in enumerate(w[:-1]):
        cum += c; est = a + (b - a) * cum / tot
        lo = bounds[-1] + 0.5 * c * rate; hi = b - 0.5 * sum(w[j + 1:]) * rate
        cand = [p for p, d in ps if lo <= p <= hi and abs(p - est) < 1.0]
        bounds.append(min(cand, key=lambda p: abs(p - est)) if cand else min(max(est, lo), hi))
    bounds.append(b)
    out = []
    for i, p in enumerate(parts):
        t0, t1 = bounds[i], bounds[i + 1]
        # the pause itself is silence: trim each side of a boundary pause off the phrase
        if i > 0: t0 += 0.08
        if i < len(parts) - 1: t1 -= 0.12
        ws = words_of(p); ww = [max(3, len(re.sub(r'\W', '', v))) + 1 for v in ws]; s = sum(ww); c = 0; wl = []
        for v, k in zip(ws, ww):
            wl.append({'w': v, 't0': round(t0 + (t1 - t0) * c / s, 3), 't1': round(t0 + (t1 - t0) * (c + k) / s, 3)}); c += k
        out.append({'text': p, 't0': round(t0, 3), 't1': round(t1, 3), 'words': wl})
    return x, out

def build():
    clips = []; res = []
    for k, (key, take, start, lead) in enumerate(SCENES):
        x, ph = align(take)
        c0 = max(0.0, ph[0]['t0'] - 0.06); c1 = ph[-1]['t1'] + 0.12
        seg = x[int(c0 * SR):int(c1 * SR)].copy()
        fade = int(0.012 * SR); seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        at = start + lead; off = at - c0
        phr = [{'text': p['text'], 't0': round(p['t0'] + off, 3), 't1': round(p['t1'] + off, 3),
                'words': [{'w': w['w'], 't0': round(w['t0'] + off, 3), 't1': round(w['t1'] + off, 3)} for w in p['words']]} for p in ph]
        nxt = SCENES[k + 1][2] if k + 1 < len(SCENES) else math.ceil((phr[-1]['t1'] + END_HOLD) / BEAT) * BEAT
        assert phr[-1]['t1'] < nxt - 0.2, f'{key}: voice runs past the next scene'
        res.append({'key': key, 'start': start, 'end': nxt, 'phrases': phr}); clips.append((at, seg))
    dur = res[-1]['end']
    mix = np.zeros(int(dur * SR) + SR, dtype=np.float32)
    for at, seg in clips:
        o = int(at * SR); mix[o:o + len(seg)] += seg
    d = ROOT / 'claude-interface'
    sf.write(d / 'audio' / 'vo.wav', mix[:int(dur * SR)], SR, subtype='PCM_16')
    json.dump({'duration': dur, 'scenes': res}, open(d / 'timeline.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    (d / 'docs').mkdir(exist_ok=True); srt(res, d / 'docs' / 'sous-titres.srt')
    for s in res: print(f"{s['key']:10s} {s['start']:6.1f} -> {s['end']:6.1f}  voix {s['phrases'][0]['t0']:6.2f} -> {s['phrases'][-1]['t1']:6.2f}")
    print(f'{dur:.1f}s')

def srt(scenes, path):
    def ts(s):
        ms = int(round(s * 1000)); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
    cues = []
    for s in scenes:
        for p in s['phrases']:
            cues.append([p['t0'], p['t1'], p['text']])
    # merge very short phrases with the next one so cards stay readable
    merged = []
    for c in cues:
        if merged and (merged[-1][1] - merged[-1][0] < 1.0) and len(merged[-1][2]) + len(c[2]) < 60 and c[0] - merged[-1][1] < 0.6:
            merged[-1][1] = c[1]; merged[-1][2] += ' ' + c[2]
        else: merged.append(c)
    with open(path, 'w', encoding='utf-8') as f:
        for i, (a, b, txt) in enumerate(merged, 1):
            f.write(f'{i}\n{ts(a)} --> {ts(b + 0.15)}\n{txt}\n\n')

if __name__ == '__main__':
    build()
