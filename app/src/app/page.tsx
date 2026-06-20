"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RevealText } from "./_fx/RevealText";
import { ScanField } from "./_fx/ScanField";

const STAGES = [
  { title: "Crawl", desc: "Render pages in a headless browser" },
  { title: "Speed", desc: "PageSpeed + real-user Core Web Vitals" },
  { title: "Detect", desc: "Pixels, tracking, schema, AI crawlers" },
  { title: "Compliance", desc: "PHI-context, privacy, consent, TCPA" },
  { title: "Score", desc: "Five growth pillars and the gap" },
  { title: "Report", desc: "Verified findings into your score" },
];

const PILLARS = [
  ["Paid", "Acquisition infrastructure"],
  ["Search", "Local + organic presence"],
  ["AI Visibility", "Answer-engine readiness"],
  ["Reputation", "Review surface"],
  ["Conversion", "Speed and booking flow"],
];

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [bg, setBg] = useState<"mesh" | "lab">("lab");
  const [panel, setPanel] = useState<"" | "right">("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get("bg");
    if (v === "lab" || v === "mesh") setBg(v);
    if (p.get("panel") === "right") setPanel("right");
  }, []);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setRunning(true);
    setError(null);
    setStep(0);
    finished.current = false;
    const tick = setInterval(() => {
      setStep((s) => (finished.current ? s : Math.min(s + 1, STAGES.length - 1)));
    }, 9000);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      finished.current = true;
      setStep(STAGES.length);
      router.push(`/r/${data.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
    } finally {
      clearInterval(tick);
    }
  }

  const progress = running ? Math.round((step / STAGES.length) * 100) : 0;

  const reduced = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // craft-lab microinteractions: magnetic button (label trails at 0.4x) +
  // pointer-glow that tracks the cursor inside the console panel.
  function magnet(e: React.MouseEvent) {
    const el = btnRef.current;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) * 0.35;
    const y = (e.clientY - (r.top + r.height / 2)) * 0.35;
    el.style.transform = `translate(${x}px, ${y}px)`;
    const lbl = el.firstElementChild as HTMLElement | null;
    if (lbl) lbl.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px)`;
  }
  function magnetReset() {
    const el = btnRef.current;
    if (!el) return;
    el.style.transform = "";
    const lbl = el.firstElementChild as HTMLElement | null;
    if (lbl) lbl.style.transform = "";
  }
  function consoleGlow(e: React.MouseEvent) {
    const el = consoleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  return (
    <>
      <div className="site-bg" aria-hidden />
      <ScanField variant={bg} />
      <section className={`hero ${panel === "right" ? "hero--wide" : ""}`}>
        <div className="hero-grid">
          <div className="hero-left">
            <div className="kicker reveal d1">// Behind-the-Score Scanner</div>
            <h1>
              <RevealText text={"See what's compounding.\nAnd what's quietly leaking."} delay={0.18} stagger={0.07} duration={0.7} />
            </h1>
            <p className="hero-sub reveal d3">
              Five growth pillars and a Compliance Surface read, scored live from
              any med-spa site in under a minute.
            </p>
            <form className="lp-form reveal d4" onSubmit={scan}>
              <input className="input" placeholder="yourmedspa.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={running} />
              <button ref={btnRef} className="btn magnetic" type="submit" disabled={running} onMouseMove={magnet} onMouseLeave={magnetReset}><span className="btn-label">{running ? "Scanning…" : "Run the scan"}</span></button>
            </form>
            {error && <p className="error">{error}</p>}
          </div>

          <div className="hero-media">
            <video className="hero-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true">
              <source src="/hero-lab.mp4" type="video/mp4" />
            </video>
            {running && (
              <div className="hero-wait" role="status" aria-live="polite">
                <span className="hw-dot" aria-hidden />
                Scanning{domain ? ` ${domain}` : ""}. Your Behind-the-Score report is on its way.
              </div>
            )}
          </div>

          <div ref={consoleRef} onMouseMove={consoleGlow} className={`console reveal d3 ${running ? "running" : ""}`}>
            <div className="console-glow" aria-hidden />
            <div className="console-scan" />
            <div className="console-head">
              <span className="console-title">Scan engine</span>
              <span className="console-status"><span className="sdot" />{running ? "Running" : "Standby"}</span>
            </div>
            <div className="reticles" aria-hidden><i /><i /><i /><i /></div>
            {STAGES.map((s, i) => {
              const state = !running ? "idle" : i < step ? "done" : i === step ? "active" : "pending";
              return (
                <div className={`crow ${state}`} key={s.title}>
                  <div className="crow-rail"><span className="crow-dot">{state === "done" ? "✓" : String(i + 1).padStart(2, "0")}</span></div>
                  <div><div className="crow-title">{s.title}</div><div className="crow-desc">{s.desc}</div></div>
                </div>
              );
            })}
            <div className="console-foot">
              <div className="console-rail"><i style={{ width: `${progress}%` }} /></div>
              <div className="meta">{running ? `Scanning ${domain || "target"}…` : "Awaiting target"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="pillars-strip">
        <div className="ps-grid">
          {PILLARS.map(([t, d], i) => (
            <div className="ps-cell" key={t}><div className="n">{String(i + 1).padStart(2, "0")}</div><div className="t">{t}</div><div className="d">{d}</div></div>
          ))}
        </div>
      </section>
    </>
  );
}
