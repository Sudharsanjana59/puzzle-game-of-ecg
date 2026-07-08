/* =========================================================================
   ECG-DATA.JS
   This is the master dataset. It is the single source of truth used by:
     - game.js      (to build each level's puzzle)
     - admin.html   (to display / export the dataset for the admin)
   An admin can edit waveform definitions, hints, and level composition here
   without touching any game logic.

   24 rhythms, 24 levels — one unique topic per level, no repeats. Covers
   both the "common arrhythmias" chart and the "high-yield" chart:
   sinus rhythms, ectopy (PAC/PVC/bigeminy/trigeminy), AV blocks (1st,
   Wenckebach, Mobitz II, complete), supraventricular & ventricular
   tachyarrhythmias, and the named syndromes (WPW, Brugada, Long QT,
   Sick Sinus, Torsades).
   ========================================================================= */

const ECG_TYPES = {
  NSR:      { id: "NSR",      name: "Normal Sinus Rhythm",              difficulty: "easy",   rate: "60-100 bpm",
    hint: "Regular rhythm, rate 60–100 bpm. Every P wave is followed by a QRS, every QRS by a T wave. Nothing irregular." },
  SBRAD:    { id: "SBRAD",    name: "Sinus Bradycardia",                difficulty: "easy",   rate: "<60 bpm",
    hint: "Same normal shape, but the cycles are stretched further apart. Rate is below 60 bpm." },
  STACH:    { id: "STACH",    name: "Sinus Tachycardia",                difficulty: "easy",   rate: ">100 bpm",
    hint: "Same shape as a normal beat, but the cycles are squeezed closer together. Rate is above 100 bpm." },
  SINUSARR: { id: "SINUSARR", name: "Sinus Arrhythmia",                 difficulty: "easy",   rate: "Varies with breathing",
    hint: "Normal-looking beats, but the spacing gently speeds up and slows down in a smooth, repeating wave — not chaotic, just breathing-linked." },
  PAC:      { id: "PAC",      name: "Premature Atrial Contraction",     difficulty: "medium", rate: "Variable",
    hint: "Mostly normal beats, interrupted by one early beat with an odd-shaped P wave — but a normal, narrow QRS follows it." },
  PVC:      { id: "PVC",      name: "Premature Ventricular Contraction", difficulty: "medium", rate: "Variable",
    hint: "Mostly normal beats, interrupted by one early, wide, bizarre-looking QRS with no P wave in front of it, followed by a pause." },
  BIGEM:    { id: "BIGEM",    name: "Bigeminy (PVC)",                   difficulty: "medium", rate: "Variable",
    hint: "A strict alternating pattern: normal beat, PVC, normal beat, PVC — every other beat is wide and bizarre." },
  TRIGEM:   { id: "TRIGEM",   name: "Trigeminy (PVC)",                  difficulty: "medium", rate: "Variable",
    hint: "Two normal beats, then a wide bizarre PVC, repeating in a strict three-beat pattern." },
  AFIB:     { id: "AFIB",     name: "Atrial Fibrillation",              difficulty: "medium", rate: "Variable",
    hint: "No true P waves — just a wobbly, fibrillating baseline. The spacing between QRS spikes is irregularly irregular." },
  AVB1:     { id: "AVB1",     name: "First-Degree AV Block",            difficulty: "medium", rate: "60-100 bpm",
    hint: "Looks normal, but the flat gap between the P wave and the QRS (the PR segment) is stretched noticeably longer than usual." },
  SSS:      { id: "SSS",      name: "Sick Sinus Syndrome",              difficulty: "medium", rate: "Variable, with pauses",
    hint: "A slow, normal-shaped rhythm that's occasionally interrupted by an unexpectedly long pause before the next beat." },
  ATACH:    { id: "ATACH",    name: "Atrial Tachycardia",               difficulty: "medium", rate: "100-250 bpm",
    hint: "Regular and fast like sinus tachycardia, but the P wave shape looks different/abnormal — it didn't come from the normal pacemaker." },
  AFLUT:    { id: "AFLUT",    name: "Atrial Flutter",                   difficulty: "hard",   rate: "Variable, saw-tooth",
    hint: "A fast, regular saw-tooth pattern between QRS complexes — like the teeth of a saw — instead of a flat baseline with P waves." },
  SVT:      { id: "SVT",      name: "Supraventricular Tachycardia",     difficulty: "hard",   rate: ">150 bpm",
    hint: "Very fast, perfectly regular, narrow QRS complexes with no visible P waves at all — too fast and clean to be sinus tach." },
  AVB2A:    { id: "AVB2A",    name: "2nd-Degree AV Block — Mobitz I",   difficulty: "hard",   rate: "Variable, grouped",
    hint: "Watch the PR gap: it grows a little longer with each beat until one QRS is dropped entirely — then the pattern resets (Wenckebach)." },
  AVB2B:    { id: "AVB2B",    name: "2nd-Degree AV Block — Mobitz II",  difficulty: "hard",   rate: "Variable, grouped",
    hint: "The PR gap stays exactly the same beat after beat, but every so often a P wave simply isn't followed by any QRS at all." },
  STEMI:    { id: "STEMI",    name: "ST-Elevation MI",                  difficulty: "hard",   rate: "60-100 bpm",
    hint: "Normal-looking QRS, but the segment right after it (the ST segment) is raised up above the baseline like a dome, before the T wave." },
  WPW:      { id: "WPW",      name: "Wolff–Parkinson–White Syndrome",   difficulty: "hard",   rate: "60-100 bpm",
    hint: "The PR gap is unusually short, and the QRS starts with a slow, slurred upstroke (a 'delta wave') before it shoots up." },
  LQT:      { id: "LQT",      name: "Long QT Syndrome",                 difficulty: "hard",   rate: "60-100 bpm",
    hint: "Normal-looking QRS, but everything from the QRS to the end of the T wave is stretched out much further than usual." },
  AVB3:     { id: "AVB3",     name: "Complete (3rd-Degree) AV Block",   difficulty: "hard",   rate: "Independent P & QRS rates",
    hint: "P waves march through at their own steady beat, totally unrelated in timing to a separate, slower run of wide QRS complexes." },
  VTACH:    { id: "VTACH",    name: "Ventricular Tachycardia",          difficulty: "critical", rate: ">150 bpm",
    hint: "Wide, tall, smooth sine-like complexes racing very fast, one after another, with no visible P waves at all." },
  TDP:      { id: "TDP",      name: "Torsades de Pointes",              difficulty: "critical", rate: "Very fast, chaotic",
    hint: "Looks like ventricular tachycardia, but the peaks visibly twist — growing and shrinking as they spiral around the baseline." },
  BRUGADA:  { id: "BRUGADA",  name: "Brugada Syndrome",                 difficulty: "critical", rate: "60-100 bpm",
    hint: "A normal-ish QRS is followed by a raised, dome-shaped ('coved') ST segment that curves straight into an inverted, downward T wave." },
  VFIB:     { id: "VFIB",     name: "Ventricular Fibrillation",         difficulty: "critical", rate: "None (chaotic)",
    hint: "Completely chaotic squiggle — no recognizable P, QRS, or T at all. There is no organized rhythm left to name." },
};

