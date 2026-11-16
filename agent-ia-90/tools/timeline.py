# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""Builds the voice-over edit for one version of « C'est quoi un agent IA ? ».

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
VO = ROOT / 'agent-ia-90' / 'audio' / 'vo'
SR = 48000
BEAT = 0.5

TEXT = {
 'L01': "C'est quoi, exactement, un agent IA ? Tout le monde en parle… En quatre-vingt-dix secondes, tu vas enfin comprendre.",
 'L02': "Oublie les robots de film qui marchent et qui parlent. Un agent IA, ce n'est pas ça.",
 'L03': "C'est un assistant qui travaille… tout seul. La différence avec ChatGPT ? ChatGPT te répond quand tu lui poses une question. Un agent, lui, agit, même quand tu n'es pas là.",
 'L04': "Pour créer un agent, tu lui donnes trois choses.",
 'L05': "Un : une mission. Ce que tu veux qu'il fasse, par exemple : résumer l'actu de l'IA. Plus ta mission est claire, meilleur sera le résultat.",
 'L06': "Deux : un horaire. Quand doit-il travailler ? Chaque matin à sept heures… ou à chaque nouveau mail reçu.",
 'L07': "Trois : des outils. Ce sont ses mains : ta boîte mail, les réseaux sociaux, le web. Sans outils, il ne peut rien faire.",
 'L08': "Mission, plus horaire, plus outils… voilà ton agent IA !",
 'L09': "Concrètement : à sept heures, il cherche l'actu. À sept heures deux, il la résume. À sept heures cinq, c'est dans ta boîte mail. Et toi… tu dors encore.",
 'L10': "Mais attention, la règle d'or : l'IA prépare, toi, tu valides. Relis toujours avant de publier ou d'envoyer.",
 'L11': "Le tuto complet, pas à pas, est sur la chaîne. Abonne-toi pour ne pas le rater !",
 'L12': "Jumota Agency : marketing digital et IA.",
 'S01': "C'est quoi… un agent IA ?",
 'S02': "Pas un robot de film.",
 'S03': "C'est un assistant qui travaille… tout seul. Tu lui donnes trois choses.",
 'S05': "Un : une mission. Par exemple, résumer l'actu IA.",
 'S06': "Deux : un horaire. Chaque matin à sept heures.",
 'S07': "Trois : des outils. Email, réseaux sociaux, web.",
 'S09': "À sept heures, il cherche l'actu. Sept heures deux, il résume. Sept heures cinq, c'est dans ta boîte. Toi… tu dors encore.",
 'S10': "La règle d'or : l'IA prépare, toi, tu valides.",
 'S11': "Le tuto complet est sur la chaîne. Abonne-toi !",
}
# scene key, take, phrase range (None = whole take), seconds held after the last word
VERSIONS = {
 'long': ('agent-ia-90', [
   ('hook', 'L01', None, 1.0), ('robot', 'L02', None, 0.7), ('solo', 'L03', None, 0.8), ('three', 'L04', None, 0.4),
   ('mission', 'L05', None, 0.7), ('horaire', 'L06', None, 0.7), ('outils', 'L07', None, 1.2), ('eq', 'L08', None, 1.7),
   ('exemple', 'L09', None, 1.7), ('regle', 'L10', None, 1.3), ('cta', 'L11', None, 0.5), ('fin', 'L12', None, 2.2)]),
 'short': ('agent-ia-court', [
   ('hook', 'S01', None, 0.6), ('robot', 'S02', None, 0.9), ('solo', 'S03', (0, 2), 0.5), ('three', 'S03', (2, 3), 0.3),
   ('mission', 'S05', None, 0.8), ('horaire', 'S06', None, 1.0), ('outils', 'S07', None, 1.0), ('eq', 'L08', None, 1.0),
   ('exemple', 'S09', None, 1.0), ('regle', 'S10', None, 1.0), ('cta', 'S11', None, 0.5), ('fin', 'L12', None, 2.0)]),
}

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

def build(version):
    folder, scenes = VERSIONS[version]
    t = 0.0; clips = []; res = []
    for k, (key, take, rng, tail) in enumerate(scenes):
        x, ph = align(take)
        if rng: ph = ph[rng[0]:rng[1]]
        c0 = max(0.0, ph[0]['t0'] - 0.06); c1 = ph[-1]['t1'] + 0.12
        seg = x[int(c0 * SR):int(c1 * SR)]
        fade = int(0.012 * SR); seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        lead = 0.25 if k == 0 else 0.45          # the voice starts this long after the cut
        start = t; at = start + lead              # clip start time in the film
        off = at - c0                             # take time -> film time
        phr = [{'text': p['text'], 't0': round(p['t0'] + off, 3), 't1': round(p['t1'] + off, 3),
                'words': [{'w': w['w'], 't0': round(w['t0'] + off, 3), 't1': round(w['t1'] + off, 3)} for w in p['words']]} for p in ph]
        end = math.ceil((phr[-1]['t1'] + tail) / BEAT) * BEAT
        res.append({'key': key, 'start': round(start, 3), 'end': end, 'phrases': phr})
        clips.append((at, seg)); t = end
    dur = t
    mix = np.zeros(int(dur * SR) + SR, dtype=np.float32)
    for at, seg in clips:
        o = int(at * SR); mix[o:o + len(seg)] += seg
    d = ROOT / folder
    (d / 'audio').mkdir(exist_ok=True); (d / 'docs').mkdir(exist_ok=True)
    sf.write(d / 'audio' / 'vo.wav', mix[:int(dur * SR)], SR, subtype='PCM_16')
    json.dump({'version': version, 'duration': dur, 'scenes': res}, open(d / 'timeline.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    srt(res, d / 'docs' / 'sous-titres.srt')
    for s in res: print(f"{s['key']:8s} {s['start']:6.2f} -> {s['end']:6.2f}  ({s['end'] - s['start']:.1f}s)  {' | '.join(p['text'] for p in s['phrases'])[:80]}")
    print(f'{version}: {dur:.1f}s -> {folder}/timeline.json, audio/vo.wav, docs/sous-titres.srt')

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
    build(sys.argv[1] if len(sys.argv) > 1 else 'long')
