/* =========================
   Mood Tracker — Vanilla JS
   ========================= */

/** Mood scale mapping */
const MOODS = [
  { key: "very-bad", label: "Very Bad", emoji: "😞", score: 1 },
  { key: "bad",      label: "Bad",      emoji: "🙁", score: 2 },
  { key: "ok",       label: "Okay",     emoji: "😐", score: 3 },
  { key: "good",     label: "Good",     emoji: "🙂", score: 4 },
  { key: "great",    label: "Great",    emoji: "😀", score: 5 },
];

const STORAGE_KEY = "mood-tracker-entries:v1";
const THEME_KEY   = "mood-tracker-theme:v1";

/* ---------- Helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtHuman(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function getMoodByKey(key) {
  return MOODS.find(m => m.key === key);
}
function getMoodByScore(score) {
  return MOODS.find(m => m.score === score);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
function getTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

/* ---------- State ---------- */
let entries = loadEntries();  // [{id, date:"YYYY-MM-DD", moodKey, score, note}]
let selectedMoodKey = null;

/* ---------- Elements ---------- */
const entryDateEl   = $("#entryDate");
const moodPickerEl  = $(".mood-picker");
const notesEl       = $("#notes");
const saveBtn       = $("#saveBtn");
const clearFormBtn  = $("#clearFormBtn");

const fromDateEl    = $("#fromDate");
const toDateEl      = $("#toDate");
const moodSelectEl  = $("#moodSelect");
const applyFilters  = $("#applyFiltersBtn");
const resetFilters  = $("#resetFiltersBtn");

const avg7El        = $("#avg7");
const streakEl      = $("#streak");
const totalEl       = $("#totalCount");
const chartEl       = $("#trendChart");

const historyListEl = $("#historyList");
const emptyStateEl  = $("#emptyState");

const themeToggle   = $("#themeToggle");
const importFileEl  = $("#importFile");
const exportBtn     = $("#exportBtn");
const clearAllBtn   = $("#clearAllBtn");

/* ---------- Init ---------- */
function init() {
  // Theme
  setTheme(getTheme());
  themeToggle.addEventListener("click", () => {
    const t = getTheme() === "light" ? "dark" : "light";
    setTheme(t);
  });

  // Form defaults
  entryDateEl.value = todayISO();
  renderMoodPicker();
  populateMoodSelect();

  // Events
  $("#entryForm").addEventListener("submit", onSave);
  clearFormBtn.addEventListener("click", clearForm);
  applyFilters.addEventListener("click", renderAll);
  resetFilters.addEventListener("click", () => {
    fromDateEl.value = "";
    toDateEl.value = "";
    moodSelectEl.value = "all";
    renderAll();
  });

  exportBtn.addEventListener("click", onExport);
  importFileEl.addEventListener("change", onImport);
  clearAllBtn.addEventListener("click", onClearAll);

  // First render
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);

/* ---------- Mood Picker ---------- */
function renderMoodPicker() {
  moodPickerEl.innerHTML = "";
  MOODS.forEach(m => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-btn";
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", "false");
    btn.dataset.key = m.key;
    btn.innerHTML = `
      <div class="emoji">${m.emoji}</div>
      <div class="label">${m.label}</div>
    `;
    btn.addEventListener("click", () => selectMood(m.key));
    moodPickerEl.appendChild(btn);
  });
}

function selectMood(key) {
  selectedMoodKey = key;
  $$(".mood-btn", moodPickerEl).forEach(btn => {
    const isSel = btn.dataset.key === key;
    btn.classList.toggle("selected", isSel);
    btn.setAttribute("aria-checked", isSel ? "true" : "false");
  });
}

/* ---------- Filters ---------- */
function populateMoodSelect() {
  MOODS.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.key;
    opt.textContent = `${m.emoji} ${m.label}`;
    moodSelectEl.appendChild(opt);
  });
}

/* ---------- Save/Update ---------- */
function onSave(e) {
  e.preventDefault();
  const date = entryDateEl.value;
  if (!date) return alert("Please select a date.");
  if (!selectedMoodKey) return alert("Please select a mood.");

  const mood = getMoodByKey(selectedMoodKey);
  const note = (notesEl.value || "").trim();

  // Overwrite if same date exists
  const idx = entries.findIndex(x => x.date === date);
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date,
    moodKey: mood.key,
    score: mood.score,
    note
  };

  if (idx >= 0) {
    // keep same id for stability
    entry.id = entries[idx].id;
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  // Sort descending by date
  entries.sort((a, b) => b.date.localeCompare(a.date));
  saveEntries(entries);

  clearForm(false); // keep date to allow fast updating
  renderAll();
}

function clearForm(resetDate = true) {
  if (resetDate) entryDateEl.value = todayISO();
  notesEl.value = "";
  selectedMoodKey = null;
  $$(".mood-btn", moodPickerEl).forEach(btn => {
    btn.classList.remove("selected");
    btn.setAttribute("aria-checked", "false");
  });
}

/* ---------- Rendering ---------- */
function renderAll() {
  renderHistory();
  renderStats();
  renderChart();
}

