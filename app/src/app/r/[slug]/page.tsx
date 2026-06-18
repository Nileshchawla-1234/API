import { notFound } from "next/navigation";
import { getStore } from "@scanner/core";
import type { ClientPayload, PillarKind } from "@scanner/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PILLAR_LABEL: Record<PillarKind, string> = {
  paid: "Paid Acquisition",
  search: "Search & Local Presence",
  ai: "AI Visibility Readiness",
  reputation: "Reputation Surface",
  conversion: "Conversion Infrastructure",
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const payload = (await getStore().getReportBySlug(slug)) as ClientPayload | null;
  if (!payload) notFound();

  const p = payload;
  return (
    <main className="report">
      {/* §1 Header */}
      <header className="rpt-head">
        <div>
          <div className="rpt-domain">{p.header.business_name || p.header.domain}</div>
          <div className="muted">
            {p.header.domain}
            {p.header.location ? ` · ${p.header.location}` : ""} · {p.header.scan_date.slice(0, 10)}
          </div>
        </div>
        <span className={`tier tier-${p.header.tier}`}>Tier {p.header.tier}</span>
      </header>

      {/* §2 Score */}
      <section className="score-block">
        <div className="score-big">
          {p.score.composite}
          <span className="score-den">/100</span>
        </div>
        <div className="score-meta">
          <div>Compounding Score</div>
          <div className="gap">
            Gap to achievable: <strong>{p.score.gap}</strong> (achievable {p.score.achievable})
          </div>
        </div>
      </section>

      {/* §3 Pillars */}
      <h2 className="rpt-h2">Five Growth Pillars</h2>
      {p.pillars.map((pl) => (
        <div className="pillar" key={pl.key}>
          <div className="pillar-top">
            <span className={`rag rag-${pl.rag}`} />
            <span className="pillar-label">{PILLAR_LABEL[pl.key] ?? pl.key}</span>
            <span className="pillar-score">{pl.score}/100</span>
          </div>
          <div className="bar"><div className={`bar-fill rag-bg-${pl.rag}`} style={{ width: `${pl.score}%` }} /></div>
          {pl.findings.length > 0 && (
            <ul className="findings">
              {pl.findings.map((f, i) => (
                <li key={i}>{f.text} <span className="src">{f.source}</span></li>
              ))}
            </ul>
          )}
          <div className="target">{pl.target}</div>
        </div>
      ))}

      {/* §4 Locked pillars */}
      <h2 className="rpt-h2">Reserved for your diagnostic</h2>
      <div className="locked-grid">
        {p.locked.map((l) => (
          <div className="locked" key={l.name}>
            <div className="lock-icon">🔒</div>
            <strong>{l.name}</strong>
            <div className="muted">{l.tease}</div>
          </div>
        ))}
      </div>

      {/* §5 Compliance Surface */}
      <h2 className="rpt-h2">Compliance Surface</h2>
      <section className="compliance">
        <div className="risk">
          Risk score <strong>{p.compliance.risk}</strong>/100
        </div>
        {p.compliance.rows.length > 0 ? (
          <ul className="comp-rows">
            {p.compliance.rows.map((r, i) => (
              <li key={i}>
                <span className={`chip tier${r.tier}`}>T{r.tier}</span>
                {r.signal} — <em>{r.observed}</em> <span className="conf">({r.confidence} confidence)</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">No high-risk tracking patterns detected on the public site.</div>
        )}
        <div className="disclaimer">{p.compliance.disclaimer}</div>
      </section>

      {/* §6 Core Web Vitals */}
      {p.cwv.length > 0 && (
        <>
          <h2 className="rpt-h2">Core Web Vitals</h2>
          <table className="cwv">
            <thead><tr><th>Metric</th><th>Good</th><th>Yours</th></tr></thead>
            <tbody>
              {p.cwv.map((c, i) => (
                <tr key={i}><td>{c.metric}</td><td className="muted">{c.good}</td><td><strong>{c.actual}</strong></td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* §7 Competitors */}
      {p.competitors && p.competitors.rows.length > 0 && (
        <>
          <h2 className="rpt-h2">Competitors <span className="src">{p.competitors.source}</span></h2>
          <ul className="findings">
            {p.competitors.rows.map((row, i) => (
              <li key={i}>{String((row as { name?: string }).name ?? "competitor")}</li>
            ))}
          </ul>
        </>
      )}

      {/* §9 CTA — the only action on the page */}
      <section className="cta">
        <strong>{p.cta.headline}</strong>
        <div className="muted">{p.cta.body}</div>
        <button className="btn">{p.cta.button}</button>
      </section>

      <footer className="footer-disc">{p.footer_disclaimer}</footer>
    </main>
  );
}
