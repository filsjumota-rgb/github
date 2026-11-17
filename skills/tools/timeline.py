# Builds timeline.json (scene starts, word timings, caption chunks), audio/vo.wav and docs/sous-titres.srt.
#   python3 tools/timeline.py            (from the film folder or anywhere)
# Voice-over takes: audio/vo/sNN.mp3|wav, one per scene of tools/script.json (ElevenLabs « Antinéa »).
# With every take present, each scene is timed on its audio (speech span + pauses) and audio/vo.wav is
# written. Otherwise every scene is timed at reading pace (READ_RATE chars/s) and there is no voice:
# a half-voiced film is worse than none.
import json, math, os, re, subprocess, struct, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO = os.path.join(ROOT, 'audio', 'vo')
SCRIPT = json.load(open(os.path.join(ROOT, 'tools', 'script.json'), encoding='utf-8'))
SR = 48000
BEAT = 0.5                # 120 BPM grid: scene cuts land on a beat
READ_RATE = 15.5          # chars/s for scenes without a take (Antinéa measured ~18.5; a bit slower to read)
LEAD = [0.45] + [0.55] * (len(SCRIPT) - 1)   # cut -> first word
TAIL = 0.55               # last word -> next cut
END_HOLD = 3.0            # end card after the last word


def take_path(k):
    for ext in ('wav', 'mp3'):
        p = os.path.join(VO, 's%02d.%s' % (k + 1, ext))
        if os.path.exists(p):
            return p
    return None