/* One topic (one rhythm) per level, ordered easiest → most critical. Each
   level is a deep-dive on a single rhythm — no mixing multiple topics into
   one board, and no topic ever repeats across levels — so a player masters
   one pattern before moving to the next. */
const LEVELS = [
  { level: 1,  title: "Normal Sinus Rhythm",            description: "The textbook baseline every other rhythm gets compared to.",             waveforms: ["NSR"],      extraDistractors: ["STACH", "SBRAD"], segments: 3, timeBonusSeconds: 45 },
  { level: 2,  title: "Sinus Bradycardia",               description: "Same shape as normal, but stretched out below 60 bpm.",                  waveforms: ["SBRAD"],    extraDistractors: ["NSR", "SSS"],      segments: 3, timeBonusSeconds: 45 },
  { level: 3,  title: "Sinus Tachycardia",                description: "Same shape as normal, but racing above 100 bpm.",                        waveforms: ["STACH"],    extraDistractors: ["NSR", "SVT"],      segments: 3, timeBonusSeconds: 45 },
  { level: 4,  title: "Sinus Arrhythmia",                 description: "A normal beat whose spacing gently rides the breath.",                   waveforms: ["SINUSARR"], extraDistractors: ["NSR", "AFIB"],     segments: 3, timeBonusSeconds: 50 },
  { level: 5,  title: "Premature Atrial Contraction",     description: "Catch the early beat with the odd-shaped P wave.",                       waveforms: ["PAC"],      extraDistractors: ["PVC", "NSR"],      segments: 4, timeBonusSeconds: 75 },
  { level: 6,  title: "Premature Ventricular Contraction", description: "Catch the early, wide, bizarre beat hiding among normal ones.",         waveforms: ["PVC"],      extraDistractors: ["PAC", "BIGEM"],    segments: 4, timeBonusSeconds: 75 },
  { level: 7,  title: "Bigeminy",                         description: "Every normal beat is followed by a PVC — spot the strict pattern.",      waveforms: ["BIGEM"],    extraDistractors: ["PVC", "TRIGEM"],   segments: 4, timeBonusSeconds: 75 },
  { level: 8,  title: "Trigeminy",                        description: "Two normal beats, then a PVC, on repeat.",                               waveforms: ["TRIGEM"],   extraDistractors: ["BIGEM", "PVC"],    segments: 4, timeBonusSeconds: 75 },
  { level: 9,  title: "Atrial Fibrillation",               description: "No true P waves — just an irregularly irregular wobble.",               waveforms: ["AFIB"],     extraDistractors: ["AFLUT", "SINUSARR"], segments: 4, timeBonusSeconds: 75 },
  { level: 10, title: "First-Degree AV Block",             description: "Spot the abnormally long PR segment before the QRS.",                    waveforms: ["AVB1"],     extraDistractors: ["NSR", "AVB2A"],    segments: 4, timeBonusSeconds: 75 },
  { level: 11, title: "Sick Sinus Syndrome",               description: "A slow rhythm punctuated by unexpectedly long pauses.",                  waveforms: ["SSS"],      extraDistractors: ["SBRAD", "AVB3"],   segments: 4, timeBonusSeconds: 80 },
  { level: 12, title: "Atrial Tachycardia",                description: "Fast and regular, but the P wave shape gives it away.",                  waveforms: ["ATACH"],    extraDistractors: ["STACH", "SVT"],    segments: 4, timeBonusSeconds: 80 },
  { level: 13, title: "Atrial Flutter",                    description: "Lock onto the fast saw-tooth pattern between beats.",                    waveforms: ["AFLUT"],    extraDistractors: ["AFIB", "SVT"],     segments: 5, timeBonusSeconds: 100 },
  { level: 14, title: "Supraventricular Tachycardia",      description: "Very fast, very regular, and no P waves anywhere.",                      waveforms: ["SVT"],      extraDistractors: ["STACH", "ATACH"],  segments: 5, timeBonusSeconds: 100 },
  { level: 15, title: "2nd-Degree AV Block — Mobitz I",    description: "Watch the PR interval stretch, beat by beat, until one drops.",          waveforms: ["AVB2A"],    extraDistractors: ["AVB1", "AVB2B"],   segments: 5, timeBonusSeconds: 105 },
  { level: 16, title: "2nd-Degree AV Block — Mobitz II",   description: "Constant PR interval, but a P wave suddenly goes unanswered.",           waveforms: ["AVB2B"],    extraDistractors: ["AVB2A", "AVB3"],   segments: 5, timeBonusSeconds: 105 },
  { level: 17, title: "ST-Elevation MI",                   description: "Read the raised, dome-like ST segment after the QRS.",                   waveforms: ["STEMI"],    extraDistractors: ["NSR", "BRUGADA"],  segments: 5, timeBonusSeconds: 100 },
  { level: 18, title: "Wolff–Parkinson–White Syndrome",    description: "Short PR interval plus a slurred delta-wave upstroke.",                  waveforms: ["WPW"],      extraDistractors: ["AVB1", "STEMI"],   segments: 5, timeBonusSeconds: 105 },
  { level: 19, title: "Long QT Syndrome",                  description: "Everything after the QRS is stretched out further than usual.",         waveforms: ["LQT"],      extraDistractors: ["NSR", "TDP"],      segments: 5, timeBonusSeconds: 105 },
  { level: 20, title: "Complete AV Block",                 description: "P waves and QRS complexes marching to two different drummers.",         waveforms: ["AVB3"],     extraDistractors: ["AVB2B", "SSS"],    segments: 5, timeBonusSeconds: 110 },
  { level: 21, title: "Ventricular Tachycardia",            description: "Wide, fast, smooth complexes — no P waves anywhere.",                    waveforms: ["VTACH"],    extraDistractors: ["AFLUT", "TDP"],    segments: 5, timeBonusSeconds: 100 },
  { level: 22, title: "Torsades de Pointes",                description: "A twisting, spiraling amplitude gives this VT variant away.",           waveforms: ["TDP"],      extraDistractors: ["VTACH", "VFIB"],   segments: 5, timeBonusSeconds: 110 },
  { level: 23, title: "Brugada Syndrome",                   description: "A coved ST dome that curves straight into an inverted T wave.",         waveforms: ["BRUGADA"],  extraDistractors: ["STEMI", "WPW"],    segments: 5, timeBonusSeconds: 110 },
  { level: 24, title: "Ventricular Fibrillation",           description: "Total chaos — no organized pattern left to name.",                       waveforms: ["VFIB"],     extraDistractors: ["TDP", "VTACH"],    segments: 5, timeBonusSeconds: 100 },
];

