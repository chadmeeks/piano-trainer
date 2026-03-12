#!/usr/bin/env python3
import argparse
import csv
import json
import math
import re
import statistics
import subprocess
from pathlib import Path


def run_cmd(cmd):
    completed = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return completed.stdout


def parse_beats(raw):
    beats = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            beats.append(float(line.split()[0]))
        except Exception:
            continue
    return beats


def parse_notes(raw):
    rows = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        nums = re.findall(r"-?\d+(?:\.\d+)?", line)
        if len(nums) < 3:
            continue
        try:
            midi = int(float(nums[0]))
            start = float(nums[1])
            end = float(nums[2])
        except Exception:
            continue
        if end <= start:
            continue
        rows.append((midi, start, end))
    return rows


def parse_chordino(raw):
    rows = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^([0-9]+(?:\.[0-9]+)?)\s*:\s*(.+)$", line)
        if not m:
            continue
        t = float(m.group(1))
        label = m.group(2).strip()
        rows.append((t, label))
    return rows


def infer_bar_duration(beats):
    if len(beats) < 8:
        return 3.35
    deltas = [beats[i] - beats[i - 1] for i in range(1, len(beats))]
    deltas = [d for d in deltas if 0.2 <= d <= 1.2]
    if not deltas:
        return 3.35
    beat = statistics.median(deltas)
    bar4 = beat * 4
    bar8 = beat * 8
    target = 3.35
    return bar8 if abs(bar8 - target) < abs(bar4 - target) else bar4


def normalize_chord_label(label):
    value = str(label or "").strip()
    if not value or value.upper() == "N":
        return "N"
    value = value.replace("maj", "")
    value = value.replace(":", "")
    return simplify_chord_label(value)


def simplify_chord_label(label):
    value = str(label or "").strip()
    if not value or value.upper() == "N":
        return "N"
    parts = value.split("/", 1)
    main = parts[0]
    bass = parts[1] if len(parts) > 1 else ""

    m = re.match(r"^([A-G](?:#|b)?)(.*)$", main)
    if not m:
        return value
    root = m.group(1)
    tail = m.group(2).lower()
    quality = ""
    if "dim" in tail or "o" in tail:
        quality = "dim"
    elif "m" in tail and "maj" not in tail:
        quality = "m"
    simple = f"{root}{quality}"
    if bass:
        bass_match = re.match(r"^([A-G](?:#|b)?)", bass)
        if bass_match:
            simple = f"{simple}/{bass_match.group(1)}"
    return simple


def segments_from_chordino(events, song_end):
    segs = []
    clean = [(t, normalize_chord_label(lbl)) for t, lbl in events]
    clean = [(t, lbl) for t, lbl in clean if lbl]
    if not clean:
        return segs
    for idx, (start, label) in enumerate(clean):
        end = clean[idx + 1][0] if idx + 1 < len(clean) else song_end
        if end <= start:
            continue
        segs.append((start, end, label))
    return segs


def score_chord_for_window(chord_segments, start, end, prev=None):
    durations = {}
    for s, e, label in chord_segments:
        overlap = max(0.0, min(end, e) - max(start, s))
        if overlap <= 0:
            continue
        durations[label] = durations.get(label, 0.0) + overlap
    if not durations:
        return prev or "C", 0.0

    # Exclude "N" unless no other label exists
    if "N" in durations and len(durations) > 1:
        del durations["N"]

    ranked = sorted(durations.items(), key=lambda kv: kv[1], reverse=True)
    best_label, best_dur = ranked[0]
    total = sum(durations.values())
    second = ranked[1][1] if len(ranked) > 1 else 0.0
    confidence = max(0.0, min(1.0, (best_dur - second) / max(total, 1e-6)))
    if best_label == "N":
        return prev or "C", 0.0
    return best_label, confidence


def chunk_phrases_from_line(line):
    parts = [p.strip() for p in re.split(r",|/|;", line) if p.strip()]
    return parts if parts else [line.strip()]


def assign_lyrics_to_events(bars, sections):
    for sec in sections:
        start = max(1, int(sec["start_bar"]))
        end = max(start, int(sec["end_bar"]))
        sec_bars = bars[start - 1:end]
        event_slots = []
        for bar in sec_bars:
            for ev in bar["events"]:
                event_slots.append((bar, ev))
        if not event_slots:
            continue

        phrases = []
        for line in sec.get("lyrics", []):
            phrases.extend(chunk_phrases_from_line(line))
        if not phrases:
            continue

        # Expand or shrink phrase list to event slots count
        if len(phrases) < len(event_slots):
            phrases = phrases + [""] * (len(event_slots) - len(phrases))
        elif len(phrases) > len(event_slots):
            grouped = []
            step = len(phrases) / len(event_slots)
            for i in range(len(event_slots)):
                a = int(round(i * step))
                b = int(round((i + 1) * step))
                grouped.append(", ".join(p for p in phrases[a:b] if p))
            phrases = grouped

        for (bar, ev), text in zip(event_slots, phrases):
            ev["lyric"] = text
        bar_lyrics = [ev.get("lyric", "") for bar in sec_bars for ev in bar["events"] if ev.get("lyric", "").strip()]
        if sec_bars:
            for bar in sec_bars:
                own = [ev.get("lyric", "") for ev in bar["events"] if ev.get("lyric", "").strip()]
                bar["lyric"] = own[0] if own else ""