def decode(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return list(struct.unpack('<%dh' % (len(raw) // 2), raw))


def env(x, hop=480):  # 10 ms RMS
    out = []
    for i in range(0, len(x) - hop, hop):
        s = 0
        for v in x[i:i + hop]:
            s += v * v
        out.append(math.sqrt(s / hop) / 32768)
    return out


def speech_bounds(e):
    th = 10 ** (-40 / 20)
    on = [i for i, v in enumerate(e) if v > th]
    return on[0] * 0.01, (on[-1] + 1) * 0.01


def pauses(e):
    th = 10 ** (-36 / 20); out = []; run = None
    for i, v in enumerate(e):
        if v < th:
            run = i if run is None else run
        else:
            if run is not None and i - run >= 9:
                out.append(((run + i) / 2) * 0.01)
            run = None
    return out


def tokens(text):
    """Words with display text, keyword flag, and a timing weight (chars + punctuation pause)."""
    out = []
    for m in re.finditer(r'\*([^*]+)\*|(\S+)', text):
        if m.group(1):
            for j, w in enumerate(m.group(1).split()):
                out.append({'w': w, 'key': True})
        else:
            out.append({'w': m.group(2), 'key': False})
    # glue lone punctuation (« ? », « : », « ! ») to the previous word
    merged = []
    for t in out:
        if merged and re.fullmatch(r'[?:!;»]+', t['w']):
            merged[-1]['w'] += ' ' + t['w']
        else:
            merged.append(t)
    for t in merged:
        w = t['w']
        t['wt'] = len(re.sub(r'[^\w]', '', w)) + 1.2
        t['pause'] = 3.5 if re.search(r'[.?!…]["»]?$', w) else 2.2 if re.search(r'[,:;]["»]?$', w) else 0
    return merged


def chunks(words, max_chars=30):
    """Caption chunks: break at punctuation, then keep each chunk to two short lines."""
    out, cur = [], []
    def n(ws): return sum(len(w['w']) + 1 for w in ws)
    for i, w in enumerate(words):
        cur.append(i)
        end = w['pause'] > 0
        nxt = words[i + 1]['w'] if i + 1 < len(words) else ''
        if end and (w['pause'] >= 3.5 or n([words[j] for j in cur]) >= 12) or n([words[j] for j in cur]) + len(nxt) > max_chars:
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return [[c[0], c[-1]] for c in out]


HAVE_ALL = all(take_path(k) for k in range(len(SCRIPT)))
scenes, t, takes = [], 0.0, []
for k, sc in enumerate(SCRIPT):
    ws = tokens(sc['text'])
    weights = [w['wt'] for w in ws]
    gaps = [w['pause'] for w in ws]
    p = take_path(k) if HAVE_ALL else None   # partial takes: time everything at reading pace
    if p:
        x = decode(p); e = env(x); a, b = speech_bounds(e); ps = pauses(e)
        dur_audio = len(x) / SR
    else:
        x = None; a = 0.0
        b = (sum(weights) + sum(gaps[:-1])) / READ_RATE
        ps = []
    start = t
    vo_at = start + LEAD[k] - a          # where the take's sample 0 sits on the film clock
    # word starts by weight; each sentence/clause boundary snaps to the nearest real pause
    tot = sum(weights) + sum(gaps[:-1]); span = b - a
    cum, times = 0.0, []
    for i, w in enumerate(ws):
        t0 = a + span * cum / tot
        t1 = a + span * (cum + w['wt']) / tot
        times.append([t0, t1])
        cum += w['wt'] + (gaps[i] if i < len(ws) - 1 else 0)
    if ps:
        for i, w in enumerate(ws[:-1]):
            if not w['pause']:
                continue
            est = (times[i][1] + times[i + 1][0]) / 2
            cand = [q for q in ps if abs(q - est) < 0.6]
            if cand:
                q = min(cand, key=lambda q: abs(q - est)); d = q - est
                # shift the following words toward the pause, fading the shift out to the next boundary
                for j in range(i + 1, len(ws)):
                    times[j][0] += d; times[j][1] += d
                    if ws[j]['pause']:
                        break
                times[i][1] = min(times[i][1] + d, times[i + 1][0] - 0.05) if d > 0 else times[i][1] + d
        for i in range(len(times)):
            times[i][0] = max(a, min(times[i][0], b)); times[i][1] = max(times[i][0] + 0.08, min(times[i][1], b))
    words = [{'w': w['w'], 'key': w['key'], 't0': round(vo_at + times[i][0], 3), 't1': round(vo_at + times[i][1], 3)}
             for i, w in enumerate(ws)]
    end_speech = vo_at + b
    hold = END_HOLD if k == len(SCRIPT) - 1 else TAIL
    nxt = math.ceil((end_speech + hold) / BEAT) * BEAT
    scenes.append({'i': k, 'chapter': sc['chapter'], 'start': round(start, 3), 'end': nxt, 'vo_at': round(vo_at, 3),
                   'voiced': bool(p), 'words': words, 'chunks': chunks(ws)})
    if x is not None:
        takes.append((vo_at, x))
    t = nxt

dur = t
all_voiced = len(takes) == len(SCRIPT)
vo_path = os.path.join(ROOT, 'audio', 'vo.wav')
if all_voiced:
    mix = [0] * int(dur * SR + SR)
    for at, x in takes:
        o = int(round(at * SR))
        for i, v in enumerate(x):
            if 0 <= o + i < len(mix):
                mix[o + i] += v
    w = wave.open(vo_path, 'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(struct.pack('<%dh' % len(mix), *[max(-32767, min(32767, v)) for v in mix])); w.close()
elif os.path.exists(vo_path):
    os.remove(vo_path)

json.dump({'duration': dur, 'voiced': all_voiced, 'scenes': scenes},
          open(os.path.join(ROOT, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
fj = os.path.join(ROOT, 'film.json'); F = json.load(open(fj, encoding='utf-8')); F['duration'] = dur
json.dump(F, open(fj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def fmt(s):
    ms = int(round(s * 1000)); return '%02d:%02d:%02d,%03d' % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)


cues = []
for s in scenes:
    for i0, i1 in s['chunks']:
        cues.append((s['words'][i0]['t0'], s['words'][i1]['t1'], ' '.join(w['w'] for w in s['words'][i0:i1 + 1])))
os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
with open(os.path.join(ROOT, 'docs', 'sous-titres.srt'), 'w', encoding='utf-8') as f:
    for i, (a, b, c) in enumerate(cues):
        b2 = min(b + 0.25, cues[i + 1][0]) if i + 1 < len(cues) else b + 0.6
        f.write('%d\n%s --> %s\n%s\n\n' % (i + 1, fmt(a), fmt(b2), c.replace(' ', ' ')))
print('duration %.1f s, voiced scenes %d/%d%s' % (dur, len(takes), len(SCRIPT), ' -> audio/vo.wav' if all_voiced else ''))
for s in scenes:
    print('  %d %-22s %6.2f-%6.2f %s' % (s['i'], s['chapter'], s['start'], s['end'], 'VO' if s['voiced'] else 'est.'))
