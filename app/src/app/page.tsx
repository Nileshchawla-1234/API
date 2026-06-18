"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Crawling the site",
  "Measuring speed & Core Web Vitals",
  "Detecting tracking & compliance signals",
  "Scoring the five pillars",
  "Composing your report",
];

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setStep(0);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1500);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      router.push(`/r/${data.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    } finally {
      clearInterval(tick);
    }
  }

  return (
    <main className="wrap">
      <h1>The Compounding Method</h1>
      <p className="muted">
        Behind-the-Score scan for med spas — five growth pillars + a Compliance
        Surface read, in under a minute.
      </p>

      <form className="lp-form" onSubmit={scan}>
        <input
          className="input"
          placeholder="yourmedspa.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Scanning…" : "Scan my site"}
        </button>
      </form>

      {error && <p className="error">⚠ {error}</p>}

      {busy && (
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step ${i < step ? "done" : i === step ? "active" : ""}`}>
              <span>{i < step ? "✓" : i === step ? "◌" : "·"}</span> {s}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
