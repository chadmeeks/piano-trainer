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


def mark_step(kind, step_id, label=""):
    payload = f"{kind}|{step_id}"
    if label:
        payload += f"|{label}"
    print(payload, flush=True)


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
    target = 3.35
    candidates = [beat * 2, beat * 4, beat * 8]
    candidates = [c for c in candidates if 2.0 <= c <= 6.0] or [beat * 4]
    return min(candidates, key=lambda c: abs(c - target))


def infer_pulses_per_bar(beats, bar_duration):
    if len(beats) < 8:
        return 4
    deltas = [beats[i] - beats[i - 1] for i in range(1, len(beats))]
    deltas = [d for d in deltas if 0.2 <= d <= 1.2]
    if not deltas:
        return 4
    pulse = statistics.median(deltas)
    if pulse <= 0:
        return 4
    estimated = max(1, int(round(bar_duration / pulse)))
    return min([4, 8], key=lambda v: abs(v - estimated))


def chord_label_at_time(chord_segments, t, default="C"):
    for s, e, label in chord_segments:
        if s <= t < e:
            return label
    return default


def infer_downbeat_phase(beats, start, chord_segments, pulses_per_bar=4):
    if len(beats) < 8:
        return 0
    best_phase = 0
    best_score = -1e9
    cycle = max(1, int(pulses_per_bar))
    for phase in range(cycle):
        phase_beats = [b for i, b in enumerate(beats) if i % cycle == phase]
        if not phase_beats:
            continue
        nearest = min(abs(b - start) for b in phase_beats)
        # Prefer downbeats close to chart start and where harmony changes near the downbeat.
        change_hits = 0.0
        sample = 0
        for t in phase_beats:
            if t < start - 1.0:
                continue
            before = chord_label_at_time(chord_segments, max(0.0, t - 0.12), default="")
            after = chord_label_at_time(chord_segments, t + 0.12, default="")
            if before and after:
                sample += 1
                if before != after:
                    change_hits += 1.0
            if sample >= 24:
                break
        change_score = (change_hits / sample) if sample else 0.0
        score = (1.0 - min(1.0, nearest / 1.5)) + change_score * 0.75
        if score > best_score:
            best_score = score
            best_phase = phase
    return best_phase


def build_bar_windows(beats, start, song_end, bar_dur_fallback, max_bars):
    if len(beats) < 8:
        total_bars = int(math.ceil(max(0.0, song_end - start) / bar_dur_fallback))
        total_bars = max(1, min(total_bars, max_bars))
        windows = []
        for idx in range(total_bars):
            b_start = start + idx * bar_dur_fallback
            b_end = b_start + bar_dur_fallback
            windows.append((b_start, b_end))
        return windows

    # Phase selection is done before this call by filtering beats to downbeats.
    downbeats = [b for b in beats if b >= start - 0.4]
    if not downbeats:
        downbeats = [start]
    if downbeats[0] > start + 0.35:
        downbeats = [start] + downbeats
    else:
        downbeats[0] = min(downbeats[0], start)

    windows = []
    for i in range(len(downbeats) - 1):
        b_start = downbeats[i]
        b_end = downbeats[i + 1]
        if b_end <= b_start:
            continue
        windows.append((b_start, b_end))
        if len(windows) >= max_bars:
            return windows

    median_bar = statistics.median(
        [max(0.25, e - s) for s, e in windows[-16:]]
    ) if windows else bar_dur_fallback
    cursor = windows[-1][1] if windows else start
    while cursor < song_end - 0.05 and len(windows) < max_bars:
        nxt = cursor + median_bar
        windows.append((cursor, nxt))
        cursor = nxt

    if not windows:
        windows = [(start, start + bar_dur_fallback)]

    return windows[:max_bars]


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


def is_non_lyric_line(line):
    text = str(line or "").strip().lower()
    if not text:
        return True
    return text in {"(instrumental)", "instrumental", "[instrumental]"}


def fit_phrases_to_slots(phrases, slot_count):
    if slot_count <= 0:
        return []
    clean = [p.strip() for p in phrases if p and p.strip()]
    if not clean:
        return [""] * slot_count
    if slot_count == 1:
        return [", ".join(clean)]
    if len(clean) <= slot_count:
        return clean + [""] * (slot_count - len(clean))
    grouped = []
    step = len(clean) / slot_count
    for i in range(slot_count):
        a = int(round(i * step))
        b = int(round((i + 1) * step))
        grouped.append(", ".join(p for p in clean[a:b] if p))
    return grouped


