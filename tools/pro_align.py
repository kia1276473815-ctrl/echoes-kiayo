# Places the string quartet score (tools/pro_score.py) in the Прокофьев recording. The strings are only part of the
# track: between their passages the music is electronic, and the score simply waits there. So the score is not laid
# on a fixed clock; it is matched to the audio by harmony (pitch-class content, "chroma") with dynamic programming:
# at each audio frame the score either moves on (at about its own tempo, faster or slower), or the frame is "electronic"
# and the score holds where it is. Output: js/pro-score.js — every note with its time in the recording, and the
# electronic stretches (where the page shows the spectrum instead of the stave), plus a small spectrogram image of the
# whole track for those stretches (assets/collage/pro-spectrum.webp). Run with _raw/venv/Scripts/python.exe.
import json
import os
import sys
import wave

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pro_score import load  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(ROOT, "audio", "mine", "114514.wav")
OUT = os.path.join(ROOT, "js", "pro-score.js")
IMG = os.path.join(ROOT, "assets", "collage", "pro-spectrum.webp")
END = 218.45
HOP = 0.05          # audio frame (s)
RES = 8             # beats are read back at this resolution


def audio_chroma():
    w = wave.open(WAV)
    sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(int(END * sr)), np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
    n, hop = 8192, int(sr * HOP)
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n)), n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1))[: int(END / HOP)]
    f = np.fft.rfftfreq(n, 1 / sr)
    band = (f > 90) & (f < 4200)
    pc = np.round(12 * np.log2(f[band] / 440) + 69).astype(int) % 12
    L = np.log1p(S[:, band] * 30)
    C = np.zeros((len(S), 12))
    for k in range(12):
        C[:, k] = L[:, pc == k].sum(1)
    C -= C.min(1, keepdims=True)                         # what stands out above the flat floor of the noise
    C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-6
    return C, S, f


def nominal(sc):
    # the score's own clock: seconds at its tempo marks (crotchet 160 from bar 1, 209 from bar 101; the rall. in
    # between is left to the matching, which may run each passage between half and double speed)
    marks = [(sc["bars"][0], 160.0), (sc["bars"][100], 209.0)]
    def sec(b):
        t, prev_b, bpm = 0.0, marks[0][0], marks[0][1]
        for mb, mbpm in marks[1:]:
            if b <= mb:
                break
            t += (mb - prev_b) * 60 / bpm; prev_b, bpm = mb, mbpm
        return t + (b - prev_b) * 60 / bpm
    return sec


def score_chroma(sc, sec):
    J = int(sec(sc["bars"][-1] + 4) / HOP) + 1
    C = np.zeros((J, 12))
    for b, d, m, p in sc["notes"]:
        a, z = int(sec(b) / HOP), max(int(sec(b) / HOP) + 1, int(sec(b + d) / HOP))
        w = 1.0 if p == 3 else 0.8
        C[a:z, m % 12] += w
        C[a: a + 2, m % 12] += 0.5 * w                     # the attack counts a little more
    C = np.sqrt(C)
    C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-6
    return C


def align(A, B, gap=0.5, enter=1.0):
    # M[i, j]: audio frame i plays score frame j. Steps (audio, score): (1,1), (2,1) slower, (1,2) faster, so a
    # passage runs between half and double its written speed and never stands still. G[i, j]: frame i is electronic
    # and the score waits after frame j; going in or out costs `enter` (so it does not flicker)
    I, J = len(A), len(B)
    cost = 1 - A @ B.T
    INF = 1e9
    sh = lambda v, k: np.concatenate([np.full(k, INF), v[:-k]])
    M1 = np.full(J, INF); M2 = np.full(J, INF); G = np.full(J, INF)
    M1[0] = cost[0, 0]; G[0] = gap
    pM = np.zeros((I, J), np.int8); pG = np.zeros((I, J), np.int8)
    for i in range(1, I):
        c = cost[i]
        cand = np.stack([
            sh(M1, 1),                      # 0: (1,1)
            sh(M2, 1) + 0.45,               # 1: (2,1) slower (the skipped frame costs like a match: added below)
            sh(M1, 2) + 0.45,               # 2: (1,2) faster
            sh(G, 1) + enter,               # 3: in from the electronics
        ])
        cand[1] += np.concatenate([[INF], cost[i - 1][1:]]) if i >= 1 else INF
        k = cand.argmin(0)
        Mn = cand[k, np.arange(J)] + c
        g = np.stack([G, M1 + enter])
        kg = g.argmin(0)
        Gn = g[kg, np.arange(J)] + gap
        Gn[0] = min(Gn[0], G[0] + gap)
        pM[i] = k; pG[i] = kg
        M2, M1, G = M1, Mn, Gn
    j = J - 1
    layer = 0 if M1[j] <= G[j] else 1
    path, i = [], I - 1
    while i >= 0:
        path.append((i, j, layer))
        if i == 0:
            break
        if layer == 0:
            k = pM[i, j]
            if k == 0: i -= 1; j -= 1
            elif k == 1: path.append((i - 1, j - 1, 0)); i -= 2; j -= 1
            elif k == 2: i -= 1; j -= 2
            else: i -= 1; j -= 1; layer = 1
        else:
            if pG[i, j] == 1: layer = 0
            i -= 1
        j = max(j, 0)
    return path[::-1], cost


