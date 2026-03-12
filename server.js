const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = path.join(__dirname, "public");
const AUTO_DRAFT_SCRIPT = path.join(__dirname, "tools", "arrange_auto", "run_let_it_be_draft.sh");
const AUTO_DRAFT_JSON = path.join(__dirname, "tmp", "analysis-out", "let-it-be-draft", "draft-arrangement.json");
const CHORDINO_TXT = path.join(__dirname, "tmp", "analysis-out", "let-it-be-draft", "chordino.txt");
const CHORDINO_ALT_TXT = path.join(__dirname, "tmp", "analysis-out", "let-it-be-draft", "chordino-alt.txt");
const NOTES_TXT = path.join(__dirname, "tmp", "analysis-out", "let-it-be-draft", "notes.txt");
const SONG_DRAFTS_JS = path.join(PUBLIC_DIR, "song-drafts.js");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const AUTO_DRAFT_STEP_LABELS = {
  prepare_audio: "Prepare audio input",
  build_harmony: "Build harmony-focused stem",
  analyze: "Analyze beats/chords/lyrics",
  publish: "Publish draft to app",
  complete: "Finalize"
};

function createAutoDraftState() {
  return {
    running: false,
    status: "idle",
    startedAt: null,
    endedAt: null,
    currentStepId: "",
    error: "",
    logs: [],
    steps: Object.entries(AUTO_DRAFT_STEP_LABELS).map(([id, label]) => ({ id, label, status: "pending" }))
  };
}

const autoDraft = createAutoDraftState();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestJson(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk || "");
      if (body.length > maxBytes) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", (error) => reject(error));
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function appendAutoDraftLog(line) {
  const value = String(line || "").trim();
  if (!value) return;
  autoDraft.logs.push(value);
  if (autoDraft.logs.length > 220) {
    autoDraft.logs.splice(0, autoDraft.logs.length - 220);
  }
}

function findStep(stepId) {
  return autoDraft.steps.find((step) => step.id === stepId) || null;
}

function setStepStatus(stepId, status) {
  const step = findStep(stepId);
  if (!step) return;
  step.status = status;
}

function setStepInProgress(stepId, label = "") {
  autoDraft.currentStepId = stepId;
  if (label) {
    const step = findStep(stepId);
    if (step) step.label = label;
  }
  autoDraft.steps.forEach((step) => {
    if (step.id === stepId) {
      step.status = "in_progress";
      return;
    }
    if (step.status === "in_progress") {
      step.status = "completed";
    }
  });
}

function setStepDone(stepId) {
  const step = findStep(stepId);
  if (!step) return;
  step.status = "completed";
  if (autoDraft.currentStepId === stepId) {
    autoDraft.currentStepId = "";
  }
}

function markRemainingSteps(status) {
  autoDraft.steps.forEach((step) => {
    if (step.status === "pending" || step.status === "in_progress") {
      step.status = status;
    }
  });
}

function normalizeDraftBars(rawBars) {
  if (!Array.isArray(rawBars)) return [];
  return rawBars.map((bar, index) => {
    const events = Array.isArray(bar?.events) ? bar.events : [];
    return {
      bar: Number(bar?.bar || index + 1),
      chord: String(bar?.chord || "C"),
      lyric: String(bar?.lyric || ""),
      confidence: Number(bar?.confidence || 0),
      events: events.map((ev) => ({
        chord: String(ev?.chord || "C"),
        beatStart: Number(ev?.beatStart || ev?.beat_start || 1),
        beatLength: Number(ev?.beatLength || ev?.beat_length || 1),
        lyric: String(ev?.lyric || "")
      }))
    };
  });
}

function publishDraftToApp() {
  const raw = fs.readFileSync(AUTO_DRAFT_JSON, "utf8");
  const parsed = JSON.parse(raw);
  const draftPayload = {
    id: "let-it-be-hybrid-v2",
    label: "Auto Hybrid Draft v2",
    source: String(parsed?.source || "auto-draft"),
    chart_start_sec: Number(parsed?.chart_start_sec || 12),
    bar_duration_sec: Number(parsed?.bar_duration_sec || 3.4),
    bars: normalizeDraftBars(parsed?.bars)
  };
  const source = `window.PIANO_TRAINER_SONG_DRAFTS = ${JSON.stringify({ "let-it-be-hybrid-v2": draftPayload }, null, 2)};\n`;
  fs.writeFileSync(SONG_DRAFTS_JS, source, "utf8");
}