def assign_lyrics_to_events(bars, sections):
    for bar in bars:
        bar["lyric"] = ""
        for ev in bar.get("events", []):
            ev["lyric"] = ""

    for sec in sections:
        start = max(1, int(sec["start_bar"]))
        end = max(start, int(sec["end_bar"]))
        sec_bars = bars[start - 1:end]
        if not sec_bars:
            continue
        lines = [ln for ln in sec.get("lyrics", []) if not is_non_lyric_line(ln)]
        if not lines:
            continue
        line_groups = [[] for _ in sec_bars]
        for i, line in enumerate(lines):
            target = int(round((i + 0.5) * len(sec_bars) / max(1, len(lines)) - 0.5))
            target = max(0, min(len(sec_bars) - 1, target))
            line_groups[target].append(line)

        for bar, bucket in zip(sec_bars, line_groups):
            bar["section"] = sec.get("name", "")
            events = bar.get("events", [])
            if not events or not bucket:
                continue
            phrases = []
            for line in bucket:
                phrases.extend(chunk_phrases_from_line(line))
            fitted = fit_phrases_to_slots(phrases, len(events))
            for ev, text in zip(events, fitted):
                ev["lyric"] = text
            own = [ev.get("lyric", "") for ev in events if ev.get("lyric", "").strip()]
            bar["lyric"] = own[0] if own else ""


def is_lyric_section_name(name):
    kind = section_kind(name)
    return kind in {"verse", "chorus", "bridge", "other"}


def has_lyric_text(bar):
    if str(bar.get("lyric", "")).strip():
        return True
    for ev in bar.get("events", []):
        if str(ev.get("lyric", "")).strip():
            return True
    return False


def collapse_false_lyric_bars(bars):
    if len(bars) < 3:
        return bars, 0
    out = list(bars)
    removed = 0
    i = 1
    while i < len(out) - 1:
        prev_bar = out[i - 1]
        bar = out[i]
        next_bar = out[i + 1]
        section = str(bar.get("section", ""))
        if not is_lyric_section_name(section):
            i += 1
            continue
        if has_lyric_text(bar):
            i += 1
            continue
        if not (has_lyric_text(prev_bar) and has_lyric_text(next_bar)):
            i += 1
            continue
        duration = max(0.0, float(bar.get("end_sec", 0)) - float(bar.get("start_sec", 0)))
        confidence = float(bar.get("confidence", 0.0) or 0.0)
        chord = str(bar.get("chord", ""))
        prev_chord = str(prev_bar.get("chord", ""))
        next_chord = str(next_bar.get("chord", ""))
        if duration <= 2.2 or confidence < 0.3 or chord == prev_chord or chord == next_chord:
            del out[i]
            removed += 1
            continue
        i += 1

    for idx, bar in enumerate(out, start=1):
        bar["bar"] = idx
    return out, removed


def rebuild_sections_from_bars(bars, fallback_sections):
    if not bars:
        return []
    out = []
    cursor = 0
    names = [str(bar.get("section", "") or "Unmapped") for bar in bars]
    while cursor < len(bars):
        name = names[cursor]
        end = cursor
        while end + 1 < len(bars) and names[end + 1] == name:
            end += 1
        lyrics = []
        for sec in fallback_sections:
            if sec.get("name") == name:
                lyrics = list(sec.get("lyrics", []))
                break
        out.append({
            "name": name,
            "start_bar": cursor + 1,
            "end_bar": end + 1,
            "lyrics": lyrics,
        })
        cursor = end + 1
    return out


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


def section_kind(name):
    t = str(name or "").strip().lower()
    if "intro" in t:
        return "intro"
    if "outro" in t or "ending" in t:
        return "outro"
    if "chorus" in t or "refrain" in t:
        return "chorus"
    if "verse" in t:
        return "verse"
    if "bridge" in t:
        return "bridge"
    if "solo" in t or "instrumental" in t or "break" in t:
        return "instrumental"
    return "other"


def estimate_section_bars(sec):
    kind = section_kind(sec.get("name", ""))
    lines = [ln for ln in sec.get("lines", []) if not is_non_lyric_line(ln)]
    line_count = len(lines)
    phrase_count = sum(max(1, len(chunk_phrases_from_line(ln))) for ln in lines)
    if kind == "intro":
        return max(2, 4 if line_count == 0 else int(round(line_count * 1.0)))
    if kind == "outro":
        return max(2, 4 if line_count == 0 else int(round(line_count * 1.0)))
    if kind == "instrumental":
        return max(4, 8 if line_count == 0 else int(round(line_count * 1.5)))
    if kind == "chorus":
        return max(4, int(round(max(1, line_count) * 1.1)))
    if kind == "bridge":
        return max(4, int(round(max(1, line_count) * 1.0)))
    if kind == "verse":
        return max(4, int(round(max(1, line_count) * 1.0)))
    return max(2, int(round(max(1, line_count) * 1.0)))