def place(sc, sec, A, B, ons, jump=0.3, drift=0.04):
    # every bar keeps its written length; what is free is how far it is pushed later in the recording (the offset),
    # which grows where electronics are put in between, and may drift a frame or two per bar (the rall.)
    I, J = len(A), len(B)
    cost = 1 - A @ B.T
    bars = sc["bars"] + [sc["bars"][-1] + 4]
    O = I - int(sec(bars[-1]) / HOP)                   # largest offset (frames)
    D = None
    back = []
    for k in range(len(bars) - 1):
        j0, j1 = int(sec(bars[k]) / HOP), max(int(sec(bars[k]) / HOP) + 1, int(sec(bars[k + 1]) / HOP))
        cb = np.zeros(O + 1)
        for j in range(j0, min(j1, J)):
            cb += cost[j: j + O + 1, j]
        cb /= max(1, j1 - j0)
        # the bar's attacks on the recording's onsets, at each offset
        at = [sec(n[0]) for n in sc["notes"] if bars[k] <= n[0] < bars[k + 1]]
        if at:
            hit = np.zeros(O + 1)
            for a_ in at:
                tt = a_ + np.arange(O + 1) * HOP
                i = np.clip(np.searchsorted(ons, tt), 1, len(ons) - 1)
                hit += np.minimum(np.abs(ons[i] - tt), np.abs(ons[i - 1] - tt)) < 0.03
            cb -= 0.25 * hit / len(at)
        if D is None:
            D = cb.copy(); back.append(np.arange(O + 1)); continue
        # from the previous bar: the same offset give or take two frames (drift), or any smaller one (a jump)
        best = D.copy(); arg = np.arange(O + 1)
        for d in (-2, -1, 1, 2):
            sh = np.full(O + 1, np.inf); src = np.arange(O + 1) - d
            ok = (src >= 0) & (src <= O)
            sh[ok] = D[src[ok]] + drift * abs(d)
            better = sh < best
            best[better] = sh[better]; arg[better] = src[better]
        pm = np.minimum.accumulate(D); pa = np.zeros(O + 1, int)
        cur = 0
        for o in range(O + 1):
            if D[o] <= D[cur]: cur = o
            pa[o] = cur
        jm = np.concatenate([[np.inf] * 3, pm[:-3]]) + jump
        ja = np.concatenate([[0] * 3, pa[:-3]])
        better = jm < best
        best[better] = jm[better]; arg[better] = ja[better]
        D = best + cb
        back.append(arg)
    o = int(np.argmin(D))
    offs = [o]
    for k in range(len(back) - 1, 0, -1):
        o = int(back[k][o]); offs.append(o)
    offs = offs[::-1]
    return bars, offs, cost


# where the strings play, as the composer gave it: (from s, first bar, last bar). The rest is electronics. The times
# are a guide: each passage's start is looked for within 3 s of it, and its bars may drift a little from the written
# tempo, so the bars land where they are in the recording.
PLAN = [(0, 1, 21), (50, 35, 40), (94, 44, 52), (132, 44, 86), (204, 91, 101)]