def parse_lyrics_sections(path):
    sections = []
    current = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            name = line[1:-1].strip()
            current = {"name": name, "lines": []}
            sections.append(current)
        else:
            if current is None:
                current = {"name": "Unlabeled", "lines": []}
                sections.append(current)
            current["lines"].append(line)
    return sections


def allocate_sections_to_bars(total_bars, lyric_sections):
    weighted = []
    for sec in lyric_sections:
        # Let-it-be style repeated chorus lines often span more than one bar.
        line_weight = 0
        for line in sec["lines"]:
            line_weight += 2 if line.lower().startswith("let it be, let it be") else 1
        weighted.append(max(1, line_weight))
    total_weight = sum(weighted) if weighted else 1
    counts = [max(1, round(total_bars * w / total_weight)) for w in weighted]
    diff = total_bars - sum(counts)
    i = 0
    while diff != 0 and counts:
        idx = i % len(counts)
        if diff > 0:
            counts[idx] += 1
            diff -= 1
        elif counts[idx] > 1:
            counts[idx] -= 1
            diff += 1
        i += 1
    return counts


def build_sections(total_bars, lyric_sections):
    counts = allocate_sections_to_bars(total_bars, lyric_sections)
    out = []
    cursor = 0
    for sec, n in zip(lyric_sections, counts):
        out.append({
            "name": sec["name"],
            "start_bar": cursor + 1,
            "end_bar": cursor + n,
            "lyrics": sec["lines"],
        })
        cursor += n
    if cursor < total_bars:
        out.append({
            "name": "Unmapped",
            "start_bar": cursor + 1,
            "end_bar": total_bars,
            "lyrics": [],
        })
    return out


