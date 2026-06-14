import React, { useState, useEffect, useRef } from "react";
import {
  Check, Flame, Plus, Trash2, ListChecks, Bell,
  TrendingUp, BookOpen, Activity, Brain, Briefcase,
  Timer as TimerIcon, Play, Pause, RotateCcw, SkipForward,
  Zap, RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from "recharts";
import { supabase, supabaseReady } from "./supabaseClient";

// ---------------------------------------------------------------------------
const C = {
  bg: "#111210", panel: "#191816", elevated: "#222019", border: "#2e2c29",
  borderSoft: "rgba(255,255,255,0.05)", text: "#f0ede8", dim: "#8c8680",
  sage: "#7eb8a0", sageDim: "rgba(126,184,160,0.12)",
  sand: "#c4a882", sandDim: "rgba(196,168,130,0.12)",
  alert: "#e07a6b",
};

const LS_KEY = "focusapp_v3";
const LS_HABITS = "focusapp_habits";
const LS_JOURNAL = "focusapp_journal";

const todayKey = () => new Date().toISOString().slice(0, 10);
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const round1 = (n) => Math.round(n * 10) / 10;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still going?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return h < 21 ? "Good evening" : "Winding down";
}

const AREAS = ["Mind", "Body", "Work", "Growth"];
const AREA_ICONS = { Mind: Brain, Body: Activity, Work: Briefcase, Growth: Zap };
const AREA_COLORS = { Mind: C.sage, Body: C.sand, Work: C.alert, Growth: "#a89bc8" };

const NAV = [
  { id: "Today", Icon: ListChecks },
  { id: "Focus", Icon: TimerIcon },
  { id: "Habits", Icon: RefreshCw },
  { id: "Journal", Icon: BookOpen },
  { id: "Growth", Icon: TrendingUp },
];

const JOURNAL_DEFAULT = { win: "", gratitude: "", friction: "", mood: 0 };

const DEFAULT = {
  defaultTasks: [
    "Plan the 3 things that matter today",
    "One 90-minute deep work block",
    "Phone in another room while working",
  ],
  tasks: [
    { id: 1, label: "Plan the 3 things that matter today", done: false },
    { id: 2, label: "One 90-minute deep work block", done: false },
    { id: 3, label: "Phone in another room while working", done: false },
  ],
  focus: "", hours: "", streak: 0, lastCompletedDay: null,
  sleepHours: "", sleepQuality: 0,
  pomodorosToday: 0, pomodoroDay: null,
  history: [], goals: [],
  energy: 0, intention: "",
};

function withTodayHistory(next) {
  const entry = {
    day: todayKey(), hours: Number(next.hours) || 0,
    completed: next.lastCompletedDay === todayKey(),
    sleepHours: next.sleepHours === "" || next.sleepHours == null ? null : Number(next.sleepHours),
    sleepQuality: next.sleepQuality || 0,
  };
  const rest = next.history.filter((h) => h.day !== todayKey());
  return { ...next, history: [...rest, entry] };
}

async function loadState() {
  let base = DEFAULT;
  try { const raw = localStorage.getItem(LS_KEY); if (raw) base = { ...DEFAULT, ...JSON.parse(raw) }; } catch {}
  if (supabaseReady && supabase) {
    try {
      const [{ data: today }, { data: hist }, { data: goals }] = await Promise.all([
        supabase.from("focus_days").select("*").eq("day", todayKey()).maybeSingle(),
        supabase.from("focus_days").select("day,hours,completed,sleep_hours,sleep_quality").order("day", { ascending: true }),
        supabase.from("goals").select("*").order("created_at", { ascending: true }),
      ]);
      if (today) {
        base = { ...base, tasks: today.tasks ?? base.tasks, focus: today.focus ?? "",
          hours: today.hours ?? "", streak: today.streak ?? base.streak,
          lastCompletedDay: today.last_completed_day ?? base.lastCompletedDay,
          sleepHours: today.sleep_hours ?? "", sleepQuality: today.sleep_quality ?? 0,
          pomodorosToday: today.pomodoros ?? 0, pomodoroDay: todayKey() };
      }
      if (hist) base.history = hist.map((h) => ({ day: h.day, hours: h.hours || 0, completed: !!h.completed,
        sleepHours: h.sleep_hours ?? null, sleepQuality: h.sleep_quality ?? 0 }));
      if (goals) base.goals = goals.map((g) => ({ id: g.id, text: g.text, done: g.done }));
    } catch {}
  }
  return base;
}

