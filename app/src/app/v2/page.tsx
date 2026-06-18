"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import s from "./v2.module.css";

const STAGES = ["Crawl", "Speed", "Detect", "Compliance", "Score", "Report"];
const PILLARS: [string, string][] = [
  ["Paid", "Acquisition infra"],
  ["Search", "Local + organic"],
  ["AI Visibility", "Answer-engine readiness"],
  ["Reputation", "Review surface"],
  ["Conversion", "Speed + booking"],
];

export default function V2() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const finished = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drifting particle field (canvas, no React state per frame).
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0;
    let dots: { x: number; y: number; r: number; s: number }[] = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(80, Math.floor((w * h) / 13000));
      dots = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + 0.4, s: Math.random() * 0.3 + 0.08 }));
    };
    resize();
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.y -= d.s; if (d.y < -2) { d.y = h + 2; d.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${0.12 + d.r * 0.22})`; ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const target = running ? Math.round(((step + 0.5) / STAGES.length) * 100) : 0;
    let raf = 0;
    const a = () => setPct((p) => { if (Math.abs(p - target) < 1) return target; raf = requestAnimationFrame(a); return p + (target - p) * 0.12; });
    raf = requestAnimationFrame(a);
    return () => cancelAnimationFrame(raf);
  }, [step, running]);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setRunning(true); setError(null); setStep(0); finished.current = false;
    const tick = setInterval(() => setStep((x) => (finished.current ? x : Math.min(x + 1, STAGES.length - 1))), 9000);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      finished.current = true; setStep(STAGES.length);
      router.push(`/v2/r/${data.slug}`);
    } catch (err) { setError((err as Error).message); setRunning(false); }
    finally { clearInterval(tick); }
  }

  // Terminal log lines
  const lines = running
    ? STAGES.slice(0, step + 1).map((st, i) => ({ text: st.toLowerCase(), ok: i < step, active: i === step })).slice(-4)
    : [{ text: "engine ready", ok: true, active: false }, { text: "awaiting target", ok: false, active: false }];

  return (
    <main className={s.root}>
      <div className={s.bg} aria-hidden>
        <div className={s.gridFloor} />
        <div className={s.horizonGlow} />
        <div className={s.horizonLine} />
        <div className={s.vignette} />
      </div>
      <canvas ref={canvasRef} className={s.particles} aria-hidden />

      <section className={s.hero}>
        <div className={s.hud}>
          <span><span className={s.dot} />Behind-the-Score OS</span>
          <span>{running ? "Scan in progress" : "System ready"}</span>
        </div>

        <div className={s.grid}>
          <div>
            <div className={s.term}>
              <span className={`${s.br} ${s.tl}`} /><span className={`${s.br} ${s.tr}`} /><span className={`${s.br} ${s.bl}`} /><span className={`${s.br} ${s.brr}`} />
              {lines.map((l, i) => (
                <div className={`${s.termLine} ${l.active ? s.active : ""}`} key={i}>
                  &gt; {l.text} {l.ok && <span className={s.ok}>........ ok</span>}
                </div>
              ))}
            </div>

            <div className={s.eyebrow}>Med-Spa Growth Intelligence</div>
            <h1 className={s.h1}>
              Every <span className={s.cyan}>leak</span> in your funnel,<br />
              surfaced in <span className={s.violet}>one scan</span>.
            </h1>
            <p className={s.sub}>
              Five growth pillars and a Compliance Surface, scanned live from your
              site and scored against the operators winning your market.
            </p>
            <form className={s.form} onSubmit={scan}>
              <input className={s.input} placeholder="yourmedspa.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={running} />
              <button className={s.btn} type="submit" disabled={running}>{running ? "Scanning…" : "Initiate scan"}</button>
            </form>
            {error && <p className={s.err}>{error}</p>}
          </div>

          <div className={`${s.core} ${running ? s.running : ""}`}>
            <div className={`${s.ring} ${s.ring1}`} />
            <div className={`${s.ring} ${s.ring2}`} />
            <div className={`${s.ring} ${s.ring3}`} />
            <div className={s.radar} />
            <div className={s.coreCenter}>
              <div className={s.corePct}>{Math.round(pct)}%</div>
              <div className={s.coreStage}>{running ? STAGES[Math.min(step, STAGES.length - 1)] : "Ready"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className={s.strip}>
        <div className={s.stripGrid}>
          {PILLARS.map(([t, d], i) => (
            <div className={s.cell} key={t}>
              <span className={`${s.br} ${s.tl}`} />
              <div className={s.cn}>{String(i + 1).padStart(2, "0")}</div>
              <div className={s.ct}>{t}</div>
              <div className={s.cd}>{d}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
