const screens = {
  circle: document.getElementById("screen-circle"),
  lessons: document.getElementById("screen-lessons"),
  practice: document.getElementById("screen-practice"),
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
  blockSecondsRemaining: 600,
  timerRunning: false,
  intervalId: null,
  streak: 0,
  lastSessionISO: null,
  arpeggioMode: "both",
  scaleMode: "1",
  scaleDirection: "up",
  chordStepIndex: 0,
  inversionStepIndex: 0,
  completedExerciseIds: []
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
    state.scaleDirection = SCALE_DIRECTIONS.some((mode) => mode.id === parsed.scaleDirection) ? parsed.scaleDirection : "up";

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
      scaleDirection: state.scaleDirection
    })
  );
}

function showScreen(screenName) {
  state.screen = screenName;
  Object.entries(screens).forEach(([name, el]) => {
    el.classList.toggle("active", name === screenName);
  });
}

function currentKeyProgress() {
  return ensureProgressForKey(state.selectedKey);
}

function completedModuleCountForKey(keyName) {
  const progress = ensureProgressForKey(keyName);
  return MODULES.filter((m) => progress.modules[m.id]).length;
}

function renderGlobalMeta() {
  const last = state.lastSessionISO ? new Date(state.lastSessionISO).toLocaleDateString() : "never";
  document.getElementById("globalMeta").textContent = `Streak: ${state.streak} day${state.streak === 1 ? "" : "s"} · Last session: ${last}`;
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

function buildCurriculumForKey(keyName) {
  const root4 = keyRootMidi(keyName, 4);
  const root3 = root4 - 12;

  const scalePattern = [0, 2, 4, 5, 7, 9, 11, 12];
  const scaleRh = scalePattern.map((n) => midiToNoteName(root4 + n));
  const scaleLh = scalePattern.map((n) => midiToNoteName(root3 + n));

  const cSongs = [
    { title: "Let It Be - Beatles", progression: "C G Am F" },
    { title: "No Woman, No Cry - Bob Marley", progression: "C G Am F" },
    { title: "Imagine - John Lennon", progression: "Simplified C-major sections" }
  ];

  const genericSongs = [
    { title: `${keyName} Pop Progression 1`, progression: `${keyName} major groove` },
    { title: `${keyName} Pop Progression 2`, progression: `${keyName} verse/chorus loop` },
    { title: `${keyName} Rock Ballad Sketch`, progression: `${keyName} chord-flow practice` }
  ];

  const songRows = keyName === "C" ? cSongs : genericSongs;

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
      id: `${keyName}-scale-rh`,
      moduleId: "scales",
      title: `${keyLabel(keyName)} Scale - Right Hand`,
      meta: "Hands: Right",
      hint: "Play evenly and keep your hand relaxed.",
      notes: scaleRh,
      fingering: [1, 2, 3, 1, 2, 3, 4, 5]
    },
    {
      id: `${keyName}-scale-lh`,
      moduleId: "scales",
      title: `${keyLabel(keyName)} Scale - Left Hand`,
      meta: "Hands: Left",
      hint: "Keep thumb crossings smooth.",
      notes: scaleLh,
      fingering: [5, 4, 3, 2, 1, 3, 2, 1]
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

  const songs = songRows.map((song, index) => ({
    id: `${keyName}-song-${index + 1}`,
    moduleId: "songs",
    title: song.title,
    meta: `Progression: ${song.progression}`,
    hint: "Loop short sections and focus on smooth changes.",
    notes: [0, 7, 9, 5, 12, 7, 9, 5].map((n) => midiToNoteName(root3 + n)),
    fingering: [1, 1, 1, 1, 1, 1, 1, 1]
  }));

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
  const baseNotes = exercise.notes || [];
  const isRightHand = String(exercise.meta || "").toLowerCase().includes("right");
  const isLeftHand = String(exercise.meta || "").toLowerCase().includes("left");
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
        : exercise.fingering
    : isRightHand
      ? [1, 2, 3, 1, 2, 3, 4, 5]
      : isLeftHand
        ? [5, 4, 3, 2, 1, 3, 2, 1]
        : exercise.fingering;

  if (state.scaleDirection === "updown") {
    const descendingNotes = ascendingNotes.slice(0, -1).reverse();
    const descendingFingering = [...ascendingFingering].slice(0, -1).reverse();
    return {
      ...exercise,
      meta: `${exercise.meta} · ${state.scaleMode} Octave${state.scaleMode === "2" ? "s" : ""} · Up and down`,
      notes: [...ascendingNotes, ...descendingNotes],
      fingering: [...ascendingFingering, ...descendingFingering]
    };
  }

  return {
    ...exercise,
    meta: `${exercise.meta} · ${state.scaleMode} Octave${state.scaleMode === "2" ? "s" : ""} · Ascending`,
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
}

function formatTime(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function displayPitchOnly(note) {
  return String(note || "").replace(/\d+/g, "");
}

function renderPractice() {
  const exercise = applyInversionStepMode(applyChordStepMode(applyScaleMode(currentExercise())));
  const isTechniqueLesson = state.block === "technique";
  const isArpeggioLesson = isTechniqueLesson && exercise?.moduleId === "arpeggios";
  const isBothHandsArpeggio = isArpeggioLesson && state.arpeggioMode === "both";
  const isScaleLesson = isTechniqueLesson && exercise?.moduleId === "scales";
  const isTriadLesson = isTechniqueLesson && exercise?.moduleId === "chords";
  const isInversionLesson = isTechniqueLesson && exercise?.moduleId === "inversions";
  const rootFingerMeta = document.getElementById("rootFingerMeta");
  const practiceStaffCard = document.getElementById("practiceStaffCard");
  document.getElementById("blockLabel").textContent =
    isTechniqueLesson ? `${keyLabel(state.selectedKey)} Technique` : `${keyLabel(state.selectedKey)} Song`;
  document.getElementById("exerciseTitle").textContent = exercise.title;
  document.getElementById("exerciseMeta").textContent = exercise.meta;
  document.getElementById("exerciseHint").textContent = isBothHandsArpeggio
    ? `${exercise.hint} Meeting note rule: play both thumbs together (1+1).`
    : exercise.hint;
  document.getElementById("timerText").textContent = state.timerRunning ? formatTime(state.blockSecondsRemaining) : "Timer Off";
  document.getElementById("pauseTimerBtn").textContent = state.timerRunning ? "Pause" : "Resume";

  if (practiceStaffCard) {
    practiceStaffCard.classList.toggle("hidden", !isTechniqueLesson);
  }
  renderArpeggioModes(isArpeggioLesson);
  renderScaleModes(isScaleLesson);
  renderScaleDirections(isScaleLesson);
  renderTriadModes(isTriadLesson, exercise);
  renderInversionModes(isInversionLesson, exercise);

  renderKeyboard(exercise);
  if (isTechniqueLesson) {
    renderStaffSVG(exercise.notes, "staff", false, exercise.handAssignments || null);
  }
  document.getElementById("noteSequence").textContent = `Notes: ${exercise.notes.map(displayPitchOnly).join(" - ")}`;
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
  }
  renderPractice();
}

function updateStreakOnSessionComplete() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const prev = state.lastSessionISO ? new Date(state.lastSessionISO) : null;

  if (!prev) {
    state.streak = 1;
  } else {
    const prevDay = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
    const diffDays = Math.round((today - prevDay) / 86400000);
    if (diffDays === 0) {
      // Keep streak.
    } else if (diffDays === 1) {
      state.streak += 1;
    } else {
      state.streak = 1;
    }
  }

  state.lastSessionISO = now.toISOString();
  saveState();
}

function beginBlock(blockName, index = 0, startTimer = false) {
  state.block = blockName;
  if (blockName === "technique") state.techniqueIndex = index;
  if (blockName === "song") state.songIndex = index;
  state.chordStepIndex = 0;
  state.inversionStepIndex = 0;

  state.blockSecondsRemaining = 600;
  state.timerRunning = startTimer;
  renderPractice();
  showScreen("practice");
}

function beginSession() {
  state.completedExerciseIds = [];
  state.sessionMode = "full";
  beginBlock("technique", 0, true);
}

function finishSession() {
  updateStreakOnSessionComplete();
  const doneCount = state.completedExerciseIds.length;
  document.getElementById("sessionSummary").textContent =
    `You completed ${doneCount} exercise${doneCount === 1 ? "" : "s"} in ${keyLabel(state.selectedKey)}.`;
  renderGlobalMeta();
  renderCircle();
  renderLessons();
  showScreen("complete");
}

function tickTimer() {
  if (!state.timerRunning) return;

  if (state.blockSecondsRemaining > 0) {
    state.blockSecondsRemaining -= 1;
    document.getElementById("timerText").textContent = formatTime(state.blockSecondsRemaining);
    return;
  }

  if (state.sessionMode === "full" && state.block === "technique") {
    beginBlock("song", 0, true);
    return;
  }

  state.timerRunning = false;
  finishSession();
}

function toggleTimer() {
  state.timerRunning = !state.timerRunning;
  renderPractice();
}

function openLessonsForKey(keyName) {
  state.selectedKey = keyName;
  saveState();
  renderLessons();
  showScreen("lessons");
}

function wireEvents() {
  document.getElementById("circleOfFifths").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-key]");
    if (!btn) return;
    openLessonsForKey(btn.dataset.key);
  });

  document.getElementById("backToCircleBtn").addEventListener("click", () => {
    renderCircle();
    renderGlobalMeta();
    showScreen("circle");
  });

  document.getElementById("toggleKeyCompleteBtn").addEventListener("click", () => {
    const progress = currentKeyProgress();
    progress.completed = !progress.completed;
    saveState();
    renderLessons();
    renderCircle();
  });

  document.getElementById("startSessionBtn").addEventListener("click", beginSession);

  document.getElementById("startTechniqueBtn").addEventListener("click", () => {
    state.sessionMode = "custom";
    beginBlock("technique", 0, false);
  });

  document.getElementById("startSongBtn").addEventListener("click", () => {
    state.sessionMode = "custom";
    beginBlock("song", 0, false);
  });

  document.getElementById("lessonExerciseList").addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action='start-lesson']");
    if (!btn) return;
    state.sessionMode = "custom";
    const block = btn.dataset.block === "song" ? "song" : "technique";
    const index = Number.parseInt(btn.dataset.index || "0", 10) || 0;
    beginBlock(block, index, false);
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

  document.getElementById("pauseTimerBtn").addEventListener("click", toggleTimer);
  document.getElementById("prevExerciseBtn").addEventListener("click", () => moveExercise(-1));
  document.getElementById("nextExerciseBtn").addEventListener("click", () => moveExercise(1));
  document.getElementById("doneExerciseBtn").addEventListener("click", () => {
    markCurrentExerciseDone();
    moveExercise(1);
  });

  document.getElementById("backToLessonsBtn").addEventListener("click", () => {
    state.timerRunning = false;
    renderLessons();
    showScreen("lessons");
  });

  document.getElementById("finishBtn").addEventListener("click", () => {
    renderLessons();
    showScreen("lessons");
  });

  document.getElementById("repeatSongBtn").addEventListener("click", () => {
    state.sessionMode = "custom";
    beginBlock("song", 0, false);
  });

  document.getElementById("circleFromCompleteBtn").addEventListener("click", () => {
    renderCircle();
    renderGlobalMeta();
    showScreen("circle");
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
  renderPractice();
  showScreen("circle");
  state.intervalId = setInterval(tickTimer, 1000);
}

init();
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
