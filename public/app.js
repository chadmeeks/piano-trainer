const screens = {
  circle: document.getElementById("screen-circle"),
  lessons: document.getElementById("screen-lessons"),
  admin: document.getElementById("screen-admin"),
  practice: document.getElementById("screen-practice"),
  history: document.getElementById("screen-history"),
  complete: document.getElementById("screen-complete")
};

const STORAGE_KEY = "pianoTrainerV2";

const MODULES = [
  { id: "scales", title: "Scales" },
  { id: "arpeggios", title: "Arpeggios" },
  { id: "chords", title: "Chords" },
  { id: "inversions", title: "Inversions" },
  { id: "songs", title: "Songs" }
];

const CIRCLE_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"];
const ARPEGGIO_MODES = [
  { id: "lh-1", label: "Left Hand 1 Octave" },
  { id: "lh-2", label: "Left Hand 2 Octave" },
  { id: "rh-1", label: "Right Hand 1 Octave" },
  { id: "rh-2", label: "Right Hand 2 Octave" },
  { id: "both", label: "Both Hands" }
];
const SCALE_MODES = [
  { id: "1", label: "1 Octave" },
  { id: "2", label: "2 Octaves" }
];
const SCALE_HANDS = [
  { id: "rh", label: "Right Hand" },
  { id: "lh", label: "Left Hand" }
];
const SCALE_DIRECTIONS = [
  { id: "up", label: "Ascending only" },
  { id: "updown", label: "Up and down" }
];

const KEYBOARD_NOTES = build88KeyNoteRange();
const WHITE_KEY_NOTES = KEYBOARD_NOTES.filter((note) => !note.includes("#"));

const SEMITONES = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11
};

const state = {
  screen: "circle",
  selectedKey: "C",
  keyProgress: {},
  block: "technique",
  techniqueIndex: 0,
  songIndex: 0,
  sessionMode: "custom",
  blockSecondsRemaining: 0,
  timerRunning: false,
  timerSessionActive: false,
  intervalId: null,
  streak: 0,
  lastSessionISO: null,
  arpeggioMode: "both",
  scaleMode: "1",
  scaleHand: "rh",
  scaleDirection: "up",
  chordStepIndex: 0,
  inversionStepIndex: 0,
  practiceHistory: {},
  historyMonthOffset: 0,
  selectedHistoryDateKey: null,
  songTrainerMode: "play",
  songPlayalongFocus: true,
  songShowVideoInPlayMode: false,
  selectedSongSection: "",
  songArrangeAccess: false,
  songTimingOverrides: {},
  songSectionOverrides: {},
  songArrangementOverrides: {},
  songSourceChoice: {},
  songVideoChoice: {},
  adminSongKeyFilter: "all",
  adminSelectedSongId: "",
  songCalibrationStride: 1,
  songArrangeSelectedBars: [],
  completedExerciseIds: []
};

const songPlayback = {
  apiRequested: false,
  pollIntervalId: null,
  player: null,
  playerReady: false,
  pendingSongData: null,
  currentVideoId: null,
  currentSongId: null,
  activeMeasureIndex: 0,
  activeChordEventIndex: 0,
  videoPlaying: false,
  scrubberDragging: false,
  notationRafId: null,
  calibrationSongId: null,
  calibrationNextBarIndex: 0
};

const adminAutoDraft = {
  pollIntervalId: null,
  status: null,
  lastAppliedEndedAt: ""
};

function build88KeyNoteRange() {
  const notes = [];
  for (let midi = 21; midi <= 108; midi += 1) {
    notes.push(midiToNoteName(midi));
  }
  return notes;
}