def anchored(sc, sec, A, B, ons, start, b0, b1, reach=60, drift=3):
    cost = 1 - A @ B.T
    bars = sc["bars"] + [sc["bars"][-1] + 4]
    I = len(A)
    ks = list(range(b0 - 1, b1))
    target = int(round((start - sec(bars[ks[0]])) / HOP))
    lo, hi = target - reach - drift * len(ks), target + reach + drift * len(ks)
    offs = np.arange(lo, hi + 1)
    D, back = None, []
    for n, k in enumerate(ks):
        j0, j1 = int(sec(bars[k]) / HOP), max(int(sec(bars[k]) / HOP) + 1, int(sec(bars[k + 1]) / HOP))
        cb = np.zeros(len(offs))
        for j in range(j0, j1):
            i = np.clip(j + offs, 0, I - 1)
            cb += cost[i, j]
        cb /= j1 - j0
        at = [sec(x[0]) for x in sc["notes"] if bars[k] <= x[0] < bars[k + 1]]
        if at:
            hit = np.zeros(len(offs))
            for a_ in at:
                tt = a_ + offs * HOP
                i = np.clip(np.searchsorted(ons, tt), 1, len(ons) - 1)
                hit += np.minimum(np.abs(ons[i] - tt), np.abs(ons[i - 1] - tt)) < 0.03
            cb -= 0.25 * hit / len(at)
        if D is None:
            D = cb + 0.002 * np.abs(offs - target); back.append(None); continue
        best = np.full(len(offs), np.inf); arg = np.zeros(len(offs), int)
        for d in range(-drift, drift + 1):
            src = np.arange(len(offs)) - d
            ok = (src >= 0) & (src < len(offs))
            v = np.full(len(offs), np.inf); v[ok] = D[src[ok]] + 0.03 * abs(d)
            better = v < best; best[better] = v[better]; arg[better] = src[better]
        D = best + cb; back.append(arg)
    o = int(np.argmin(D)); path = [o]
    for n in range(len(ks) - 1, 0, -1):
        o = int(back[n][o]); path.append(o)
    path = path[::-1]
    # each bar's start: where the path puts it, nudged (up to 60 ms) onto the recording's onsets
    starts = []
    for n, k in enumerate(ks):
        t0 = sec(bars[k]) + offs[path[n]] * HOP
        ts = np.array([sec(x[0]) - sec(bars[k]) + t0 for x in sc["notes"] if bars[k] <= x[0] < bars[k + 1]])
        best, bs = 0.0, -1e9
        if len(ts):
            for d in np.arange(-0.06, 0.0601, 0.005):
                i = np.clip(np.searchsorted(ons, ts + d), 1, len(ons) - 1)
                dist = np.minimum(np.abs(ons[i] - ts - d), np.abs(ons[i - 1] - ts - d))
                v = (dist < 0.025).sum() - abs(d) * 4
                if v > bs: bs, best = v, d
        starts.append(t0 + best)
    occ = []
    for n, k in enumerate(ks):
        t0 = starts[n]
        t1 = starts[n + 1] if n + 1 < len(ks) else t0 + sec(bars[k + 1]) - sec(bars[k])
        occ.append([k, round(t0, 3), round(t1, 3), round(bars[k + 1] - bars[k], 3)])
    return occ


def main():
    sc = load()
    A, S, f = audio_chroma()
    sec = nominal(sc)
    B = score_chroma(sc, sec)
    import re
    ev = json.loads(re.search(r"= ({.*});", open(os.path.join(ROOT, "js", "pro-events.js"), encoding="utf-8").read()).group(1))
    ons = np.array(sorted(e[0] for k in ("beat", "note") for e in ev[k]))
    occ = []
    for start, b0, b1 in PLAN:
        o = anchored(sc, sec, A, B, ons, start, b0, b1)
        print(f"  bars {b0}-{b1}: {o[0][1]:.2f}-{o[-1][2]:.2f} s (given from {start}), bar lengths {[round(x[2] - x[1], 2) for x in o]}")
        occ += o
    occ.sort(key=lambda x: x[1])
    elec, last = [], 0.0
    for k, t0, t1, n in occ:
        if t0 - last > 0.3:
            elec.append([round(last, 2), round(t0, 2)])
        last = max(last, t1)
    if END - last > 0.3:
        elec.append([round(last, 2), END])
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("// Made by tools/pro_align.py: where the string quartet's bars sound in the Прокофьев recording.\n")
        fh.write("// bars: [bar (0-based), from s, to s, beats] (bar 44 on is played twice) · electronic: [from s, to s]\n")
        fh.write("export const PRO_SCORE = " + json.dumps({"bars": occ, "electronic": elec}, separators=(",", ":")) + ";\n")
    print("electronic:", elec)
    spectrum()


def spectrum():
    # the spectrogram for the electronic stretches: 40 columns a second, 48 rows on a log scale, 30 Hz-16 kHz
    rows, fps = 48, 40
    edges = np.geomspace(30, 16000, rows + 1)
    w = wave.open(WAV); sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(int(END * sr)), np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
    n, hop = 2048, sr // fps
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (n // 2, n)), n)[::hop][: int(END * fps)] * np.hanning(n)
    Sp = np.abs(np.fft.rfft(fr, axis=1)); fq = np.fft.rfftfreq(n, 1 / sr)
    img = np.zeros((rows, len(Sp)))
    for r in range(rows):
        m = (fq >= edges[r]) & (fq < edges[r + 1])
        img[rows - 1 - r] = Sp[:, m].max(1) if m.any() else Sp[:, np.argmin(abs(fq - edges[r]))]
    img = 20 * np.log10(img + 1e-6)
    img = np.clip((img - (img.max() - 60)) / 60, 0, 1)
    Image.fromarray((img * 255).astype(np.uint8)).save(IMG, "WEBP", quality=80)


if __name__ == "__main__":
    main()