/* ---------------------------------------------------------------------
   COLOR THEMES — every level gets its own hue, spaced evenly around the
   color wheel, so no two levels can ever end up looking alike no matter
   how many levels this dataset grows to.
   ------------------------------------------------------------------- */
const LEVEL_ICONS = {
  1: "🫀", 2: "🐢", 3: "⚡", 4: "🌬️", 5: "✨", 6: "⚠️", 7: "🔁", 8: "🔂",
  9: "🌊", 10: "⏳", 11: "😴", 12: "🔺", 13: "🪚", 14: "🏎️", 15: "📉",
  16: "⛔", 17: "🚨", 18: "🗡️", 19: "⏱️", 20: "🔌", 21: "🏃", 22: "🌀",
  23: "🧬", 24: "💥",
};

function themeForLevel(levelNum) {
  const total = LEVELS.length || 24;
  const hue = Math.round(((levelNum - 1) * (360 / total)) % 360);
  const accent = `hsl(${hue}, 78%, 58%)`;
  const accent2 = `hsl(${hue}, 70%, 32%)`;
  return { accent, accent2, icon: LEVEL_ICONS[levelNum] || "🫀", hue };
}

/* precomputed map, handy for admin table iteration */
const LEVEL_THEMES = {};
LEVELS.forEach((l) => { LEVEL_THEMES[l.level] = themeForLevel(l.level); });

/* Exposed globally so every page (game / admin) can read the same dataset. */
window.ECG_TYPES = ECG_TYPES;
window.LEVELS = LEVELS;
window.LEVEL_THEMES = LEVEL_THEMES;
window.themeForLevel = themeForLevel;