function midiToNoteName(midi) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const pitch = names[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${pitch}${octave}`;
}

function getDefaultModules() {
  return Object.fromEntries(MODULES.map((m) => [m.id, false]));
}

function ensureProgressForKey(keyName) {
  if (!state.keyProgress[keyName]) {
    state.keyProgress[keyName] = {
      completed: false,
      modules: getDefaultModules()
    };
  }
  return state.keyProgress[keyName];
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      CIRCLE_KEYS.forEach((keyName) => ensureProgressForKey(keyName));
      return;
    }

    const parsed = JSON.parse(raw);
    state.selectedKey = CIRCLE_KEYS.includes(parsed.selectedKey) ? parsed.selectedKey : "C";
    state.streak = Number(parsed.streak || 0);
    state.lastSessionISO = parsed.lastSessionISO || null;
    state.arpeggioMode = ARPEGGIO_MODES.some((mode) => mode.id === parsed.arpeggioMode) ? parsed.arpeggioMode : "both";
    state.scaleMode = SCALE_MODES.some((mode) => mode.id === parsed.scaleMode) ? parsed.scaleMode : "1";
    state.scaleHand = SCALE_HANDS.some((mode) => mode.id === parsed.scaleHand) ? parsed.scaleHand : "rh";
    state.scaleDirection = SCALE_DIRECTIONS.some((mode) => mode.id === parsed.scaleDirection) ? parsed.scaleDirection : "up";
    state.practiceHistory = parsed.practiceHistory && typeof parsed.practiceHistory === "object" ? parsed.practiceHistory : {};
    state.selectedHistoryDateKey = typeof parsed.selectedHistoryDateKey === "string" ? parsed.selectedHistoryDateKey : null;
    state.songTimingOverrides = parsed.songTimingOverrides && typeof parsed.songTimingOverrides === "object"
      ? parsed.songTimingOverrides
      : {};
    state.songSectionOverrides = parsed.songSectionOverrides && typeof parsed.songSectionOverrides === "object"
      ? parsed.songSectionOverrides
      : {};
    state.songArrangementOverrides = parsed.songArrangementOverrides && typeof parsed.songArrangementOverrides === "object"
      ? parsed.songArrangementOverrides
      : {};
    state.songSourceChoice = parsed.songSourceChoice && typeof parsed.songSourceChoice === "object"
      ? parsed.songSourceChoice
      : {};
    state.songVideoChoice = parsed.songVideoChoice && typeof parsed.songVideoChoice === "object"
      ? parsed.songVideoChoice
      : {};
    state.adminSongKeyFilter = typeof parsed.adminSongKeyFilter === "string" ? parsed.adminSongKeyFilter : "all";
    state.adminSelectedSongId = typeof parsed.adminSelectedSongId === "string" ? parsed.adminSelectedSongId : "";
    const parsedStride = Number(parsed.songCalibrationStride || 1);
    state.songCalibrationStride = [1, 2, 4, 8].includes(parsedStride) ? parsedStride : 1;

    for (const keyName of CIRCLE_KEYS) {
      const src = parsed.keyProgress?.[keyName] || {};
      state.keyProgress[keyName] = {
        completed: src.completed === true,
        modules: { ...getDefaultModules(), ...(src.modules || {}) }
      };
    }
  } catch {
    CIRCLE_KEYS.forEach((keyName) => ensureProgressForKey(keyName));
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedKey: state.selectedKey,
      keyProgress: state.keyProgress,
      streak: state.streak,
      lastSessionISO: state.lastSessionISO,
      arpeggioMode: state.arpeggioMode,
      scaleMode: state.scaleMode,
      scaleHand: state.scaleHand,
      scaleDirection: state.scaleDirection,
      practiceHistory: state.practiceHistory,
      selectedHistoryDateKey: state.selectedHistoryDateKey,
      songTimingOverrides: state.songTimingOverrides,
      songSectionOverrides: state.songSectionOverrides,
      songArrangementOverrides: state.songArrangementOverrides,
      songSourceChoice: state.songSourceChoice,
      songVideoChoice: state.songVideoChoice,
      adminSongKeyFilter: state.adminSongKeyFilter,
      adminSelectedSongId: state.adminSelectedSongId,
      songCalibrationStride: state.songCalibrationStride
    })
  );
}

function showScreen(screenName) {
  state.screen = screenName;
  if (screenName !== "practice" && screenName !== "admin") {
    state.songArrangeAccess = false;
  }
  Object.entries(screens).forEach(([name, el]) => {
    el.classList.toggle("active", name === screenName);
  });
  if (screenName !== "practice") {
    stopSongFollowAlongPoll();
    songPlayback.videoPlaying = false;
    if (songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.pauseVideo === "function") {
      songPlayback.player.pauseVideo();
    }
  }
  if (screenName === "admin") {
    renderAdmin();
    startAdminAutoDraftPolling();
  } else {
    stopAdminAutoDraftPolling();
  }
  renderNav();
}

function currentKeyProgress() {
  return ensureProgressForKey(state.selectedKey);
}

function completedModuleCountForKey(keyName) {
  const progress = ensureProgressForKey(keyName);
  return MODULES.filter((m) => progress.modules[m.id]).length;
}

function dateKeyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ensureHistoryDay(dayKey) {
  if (!state.practiceHistory[dayKey]) {
    state.practiceHistory[dayKey] = {
      seconds: 0,
      lessons: {}
    };
  }
  return state.practiceHistory[dayKey];
}

function practiceDayKeysSorted() {
  return Object.keys(state.practiceHistory)
    .filter((key) => Number(state.practiceHistory[key]?.seconds || 0) > 0)
    .sort();
}

function computeStreaks() {
  const keys = practiceDayKeysSorted();
  if (!keys.length) return { current: 0, longest: 0, practicedDays: 0 };

  const dayMs = 86400000;
  const currentDateKey = dateKeyFromDate(new Date());
  const keySet = new Set(keys);
  let current = 0;
  let cursor = new Date(`${currentDateKey}T00:00:00`);
  while (keySet.has(dateKeyFromDate(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = new Date(`${keys[i - 1]}T00:00:00`);
    const curr = new Date(`${keys[i]}T00:00:00`);
    if ((curr - prev) === dayMs) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest, practicedDays: keys.length };
}

function addPracticeSecond() {
  const now = new Date();
  const dayKey = dateKeyFromDate(now);
  const day = ensureHistoryDay(dayKey);
  day.seconds = Number(day.seconds || 0) + 1;
  state.lastSessionISO = now.toISOString();
}

function trackLessonView(exercise) {
  if (!state.timerSessionActive || !exercise?.id) return;
  const dayKey = dateKeyFromDate(new Date());
  const day = ensureHistoryDay(dayKey);
  const alreadyTracked = Boolean(day.lessons[exercise.id]);
  day.lessons[exercise.id] = {
    title: exercise.title,
    key: state.selectedKey,
    moduleId: exercise.moduleId || "unknown"
  };
  if (!alreadyTracked) saveState();
}

function renderGlobalMeta() {
  const streaks = computeStreaks();
  state.streak = streaks.current;
  const last = state.lastSessionISO ? new Date(state.lastSessionISO).toLocaleDateString() : "never";
  document.getElementById("globalMeta").textContent = `Streak: ${streaks.current} day${streaks.current === 1 ? "" : "s"} · Last session: ${last}`;
}

function renderNav() {
  const navMap = {
    circle: "navCircleBtn",
    lessons: "navLessonsBtn",
    admin: "navAdminBtn",
    history: "navHistoryBtn",
    practice: "navLessonsBtn",
    complete: "navLessonsBtn"
  };
  for (const id of ["navCircleBtn", "navLessonsBtn", "navAdminBtn", "navHistoryBtn"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.toggle("active", navMap[state.screen] === id);
  }
}

function renderSessionTimerControls() {
  const timerText = document.getElementById("sessionTimerText");
  const pauseBtn = document.getElementById("sessionPauseBtn");
  if (!timerText || !pauseBtn) return;
  timerText.textContent = formatTime(state.blockSecondsRemaining);
  pauseBtn.textContent = state.timerRunning ? "Pause" : "Resume";
}

function renderCircle() {
  const circle = document.getElementById("circleOfFifths");
  const radiusPct = 42;

  const keysHtml = CIRCLE_KEYS.map((keyName, idx) => {
    const angleDeg = -90 + idx * 30;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = 50 + radiusPct * Math.cos(angleRad);
    const y = 50 + radiusPct * Math.sin(angleRad);
    const progress = ensureProgressForKey(keyName);
    return `
      <button
        class="circle-key ${progress.completed ? "complete" : ""}"
        data-key="${keyName}"
        style="left:${x.toFixed(3)}%; top:${y.toFixed(3)}%"
      >
        ${keyName}
      </button>
    `;
  }).join("");

  circle.innerHTML = `${keysHtml}<div class="circle-center"><strong>Circle Of Fifths</strong><p>Pick a key</p></div>`;
}

function keyLabel(keyName) {
  return `${keyName} Major`;
}

function keyRootMidi(keyName, octave = 4) {
  const semitone = SEMITONES[keyName];
  return 12 * (octave + 1) + semitone;
}

function buildTriad(rootMidi, quality = "major") {
  const third = quality === "minor" ? 3 : 4;
  return [rootMidi, rootMidi + third, rootMidi + 7];
}

function invertTriad(triad, inversion = "root") {
  if (inversion === "1st") return [triad[1], triad[2], triad[0] + 12];
  if (inversion === "2nd") return [triad[2], triad[0] + 12, triad[1] + 12];
  return [triad[0], triad[1], triad[2]];
}

function pitchClassFromMidi(midi) {
  return midiToNoteName(midi).replace(/\d+/g, "");
}

function inversionLabel(inversion) {
  if (inversion === "1st") return "1st inversion";
  if (inversion === "2nd") return "2nd inversion";
  return "Root position";
}

function inversionRomanSuffix(inversion) {
  if (inversion === "1st") return "6";
  if (inversion === "2nd") return "64";
  return "";
}

function beatsPerBarFromTimeSignature(timeSignature) {
  const top = Number.parseInt(String(timeSignature || "").split("/")[0], 10);
  return Number.isFinite(top) && top > 0 ? top : 4;
}

function normalizeChordEventBeats(chordInputs, beatsPerBar = 4) {
  if (!Array.isArray(chordInputs) || !chordInputs.length) return [];
  const normalized = chordInputs.map((row, index) => {
    const fallbackBeatStart = index === 0 ? 1 : null;
    const rawBeatStart = Number(row?.beatStart);
    const beatStart = Number.isFinite(rawBeatStart) && rawBeatStart > 0
      ? rawBeatStart
      : fallbackBeatStart;
    const rawBeatLength = Number(row?.beatLength);
    const beatLength = Number.isFinite(rawBeatLength) && rawBeatLength > 0
      ? rawBeatLength
      : null;
    return {
      ...row,
      beatStart,
      beatLength
    };
  });

  for (let i = 0; i < normalized.length; i += 1) {
    if (!Number.isFinite(normalized[i].beatStart)) {
      if (i === 0) normalized[i].beatStart = 1;
      else {
        const prev = normalized[i - 1];
        const prevEnd = Number(prev.beatStart || 1) + Number(prev.beatLength || 0);
        normalized[i].beatStart = prevEnd > 0 ? prevEnd : 1;
      }
    }
  }

  for (let i = 0; i < normalized.length; i += 1) {
    const row = normalized[i];
    if (!Number.isFinite(row.beatLength)) {
      const next = normalized[i + 1];
      const nextStart = Number(next?.beatStart);
      if (Number.isFinite(nextStart) && nextStart > row.beatStart) {
        row.beatLength = nextStart - row.beatStart;
      } else {
        row.beatLength = (beatsPerBar + 1) - row.beatStart;
      }
    }
    row.beatStart = Math.max(1, Math.min(beatsPerBar, row.beatStart));
    const maxLength = (beatsPerBar + 1) - row.beatStart;
    row.beatLength = Math.max(0.25, Math.min(maxLength, row.beatLength));
  }

  return normalized;
}

function buildSongChordEvent(chordSymbol, roman, lyric, startSec, endSec, inversion = "root", beatStart = 1, beatLength = 4) {
  const rawSymbol = compactChordSymbol(chordSymbol || "C");
  const [baseSymbolRaw, bassSymbolRaw] = rawSymbol.split("/", 2);
  const baseSymbol = baseSymbolRaw || "C";
  const bassSymbol = bassSymbolRaw ? compactChordSymbol(bassSymbolRaw) : "";
  const chordDefs = {
    C: { rootMidi: 60, quality: "major" },
    G: { rootMidi: 67, quality: "major" },
    Am: { rootMidi: 69, quality: "minor" },
    F: { rootMidi: 65, quality: "major" }
  };

  const def = chordDefs[baseSymbol] || chordDefs.C;
  const rootTriadRh = buildTriad(def.rootMidi, def.quality);
  const rootTriadLh = rootTriadRh.map((m) => m - 12);
  const rootPc = pitchClassFromMidi(rootTriadRh[0]);
  const thirdPc = pitchClassFromMidi(rootTriadRh[1]);
  const fifthPc = pitchClassFromMidi(rootTriadRh[2]);
  let effectiveInversion = inversion;
  if (bassSymbol) {
    if (bassSymbol === thirdPc) effectiveInversion = "1st";
    else if (bassSymbol === fifthPc) effectiveInversion = "2nd";
    else effectiveInversion = "root";
  }
  const triadRh = invertTriad(rootTriadRh, effectiveInversion);
  const triadLh = invertTriad(rootTriadLh, effectiveInversion);
  const staffTriadRh = (() => {
    const mapped = [...triadRh];
    const avg = mapped.reduce((sum, midi) => sum + midi, 0) / Math.max(1, mapped.length);
    if (avg > 74) return mapped.map((midi) => midi - 12);
    if (avg < 58) return mapped.map((midi) => midi + 12);
    return mapped;
  })();
  const bassPitch = pitchClassFromMidi(triadRh[0]);
  const chordDisplay = bassSymbol
    ? `${baseSymbol}/${bassSymbol}`
    : (effectiveInversion === "root" ? baseSymbol : `${baseSymbol}/${bassPitch}`);
  const romanDisplay = `${roman}${inversionRomanSuffix(effectiveInversion)}`;
  const lhRootMidi = triadLh.find((m) => pitchClassFromMidi(m) === rootPc) ?? triadLh[0];
  const rhRootMidi = triadRh.find((m) => pitchClassFromMidi(m) === rootPc) ?? triadRh[0];
  return {
    chordSymbol: chordDisplay,
    chordDisplay,
    roman,
    romanDisplay,
    inversion: effectiveInversion,
    inversionLabel: inversionLabel(effectiveInversion),
    lyric,
    beatStart,
    beatLength,
    startSec,
    endSec,
    staffNotes: staffTriadRh.map((m) => midiToNoteName(m)),
    notes: [...triadLh, ...triadRh].map((m) => midiToNoteName(m)),
    fingering: [5, 3, 1, 1, 3, 5],
    handAssignments: ["LH", "LH", "LH", "RH", "RH", "RH"],
    rootNotes: [midiToNoteName(lhRootMidi), midiToNoteName(rhRootMidi)],
    rootHands: ["LH", "RH"]
  };
}

function hydrateSongMeasureTiming(measure, fallbackTimeSignature = "4/4") {
  if (!measure || typeof measure !== "object") return measure;
  const startSec = Number(measure.startSec || 0);
  const endSec = Number(measure.endSec || startSec);
  const durationSec = Math.max(0, endSec - startSec);
  const timeSignature = measure.sectionTimeSignature || measure.timeSignature || fallbackTimeSignature || "4/4";
  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const rawEvents = Array.isArray(measure.chordEvents) && measure.chordEvents.length
    ? measure.chordEvents
    : [{
      chord: measure.chordSymbol,
      roman: measure.roman,
      inversion: measure.inversion || "root",
      lyric: measure.lyric || "",
      beatStart: 1,
      beatLength: beatsPerBar
    }];
  const beats = normalizeChordEventBeats(rawEvents, beatsPerBar);
  measure.chordEvents = beats.map((event) => {
    const eventStart = startSec + ((event.beatStart - 1) / beatsPerBar) * durationSec;
    const eventEnd = startSec + ((event.beatStart - 1 + event.beatLength) / beatsPerBar) * durationSec;
    return buildSongChordEvent(
      event.chord || event.chordSymbol || "C",
      event.roman || "I",
      event.lyric || "",
      Number(eventStart.toFixed(2)),
      Number(eventEnd.toFixed(2)),
      event.inversion || "root",
      Number(event.beatStart),
      Number(event.beatLength)
    );
  });
  const primary = measure.chordEvents[0] || buildSongChordEvent("C", "I", "", startSec, endSec, "root", 1, beatsPerBar);
  measure.chordSymbol = primary.chordSymbol;
  measure.chordDisplay = primary.chordDisplay;
  measure.roman = primary.roman;
  measure.romanDisplay = primary.romanDisplay;
  measure.inversion = primary.inversion;
  measure.inversionLabel = primary.inversionLabel;
  measure.staffNotes = primary.staffNotes;
  measure.notes = primary.notes;
  measure.fingering = primary.fingering;
  measure.handAssignments = primary.handAssignments;
  measure.rootNotes = primary.rootNotes;
  measure.rootHands = primary.rootHands;
  if (!measure.lyric) {
    const eventLyric = measure.chordEvents.find((event) => event.lyric)?.lyric || "";
    measure.lyric = eventLyric;
  }
  return measure;
}

function buildSongMeasure(barSpec, startSec, endSec, timeSignature = "4/4") {
  const measure = {
    lyric: barSpec?.lyric || "",
    startSec,
    endSec,
    chordEvents: Array.isArray(barSpec?.chords) && barSpec.chords.length
      ? barSpec.chords.map((row) => ({
        chord: row.chord,
        roman: row.roman,
        inversion: row.inversion || "root",
        lyric: row.lyric || "",
        beatStart: row.beatStart,
        beatLength: row.beatLength
      }))
      : [{
        chord: barSpec?.chord || "C",
        roman: barSpec?.roman || "I",
        inversion: barSpec?.inversion || "root",
        lyric: barSpec?.lyric || "",
        beatStart: 1,
        beatLength: beatsPerBarFromTimeSignature(timeSignature)
      }],
    section: barSpec?.section || "",
    formTag: barSpec?.formTag || "",
    sectionTimeSignature: barSpec?.sectionTimeSignature || timeSignature
  };
  return hydrateSongMeasureTiming(measure, timeSignature);
}

function librarySongSpecForKey(keyName, songId) {
  const root = window.PIANO_TRAINER_SONG_LIBRARY;
  if (!root || typeof root !== "object") return null;
  const rows = Array.isArray(root[keyName]) ? root[keyName] : [];
  if (!songId) return rows;
  return rows.find((row) => row && row.id === songId) || null;
}

function selectedSongSourceChoice(songId) {
  if (!songId) return "default";
  return String(state.songSourceChoice?.[songId] || "default");
}

function romanForChordInC(chordSymbol) {
  const value = String(chordSymbol || "").trim();
  const root = value.split("/")[0];
  const isMinor = /m(?!aj)/i.test(root);
  const map = {
    C: "I",
    "C#": "#I",
    Db: "bII",
    D: "II",
    "D#": "#II",
    Eb: "bIII",
    E: "III",
    F: "IV",
    "F#": "#IV",
    Gb: "bV",
    G: "V",
    "G#": "#V",
    Ab: "bVI",
    A: "VI",
    "A#": "#VI",
    Bb: "bVII",
    B: "VII"
  };
  const rootPitch = root.match(/^([A-G](?:#|b)?)/)?.[1] || "C";
  const roman = map[rootPitch] || "I";
  return isMinor ? roman.toLowerCase() : roman;
}

function overlaySongWithDraftChords(songData, draftId) {
  const draftRoot = window.PIANO_TRAINER_SONG_DRAFTS;
  const draft = draftRoot && typeof draftRoot === "object" ? draftRoot[draftId] : null;
  if (!draft || !Array.isArray(songData?.measures)) return songData;
  const cloned = cloneSongData(songData);
  const draftBars = Array.isArray(draft.bars) ? draft.bars : [];
  const chordArray = Array.isArray(draft.chords) ? draft.chords : [];

  const leadingIntroBars = (() => {
    let count = 0;
    for (const measure of cloned.measures) {
      const section = String(measure?.section || "").toLowerCase();
      const formTag = String(measure?.formTag || "").toLowerCase();
      if (section.includes("intro") || formTag === "intro") {
        count += 1;
        continue;
      }
      break;
    }
    return count;
  })();
  const draftStartsWithLyrics = draftBars.slice(0, Math.max(1, leadingIntroBars)).some((bar) => {
    if (String(bar?.lyric || "").trim()) return true;
    if (!Array.isArray(bar?.events)) return false;
    return bar.events.some((ev) => String(ev?.lyric || "").trim());
  });
  const applyOffset = leadingIntroBars > 0 && draftStartsWithLyrics ? leadingIntroBars : 0;

  for (let i = 0; i < cloned.measures.length; i += 1) {
    const draftIndex = i - applyOffset;
    if (draftIndex < 0) continue;
    const draftBar = draftBars[draftIndex] || null;
    const chord = String(draftBar?.chord || chordArray[draftIndex] || "").trim();
    if (!chord && !Array.isArray(draftBar?.events)) continue;
    const measure = cloned.measures[i];
    const oldEvent = chordEventForMeasure(measure, 0) || measure;
    const incomingEvents = Array.isArray(draftBar?.events) && draftBar.events.length
      ? draftBar.events
      : [{
        chord: chord || oldEvent?.chordSymbol || "C",
        beatStart: 1,
        beatLength: beatsPerBarFromTimeSignature(measure.sectionTimeSignature || cloned.timeSignature || "4/4"),
        lyric: draftBar?.lyric || ""
      }];
    measure.chordEvents = incomingEvents.map((ev) => {
      const evChord = String(ev.chord || chord || oldEvent?.chordSymbol || "C");
      return {
        chord: evChord,
        roman: romanForChordInC(evChord),
        inversion: evChord.includes("/") ? "inversion" : "root",
        lyric: String(ev.lyric || ""),
        beatStart: Number(ev.beatStart || 1),
        beatLength: Number(ev.beatLength || 1)
      };
    });
    measure.lyric = String(
      measure.chordEvents.find((ev) => String(ev.lyric || "").trim())?.lyric
      || draftBar?.lyric
      || measure.lyric
      || ""
    );
    hydrateSongMeasureTiming(measure, measure.sectionTimeSignature || cloned.timeSignature || "4/4");
  }
  const variant = Array.isArray(cloned.sourceVariants) ? cloned.sourceVariants.find((row) => row.id === draftId) : null;
  cloned.arrangementSource = {
    id: draftId,
    label: variant?.label || draft.label || draftId,
    type: "auto-draft",
    verified: false
  };
  return cloned;
}

function buildSongDataFromSpec(spec) {
  if (!spec || typeof spec !== "object" || !Array.isArray(spec.sectionSpecs)) return null;
  const chartStartSec = Number(spec.chartStartSec || 0);
  const secondsPerBar = Number(spec.secondsPerBar || 3.4);
  const songId = String(spec.id || "song");
  const chosenVideoId = String(state.songVideoChoice?.[songId] || spec.youtubeId || "");
  const measures = [];
  const formSections = [];

  for (const section of spec.sectionSpecs) {
    const sectionName = section?.name || "Section";
    const formTag = section?.formTag || "";
    const timeSignature = section?.timeSignature || spec.timeSignature || "4/4";
    const keySignature = section?.keySignature || spec.songKey || "n/a";
    const bars = Array.isArray(section?.bars) ? section.bars : [];
    const sectionStartSec = chartStartSec + measures.length * secondsPerBar;
    for (const bar of bars) {
      const index = measures.length;
      const startSec = Number((chartStartSec + index * secondsPerBar).toFixed(2));
      const endSec = Number((chartStartSec + (index + 1) * secondsPerBar).toFixed(2));
      const measure = buildSongMeasure(bar, startSec, endSec, timeSignature);
      measure.section = sectionName;
      measure.formTag = formTag;
      measure.sectionTimeSignature = timeSignature;
      measure.sectionKeySignature = keySignature;
      measure.sourceId = spec.arrangementSource?.id || "";
      hydrateSongMeasureTiming(measure, timeSignature);
      measures.push(measure);
    }
    const sectionEndSec = Number((chartStartSec + measures.length * secondsPerBar).toFixed(2));
    formSections.push({
      name: sectionName,
      formTag,
      sectionTimeSignature: timeSignature,
      sectionKeySignature: keySignature,
      sourceId: spec.arrangementSource?.id || "",
      startSec: Number(sectionStartSec.toFixed(2)),
      endSec: sectionEndSec
    });
  }

  return {
    id: songId,
    title: spec.title || "Song",
    artist: spec.artist || "Unknown artist",
    credits: Array.isArray(spec.credits) ? spec.credits : [],
    songKey: spec.songKey || "n/a",
    timeSignature: spec.timeSignature || "4/4",
    romanProgression: spec.romanProgression || "n/a",
    youtubeId: chosenVideoId,
    youtubeCandidates: Array.isArray(spec.youtubeCandidates) ? spec.youtubeCandidates.map((row) => ({ ...row })) : [],
    chartStartSec,
    hint: spec.hint || "",
    arrangementSource: spec.arrangementSource || null,
    sourceVariants: Array.isArray(spec.sourceVariants) ? spec.sourceVariants : [{ id: "default", label: spec.arrangementSource?.label || "Default" }],
    formSections,
    measures
  };
}

function buildLetItBeSongData() {
  const sourceSpec = librarySongSpecForKey("C", "let-it-be");
  const fromSpec = buildSongDataFromSpec(sourceSpec);
  if (fromSpec) {
    const chosenRaw = selectedSongSourceChoice("let-it-be");
    const validIds = new Set((fromSpec.sourceVariants || []).map((row) => String(row.id || "default")));
    const chosen = validIds.has(chosenRaw) ? chosenRaw : "default";
    if (chosen && chosen !== "default") {
      return overlaySongWithDraftChords(fromSpec, chosen);
    }
    return fromSpec;
  }

  const chartStartSec = 0.0;
  const secondsPerBar = 3.4;
  const measures = [];
  const formSections = [];

  function pushSection(sectionName, formTag, bars, timeSignature = "4/4", keySignature = "C Major") {
    const sectionStartSec = chartStartSec + measures.length * secondsPerBar;
    for (const bar of bars) {
      const index = measures.length;
      const startSec = Number((chartStartSec + index * secondsPerBar).toFixed(2));
      const endSec = Number((chartStartSec + (index + 1) * secondsPerBar).toFixed(2));
      const measure = buildSongMeasure(bar, startSec, endSec, timeSignature);
      measure.section = sectionName;
      measure.formTag = formTag;
      measure.sectionTimeSignature = timeSignature;
      measure.sectionKeySignature = keySignature;
      hydrateSongMeasureTiming(measure, timeSignature);
      measures.push(measure);
    }
    const sectionEndSec = Number((chartStartSec + measures.length * secondsPerBar).toFixed(2));
    formSections.push({
      name: sectionName,
      formTag,
      sectionTimeSignature: timeSignature,
      sectionKeySignature: keySignature,
      startSec: Number(sectionStartSec.toFixed(2)),
      endSec: sectionEndSec
    });
  }

  pushSection("Intro", "Intro", [
    {
      lyric: "",
      chords: [
        { chord: "C", roman: "I", inversion: "root", beatStart: 1, beatLength: 2 },
        { chord: "C", roman: "I", inversion: "1st", beatStart: 3, beatLength: 2 }
      ]
    },
    { chord: "G", roman: "V", inversion: "1st", lyric: "" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "" }
  ], "4/4", "C Major");

  pushSection("Verse 1", "A", [
    {
      lyric: "When I find myself in times of trouble",
      chords: [
        { chord: "C", roman: "I", inversion: "root", beatStart: 1, beatLength: 2, lyric: "When I find myself" },
        { chord: "G", roman: "V", inversion: "1st", beatStart: 3, beatLength: 2, lyric: "in times of trouble" }
      ]
    },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "Mother Mary comes to me" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "speaking words of wisdom" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "And in my hour of darkness" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "she is standing right in front of me" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "speaking words of wisdom" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" }
  ], "4/4", "C Major");

  pushSection("Chorus 1", "B", [
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "Let it be" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "Whisper words" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "of wisdom" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "" }
  ], "4/4", "C Major");

  pushSection("Verse 2", "A", [
    { chord: "C", roman: "I", inversion: "root", lyric: "And when the broken-hearted people" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "living in the world agree" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "there will be an answer" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "For though they may be parted" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "there is still a chance that they will see" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "there will be an answer" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" }
  ], "4/4", "C Major");

  pushSection("Chorus 2", "B", [
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "Let it be" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "There will be an answer" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "there will be an answer" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" }
  ], "4/4", "C Major");

  pushSection("Solo", "Solo", [
    { chord: "C", roman: "I", inversion: "root", lyric: "" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "" },
    { chord: "C", roman: "I", inversion: "root", lyric: "" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "" },
    { chord: "C", roman: "I", inversion: "root", lyric: "" }
  ], "4/4", "C Major");

  pushSection("Verse 3", "C", [
    { chord: "C", roman: "I", inversion: "root", lyric: "And when the night is cloudy" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "there is still a light that shines on me" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "shine until tomorrow" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "I wake up to the sound of music" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "Mother Mary comes to me" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "speaking words of wisdom" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" }
  ], "4/4", "C Major");

  pushSection("Chorus 3", "B", [
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "Let it be" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "There will be an answer" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "Am", roman: "vi", inversion: "1st", lyric: "Let it be" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "Whisper words of wisdom" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be, be" }
  ], "4/4", "C Major");

  pushSection("Outro", "Outro", [
    { chord: "C", roman: "I", inversion: "root", lyric: "Whisper words of wisdom" },
    { chord: "G", roman: "V", inversion: "1st", lyric: "let it be" },
    { chord: "F", roman: "IV", inversion: "1st", lyric: "let it be" },
    { chord: "C", roman: "I", inversion: "root", lyric: "let it be" }
  ], "4/4", "C Major");

  return {
    id: "let-it-be",
    title: "Let It Be",
    artist: "The Beatles",
    credits: ["Written by Lennon-McCartney", "Produced by George Martin", "Training chart: simplified C-major progression"],
    songKey: "C Major",
    timeSignature: "4/4",
    romanProgression: "I - V - vi - IV",
    youtubeId: "QDYfEBY9NM4",
    chartStartSec,
    hint: "Hold each bar steady and change chords right on the beat.",
    arrangementSource: {
      id: "let-it-be-inline-fallback",
      label: "Inline Fallback Arrangement",
      type: "fallback",
      verified: false
    },
    formSections,
    measures
  };
}

function songRowsForKey(keyName) {
  return [buildLetItBeSongData()];
}

function cloneSongData(songData) {
  if (!songData || typeof songData !== "object") return songData;
  return {
    ...songData,
    formSections: Array.isArray(songData.formSections) ? songData.formSections.map((row) => ({ ...row })) : [],
    measures: Array.isArray(songData.measures)
      ? songData.measures.map((row) => ({
        ...row,
        chordEvents: Array.isArray(row?.chordEvents) ? row.chordEvents.map((event) => ({ ...event })) : []
      }))
      : []
  };
}

function recomputeSongSectionsFromMeasures(songData) {
  if (!songData || !Array.isArray(songData.measures) || !songData.measures.length) {
    return [];
  }
  const sections = [];
  let current = null;
  for (let i = 0; i < songData.measures.length; i += 1) {
    const measure = songData.measures[i];
    const name = measure.section || "Section";
    const formTag = measure.formTag || "";
    const sectionTimeSignature = measure.sectionTimeSignature || songData.timeSignature || "";
    const sectionKeySignature = measure.sectionKeySignature || songData.songKey || "";
    if (!current
      || current.name !== name
      || current.formTag !== formTag
      || current.sectionTimeSignature !== sectionTimeSignature
      || current.sectionKeySignature !== sectionKeySignature) {
      if (current) {
        const prev = songData.measures[i - 1];
        current.endSec = Number(prev.endSec || current.startSec);
        sections.push(current);
      }
      current = {
        name,
        formTag,
        sectionTimeSignature,
        sectionKeySignature,
        startSec: Number(measure.startSec || 0),
        endSec: Number(measure.endSec || measure.startSec || 0)
      };
    }
  }
  if (current) {
    const last = songData.measures[songData.measures.length - 1];
    current.endSec = Number(last.endSec || current.startSec);
    sections.push(current);
  }
  return sections;
}

function applyTimingOverrideToSongData(songData, override) {
  const cloned = cloneSongData(songData);
  if (!Array.isArray(cloned?.measures) || !cloned.measures.length || !override || typeof override !== "object") {
    return cloned;
  }

  const durations = cloned.measures.map((measure) => Number(measure.endSec || 0) - Number(measure.startSec || 0));
  const starts = Array.isArray(override.barStarts) ? override.barStarts : [];

  for (let i = 0; i < cloned.measures.length; i += 1) {
    const measure = cloned.measures[i];
    const hasStart = Number.isFinite(starts[i]);
    if (hasStart) {
      measure.startSec = Number(starts[i]);
    }
    const nextStart = starts[i + 1];
    if (Number.isFinite(nextStart)) {
      measure.endSec = Number(nextStart);
    } else if (hasStart) {
      const fallbackDuration = Number.isFinite(durations[i]) && durations[i] > 0 ? durations[i] : 3.4;
      measure.endSec = Number((measure.startSec + fallbackDuration).toFixed(2));
    }
    hydrateSongMeasureTiming(measure, measure.sectionTimeSignature || cloned.timeSignature || "4/4");
  }

  if (Number.isFinite(cloned.measures[0]?.startSec)) {
    cloned.chartStartSec = Number(cloned.measures[0].startSec);
  }
  cloned.formSections = recomputeSongSectionsFromMeasures(cloned);
  return cloned;
}

function applySectionOverrideToSongData(songData, override) {
  const cloned = cloneSongData(songData);
  if (!Array.isArray(cloned?.measures) || !cloned.measures.length || !override || typeof override !== "object") {
    return cloned;
  }
  const sectionMap = override.sections && typeof override.sections === "object" ? override.sections : {};
  for (const measure of cloned.measures) {
    const sectionName = measure.section || "";
    const row = sectionName ? sectionMap[sectionName] : null;
    if (!row || typeof row !== "object") continue;
    if (typeof row.timeSignature === "string" && row.timeSignature.trim()) {
      measure.sectionTimeSignature = row.timeSignature.trim();
    }
    if (typeof row.keySignature === "string" && row.keySignature.trim()) {
      measure.sectionKeySignature = row.keySignature.trim();
    }
    hydrateSongMeasureTiming(measure, measure.sectionTimeSignature || cloned.timeSignature || "4/4");
  }
  cloned.formSections = recomputeSongSectionsFromMeasures(cloned);
  return cloned;
}

function sanitizeMeasureForOverride(measure) {
  return {
    section: measure.section || "Section",
    formTag: measure.formTag || "",
    sectionTimeSignature: measure.sectionTimeSignature || "4/4",
    sectionKeySignature: measure.sectionKeySignature || "n/a",
    lyric: measure.lyric || "",
    startSec: Number(measure.startSec || 0),
    endSec: Number(measure.endSec || measure.startSec || 0),
    chordEvents: (Array.isArray(measure.chordEvents) && measure.chordEvents.length
      ? measure.chordEvents
      : [{
        chord: measure.chordSymbol || "C",
        roman: measure.roman || "I",
        inversion: measure.inversion || "root",
        lyric: measure.lyric || "",
        beatStart: 1,
        beatLength: beatsPerBarFromTimeSignature(measure.sectionTimeSignature || "4/4")
      }]).map((event) => ({
      chord: event.chordSymbol || event.chord || "C",
      roman: event.roman || "I",
      inversion: event.inversion || "root",
      lyric: event.lyric || "",
      beatStart: Number(event.beatStart || 1),
      beatLength: Number(event.beatLength || 1)
    }))
  };
}

function recalculateMeasureTimes(measures) {
  if (!Array.isArray(measures) || !measures.length) return measures;
  const normalized = measures.map((measure) => ({ ...sanitizeMeasureForOverride(measure) }));
  let cursor = Number(normalized[0].startSec || 0);
  for (let i = 0; i < normalized.length; i += 1) {
    const row = normalized[i];
    const previousDuration = Math.max(0.2, Number(row.endSec || 0) - Number(row.startSec || 0) || 3.4);
    row.startSec = Number(cursor.toFixed(2));
    row.endSec = Number((cursor + previousDuration).toFixed(2));
    hydrateSongMeasureTiming(row, row.sectionTimeSignature || "4/4");
    cursor = row.endSec;
  }
  return normalized;
}

function remapAnchorsByTime(oldAnchors, measures) {
  if (!oldAnchors || typeof oldAnchors !== "object" || !Array.isArray(measures) || !measures.length) return {};
  const rows = Object.entries(oldAnchors)
    .map(([key, value]) => ({ idx: Number.parseInt(key, 10), timeSec: Number(value) }))
    .filter((row) => Number.isInteger(row.idx) && Number.isFinite(row.timeSec))
    .sort((a, b) => a.timeSec - b.timeSec);
  const next = {};
  for (const row of rows) {
    let bestIndex = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < measures.length; i += 1) {
      const delta = Math.abs(Number(measures[i].startSec || 0) - row.timeSec);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    }
    next[String(bestIndex)] = Number(row.timeSec);
  }
  return next;
}

function applyArrangementOverrideToSongData(songData, override) {
  const cloned = cloneSongData(songData);
  if (!Array.isArray(override?.measures) || !override.measures.length) return cloned;
  const measures = override.measures.map((measure) => ({
    ...sanitizeMeasureForOverride(measure)
  }));
  const timed = recalculateMeasureTimes(measures);
  cloned.measures = timed;
  cloned.formSections = recomputeSongSectionsFromMeasures(cloned);
  if (Number.isFinite(cloned.measures[0]?.startSec)) cloned.chartStartSec = Number(cloned.measures[0].startSec);
  return cloned;
}

function buildCurriculumForKey(keyName) {
  const root4 = keyRootMidi(keyName, 4);
  const root3 = root4 - 12;

  const scalePattern = [0, 2, 4, 5, 7, 9, 11, 12];
  const scaleRh = scalePattern.map((n) => midiToNoteName(root4 + n));
  const scaleLh = scalePattern.map((n) => midiToNoteName(root3 + n));

  const songRows = songRowsForKey(keyName);

  const triadI = buildTriad(root4, "major");
  const triadIV = buildTriad(root4 + 5, "major");
  const triadV = buildTriad(root4 + 7, "major");
  const triadVI = buildTriad(root4 + 9, "minor");
  function downOctave(triad) {
    return triad.map((m) => m - 12);
  }
  const chordFamilies = [
    { numeral: "I", label: keyName, triadRh: triadI, triadLh: downOctave(triadI), minor: false },
    { numeral: "IV", label: midiToNoteName(triadIV[0]).replace(/\d+/g, ""), triadRh: triadIV, triadLh: downOctave(triadIV), minor: false },
    { numeral: "V", label: midiToNoteName(triadV[0]).replace(/\d+/g, ""), triadRh: triadV, triadLh: downOctave(triadV), minor: false },
    { numeral: "vi", label: `${midiToNoteName(triadVI[0]).replace(/\d+/g, "")}m`, triadRh: triadVI, triadLh: downOctave(triadVI), minor: true }
  ];

  function inversionFromTriad(triad, inversionType) {
    if (inversionType === "root") return [triad[0], triad[1], triad[2]];
    if (inversionType === "first") return [triad[1], triad[2], triad[0] + 12];
    return [triad[2], triad[0] + 12, triad[1] + 12];
  }

  const technique = [
    {
      id: `${keyName}-scale`,
      moduleId: "scales",
      title: `${keyLabel(keyName)} Scale`,
      meta: "Hands: Both",
      hint: "Play evenly and keep your hand relaxed.",
      notes: scaleRh,
      fingering: [1, 2, 3, 1, 2, 3, 4, 5],
      scaleByHand: {
        rh: {
          notes: scaleRh,
          fingering: [1, 2, 3, 1, 2, 3, 4, 5],
          meta: "Hands: Right"
        },
        lh: {
          notes: scaleLh,
          fingering: [5, 4, 3, 2, 1, 3, 2, 1],
          meta: "Hands: Left"
        }
      }
    },
    {
      id: `${keyName}-arp`,
      moduleId: "arpeggios",
      title: `${keyLabel(keyName)} Arpeggio`,
      meta: "Hands: Both",
      hint: "Aim for connected sound across octaves.",
      notes: [0, 4, 7, 12, 16, 19, 24].map((n) => midiToNoteName(root3 + n)),
      fingering: [5, 3, 2, 1, 2, 3, 5],
      isArpeggioLesson: true
    },
    {
      id: `${keyName}-triads`,
      moduleId: "chords",
      title: `${keyName} Core Triads`,
      meta: `I, IV, V, vi in ${keyName}`,
      hint: "Play blocked then broken chords.",
      notes: [...triadI, ...triadIV, ...triadV, ...triadVI].map((m) => midiToNoteName(m)),
      fingering: [1, 3, 5, 1, 3, 5, 1, 3, 5, 1, 3, 5],
      chordSteps: chordFamilies.map((item) => ({
        label: `${item.numeral} - ${item.label}`,
        notes: [
          ...item.triadLh.map((m) => midiToNoteName(m)),
          ...item.triadRh.map((m) => midiToNoteName(m))
        ],
        fingering: [5, 3, 1, 1, 3, 5],
        handAssignments: ["LH", "LH", "LH", "RH", "RH", "RH"],
        rootNotes: [midiToNoteName(item.triadLh[0]), midiToNoteName(item.triadRh[0])],
        rootHands: ["LH", "RH"],
        rootFingerLH: 5,
        rootFingerRH: 1,
        rootPitch: midiToNoteName(item.triadRh[0]).replace(/\d+/g, "")
      }))
    },
    {
      id: `${keyName}-inversions`,
      moduleId: "inversions",
      title: `${keyName} Inversions`,
      meta: "Root, 1st, 2nd",
      hint: "Keep hand shape stable as notes rotate.",
      notes: [
        triadI[0], triadI[1], triadI[2],
        triadI[1], triadI[2], triadI[0] + 12,
        triadI[2], triadI[0] + 12, triadI[1] + 12
      ].map((m) => midiToNoteName(m)),
      fingering: [1, 3, 5, 1, 2, 5, 1, 3, 5],
      inversionSteps: chordFamilies.flatMap((item) => ([
        {
          label: `${item.numeral} Root - ${item.label}`,
          notes: [
            ...inversionFromTriad(item.triadLh, "root").map((m) => midiToNoteName(m)),
            ...inversionFromTriad(item.triadRh, "root").map((m) => midiToNoteName(m))
          ],
          fingering: [5, 3, 1, 1, 3, 5],
          handAssignments: ["LH", "LH", "LH", "RH", "RH", "RH"],
          rootNotes: [midiToNoteName(item.triadLh[0]), midiToNoteName(item.triadRh[0])],
          rootHands: ["LH", "RH"],
          rootFingerLH: 5,
          rootFingerRH: 1,
          rootPitch: midiToNoteName(item.triadRh[0]).replace(/\d+/g, "")
        },
        {
          label: `${item.numeral} 1st - ${item.label}`,
          notes: [
            ...inversionFromTriad(item.triadLh, "first").map((m) => midiToNoteName(m)),
            ...inversionFromTriad(item.triadRh, "first").map((m) => midiToNoteName(m))
          ],
          fingering: [5, 2, 1, 1, 2, 5],
          handAssignments: ["LH", "LH", "LH", "RH", "RH", "RH"],
          rootNotes: [midiToNoteName(item.triadLh[0] + 12), midiToNoteName(item.triadRh[0] + 12)],
          rootHands: ["LH", "RH"],
          rootFingerLH: 1,
          rootFingerRH: 5,
          rootPitch: midiToNoteName(item.triadRh[0]).replace(/\d+/g, "")
        },
        {
          label: `${item.numeral} 2nd - ${item.label}`,
          notes: [
            ...inversionFromTriad(item.triadLh, "second").map((m) => midiToNoteName(m)),
            ...inversionFromTriad(item.triadRh, "second").map((m) => midiToNoteName(m))
          ],
          fingering: [5, 3, 1, 1, 3, 5],
          handAssignments: ["LH", "LH", "LH", "RH", "RH", "RH"],
          rootNotes: [midiToNoteName(item.triadLh[0] + 12), midiToNoteName(item.triadRh[0] + 12)],
          rootHands: ["LH", "RH"],
          rootFingerLH: 3,
          rootFingerRH: 3,
          rootPitch: midiToNoteName(item.triadRh[0]).replace(/\d+/g, "")
        }
      ]))
    }
  ];

  const songs = songRows.map((song, index) => {
    const exerciseId = `${keyName}-song-${song.id || index + 1}`;
    const arrangedSong = applyArrangementOverrideToSongData(song, state.songArrangementOverrides?.[exerciseId]);
    const sourceId = String(arrangedSong?.arrangementSource?.id || "default");
    const scopedTimingKey = `${exerciseId}::${sourceId}`;
    const timingOverride = state.songTimingOverrides?.[scopedTimingKey]
      || (sourceId === "default" ? state.songTimingOverrides?.[exerciseId] : null)
      || null;
    const timedSong = applyTimingOverrideToSongData(arrangedSong, timingOverride);
    const configuredSong = applySectionOverrideToSongData(timedSong, state.songSectionOverrides?.[exerciseId]);
    return {
      id: exerciseId,
    moduleId: "songs",
    title: `${configuredSong.title}${configuredSong.artist ? ` - ${configuredSong.artist}` : ""}`,
    meta: `Key: ${configuredSong.songKey || `${keyName} Major`} · Progression: ${configuredSong.romanProgression || "n/a"}`,
    hint: configuredSong.hint || "Loop short sections and focus on smooth changes.",
    notes: Array.isArray(configuredSong.measures?.[0]?.notes)
      ? configuredSong.measures[0].notes
      : [0, 7, 9, 5, 12, 7, 9, 5].map((n) => midiToNoteName(root3 + n)),
    fingering: Array.isArray(configuredSong.measures?.[0]?.fingering)
      ? configuredSong.measures[0].fingering
      : [1, 1, 1, 1, 1, 1, 1, 1],
    handAssignments: Array.isArray(configuredSong.measures?.[0]?.handAssignments) ? configuredSong.measures[0].handAssignments : null,
    rootNotes: Array.isArray(configuredSong.measures?.[0]?.rootNotes) ? configuredSong.measures[0].rootNotes : null,
    rootHands: Array.isArray(configuredSong.measures?.[0]?.rootHands) ? configuredSong.measures[0].rootHands : null,
    songData: configuredSong
  };
  });

  return { technique, songs };
}

function currentCurriculum() {
  return buildCurriculumForKey(state.selectedKey);
}

function currentExercise() {
  const curriculum = currentCurriculum();
  const exercise = state.block === "technique"
    ? curriculum.technique[state.techniqueIndex]
    : curriculum.songs[state.songIndex];
  return applyArpeggioMode(exercise);
}

function arpeggioNotesForMode(root3, root4, modeId) {
  if (modeId === "lh-1") {
    return {
      notes: [0, 4, 7, 12].map((n) => midiToNoteName(root3 + n)),
      fingering: [5, 3, 2, 1],
      handAssignments: ["LH", "LH", "LH", "LH"]
    };
  }
  if (modeId === "lh-2") {
    return {
      notes: [0, 4, 7, 12, 16, 19, 24].map((n) => midiToNoteName(root3 + n)),
      fingering: [5, 3, 2, 1, 3, 2, 1],
      handAssignments: ["LH", "LH", "LH", "LH", "LH", "LH", "LH"]
    };
  }
  if (modeId === "rh-1") {
    return {
      notes: [0, 4, 7, 12].map((n) => midiToNoteName(root4 + n)),
      fingering: [1, 2, 3, 5],
      handAssignments: ["RH", "RH", "RH", "RH"]
    };
  }
  if (modeId === "rh-2") {
    return {
      notes: [0, 4, 7, 12, 16, 19, 24].map((n) => midiToNoteName(root4 + n)),
      fingering: [1, 2, 3, 1, 2, 3, 5],
      handAssignments: ["RH", "RH", "RH", "RH", "RH", "RH", "RH"]
    };
  }
  return {
    notes: [
      ...[0, 4, 7, 12].map((n) => midiToNoteName(root3 + n)),
      ...[0, 4, 7, 12].map((n) => midiToNoteName(root4 + n))
    ],
    fingering: [5, 3, 2, 1, 1, 2, 3, 5],
    handAssignments: ["LH", "LH", "LH", "LH", "RH", "RH", "RH", "RH"]
  };
}

function applyArpeggioMode(exercise) {
  if (!exercise?.isArpeggioLesson) return exercise;

  const mode = ARPEGGIO_MODES.find((item) => item.id === state.arpeggioMode) || ARPEGGIO_MODES[ARPEGGIO_MODES.length - 1];
  const root4 = keyRootMidi(state.selectedKey, 4);
  const root3 = root4 - 12;
  const mapped = arpeggioNotesForMode(root3, root4, mode.id);
  return {
    ...exercise,
    meta: `Mode: ${mode.label}`,
    notes: mapped.notes,
    fingering: mapped.fingering,
    handAssignments: mapped.handAssignments
  };
}

function applyScaleMode(exercise) {
  if (!exercise || exercise.moduleId !== "scales") return exercise;
  const handCfg = exercise.scaleByHand?.[state.scaleHand] || exercise.scaleByHand?.rh || null;
  const baseNotes = (handCfg?.notes || exercise.notes || []);
  const baseFingering = (handCfg?.fingering || exercise.fingering || []);
  const handMeta = handCfg?.meta || "Hands: Right";
  const isRightHand = state.scaleHand === "rh";
  const isLeftHand = state.scaleHand === "lh";
  if (baseNotes.length < 8) return exercise;

  const oneOctAscending = baseNotes.slice(0, 8);
  const twoOctAscending = [...oneOctAscending, ...oneOctAscending.slice(1).map((n) => {
    const parsed = parseNote(n);
    if (!parsed) return n;
    return `${parsed.letter}${parsed.sharp ? "#" : ""}${parsed.octave + 1}`;
  })];
  const ascendingNotes = state.scaleMode === "2" ? twoOctAscending : oneOctAscending;

  const ascendingFingering = state.scaleMode === "2"
    ? isRightHand
      ? [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
      : isLeftHand
        ? [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        : baseFingering
    : isRightHand
      ? [1, 2, 3, 1, 2, 3, 4, 5]
      : isLeftHand
        ? [5, 4, 3, 2, 1, 3, 2, 1]
        : baseFingering;

  if (state.scaleDirection === "updown") {
    const descendingNotes = ascendingNotes.slice(0, -1).reverse();
    const descendingFingering = [...ascendingFingering].slice(0, -1).reverse();
    return {
      ...exercise,
      meta: `${handMeta} · ${state.scaleMode} Octave${state.scaleMode === "2" ? "s" : ""} · Up and down`,
      notes: [...ascendingNotes, ...descendingNotes],
      fingering: [...ascendingFingering, ...descendingFingering]
    };
  }

  return {
    ...exercise,
    meta: `${handMeta} · ${state.scaleMode} Octave${state.scaleMode === "2" ? "s" : ""} · Ascending`,
    notes: ascendingNotes,
    fingering: ascendingFingering
  };
}

function applyChordStepMode(exercise) {
  if (!exercise || exercise.moduleId !== "chords" || !Array.isArray(exercise.chordSteps) || !exercise.chordSteps.length) {
    return exercise;
  }

  const steps = exercise.chordSteps;
  const boundedIndex = Math.max(0, Math.min(steps.length - 1, state.chordStepIndex));
  const step = steps[boundedIndex];
  return {
    ...exercise,
    meta: `${exercise.meta} · Step ${boundedIndex + 1}/${steps.length}: ${step.label}`,
    hint: "Play this chord blocked, then broken.",
    notes: step.notes,
    fingering: step.fingering,
    handAssignments: step.handAssignments || null,
    rootNotes: step.rootNotes || null,
    rootHands: step.rootHands || null,
    rootFingerLH: step.rootFingerLH,
    rootFingerRH: step.rootFingerRH,
    rootPitch: step.rootPitch
  };
}

function applyInversionStepMode(exercise) {
  if (!exercise || exercise.moduleId !== "inversions" || !Array.isArray(exercise.inversionSteps) || !exercise.inversionSteps.length) {
    return exercise;
  }

  const steps = exercise.inversionSteps;
  const boundedIndex = Math.max(0, Math.min(steps.length - 1, state.inversionStepIndex));
  const step = steps[boundedIndex];
  return {
    ...exercise,
    meta: `${exercise.meta} · Step ${boundedIndex + 1}/${steps.length}: ${step.label}`,
    hint: "Play this inversion blocked, then broken.",
    notes: step.notes,
    fingering: step.fingering,
    handAssignments: step.handAssignments || null,
    rootNotes: step.rootNotes || null,
    rootHands: step.rootHands || null,
    rootFingerLH: step.rootFingerLH,
    rootFingerRH: step.rootFingerRH,
    rootPitch: step.rootPitch
  };
}

function renderArpeggioModes(visible) {
  const wrap = document.getElementById("arpeggioModeWrap");
  const row = document.getElementById("arpeggioModeButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible) return;

  row.innerHTML = ARPEGGIO_MODES.map((mode) => (
    `<button class="mode-chip ${mode.id === state.arpeggioMode ? "active" : ""}" data-arpeggio-mode="${mode.id}">${mode.label}</button>`
  )).join("");
}

function renderScaleModes(visible) {
  const wrap = document.getElementById("scaleModeWrap");
  const row = document.getElementById("scaleModeButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible) return;

  row.innerHTML = SCALE_MODES.map((mode) => (
    `<button class="mode-chip ${mode.id === state.scaleMode ? "active" : ""}" data-scale-mode="${mode.id}">${mode.label}</button>`
  )).join("");
}

function renderScaleHands(visible) {
  const wrap = document.getElementById("scaleHandWrap");
  const row = document.getElementById("scaleHandButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible) return;

  row.innerHTML = SCALE_HANDS.map((mode) => (
    `<button class="mode-chip ${mode.id === state.scaleHand ? "active" : ""}" data-scale-hand="${mode.id}">${mode.label}</button>`
  )).join("");
}

function renderScaleDirections(visible) {
  const wrap = document.getElementById("scaleDirectionWrap");
  const row = document.getElementById("scaleDirectionButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible) return;

  row.innerHTML = SCALE_DIRECTIONS.map((mode) => (
    `<button class="mode-chip ${mode.id === state.scaleDirection ? "active" : ""}" data-scale-direction="${mode.id}">${mode.label}</button>`
  )).join("");
}

function renderTriadModes(visible, exercise) {
  const wrap = document.getElementById("triadModeWrap");
  const row = document.getElementById("triadModeButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible || !exercise || !Array.isArray(exercise.chordSteps)) return;

  row.innerHTML = exercise.chordSteps.map((step, idx) => (
    `<button class="mode-chip ${idx === state.chordStepIndex ? "active" : ""}" data-triad-step="${idx}">${step.label}</button>`
  )).join("");
}

function renderInversionModes(visible, exercise) {
  const wrap = document.getElementById("inversionModeWrap");
  const row = document.getElementById("inversionModeButtons");
  if (!wrap || !row) return;

  wrap.classList.toggle("hidden", !visible);
  if (!visible || !exercise || !Array.isArray(exercise.inversionSteps)) return;

  row.innerHTML = exercise.inversionSteps.map((step, idx) => (
    `<button class="mode-chip ${idx === state.inversionStepIndex ? "active" : ""}" data-inversion-step="${idx}">${step.label}</button>`
  )).join("");
}

function renderLessons() {
  const keyName = state.selectedKey;
  const progress = currentKeyProgress();
  const done = completedModuleCountForKey(keyName);
  const pct = (done / MODULES.length) * 100;

  document.getElementById("lessonsTitle").textContent = keyLabel(keyName);
  document.getElementById("lessonsMeta").textContent = "Choose any lesson to work on.";
  document.getElementById("completionMeta").textContent = `${done} / ${MODULES.length} modules done`;
  document.getElementById("completionFill").style.width = `${pct}%`;

  const badge = document.getElementById("keyStatusBadge");
  badge.textContent = progress.completed ? "Completed" : "In progress";
  badge.classList.toggle("success", progress.completed);

  const toggleBtn = document.getElementById("toggleKeyCompleteBtn");
  toggleBtn.textContent = progress.completed ? "Mark Key In Progress" : "Mark Key Complete";

  const curriculum = currentCurriculum();
  const lessonRows = [
    ...curriculum.technique.map((item, index) => ({ ...item, block: "technique", index })),
    ...curriculum.songs.map((item, index) => ({ ...item, block: "song", index }))
  ];

  document.getElementById("lessonExerciseList").innerHTML = lessonRows.map((item) => {
    const doneText = progress.modules[item.moduleId] ? "Done" : "Open";
    return `
      <article class="lesson-item">
        <div>
          <h4>${item.title}</h4>
          <p>${item.meta}</p>
        </div>
        <div class="row gap">
          <span class="badge ${doneText === "Done" ? "success" : ""}">${doneText}</span>
          <button class="btn outlined" data-action="start-lesson" data-block="${item.block}" data-index="${item.index}">Practice</button>
        </div>
      </article>
    `;
  }).join("");

  const rootNote = `${keyName}4`;
  document.getElementById("keyStaffTitle").textContent = `All ${keyName} Notes (Bottom to Top)`;
  renderStaffSVG([
    `${keyName}2`,
    `${keyName}3`,
    rootNote,
    `${keyName}5`,
    `${keyName}6`
  ], "keyStaffMap", true);
  renderSessionTimerControls();
}

function allAdminSongSpecs() {
  const root = window.PIANO_TRAINER_SONG_LIBRARY;
  if (!root || typeof root !== "object") return [];
  const rows = [];
  for (const [keyName, songs] of Object.entries(root)) {
    if (!Array.isArray(songs)) continue;
    for (const song of songs) {
      if (!song || typeof song !== "object") continue;
      rows.push({ keyName, song });
    }
  }
  return rows;
}

function renderAdmin() {
  const keySelect = document.getElementById("adminSongKeyFilter");
  const listEl = document.getElementById("adminSongList");
  const detailEl = document.getElementById("adminSongDetail");
  if (!(keySelect instanceof HTMLSelectElement) || !listEl || !detailEl) return;

  const allSongs = allAdminSongSpecs();
  const keys = Array.from(new Set(allSongs.map((row) => row.keyName))).sort();
  if (!["all", ...keys].includes(state.adminSongKeyFilter)) state.adminSongKeyFilter = "all";
  keySelect.innerHTML = [
    `<option value="all" ${state.adminSongKeyFilter === "all" ? "selected" : ""}>All Keys</option>`,
    ...keys.map((keyName) => `<option value="${keyName}" ${state.adminSongKeyFilter === keyName ? "selected" : ""}>${keyName}</option>`)
  ].join("");

  const filtered = state.adminSongKeyFilter === "all"
    ? allSongs
    : allSongs.filter((row) => row.keyName === state.adminSongKeyFilter);
  if (!filtered.length) {
    listEl.innerHTML = "<p class='muted'>No songs available for this filter.</p>";
    detailEl.innerHTML = "<p class='muted'>Select a song to configure arrangement workflow.</p>";
    return;
  }
  if (!filtered.some((row) => row.song.id === state.adminSelectedSongId)) {
    state.adminSelectedSongId = filtered[0].song.id;
  }

  listEl.innerHTML = filtered.map(({ keyName, song }) => `
    <article class="lesson-item">
      <div>
        <h4>${song.title}</h4>
        <p>${song.artist || "Unknown artist"} · ${song.songKey || keyName}</p>
      </div>
      <div class="row gap">
        <span class="badge ${song.id === state.adminSelectedSongId ? "success" : ""}">${song.id === state.adminSelectedSongId ? "Selected" : "Open"}</span>
        <button class="btn outlined" data-action="admin-select-song" data-song-id="${song.id}">Select</button>
      </div>
    </article>
  `).join("");

  const picked = filtered.find((row) => row.song.id === state.adminSelectedSongId) || filtered[0];
  const selectedSong = picked.song;
  const selectedVideo = String(state.songVideoChoice[selectedSong.id] || selectedSong.youtubeId || "");
  const videos = Array.isArray(selectedSong.youtubeCandidates) ? [...selectedSong.youtubeCandidates] : [];
  videos.sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0));

  detailEl.innerHTML = `
    <h3 class="admin-song-title">${selectedSong.title} · ${selectedSong.artist || "Unknown artist"}</h3>
    <p class="song-meta-line">Key: ${selectedSong.songKey || picked.keyName} · Time Signature: ${selectedSong.timeSignature || "n/a"}</p>
    <p class="song-meta-line">Source: ${selectedSong.arrangementSource?.label || "n/a"}</p>
    <div class="song-arrangement-controls">
      <button id="adminRunAutoDraftNowBtn" class="btn filled">Run Auto-draft Now</button>
      <button id="adminAutoArrangeBtn" class="btn tonal">Auto-arrange</button>
      <button id="adminOpenArrangementBtn" class="btn outlined">Open Arrangement Page</button>
    </div>
    <div id="adminAutoDraftStatusPanel" class="admin-autodraft-panel"></div>
    <div>
      <p class="label">YouTube Candidates (ranked by views)</p>
      <div class="admin-video-list">
        ${videos.map((row) => `
          <article class="admin-video-item ${selectedVideo === row.videoId ? "active" : ""}">
            <strong>${row.title}</strong>
            <p class="admin-video-meta">${row.channel || "Unknown channel"} · ${(Number(row.viewCount || 0)).toLocaleString()} views</p>
            <div class="row gap">
              <button class="btn outlined" data-action="admin-choose-video" data-video-id="${row.videoId}" data-song-id="${selectedSong.id}">Use This Video</button>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
  renderAdminAutoDraftStatus();
}

function adminAutoDraftFallbackStatus() {
  return {
    running: false,
    status: "idle",
    currentStepId: "",
    error: "",
    logs: [],
    steps: [
      { id: "prepare_audio", label: "Prepare audio input", status: "pending" },
      { id: "build_harmony", label: "Build harmony-focused stem", status: "pending" },
      { id: "analyze", label: "Analyze beats/chords/lyrics", status: "pending" },
      { id: "publish", label: "Publish draft to app", status: "pending" },
      { id: "complete", label: "Finalize", status: "pending" }
    ]
  };
}

function adminAutoDraftBadgeText(status) {
  if (!status || status.status === "idle") return "Idle";
  if (status.running) return "Running";
  if (status.status === "success") return "Completed";
  if (status.status === "error") return "Failed";
  return "Idle";
}

function renderAdminAutoDraftStatus() {
  const panel = document.getElementById("adminAutoDraftStatusPanel");
  if (!panel) return;
  const status = adminAutoDraft.status || adminAutoDraftFallbackStatus();
  const steps = Array.isArray(status.steps) && status.steps.length ? status.steps : adminAutoDraftFallbackStatus().steps;
  const badgeText = adminAutoDraftBadgeText(status);
  const logs = Array.isArray(status.logs) ? status.logs.slice(-6) : [];
  const currentStep = steps.find((step) => step.status === "in_progress");
  const errorText = status.status === "error" && status.error ? String(status.error) : "";
  panel.innerHTML = `
    <div class="admin-autodraft-header">
      <span class="badge ${status.status === "error" ? "" : "success"}">${badgeText}</span>
      <span class="admin-autodraft-current">${currentStep ? `Current: ${currentStep.label}` : "Current: none"}</span>
    </div>
    <div class="admin-autodraft-steps">
      ${steps.map((step) => `
        <p class="admin-autodraft-step ${step.status}">${step.status === "completed" ? "✓" : step.status === "in_progress" ? "…" : step.status === "error" ? "!" : "○"} ${step.label}</p>
      `).join("")}
    </div>
    ${errorText ? `<p class="admin-autodraft-error">${errorText}</p>` : ""}
    <pre class="admin-autodraft-log">${logs.length ? logs.join("\n") : "No logs yet."}</pre>
  `;
}

async function fetchAdminAutoDraftStatus() {
  const response = await fetch("/api/admin/auto-draft/status");
  if (!response.ok) throw new Error(`Status fetch failed (${response.status})`);
  const data = await response.json();
  adminAutoDraft.status = data;
  if (data?.status === "success"
    && typeof data.endedAt === "string"
    && data.endedAt
    && adminAutoDraft.lastAppliedEndedAt !== data.endedAt) {
    await reloadSongDraftsFromServer();
    adminAutoDraft.lastAppliedEndedAt = data.endedAt;
    showToast("Auto-draft published. Ready to use.");
  }
  if (state.screen === "admin") {
    renderAdminAutoDraftStatus();
  }
  if (!data?.running) {
    stopAdminAutoDraftPolling();
  }
  return data;
}

async function reloadSongDraftsFromServer() {
  const response = await fetch(`/song-drafts.js?ts=${Date.now()}`);
  if (!response.ok) throw new Error(`Draft refresh failed (${response.status})`);
  const script = await response.text();
  const run = new Function(script);
  run();
}

function stopAdminAutoDraftPolling() {
  if (adminAutoDraft.pollIntervalId) {
    clearInterval(adminAutoDraft.pollIntervalId);
    adminAutoDraft.pollIntervalId = null;
  }
}

function startAdminAutoDraftPolling() {
  if (adminAutoDraft.pollIntervalId) return;
  fetchAdminAutoDraftStatus().catch(() => {});
  adminAutoDraft.pollIntervalId = setInterval(() => {
    fetchAdminAutoDraftStatus().catch(() => {});
  }, 1200);
}

function openAdminArrangement(songId, keyName) {
  const key = keyName || "C";
  state.adminSelectedSongId = songId || state.adminSelectedSongId;
  state.selectedKey = key;
  const curriculum = buildCurriculumForKey(key);
  const index = curriculum.songs.findIndex((row) => row.songData?.id === songId);
  state.block = "song";
  state.songIndex = index >= 0 ? index : 0;
  state.songTrainerMode = "arrange";
  state.songArrangeAccess = true;
  state.songPlayalongFocus = false;
  state.songShowVideoInPlayMode = true;
  state.songArrangeSelectedBars = [];
  songPlayback.activeMeasureIndex = 0;
  songPlayback.activeChordEventIndex = 0;
  saveState();
  showScreen("practice");
  renderPractice();
}

function historyMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + state.historyMonthOffset, 1);
}

function renderHistoryDayDetails(dayKey) {
  const title = document.getElementById("historyDayTitle");
  const meta = document.getElementById("historyDayMeta");
  const list = document.getElementById("historyLessonList");
  if (!title || !meta || !list) return;

  if (!dayKey || !state.practiceHistory[dayKey]) {
    title.textContent = "Select a day";
    meta.textContent = "No day selected.";
    list.innerHTML = "";
    return;
  }

  const row = state.practiceHistory[dayKey];
  const seconds = Number(row.seconds || 0);
  const lessons = Object.values(row.lessons || {});
  title.textContent = dayKey;
  meta.textContent = `${formatTime(seconds)} practiced · ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} viewed`;
  list.innerHTML = lessons.length
    ? lessons.map((lesson) => `<li>${lesson.title} (${lesson.key})</li>`).join("")
    : "<li>No lessons logged.</li>";
}

function renderHistory() {
  const streaks = computeStreaks();
  document.getElementById("historyCurrentStreak").textContent = String(streaks.current);
  document.getElementById("historyLongestStreak").textContent = String(streaks.longest);
  document.getElementById("historyPracticedDays").textContent = String(streaks.practicedDays);

  const monthDate = historyMonthDate();
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  document.getElementById("historyMonthLabel").textContent = monthLabel;

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const cells = [];
  for (const label of weekdays) {
    cells.push(`<div class="history-weekday">${label}</div>`);
  }
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(`<div class="history-day empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    const dayKey = dateKeyFromDate(d);
    const row = state.practiceHistory[dayKey];
    const practiced = Number(row?.seconds || 0) > 0;
    const lessonCount = Object.keys(row?.lessons || {}).length;
    const selected = state.selectedHistoryDateKey === dayKey;
    cells.push(`
      <button class="history-day ${practiced ? "practiced" : ""} ${selected ? "selected" : ""}" data-history-day="${dayKey}">
        <span class="day-num">${day}</span>
        <span class="day-lessons">${practiced ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"}` : ""}</span>
      </button>
    `);
  }
  document.getElementById("historyCalendar").innerHTML = cells.join("");
  renderHistoryDayDetails(state.selectedHistoryDateKey);
}

function formatTime(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function displayPitchOnly(note) {
  return String(note || "").replace(/\d+/g, "");
}

function compactChordSymbol(value) {
  return String(value || "")
    .replace(/[\s\u00a0\u2000-\u200b\u202f\u205f\u3000]+/g, "")
    .replace(/♭/g, "b")
    .replace(/♯/g, "#")
    .trim();
}

function showToast(message, durationMs = 1800) {
  const el = document.getElementById("appToast");
  if (!el || !message) return;
  el.textContent = String(message);
  el.classList.remove("hidden");
  if (showToast.timeoutId) clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    el.classList.add("hidden");
  }, Math.max(700, Number(durationMs) || 1800));
}

function chordEventBeatLabel(event) {
  const start = Number(event?.beatStart);
  const length = Number(event?.beatLength);
  if (!Number.isFinite(start) || !Number.isFinite(length)) return "";
  const end = start + length - 1;
  if (Math.abs(length - 1) < 0.001) return `Beat ${start}`;
  return `Beats ${start}-${Number(end.toFixed(2))}`;
}

function noteNameToMidi(note) {
  const parsed = parseNote(note);
  if (!parsed) return null;
  const pitch = `${parsed.letter}${parsed.sharp ? "#" : ""}`;
  const semitone = SEMITONES[pitch];
  if (!Number.isInteger(semitone)) return null;
  return 12 * (parsed.octave + 1) + semitone;
}

function noteToVexKey(note) {
  const parsed = parseNote(note);
  if (!parsed) return null;
  return `${parsed.letter.toLowerCase()}${parsed.sharp ? "#" : ""}/${parsed.octave}`;
}

function songHasStructuredChart(exercise) {
  return exercise?.moduleId === "songs" && Array.isArray(exercise?.songData?.measures) && exercise.songData.measures.length > 0;
}

function renderSongMeasureStaff(measure, activeEventIndex = -1) {
  const events = Array.isArray(measure?.chordEvents) && measure.chordEvents.length
    ? measure.chordEvents
    : [measure];
  const encoded = encodeURIComponent(JSON.stringify(events.map((event) => ({
    staffNotes: Array.isArray(event?.staffNotes) ? event.staffNotes.filter((note) => Boolean(parseNote(note))) : [],
    beatStart: Number(event?.beatStart || 1),
    beatLength: Number(event?.beatLength || 1)
  }))));
  const timeSignature = String(measure?.sectionTimeSignature || measure?.timeSignature || "4/4");
  const normalizedActiveEvent = Number.isInteger(activeEventIndex) ? activeEventIndex : -1;
  return `<div class="song-measure-staff-notation" data-measure-events="${encoded}" data-time-signature="${timeSignature}" data-active-event="${normalizedActiveEvent}"></div>`;
}

function notationRenderWidth(target) {
  const parentWidth = target?.parentElement?.clientWidth || 0;
  const selfWidth = target?.clientWidth || 0;
  const measured = Math.max(parentWidth, selfWidth);
  const minWidth = 220;
  if (measured <= 0) return minWidth;
  return Math.max(minWidth, Math.round(measured * 0.92));
}

function drawFallbackChordStack(target, notes) {
  const safeNotes = Array.isArray(notes) ? notes : [];
  const width = Math.max(220, notationRenderWidth(target));
  const height = 124;
  const staffLines = [20, 38, 56, 74, 92];
  const staffWidth = Math.max(152, Math.round(width * 0.64));
  const staffX = Math.round((width - staffWidth) / 2);
  const lines = staffLines.map((y) => `<line x1="${staffX}" y1="${y}" x2="${staffX + staffWidth}" y2="${y}" stroke="#6b7f99" stroke-width="1.4" />`).join("");
  const x = Math.round(staffX + staffWidth * 0.52);
  const clef = `<text x="${staffX - 10}" y="${staffLines[4] + 3}" font-size="112" font-family="'Segoe UI Symbol','Arial Unicode MS',serif" fill="#3a5778">𝄞</text>`;
  const baseIndex = diatonicIndex("E4");
  const stepY = 9;
  const mapped = safeNotes
    .map((note) => {
      const idx = diatonicIndex(note);
      if (!Number.isFinite(idx) || !Number.isFinite(baseIndex)) return null;
      return { y: staffLines[4] - (idx - baseIndex) * stepY };
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y);
  const positioned = mapped.map((row) => ({ y: row.y, x }));

  const topLine = staffLines[0];
  const bottomLine = staffLines[4];
  const ledgerY = new Set();
  positioned.forEach((pos) => {
    if (pos.y < topLine) {
      for (let y = topLine - 18; y >= pos.y; y -= 18) ledgerY.add(y);
    } else if (pos.y > bottomLine) {
      for (let y = bottomLine + 18; y <= pos.y; y += 18) ledgerY.add(y);
    }
  });
  const ledgers = Array.from(ledgerY)
    .sort((a, b) => a - b)
    .map((y) => `<line x1="${x - 16}" y1="${y}" x2="${x + 16}" y2="${y}" stroke="#6b7f99" stroke-width="1.2" />`)
    .join("");

  const noteNodes = positioned.map((pos) => `
    <g transform="translate(${pos.x} ${pos.y}) rotate(-14)">
      <ellipse cx="0" cy="0" rx="10.6" ry="8.1" fill="#1f5ea7" stroke="#0f3a66" stroke-width="1.5" />
    </g>
  `).join("");
  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Measure chord stack preview">${lines}${clef}${ledgers}${noteNodes}</svg>`;
}

function drawVexChordStack(target, notes) {
  drawFallbackChordStack(target, notes);
}

function drawFallbackMeasureTimeline(target, events, timeSignature = "4/4", activeEventIndex = -1) {
  const safeEvents = Array.isArray(events) ? events : [];
  const beatsPerBar = beatsPerBarFromTimeSignature(timeSignature);
  const width = Math.max(220, notationRenderWidth(target));
  const height = 124;
  const staffLines = [20, 38, 56, 74, 92];
  const staffWidth = Math.max(164, Math.round(width * 0.7));
  const staffX = Math.round((width - staffWidth) / 2);
  const leftEdge = staffX + 44;
  const rightEdge = staffX + staffWidth - 10;
  const timelineWidth = Math.max(80, rightEdge - leftEdge);
  const lines = staffLines
    .map((y) => `<line x1="${staffX}" y1="${y}" x2="${staffX + staffWidth}" y2="${y}" stroke="#6b7f99" stroke-width="1.4" />`)
    .join("");
  const clef = `<text x="${staffX - 10}" y="${staffLines[4] + 3}" font-size="112" font-family="'Segoe UI Symbol','Arial Unicode MS',serif" fill="#3a5778">𝄞</text>`;
  const timeSigCenterY = ((staffLines[1] + staffLines[3]) / 2) + 2;
  const timeSigTopY = timeSigCenterY - 8;
  const timeSigBottomY = timeSigCenterY + 8;
  const timeSig = `<text x="${staffX + 28}" y="${timeSigTopY}" font-size="16.5" font-weight="700" fill="#2f4764">${beatsPerBar}</text><text x="${staffX + 28}" y="${timeSigBottomY}" font-size="16.5" font-weight="700" fill="#2f4764">${String(timeSignature).split("/")[1] || "4"}</text>`;
  const beatGuides = Array.from({ length: beatsPerBar + 1 }, (_, i) => {
    const x = leftEdge + (i / beatsPerBar) * timelineWidth;
    return `<line x1="${x}" y1="${staffLines[0] - 5}" x2="${x}" y2="${staffLines[4] + 5}" stroke="${i === 0 || i === beatsPerBar ? "#5e7592" : "#cfdae9"}" stroke-width="${i === 0 || i === beatsPerBar ? "1.4" : "1"}" />`;
  }).join("");

  const baseIndex = diatonicIndex("E4");
  const stepY = 9;
  const topLine = staffLines[0];
  const bottomLine = staffLines[4];
  const ledgerNodes = [];
  const noteNodes = [];

  safeEvents.forEach((event, eventIndex) => {
    const centerBeat = Math.max(0.25, Math.min(beatsPerBar, Number(event?.beatStart || 1) - 1 + (Number(event?.beatLength || 1) / 2)));
    const x = leftEdge + (centerBeat / beatsPerBar) * timelineWidth;
    const notes = Array.isArray(event?.staffNotes) ? event.staffNotes : [];
    const mapped = notes
      .map((note) => {
        const idx = diatonicIndex(note);
        if (!Number.isFinite(idx) || !Number.isFinite(baseIndex)) return null;
        return { y: staffLines[4] - (idx - baseIndex) * stepY };
      })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y);

    const isActive = eventIndex === activeEventIndex;
    const fill = isActive ? "#ff9f1a" : "#1f5ea7";
    const stroke = isActive ? "#7a3f00" : "#0f3a66";

    mapped.forEach((pos) => {
      if (pos.y < topLine) {
        for (let y = topLine - 18; y >= pos.y; y -= 18) {
          ledgerNodes.push(`<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#6b7f99" stroke-width="1.1" />`);
        }
      } else if (pos.y > bottomLine) {
        for (let y = bottomLine + 18; y <= pos.y; y += 18) {
          ledgerNodes.push(`<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#6b7f99" stroke-width="1.1" />`);
        }
      }
      noteNodes.push(`
        <g transform="translate(${x} ${pos.y}) rotate(-14)">
          ${isActive ? `<ellipse cx="0" cy="0" rx="13.8" ry="11.1" fill="#ffd28a" opacity="0.58" />` : ""}
          <ellipse cx="0" cy="0" rx="10.6" ry="8.1" fill="${fill}" stroke="${stroke}" stroke-width="${isActive ? "2.1" : "1.4"}" />
        </g>
      `);
    });
  });

  target.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Measure staff with beat-aligned chord events">${lines}${beatGuides}${clef}${timeSig}${ledgerNodes.join("")}${noteNodes.join("")}</svg>`;
}

