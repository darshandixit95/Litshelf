"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
//  CONFIG — Books auto-load from your repo at runtime.
//   Just drop each book JSON in /public/books/<anything>.json
//   The GitHub Action auto-builds /public/books/index.json.
// ============================================================
const BOOKS_INDEX_URL = "/books/index.json";
const BOOKS_DIR = "/books";

const GOAL_MINUTES = 15;
const GOAL_CHAPTERS = 1; // 1-2 chapters; 1 = goal met, 2 = bonus

const LS_TRACKER = "litshelf_tracker_v1";
const LS_READ = "litshelf_read_v1";

const CATEGORY_ORDER = ["Self Help", "Business", "Psychology", "Fiction", "Tech", "Biography", "Other"];
const FONT_SERIF = `Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif`;
const FONT_UI = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif`;
const palette = { parchment: "#F2EAD8", cream: "#FAF6EE", mahogany: "#2C1810", gold: "#C4973F", sage: "#8B9E7A", ink: "#3A2E25", muted: "#9A8B78", wood: "#6B4A32", woodDark: "#4A3220" };

const dayKey = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const parseMinutes = (rt) => { const m = /(\d+)/.exec(rt || ""); return m ? parseInt(m[1], 10) : 8; };
const lastNDays = (n) => { const a = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push(dayKey(d)); } return a; };

function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16); const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0xff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
function loadJSON(key, fallback) { try { const r = typeof window !== "undefined" && window.localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } }
function saveJSON(key, val) { try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function ContentBlock({ block, fontScale, dark }) {
  const bodyColor = dark ? "#d8cfc0" : palette.ink; const fs = (n) => `${n * fontScale}px`;
  if (block.type === "insight") return <div style={{ borderLeft: `3px solid ${palette.gold}`, paddingLeft: "20px", margin: "30px 0" }}><p style={{ fontSize: fs(21), lineHeight: 1.62, color: dark ? "#f0e6d4" : palette.mahogany, fontWeight: 500, margin: 0, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{block.text}</p></div>;
  if (block.type === "callout") return <div style={{ background: dark ? "#241a12" : "#EDE2CC", borderRadius: "10px", padding: "20px 22px", margin: "28px 0", border: `1px solid ${dark ? "#3a2c1d" : "#E0D2B6"}` }}><p style={{ fontSize: fs(11), fontWeight: 700, letterSpacing: "0.1em", color: palette.gold, textTransform: "uppercase", margin: "0 0 10px", fontFamily: FONT_UI }}>{block.label}</p><p style={{ fontSize: fs(16), lineHeight: 1.7, color: bodyColor, margin: 0, fontFamily: FONT_SERIF }}>{block.text}</p></div>;
  if (block.type === "takeaway") return <div style={{ background: palette.mahogany, borderRadius: "10px", padding: "22px 24px", margin: "34px 0 8px" }}><p style={{ fontSize: fs(11), fontWeight: 700, letterSpacing: "0.1em", color: palette.gold, textTransform: "uppercase", margin: "0 0 10px", fontFamily: FONT_UI }}>Key Takeaway</p><p style={{ fontSize: fs(16), lineHeight: 1.72, color: "#F2EAD8", margin: 0, fontFamily: FONT_SERIF }}>{block.text}</p></div>;
  return <p style={{ fontSize: fs(17.5), lineHeight: 1.82, color: bodyColor, margin: "20px 0", fontFamily: FONT_SERIF }}>{block.text}</p>;
}

function BookSpine({ book, onClick, progress }) {
  const heights = [168, 156, 176, 162, 172]; const h = heights[book.title.length % heights.length];
  return (
    <button onClick={onClick} onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-8px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      style={{ width: "46px", height: `${h}px`, background: `linear-gradient(180deg, ${book.spineColor} 0%, ${shade(book.spineColor, -18)} 100%)`, border: "none", borderRadius: "3px 3px 2px 2px", cursor: "pointer", position: "relative", boxShadow: "2px 4px 12px rgba(0,0,0,0.35), inset -2px 0 4px rgba(0,0,0,0.25), inset 2px 0 3px rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "12px 4px", flexShrink: 0, transition: "transform 0.25s ease", fontFamily: FONT_UI }}>
      <div style={{ width: "100%", height: "3px", background: book.accent, borderRadius: "1px", opacity: 0.85 }} />
      <div style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", color: "rgba(255,255,255,0.92)", fontSize: "11px", fontWeight: 600, fontFamily: FONT_SERIF, lineHeight: 1.1, maxHeight: `${h - 50}px`, overflow: "hidden", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{book.title}</div>
      <div style={{ width: "100%", height: "3px", background: book.accent, borderRadius: "1px", opacity: 0.85 }} />
      {progress > 0 && <div style={{ position: "absolute", bottom: "5px", left: "50%", transform: "translateX(-50%)", width: "6px", height: "6px", borderRadius: "50%", background: progress === 100 ? palette.gold : "rgba(255,255,255,0.5)" }} />}
    </button>
  );
}

function BarChart({ data, labels, goal, dark, unit }) {
  const max = Math.max(goal * 1.2, ...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "5px", height: "110px", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(goal / max) * 100}%`, borderTop: `1px dashed ${palette.gold}`, opacity: 0.6 }} />
      {data.map((v, i) => {
        const hit = v >= goal;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", height: "100%", justifyContent: "flex-end" }}>
            <div title={`${v} ${unit}`} style={{ width: "100%", maxWidth: "26px", height: `${(v / max) * 100}%`, minHeight: v > 0 ? "4px" : "0", borderRadius: "4px 4px 0 0", background: hit ? palette.gold : (dark ? "#3a2c1d" : "#D8C8A8"), transition: "height 0.4s" }} />
            <span style={{ fontSize: "9px", color: dark ? "#7a6e5c" : palette.muted, fontFamily: FONT_UI }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LitshelfApp() {
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [view, setView] = useState("library");
  const [activeBookId, setActiveBookId] = useState(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const [readMap, setReadMap] = useState({});
  const [tracker, setTracker] = useState<{ days: Record<string, { minutes: number; chapters: number; titles: string[] }> }>({ days: {} });
  const [dark, setDark] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const readStartRef = useRef(null);

  useEffect(() => {
    setTracker(loadJSON(LS_TRACKER, { days: {} }));
    const r = loadJSON(LS_READ, {});
    const rebuilt = {}; Object.keys(r).forEach((bid) => (rebuilt[bid] = new Set(r[bid])));
    setReadMap(rebuilt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idxRes = await fetch(BOOKS_INDEX_URL);
        if (!idxRes.ok) throw new Error("no index");
        const ids = await idxRes.json();
        const loaded = await Promise.all(ids.map(async (id) => {
          try { const res = await fetch(`${BOOKS_DIR}/${id}.json`); if (!res.ok) return null; const b = await res.json(); if (!b.id) b.id = id; if (!b.spineColor) b.spineColor = "#5A4632"; if (!b.accent) b.accent = palette.gold; return b; } catch { return null; }
        }));
        const valid = loaded.filter(Boolean);
        if (!cancelled) setBooks(valid);
      } catch { if (!cancelled) setBooks([]); }
      finally { if (!cancelled) setLoadingBooks(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistRead = (map) => { const p = {}; Object.keys(map).forEach((k) => (p[k] = [...map[k]])); saveJSON(LS_READ, p); };
  const activeBook = books.find((b) => b.id === activeBookId);
  const readSet = readMap[activeBookId] || new Set();
  const bookProgress = (book) => { const s = readMap[book.id] || new Set(); return Math.round((s.size / book.chapters.length) * 100); };

  const recordChapter = useCallback((book, chapter) => {
    const minutes = readStartRef.current ? Math.max(1, Math.round((Date.now() - readStartRef.current) / 60000)) : parseMinutes(chapter.readTime);
    setTracker((prev) => {
      const days = { ...prev.days }; const k = dayKey();
      const t = days[k] || { minutes: 0, chapters: 0, titles: [] };
      days[k] = { minutes: t.minutes + Math.min(minutes, parseMinutes(chapter.readTime) + 20), chapters: t.chapters + 1, titles: [...t.titles, `${book.title} - Ch.${chapter.id}`] };
      const next = { days }; saveJSON(LS_TRACKER, next); return next;
    });
  }, []);

  const markRead = (bookId, chapterId) => {
    setReadMap((prev) => { const s = new Set(prev[bookId] || []); s.add(chapterId); const next = { ...prev, [bookId]: s }; persistRead(next); return next; });
  };

  const grouped = {}; books.forEach((b) => { const c = b.category || "Other"; (grouped[c] = grouped[c] || []).push(b); });
  const sortedCats = Object.keys(grouped).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [activeChapter, view]);
  const pageBg = dark ? "#161009" : palette.parchment;

  if (view === "stats") {
    const days = tracker.days || {};
    const today = days[dayKey()] || { minutes: 0, chapters: 0, titles: [] };

    let streak = 0;
    {
      let i = 0; const todayRec = days[dayKey()];
      if (!todayRec || (todayRec.chapters === 0 && todayRec.minutes < GOAL_MINUTES)) i = 1;
      for (; ; i++) { const d = new Date(); d.setDate(d.getDate() - i); const rec = days[dayKey(d)]; if (rec && (rec.chapters > 0 || rec.minutes >= GOAL_MINUTES)) streak++; else break; if (i > 400) break; }
    }

    const week = lastNDays(7);
    const weekMin = week.map((k) => days[k]?.minutes || 0);
    const weekLabels = week.map((k) => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(k).getDay()]);
    const totalMin = Object.values(days).reduce((s, d) => s + (d.minutes || 0), 0);
    const totalCh = Object.values(days).reduce((s, d) => s + (d.chapters || 0), 0);
    const activeDays = Object.values(days).filter((d) => d.chapters > 0 || d.minutes >= GOAL_MINUTES).length;
    const month = lastNDays(30);
    const monthMin = month.reduce((s, k) => s + (days[k]?.minutes || 0), 0);
    const monthCh = month.reduce((s, k) => s + (days[k]?.chapters || 0), 0);

    const exportData = () => {
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), goals: { minutes: GOAL_MINUTES, chapters: GOAL_CHAPTERS }, tracker }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `litshelf-tracker-${dayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    };

    const minHit = today.minutes >= GOAL_MINUTES, chHit = today.chapters >= GOAL_CHAPTERS;
    const card = (label, value, sub) => (
      <div style={{ flex: 1, background: dark ? "#1d1610" : palette.cream, border: `1px solid ${dark ? "#2a2016" : "#E8DCC4"}`, borderRadius: "14px", padding: "16px" }}>
        <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: palette.gold, textTransform: "uppercase", fontFamily: FONT_UI }}>{label}</p>
        <p style={{ margin: 0, fontSize: "26px", fontWeight: 700, color: dark ? "#f0e6d4" : palette.mahogany, fontFamily: FONT_SERIF }}>{value}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: "12px", color: dark ? "#7a6e5c" : palette.muted, fontFamily: FONT_UI }}>{sub}</p>}
      </div>
    );

    return (
      <div style={{ minHeight: "100vh", background: pageBg, fontFamily: FONT_UI }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: pageBg + "f2", backdropFilter: "blur(10px)", borderBottom: `1px solid ${dark ? "#2a2016" : "#E5D9C0"}`, height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <button onClick={() => setView("library")} style={btnGhost(dark)}>&lsaquo; Library</button>
          <button onClick={() => setDark(!dark)} style={fontBtn(dark)}>{dark ? "\u2600" : "\u263e"}</button>
        </div>
        <div style={{ maxWidth: "620px", margin: "0 auto", padding: "26px 22px 60px" }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: 700, color: dark ? "#f0e6d4" : palette.mahogany, fontFamily: FONT_SERIF }}>Reading Tracker</h1>
          <p style={{ margin: "0 0 24px", fontSize: "14px", color: dark ? "#a99b85" : palette.muted, fontStyle: "italic", fontFamily: FONT_SERIF }}>Daily goal: {GOAL_MINUTES} min or {GOAL_CHAPTERS}-2 chapters</p>

          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <div style={{ flex: 1, background: minHit ? palette.gold : (dark ? "#1d1610" : palette.cream), border: `1px solid ${minHit ? palette.gold : (dark ? "#2a2016" : "#E8DCC4")}`, borderRadius: "14px", padding: "16px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: minHit ? "#fff" : palette.gold, textTransform: "uppercase" }}>Today - Minutes</p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: minHit ? "#fff" : (dark ? "#f0e6d4" : palette.mahogany), fontFamily: FONT_SERIF }}>{today.minutes}<span style={{ fontSize: "14px", opacity: 0.7 }}> / {GOAL_MINUTES}</span></p>
            </div>
            <div style={{ flex: 1, background: chHit ? palette.gold : (dark ? "#1d1610" : palette.cream), border: `1px solid ${chHit ? palette.gold : (dark ? "#2a2016" : "#E8DCC4")}`, borderRadius: "14px", padding: "16px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: chHit ? "#fff" : palette.gold, textTransform: "uppercase" }}>Today - Chapters</p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: chHit ? "#fff" : (dark ? "#f0e6d4" : palette.mahogany), fontFamily: FONT_SERIF }}>{today.chapters}<span style={{ fontSize: "14px", opacity: 0.7 }}> / {GOAL_CHAPTERS}-2</span></p>
            </div>
          </div>

          <div style={{ background: palette.mahogany, borderRadius: "14px", padding: "18px 20px", marginBottom: "22px", display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "30px" }}>{"\uD83D\uDD25"}</span>
            <div><p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: palette.parchment, fontFamily: FONT_SERIF }}>{streak} day{streak === 1 ? "" : "s"}</p><p style={{ margin: 0, fontSize: "12px", color: "#a99b85" }}>current reading streak</p></div>
          </div>

          <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.05em", color: dark ? "#c4b59c" : palette.mahogany, fontFamily: FONT_SERIF, margin: "0 0 12px" }}>This Week - Minutes</p>
          <div style={{ background: dark ? "#1d1610" : palette.cream, border: `1px solid ${dark ? "#2a2016" : "#E8DCC4"}`, borderRadius: "14px", padding: "18px 16px 12px", marginBottom: "22px" }}>
            <BarChart data={weekMin} labels={weekLabels} goal={GOAL_MINUTES} dark={dark} unit="min" />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>{card("This Month", `${monthMin}m`, `${monthCh} chapters`)}{card("Active Days", activeDays, "goal met")}</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>{card("All-Time Min", totalMin, "minutes read")}{card("All-Time Ch", totalCh, "chapters read")}</div>

          <button onClick={exportData} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", cursor: "pointer", background: palette.mahogany, color: palette.parchment, fontSize: "15px", fontWeight: 600, fontFamily: FONT_UI }}>{"\u2913"} Export tracker data (JSON)</button>
          <p style={{ margin: "12px 0 0", fontSize: "12px", color: dark ? "#7a6e5c" : palette.muted, textAlign: "center", fontFamily: FONT_UI }}>Your progress is saved on this device. Export anytime for a backup.</p>
        </div>
      </div>
    );
  }

  if (view === "read" && activeBook) {
    const ch = activeBook.chapters[activeChapter];
    const readBg = dark ? "#161009" : palette.cream;
    if (readStartRef.current === null) readStartRef.current = Date.now();
    return (
      <div style={{ minHeight: "100vh", background: readBg, fontFamily: FONT_UI }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: readBg + "f2", backdropFilter: "blur(10px)", borderBottom: `1px solid ${dark ? "#2a2016" : "#E5D9C0"}`, height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <button onClick={() => { readStartRef.current = null; setView("book"); }} style={btnGhost(dark)}>&lsaquo; {activeBook.title}</button>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => setFontScale((s) => Math.max(0.85, s - 0.1))} style={fontBtn(dark)}>A-</button>
            <button onClick={() => setFontScale((s) => Math.min(1.4, s + 0.1))} style={fontBtn(dark)}>A+</button>
            <button onClick={() => setDark(!dark)} style={fontBtn(dark)}>{dark ? "\u2600" : "\u263e"}</button>
          </div>
        </div>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "0 22px 80px" }}>
          <div style={{ padding: "32px 0 18px" }}>
            <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", color: palette.gold, textTransform: "uppercase" }}>Chapter {ch.id} - {ch.readTime}</p>
            <h1 style={{ margin: 0, fontSize: `${30 * fontScale}px`, fontWeight: 700, color: dark ? "#f0e6d4" : palette.mahogany, lineHeight: 1.18, fontFamily: FONT_SERIF }}>{ch.title}</h1>
            <p style={{ margin: "16px 0 0", fontSize: "15px", lineHeight: 1.5, color: dark ? "#a99b85" : palette.muted, fontStyle: "italic", fontFamily: FONT_SERIF }}>{ch.keyIdea}</p>
          </div>
          <div style={{ height: "1px", background: dark ? "#2a2016" : "#E5D9C0", margin: "6px 0 10px" }} />
          {ch.content.map((b, i) => <ContentBlock key={i} block={b} fontScale={fontScale} dark={dark} />)}
          <div style={{ display: "flex", gap: "10px", marginTop: "44px" }}>
            {activeChapter > 0 && <button onClick={() => { readStartRef.current = Date.now(); setActiveChapter((c) => c - 1); }} style={navBtn(dark, false)}>&lsaquo; Previous</button>}
            <button onClick={() => {
              markRead(activeBook.id, ch.id); recordChapter(activeBook, ch); readStartRef.current = Date.now();
              if (activeChapter < activeBook.chapters.length - 1) setActiveChapter((c) => c + 1);
              else { readStartRef.current = null; setView("book"); }
            }} style={navBtn(dark, true)}>{activeChapter < activeBook.chapters.length - 1 ? "Next Chapter \u203a" : "Finish \u2713"}</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "24px", flexWrap: "wrap" }}>
            {activeBook.chapters.map((_, i) => <div key={i} style={{ width: i === activeChapter ? "22px" : "6px", height: "6px", borderRadius: "3px", background: i === activeChapter ? palette.gold : (dark ? "#3a2c1d" : "#D8C8A8"), transition: "width 0.3s" }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (view === "book" && activeBook) {
    return (
      <div style={{ minHeight: "100vh", background: pageBg, fontFamily: FONT_UI }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: pageBg + "f2", backdropFilter: "blur(10px)", borderBottom: `1px solid ${dark ? "#2a2016" : "#E5D9C0"}`, height: "52px", display: "flex", alignItems: "center", padding: "0 18px" }}>
          <button onClick={() => setView("library")} style={btnGhost(dark)}>&lsaquo; Library</button>
        </div>
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: "0 22px 50px" }}>
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", padding: "30px 0 24px" }}>
            <div style={{ width: "96px", height: "140px", borderRadius: "4px 8px 8px 4px", flexShrink: 0, background: `linear-gradient(135deg, ${activeBook.spineColor} 0%, ${shade(activeBook.spineColor, -20)} 100%)`, boxShadow: "4px 8px 24px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "5px", background: "rgba(0,0,0,0.2)" }} />
              <p style={{ color: "rgba(255,255,255,0.95)", fontSize: "15px", fontWeight: 700, textAlign: "center", fontFamily: FONT_SERIF, lineHeight: 1.25, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{activeBook.title}</p>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ display: "inline-block", background: dark ? "#2a2016" : "#EDE2CC", color: palette.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "20px", marginBottom: "10px" }}>{activeBook.category}</span>
              <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 700, color: dark ? "#f0e6d4" : palette.mahogany, lineHeight: 1.15, fontFamily: FONT_SERIF }}>{activeBook.title}</h1>
              <p style={{ margin: 0, fontSize: "15px", color: dark ? "#a99b85" : palette.muted, fontStyle: "italic", fontFamily: FONT_SERIF }}>{activeBook.author}</p>
              <p style={{ margin: "12px 0 0", fontSize: "13px", color: dark ? "#a99b85" : palette.muted }}>{bookProgress(activeBook)}% - {readSet.size}/{activeBook.chapters.length} chapters</p>
            </div>
          </div>
          <div style={{ height: "5px", background: dark ? "#2a2016" : "#E5D9C0", borderRadius: "3px", overflow: "hidden", marginBottom: "28px" }}>
            <div style={{ height: "100%", width: `${bookProgress(activeBook)}%`, background: palette.gold, transition: "width 0.5s" }} />
          </div>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: dark ? "#a99b85" : palette.muted, textTransform: "uppercase", margin: "0 0 14px" }}>Chapters</p>
          {activeBook.chapters.map((ch, i) => {
            const isRead = readSet.has(ch.id);
            return (
              <button key={ch.id} onClick={() => { setActiveChapter(i); readStartRef.current = null; setView("read"); }} style={{ width: "100%", textAlign: "left", marginBottom: "10px", cursor: "pointer", background: dark ? "#1d1610" : palette.cream, border: `1px solid ${dark ? "#2a2016" : "#E8DCC4"}`, borderRadius: "12px", padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px", fontFamily: FONT_UI }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, fontFamily: FONT_SERIF, background: isRead ? palette.gold : (dark ? "#2a2016" : "#EDE2CC"), color: isRead ? "#fff" : (dark ? "#a99b85" : palette.muted) }}>{isRead ? "\u2713" : ch.id}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: 600, color: isRead ? (dark ? "#7a6e5c" : palette.muted) : (dark ? "#e8ddc9" : palette.ink), fontFamily: FONT_SERIF }}>{ch.title}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: dark ? "#7a6e5c" : palette.muted }}>{ch.readTime}</p>
                </div>
                <span style={{ color: palette.muted, fontSize: "18px" }}>&rsaquo;</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: pageBg, fontFamily: FONT_UI, transition: "background 0.3s" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "28px 22px 8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", color: palette.gold, textTransform: "uppercase" }}>Your Reading Room</p>
          <h1 style={{ margin: 0, fontSize: "30px", fontWeight: 700, color: dark ? "#f0e6d4" : palette.mahogany, fontFamily: FONT_SERIF }}>Litshelf</h1>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setView("stats")} style={{ ...fontBtn(dark), fontWeight: 600 }}>{"\uD83D\uDCCA"} Tracker</button>
          <button onClick={() => setDark(!dark)} style={fontBtn(dark)}>{dark ? "\u2600" : "\u263e"}</button>
        </div>
      </div>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "16px 22px 60px" }}>
        {loadingBooks && <p style={{ fontSize: "13px", color: palette.muted, fontFamily: FONT_UI, margin: "0 0 8px" }}>Loading your shelves...</p>}
        {!loadingBooks && books.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: dark ? "#a99b85" : palette.muted }}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>{"\uD83D\uDCDA"}</p>
            <p style={{ fontSize: "16px", fontFamily: FONT_SERIF, fontStyle: "italic", margin: "0 0 6px", color: dark ? "#f0e6d4" : palette.mahogany }}>Your shelves are empty.</p>
            <p style={{ fontSize: "13px", fontFamily: FONT_UI }}>Add a book JSON to <code>/public/books/</code> and push to GitHub.</p>
          </div>
        )}
        {sortedCats.map((cat) => (
          <div key={cat} style={{ marginTop: "30px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", color: dark ? "#c4b59c" : palette.mahogany, fontFamily: FONT_SERIF }}>{cat}</p>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", overflowX: "auto", padding: "16px 14px 0", minHeight: "190px", background: `linear-gradient(180deg, transparent 0%, ${dark ? "rgba(40,28,18,0.25)" : "rgba(107,74,50,0.06)"} 100%)`, borderRadius: "8px 8px 0 0" }}>
                {grouped[cat].map((book) => <BookSpine key={book.id} book={book} progress={bookProgress(book)} onClick={() => { setActiveBookId(book.id); setView("book"); }} />)}
              </div>
              <div style={{ height: "14px", background: `linear-gradient(180deg, ${palette.wood} 0%, ${palette.woodDark} 100%)`, borderRadius: "2px", boxShadow: "0 6px 14px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.15)" }} />
            </div>
          </div>
        ))}
        {books.length > 0 && <p style={{ margin: "40px 0 0", textAlign: "center", fontSize: "12px", color: dark ? "#7a6e5c" : palette.muted, fontStyle: "italic", fontFamily: FONT_SERIF }}>"A reader lives a thousand lives before he dies."</p>}
      </div>
    </div>
  );
}

function btnGhost(dark) { return { background: "none", border: "none", cursor: "pointer", color: dark ? "#c4b59c" : palette.mahogany, fontSize: "15px", fontWeight: 600, fontFamily: FONT_UI, padding: 0, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }; }
function fontBtn(dark) { return { background: dark ? "#2a2016" : "#EDE2CC", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: dark ? "#c4b59c" : palette.mahogany, fontFamily: FONT_UI }; }
function navBtn(dark, primary) { return { flex: primary ? 2 : 1, padding: "15px", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 600, fontFamily: FONT_UI, background: primary ? palette.mahogany : (dark ? "#2a2016" : "#EDE2CC"), color: primary ? palette.parchment : (dark ? "#c4b59c" : palette.mahogany) }; }