def main():
    parser = argparse.ArgumentParser(description="Create a draft bar/chord arrangement from audio + lyric sections.")
    parser.add_argument("--audio", required=True, help="Path to wav file")
    parser.add_argument("--audio-alt", default="", help="Optional alternate wav (e.g. harmony stem)")
    parser.add_argument("--lyrics", required=True, help="Path to lyric text file")
    parser.add_argument("--out-dir", required=True, help="Output directory")
    parser.add_argument("--chart-start", type=float, default=12.0, help="Seconds where chart bar 1 starts")
    parser.add_argument("--max-bars", type=int, default=96, help="Cap bar count to keep draft manageable")
    args = parser.parse_args()

    audio = Path(args.audio)
    audio_alt = Path(args.audio_alt) if args.audio_alt else None
    lyrics = Path(args.lyrics)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    beats_raw = run_cmd(["aubio", "beat", "-i", str(audio), "-T", "seconds"])
    notes_raw = run_cmd(["aubio", "notes", "-i", str(audio), "-T", "seconds"])
    chordino_raw = run_cmd(["vamp-simple-host", "nnls-chroma:chordino:simplechord", str(audio)])
    chordino_alt_raw = ""
    if audio_alt and audio_alt.exists():
        chordino_alt_raw = run_cmd(["vamp-simple-host", "nnls-chroma:chordino:simplechord", str(audio_alt)])
    beats = parse_beats(beats_raw)
    notes = parse_notes(notes_raw)
    chordino = parse_chordino(chordino_raw)
    chordino_alt = parse_chordino(chordino_alt_raw) if chordino_alt_raw else []

    (out_dir / "beats.txt").write_text(beats_raw, encoding="utf-8")
    (out_dir / "notes.txt").write_text(notes_raw, encoding="utf-8")
    (out_dir / "chordino.txt").write_text(chordino_raw, encoding="utf-8")
    if chordino_alt_raw:
        (out_dir / "chordino-alt.txt").write_text(chordino_alt_raw, encoding="utf-8")

    bar_dur = infer_bar_duration(beats)
    beat_dur = bar_dur / 4.0
    if not notes and not chordino:
        raise RuntimeError("No note events parsed from aubio notes output.")
    song_end_notes = max([n[2] for n in notes], default=0.0)
    song_end_chords = max([t for t, _ in chordino], default=0.0)
    song_end_alt = max([t for t, _ in chordino_alt], default=0.0)
    song_end = max(song_end_notes, song_end_chords, song_end_alt)
    start = max(0.0, args.chart_start)
    total_bars = int(math.ceil(max(0.0, song_end - start) / bar_dur))
    total_bars = max(1, min(total_bars, args.max_bars))
    chord_segments = segments_from_chordino(chordino, song_end=song_end)
    chord_segments_alt = segments_from_chordino(chordino_alt, song_end=song_end) if chordino_alt else []

    bars = []
    prev = "C"
    alt_better = 0
    for idx in range(total_bars):
        b_start = start + idx * bar_dur
        b_end = b_start + bar_dur
        events = []
        ev_prev = prev
        for beat_idx in range(4):
            e_start = b_start + beat_idx * beat_dur
            e_end = min(b_end, e_start + beat_dur)
            chord, confidence = score_chord_for_window(chord_segments, e_start, e_end, prev=ev_prev)
            source = "fullmix"
            if chord_segments_alt:
                alt_chord, alt_conf = score_chord_for_window(chord_segments_alt, e_start, e_end, prev=ev_prev)
                if alt_conf > confidence + 0.03:
                    chord, confidence = alt_chord, alt_conf
                    source = "harmony-stem"
                    alt_better += 1
            events.append({
                "chord": chord,
                "source": source,
                "confidence": round(confidence, 3),
                "beat_start": beat_idx + 1,
                "beat_length": 1,
                "lyric": "",
            })
            ev_prev = chord
        # Merge adjacent same-chord beats into compact events
        merged = []
        for ev in events:
            if merged and merged[-1]["chord"] == ev["chord"]:
                merged[-1]["beat_length"] += ev["beat_length"]
                merged[-1]["confidence"] = round((merged[-1]["confidence"] + ev["confidence"]) / 2.0, 3)
                if merged[-1]["source"] != ev["source"]:
                    merged[-1]["source"] = "hybrid"
            else:
                merged.append(dict(ev))

        chord = merged[0]["chord"] if merged else prev
        confidence = round(sum(ev["confidence"] for ev in merged) / max(1, len(merged)), 3)
        source = merged[0]["source"] if merged else "fullmix"
        prev = chord
        bars.append({
            "bar": idx + 1,
            "start_sec": round(b_start, 3),
            "end_sec": round(b_end, 3),
            "chord": chord,
            "source": source,
            "confidence": round(confidence, 3),
            "events": merged,
            "lyric": "",
        })

    lyric_sections = parse_lyrics_sections(lyrics)
    sections = build_sections(total_bars, lyric_sections)
    assign_lyrics_to_events(bars, sections)

    draft = {
        "source": "aubio-beat + chordino(simplechord) hybrid draft",
        "audio": str(audio),
        "audio_alt": str(audio_alt) if audio_alt and audio_alt.exists() else "",
        "lyrics": str(lyrics),
        "chart_start_sec": start,
        "bar_duration_sec": round(bar_dur, 4),
        "beat_duration_sec": round(beat_dur, 4),
        "bars_from_alt_stem": alt_better,
        "bars": bars,
        "sections": sections,
    }

    with (out_dir / "draft-arrangement.json").open("w", encoding="utf-8") as f:
        json.dump(draft, f, indent=2)

    with (out_dir / "draft-bars.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["bar", "start_sec", "end_sec", "chord", "source", "confidence", "events", "lyric"])
        writer.writeheader()
        for row in bars:
            writer.writerow({
                **row,
                "events": " | ".join(f"{ev['chord']}@{ev['beat_start']}+{ev['beat_length']}" for ev in row["events"]),
                "lyric": row.get("lyric", "")
            })

    summary_lines = [
        "# Draft Arrangement",
        "",
        f"- Audio: `{audio}`",
        f"- Harmony stem: `{audio_alt}`" if audio_alt and audio_alt.exists() else "- Harmony stem: `none`",
        f"- Lyrics: `{lyrics}`",
        f"- Chart start: `{start:.2f}s`",
        f"- Inferred bar duration: `{bar_dur:.3f}s`",
        f"- Bars generated: `{total_bars}`",
        f"- Bars chosen from harmony stem: `{alt_better}`",
        "",
        "## Sections",
    ]
    for sec in sections:
        summary_lines.append(f"- {sec['name']}: bars {sec['start_bar']}-{sec['end_bar']}")
    summary_lines.append("")
    summary_lines.append("## Top 16 Bars")
    for row in bars[:16]:
        events_text = ", ".join(
            f"{ev['chord']}({ev['beat_start']}-{ev['beat_start'] + ev['beat_length'] - 1})"
            for ev in row["events"]
        )
        summary_lines.append(
            f"- Bar {row['bar']:>2}: {events_text} [{row['source']}] ({row['start_sec']:.2f}-{row['end_sec']:.2f}s), conf={row['confidence']:.2f}"
        )
    (out_dir / "draft-summary.md").write_text("\n".join(summary_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