function renderSongMeasureNotationNodes() {
  if (songPlayback.notationRafId) {
    cancelAnimationFrame(songPlayback.notationRafId);
    songPlayback.notationRafId = null;
  }
  songPlayback.notationRafId = requestAnimationFrame(() => {
    const nodes = Array.from(document.querySelectorAll(".song-measure-staff-notation"));
    for (const node of nodes) {
      const rawMeasureEvents = node.getAttribute("data-measure-events") || "";
      const rawChordNotes = node.getAttribute("data-chord-notes") || "";
      const timeSignature = node.getAttribute("data-time-signature") || "4/4";
      const activeEventIndex = Number.parseInt(node.getAttribute("data-active-event") || "-1", 10);
      let measureEvents = [];
      let chordNotes = [];
      try {
        const parsed = JSON.parse(decodeURIComponent(rawMeasureEvents));
        measureEvents = Array.isArray(parsed) ? parsed : [];
      } catch {
        measureEvents = [];
      }
      try {
        const parsed = JSON.parse(decodeURIComponent(rawChordNotes));
        chordNotes = Array.isArray(parsed) ? parsed : [];
      } catch {
        chordNotes = [];
      }
      if (measureEvents.length) {
        drawFallbackMeasureTimeline(node, measureEvents, timeSignature, Number.isInteger(activeEventIndex) ? activeEventIndex : 0);
      } else {
        drawVexChordStack(node, chordNotes);
      }
    }
    songPlayback.notationRafId = null;
  });
}