function simplifyChordLabel(label) {
  const value = String(label || "").trim();
  if (!value || value.toUpperCase() === "N") return "N";
  const [mainRaw, bassRaw] = value.replace(/:/g, "").split("/", 2);
  const mainMatch = String(mainRaw || "").match(/^([A-G](?:#|b)?)(.*)$/);
  if (!mainMatch) return value;
  const root = mainMatch[1];
  const tail = String(mainMatch[2] || "").toLowerCase().replace("maj", "");
  let quality = "";
  if (tail.includes("dim") || tail.includes("o")) quality = "dim";
  else if (tail.includes("m")) quality = "m";
  let out = `${root}${quality}`;
  if (bassRaw) {
    const bass = String(bassRaw).match(/^([A-G](?:#|b)?)/)?.[1];
    if (bass) out = `${out}/${bass}`;
  }
  return out;
}

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
  Fb: "E"
};

function normalizePitchClass(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PITCH_CLASSES.includes(text)) return text;
  if (FLAT_TO_SHARP[text]) return FLAT_TO_SHARP[text];
  return text;
}

function parseChordParts(chord) {
  const text = String(chord || "").trim();
  if (!text || text.toUpperCase() === "N") return null;
  const [main] = text.split("/", 1);
  const match = String(main || "").match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;
  const root = normalizePitchClass(match[1]);
  const tail = String(match[2] || "").toLowerCase();
  let quality = "major";
  if (tail.includes("dim") || tail.includes("o")) quality = "dim";
  else if (tail.includes("m")) quality = "minor";
  return { root, quality };
}

function chordTones(chord) {
  const parts = parseChordParts(chord);
  if (!parts || !parts.root) return [];
  const rootIndex = PITCH_CLASSES.indexOf(parts.root);
  if (rootIndex < 0) return [];
  const intervals = parts.quality === "minor"
    ? [0, 3, 7]
    : parts.quality === "dim"
      ? [0, 3, 6]
      : [0, 4, 7];
  return intervals.map((interval) => PITCH_CLASSES[(rootIndex + interval) % 12]);
}

function parseNotesText(raw) {
  const out = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    const nums = value.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 3) continue;
    const midi = Number(nums[0]);
    const startSec = Number(nums[1]);
    const endSec = Number(nums[2]);
    if (!Number.isFinite(midi) || !Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
    out.push({ midi, startSec, endSec });
  }
  return out;
}

function inferBassPitchClassForWindow(notes, startSec, endSec) {
  if (!Array.isArray(notes) || !notes.length) return "";
  const overlaps = [];
  for (const row of notes) {
    const overlap = Math.max(0, Math.min(endSec, row.endSec) - Math.max(startSec, row.startSec));
    if (overlap <= 0) continue;
    overlaps.push({ midi: Number(row.midi), overlap });
  }
  if (!overlaps.length) return "";
  overlaps.sort((a, b) => a.midi - b.midi || b.overlap - a.overlap);
  const lowBand = overlaps.slice(0, Math.min(4, overlaps.length));
  const best = lowBand.sort((a, b) => b.overlap - a.overlap)[0];
  const pitchIndex = ((Math.round(best.midi) % 12) + 12) % 12;
  return PITCH_CLASSES[pitchIndex] || "";
}

function withInversion(chord, bassPitchClass) {
  const parts = parseChordParts(chord);
  if (!parts || !parts.root || !bassPitchClass) return chord;
  const bass = normalizePitchClass(bassPitchClass);
  if (!bass || bass === parts.root) return chord;
  const tones = chordTones(chord);
  if (!tones.includes(bass)) return chord;
  const base = String(chord).split("/", 1)[0];
  return `${base}/${bass}`;
}

function parseChordinoText(raw) {
  const rows = [];
  for (const line of String(raw || "").split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    const match = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*:\s*(.+)$/);
    if (!match) continue;
    const timeSec = Number(match[1]);
    const chord = simplifyChordLabel(match[2]);
    if (!Number.isFinite(timeSec) || !chord || chord === "N") continue;
    rows.push({ timeSec, chord });
  }
  rows.sort((a, b) => a.timeSec - b.timeSec);
  return rows;
}

function segmentsFromChordRows(rows, fallbackEndSec) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const endFallback = Number.isFinite(fallbackEndSec) ? Number(fallbackEndSec) : Number(rows[rows.length - 1].timeSec || 0) + 2;
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const startSec = Number(rows[i].timeSec);
    const chord = rows[i].chord;
    const endSec = i + 1 < rows.length ? Number(rows[i + 1].timeSec) : endFallback;
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec || !chord) continue;
    out.push({ startSec, endSec, chord });
  }
  return out;
}

