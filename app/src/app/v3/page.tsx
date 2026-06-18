"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import s from "./v3.module.css";

gsap.registerPlugin(ScrollTrigger);

const STAGES = ["CRAWL", "SPEED", "DETECT", "COMPLIANCE", "SCORE", "REPORT"];
const PILLARS: [string, string][] = [
  ["Paid", "Conversion tracking, retargeting, server-side signal. Whether the ad spend can even see what it buys."],
  ["Search", "Local and organic presence, schema, the commercial-intent queries you do and don't own."],
  ["AI Visibility", "Whether ChatGPT, Perplexity and Google's AI can read and cite you, or skip you entirely."],
  ["Reputation", "The review surface across platforms, velocity, and how fast you respond."],
  ["Conversion", "Mobile speed and the path from first tap to booked consultation."],
];

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%/<>";
function scramble(el: HTMLElement, target: string, reduce: boolean) {
  if (reduce) { el.textContent = target; return; }
  let frame = 0;
  const id = setInterval(() => {
    el.textContent = target
      .split("")
      .map((ch, i) => (i < frame / 2 ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join("");
    frame++;
    if (frame / 2 >= target.length) { el.textContent = target; clearInterval(id); }
  }, 40);
  return () => clearInterval(id);
}

export default function V3() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const finished = useRef(false);
  const wordRef = useRef<HTMLSpanElement>(null);
  const panWrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (wordRef.current) scramble(wordRef.current, "LEAKING", reduce);
  }, [reduce]);

  // GSAP horizontal scroll-hijack for the pillars.
  useEffect(() => {
    if (reduce || !panWrap.current || !track.current || window.innerWidth <= 820) return;
    const ctx = gsap.context(() => {
      const distance = track.current!.scrollWidth - window.innerWidth;
      gsap.to(track.current, {
        x: -distance,
        ease: "none",
        scrollTrigger: { trigger: panWrap.current, start: "top top", end: () => `+=${distance}`, pin: true, scrub: 1, invalidateOnRefresh: true },
      });
    }, panWrap);
    return () => ctx.revert();
  }, [reduce]);

  // Count toward stage progress during the takeover.
  useEffect(() => {
    const target = running ? Math.round(((step + 0.5) / STAGES.length) * 100) : 0;
    let raf = 0;
    const animate = () => {
      setPct((p) => { if (Math.abs(p - target) < 1) return target; raf = requestAnimationFrame(animate); return p + (target - p) * 0.1; });
    };
    raf = requestAnimationFrame(animate);
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
      router.push(`/v3/r/${data.slug}`);
    } catch (err) { setError((err as Error).message); setRunning(false); }
    finally { clearInterval(tick); }
  }

  return (
    <main className={s.root}>
      <div className={s.scanline} aria-hidden />
      <div className={s.noise} aria-hidden />

      <section className={s.hero}>
        <div className={s.tag}>// Signal · Behind-the-Score</div>
        <h1 className={s.h1}>
          Find the<br />
          <span ref={wordRef} className={s.scr}>LEAKING</span>
        </h1>
        <p className={s.sub}>
          Every med spa is compounding something. We scan five growth pillars and a
          compliance surface, live, and show you exactly where the signal drops.
        </p>
        <form className={s.form} onSubmit={scan}>
          <input className={s.input} placeholder="yourmedspa.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={running} />
          <button className={s.btn} type="submit" disabled={running}>{running ? "Scanning" : "Run signal scan"}</button>
        </form>
        {error && <p className={s.err}>{error}</p>}
      </section>

      <section className={s.panWrap} ref={panWrap}>
        <div className={s.track} ref={track}>
          <div className={s.panIntro}><h2>Five<br />pillars,<br />one read.</h2></div>
          {PILLARS.map(([t, d], i) => (
            <div className={s.panel} key={t}>
              <div className={s.pn}>0{i + 1} / 05</div>
              <div className={s.pt}>{t}</div>
              <div className={s.pd}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {running && (
        <div className={s.takeover}>
          <div className={s.beam} />
          <div className={s.bigPct}>{Math.round(pct)}<span>%</span></div>
          <div className={s.toStage}>{STAGES[Math.min(step, STAGES.length - 1)]}</div>
          <div className={s.toTarget}>SCANNING {domain.toUpperCase()}</div>
        </div>
      )}
    </main>
  );
}
