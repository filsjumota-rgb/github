# Builds audio/vo.wav, timeline.json (scene starts, phrase timings) and subtitles .srt from the 10 VO takes.
# Phrase timing: text split at punctuation; each phrase boundary snapped to the nearest detected pause.
import json, re, subprocess, wave, struct, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO = os.path.join(ROOT, 'audio', 'vo')
TEXT = json.load(open(os.path.join(ROOT, 'tools', 'script.json'), encoding='utf-8'))
SR = 48000
def read(p):
    w = wave.open(p); n = w.getnframes(); d = w.readframes(n); w.close()
    return list(struct.unpack('<%dh' % n, d))
def env(x, hop=480):
    return [math.sqrt(sum(v*v for v in x[i:i+hop]) / hop + 1e-9) / 32768 for i in range(0, len(x) - hop, hop)]
def speech_bounds(e):
    th = 10 ** (-40 / 20)
    on = [i for i, v in enumerate(e) if v > th]
    return on[0] * 0.01, (on[-1] + 1) * 0.01
def pauses(e):
    th = 10 ** (-38 / 20); out = []; run = None
    for i, v in enumerate(e):
        if v < th:
            run = i if run is None else run
        else:
            if run is not None and (i - run) >= 12: out.append(((run + i) / 2) * 0.01)
            run = None
    return out
scenes = []; t = 0.0; BEAT = 0.5
total = []
for k, txt in enumerate(TEXT):
    x = read(os.path.join(VO, 's%02d.wav' % (k + 1)))
    e = env(x); a, b = speech_bounds(e); ps = [p for p in pauses(e) if a + 0.3 < p < b - 0.3]
    lead = 0.5 if k == 0 else 0.7           # VO starts this long after the scene cut
    start = t; vo_at = start + lead - a
    # phrases at punctuation
    parts = [p.strip() for p in re.split(r'(?<=[,:;?.!])\s+', txt) if p.strip()]
    chars = [len(p) for p in parts]; tot = sum(chars); cum = 0; bounds = [a]
    rate = (b - a) / tot
    for j, c in enumerate(chars[:-1]):
        cum += c; est = a + (b - a) * cum / tot
        lo = bounds[-1] + max(0.35, 0.55 * c * rate)          # this phrase can't be much shorter than its text
        hi = b - 0.5 * sum(chars[j + 1:]) * rate               # leave room for the rest
        cand = [q for q in ps if lo <= q <= hi and abs(q - est) < 1.0]
        bnd = min(cand, key=lambda q: abs(q - est)) if cand else min(max(est, lo), hi)
        bounds.append(bnd)
    bounds.append(b)
    phr = [{'text': parts[i], 't0': round(vo_at + bounds[i], 3), 't1': round(vo_at + bounds[i + 1], 3)} for i in range(len(parts))]
    end_speech = vo_at + b
    gap = 0.6 if k < len(TEXT) - 1 else 5.0
    nxt = math.ceil((end_speech + gap) / BEAT / 2) * BEAT * 2   # next scene on a whole second
    scenes.append({'i': k, 'start': round(start, 3), 'end': nxt, 'vo_at': round(vo_at, 3), 'speech': [round(vo_at + a, 3), round(end_speech, 3)], 'phrases': phr})
    total.append((vo_at, x)); t = nxt
dur = t
mix = [0.0] * int(dur * SR + SR)
for at, x in total:
    o = int(at * SR)
    for i, v in enumerate(x): mix[o + i] += v
w = wave.open(os.path.join(ROOT, 'audio', 'vo.wav'), 'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(struct.pack('<%dh' % len(mix), *[int(max(-32767, min(32767, v))) for v in mix])); w.close()
json.dump({'duration': dur, 'scenes': scenes}, open(os.path.join(ROOT, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# SRT: max ~42 chars per line, 2 lines; split long phrases by words proportionally
def fmt(s):
    ms = int(round(s * 1000)); return '%02d:%02d:%02d,%03d' % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)
cues = []
for s in scenes:
    for p in s['phrases']:
        words = p['text'].split(); n = math.ceil(len(p['text']) / 84)
        per = math.ceil(len(words) / n); chunks = [' '.join(words[i:i + per]) for i in range(0, len(words), per)]
        L = sum(len(c) for c in chunks); t0 = p['t0']
        for c in chunks:
            t1 = t0 + (p['t1'] - p['t0']) * len(c) / L; cues.append((t0, t1, c)); t0 = t1
def wrap(c):
    if len(c) <= 42: return c
    ws = c.split(); best = None
    for i in range(1, len(ws)):
        a, b = ' '.join(ws[:i]), ' '.join(ws[i:]); sc = max(len(a), len(b))
        if best is None or sc < best[0]: best = (sc, a + '\n' + b)
    return best[1]
with open(os.path.join(ROOT, 'docs', 'sous-titres.srt'), 'w', encoding='utf-8') as f:
    for i, (a, b, c) in enumerate(cues):
        f.write('%d\n%s --> %s\n%s\n\n' % (i + 1, fmt(a), fmt(min(b + 0.15, cues[i + 1][0] if i + 1 < len(cues) else b + 0.5)), wrap(c.replace('S.R.T.', 'SRT').replace(' huit ', ' 8 '))))
print('duration', dur)
for s in scenes: print(s['i'] + 1, s['start'], s['end'], len(s['phrases']))
# captions + 30 Hz VO envelope for the film
cap = []
for i, (a, b, c) in enumerate(cues):
    nb = min(b + 0.15, cues[i + 1][0] if i + 1 < len(cues) else b + 0.5)
    cap.append([round(a, 3), round(nb, 3), wrap(c.replace('S.R.T.', 'SRT').replace(' huit ', ' 8 '))])
hop = SR // 30
envl = [round(math.sqrt(sum(v * v for v in mix[i:i + hop:4]) / (hop / 4)) / 32768, 4) for i in range(0, len(mix) - hop, hop)]
T = json.load(open(os.path.join(ROOT, 'timeline.json'), encoding='utf-8'))
T['captions'] = cap; T['env'] = envl
json.dump(T, open(os.path.join(ROOT, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False)