def allocate_sections_to_bars(total_bars, lyric_sections):
    if not lyric_sections:
        return []
    minimums = [1 for _ in lyric_sections]
    targets = [estimate_section_bars(sec) for sec in lyric_sections]
    counts = [max(mn, tg) for mn, tg in zip(minimums, targets)]

    current = sum(counts)
    if current == total_bars:
        return counts
    if current < total_bars:
        extra = total_bars - current
        weights = [max(1, t) for t in targets]
        weight_total = sum(weights) or 1
        for i in range(len(counts)):
            add = int(round(extra * (weights[i] / weight_total)))
            counts[i] += add
        while sum(counts) < total_bars:
            idx = min(range(len(counts)), key=lambda i: counts[i] / max(1, targets[i]))
            counts[idx] += 1
        while sum(counts) > total_bars:
            idx = max(range(len(counts)), key=lambda i: counts[i] / max(1, targets[i]))
            if counts[idx] > minimums[idx]:
                counts[idx] -= 1
            else:
                break
        return counts

    # Shrink while preserving minimum.
    while sum(counts) > total_bars:
        idx = max(range(len(counts)), key=lambda i: (counts[i] - minimums[i], counts[i]))
        if counts[idx] > minimums[idx]:
            counts[idx] -= 1
        else:
            break
    while sum(counts) < total_bars:
        idx = min(range(len(counts)), key=lambda i: counts[i])
        counts[idx] += 1
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

    mark_step("STEP", "analyze_beats", "Analyze beat grid")
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
    total_bars_guess = int(math.ceil(max(0.0, song_end - start) / bar_dur))
    total_bars_guess = max(1, min(total_bars_guess, args.max_bars))
    chord_segments = segments_from_chordino(chordino, song_end=song_end)
    chord_segments_alt = segments_from_chordino(chordino_alt, song_end=song_end) if chordino_alt else []
    pulses_per_bar = infer_pulses_per_bar(beats, bar_dur)
    phase = infer_downbeat_phase(beats, start, chord_segments, pulses_per_bar=pulses_per_bar)
    downbeats = [b for i, b in enumerate(beats) if i % pulses_per_bar == phase]
    bar_windows = build_bar_windows(downbeats, start, song_end, bar_dur, args.max_bars)
    total_bars = len(bar_windows)

    mark_step("DONE", "analyze_beats")
    mark_step("STEP", "build_chords", "Build chord events")

    bars = []
    prev = "C"
    alt_better = 0
    for idx, (b_start, b_end) in enumerate(bar_windows):
        b_len = max(0.2, b_end - b_start)
        beat_len = b_len / 4.0
        events = []
        ev_prev = prev
        for beat_idx in range(4):
            e_start = b_start + beat_idx * beat_len
            e_end = min(b_end, e_start + beat_len)
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

        # Post-pass: if bar collapsed to one event, try strong half-bar split.
        if len(merged) == 1:
            half = b_start + b_len * 0.5
            left_chord, left_conf = score_chord_for_window(chord_segments, b_start, half, prev=prev)
            right_chord, right_conf = score_chord_for_window(chord_segments, half, b_end, prev=left_chord)
            left_src = "fullmix"
            right_src = "fullmix"
            if chord_segments_alt:
                alt_l, alt_l_conf = score_chord_for_window(chord_segments_alt, b_start, half, prev=prev)
                if alt_l_conf > left_conf + 0.03:
                    left_chord, left_conf = alt_l, alt_l_conf
                    left_src = "harmony-stem"
                alt_r, alt_r_conf = score_chord_for_window(chord_segments_alt, half, b_end, prev=left_chord)
                if alt_r_conf > right_conf + 0.03:
                    right_chord, right_conf = alt_r, alt_r_conf
                    right_src = "harmony-stem"
            if left_chord != right_chord and max(left_conf, right_conf) >= 0.18:
                merged = [
                    {
                        "chord": left_chord,
                        "source": left_src,
                        "confidence": round(left_conf, 3),
                        "beat_start": 1,
                        "beat_length": 2,
                        "lyric": "",
                    },
                    {
                        "chord": right_chord,
                        "source": right_src if right_src == left_src else "hybrid",
                        "confidence": round(right_conf, 3),
                        "beat_start": 3,
                        "beat_length": 2,
                        "lyric": "",
                    },
                ]

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

    mark_step("DONE", "build_chords")
    mark_step("STEP", "align_sections", "Align sections and lyrics")
    lyric_sections = parse_lyrics_sections(lyrics)
    sections = build_sections(total_bars, lyric_sections)
    assign_lyrics_to_events(bars, sections)
    bars, collapsed_false_bars = collapse_false_lyric_bars(bars)
    sections = rebuild_sections_from_bars(bars, sections)
    mark_step("DONE", "align_sections")

    draft = {
        "source": "autodraft-v3 (beat-grid + section-aware lyrics + chord post-pass)",
        "audio": str(audio),
        "audio_alt": str(audio_alt) if audio_alt and audio_alt.exists() else "",
        "lyrics": str(lyrics),
        "chart_start_sec": start,
        "bar_duration_sec": round(statistics.median([max(0.2, e - s) for s, e in bar_windows]), 4) if bar_windows else round(bar_dur, 4),
        "beat_duration_sec": round(beat_dur, 4),
        "bars_from_alt_stem": alt_better,
        "collapsed_false_bars": collapsed_false_bars,
        "downbeat_phase": phase,
        "pulses_per_bar": pulses_per_bar,
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
                "bar": row.get("bar"),
                "start_sec": row.get("start_sec"),
                "end_sec": row.get("end_sec"),
                "chord": row.get("chord"),
                "source": row.get("source"),
                "confidence": row.get("confidence"),
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
        f"- False lyric bars collapsed: `{collapsed_false_bars}`",
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