function chordEventForMeasure(measure, eventIndex = 0) {
  const events = Array.isArray(measure?.chordEvents) && measure.chordEvents.length
    ? measure.chordEvents
    : null;
  if (!events) return measure || null;
  const bounded = Math.max(0, Math.min(events.length - 1, eventIndex));
  return events[bounded] || events[0] || null;
}

function updateMeasureCardDisplay(measureEl, measure, eventIndex = -1) {
  if (!measureEl || !measure) return;
  const event = chordEventForMeasure(measure, eventIndex) || measure;
  const lyricEl = measureEl.querySelector(".song-lyric");
  const beatsEl = measureEl.querySelector(".song-event-beats");
  const metaEl = measureEl.querySelector(".song-event-meta");
  const notationEl = measureEl.querySelector(".song-measure-staff-notation");
  measureEl.querySelectorAll(".song-chord-event-chip").forEach((chip) => {
    const chipEvent = Number.parseInt(chip.getAttribute("data-song-event") || "-1", 10);
    chip.classList.toggle("active", chipEvent === eventIndex);
  });

  if (beatsEl) beatsEl.textContent = chordEventBeatLabel(event);
  if (metaEl) metaEl.textContent = `${event?.romanDisplay || event?.roman || ""} · ${event?.inversionLabel || "Root position"}`;
  if (lyricEl) lyricEl.textContent = event?.lyric || measure?.lyric || " ";
  if (notationEl) {
    const normalizedActiveEvent = Number.isInteger(eventIndex) ? eventIndex : -1;
    notationEl.setAttribute("data-active-event", String(normalizedActiveEvent));
  }
}

function buildSongMeasureExercise(exercise, measureIndex, chordEventIndex = 0) {
  if (!songHasStructuredChart(exercise)) return exercise;
  const measures = exercise.songData.measures;
  if (measureIndex < 0) {
    return {
      ...exercise,
      notes: [],
      fingering: [],
      handAssignments: [],
      rootNotes: [],
      rootHands: [],
      meta: `${exercise.songData.songKey || "Song"} · Waiting for chart start`,
      hint: exercise.hint
    };
  }
  const boundedIndex = Math.max(0, Math.min(measures.length - 1, measureIndex));
  const measure = measures[boundedIndex];
  const event = chordEventForMeasure(measure, chordEventIndex) || measure;
  const eventCount = Array.isArray(measure?.chordEvents) ? measure.chordEvents.length : 1;
  const eventLabel = eventCount > 1
    ? ` · Chord ${Math.max(1, Number(chordEventIndex) + 1)}/${eventCount}`
    : "";
  return {
    ...exercise,
    notes: Array.isArray(event?.notes) ? event.notes : [],
    fingering: Array.isArray(event?.fingering) ? event.fingering : [],
    handAssignments: Array.isArray(event?.handAssignments) ? event.handAssignments : [],
    rootNotes: Array.isArray(event?.rootNotes) ? event.rootNotes : [],
    rootHands: Array.isArray(event?.rootHands) ? event.rootHands : [],
    meta: `${exercise.songData.songKey || "Song"} · ${compactChordSymbol(event?.chordDisplay || event?.chordSymbol)} (${event?.romanDisplay || event?.roman}) · ${event?.inversionLabel || "Root position"} · Bar ${boundedIndex + 1}/${measures.length}${eventLabel}`,
    hint: `${exercise.hint} ${(event?.lyric || measure?.lyric) ? `Lyric cue: "${event?.lyric || measure?.lyric}"` : ""}`.trim()
  };
}

function getMeasureIndexForTime(measures, timeSec) {
  if (!Array.isArray(measures) || !measures.length || !Number.isFinite(timeSec)) return 0;
  const edgeEpsilon = 0.03;
  if (timeSec < Number(measures[0].startSec || 0) - edgeEpsilon) return -1;
  for (let i = 0; i < measures.length; i += 1) {
    const row = measures[i];
    if (timeSec >= Number(row.startSec || 0) - edgeEpsilon && timeSec < Number(row.endSec || 0) - edgeEpsilon) return i;
  }
  return timeSec >= Number(measures[measures.length - 1].endSec || 0) - edgeEpsilon ? measures.length - 1 : 0;
}

function getChordEventIndexForTime(measure, timeSec) {
  const events = Array.isArray(measure?.chordEvents) ? measure.chordEvents : [];
  if (!events.length) return 0;
  if (!Number.isFinite(timeSec)) return 0;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (timeSec >= Number(event.startSec || 0) && timeSec < Number(event.endSec || 0)) return i;
  }
  if (timeSec >= Number(events[events.length - 1].endSec || 0)) return events.length - 1;
  return 0;
}

function getMeasureAndChordEventForTime(measures, timeSec) {
  const measureIndex = getMeasureIndexForTime(measures, timeSec);
  if (measureIndex < 0 || !Array.isArray(measures) || !measures[measureIndex]) {
    return { measureIndex, chordEventIndex: 0 };
  }
  return {
    measureIndex,
    chordEventIndex: getChordEventIndexForTime(measures[measureIndex], timeSec)
  };
}

function getYouTubeTimeSec() {
  if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.getCurrentTime !== "function") return null;
  try {
    const current = Number(songPlayback.player.getCurrentTime());
    return Number.isFinite(current) ? current : null;
  } catch {
    return null;
  }
}