function scoreChordForWindow(segments, startSec, endSec) {
  const durations = new Map();
  for (const row of segments) {
    const overlap = Math.max(0, Math.min(endSec, row.endSec) - Math.max(startSec, row.startSec));
    if (overlap <= 0) continue;
    durations.set(row.chord, (durations.get(row.chord) || 0) + overlap);
  }
  if (!durations.size) return { chord: "C", confidence: 0 };
  const ranked = Array.from(durations.entries()).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked.length > 1 ? ranked[1][1] : 0;
  const total = ranked.reduce((sum, row) => sum + row[1], 0) || 1;
  const confidence = Math.max(0, Math.min(1, (top[1] - second) / total));
  return { chord: top[0], confidence: Number(confidence.toFixed(3)) };
}

function mergeBeatEvents(events) {
  const merged = [];
  for (const ev of events) {
    if (merged.length && merged[merged.length - 1].chord === ev.chord) {
      merged[merged.length - 1].beatLength += ev.beatLength;
      merged[merged.length - 1].confidence = Number(((merged[merged.length - 1].confidence + ev.confidence) / 2).toFixed(3));
      continue;
    }
    merged.push({ ...ev });
  }
  return merged;
}

function analyzeBarChords(startSec, endSec, beatsPerBar = 4) {
  const start = Number(startSec);
  const end = Number(endSec);
  const beats = Math.max(1, Math.min(12, Number(beatsPerBar) || 4));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Invalid bar window");
  }
  if (!fs.existsSync(CHORDINO_TXT)) {
    throw new Error("Chord analysis data not found. Run Auto-draft first.");
  }

  const mainRows = parseChordinoText(fs.readFileSync(CHORDINO_TXT, "utf8"));
  const mainSegments = segmentsFromChordRows(mainRows, end);
  const hasAlt = fs.existsSync(CHORDINO_ALT_TXT);
  const altSegments = hasAlt
    ? segmentsFromChordRows(parseChordinoText(fs.readFileSync(CHORDINO_ALT_TXT, "utf8")), end)
    : [];
  const notes = fs.existsSync(NOTES_TXT) ? parseNotesText(fs.readFileSync(NOTES_TXT, "utf8")) : [];

  const beatDuration = (end - start) / beats;
  const beatEvents = [];
  for (let i = 0; i < beats; i += 1) {
    const beatStartSec = start + i * beatDuration;
    const beatEndSec = i + 1 === beats ? end : beatStartSec + beatDuration;
    const mainPick = scoreChordForWindow(mainSegments, beatStartSec, beatEndSec);
    let chosen = { ...mainPick, source: "fullmix" };
    if (altSegments.length) {
      const altPick = scoreChordForWindow(altSegments, beatStartSec, beatEndSec);
      if (altPick.confidence > mainPick.confidence + 0.03) {
        chosen = { ...altPick, source: "harmony-stem" };
      }
    }
    const bass = inferBassPitchClassForWindow(notes, beatStartSec, beatEndSec);
    const chordWithBass = withInversion(chosen.chord, bass);
    beatEvents.push({
      chord: chordWithBass,
      beatStart: i + 1,
      beatLength: 1,
      confidence: chosen.confidence,
      source: chosen.source
    });
  }
  return mergeBeatEvents(beatEvents);
}

function parseStepMarker(line) {
  const value = String(line || "").trim();
  if (!value) return;
  const parts = value.split("|");
  if (parts.length < 2) return;
  const kind = parts[0];
  const stepId = parts[1];
  if (!AUTO_DRAFT_STEP_LABELS[stepId]) return;
  if (kind === "STEP") {
    setStepInProgress(stepId, parts[2] || "");
    return;
  }
  if (kind === "DONE") {
    setStepDone(stepId);
    return;
  }
  if (kind === "ERROR") {
    autoDraft.error = parts[2] || `Failed during ${stepId}`;
    setStepStatus(stepId, "error");
  }
}

