"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <>
      <div className="site-bg" aria-hidden />
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-left">
            <div className="kicker reveal d1">// Behind-the-Score Scanner</div>
            <h1 className="reveal d2">
              See what&apos;s compounding.<br />
              And what&apos;s quietly leaking.
            </h1>
            <p className="hero-sub reveal d3">
              Five growth pillars and a Compliance Surface read, scored live from
              any med-spa site in under a minute.
            </p>
            <form className="lp-form reveal d4" onSubmit={scan}>
              <input className="input" placeholder="yourmedspa.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={running} />
              <button className="btn" type="submit" disabled={running}>{running ? "Scanning…" : "Run the scan"}</button>
            </form>
            {error && <p className="error">{error}</p>}
          </div>

          <div className={`console reveal d3 ${running ? "running" : ""}`}>
            <div className="console-scan" />
            <div className="console-head">
              <span className="console-title">Scan engine</span>
              <span className="console-status"><span className="sdot" />{running ? "Running" : "Standby"}</span>
            </div>
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
