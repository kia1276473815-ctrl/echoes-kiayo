# Finds, in the Прокофьев track (audio/mine/114514.wav), what the picture moves to before 3:41, so the page can follow
# the music to the millisecond instead of listening for it live: the beats (the low end hitting), the notes (onsets
# in the low and middle register, with the pitch each one starts on) and the high clicks (short transients above
# 5 kHz). Run with _raw/venv/Scripts/python.exe. Output: js/pro-events.js
import json
import os
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "audio", "mine", "114514.wav")
OUT = os.path.join(ROOT, "js", "pro-events.js")
END = 218.45            # the silence (drain) starts here; nothing after it is needed


def load():
    w = wave.open(SRC)
    sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(int(END * sr)), np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
    return x, sr


def stft(x, n, hop):
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(x, (0, n)), n)[::hop] * np.hanning(n)
    return np.abs(np.fft.rfft(fr, axis=1))


def peaks(odf, t, k, gap, win, floor=0.0):
    # local maxima that stand k deviations above the running median, at least gap seconds apart
    from numpy.lib.stride_tricks import sliding_window_view as sw
    pad = np.pad(odf, (win // 2, win - win // 2 - 1), mode="edge")
    med = np.median(sw(pad, win), axis=1)
    mad = np.median(np.abs(sw(pad, win) - med[:, None]), axis=1) + 1e-6
    out, last = [], -9.0
    for i in range(1, len(odf) - 1):
        v = odf[i]
        if v > floor and v > med[i] + k * mad[i] and v >= odf[i - 1] and v >= odf[i + 1] and t[i] - last >= gap:
            out.append((float(t[i]), float((v - med[i]) / mad[i])))
            last = t[i]
    return out


def main():
    x, sr = load()
    # clicks: energy above 5 kHz at 2.5 ms resolution
    hop, n = int(sr * 0.0025), 256
    S = stft(x, n, hop)
    f = np.fft.rfftfreq(n, 1 / sr)
    hf = np.log(S[:, f > 5000].sum(1) + 1e-4)
    # a frame is stamped at its middle: that is where an onset sits when the frame first fully hears it
    t = (np.arange(len(hf)) * hop + n / 2) / sr
    clicks = peaks(np.maximum(0, np.diff(hf, prepend=hf[0])), t, 9, 0.03, 81, 0.6)
    # the clicks put into the track are at 0:34-0:40 and 0:42-0:44; anything sharp and high elsewhere is cymbal or noise
    clicks = [c for c in clicks if 34 <= c[0] < 40 or 42 <= c[0] < 44]
    # notes and beats: 10 ms resolution, spectral flux in the low (35-140 Hz) and the low-middle (140-1500 Hz) register
    hop, n = int(sr * 0.005), 2048
    S = stft(x, n, hop)
    f = np.fft.rfftfreq(n, 1 / sr)
    t = (np.arange(len(S)) * hop + n / 2) / sr
    L = np.log1p(S * 50)

    def flux(a, b):
        m = (f >= a) & (f < b)
        return np.maximum(0, np.diff(L[:, m], axis=0, prepend=L[:1, m])).mean(1)

    beats = peaks(flux(35, 140), t, 6, 0.18, 201, 0.05)
    notes = peaks(flux(140, 1500), t, 5, 0.09, 201, 0.03)
    # the pitch a note starts on: the strongest partial between 220 Hz and 1.8 kHz a few frames after the onset (the
    # bass under it would put every note on the same line)
    band = (f >= 220) & (f < 1800)
    fb = f[band]

    def pitch(at):
        i = min(len(S) - 1, int((at - n / 2 / sr) / 0.005) + 6)
        k = int(np.argmax(S[i, band]))
        return int(round(69 + 12 * np.log2(fb[k] / 440)))

    data = {
        "beat": [[round(a, 3), round(min(s, 40), 1)] for a, s in beats],
        "note": [[round(a, 3), round(min(s, 40), 1), pitch(a)] for a, s in notes],
        "click": [[round(a, 4), round(min(s, 60), 1)] for a, s in clicks],
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("// Made by tools/pro_events.py from audio/mine/114514.wav: what happens in the Прокофьев track before the\n")
        fh.write("// silence, to the millisecond. beat: [s, strength] · note: [s, strength, MIDI pitch] · click: [s, strength]\n")
        fh.write("export const PRO_EVENTS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    secs = [0, 33.1, 94.35, 155.75, 205.05, END]
    for a, b in zip(secs, secs[1:]):
        c = {k: sum(a <= e[0] < b for e in v) for k, v in data.items()}
        print(f"{a:7.2f}-{b:7.2f}  " + "  ".join(f"{k} {v:4d} ({v / (b - a):4.1f}/s)" for k, v in c.items()))
    print(OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