async function saveState(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
  if (supabaseReady && supabase) {
    try {
      await supabase.from("focus_days").upsert({
        day: todayKey(), tasks: s.tasks, focus: s.focus,
        hours: s.hours === "" ? null : Number(s.hours),
        completed: s.tasks.length > 0 && s.tasks.every((t) => t.done),
        streak: s.streak, last_completed_day: s.lastCompletedDay,
        sleep_hours: s.sleepHours === "" ? null : Number(s.sleepHours),
        sleep_quality: s.sleepQuality || 0, pomodoros: s.pomodorosToday || 0,
      }, { onConflict: "day" });
    } catch {}
  }
}

function loadHabits() { try { const r = localStorage.getItem(LS_HABITS); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveHabits(h) { try { localStorage.setItem(LS_HABITS, JSON.stringify(h)); } catch {} }
function loadJournal() { try { const r = localStorage.getItem(LS_JOURNAL); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function saveJournal(j) { try { localStorage.setItem(LS_JOURNAL, JSON.stringify(j)); } catch {} }

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [660, 0.18], [440, 0.36]].forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.9);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.9);
    });
  } catch {}
}

function notify(title, body) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  }
}

function habitStreak(log) {
  let count = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (log[key]) count++;
    else if (i === 0) continue;
    else break;
  }
  return count;
}

const last21Days = () => Array.from({ length: 21 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (20 - i));
  return d.toISOString().slice(0, 10);
});

