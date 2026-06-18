"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Geode } from "./Geode";
import s from "./v4.module.css";

const STAGES = ["Crawl", "Speed", "Detect", "Compliance", "Score", "Report"];

export default function V4() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const finished = useRef(false);
  const activeRef = useRef(false); // drives the Geode "charge"

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setRunning(true); activeRef.current = true; setError(null); setStep(0); finished.current = false;
    const tick = setInterval(() => setStep((x) => (finished.current ? x : Math.min(x + 1, STAGES.length - 1))), 9000);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      finished.current = true; setStep(STAGES.length);
      router.push(`/v4/r/${data.slug}`);
    } catch (err) { setError((err as Error).message); setRunning(false); activeRef.current = false; }
    finally { clearInterval(tick); }
  }

  const progress = running ? Math.round(((step + 0.5) / STAGES.length) * 100) : 0;

  return (
    <main className={s.root}>
      <div className={s.canvas}><Geode activeRef={activeRef} /></div>
      <div className={s.scrim} aria-hidden />

      <section className={s.hero}>
        <div className={s.hud}>
          <span><span className={s.dot} />Behind-the-Score · Nexus</span>
          <span className={s.hint}>{running ? "Core charging" : "Move to orbit the core"}</span>
        </div>

        <div className={s.center}>
          <div className={s.left}>
            <div className={s.eyebrow}>Med-Spa Growth Intelligence</div>
            <h1 className={s.h1}>
              Your whole funnel,<br />
              one <span className={s.cyan}>living core</span>.
            </h1>
            <p className={s.sub}>
              Five growth pillars and a Compliance Surface, pulled live from your
              site and resolved into a single score.
            </p>
            <form className={s.form} onSubmit={scan}>
              <input className={s.input} placeholder="yourmedspa.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={running} />
              <button className={s.btn} type="submit" disabled={running}>{running ? "Scanning…" : "Energize scan"}</button>
            </form>
            {error && <p className={s.err}>{error}</p>}

            {running && (
              <div className={s.progress}>
                <div className={s.progLabel}>
                  <span>{STAGES[Math.min(step, STAGES.length - 1)]}</span>
                  <span>{progress}%</span>
                </div>
                <div className={s.rail}><i style={{ width: `${progress}%` }} /></div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