function passesFilters(entry) {
  const from = fromDateEl.value;
  const to = toDateEl.value;
  const mood = moodSelectEl.value;

  if (from && entry.date < from) return false;
  if (to && entry.date > to) return false;
  if (mood !== "all" && entry.moodKey !== mood) return false;
  return true;
}

function renderHistory() {
  historyListEl.innerHTML = "";
  const filtered = entries.filter(passesFilters);
  emptyStateEl.style.display = filtered.length ? "none" : "block";

  for (const e of filtered) {
    const m = getMoodByKey(e.moodKey);

    const item = document.createElement("div");
    item.className = "history-item";

    const badge = document.createElement("div");
    badge.className = "mood-badge";
    badge.textContent = m.emoji;

    const meta = document.createElement("div");
    meta.className = "meta";
    const dateEl = document.createElement("div");
    dateEl.className = "date";
    dateEl.textContent = fmtHuman(e.date);
    const noteEl = document.createElement("div");
    noteEl.className = "note";
    noteEl.textContent = e.note || "—";
    meta.appendChild(dateEl);
    meta.appendChild(noteEl);

    const actions = document.createElement("div");
    actions.className = "actions";
    const loadBtn = document.createElement("button");
    loadBtn.className = "btn ghost";
    loadBtn.textContent = "Load to edit";
    loadBtn.addEventListener("click", () => {
      entryDateEl.value = e.date;
      selectMood(e.moodKey);
      notesEl.value = e.note || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete entry for ${fmtHuman(e.date)}?`)) return;
      entries = entries.filter(x => x.id !== e.id);
      saveEntries(entries);
      renderAll();
    });
    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);

    item.appendChild(badge);
    item.appendChild(meta);
    item.appendChild(actions);
    historyListEl.appendChild(item);
  }
}

/* ---------- Stats ---------- */
function renderStats() {
  totalEl.textContent = String(entries.length);

  // 7-day average (based on last 7 days relative to today, not just last 7 entries)
  const last7 = getLastNDays(7);
  const scores = last7
    .map(d => entries.find(e => e.date === d)?.score ?? null)
    .filter(x => typeof x === "number");

  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  avg7El.textContent = avg ? avg.toFixed(2) : "—";

  // Streak (consecutive days up to today that have entries)
  streakEl.textContent = `${calcStreak(entries)} day${calcStreak(entries) === 1 ? "" : "s"}`;
}

function getLastNDays(n) {
  const days = [];
  const d = new Date(todayISO() + "T00:00:00");
  for (let i = 0; i < n; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    days.unshift(dateStr);
    d.setDate(d.getDate() - 1);
  }
  return days;
}

function calcStreak(list) {
  if (!list.length) return 0;
  const set = new Set(list.map(e => e.date));
  let count = 0;
  const d = new Date(todayISO() + "T00:00:00");
  while (true) {
    const dateStr = d.toISOString().slice(0, 10);
    if (set.has(dateStr)) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/* ---------- Tiny Canvas Chart (last 14 days) ---------- */
function renderChart() {
  const ctx = chartEl.getContext("2d");
  const w = chartEl.width = chartEl.clientWidth || 600;
  const h = chartEl.height; // fixed from HTML attribute

  // Background
  ctx.clearRect(0, 0, w, h);

  const days = getLastNDays(14);
  const values = days.map(d => entries.find(e => e.date === d)?.score ?? null);

  // Axes baseline
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(0, h - 18);
  ctx.lineTo(w, h - 18);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Map value (1-5) to y coordinate (invert so 5 is higher)
  const yFor = (v) => {
    const t = (v - 1) / 4; // 0..1
    const padding = 16;
    return (h - padding) - t * (h - padding * 2);
  };

  // Draw line path
  const points = values.map((v, i) => {
    const x = (i / (days.length - 1)) * (w - 8) + 4;
    const y = v ? yFor(v) : null;
    return { x, y };
  });

  // Light grid dots
  ctx.globalAlpha = 0.15;
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, h - 18, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Line (skip gaps)
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  points.forEach(p => {
    if (p.y == null) { started = false; return; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else { ctx.lineTo(p.x, p.y); }
  });
  ctx.stroke();

  // Points
  points.forEach((p, i) => {
    if (p.y == null) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ---------- Export / Import / Clear ---------- */
function onExport() {
  const data = JSON.stringify(entries, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `mood-tracker-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function onImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result) || "[]");
      if (!Array.isArray(incoming)) throw new Error("Invalid file");

      // Merge by date (incoming overwrites)
      const map = new Map(entries.map(x => [x.date, x]));
      for (const it of incoming) {
        if (!it?.date || !it?.moodKey || !it?.score) continue;
        map.set(it.date, {
          id: it.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
          date: it.date,
          moodKey: it.moodKey,
          score: it.score,
          note: it.note || ""
        });
      }
      entries = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
      saveEntries(entries);
      renderAll();
      alert("Import complete ✅");
    } catch (err) {
      alert("Couldn't import that file. Is it valid JSON exported by this app?");
    } finally {
      e.target.value = ""; // reset input so same file can be chosen again
    }
  };
  reader.readAsText(file);
}

function onClearAll() {
  if (!entries.length) return alert("Nothing to clear.");
  if (!confirm("This will permanently delete all entries on this device. Continue?")) return;
  entries = [];
  saveEntries(entries);
  renderAll();
}