// ---------------------------------------------------------------------------
export default function App() {
  const [data, setData] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState("Today");
  const [habits, setHabits] = useState([]);
  const [journalAll, setJournalAll] = useState({});

  // Timer: use endTime (absolute timestamp) when running for accuracy across tab switches
  const [timer, setTimer] = useState({
    mode: "work", running: false,
    remaining: 25 * 60,  // seconds left (when paused)
    endTime: null,        // Date.now() + remaining*1000 (when running)
    workMin: 25, breakMin: 5, focusMode: "Deep Work",
  });
  const [tick, setTick] = useState(0); // triggers display refresh

  // Ambient sound — kept in App so it survives page switches
  const [sound, setSound] = useState(null);
  const audioCtxRef = useRef(null);
  const audioNodesRef = useRef([]);

  const stopAudio = () => {
    audioNodesRef.current.forEach(n => { try { n.stop?.(); } catch {} });
    audioNodesRef.current = [];
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
  };

  const startAudio = (type) => {
    stopAudio();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);

      if (type === "drone") {
        [55, 110, 165, 220].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.frequency.value = freq;
          g.gain.value = [0.18, 0.12, 0.07, 0.04][i];
          osc.connect(g); g.connect(master); osc.start();
          audioNodesRef.current.push(osc);
        });
        return;
      }

      const rate = ctx.sampleRate;
      const buf = ctx.createBuffer(1, rate * 4, rate);
      const dat = buf.getChannelData(0);
      if (type === "rain") {
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < rate * 4; i++) {
          const w = Math.random() * 2 - 1;
          b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
          b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
          b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
          dat[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
        }
      } else {
        for (let i = 0; i < rate * 4; i++) dat[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = type === "rain" ? "lowpass" : "bandpass";
      flt.frequency.value = type === "rain" ? 900 : 2000;
      if (type === "noise") flt.Q.value = 0.5;
      src.connect(flt); flt.connect(master); src.start();
      audioNodesRef.current.push(src);
    } catch {}
  };

  const toggleSound = (type) => {
    if (sound === type) { stopAudio(); setSound(null); }
    else { startAudio(type); setSound(type); }
  };

  useEffect(() => () => stopAudio(), []); // eslint-disable-line

  // Derived seconds left — accurate regardless of tab state
  const secondsLeft = timer.running && timer.endTime
    ? Math.max(0, Math.floor((timer.endTime - Date.now()) / 1000))
    : timer.remaining;

  useEffect(() => {
    loadState().then((d) => {
      if (d.pomodoroDay !== todayKey()) { d.pomodorosToday = 0; d.pomodoroDay = todayKey(); }
      setData(d); setLoaded(true);
    });
    setHabits(loadHabits());
    setJournalAll(loadJournal());
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => { if (loaded) saveState(data); }, [data, loaded]);
  useEffect(() => { saveHabits(habits); }, [habits]);

  // Display tick — repaint every 500ms while running
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, [timer.running]);

  const patchDay = (patch) => setData((prev) => withTodayHistory({ ...prev, ...patch }));
  const addDeepWork = (mins) =>
    setData((prev) => withTodayHistory({ ...prev, hours: round1((Number(prev.hours) || 0) + mins / 60) }));
  const bumpPomodoro = () =>
    setData((prev) => ({
      ...prev, pomodoroDay: todayKey(),
      pomodorosToday: (prev.pomodoroDay === todayKey() ? prev.pomodorosToday : 0) + 1,
    }));

  // Timer completion — fires once per session end
  const completedRef = useRef(false);
  useEffect(() => {
    if (!timer.running || secondsLeft > 0) { completedRef.current = false; return; }
    if (completedRef.current) return;
    completedRef.current = true;
    playChime();
    if (timer.mode === "work") {
      addDeepWork(timer.workMin);
      bumpPomodoro();
      const bs = timer.breakMin * 60;
      notify("Break time!", `${timer.breakMin}-minute break starting.`);
      setTimer(t => ({ ...t, mode: "break", remaining: bs, endTime: Date.now() + bs * 1000, running: true }));
    } else {
      notify("Break over", "Ready for the next focus session?");
      setTimer(t => ({ ...t, mode: "work", remaining: t.workMin * 60, endTime: null, running: false }));
    }
  }, [secondsLeft, timer.running]); // eslint-disable-line

  // Habit reminders — check every 30s
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = todayKey();
      habits.forEach(h => {
        if (h.reminderTime === hm && !h.log[today]) {
          notify(`Habit: ${h.name}`, "Time to check it off!");
        }
      });
    }, 30000);
    return () => clearInterval(id);
  }, [habits]);

  const patchJournal = (patch) => {
    const key = todayKey();
    const next = { ...journalAll, [key]: { ...(journalAll[key] || JOURNAL_DEFAULT), ...patch } };
    setJournalAll(next);
    saveJournal(next);
  };

  const todayEntry = journalAll[todayKey()] || JOURNAL_DEFAULT;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Geist', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 88px" }}>
        {page === "Today" && <Today data={data} setData={setData} patchDay={patchDay} loaded={loaded} todayEntry={todayEntry} patchJournal={patchJournal} />}
        {page === "Focus" && <FocusPage data={data} timer={timer} setTimer={setTimer} secondsLeft={secondsLeft} sound={sound} toggleSound={toggleSound} />}
        {page === "Habits" && <HabitsPage habits={habits} setHabits={setHabits} />}
        {page === "Journal" && <JournalPage todayEntry={todayEntry} patchJournal={patchJournal} journalAll={journalAll} />}
        {page === "Growth" && <GrowthPage data={data} setData={setData} habits={habits} journalAll={journalAll} />}
      </div>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.panel, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 8px 14px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", width: "100%" }}>
          {NAV.map(({ id, Icon }) => {
            const on = page === id;
            return (
              <button key={id} onClick={() => setPage(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: on ? C.sage : C.dim, padding: "6px 0" }}>
                <Icon size={on ? 22 : 18} strokeWidth={on ? 2 : 1.5} />
                {on && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{id}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Today({ data, setData, patchDay, loaded, todayEntry, patchJournal }) {
  const [newTask, setNewTask] = useState("");
  const done = data.tasks.filter((t) => t.done).length;
  const total = data.tasks.length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const isEvening = new Date().getHours() >= 17;

  useEffect(() => {
    if (!loaded || !allDone || data.lastCompletedDay === todayKey()) return;
    patchDay({ streak: data.streak + 1, lastCompletedDay: todayKey() });
  }, [allDone, loaded]); // eslint-disable-line

  const toggle = (id) => setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }));
  const remove = (id) => setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  const add = () => {
    if (!newTask.trim()) return;
    setData((d) => ({ ...d, tasks: [...d.tasks, { id: Date.now(), label: newTask.trim(), done: false }] }));
    setNewTask("");
  };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>{greeting()}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 99, padding: "6px 14px" }}>
            <Flame size={14} color={data.streak > 0 ? C.sand : C.dim} />
            <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 700, fontSize: 14 }}>{data.streak}</span>
          </div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={secLabel}>Energy today</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>
            {["", "Drained", "Low", "Okay", "Good", "Charged"][data.energy] || "Tap to set"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setData((d) => ({ ...d, energy: n }))} style={{ width: 20, height: 20, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: n <= data.energy ? C.sage : C.elevated, transition: "background 0.15s" }} />
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 10 }}>
        <div style={secLabel}>Today's intention</div>
        <input value={data.intention || ""} onChange={(e) => setData((d) => ({ ...d, intention: e.target.value }))}
          placeholder="The one thing that will make today a win..."
          style={{ ...lineIn, marginTop: 10, fontSize: 16, fontWeight: 500 }} />
      </div>

      <div style={{ ...card, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div style={secLabel}>Today's tasks</div>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, color: allDone ? C.sage : C.dim }}>{done}/{total}</span>
        </div>
        <div style={{ height: 6, background: C.elevated, borderRadius: 99, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: allDone ? C.sage : C.sand, boxShadow: pct > 0 ? `0 0 8px ${allDone ? "rgba(126,184,160,0.45)" : "rgba(196,168,130,0.35)"}` : "none", transition: "width 0.3s ease" }} />
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          {data.tasks.map((t) => (
            <div key={t.id} style={tRow}>
              <button onClick={() => toggle(t.id)} style={cbtn(t.done)}>
                {t.done && <Check size={12} strokeWidth={2.5} color={C.bg} />}
              </button>
              <span style={{ flex: 1, fontSize: 15, opacity: t.done ? 0.3 : 1, textDecoration: t.done ? "line-through" : "none", transition: "opacity 0.2s" }}>{t.label}</span>
              <button onClick={() => remove(t.id)} style={ghost}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task..." style={txIn} />
          <button onClick={add} style={addB}><Plus size={17} /></button>
        </div>
        {allDone && (
          <div style={{ marginTop: 12, padding: "9px 14px", background: "rgba(126,184,160,0.08)", border: "1px solid rgba(126,184,160,0.22)", borderRadius: 10, color: C.sage, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
            List complete - streak extended
          </div>
        )}
      </div>

      {isEvening && (
        <div style={card}>
          <div style={secLabel}>Evening review</div>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Today's win</div>
              <textarea value={todayEntry.win} onChange={(e) => patchJournal({ win: e.target.value })} placeholder="What went well today?" rows={2} style={txArea} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Gratitude</div>
              <textarea value={todayEntry.gratitude} onChange={(e) => patchJournal({ gratitude: e.target.value })} placeholder="Something you're grateful for..." rows={2} style={txArea} />
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: C.dim, textAlign: "center", opacity: 0.45, marginTop: 16 }}>
        {supabaseReady ? "Syncing with Supabase" : "Saving locally"}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function FocusPage({ data, timer, setTimer, secondsLeft, sound, toggleSound }) {
  const totalSeconds = (timer.mode === "work" ? timer.workMin : timer.breakMin) * 60;
  const frac = totalSeconds ? 1 - secondsLeft / totalSeconds : 0;
  const size = 220, stroke = 18, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const ringColor = timer.mode === "work" ? C.sand : C.sage;
  const MODES = ["Deep Work", "Light", "Flow"];
  const SOUNDS = [["rain", "Rain"], ["noise", "White Noise"], ["drone", "Drone"]];

  const toggle = () => setTimer(t => {
    if (t.running) {
      const rem = t.endTime ? Math.max(0, Math.floor((t.endTime - Date.now()) / 1000)) : t.remaining;
      return { ...t, running: false, remaining: rem, endTime: null };
    }
    return { ...t, running: true, endTime: Date.now() + t.remaining * 1000 };
  });

  const reset = () => setTimer(t => ({
    ...t, running: false,
    remaining: (t.mode === "work" ? t.workMin : t.breakMin) * 60, endTime: null,
  }));

  const skip = () => setTimer(t => {
    const nm = t.mode === "work" ? "break" : "work";
    return { ...t, mode: nm, remaining: (nm === "work" ? t.workMin : t.breakMin) * 60, endTime: null, running: false };
  });

  const preset = (w, b) => setTimer(t => ({
    ...t, workMin: w, breakMin: b, mode: "work", remaining: w * 60, endTime: null, running: false,
  }));

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Focus</h1>
      <p style={{ margin: "0 0 16px", color: C.dim, fontSize: 14 }}>Work in focused blocks. Each session logs your deep-work hours.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {MODES.map((m) => (
          <button key={m} onClick={() => setTimer(t => ({ ...t, focusMode: m }))} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: timer.focusMode === m ? C.sand : C.elevated, color: timer.focusMode === m ? C.bg : C.dim, border: `1px solid ${timer.focusMode === m ? C.sand : C.border}`, transition: "all 0.15s" }}>{m}</button>
        ))}
      </div>

      <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, color: timer.mode === "work" ? C.sand : C.sage, padding: "4px 14px", borderRadius: 99, background: timer.mode === "work" ? C.sandDim : C.sageDim, border: `1px solid ${timer.mode === "work" ? "rgba(196,168,130,0.3)" : "rgba(126,184,160,0.3)"}`, transition: "all 0.3s" }}>
          {timer.mode === "work" ? timer.focusMode : "Break"}
        </div>

        <div style={{ position: "relative", width: size, height: size, margin: "16px 0" }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)", filter: timer.running ? `drop-shadow(0 0 12px ${ringColor}99)` : "none", transition: "filter 0.5s ease" }}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke={C.elevated} strokeWidth={stroke} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={r} stroke={ringColor} strokeWidth={stroke} fill="none"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
              style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 50, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
              {fmt(secondsLeft)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={toggle} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: ringColor, color: C.bg, border: "none", borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            {timer.running ? <Pause size={18} /> : <Play size={18} />}{timer.running ? "Pause" : "Start"}
          </button>
          <button onClick={reset} style={ctrlBtn}><RotateCcw size={17} /></button>
          <button onClick={skip} style={ctrlBtn}><SkipForward size={17} /></button>
        </div>

        <div style={{ marginTop: 16, fontFamily: "'Geist Mono', monospace", fontSize: 12, color: C.dim, background: C.elevated, borderRadius: 99, padding: "5px 16px", border: `1px solid ${C.border}` }}>
          <strong style={{ color: C.text }}>{data.pomodorosToday}</strong>{" "}session{data.pomodorosToday !== 1 ? "s" : ""} today
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {[[25, 5], [50, 10]].map(([w, b]) => {
          const on = timer.workMin === w && timer.breakMin === b;
          return (
            <button key={w} onClick={() => preset(w, b)} style={{ flex: 1, background: on ? C.elevated : "transparent", color: on ? C.text : C.dim, border: `1px solid ${on ? C.sand : C.border}`, borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{w} / {b} min</button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ ...secLabel, marginBottom: 8 }}>Ambient sound</div>
        <div style={{ display: "flex", gap: 8 }}>
          {SOUNDS.map(([type, label]) => (
            <button key={type} onClick={() => toggleSound(type)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", background: sound === type ? C.sageDim : "transparent", color: sound === type ? C.sage : C.dim, border: `1px solid ${sound === type ? C.sage : C.border}`, transition: "all 0.15s" }}>{label}</button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function HabitsPage({ habits, setHabits }) {
  const [newName, setNewName] = useState("");
  const [newArea, setNewArea] = useState("Mind");
  const today = todayKey();
  const days = last21Days();

  const addHabit = () => {
    if (!newName.trim()) return;
    setHabits((h) => [...h, { id: Date.now(), name: newName.trim(), area: newArea, log: {}, reminderTime: null }]);
    setNewName("");
  };
  const toggleHabit = (id) => setHabits((hs) => hs.map((h) => {
    if (h.id !== id) return h;
    const log = { ...h.log };
    if (log[today]) delete log[today]; else log[today] = true;
    return { ...h, log };
  }));
  const removeHabit = (id) => setHabits((hs) => hs.filter((h) => h.id !== id));
  const setReminder = (id, time) => setHabits((hs) => hs.map((h) => h.id === id ? { ...h, reminderTime: time || null } : h));

  const byArea = AREAS.reduce((acc, a) => { acc[a] = habits.filter((h) => h.area === a); return acc; }, {});

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Habits</h1>
      <p style={{ margin: "0 0 20px", color: C.dim, fontSize: 14 }}>Small daily actions that compound over time.</p>

      {habits.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "32px 20px", color: C.dim, marginBottom: 14 }}>
          <div style={{ fontSize: 14 }}>No habits yet. Add your first one below.</div>
        </div>
      )}

      {AREAS.map((area) => {
        const aHabits = byArea[area];
        if (!aHabits.length) return null;
        const AreaIcon = AREA_ICONS[area];
        const aColor = AREA_COLORS[area];
        return (
          <div key={area} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <AreaIcon size={13} color={aColor} />
              <span style={{ fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: C.dim, fontWeight: 600 }}>{area}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {aHabits.map((h) => {
                const streak = habitStreak(h.log);
                const doneToday = !!h.log[today];
                return (
                  <div key={h.id} style={{ background: C.panel, borderRadius: 14, padding: 14, border: `1px solid ${doneToday ? aColor + "55" : C.border}`, transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, flex: 1, paddingRight: 6 }}>{h.name}</span>
                      <button onClick={() => removeHabit(h.id)} style={{ ...ghost, padding: 2 }}><Trash2 size={11} /></button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 10 }}>
                      {days.map((d) => (
                        <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: h.log[d] ? aColor : C.elevated, outline: d === today ? `1.5px solid ${aColor}` : "none", outlineOffset: 1 }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: C.dim, fontFamily: "'Geist Mono', monospace" }}>
                        {streak > 0 ? `${streak}d streak` : "Start today"}
                      </span>
                      <button onClick={() => toggleHabit(h.id)} style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", background: doneToday ? aColor : C.elevated, border: `1.5px solid ${doneToday ? aColor : C.border}`, display: "grid", placeItems: "center", transition: "all 0.15s" }}>
                        {doneToday && <Check size={12} strokeWidth={2.5} color={C.bg} />}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <Bell size={10} color={h.reminderTime ? aColor : C.dim} />
                      <input type="time" value={h.reminderTime || ""}
                        onChange={e => setReminder(h.id, e.target.value)}
                        style={{ fontSize: 11, color: h.reminderTime ? aColor : C.dim, background: "transparent", border: "none", outline: "none", cursor: "pointer", fontFamily: "inherit", flex: 1 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={card}>
        <div style={secLabel}>Add a habit</div>
        <div style={{ display: "flex", gap: 8, margin: "12px 0 10px" }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} placeholder="Habit name..." style={txIn} />
          <button onClick={addHabit} style={addB}><Plus size={17} /></button>
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          {AREAS.map((a) => (
            <button key={a} onClick={() => setNewArea(a)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", background: newArea === a ? AREA_COLORS[a] : C.elevated, color: newArea === a ? C.bg : C.dim, border: `1px solid ${newArea === a ? AREA_COLORS[a] : C.border}`, transition: "all 0.15s" }}>{a}</button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function JournalPage({ todayEntry, patchJournal, journalAll }) {
  const [weekMode, setWeekMode] = useState(false);
  const MOODS = ["", "Rough", "Low", "Okay", "Good", "Great"];
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 2px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Journal</h1>
          <div style={{ fontSize: 12, color: C.dim }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <button onClick={() => setWeekMode(!weekMode)} style={{ fontSize: 12, color: weekMode ? C.sage : C.dim, background: C.elevated, border: `1px solid ${weekMode ? C.sage : C.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
          {weekMode ? "Today" : "Week"}
        </button>
      </div>

      {!weekMode ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={card}>
            <div style={secLabel}>Mood</div>
            <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => patchJournal({ mood: n })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: "pointer", background: todayEntry.mood === n ? C.sage : C.elevated, color: todayEntry.mood === n ? C.bg : C.dim, border: `1px solid ${todayEntry.mood === n ? C.sage : C.border}`, transition: "all 0.15s" }}>{MOODS[n]}</button>
              ))}
            </div>
          </div>
          <div style={card}>
            <div style={secLabel}>Today's win</div>
            <textarea value={todayEntry.win} onChange={(e) => patchJournal({ win: e.target.value })} placeholder="What went well today?" rows={3} style={{ ...txArea, marginTop: 10 }} />
          </div>
          <div style={card}>
            <div style={secLabel}>Gratitude</div>
            <textarea value={todayEntry.gratitude} onChange={(e) => patchJournal({ gratitude: e.target.value })} placeholder="Something you're grateful for..." rows={3} style={{ ...txArea, marginTop: 10 }} />
          </div>
          <div style={card}>
            <div style={secLabel}>What's holding you back?</div>
            <textarea value={todayEntry.friction} onChange={(e) => patchJournal({ friction: e.target.value })} placeholder="Friction, blockers, or fears..." rows={3} style={{ ...txArea, marginTop: 10 }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {days7.map((d) => {
            const entry = journalAll[d] || {};
            return (
              <div key={d} style={{ ...card, padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {entry.mood > 0 && <span style={{ fontSize: 11, color: C.sage, fontWeight: 600 }}>{MOODS[entry.mood]}</span>}
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: entry.win ? C.sage : C.border }} />
                  </div>
                </div>
                {entry.win && <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>{entry.win}</div>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function GrowthPage({ data, setData, habits, journalAll }) {
  const [newGoal, setNewGoal] = useState("");

  const addGoal = async () => {
    if (!newGoal.trim()) return;
    const g = { id: Date.now(), text: newGoal.trim(), done: false };
    setData((d) => ({ ...d, goals: [...d.goals, g] }));
    setNewGoal("");
    if (supabaseReady && supabase) { try { await supabase.from("goals").insert({ text: g.text, done: false }); } catch {} }
  };
  const toggleGoal = (id) => setData((d) => ({ ...d, goals: d.goals.map((g) => g.id === id ? { ...g, done: !g.done } : g) }));
  const removeGoal = (id) => setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));

  const days7 = [...data.history].sort((a, b) => a.day.localeCompare(b.day)).slice(-7);
  const chartData = days7.map((h) => ({ name: shortDay(h.day), hours: h.hours, completed: h.completed }));
  const totalHours = data.history.reduce((s, h) => s + (h.hours || 0), 0);
  const completedDays = data.history.filter((h) => h.completed).length;
  const rate = data.history.length ? Math.round((completedDays / data.history.length) * 100) : 0;
  const today = todayKey();

  // Mood trend — last 14 days
  const moodData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    const entry = journalAll[key] || {};
    return { name: new Date(key + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1), mood: entry.mood || null, key };
  });
  const hasMoodData = moodData.some(d => d.mood);

  // Habit completion per area — last 7 days
  const habitTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const day = d.toISOString().slice(0, 10);
    const row = { name: shortDay(day) };
    AREAS.forEach(area => {
      const ah = habits.filter(h => h.area === area);
      if (ah.length) row[area] = Math.round(ah.filter(h => h.log[day]).length / ah.length * 100);
    });
    return row;
  });
  const activeAreas = AREAS.filter(a => habits.some(h => h.area === a));

  const habitAreas = activeAreas.map(area => ({
    area, total: habits.filter(h => h.area === area).length,
    done: habits.filter(h => h.area === area && h.log[today]).length,
  }));

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Growth</h1>
      <p style={{ margin: "0 0 18px", color: C.dim, fontSize: 14 }}>Your trajectory across all areas.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9, marginBottom: 12 }}>
        <MiniStat label="Streak" value={data.streak} suffix="d" color={C.sand} />
        <MiniStat label="Deep Work" value={round1(totalHours)} suffix="h" color={C.sage} />
        <MiniStat label="Completion" value={`${rate}%`} color={C.alert} />
      </div>

      {chartData.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={secLabel}>Deep work - last 7 days</div>
          <div style={{ height: 160, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <XAxis dataKey="name" stroke={C.dim} tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }} />
                <Bar dataKey="hours" radius={[5, 5, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.completed ? C.sand : C.border} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasMoodData && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={secLabel}>Mood - last 14 days</div>
          <div style={{ height: 140, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moodData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={C.dim} tickLine={false} axisLine={false} fontSize={10} interval={1} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke={C.dim} tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip contentStyle={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                  formatter={(v) => [["", "Rough", "Low", "Okay", "Good", "Great"][v] || v, "Mood"]} />
                <Line type="monotone" dataKey="mood" stroke={C.sage} strokeWidth={2} dot={{ fill: C.sage, r: 3, strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeAreas.length > 0 && habits.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={secLabel}>Habit completion - last 7 days</div>
          <div style={{ height: 150, marginTop: 14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={habitTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={C.dim} tickLine={false} axisLine={false} fontSize={10} />
                <YAxis domain={[0, 100]} stroke={C.dim} tickLine={false} axisLine={false} fontSize={10} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }}
                  formatter={(v, name) => [`${v}%`, name]} />
                {activeAreas.map(area => (
                  <Line key={area} type="monotone" dataKey={area} stroke={AREA_COLORS[area]} strokeWidth={1.5} dot={{ fill: AREA_COLORS[area], r: 2, strokeWidth: 0 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
            {activeAreas.map(area => (
              <div key={area} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: AREA_COLORS[area] }} />
                <span style={{ fontSize: 11, color: C.dim }}>{area}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {habitAreas.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={secLabel}>Habits today</div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {habitAreas.map(({ area, total, done }) => {
              const AreaIcon = AREA_ICONS[area];
              const color = AREA_COLORS[area];
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={area} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AreaIcon size={13} color={color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, width: 48, color: C.dim, flexShrink: 0 }}>{area}</span>
                  <div style={{ flex: 1, height: 5, background: C.elevated, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: C.dim, width: 32, textAlign: "right" }}>{done}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div style={secLabel}>Goals</div>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: C.sand }}>
            {data.goals.filter((g) => g.done).length}/{data.goals.length}
          </span>
        </div>
        {data.goals.length === 0 && <div style={{ color: C.dim, fontSize: 14, padding: "6px 0 10px" }}>No goals yet. Add the first one below.</div>}
        <div style={{ display: "grid", gap: 7, marginBottom: data.goals.length ? 12 : 0 }}>
          {data.goals.map((g) => (
            <div key={g.id} style={tRow}>
              <button onClick={() => toggleGoal(g.id)} style={cbtn(g.done)}>
                {g.done && <Check size={12} strokeWidth={2.5} color={C.bg} />}
              </button>
              <span style={{ flex: 1, fontSize: 15, opacity: g.done ? 0.3 : 1, textDecoration: g.done ? "line-through" : "none", transition: "opacity 0.2s" }}>{g.text}</span>
              <button onClick={() => removeGoal(g.id)} style={ghost}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGoal()} placeholder="Add a goal..." style={txIn} />
          <button onClick={addGoal} style={addB}><Plus size={17} /></button>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, suffix = "", color }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 12px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.02em" }}>
        {value}<span style={{ fontSize: 11, color: C.dim, fontWeight: 500 }}>{suffix}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const card = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
const secLabel = { fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: C.dim, fontWeight: 600 };
const lineIn = { width: "100%", background: "transparent", border: "none", color: C.text, outline: "none", fontFamily: "inherit" };
const txIn = { flex: 1, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 15, outline: "none", fontFamily: "inherit" };
const addB = { width: 44, height: 44, background: C.sage, border: "none", borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer", color: C.bg, flexShrink: 0 };
const tRow = { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.elevated, border: `1px solid ${C.borderSoft}`, borderRadius: 12 };
const cbtn = (on) => ({ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", cursor: "pointer", background: on ? C.sage : "transparent", border: `1.5px solid ${on ? C.sage : C.border}`, transition: "background 0.15s, border-color 0.15s" });
const ghost = { background: "none", border: "none", color: C.dim, cursor: "pointer", padding: 4 };
const txArea = { width: "100%", boxSizing: "border-box", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", color: C.text, fontSize: 14, outline: "none", fontFamily: "inherit", resize: "none" };
const ctrlBtn = { width: 46, height: 46, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 12, display: "grid", placeItems: "center", cursor: "pointer", color: C.text };
