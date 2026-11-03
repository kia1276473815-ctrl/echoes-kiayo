# Reads the string quartet score of the Прокофьев track (_raw/score/prokofiev.mxl, MusicXML from the user's notation
# program) into notes: [beat, length in beats, MIDI pitch, part] per note, beats counted from the first bar, and the
# tempo marks. The strings are only part of the track; tools/pro_align.py places them in the audio.
import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_raw", "score", "prokofiev.mxl")
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def load(path=SRC):
    z = zipfile.ZipFile(path)
    name = next(n for n in z.namelist() if n.endswith((".xml", ".musicxml")) and not n.startswith("META-INF"))
    root = ET.fromstring(z.read(name))
    parts = {p.get("id"): p.findtext("part-name") for p in root.iter("score-part")}
    notes, tempos, bars = [], [], []
    for pi, part in enumerate(root.findall("part")):
        div, t, last = 1, 0.0, 0.0
        for m in part.findall("measure"):
            if pi == 0:
                bars.append(t)
            for el in m:
                if el.tag == "attributes" and el.findtext("divisions"):
                    div = int(el.findtext("divisions"))
                elif el.tag == "direction" or el.tag == "sound":
                    snd = el if el.tag == "sound" else el.find("sound")
                    if pi == 0 and snd is not None and snd.get("tempo"):
                        tempos.append([t, float(snd.get("tempo"))])
                elif el.tag == "backup":
                    t -= int(el.findtext("duration")) / div
                elif el.tag == "forward":
                    t += int(el.findtext("duration")) / div
                elif el.tag == "note":
                    d = int(el.findtext("duration") or 0) / div
                    chord = el.find("chord") is not None
                    start = last if chord else t
                    p = el.find("pitch")
                    if p is not None and el.find("grace") is None:
                        midi = 12 * (int(p.findtext("octave")) + 1) + STEP[p.findtext("step")] + int(float(p.findtext("alter") or 0))
                        tie = [x.get("type") for x in el.findall("tie")]
                        if "stop" in tie and notes and notes[-1][2] == midi and notes[-1][3] == pi:
                            notes[-1][1] += d          # a tied note goes on
                        else:
                            notes.append([start, d, midi, pi])
                    if not chord:
                        last = t
                        t += d
    notes.sort()
    return {"parts": list(parts.values()), "bars": bars, "tempos": tempos, "notes": notes}


if __name__ == "__main__":
    S = load(sys.argv[1] if len(sys.argv) > 1 else SRC)
    print("parts", S["parts"], "bars", len(S["bars"]), "beats", S["bars"][-1] if S["bars"] else 0, "tempos", S["tempos"][:20])
    # stretches with no note in any part (in beats)
    ends = []
    on = sorted(S["notes"])
    cur_end = 0
    for b, d, m, p in on:
        if b > cur_end + 0.01:
            ends.append((round(cur_end, 2), round(b, 2)))
        cur_end = max(cur_end, b + d)
    print("silent stretches (beats):", [e for e in ends if e[1] - e[0] >= 4])
    print("notes", len(on), "first", on[:6])