function getYouTubeDurationSec() {
  if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.getDuration !== "function") return null;
  try {
    const duration = Number(songPlayback.player.getDuration());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

function formatSongTimeClock(totalSec) {
  const bounded = Math.max(0, Math.floor(Number(totalSec) || 0));
  const mins = Math.floor(bounded / 60);
  const sec = bounded % 60;
  return `${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function songDurationSecForExercise(exercise) {
  const ytDuration = getYouTubeDurationSec();
  if (Number.isFinite(ytDuration)) return Math.max(1, ytDuration);
  if (!songHasStructuredChart(exercise)) return 1;
  const measures = exercise.songData?.measures || [];
  const firstStart = Number(exercise.songData?.chartStartSec || measures[0]?.startSec || 0);
  const last = measures[measures.length - 1];
  const end = Number(last?.endSec || last?.startSec || firstStart + 1);
  return Math.max(1, end + Math.max(0, firstStart * 0.2));
}

function renderSongArrangeScrubber(exercise) {
  const scrubber = document.getElementById("songArrangeScrubber");
  const markers = document.getElementById("songArrangeAnchorMarkers");
  const meta = document.getElementById("songArrangeScrubberMeta");
  if (!scrubber || !markers || !meta || !songHasStructuredChart(exercise)) return;
  const duration = songDurationSecForExercise(exercise);
  const current = getYouTubeTimeSec();
  const clampedCurrent = Number.isFinite(current)
    ? Math.max(0, Math.min(duration, Number(current)))
    : 0;

  scrubber.min = "0";
  scrubber.max = duration.toFixed(2);
  scrubber.step = "0.1";
  scrubber.disabled = !Boolean(songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.seekTo === "function");
  if (!songPlayback.scrubberDragging) {
    scrubber.value = clampedCurrent.toFixed(2);
  }

  const override = songTimingOverrideForExercise(exercise);
  const anchorRows = override?.anchors && typeof override.anchors === "object"
    ? Object.entries(override.anchors)
      .map(([key, value]) => ({ barIndex: Number.parseInt(key, 10), timeSec: Number(value) }))
      .filter((row) => Number.isInteger(row.barIndex) && row.barIndex >= 0 && Number.isFinite(row.timeSec))
      .sort((a, b) => a.timeSec - b.timeSec)
    : [];
  markers.innerHTML = anchorRows.map((row) => {
    const pct = Math.max(0, Math.min(100, (row.timeSec / duration) * 100));
    return `<span class="song-mini-anchor-flag" style="left:${pct.toFixed(2)}%" title="Bar ${row.barIndex + 1}"></span>`;
  }).join("");

  meta.textContent = `${formatSongTimeClock(clampedCurrent)} / ${formatSongTimeClock(duration)}`;
}

function updateSongChartHighlight(exercise, measureIndex, chordEventIndex = -1, timeSec = null) {
  const chart = document.getElementById("songChart");
  if (chart) {
    chart.querySelectorAll(".song-measure").forEach((el) => {
      const idx = Number.parseInt(el.dataset.songMeasure || "-1", 10);
      el.classList.toggle("active", idx === measureIndex);
      const measure = exercise?.songData?.measures?.[idx];
      const isDownbeatWindow = idx === measureIndex
        && state.songTrainerMode === "arrange"
        && Number.isFinite(timeSec)
        && measure
        && Number.isFinite(Number(measure.startSec))
        && (timeSec - Number(measure.startSec)) >= 0
        && (timeSec - Number(measure.startSec)) <= 0.22;
      el.classList.toggle("downbeat", Boolean(isDownbeatWindow));
      const showEventIndex = idx === measureIndex ? chordEventIndex : -1;
      updateMeasureCardDisplay(el, measure, showEventIndex);
    });
    renderSongMeasureNotationNodes();

    const activeEl = measureIndex >= 0
      ? chart.querySelector(`.song-measure[data-song-measure="${measureIndex}"]`)
      : null;
    if (activeEl) {
      const shouldPinActiveToTop = state.songTrainerMode === "play"
        && songPlayback.videoPlaying
        && chart.scrollHeight > chart.clientHeight + 4;

      if (shouldPinActiveToTop) {
        const chartRect = chart.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const currentRelativeTop = (activeRect.top - chartRect.top) + chart.scrollTop;
        const nextScrollTop = Math.max(0, currentRelativeTop - 8);
        chart.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      } else {
        activeEl.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
    }
  }

  const followMeta = document.getElementById("songFollowMeta");
  const measure = exercise?.songData?.measures?.[measureIndex];
  const event = chordEventForMeasure(measure, chordEventIndex) || measure;
  if (followMeta && measure) {
    const currentTime = Number.isFinite(timeSec) ? `${timeSec.toFixed(1)}s` : "manual";
    const eventCount = Array.isArray(measure?.chordEvents) ? measure.chordEvents.length : 1;
    const eventText = eventCount > 1 ? ` · Chord ${Math.max(1, chordEventIndex + 1)}/${eventCount}` : "";
    followMeta.textContent = `Bar ${measureIndex + 1}/${exercise.songData.measures.length}${eventText} · ${compactChordSymbol(event?.chordDisplay || event?.chordSymbol)} (${event?.romanDisplay || event?.roman}) · ${event?.inversionLabel || "Root position"} · ${currentTime}`;
  } else if (followMeta) {
    const startAt = Number(exercise?.songData?.chartStartSec || exercise?.songData?.measures?.[0]?.startSec || 0);
    const currentTime = Number.isFinite(timeSec) ? `${timeSec.toFixed(1)}s` : "manual";
    followMeta.textContent = `Intro lead-in · Chart starts at ${startAt.toFixed(1)}s · ${currentTime}`;
  }
}

function syncSongFollowAlong(exercise, force = false) {
  if (!songHasStructuredChart(exercise)) return;
  if (!songPlayback.videoPlaying) {
    if (force) {
      updateSongChartHighlight(exercise, -1, -1, getYouTubeTimeSec());
    }
    renderSongArrangeScrubber(exercise);
    return;
  }
  const measures = exercise.songData.measures;
  const timeSec = getYouTubeTimeSec();
  const next = Number.isFinite(timeSec)
    ? getMeasureAndChordEventForTime(measures, timeSec)
    : {
      measureIndex: Math.max(0, Math.min(measures.length - 1, songPlayback.activeMeasureIndex)),
      chordEventIndex: Math.max(0, songPlayback.activeChordEventIndex || 0)
    };

  if (
    force
    || next.measureIndex !== songPlayback.activeMeasureIndex
    || next.chordEventIndex !== songPlayback.activeChordEventIndex
  ) {
    songPlayback.activeMeasureIndex = next.measureIndex;
    songPlayback.activeChordEventIndex = next.chordEventIndex;
    const keyboardExercise = buildSongMeasureExercise(exercise, next.measureIndex, next.chordEventIndex);
    renderKeyboard(keyboardExercise);
    if (next.measureIndex >= 0) {
      const measure = measures[next.measureIndex];
      const event = chordEventForMeasure(measure, next.chordEventIndex) || measure;
      const eventCount = Array.isArray(measure?.chordEvents) ? measure.chordEvents.length : 1;
      const eventText = eventCount > 1 ? ` · Chord ${next.chordEventIndex + 1}/${eventCount}` : "";
      document.getElementById("noteSequence").textContent =
        `Section: ${measure.section || "Song"} (${measure.formTag || "-"}) · Chord: ${compactChordSymbol(event?.chordDisplay || event?.chordSymbol)} (${event?.romanDisplay || event?.roman}) · ${event?.inversionLabel || "Root position"}${eventText}${(event?.lyric || measure?.lyric) ? ` · Lyric: ${event?.lyric || measure?.lyric}` : ""}`;
    } else {
      document.getElementById("noteSequence").textContent = "Intro lead-in before chart start.";
    }
    updateSongChartHighlight(exercise, next.measureIndex, next.chordEventIndex, timeSec);
  }
  renderSongArrangeScrubber(exercise);
}

function stopSongFollowAlongPoll() {
  if (songPlayback.pollIntervalId) {
    clearInterval(songPlayback.pollIntervalId);
    songPlayback.pollIntervalId = null;
  }
}

function startSongFollowAlongPoll() {
  if (songPlayback.pollIntervalId) return;
  songPlayback.pollIntervalId = setInterval(() => {
    if (state.screen !== "practice" || state.block !== "song") return;
    const exercise = currentExercise();
    syncSongFollowAlong(exercise, false);
  }, 220);
}

function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) return;
  if (songPlayback.apiRequested) return;
  songPlayback.apiRequested = true;
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(script);
}

function setSongPlayerPlaceholder(message) {
  const host = document.getElementById("songYoutubePlayer");
  if (!host) return;
  host.innerHTML = `<p class="song-player-placeholder">${message}</p>`;
}

function createYouTubePlayer(songData) {
  const host = document.getElementById("songYoutubePlayer");
  if (!host || !window.YT || !window.YT.Player) return;
  host.innerHTML = "";

  if (songPlayback.player && typeof songPlayback.player.destroy === "function") {
    songPlayback.player.destroy();
  }

  songPlayback.playerReady = false;
  songPlayback.videoPlaying = false;
  songPlayback.currentVideoId = songData.youtubeId;
  songPlayback.currentSongId = songData.id;
  songPlayback.player = new window.YT.Player("songYoutubePlayer", {
    width: "100%",
    height: "100%",
    videoId: songData.youtubeId,
    playerVars: {
      playsinline: 1,
      rel: 0
    },
    events: {
      onReady: () => {
        songPlayback.playerReady = true;
        songPlayback.videoPlaying = false;
        syncSongFollowAlong(currentExercise(), true);
      },
      onStateChange: (event) => {
        songPlayback.videoPlaying = event?.data === window.YT?.PlayerState?.PLAYING;
        if (!songPlayback.videoPlaying) {
          state.songShowVideoInPlayMode = false;
        }
        if (state.block === "song" && state.screen === "practice") {
          renderPractice();
        }
        syncSongFollowAlong(currentExercise(), true);
      }
    }
  });
}

function ensureSongPlayer(songData) {
  if (!songData?.youtubeId) {
    if (songPlayback.player && typeof songPlayback.player.destroy === "function") {
      songPlayback.player.destroy();
      songPlayback.player = null;
      songPlayback.playerReady = false;
      songPlayback.videoPlaying = false;
      songPlayback.currentVideoId = null;
      songPlayback.currentSongId = null;
    }
    setSongPlayerPlaceholder("No playalong video configured for this song yet.");
    return;
  }

  if (window.YT && window.YT.Player) {
    if (songPlayback.currentVideoId === songData.youtubeId && songPlayback.player) return;
    createYouTubePlayer(songData);
    return;
  }

  songPlayback.pendingSongData = songData;
  setSongPlayerPlaceholder("Loading YouTube player...");
  ensureYouTubeApi();
}

function songTimingOverrideForExercise(exercise) {
  if (!exercise?.id) return null;
  const sourceId = String(exercise.songData?.arrangementSource?.id || "default");
  const scopedKey = `${exercise.id}::${sourceId}`;
  if (state.songTimingOverrides?.[scopedKey]) return state.songTimingOverrides[scopedKey];
  if (sourceId === "default") return state.songTimingOverrides?.[exercise.id] || null;
  return null;
}

function timingOverrideStateKey(exercise) {
  if (!exercise?.id) return "";
  const sourceId = String(exercise.songData?.arrangementSource?.id || "default");
  return `${exercise.id}::${sourceId}`;
}

function timingCalibrationContextId(exercise) {
  return timingOverrideStateKey(exercise);
}

function songSectionOverrideForExercise(exercise) {
  if (!exercise?.id) return null;
  return state.songSectionOverrides?.[exercise.id] || null;
}

function songArrangementOverrideForExercise(exercise) {
  if (!exercise?.id) return null;
  return state.songArrangementOverrides?.[exercise.id] || null;
}

function saveSongTimingOverride(exercise, override) {
  if (!exercise?.id) return;
  const key = timingOverrideStateKey(exercise);
  state.songTimingOverrides[key] = {
    barStarts: Array.isArray(override?.barStarts)
      ? override.barStarts.map((value) => (Number.isFinite(value) ? Number(value) : null))
      : [],
    anchors: override?.anchors && typeof override.anchors === "object"
      ? Object.fromEntries(
        Object.entries(override.anchors)
          .map(([k, v]) => [String(k), Number(v)])
          .filter(([, v]) => Number.isFinite(v))
      )
      : {},
    stride: [1, 2, 4, 8].includes(Number(override?.stride)) ? Number(override.stride) : songCalibrationStride()
  };
  saveState();
}

function saveSongSectionOverride(exercise, override) {
  if (!exercise?.id) return;
  state.songSectionOverrides[exercise.id] = {
    sections: override?.sections && typeof override.sections === "object" ? override.sections : {}
  };
  saveState();
}

function saveSongArrangementOverride(exercise, override) {
  if (!exercise?.id) return;
  const measures = Array.isArray(override?.measures) ? override.measures.map((measure) => sanitizeMeasureForOverride(measure)) : [];
  state.songArrangementOverrides[exercise.id] = { measures };
  saveState();
}

function clearSongTimingOverride(exercise) {
  if (!exercise?.id) return;
  const key = timingOverrideStateKey(exercise);
  delete state.songTimingOverrides[key];
  saveState();
}

function clearSongArrangementOverride(exercise) {
  if (!exercise?.id) return;
  delete state.songArrangementOverrides[exercise.id];
  saveState();
}

function songCalibrationStride() {
  const select = document.getElementById("songTapStrideSelect");
  if (select instanceof HTMLSelectElement) {
    const value = Number.parseInt(select.value || "", 10);
    if ([1, 2, 4, 8].includes(value)) return value;
  }
  return [1, 2, 4, 8].includes(Number(state.songCalibrationStride)) ? Number(state.songCalibrationStride) : 1;
}

function baselineSongBarStarts(exercise) {
  function normalizeStarts(rawStarts) {
    const baseStarts = Array.isArray(rawStarts) ? rawStarts : [];
    const firstFinite = baseStarts.find((n) => Number.isFinite(n));
    const first = Number.isFinite(firstFinite) ? Number(firstFinite) : 0;
    const starts = baseStarts.map((n, idx) => {
      if (Number.isFinite(n)) return Number((Number(n) - first).toFixed(2));
      if (idx > 0 && Number.isFinite(baseStarts[idx - 1])) {
        return Number((Number(baseStarts[idx - 1]) - first + 3.4).toFixed(2));
      }
      return Number((idx * 3.4).toFixed(2));
    });
    for (let i = 1; i < starts.length; i += 1) {
      if (!Number.isFinite(starts[i])) starts[i] = Number((starts[i - 1] + 3.4).toFixed(2));
      if (starts[i] <= starts[i - 1]) {
        starts[i] = Number((starts[i - 1] + 0.2).toFixed(2));
      }
    }
    if (starts.length) starts[0] = 0;
    return starts;
  }

  const keySongs = songRowsForKey(state.selectedKey);
  const fallback = Array.isArray(exercise?.songData?.measures)
    ? exercise.songData.measures.map((measure) => Number(measure.startSec || 0))
    : [];
  if (!Array.isArray(keySongs) || !keySongs.length) return normalizeStarts(fallback);
  const sourceSong = keySongs[state.songIndex];
  if (!Array.isArray(sourceSong?.measures) || !sourceSong.measures.length) return normalizeStarts(fallback);
  return normalizeStarts(sourceSong.measures.map((measure) => Number(measure.startSec || 0)));
}

function interpolateSongBarStarts(totalBars, baselineStarts, anchors) {
  const starts = Array.from({ length: totalBars }, (_, idx) => {
    const fromBaseline = Number(baselineStarts?.[idx]);
    if (Number.isFinite(fromBaseline)) return fromBaseline;
    if (idx > 0 && Number.isFinite(baselineStarts?.[idx - 1])) return Number(baselineStarts[idx - 1]) + 3.4;
    return idx * 3.4;
  });
  const anchorEntries = Object.entries(anchors || {})
    .map(([k, v]) => ({ idx: Number.parseInt(k, 10), time: Number(v) }))
    .filter((row) => Number.isInteger(row.idx) && row.idx >= 0 && row.idx < totalBars && Number.isFinite(row.time))
    .sort((a, b) => a.idx - b.idx);
  if (!anchorEntries.length) return starts;

  for (const row of anchorEntries) {
    starts[row.idx] = row.time;
  }

  const first = anchorEntries[0];
  const firstBaseline = Number(baselineStarts?.[first.idx]);
  const firstShift = Number.isFinite(firstBaseline) ? first.time - firstBaseline : 0;
  for (let i = 0; i < first.idx; i += 1) {
    const base = Number(baselineStarts?.[i]);
    starts[i] = Number.isFinite(base) ? base + firstShift : starts[i];
  }

  for (let a = 0; a < anchorEntries.length - 1; a += 1) {
    const left = anchorEntries[a];
    const right = anchorEntries[a + 1];
    const span = right.idx - left.idx;
    if (span <= 1) continue;
    const step = (right.time - left.time) / span;
    for (let i = 1; i < span; i += 1) {
      starts[left.idx + i] = Number((left.time + step * i).toFixed(2));
    }
  }

  const last = anchorEntries[anchorEntries.length - 1];
  const lastBaseline = Number(baselineStarts?.[last.idx]);
  const lastShift = Number.isFinite(lastBaseline) ? last.time - lastBaseline : 0;
  for (let i = last.idx + 1; i < totalBars; i += 1) {
    const base = Number(baselineStarts?.[i]);
    starts[i] = Number.isFinite(base) ? base + lastShift : starts[i];
  }

  for (let i = 1; i < starts.length; i += 1) {
    if (!Number.isFinite(starts[i])) starts[i] = starts[i - 1] + 3.4;
    if (starts[i] <= starts[i - 1]) {
      starts[i] = Number((starts[i - 1] + 0.2).toFixed(2));
    }
  }
  return starts.map((value) => Number(Number(value).toFixed(2)));
}

function nextAnchorIndex(currentIndex, totalBars, stride) {
  if (currentIndex >= totalBars - 1) return totalBars;
  const tentative = currentIndex + Math.max(1, stride);
  if (tentative >= totalBars - 1) return totalBars - 1;
  return tentative;
}

function currentPlaybackTime() {
  const timeSec = getYouTubeTimeSec();
  return Number.isFinite(timeSec) ? Number(timeSec) : null;
}

function scrollSongChartToTop() {
  const chartCard = document.getElementById("songPracticeCard");
  if (!chartCard) return;
  requestAnimationFrame(() => {
    chartCard.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

function groupedSongMeasures(songData) {
  if (!Array.isArray(songData?.measures)) return [];
  const groups = [];
  for (let i = 0; i < songData.measures.length; i += 1) {
    const measure = songData.measures[i];
    const section = measure.section || "Section";
    const formTag = measure.formTag || "";
    const sectionTimeSignature = measure.sectionTimeSignature || songData?.timeSignature || "";
    const sectionKeySignature = measure.sectionKeySignature || songData?.songKey || "";
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup
      || lastGroup.section !== section
      || lastGroup.formTag !== formTag
      || lastGroup.sectionTimeSignature !== sectionTimeSignature
      || lastGroup.sectionKeySignature !== sectionKeySignature) {
      groups.push({
        section,
        formTag,
        sectionTimeSignature,
        sectionKeySignature,
        rows: [{ measure, index: i }]
      });
    } else {
      lastGroup.rows.push({ measure, index: i });
    }
  }
  return groups;
}

function arrangementSummary(songData) {
  if (!Array.isArray(songData?.formSections) || !songData.formSections.length) return "n/a";
  const steps = songData.formSections.map((section) => section.formTag || section.name || "?");
  if (steps.length >= 3) {
    const first = steps[0];
    const last = steps[steps.length - 1];
    const middle = steps.slice(1, -1);
    if (middle.length) {
      return `${first} -> ${middle.join(" ")} -> ${last}`;
    }
  }
  return steps.join(" ");
}

function ensureSongSectionSelection(songData) {
  if (!Array.isArray(songData?.formSections) || !songData.formSections.length) {
    state.selectedSongSection = "";
    return;
  }
  const exists = songData.formSections.some((section) => section.name === state.selectedSongSection);
  if (!exists) {
    state.selectedSongSection = songData.formSections[0].name;
  }
}

function renderSongSectionEditor(exercise) {
  const select = document.getElementById("songSectionSelect");
  const keyInput = document.getElementById("songSectionKeyInput");
  const timeInput = document.getElementById("songSectionTimeInput");
  if (!select || !keyInput || !timeInput || !songHasStructuredChart(exercise)) return;

  const song = exercise.songData;
  ensureSongSectionSelection(song);
  const sectionOverrides = songSectionOverrideForExercise(exercise)?.sections || {};
  select.innerHTML = (song.formSections || []).map((section) => {
    const label = section.formTag ? `${section.name} (${section.formTag})` : section.name;
    return `<option value="${section.name}" ${section.name === state.selectedSongSection ? "selected" : ""}>${label}</option>`;
  }).join("");

  const section = (song.formSections || []).find((row) => row.name === state.selectedSongSection) || song.formSections?.[0];
  const override = section ? sectionOverrides[section.name] : null;
  keyInput.value = override?.keySignature || section?.sectionKeySignature || song.songKey || "";
  timeInput.value = override?.timeSignature || section?.sectionTimeSignature || song.timeSignature || "";
}

function renderSongSourceSelector(songData) {
  const select = document.getElementById("songArrangementSourceSelect");
  if (!(select instanceof HTMLSelectElement) || !songData?.id) return;
  const variants = Array.isArray(songData.sourceVariants) && songData.sourceVariants.length
    ? songData.sourceVariants
    : [{ id: "default", label: songData.arrangementSource?.label || "Default" }];
  const selected = selectedSongSourceChoice(songData.id);
  select.innerHTML = variants.map((row) => {
    const id = String(row?.id || "default");
    const label = String(row?.label || id);
    return `<option value="${id}" ${selected === id ? "selected" : ""}>${label}</option>`;
  }).join("");
  select.disabled = !state.songArrangeAccess;
}

function renderSongArrangementMeta(exercise) {
  const meta = document.getElementById("songArrangeSelectionMeta");
  const mergeBtn = document.getElementById("songMergeBarsBtn");
  const splitBtn = document.getElementById("songSplitBarBtn");
  if (!meta || !mergeBtn || !splitBtn || !songHasStructuredChart(exercise)) return;
  const selected = sortedSelectedArrangeBars();
  const measures = exercise.songData.measures;
  const inRange = selected.filter((idx) => idx >= 0 && idx < measures.length);
  state.songArrangeSelectedBars = inRange;
  const canMerge = inRange.length === 2
    && inRange[1] === inRange[0] + 1
    && (measures[inRange[0]]?.section || "") === (measures[inRange[1]]?.section || "");
  const canSplit = inRange.length === 1;
  mergeBtn.disabled = !canMerge;
  splitBtn.disabled = !canSplit;
  if (!inRange.length) {
    meta.textContent = "Arrangement edit: click a bar to set playhead; Cmd/Ctrl-click to multi-select bars.";
    return;
  }
  const labels = inRange.map((idx) => idx + 1).join(", ");
  meta.textContent = `Selected bars: ${labels}. Merge requires 2 adjacent bars in same section. Split requires 1 bar.`;
}

function lyricEditTargetForExercise(exercise) {
  if (!songHasStructuredChart(exercise)) return null;
  const measures = exercise.songData.measures;
  if (!Array.isArray(measures) || !measures.length) return null;
  const selected = sortedSelectedArrangeBars();
  const barIndex = selected.length === 1
    ? selected[0]
    : Math.max(0, Math.min(measures.length - 1, Number(songPlayback.activeMeasureIndex || 0)));
  const measure = measures[barIndex];
  if (!measure) return null;
  const events = Array.isArray(measure.chordEvents) && measure.chordEvents.length ? measure.chordEvents : [measure];
  const rawEvent = Number(songPlayback.activeChordEventIndex || 0);
  const eventIndex = Math.max(0, Math.min(events.length - 1, rawEvent));
  const event = events[eventIndex] || measure;
  return { barIndex, eventIndex, eventCount: events.length, measure, event };
}

function renderSongLyricsEditor(exercise) {
  const meta = document.getElementById("songLyricsTargetMeta");
  const input = document.getElementById("songLyricEditorInput");
  const applyBtn = document.getElementById("songApplyLyricBtn");
  const clearBtn = document.getElementById("songClearLyricBtn");
  if (!meta || !input || !applyBtn || !clearBtn || !songHasStructuredChart(exercise)) return;
  const target = lyricEditTargetForExercise(exercise);
  if (!target) {
    meta.textContent = "Target: select a bar/chord in chart.";
    input.value = "";
    input.disabled = true;
    applyBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }
  meta.textContent = `Target: Bar ${target.barIndex + 1} · Chord ${target.eventIndex + 1}/${target.eventCount}`;
  input.value = String(target.event?.lyric || "");
  input.disabled = false;
  applyBtn.disabled = false;
  clearBtn.disabled = false;
}

function setLyricForCurrentTarget(exercise, lyricValue) {
  if (!songHasStructuredChart(exercise)) return false;
  const target = lyricEditTargetForExercise(exercise);
  if (!target) return false;
  const measures = exercise.songData.measures.map((measure) => sanitizeMeasureForOverride(measure));
  const row = measures[target.barIndex];
  if (!row) return false;
  const events = Array.isArray(row.chordEvents) && row.chordEvents.length
    ? row.chordEvents.map((event) => ({ ...event }))
    : [{
      chord: row.chordSymbol || "C",
      roman: row.roman || "I",
      inversion: row.inversion || "root",
      lyric: row.lyric || "",
      beatStart: 1,
      beatLength: beatsPerBarFromTimeSignature(row.sectionTimeSignature || "4/4")
    }];
  events[target.eventIndex] = {
    ...events[target.eventIndex],
    lyric: String(lyricValue || "")
  };
  row.chordEvents = events;
  row.lyric = events.find((event) => String(event.lyric || "").trim())?.lyric || "";
  saveSongArrangementOverride(exercise, { measures });
  return true;
}

function triggerSongApplyLyricToTarget() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  const input = document.getElementById("songLyricEditorInput");
  const nextLyric = input instanceof HTMLTextAreaElement ? input.value : "";
  if (!setLyricForCurrentTarget(exercise, nextLyric)) return;
  showToast("Lyric mapped to selected chord");
  renderPractice();
}

function triggerSongClearLyricFromTarget() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  if (!setLyricForCurrentTarget(exercise, "")) return;
  showToast("Lyric cleared from selected chord");
  renderPractice();
}

function applySongSectionSettings(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const select = document.getElementById("songSectionSelect");
  const keyInput = document.getElementById("songSectionKeyInput");
  const timeInput = document.getElementById("songSectionTimeInput");
  if (!select || !keyInput || !timeInput) return;
  const sectionName = String(select.value || "").trim();
  if (!sectionName) return;
  state.selectedSongSection = sectionName;

  const current = songSectionOverrideForExercise(exercise)?.sections || {};
  const next = { ...current };
  next[sectionName] = {
    keySignature: String(keyInput.value || "").trim() || exercise.songData.songKey || "n/a",
    timeSignature: String(timeInput.value || "").trim() || exercise.songData.timeSignature || "n/a"
  };
  saveSongSectionOverride(exercise, { sections: next });
  renderPractice();
}

function renderSongCalibrationMeta(exercise) {
  const meta = document.getElementById("songCalibrationMeta");
  const anchorBadge = document.getElementById("songLastAnchorBadge");
  const jumpBtn = document.getElementById("songJumpLastAnchorBtn");
  if (!meta || !songHasStructuredChart(exercise)) return;
  const override = songTimingOverrideForExercise(exercise);
  const stride = [1, 2, 4, 8].includes(Number(override?.stride)) ? Number(override.stride) : songCalibrationStride();
  const strideSelect = document.getElementById("songTapStrideSelect");
  if (strideSelect instanceof HTMLSelectElement) {
    strideSelect.value = String(stride);
  }
  const start = Number(exercise.songData?.measures?.[0]?.startSec || 0);
  const totalBars = exercise.songData.measures.length;
  const isActiveSong = songPlayback.calibrationSongId === timingCalibrationContextId(exercise);
  const mappedBars = Array.isArray(override?.barStarts) ? override.barStarts.filter((n) => Number.isFinite(n)).length : 0;
  const anchorRows = override?.anchors && typeof override.anchors === "object"
    ? Object.entries(override.anchors)
      .map(([key, value]) => ({ barIndex: Number.parseInt(key, 10), timeSec: Number(value) }))
      .filter((row) => Number.isInteger(row.barIndex) && row.barIndex >= 0 && row.barIndex < totalBars && Number.isFinite(row.timeSec))
      .sort((a, b) => a.barIndex - b.barIndex)
    : [];
  const anchorCount = anchorRows.length;
  const nextBar = isActiveSong
    ? songPlayback.calibrationNextBarIndex + 1
    : Math.min(mappedBars + 1, totalBars);
  const boundedNextBar = Math.max(1, Math.min(nextBar, totalBars));
  meta.textContent =
    `Calibration: start ${start.toFixed(2)}s · mapped ${mappedBars}/${totalBars} bars · anchors ${anchorCount} · tap every ${stride} bar${stride === 1 ? "" : "s"} · next tap bar ${boundedNextBar}.`;
  const lastAnchor = anchorRows.length ? anchorRows[anchorRows.length - 1] : null;
  if (anchorBadge) {
    anchorBadge.textContent = lastAnchor
      ? `Last anchor: Bar ${lastAnchor.barIndex + 1} @ ${lastAnchor.timeSec.toFixed(2)}s`
      : "Last anchor: none";
  }
  if (jumpBtn) {
    const canJump = Boolean(lastAnchor && songPlayback.playerReady && songPlayback.player);
    jumpBtn.disabled = !canJump;
    jumpBtn.setAttribute("data-anchor-bar", lastAnchor ? String(lastAnchor.barIndex) : "");
    jumpBtn.setAttribute("data-anchor-time", lastAnchor ? String(lastAnchor.timeSec) : "");
  }
}

function setChartStartFromPlayback(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const now = currentPlaybackTime();
  if (!Number.isFinite(now)) return;
  const totalBars = exercise.songData.measures.length;
  const stride = songCalibrationStride();
  state.songCalibrationStride = stride;
  const baseline = baselineSongBarStarts(exercise);
  const anchors = { 0: Number(now.toFixed(2)) };
  const barStarts = interpolateSongBarStarts(totalBars, baseline, anchors);
  saveSongTimingOverride(exercise, { barStarts, anchors, stride });
  songPlayback.calibrationSongId = timingCalibrationContextId(exercise);
  songPlayback.calibrationNextBarIndex = nextAnchorIndex(0, totalBars, stride);
  songPlayback.activeMeasureIndex = 0;
  songPlayback.activeChordEventIndex = 0;
  renderPractice();
}

function tapNextBarFromPlayback(exercise) {
  if (!songHasStructuredChart(exercise)) return { ok: false, reason: "No song chart loaded." };
  const now = currentPlaybackTime();
  if (!Number.isFinite(now)) return { ok: false, reason: "No playback time yet. Press Play first." };
  const override = songTimingOverrideForExercise(exercise) || { barStarts: [], anchors: {}, stride: songCalibrationStride() };
  const stride = songCalibrationStride();
  state.songCalibrationStride = stride;
  const baseline = baselineSongBarStarts(exercise);
  const anchors = override.anchors && typeof override.anchors === "object" ? { ...override.anchors } : {};

  const calibrationContextId = timingCalibrationContextId(exercise);
  const anchorIndexes = Object.keys(anchors)
    .map((key) => Number.parseInt(key, 10))
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .sort((a, b) => a - b);
  const expectedWriteIndex = anchorIndexes.length
    ? nextAnchorIndex(anchorIndexes[anchorIndexes.length - 1], exercise.songData.measures.length, stride)
    : 0;
  if (songPlayback.calibrationSongId !== calibrationContextId) {
    songPlayback.calibrationSongId = calibrationContextId;
  }
  songPlayback.calibrationNextBarIndex = expectedWriteIndex;

  const total = exercise.songData.measures.length;
  const writeIndex = Math.max(0, Math.min(total, expectedWriteIndex));
  if (writeIndex >= total) return { ok: false, reason: "All bars already anchored." };
  const previousAnchorIndexes = Object.keys(anchors)
    .map((key) => Number.parseInt(key, 10))
    .filter((idx) => Number.isInteger(idx) && idx < writeIndex)
    .sort((a, b) => a - b);
  const previousAnchorIndex = previousAnchorIndexes.length ? previousAnchorIndexes[previousAnchorIndexes.length - 1] : null;
  const previousStart = Number.isInteger(previousAnchorIndex) ? Number(anchors[previousAnchorIndex]) : null;
  if (Number.isFinite(previousStart) && now <= previousStart) {
    return { ok: false, reason: "Tap ignored: playback moved backward before last anchor." };
  }

  anchors[writeIndex] = Number(now.toFixed(2));
  const barStarts = interpolateSongBarStarts(total, baseline, anchors);
  saveSongTimingOverride(exercise, { barStarts, anchors, stride });
  songPlayback.calibrationNextBarIndex = nextAnchorIndex(writeIndex, total, stride);
  songPlayback.activeMeasureIndex = writeIndex;
  const capturedMeasure = exercise.songData?.measures?.[writeIndex];
  const capturedEventIndex = getChordEventIndexForTime(capturedMeasure, now);
  songPlayback.activeChordEventIndex = capturedEventIndex;
  updateSongChartHighlight(exercise, writeIndex, capturedEventIndex, now);
  const keyboardExercise = buildSongMeasureExercise(exercise, writeIndex, capturedEventIndex);
  renderKeyboard(keyboardExercise);
  if (capturedMeasure) {
    const event = chordEventForMeasure(capturedMeasure, capturedEventIndex) || capturedMeasure;
    const eventCount = Array.isArray(capturedMeasure?.chordEvents) ? capturedMeasure.chordEvents.length : 1;
    const eventText = eventCount > 1 ? ` · Chord ${capturedEventIndex + 1}/${eventCount}` : "";
    const sequence = document.getElementById("noteSequence");
    if (sequence) {
      sequence.textContent =
        `Section: ${capturedMeasure.section || "Song"} (${capturedMeasure.formTag || "-"}) · Chord: ${compactChordSymbol(event?.chordDisplay || event?.chordSymbol)} (${event?.romanDisplay || event?.roman}) · ${event?.inversionLabel || "Root position"}${eventText}${(event?.lyric || capturedMeasure?.lyric) ? ` · Lyric: ${event?.lyric || capturedMeasure?.lyric}` : ""}`;
    }
  }
  renderPractice();
  return { ok: true, barIndex: writeIndex, timeSec: Number(now.toFixed(2)) };
}

function resetSongTimingCalibration(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const totalBars = exercise.songData.measures.length;
  const stride = songCalibrationStride();
  state.songCalibrationStride = stride;
  const baseline = baselineSongBarStarts(exercise);
  const barStarts = interpolateSongBarStarts(totalBars, baseline, {});
  saveSongTimingOverride(exercise, { barStarts, anchors: {}, stride });
  songPlayback.calibrationSongId = timingCalibrationContextId(exercise);
  songPlayback.calibrationNextBarIndex = 0;
  songPlayback.activeMeasureIndex = 0;
  songPlayback.activeChordEventIndex = 0;
  renderPractice();
}

function autoSeedSongTiming(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const totalBars = exercise.songData.measures.length;
  const stride = songCalibrationStride();
  state.songCalibrationStride = stride;
  const baseline = baselineSongBarStarts(exercise);
  const anchors = baseline.length ? { 0: Number(baseline[0]) } : {};
  const barStarts = interpolateSongBarStarts(totalBars, baseline, anchors);
  saveSongTimingOverride(exercise, { barStarts, anchors, stride });
  songPlayback.calibrationSongId = timingCalibrationContextId(exercise);
  songPlayback.calibrationNextBarIndex = nextAnchorIndex(0, totalBars, stride);
  songPlayback.activeMeasureIndex = 0;
  songPlayback.activeChordEventIndex = 0;
  renderPractice();
}

function fitRemainingSongTimingFromAnchors(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const totalBars = exercise.songData.measures.length;
  if (!totalBars) return;
  const stride = songCalibrationStride();
  state.songCalibrationStride = stride;
  const baseline = baselineSongBarStarts(exercise);
  const override = songTimingOverrideForExercise(exercise) || { barStarts: [], anchors: {}, stride };
  const anchors = override.anchors && typeof override.anchors === "object" ? { ...override.anchors } : {};
  const anchorRows = Object.entries(anchors)
    .map(([key, value]) => ({ idx: Number.parseInt(key, 10), time: Number(value) }))
    .filter((row) => Number.isInteger(row.idx) && row.idx >= 0 && row.idx < totalBars && Number.isFinite(row.time))
    .sort((a, b) => a.idx - b.idx);
  if (!anchorRows.length) return;

  const baseStarts = interpolateSongBarStarts(totalBars, baseline, anchors);
  const lastAnchor = anchorRows[anchorRows.length - 1];

  let secPerBar = 3.4;
  if (anchorRows.length >= 2) {
    const first = anchorRows[0];
    const spanBars = Math.max(1, lastAnchor.idx - first.idx);
    secPerBar = (lastAnchor.time - first.time) / spanBars;
  } else {
    const idx = lastAnchor.idx;
    const prev = idx > 0 ? Number(baseStarts[idx - 1]) : null;
    if (Number.isFinite(prev)) secPerBar = lastAnchor.time - prev;
    else if (Number.isFinite(Number(baseline[idx + 1])) && Number.isFinite(Number(baseline[idx]))) {
      secPerBar = Number(baseline[idx + 1]) - Number(baseline[idx]);
    }
  }
  if (!Number.isFinite(secPerBar) || secPerBar <= 0.2) secPerBar = 3.4;

  for (let i = lastAnchor.idx + 1; i < totalBars; i += 1) {
    baseStarts[i] = Number((lastAnchor.time + secPerBar * (i - lastAnchor.idx)).toFixed(2));
  }
  for (let i = 1; i < baseStarts.length; i += 1) {
    if (baseStarts[i] <= baseStarts[i - 1]) {
      baseStarts[i] = Number((baseStarts[i - 1] + 0.2).toFixed(2));
    }
  }

  saveSongTimingOverride(exercise, {
    barStarts: baseStarts,
    anchors,
    stride
  });
  songPlayback.calibrationSongId = timingCalibrationContextId(exercise);
  songPlayback.calibrationNextBarIndex = nextAnchorIndex(lastAnchor.idx, totalBars, stride);
  renderPractice();
}

function sortedSelectedArrangeBars() {
  return Array.from(new Set(state.songArrangeSelectedBars.filter((idx) => Number.isInteger(idx) && idx >= 0))).sort((a, b) => a - b);
}

function scrollSongBarIntoView(barIndex) {
  const chart = document.getElementById("songChart");
  const card = document.getElementById("songPracticeCard");
  if (!chart || !card || !Number.isInteger(barIndex) || barIndex < 0) return;
  const selector = `.song-measure[data-song-measure="${barIndex}"]`;
  requestAnimationFrame(() => {
    card.scrollIntoView({ block: "start", behavior: "smooth" });
    requestAnimationFrame(() => {
      const el = chart.querySelector(selector);
      if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
  });
}

function toggleArrangeBarSelection(index) {
  if (!Number.isInteger(index) || index < 0) return;
  if (state.songArrangeSelectedBars.includes(index)) {
    state.songArrangeSelectedBars = state.songArrangeSelectedBars.filter((value) => value !== index);
  } else {
    state.songArrangeSelectedBars = [...state.songArrangeSelectedBars, index];
  }
}

function mergeSelectedSongBars(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const selected = sortedSelectedArrangeBars();
  if (selected.length < 2) return;
  if (selected.length !== 2) return;
  if (selected[1] !== selected[0] + 1) return;

  const measures = exercise.songData.measures.map((measure) => sanitizeMeasureForOverride(measure));
  const left = measures[selected[0]];
  const right = measures[selected[1]];
  if (!left || !right) return;
  if ((left.section || "") !== (right.section || "")) return;

  const leftDuration = Math.max(0.2, Number(left.endSec || 0) - Number(left.startSec || 0) || 3.4);
  const rightDuration = Math.max(0.2, Number(right.endSec || 0) - Number(right.startSec || 0) || 3.4);
  const mergedDuration = Number(((leftDuration + rightDuration) / 2).toFixed(2));
  const leftPrimary = left.chordEvents?.[0] || { chord: left.chordSymbol || "C", roman: left.roman || "I", inversion: left.inversion || "root", lyric: left.lyric || "" };
  const rightPrimary = right.chordEvents?.[0] || { chord: right.chordSymbol || "C", roman: right.roman || "I", inversion: right.inversion || "root", lyric: right.lyric || "" };

  const merged = sanitizeMeasureForOverride({
    ...left,
    lyric: [left.lyric, right.lyric].filter(Boolean).join(" ").trim(),
    startSec: left.startSec,
    endSec: Number((Number(left.startSec || 0) + mergedDuration).toFixed(2)),
    chordEvents: [
      { ...leftPrimary, beatStart: 1, beatLength: 2 },
      { ...rightPrimary, beatStart: 3, beatLength: 2 }
    ]
  });

  const nextMeasures = [
    ...measures.slice(0, selected[0]),
    merged,
    ...measures.slice(selected[1] + 1)
  ];
  const timed = recalculateMeasureTimes(nextMeasures);
  const previousTiming = songTimingOverrideForExercise(exercise);
  const previousAnchors = previousTiming?.anchors && typeof previousTiming.anchors === "object"
    ? previousTiming.anchors
    : {};
  const remappedAnchors = remapAnchorsByTime(previousAnchors, timed);
  const stride = [1, 2, 4, 8].includes(Number(previousTiming?.stride))
    ? Number(previousTiming.stride)
    : songCalibrationStride();
  const baseline = timed.map((measure) => Number(measure.startSec || 0));
  const barStarts = interpolateSongBarStarts(timed.length, baseline, remappedAnchors);
  saveSongArrangementOverride(exercise, { measures: timed });
  saveSongTimingOverride(exercise, { barStarts, anchors: remappedAnchors, stride });
  state.songArrangeSelectedBars = [selected[0]];
  if (songPlayback.calibrationSongId === timingCalibrationContextId(exercise)) {
    const anchorIndexes = Object.keys(remappedAnchors)
      .map((key) => Number.parseInt(key, 10))
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < timed.length)
      .sort((a, b) => a - b);
    const lastAnchor = anchorIndexes.length ? anchorIndexes[anchorIndexes.length - 1] : 0;
    songPlayback.calibrationNextBarIndex = nextAnchorIndex(lastAnchor, timed.length, stride);
  }
  renderPractice();
}

function splitSelectedSongBar(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  const selected = sortedSelectedArrangeBars();
  if (selected.length !== 1) return;
  const index = selected[0];
  const measures = exercise.songData.measures.map((measure) => sanitizeMeasureForOverride(measure));
  const source = measures[index];
  if (!source) return;

  const duration = Math.max(0.4, Number(source.endSec || 0) - Number(source.startSec || 0) || 3.4);
  const half = Number((duration / 2).toFixed(2));
  const firstEvent = (source.chordEvents || []).find((event) => Number(event.beatStart || 1) < 3) || source.chordEvents?.[0];
  const secondEvent = (source.chordEvents || []).find((event) => Number(event.beatStart || 1) >= 3) || source.chordEvents?.[1] || firstEvent;
  if (!firstEvent || !secondEvent) return;

  const firstMeasure = sanitizeMeasureForOverride({
    ...source,
    lyric: firstEvent.lyric || source.lyric || "",
    startSec: source.startSec,
    endSec: Number((Number(source.startSec || 0) + half).toFixed(2)),
    chordEvents: [{ ...firstEvent, beatStart: 1, beatLength: 4 }]
  });
  const secondMeasure = sanitizeMeasureForOverride({
    ...source,
    lyric: secondEvent.lyric || "",
    startSec: Number((Number(source.startSec || 0) + half).toFixed(2)),
    endSec: Number(source.endSec || 0),
    chordEvents: [{ ...secondEvent, beatStart: 1, beatLength: 4 }]
  });

  const nextMeasures = [
    ...measures.slice(0, index),
    firstMeasure,
    secondMeasure,
    ...measures.slice(index + 1)
  ];
  const timed = recalculateMeasureTimes(nextMeasures);
  const previousTiming = songTimingOverrideForExercise(exercise);
  const previousAnchors = previousTiming?.anchors && typeof previousTiming.anchors === "object"
    ? previousTiming.anchors
    : {};
  const remappedAnchors = remapAnchorsByTime(previousAnchors, timed);
  const stride = [1, 2, 4, 8].includes(Number(previousTiming?.stride))
    ? Number(previousTiming.stride)
    : songCalibrationStride();
  const baseline = timed.map((measure) => Number(measure.startSec || 0));
  const barStarts = interpolateSongBarStarts(timed.length, baseline, remappedAnchors);
  saveSongArrangementOverride(exercise, { measures: timed });
  saveSongTimingOverride(exercise, { barStarts, anchors: remappedAnchors, stride });
  state.songArrangeSelectedBars = [index, index + 1];
  if (songPlayback.calibrationSongId === timingCalibrationContextId(exercise)) {
    const anchorIndexes = Object.keys(remappedAnchors)
      .map((key) => Number.parseInt(key, 10))
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < timed.length)
      .sort((a, b) => a - b);
    const lastAnchor = anchorIndexes.length ? anchorIndexes[anchorIndexes.length - 1] : 0;
    songPlayback.calibrationNextBarIndex = nextAnchorIndex(lastAnchor, timed.length, stride);
  }
  renderPractice();
}

function resetSongArrangement(exercise) {
  if (!songHasStructuredChart(exercise)) return;
  clearSongArrangementOverride(exercise);
  state.songArrangeSelectedBars = [];
  renderPractice();
}

function triggerSongSetChartStart() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  setChartStartFromPlayback(exercise);
  showToast("Chart start set to current playback time");
}

function triggerSongPlayAndSetStart() {
  const exercise = currentExercise();
  if (songHasStructuredChart(exercise)) {
    setChartStartFromPlayback(exercise);
    showToast("Bar 1 armed at current position");
  }
  if (songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.playVideo === "function") {
    ensureSongPlayerAudible();
    songPlayback.player.playVideo();
  }
}

function ensureSongPlayerAudible() {
  if (!songPlayback.playerReady || !songPlayback.player) return;
  try {
    if (typeof songPlayback.player.isMuted === "function" && songPlayback.player.isMuted() && typeof songPlayback.player.unMute === "function") {
      songPlayback.player.unMute();
    }
  } catch {
    // ignore player API errors
  }
}

function triggerSongTapNextBar() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) {
    showToast("No song chart loaded.");
    return;
  }
  const before = songTimingOverrideForExercise(exercise);
  const beforeCount = before?.anchors && typeof before.anchors === "object" ? Object.keys(before.anchors).length : 0;
  const result = tapNextBarFromPlayback(exercise);
  if (!result?.ok) {
    if (result?.reason) showToast(result.reason);
    return;
  }
  const after = songTimingOverrideForExercise(exercise);
  const afterCount = after?.anchors && typeof after.anchors === "object" ? Object.keys(after.anchors).length : 0;
  if (afterCount > beforeCount) {
    const rows = Object.keys(after.anchors).map((k) => Number.parseInt(k, 10)).filter((v) => Number.isInteger(v)).sort((a, b) => a - b);
    const last = rows.length ? rows[rows.length - 1] : null;
    const timeText = Number.isFinite(result?.timeSec) ? ` @ ${Number(result.timeSec).toFixed(2)}s` : "";
    showToast(last !== null ? `Anchor captured: Bar ${last + 1}${timeText}` : "Anchor captured");
  }
}

function triggerSongResetTiming() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  resetSongTimingCalibration(exercise);
  showToast("Timing overrides reset");
}

function triggerSongAutoSeedTiming() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  autoSeedSongTiming(exercise);
  showToast("Auto-seeded timing grid");
}

function triggerSongFitRemainingTiming() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  fitRemainingSongTimingFromAnchors(exercise);
  showToast("Filled remaining bars from anchor tempo");
}

function triggerSongJumpToLastAnchor() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  const override = songTimingOverrideForExercise(exercise);
  if (!override?.anchors || typeof override.anchors !== "object") {
    showToast("No anchors available");
    return;
  }
  const totalBars = exercise.songData.measures.length;
  const anchorRows = Object.entries(override.anchors)
    .map(([key, value]) => ({ barIndex: Number.parseInt(key, 10), timeSec: Number(value) }))
    .filter((row) => Number.isInteger(row.barIndex) && row.barIndex >= 0 && row.barIndex < totalBars && Number.isFinite(row.timeSec))
    .sort((a, b) => a.barIndex - b.barIndex);
  if (!anchorRows.length) {
    showToast("No anchors available");
    return;
  }
  const timingKey = timingOverrideStateKey(exercise);
  const timingSnapshot = JSON.stringify(state.songTimingOverrides?.[timingKey] || null);
  const lastAnchor = anchorRows[anchorRows.length - 1];
  songPlayback.activeMeasureIndex = lastAnchor.barIndex;
  songPlayback.activeChordEventIndex = 0;
  state.songArrangeSelectedBars = [lastAnchor.barIndex];
  if (songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.seekTo === "function") {
    songPlayback.player.seekTo(Number(lastAnchor.timeSec), true);
  }
  renderPractice();
  const timingAfter = JSON.stringify(state.songTimingOverrides?.[timingKey] || null);
  if (timingAfter !== timingSnapshot) {
    state.songTimingOverrides[timingKey] = timingSnapshot ? JSON.parse(timingSnapshot) : null;
    if (!state.songTimingOverrides[timingKey]) delete state.songTimingOverrides[timingKey];
    saveState();
    renderPractice();
  }
  scrollSongBarIntoView(lastAnchor.barIndex);
  showToast(`Jumped to Bar ${lastAnchor.barIndex + 1}`);
}

function clearSongAnchorsFromBar(exercise, fromBarOneBased) {
  if (!songHasStructuredChart(exercise)) return;
  const override = songTimingOverrideForExercise(exercise);
  if (!override?.anchors || typeof override.anchors !== "object") {
    showToast("No anchors to clear");
    return;
  }
  const totalBars = exercise.songData.measures.length;
  const fromIndex = Math.max(0, Math.min(totalBars - 1, Number(fromBarOneBased) - 1));
  const originalAnchors = Object.entries(override.anchors)
    .map(([key, value]) => ({ idx: Number.parseInt(key, 10), time: Number(value) }))
    .filter((row) => Number.isInteger(row.idx) && row.idx >= 0 && Number.isFinite(row.time));
  const originalCount = originalAnchors.length;
  const nextAnchors = Object.fromEntries(
    Object.entries(override.anchors)
      .map(([key, value]) => [Number.parseInt(key, 10), Number(value)])
      .filter(([idx, time]) => Number.isInteger(idx) && idx >= 0 && idx < fromIndex && Number.isFinite(time))
      .map(([idx, time]) => [String(idx), time])
  );
  const stride = [1, 2, 4, 8].includes(Number(override.stride)) ? Number(override.stride) : songCalibrationStride();
  const baseline = baselineSongBarStarts(exercise);
  const barStarts = interpolateSongBarStarts(totalBars, baseline, nextAnchors);
  saveSongTimingOverride(exercise, { barStarts, anchors: nextAnchors, stride });
  const remainingAnchorIndexes = Object.keys(nextAnchors)
    .map((key) => Number.parseInt(key, 10))
    .filter((idx) => Number.isInteger(idx) && idx >= 0)
    .sort((a, b) => a - b);
  const lastAnchor = remainingAnchorIndexes.length ? remainingAnchorIndexes[remainingAnchorIndexes.length - 1] : 0;
  songPlayback.calibrationSongId = timingCalibrationContextId(exercise);
  songPlayback.calibrationNextBarIndex = remainingAnchorIndexes.length
    ? nextAnchorIndex(lastAnchor, totalBars, stride)
    : 0;
  songPlayback.activeMeasureIndex = lastAnchor;
  songPlayback.activeChordEventIndex = 0;
  state.songArrangeSelectedBars = [lastAnchor];
  renderPractice();
  scrollSongBarIntoView(lastAnchor);
  const nextCount = Object.keys(nextAnchors).length;
  const removed = Math.max(0, originalCount - nextCount);
  showToast(removed > 0
    ? `Cleared ${removed} anchor${removed === 1 ? "" : "s"} from Bar ${fromIndex + 1}+`
    : `No anchors found at/after Bar ${fromIndex + 1}`);
}

function triggerSongMergeSelectedBars() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  const selected = sortedSelectedArrangeBars();
  if (selected.length !== 2 || selected[1] !== selected[0] + 1) {
    showToast("Select exactly 2 adjacent bars to merge");
    return;
  }
  const measures = exercise.songData.measures;
  if ((measures[selected[0]]?.section || "") !== (measures[selected[1]]?.section || "")) {
    showToast("Merged bars must be in the same section");
    return;
  }
  mergeSelectedSongBars(exercise);
  showToast(`Merged Bars ${selected[0] + 1}-${selected[1] + 1}`);
}

function triggerSongSplitSelectedBar() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  const selected = sortedSelectedArrangeBars();
  if (selected.length !== 1) {
    showToast("Select exactly 1 bar to split");
    return;
  }
  splitSelectedSongBar(exercise);
  showToast(`Split Bar ${selected[0] + 1}`);
}

function triggerSongResetArrangement() {
  const exercise = currentExercise();
  if (!songHasStructuredChart(exercise)) return;
  resetSongArrangement(exercise);
  showToast("Arrangement reset to base chart");
}

async function analyzeAndApplyChordsForBar(exercise, barIndex) {
  if (!songHasStructuredChart(exercise)) return;
  const measures = exercise.songData.measures.map((measure) => sanitizeMeasureForOverride(measure));
  const bounded = Math.max(0, Math.min(measures.length - 1, Number(barIndex) || 0));
  const measure = measures[bounded];
  if (!measure) return;
  const beatsPerBar = beatsPerBarFromTimeSignature(measure.sectionTimeSignature || exercise.songData.timeSignature || "4/4");
  const startSec = Number(measure.startSec || 0);
  const endSec = Number(measure.endSec || startSec + 3.4);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
    showToast("Bar timing is invalid. Set timing anchors first.");
    return;
  }

  const response = await fetch("/api/song/analyze-bar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      songId: exercise.songData?.id || "let-it-be",
      startSec,
      endSec,
      beatsPerBar
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !Array.isArray(payload?.events) || !payload.events.length) {
    throw new Error(String(payload?.message || "No chord events detected for this bar"));
  }

  const existingLyric = String(measure.lyric || "");
  measure.chordEvents = payload.events.map((event, idx) => ({
    chord: String(event?.chord || "C"),
    roman: romanForChordInC(event?.chord || "C"),
    inversion: String(event?.chord || "").includes("/") ? "inversion" : "root",
    lyric: idx === 0 ? existingLyric : "",
    beatStart: Number(event?.beatStart || idx + 1),
    beatLength: Number(event?.beatLength || 1)
  }));
  measure.lyric = existingLyric;
  hydrateSongMeasureTiming(measure, measure.sectionTimeSignature || exercise.songData.timeSignature || "4/4");

  saveSongArrangementOverride(exercise, { measures });
  state.songArrangeSelectedBars = [bounded];
  songPlayback.activeMeasureIndex = bounded;
  songPlayback.activeChordEventIndex = 0;
  renderPractice();
  showToast(`Chord analysis applied to Bar ${bounded + 1}`);
}

window.onYouTubeIframeAPIReady = () => {
  const pending = songPlayback.pendingSongData;
  if (pending) {
    createYouTubePlayer(pending);
    songPlayback.pendingSongData = null;
  }
};

function renderSongPractice(exercise) {
  const chartCard = document.getElementById("songPracticeCard");
  const infoCard = document.getElementById("songInfoCard");
  if (!chartCard) return;
  if (!songHasStructuredChart(exercise)) {
    chartCard.classList.add("hidden");
    if (infoCard) infoCard.classList.add("hidden");
    return;
  }

  if (!state.songArrangeAccess && state.songTrainerMode === "arrange") {
    state.songTrainerMode = "play";
  }
  const song = exercise.songData;
  chartCard.classList.remove("hidden");
  const canArrange = Boolean(state.songArrangeAccess);
  const isArrangeMode = canArrange && state.songTrainerMode === "arrange";
  const isMinimalPlayalong = !isArrangeMode && songPlayback.videoPlaying && state.songPlayalongFocus;
  if (infoCard) {
    const hideInfoCard = isMinimalPlayalong && !state.songShowVideoInPlayMode;
    infoCard.classList.toggle("hidden", hideInfoCard);
    infoCard.classList.toggle("song-play-mode", !isArrangeMode);
    infoCard.classList.toggle("song-arrange-mode", isArrangeMode);
  }
  chartCard.classList.toggle("song-play-mode", !isArrangeMode);
  chartCard.classList.toggle("song-arrange-mode", isArrangeMode);
  document.getElementById("songTitle").textContent = song.title || "Song";
  document.getElementById("songArtist").textContent = song.artist || "Unknown artist";
  document.getElementById("songKeyMeta").textContent = `Key: ${song.songKey || "n/a"}`;
  document.getElementById("songTimeSignatureMeta").textContent = `Time Signature: ${song.timeSignature || "n/a"}`;
  document.getElementById("songProgressionMeta").textContent = `Progression: ${song.romanProgression || "n/a"}`;
  document.getElementById("songInfoArrangementMeta").textContent = `Arrangement: ${arrangementSummary(song)}`;
  document.getElementById("songArrangementSourceMeta").textContent =
    `Arrangement Source: ${song.arrangementSource?.label || "n/a"}`;
  renderSongSourceSelector(song);
  const sourceControl = document.getElementById("songSourceVersionControl");
  if (sourceControl) {
    sourceControl.classList.toggle("hidden", !canArrange);
  }
  document.getElementById("songCredits").textContent = Array.isArray(song.credits) && song.credits.length
    ? `Credits: ${song.credits.join(" · ")}`
    : "Credits: n/a";
  const modeRow = document.getElementById("songModeButtons");
  if (modeRow) {
    modeRow.classList.toggle("hidden", isMinimalPlayalong || !canArrange);
    modeRow.querySelectorAll("button[data-song-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.songMode === state.songTrainerMode);
    });
  }
  const arrangeTools = document.getElementById("songArrangeTools");
  if (arrangeTools) {
    arrangeTools.classList.toggle("hidden", !isArrangeMode || !canArrange);
  }
  const tapFab = document.getElementById("songTapNextBarFab");
  if (tapFab) {
    const showFab = isArrangeMode && state.screen === "practice" && state.block === "song";
    tapFab.classList.toggle("hidden", !showFab);
  }
  const playBtn = document.getElementById("songPlayBtn");
  const pauseBtn = document.getElementById("songPauseBtn");
  const playBtnArrange = document.getElementById("songPlayBtnArrange");
  const pauseBtnArrange = document.getElementById("songPauseBtnArrange");
  if (playBtn && pauseBtn) {
    const showTransport = isArrangeMode || (!isArrangeMode && state.songPlayalongFocus);
    playBtn.classList.toggle("hidden", !showTransport);
    pauseBtn.classList.toggle("hidden", !showTransport);
    const canControl = Boolean(songPlayback.playerReady && songPlayback.player);
    playBtn.disabled = !canControl;
    pauseBtn.disabled = !canControl;
    if (playBtnArrange && pauseBtnArrange) {
      playBtnArrange.classList.toggle("hidden", !isArrangeMode);
      pauseBtnArrange.classList.toggle("hidden", !isArrangeMode);
      playBtnArrange.disabled = !canControl;
      pauseBtnArrange.disabled = !canControl;
    }
  }
  const toggleVideoBtn = document.getElementById("songToggleVideoBtn");
  if (toggleVideoBtn) {
    const showToggle = !isArrangeMode && state.songPlayalongFocus && songPlayback.videoPlaying;
    toggleVideoBtn.classList.toggle("hidden", !showToggle);
    toggleVideoBtn.textContent = state.songShowVideoInPlayMode ? "Hide Video" : "Show Video";
  }
  const focusModeBtn = document.getElementById("songFocusModeBtn");
  if (focusModeBtn) {
    focusModeBtn.classList.toggle("hidden", isArrangeMode);
    focusModeBtn.textContent = state.songPlayalongFocus ? "Exit Playback Mode" : "Enter Playback Mode";
  }
  renderSongCalibrationMeta(exercise);
  renderSongArrangeScrubber(exercise);
  renderSongArrangementMeta(exercise);
  renderSongLyricsEditor(exercise);
  renderSongSectionEditor(exercise);

  const activeIndex = songPlayback.videoPlaying
    ? Math.max(-1, Math.min(song.measures.length - 1, songPlayback.activeMeasureIndex))
    : -1;
  const activeEventIndex = songPlayback.videoPlaying
    ? Math.max(0, songPlayback.activeChordEventIndex || 0)
    : -1;
  const timingOverride = songTimingOverrideForExercise(exercise);
  const anchoredBarSet = new Set(
    timingOverride?.anchors && typeof timingOverride.anchors === "object"
      ? Object.keys(timingOverride.anchors)
        .map((key) => Number.parseInt(key, 10))
        .filter((idx) => Number.isInteger(idx) && idx >= 0)
      : []
  );
  const sectionGroups = groupedSongMeasures(song);
  document.getElementById("songChart").innerHTML = sectionGroups.map((group) => `
    <section class="song-section-block">
      <header class="song-section-header">
        <h4>${group.section}</h4>
        <p>${group.formTag || "Section"}${group.sectionTimeSignature ? ` · ${group.sectionTimeSignature}` : ""}${group.sectionKeySignature ? ` · ${group.sectionKeySignature}` : ""}</p>
      </header>
      <div class="song-chart-grid">
        ${group.rows.map(({ measure, index }) => `
          <article class="song-measure ${index === activeIndex ? "active" : ""} ${state.songArrangeSelectedBars.includes(index) ? "selected-arrange" : ""} ${isArrangeMode && index === songPlayback.activeMeasureIndex ? "playhead-arrange" : ""} ${isArrangeMode && anchoredBarSet.has(index) ? "anchored-arrange" : ""}" data-song-measure="${index}">
            <div class="song-bar-row">
              <p class="song-bar">Bar ${index + 1}</p>
              ${isArrangeMode ? `<button class="btn outlined song-analyze-bar-btn" type="button" data-action="song-analyze-bar" data-song-measure="${index}">Get Chords</button>` : ""}
            </div>
            ${(() => {
              const displayEvent = chordEventForMeasure(measure, index === activeIndex ? activeEventIndex : 0) || measure;
              const events = Array.isArray(measure.chordEvents) && measure.chordEvents.length ? measure.chordEvents : [measure];
              return `
                <div class="song-chord-events-inline">
                  ${events.map((event, eventIndex) => `
                    <button
                      class="song-chord-event-chip ${(index === activeIndex && activeEventIndex === eventIndex) ? "active" : ""}"
                      data-song-measure="${index}"
                      data-song-event="${eventIndex}"
                      type="button"
                      title="Bar ${index + 1} ${chordEventBeatLabel(event)}"
                    >
                      ${compactChordSymbol(event.chordDisplay || event.chordSymbol)}
                    </button>
                  `).join("")}
                </div>
                <p class="song-event-meta">${displayEvent.romanDisplay || displayEvent.roman} · ${displayEvent.inversionLabel || "Root position"}</p>
                <p class="song-event-beats">${chordEventBeatLabel(displayEvent)}</p>
                <div class="song-measure-staff">${renderSongMeasureStaff(measure, index === activeIndex ? activeEventIndex : -1)}</div>
                <p class="song-lyric">${displayEvent.lyric || measure.lyric || "&nbsp;"}</p>
              `;
            })()}
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");
  renderSongMeasureNotationNodes();

  ensureSongPlayer(song);
}

function renderPractice() {
  const exercise = applyInversionStepMode(applyChordStepMode(applyScaleMode(currentExercise())));
  const isTechniqueLesson = state.block === "technique";
  const isSongLesson = !isTechniqueLesson;
  if (isSongLesson && !state.songArrangeAccess && state.songTrainerMode !== "play") {
    state.songTrainerMode = "play";
  }
  const isArpeggioLesson = isTechniqueLesson && exercise?.moduleId === "arpeggios";
  const isBothHandsArpeggio = isArpeggioLesson && state.arpeggioMode === "both";
  const isScaleLesson = isTechniqueLesson && exercise?.moduleId === "scales";
  const isTriadLesson = isTechniqueLesson && exercise?.moduleId === "chords";
  const isInversionLesson = isTechniqueLesson && exercise?.moduleId === "inversions";
  const isSongArrangeMode = isSongLesson && state.songTrainerMode === "arrange";
  const isSongMinimalPlayalong = isSongLesson && !isSongArrangeMode && songPlayback.videoPlaying && state.songPlayalongFocus;
  const rootFingerMeta = document.getElementById("rootFingerMeta");
  const practiceStaffCard = document.getElementById("practiceStaffCard");
  const practiceHeaderCard = document.getElementById("practiceHeaderCard");
  const songPracticeCard = document.getElementById("songPracticeCard");
  const songInfoCard = document.getElementById("songInfoCard");
  const keyboardCard = document.getElementById("practiceKeyboardCard");
  const practiceControlsCard = document.getElementById("practiceControlsCard");
  document.getElementById("blockLabel").textContent =
    isTechniqueLesson ? `${keyLabel(state.selectedKey)} Technique` : `${keyLabel(state.selectedKey)} Song`;
  document.getElementById("exerciseTitle").textContent = exercise.title;
  document.getElementById("exerciseMeta").textContent = exercise.meta;
  document.getElementById("exerciseHint").textContent = isBothHandsArpeggio
    ? `${exercise.hint} Meeting note rule: play both thumbs together (1+1).`
    : exercise.hint;
  document.getElementById("timerText").textContent = formatTime(state.blockSecondsRemaining);
  document.getElementById("pauseTimerBtn").textContent = state.timerRunning ? "Pause" : "Resume";

  if (practiceStaffCard) {
    practiceStaffCard.classList.toggle("hidden", !isTechniqueLesson);
  }
  if (songPracticeCard) {
    songPracticeCard.classList.toggle("hidden", !isSongLesson);
  }
  if (songInfoCard && !isSongLesson) {
    songInfoCard.classList.add("hidden");
  }
  if (keyboardCard) {
    keyboardCard.classList.toggle("hidden", isSongArrangeMode);
    keyboardCard.classList.toggle("song-play-keyboard", isSongLesson && !isSongArrangeMode);
  }
  if (practiceHeaderCard) {
    practiceHeaderCard.classList.toggle("hidden", isSongMinimalPlayalong);
  }
  if (practiceControlsCard) {
    practiceControlsCard.classList.toggle("hidden", isSongMinimalPlayalong);
  }
  renderArpeggioModes(isArpeggioLesson);
  renderScaleModes(isScaleLesson);
  renderScaleHands(isScaleLesson);
  renderScaleDirections(isScaleLesson);
  renderTriadModes(isTriadLesson, exercise);
  renderInversionModes(isInversionLesson, exercise);

  const keyboardExercise = (isSongLesson && songHasStructuredChart(exercise))
    ? buildSongMeasureExercise(exercise, songPlayback.activeMeasureIndex, songPlayback.activeChordEventIndex)
    : exercise;
  renderKeyboard(keyboardExercise);
  if (isTechniqueLesson) {
    renderStaffSVG(exercise.notes, "staff", false, exercise.handAssignments || null);
  }
  if (isSongLesson && songHasStructuredChart(exercise)) {
    renderSongPractice(exercise);
    startSongFollowAlongPoll();
    syncSongFollowAlong(exercise, true);
  } else {
    stopSongFollowAlongPoll();
    document.getElementById("songFollowMeta").textContent = "Waiting for playback.";
  }
  document.getElementById("noteSequence").textContent = isSongLesson && songHasStructuredChart(exercise)
    ? document.getElementById("noteSequence").textContent
    : `Notes: ${exercise.notes.map(displayPitchOnly).join(" - ")}`;
  trackLessonView(exercise);

  if (rootFingerMeta) {
    const showRootMeta = (isInversionLesson || isTriadLesson)
      && exercise?.rootPitch
      && Number.isFinite(exercise?.rootFingerLH)
      && Number.isFinite(exercise?.rootFingerRH);
    if (showRootMeta) {
      rootFingerMeta.classList.remove("hidden");
      rootFingerMeta.textContent = `Root note: ${exercise.rootPitch} · LH root finger: ${exercise.rootFingerLH} · RH root finger: ${exercise.rootFingerRH}`;
    } else {
      rootFingerMeta.classList.add("hidden");
      rootFingerMeta.textContent = "";
    }
  }
}

function renderKeyboard(exercise) {
  const activeNotes = new Set(exercise.notes.map((note) => String(note).trim()));
  const rootNotes = Array.isArray(exercise?.rootNotes) ? exercise.rootNotes.map((note) => String(note).trim()) : [];
  const rootHands = Array.isArray(exercise?.rootHands) ? exercise.rootHands : [];
  const rootStateByNote = new Map();
  rootNotes.forEach((note, idx) => {
    const hand = rootHands[idx] || null;
    const entry = rootStateByNote.get(note) || { hasLH: false, hasRH: false };
    if (hand === "LH") entry.hasLH = true;
    if (hand === "RH") entry.hasRH = true;
    rootStateByNote.set(note, entry);
  });
  const handAssignments = Array.isArray(exercise.handAssignments) ? exercise.handAssignments : [];
  const noteStateByNote = new Map();

  exercise.notes.forEach((note, idx) => {
    const key = String(note).trim();
    const hand = handAssignments[idx] || null;
    const finger = Number.isFinite(exercise.fingering[idx]) ? exercise.fingering[idx] : null;
    const entry = noteStateByNote.get(key) || {
      lhFinger: null,
      rhFinger: null,
      genericFinger: null,
      hasLH: false,
      hasRH: false
    };

    if (hand === "LH") {
      entry.hasLH = true;
      if (entry.lhFinger === null) entry.lhFinger = finger;
    } else if (hand === "RH") {
      entry.hasRH = true;
      if (entry.rhFinger === null) entry.rhFinger = finger;
    } else if (entry.genericFinger === null) {
      entry.genericFinger = finger;
    }
    noteStateByNote.set(key, entry);
  });

  function fingerBadgesHtml(stateForKey) {
    if (!stateForKey) return "";
    if (stateForKey.hasLH && stateForKey.hasRH) {
      return `
        ${stateForKey.lhFinger !== null ? `<span class="key-finger lh dual-top">${stateForKey.lhFinger}</span>` : ""}
        ${stateForKey.rhFinger !== null ? `<span class="key-finger rh dual-bottom">${stateForKey.rhFinger}</span>` : ""}
      `;
    }
    if (stateForKey.hasLH) {
      return stateForKey.lhFinger !== null ? `<span class="key-finger lh">${stateForKey.lhFinger}</span>` : "";
    }
    if (stateForKey.hasRH) {
      return stateForKey.rhFinger !== null ? `<span class="key-finger rh">${stateForKey.rhFinger}</span>` : "";
    }
    return stateForKey.genericFinger !== null ? `<span class="key-finger">${stateForKey.genericFinger}</span>` : "";
  }

  function activeClassForState(stateForKey) {
    if (!stateForKey) return "";
    if (stateForKey.hasLH && stateForKey.hasRH) return "active-both";
    if (stateForKey.hasLH) return "active-lh";
    if (stateForKey.hasRH) return "active-rh";
    if (stateForKey.genericFinger !== null) return "active";
    return "";
  }

  function rootClassForState(rootState) {
    if (!rootState) return "";
    if (rootState.hasLH && rootState.hasRH) return "root-note-both";
    if (rootState.hasLH) return "root-note-lh";
    if (rootState.hasRH) return "root-note-rh";
    return "root-note";
  }

  const whiteKeyIndexByNote = new Map();
  let whiteIndex = 0;
  for (const note of KEYBOARD_NOTES) {
    if (!note.includes("#")) {
      whiteKeyIndexByNote.set(note, whiteIndex);
      whiteIndex += 1;
    }
  }

  const whiteKeysHtml = WHITE_KEY_NOTES.map((note) => {
    const active = activeNotes.has(note);
    const stateForKey = noteStateByNote.get(note) || null;
    const rootState = rootStateByNote.get(note) || null;
    const label = /^C\d$/.test(note) || note === "A0" || note === "C8" ? note : "";
    return `
      <div class="piano-white-key ${active ? activeClassForState(stateForKey) : ""} ${rootClassForState(rootState)}">
        ${active ? fingerBadgesHtml(stateForKey) : ""}
        ${label ? `<span class="key-label">${label}</span>` : ""}
      </div>
    `;
  }).join("");

  const blackKeysHtml = KEYBOARD_NOTES
    .filter((note) => note.includes("#"))
    .map((note) => {
      const anchorWhite = note.replace("#", "");
      const anchorIndex = whiteKeyIndexByNote.get(anchorWhite);
      if (!Number.isInteger(anchorIndex)) return "";

      const leftPct = ((anchorIndex + 1) / WHITE_KEY_NOTES.length) * 100;
      const active = activeNotes.has(note);
      const stateForKey = noteStateByNote.get(note) || null;
      const rootState = rootStateByNote.get(note) || null;
      return `
        <div class="piano-black-key ${active ? activeClassForState(stateForKey) : ""} ${rootClassForState(rootState)}" style="left:${leftPct.toFixed(6)}%">
          ${active ? fingerBadgesHtml(stateForKey) : ""}
        </div>
      `;
    })
    .join("");

  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = `
    <div class="white-keys" aria-hidden="true">${whiteKeysHtml}</div>
    <div class="black-keys" aria-hidden="true">${blackKeysHtml}</div>
  `;
}

function parseNote(note) {
  const match = String(note).match(/^([A-G])(#?)(\d)$/);
  if (!match) return null;
  return { letter: match[1], sharp: Boolean(match[2]), octave: Number(match[3]) };
}

function diatonicIndex(note) {
  const parsed = parseNote(note);
  if (!parsed) return null;
  const order = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  return parsed.octave * 7 + order[parsed.letter];
}

function noteY(note) {
  const index = diatonicIndex(note);
  if (index === null) return 100;
  const c2Index = 2 * 7;
  return 94 - (index - c2Index) * 3;
}

function renderStaffSVG(notes, targetId, annotate, handAssignments = null) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const isReferenceStaff = targetId === "keyStaffMap";
  const isPracticeStaff = targetId === "staff";
  const stepX = isPracticeStaff ? 84 : 60;
  const leftPad = isPracticeStaff ? 122 : 78;
  const width = Math.max(isPracticeStaff ? 940 : 560, leftPad + 120 + notes.length * stepX);
  const treble = [22, 28, 34, 40, 46];
  const bass = [58, 64, 70, 76, 82];

  const lines = [...treble, ...bass]
    .map((y) => `<line x1="24" y1="${y}" x2="${width - 24}" y2="${y}" stroke="#5d6b80" stroke-width="1.45" />`)
    .join("");

  const middleC = `<line x1="${width / 2 - 18}" y1="52" x2="${width / 2 + 18}" y2="52" stroke="#5d6b80" stroke-width="1.35" />`;
  const clefFontSize = isReferenceStaff ? 40 : 34;
  const bassClefFontSize = isReferenceStaff ? 37 : 31;
  const trebleY = isReferenceStaff ? 44 : 42;
  const bassY = isReferenceStaff ? 83 : 79;
  const clefs = `
    <text x="32" y="${trebleY}" font-size="${clefFontSize}" font-weight="400" font-family="'Segoe UI Symbol','Arial Unicode MS',serif" fill="#2f4764">𝄞</text>
    <text x="32" y="${bassY}" font-size="${bassClefFontSize}" font-weight="400" font-family="'Segoe UI Symbol','Arial Unicode MS',serif" fill="#2f4764">𝄢</text>
  `;
  const hasLH = Array.isArray(handAssignments) && handAssignments.includes("LH");
  const hasRH = Array.isArray(handAssignments) && handAssignments.includes("RH");
  const showLegend = hasLH && hasRH;
  const legend = showLegend ? `
    <circle cx="${width - 148}" cy="12" r="4" fill="#206cc8"></circle>
    <text x="${width - 140}" y="15" font-size="10" fill="#1f3f63">LH</text>
    <circle cx="${width - 108}" cy="12" r="4" fill="#d97706"></circle>
    <text x="${width - 100}" y="15" font-size="10" fill="#6b3f00">RH</text>
  ` : "";

  function ledgerLinesForY(y) {
    const lines = [];

    if (y < 22) {
      for (let lineY = 16; lineY >= y; lineY -= 6) {
        lines.push(lineY);
      }
      return lines;
    }

    if (y > 82) {
      for (let lineY = 88; lineY <= y; lineY += 6) {
        lines.push(lineY);
      }
      return lines;
    }

    if (y === 52) {
      lines.push(52);
    }

    return lines;
  }

  const noteNodes = notes
    .map((note, idx) => {
      let clusterOffset = 0;
      if (Array.isArray(handAssignments) && idx > 0) {
        for (let i = 1; i <= idx; i += 1) {
          const prev = handAssignments[i - 1];
          const curr = handAssignments[i];
          if (prev && curr && prev !== curr) {
            clusterOffset += 14;
          }
        }
      }

      const x = leftPad + idx * stepX + clusterOffset;
      const y = noteY(note);
      const label = annotate ? note : "";
      const hand = Array.isArray(handAssignments) ? handAssignments[idx] : null;
      const fill = hand === "LH" ? "#206cc8" : hand === "RH" ? "#d97706" : "#205fa6";
      const noteRx = isReferenceStaff ? 5.6 : 7;
      const noteRy = isReferenceStaff ? 4.1 : 5;
      const ledger = ledgerLinesForY(y)
        .map((lineY) => `<line x1="${x - 12}" y1="${lineY}" x2="${x + 12}" y2="${lineY}" stroke="#445267" stroke-width="1.1" />`)
        .join("");
      return `
        ${ledger}
        <ellipse cx="${x}" cy="${y}" rx="${noteRx}" ry="${noteRy}" fill="${fill}" />
        ${label ? `<text x="${x}" y="106" text-anchor="middle" font-size="10" fill="#334155">${label}</text>` : ""}
      `;
    })
    .join("");

  target.innerHTML = `
    <svg viewBox="0 0 ${width} 112" role="img" aria-label="Grand staff">
      ${lines}
      ${middleC}
      ${clefs}
      ${legend}
      ${noteNodes}
    </svg>
  `;
}

function markCurrentExerciseDone() {
  const exercise = currentExercise();
  if (!state.completedExerciseIds.includes(exercise.id)) {
    state.completedExerciseIds.push(exercise.id);
  }

  const progress = currentKeyProgress();
  progress.modules[exercise.moduleId] = true;
  saveState();
  renderLessons();
  renderCircle();
}

function moveExercise(delta) {
  const curriculum = currentCurriculum();
  if (state.block === "technique") {
    const total = curriculum.technique.length;
    state.techniqueIndex = (state.techniqueIndex + delta + total) % total;
    state.chordStepIndex = 0;
    state.inversionStepIndex = 0;
  } else {
    const total = curriculum.songs.length;
    state.songIndex = (state.songIndex + delta + total) % total;
    songPlayback.activeMeasureIndex = 0;
    songPlayback.activeChordEventIndex = 0;
    state.songArrangeSelectedBars = [];
  }
  renderPractice();
}

function beginBlock(blockName, index = 0) {
  state.block = blockName;
  if (blockName === "technique") state.techniqueIndex = index;
  if (blockName === "song") {
    state.songIndex = index;
    state.songArrangeAccess = false;
    state.songTrainerMode = "play";
    state.songPlayalongFocus = false;
    state.songShowVideoInPlayMode = false;
    songPlayback.videoPlaying = false;
    songPlayback.activeMeasureIndex = 0;
    songPlayback.activeChordEventIndex = 0;
    state.songArrangeSelectedBars = [];
  }
  state.chordStepIndex = 0;
  state.inversionStepIndex = 0;
  renderPractice();
  showScreen("practice");
}

function tickTimer() {
  if (!state.timerRunning) return;
  state.blockSecondsRemaining += 1;
  addPracticeSecond();
  renderSessionTimerControls();
  if (state.screen === "practice") {
    document.getElementById("timerText").textContent = formatTime(state.blockSecondsRemaining);
  }
  if (state.screen === "history") {
    renderHistory();
  }
  renderGlobalMeta();
  saveState();
}

function toggleTimer() {
  state.timerRunning = !state.timerRunning;
  if (state.timerRunning) {
    state.timerSessionActive = true;
  }
  renderSessionTimerControls();
  renderPractice();
}

function startSessionTimer() {
  state.timerRunning = true;
  state.timerSessionActive = true;
  renderSessionTimerControls();
  renderPractice();
}

function pauseSessionTimer() {
  state.timerRunning = false;
  renderSessionTimerControls();
  renderPractice();
  saveState();
}

function resetSessionTimer() {
  state.timerRunning = false;
  state.timerSessionActive = false;
  state.blockSecondsRemaining = 0;
  renderSessionTimerControls();
  renderPractice();
  renderGlobalMeta();
  saveState();
}

function openLessonsForKey(keyName) {
  state.selectedKey = keyName;
  saveState();
  renderLessons();
  showScreen("lessons");
  renderNav();
}

function wireEvents() {
  document.getElementById("navCircleBtn").addEventListener("click", () => {
    state.songArrangeAccess = false;
    showScreen("circle");
    renderNav();
  });
  document.getElementById("navLessonsBtn").addEventListener("click", () => {
    state.songArrangeAccess = false;
    showScreen("lessons");
    renderLessons();
    renderNav();
  });
  document.getElementById("navAdminBtn").addEventListener("click", () => {
    showScreen("admin");
    renderAdmin();
    renderNav();
  });
  document.getElementById("navHistoryBtn").addEventListener("click", () => {
    state.songArrangeAccess = false;
    showScreen("history");
    renderHistory();
    renderNav();
  });

  document.getElementById("circleOfFifths").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-key]");
    if (!btn) return;
    openLessonsForKey(btn.dataset.key);
  });

  document.getElementById("backToCircleBtn").addEventListener("click", () => {
    renderCircle();
    renderGlobalMeta();
    showScreen("circle");
    renderNav();
  });

  document.getElementById("toggleKeyCompleteBtn").addEventListener("click", () => {
    const progress = currentKeyProgress();
    progress.completed = !progress.completed;
    saveState();
    renderLessons();
    renderCircle();
  });

  document.getElementById("sessionStartBtn").addEventListener("click", startSessionTimer);
  document.getElementById("sessionPauseBtn").addEventListener("click", pauseSessionTimer);
  document.getElementById("sessionResetBtn").addEventListener("click", resetSessionTimer);

  document.getElementById("lessonExerciseList").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action='start-lesson']");
    if (!btn) return;
    state.sessionMode = "custom";
    const block = btn.dataset.block === "song" ? "song" : "technique";
    const index = Number.parseInt(btn.dataset.index || "0", 10) || 0;
    beginBlock(block, index);
  });

  document.getElementById("arpeggioModeButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-arpeggio-mode]");
    if (!btn) return;
    const nextMode = btn.dataset.arpeggioMode || "";
    if (!ARPEGGIO_MODES.some((mode) => mode.id === nextMode)) return;
    state.arpeggioMode = nextMode;
    saveState();
    renderPractice();
  });

  document.getElementById("scaleModeButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-scale-mode]");
    if (!btn) return;
    const nextMode = btn.dataset.scaleMode || "";
    if (!SCALE_MODES.some((mode) => mode.id === nextMode)) return;
    state.scaleMode = nextMode;
    saveState();
    renderPractice();
  });

  document.getElementById("scaleHandButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-scale-hand]");
    if (!btn) return;
    const nextHand = btn.dataset.scaleHand || "";
    if (!SCALE_HANDS.some((mode) => mode.id === nextHand)) return;
    state.scaleHand = nextHand;
    saveState();
    renderPractice();
  });

  document.getElementById("scaleDirectionButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-scale-direction]");
    if (!btn) return;
    const nextDirection = btn.dataset.scaleDirection || "";
    if (!SCALE_DIRECTIONS.some((mode) => mode.id === nextDirection)) return;
    state.scaleDirection = nextDirection;
    saveState();
    renderPractice();
  });

  document.getElementById("triadModeButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-triad-step]");
    if (!btn) return;
    const step = Number.parseInt(btn.dataset.triadStep || "", 10);
    if (!Number.isInteger(step)) return;
    state.chordStepIndex = Math.max(0, step);
    renderPractice();
  });

  document.getElementById("inversionModeButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-inversion-step]");
    if (!btn) return;
    const step = Number.parseInt(btn.dataset.inversionStep || "", 10);
    if (!Number.isInteger(step)) return;
    state.inversionStepIndex = Math.max(0, step);
    renderPractice();
  });

  document.getElementById("songChart").addEventListener("click", (event) => {
    const analyzeBtn = event.target.closest("button[data-action='song-analyze-bar'][data-song-measure]");
    if (analyzeBtn) {
      const exercise = currentExercise();
      if (!songHasStructuredChart(exercise)) return;
      const rawBar = Number.parseInt(analyzeBtn.dataset.songMeasure || "", 10);
      if (!Number.isInteger(rawBar)) return;
      analyzeAndApplyChordsForBar(exercise, rawBar)
        .catch((error) => showToast(error?.message || "Bar analysis failed"));
      return;
    }

    const chip = event.target.closest(".song-chord-event-chip[data-song-measure][data-song-event]");
    const measureEl = event.target.closest(".song-measure[data-song-measure]");
    if (!measureEl) return;
    const measureIndex = Number.parseInt(
      measureEl.dataset.songMeasure || "",
      10
    );
    if (!Number.isInteger(measureIndex)) return;
    const exercise = currentExercise();
    if (!songHasStructuredChart(exercise)) return;
    const measures = exercise.songData.measures;
    const bounded = Math.max(0, Math.min(measures.length - 1, measureIndex));
    const measure = measures[bounded];
    const requestedEventIndex = Number.parseInt(chip?.dataset.songEvent || "0", 10);
    const events = Array.isArray(measure?.chordEvents) && measure.chordEvents.length ? measure.chordEvents : [measure];
    const boundedEventIndex = Number.isInteger(requestedEventIndex)
      ? Math.max(0, Math.min(events.length - 1, requestedEventIndex))
      : 0;
    if (state.songTrainerMode === "arrange") {
      const multiSelect = Boolean(event.metaKey || event.ctrlKey || event.shiftKey);
      if (multiSelect) {
        toggleArrangeBarSelection(bounded);
        const selected = sortedSelectedArrangeBars();
        showToast(selected.length ? `Selected bars: ${selected.map((idx) => idx + 1).join(", ")}` : "Selection cleared");
        renderPractice();
        return;
      } else {
        state.songArrangeSelectedBars = [bounded];
        songPlayback.activeMeasureIndex = bounded;
        songPlayback.activeChordEventIndex = boundedEventIndex;
        const targetEvent = chordEventForMeasure(measure, boundedEventIndex) || measure;
        if (songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.seekTo === "function") {
          songPlayback.player.seekTo(Number(targetEvent.startSec || measure.startSec || 0), true);
        }
        showToast(`Playhead set to Bar ${bounded + 1}`);
        renderPractice();
        return;
      }
    }
    songPlayback.activeMeasureIndex = bounded;
    songPlayback.activeChordEventIndex = boundedEventIndex;
    const targetEvent = chordEventForMeasure(measure, boundedEventIndex) || measure;
    if (songPlayback.playerReady && songPlayback.player && typeof songPlayback.player.seekTo === "function") {
      songPlayback.player.seekTo(Number(targetEvent.startSec || measure.startSec || 0), true);
    }
    syncSongFollowAlong(exercise, true);
  });

  document.getElementById("songModeButtons").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-song-mode]");
    if (!btn) return;
    if (!state.songArrangeAccess && btn.dataset.songMode === "arrange") return;
    const mode = btn.dataset.songMode === "arrange" ? "arrange" : "play";
    state.songTrainerMode = mode;
    if (mode === "arrange") {
      state.songPlayalongFocus = false;
      state.songShowVideoInPlayMode = true;
      state.songArrangeSelectedBars = [];
    } else {
      state.songPlayalongFocus = false;
      state.songShowVideoInPlayMode = false;
      state.songArrangeSelectedBars = [];
    }
    renderPractice();
  });

  document.getElementById("songSectionSelect").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.selectedSongSection = target.value;
    renderPractice();
  });

  document.getElementById("songArrangementSourceSelect").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const exercise = currentExercise();
    const songId = exercise?.songData?.id || "let-it-be";
    state.songSourceChoice[songId] = String(target.value || "default");
    clearSongArrangementOverride(exercise);
    state.songArrangeSelectedBars = [];
    songPlayback.activeMeasureIndex = 0;
    songPlayback.activeChordEventIndex = 0;
    saveState();
    renderPractice();
  });

  document.getElementById("songApplySectionSettingsBtn").addEventListener("click", () => {
    const exercise = currentExercise();
    applySongSectionSettings(exercise);
  });

  document.getElementById("songToggleVideoBtn").addEventListener("click", () => {
    if (state.songTrainerMode === "arrange" || !songPlayback.videoPlaying) return;
    state.songShowVideoInPlayMode = !state.songShowVideoInPlayMode;
    renderPractice();
  });

  document.getElementById("songFocusModeBtn").addEventListener("click", () => {
    if (state.songTrainerMode === "arrange") return;
    state.songPlayalongFocus = !state.songPlayalongFocus;
    state.songShowVideoInPlayMode = false;
    renderPractice();
    if (state.songPlayalongFocus) {
      scrollSongChartToTop();
    }
  });

  document.getElementById("songPlayBtn").addEventListener("click", () => {
    if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.playVideo !== "function") return;
    ensureSongPlayerAudible();
    songPlayback.player.playVideo();
  });

  document.getElementById("songPlayBtnArrange").addEventListener("click", () => {
    if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.playVideo !== "function") return;
    ensureSongPlayerAudible();
    songPlayback.player.playVideo();
  });

  document.getElementById("songPauseBtn").addEventListener("click", () => {
    if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.pauseVideo !== "function") return;
    songPlayback.player.pauseVideo();
  });

  document.getElementById("songPauseBtnArrange").addEventListener("click", () => {
    if (!songPlayback.playerReady || !songPlayback.player || typeof songPlayback.player.pauseVideo !== "function") return;
    songPlayback.player.pauseVideo();
  });

  document.getElementById("songSetChartStartBtn").addEventListener("click", triggerSongSetChartStart);
  document.getElementById("songPlayAndSetStartBtn").addEventListener("click", triggerSongPlayAndSetStart);

  document.getElementById("songTapNextBarBtn").addEventListener("click", triggerSongTapNextBar);

  document.getElementById("songResetTimingBtn").addEventListener("click", triggerSongResetTiming);

  document.getElementById("songAutoSeedTimingBtn").addEventListener("click", triggerSongAutoSeedTiming);
  document.getElementById("songFitRemainingTimingBtn").addEventListener("click", triggerSongFitRemainingTiming);
  document.getElementById("songJumpLastAnchorBtn").addEventListener("click", triggerSongJumpToLastAnchor);
  document.getElementById("songClearAnchorsFromBtn").addEventListener("click", () => {
    const exercise = currentExercise();
    if (!songHasStructuredChart(exercise)) return;
    const input = document.getElementById("songClearAnchorsFromInput");
    const raw = input instanceof HTMLInputElement ? Number.parseInt(input.value || "", 10) : NaN;
    if (!Number.isInteger(raw) || raw < 1) {
      showToast("Enter a valid bar number (1 or greater)");
      return;
    }
    clearSongAnchorsFromBar(exercise, raw);
  });
  document.getElementById("songMergeBarsBtn").addEventListener("click", triggerSongMergeSelectedBars);
  document.getElementById("songSplitBarBtn").addEventListener("click", triggerSongSplitSelectedBar);
  document.getElementById("songResetArrangementBtn").addEventListener("click", triggerSongResetArrangement);
  document.getElementById("songApplyLyricBtn").addEventListener("click", triggerSongApplyLyricToTarget);
  document.getElementById("songClearLyricBtn").addEventListener("click", triggerSongClearLyricFromTarget);

  document.getElementById("songTapNextBarFab").addEventListener("click", triggerSongTapNextBar);

  document.getElementById("songArrangeScrubber").addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const exercise = currentExercise();
    if (!songHasStructuredChart(exercise)) return;
    songPlayback.scrubberDragging = true;
    const duration = songDurationSecForExercise(exercise);
    const preview = Number(target.value || 0);
    const bounded = Number.isFinite(preview) ? Math.max(0, Math.min(duration, preview)) : 0;
    const meta = document.getElementById("songArrangeScrubberMeta");
    if (meta) {
      meta.textContent = `${formatSongTimeClock(bounded)} / ${formatSongTimeClock(duration)}`;
    }
  });

  document.getElementById("songArrangeScrubber").addEventListener("change", (event) => {
    const target = event.target;
    const seekTo = target instanceof HTMLInputElement ? Number(target.value || 0) : NaN;
    const exercise = currentExercise();
    if (songHasStructuredChart(exercise)
      && songPlayback.playerReady
      && songPlayback.player
      && typeof songPlayback.player.seekTo === "function"
      && Number.isFinite(seekTo)) {
      songPlayback.player.seekTo(seekTo, true);
      syncSongFollowAlong(exercise, true);
    }
    songPlayback.scrubberDragging = false;
  });

  document.getElementById("songTapStrideSelect").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const nextStride = Number.parseInt(target.value || "", 10);
    state.songCalibrationStride = [1, 2, 4, 8].includes(nextStride) ? nextStride : 4;
    const exercise = currentExercise();
    if (songHasStructuredChart(exercise)) {
      const override = songTimingOverrideForExercise(exercise);
      if (override) {
        saveSongTimingOverride(exercise, {
          barStarts: override.barStarts,
          anchors: override.anchors,
          stride: state.songCalibrationStride
        });
        if (songPlayback.calibrationSongId === timingCalibrationContextId(exercise)) {
          const anchorIndexes = Object.keys(override.anchors || {})
            .map((key) => Number.parseInt(key, 10))
            .filter((idx) => Number.isInteger(idx) && idx >= 0)
            .sort((a, b) => a - b);
          const lastAnchor = anchorIndexes.length ? anchorIndexes[anchorIndexes.length - 1] : 0;
          songPlayback.calibrationNextBarIndex = nextAnchorIndex(
            lastAnchor,
            exercise.songData.measures.length,
            state.songCalibrationStride
          );
        }
      } else {
        saveState();
      }
      renderSongCalibrationMeta(exercise);
    } else {
      saveState();
    }
  });

  document.getElementById("adminSongKeyFilter").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    state.adminSongKeyFilter = String(target.value || "all");
    saveState();
    renderAdmin();
  });

  document.getElementById("adminSongList").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action='admin-select-song'][data-song-id]");
    if (!btn) return;
    state.adminSelectedSongId = String(btn.dataset.songId || "");
    saveState();
    renderAdmin();
  });

  document.getElementById("adminSongDetail").addEventListener("click", (event) => {
    if (event.target.closest("#adminRunAutoDraftNowBtn")) {
      fetch("/api/admin/auto-draft/run", { method: "POST" })
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = typeof body?.message === "string" ? body.message : "Unable to start auto-draft";
            throw new Error(message);
          }
          adminAutoDraft.status = body.state || adminAutoDraftFallbackStatus();
          renderAdminAutoDraftStatus();
          startAdminAutoDraftPolling();
          showToast("Auto-draft started");
        })
        .catch((error) => {
          showToast(error?.message || "Auto-draft failed to start");
          fetchAdminAutoDraftStatus().catch(() => {});
        });
      return;
    }

    const chooseVideoBtn = event.target.closest("button[data-action='admin-choose-video'][data-song-id][data-video-id]");
    if (chooseVideoBtn) {
      const songId = String(chooseVideoBtn.dataset.songId || "");
      const videoId = String(chooseVideoBtn.dataset.videoId || "");
      if (!songId || !videoId) return;
      state.songVideoChoice[songId] = videoId;
      saveState();
      renderAdmin();
      const activeExercise = currentExercise();
      if (state.screen === "practice" && state.block === "song" && activeExercise?.songData?.id === songId) {
        renderPractice();
      }
      return;
    }

    if (event.target.closest("#adminAutoArrangeBtn")) {
      const rows = allAdminSongSpecs();
      const selected = rows.find((row) => row.song?.id === state.adminSelectedSongId) || rows[0];
      if (!selected?.song?.id) return;
      const songId = selected.song.id;
      const chosenDraftId = Array.isArray(selected.song.sourceVariants)
        && selected.song.sourceVariants.some((row) => String(row?.id) === "let-it-be-hybrid-v2")
        ? "let-it-be-hybrid-v2"
        : "default";
      state.songSourceChoice[songId] = chosenDraftId;
      const keyName = selected.keyName || "C";
      const curriculum = buildCurriculumForKey(keyName);
      const songIndex = curriculum.songs.findIndex((row) => row.songData?.id === songId);
      const exercise = songIndex >= 0 ? curriculum.songs[songIndex] : null;
      if (exercise?.id) {
        delete state.songArrangementOverrides[exercise.id];
        delete state.songTimingOverrides[exercise.id];
        const sourceKey = `${exercise.id}::${chosenDraftId}`;
        delete state.songTimingOverrides[sourceKey];
        const legacyDefaultKey = `${exercise.id}::default`;
        delete state.songTimingOverrides[legacyDefaultKey];
      }
      saveState();
      showToast("Auto-arrange draft selected. Open arrangement page to review.");
      renderAdmin();
      return;
    }

    if (event.target.closest("#adminOpenArrangementBtn")) {
      const rows = allAdminSongSpecs();
      const selected = rows.find((row) => row.song?.id === state.adminSelectedSongId) || rows[0];
      if (!selected?.song?.id) return;
      openAdminArrangement(selected.song.id, selected.keyName || "C");
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTypingTarget = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || Boolean(target && target instanceof HTMLElement && target.isContentEditable);
    if (isTypingTarget) return;
    const isSongArrangeContext = state.screen === "practice"
      && state.block === "song"
      && state.songTrainerMode === "arrange";
    if (!isSongArrangeContext) return;

    const key = String(event.key || "").toLowerCase();
    if (key === "t" || key === " ") {
      event.preventDefault();
      triggerSongTapNextBar();
      return;
    }
    if (key === "s") {
      event.preventDefault();
      triggerSongSetChartStart();
      return;
    }
    if (key === "r") {
      event.preventDefault();
      triggerSongResetTiming();
      return;
    }
    if (key === "a") {
      event.preventDefault();
      triggerSongAutoSeedTiming();
      return;
    }
    if (key === "f") {
      event.preventDefault();
      triggerSongFitRemainingTiming();
      return;
    }
    if (key === "p") {
      event.preventDefault();
      triggerSongPlayAndSetStart();
    }
  });

  document.getElementById("pauseTimerBtn").addEventListener("click", toggleTimer);
  document.getElementById("prevExerciseBtn").addEventListener("click", () => moveExercise(-1));
  document.getElementById("nextExerciseBtn").addEventListener("click", () => moveExercise(1));
  document.getElementById("doneExerciseBtn").addEventListener("click", () => {
    markCurrentExerciseDone();
    moveExercise(1);
  });

  document.getElementById("backToLessonsBtn").addEventListener("click", () => {
    renderLessons();
    showScreen("lessons");
    renderNav();
  });

  document.getElementById("finishBtn").addEventListener("click", () => {
    renderLessons();
    showScreen("lessons");
    renderNav();
  });

  document.getElementById("repeatSongBtn").addEventListener("click", () => {
    state.sessionMode = "custom";
    beginBlock("song", 0);
  });

  document.getElementById("circleFromCompleteBtn").addEventListener("click", () => {
    renderCircle();
    renderGlobalMeta();
    showScreen("circle");
    renderNav();
  });

  document.getElementById("historyPrevMonthBtn").addEventListener("click", () => {
    state.historyMonthOffset -= 1;
    renderHistory();
  });
  document.getElementById("historyNextMonthBtn").addEventListener("click", () => {
    state.historyMonthOffset += 1;
    renderHistory();
  });
  document.getElementById("historyCalendar").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-history-day]");
    if (!btn) return;
    state.selectedHistoryDateKey = btn.dataset.historyDay || null;
    saveState();
    renderHistory();
  });

  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    document.getElementById("fullscreenBtn").textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  });
}

function init() {
  loadState();
  wireEvents();
  renderGlobalMeta();
  renderCircle();
  renderLessons();
  renderAdmin();
  renderHistory();
  renderPractice();
  renderSessionTimerControls();
  showScreen("circle");
  renderNav();
  state.intervalId = setInterval(tickTimer, 1000);
}

init();