function handleChunk(bufferState, chunk) {
  bufferState.value += String(chunk || "");
  const lines = bufferState.value.split(/\r?\n/);
  bufferState.value = lines.pop() || "";
  for (const line of lines) {
    appendAutoDraftLog(line);
    parseStepMarker(line);
  }
}

function startAutoDraftJob() {
  if (autoDraft.running) {
    return false;
  }

  Object.assign(autoDraft, createAutoDraftState());
  autoDraft.running = true;
  autoDraft.status = "running";
  autoDraft.startedAt = new Date().toISOString();
  appendAutoDraftLog("Job started");

  const child = spawn("bash", [AUTO_DRAFT_SCRIPT], {
    cwd: __dirname,
    env: process.env
  });

  const outBuffer = { value: "" };
  const errBuffer = { value: "" };

  child.stdout.on("data", (chunk) => handleChunk(outBuffer, chunk));
  child.stderr.on("data", (chunk) => handleChunk(errBuffer, chunk));

  child.on("error", (error) => {
    autoDraft.running = false;
    autoDraft.status = "error";
    autoDraft.error = String(error?.message || "Auto-draft process failed to start");
    autoDraft.endedAt = new Date().toISOString();
    markRemainingSteps("error");
    appendAutoDraftLog(`ERROR: ${autoDraft.error}`);
  });

  child.on("close", (code) => {
    if (outBuffer.value.trim()) {
      appendAutoDraftLog(outBuffer.value.trim());
      parseStepMarker(outBuffer.value.trim());
    }
    if (errBuffer.value.trim()) {
      appendAutoDraftLog(errBuffer.value.trim());
      parseStepMarker(errBuffer.value.trim());
    }

    if (code !== 0) {
      autoDraft.running = false;
      autoDraft.status = "error";
      autoDraft.error = autoDraft.error || `Auto-draft exited with code ${code}`;
      autoDraft.endedAt = new Date().toISOString();
      markRemainingSteps("error");
      appendAutoDraftLog(`ERROR: ${autoDraft.error}`);
      return;
    }

    try {
      setStepInProgress("publish");
      appendAutoDraftLog("Publishing generated draft to public/song-drafts.js");
      publishDraftToApp();
      setStepDone("publish");
      setStepInProgress("complete");
      setStepDone("complete");
      autoDraft.status = "success";
      appendAutoDraftLog("Auto-draft completed and published.");
    } catch (error) {
      autoDraft.status = "error";
      autoDraft.error = String(error?.message || "Failed to publish draft output");
      setStepStatus("publish", "error");
      markRemainingSteps("error");
      appendAutoDraftLog(`ERROR: ${autoDraft.error}`);
    } finally {
      autoDraft.running = false;
      autoDraft.endedAt = new Date().toISOString();
    }
  });

  return true;
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);

  if (reqUrl.pathname === "/api/admin/auto-draft/status" && req.method === "GET") {
    sendJson(res, 200, autoDraft);
    return;
  }

  if (reqUrl.pathname === "/api/admin/auto-draft/run" && req.method === "POST") {
    const started = startAutoDraftJob();
    if (!started) {
      sendJson(res, 409, { ok: false, message: "Auto-draft already running", state: autoDraft });
      return;
    }
    sendJson(res, 202, { ok: true, state: autoDraft });
    return;
  }

  if (reqUrl.pathname === "/api/song/analyze-bar" && req.method === "POST") {
    readRequestJson(req)
      .then((payload) => {
        const startSec = Number(payload?.startSec);
        const endSec = Number(payload?.endSec);
        const beatsPerBar = Number(payload?.beatsPerBar || 4);
        const events = analyzeBarChords(startSec, endSec, beatsPerBar);
        sendJson(res, 200, { ok: true, events });
      })
      .catch((error) => {
        sendJson(res, 400, { ok: false, message: String(error?.message || "Unable to analyze bar") });
      });
    return;
  }

  const urlPath = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
  const safePath = path.normalize(urlPath).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, path.join(PUBLIC_DIR, "index.html"));
  });
});

server.listen(PORT, () => {
  console.log(`Piano Trainer running on http://localhost:${PORT}`);
});
