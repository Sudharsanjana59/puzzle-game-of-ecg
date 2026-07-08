/* =========================================================================
   COMMON.JS — session, leaderboard storage, and small shared helpers.
   Storage is browser localStorage, so the leaderboard/dataset persists on
   this device/browser only (there is no server in this project — see the
   README for how to wire this up to a real backend/database later).
   ========================================================================= */

const LS_USER = "ecg_current_user";
const LS_LEADERBOARD = "ecg_leaderboard";
const LS_PROGRESS = "ecg_progress";

/* ---------------- session ---------------- */
function getCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem(LS_USER)); } catch (e) { return null; }
}
function setCurrentUser(name) {
  sessionStorage.setItem(LS_USER, JSON.stringify({ name, isAdmin: name.trim().toLowerCase() === "admin" }));
}
function logout() {
  sessionStorage.removeItem(LS_USER);
  window.location.href = "index.html";
}
function requireLogin() {
  const u = getCurrentUser();
  if (!u) { window.location.href = "index.html"; return null; }
  return u;
}

/* ---------------- progress (levels unlocked) ---------------- */
function getProgress(name) {
  const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
  return all[name] || { unlocked: 1 };
}
function unlockNextLevel(name, completedLevel) {
  const all = JSON.parse(localStorage.getItem(LS_PROGRESS) || "{}");
  const cur = all[name] || { unlocked: 1 };
  cur.unlocked = Math.max(cur.unlocked, completedLevel + 1);
  all[name] = cur;
  localStorage.setItem(LS_PROGRESS, JSON.stringify(all));
}

/* ---------------- leaderboard ---------------- */
function getLeaderboard() {
  return JSON.parse(localStorage.getItem(LS_LEADERBOARD) || "[]");
}
function addLeaderboardEntry(entry) {
  const board = getLeaderboard();
  board.push({ ...entry, timestamp: new Date().toISOString() });
  localStorage.setItem(LS_LEADERBOARD, JSON.stringify(board));
}
function topScores(limit) {
  return getLeaderboard()
    .sort((a, b) => (b.score - a.score) || (a.timeTakenSec - b.timeTakenSec))
    .slice(0, limit || 50);
}
function exportLeaderboardCSV() {
  const rows = getLeaderboard();
  const headers = ["name", "level", "score", "correct", "total", "timeTakenSec", "timestamp"];
  const csv = [headers.join(",")].concat(
    rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))
  ).join("\n");
  return csv;
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- 3D tilt-on-hover helper ---------------- */
/* Applies a subtle perspective rotation that tracks the pointer, giving
   cards a physical, tilt-toward-you feel. Purely decorative — resets on
   pointer leave. Skipped automatically for touch-only devices. */
function attachTilt(el, opts) {
  if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
  const max = (opts && opts.max) || 8;
  const lift = (opts && opts.lift) || 10;
  el.style.willChange = "transform";
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max;
    const ry = (px - 0.5) * max;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-${lift}px) translateZ(0)`;
  });
  el.addEventListener("mouseleave", () => { el.style.transform = ""; });
}

/* ---------------- per-level color theming ---------------- */
/* Sets --accent / --accent-dim / --accent-glow custom properties on any
   element (or the document root) so buttons, borders, and glows for that
   scope pick up the level's own color instead of the default green. */
function applyAccent(el, theme) {
  const target = el || document.documentElement;
  target.style.setProperty("--accent", theme.accent);
  target.style.setProperty("--accent-dim", theme.accent2);
  target.style.setProperty("--accent-glow", theme.accent + "33");
}

/* ---------------- misc helpers ---------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
/* ambient colorful floating particles for hero/background atmosphere */
function spawnFloatParticles(count, symbols) {
  const glyphs = symbols || ["🫀", "❤", "⚡", "✦"];
  const colors = ["#22d3ee", "#fb923c", "#a78bfa", "#f472b6", "#fbbf24", "#39ff88"];
  for (let i = 0; i < (count || 14); i++) {
    const p = document.createElement("span");
    p.className = "float-particle";
    p.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    p.style.left = Math.random() * 100 + "vw";
    p.style.color = colors[Math.floor(Math.random() * colors.length)];
    p.style.fontSize = (10 + Math.random() * 14) + "px";
    p.style.animationDuration = (10 + Math.random() * 14) + "s";
    p.style.animationDelay = (Math.random() * 10) + "s";
    document.body.appendChild(p);
  }
}

function launchConfetti(container) {
  const colors = ["#39ff88", "#ffb020", "#eef3f0", "#1fce6b"];
  const wrap = document.createElement("div");
  wrap.className = "confetti";
  for (let i = 0; i < 60; i++) {
    const s = document.createElement("span");
    const size = 5 + Math.random() * 6;
    s.style.left = Math.random() * 100 + "vw";
    s.style.width = size + "px";
    s.style.height = size * 0.5 + "px";
    s.style.background = colors[Math.floor(Math.random() * colors.length)];
    s.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
    s.style.animationDelay = Math.random() * 0.4 + "s";
    wrap.appendChild(s);
  }
  (container || document.body).appendChild(wrap);
  setTimeout(() => wrap.remove(), 3600);
}
