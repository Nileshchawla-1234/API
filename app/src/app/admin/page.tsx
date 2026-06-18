"use client";

import { useState } from "react";

interface ScanRow {
  domain: string;
  slug: string | null;
  status: string;
  composite: number | null;
  completedAt: string | null;
}

export default function Admin() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);

  async function loadScans() {
    setMsg(null);
    const res = await fetch(`/api/admin/scans?token=${encodeURIComponent(token)}`);
    if (res.status === 401) {
      setMsg("Invalid admin token.");
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setScans(data.scans ?? []);
    setAuthed(true);
  }

  async function importDomains() {
    if (!domains.trim()) return;
    setBusy(true);
    setMsg("Scanning… (runs the crawl synchronously in dev, may take a minute)");
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ domains }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMsg(`Imported ${data.imported}. ${data.results.filter((r: { status: string }) => r.status === "complete").length} complete.`);
      setDomains("");
      await loadScans();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Admin</h1>

      {!authed ? (
        <>
          <p className="muted">Enter the admin token to continue.</p>
          <div className="lp-form">
            <input className="input" type="password" placeholder="admin token" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn" onClick={loadScans}>Sign in</button>
          </div>
          {msg && <p className="error">{msg}</p>}
        </>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>Import & scan targets</div>
          <p className="muted">One domain per line (or comma-separated).</p>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 90, fontFamily: "monospace" }}
            placeholder={"medspa-a.com\nmedspa-b.com"}
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            disabled={busy}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button className="btn" onClick={importDomains} disabled={busy}>{busy ? "Working…" : "Import & scan"}</button>
            <button className="btn" style={{ background: "#1b2230", color: "#e6e9ef" }} onClick={loadScans} disabled={busy}>Refresh</button>
            <a className="btn" style={{ background: "#1b2230", color: "#e6e9ef", textDecoration: "none" }} href={`/api/admin/export?token=${encodeURIComponent(token)}`}>Export CSV</a>
          </div>
          {msg && <p className="muted" style={{ marginTop: 12 }}>{msg}</p>}

          <div className="section-title" style={{ marginTop: 28 }}>Recent scans ({scans.length})</div>
          <table className="cwv">
            <thead><tr><th>Domain</th><th>Score</th><th>Status</th><th>Report</th></tr></thead>
            <tbody>
              {scans.map((s, i) => (
                <tr key={i}>
                  <td>{s.domain}</td>
                  <td>{s.composite ?? "-"}</td>
                  <td>{s.status}</td>
                  <td>{s.slug ? <a href={`/r/${s.slug}`} target="_blank" rel="noreferrer">view</a> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
