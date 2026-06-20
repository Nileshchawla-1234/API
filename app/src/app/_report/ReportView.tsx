import type { ClientPayload, PillarKind } from "@scanner/core";

const PILLAR_LABEL: Record<PillarKind, string> = {
  paid: "Paid Acquisition",
  search: "Search & Local Presence",
  ai: "AI Visibility Readiness",
  reputation: "Reputation Surface",
  conversion: "Conversion Infrastructure",
};

// A style map: the same keys, supplied either as global class strings (V1) or a
// CSS module (V2/V3). One renderer, three themes.
export type ReportStyles = Record<string, string>;

export function ReportView({ payload: p, styles: s }: { payload: ClientPayload; styles: ReportStyles }) {
  const cx = (...k: string[]) => k.map((x) => s[x] || "").join(" ").trim();
  return (
    <main className={s.root}>
      {s.bg ? <div className={s.bg} aria-hidden /> : null}
      <div className={s.inner}>
        <div className={s.kicker}>// The Compounding Method · Behind-the-Score</div>

        <header className={s.head}>
          <div>
            <div className={s.domain}>{p.header.business_name || p.header.domain}</div>
            <div className={s.meta}>
              {p.header.domain}
              {p.header.location ? ` · ${p.header.location}` : ""} · {p.header.scan_date.slice(0, 10)}
            </div>
          </div>
        </header>

        <section className={s.scoreWrap}>
          <div className={s.scoreNum}>{p.score.composite}<span className={s.scoreDen}>/100</span></div>
          <div>
            <div className={s.scoreLabel}>Compounding Score</div>
            <div className={s.gap}>Gap to achievable: {p.score.gap} (achievable {p.score.achievable})</div>
          </div>
        </section>

        <h2 className={s.h2}>Five Growth Pillars</h2>
        {p.pillars.map((pl) => (
          <div className={s.pillar} key={pl.key}>
            <div className={s.pillarTop}>
              <span className={cx("rag", `rag_${pl.rag}`)} />
              <span className={s.pillarLabel}>{PILLAR_LABEL[pl.key] ?? pl.key}</span>
              <span className={s.pillarScore}>{pl.score}/100</span>
            </div>
            <div className={s.bar}><div className={cx("barFill", `barFill_${pl.rag}`)} style={{ width: `${pl.score}%` }} /></div>
            {pl.findings.length > 0 && (
              <ul className={s.findings}>
                {pl.findings.map((f, i) => (<li key={i}>{f.text} <span className={s.src}>{f.source}</span></li>))}
              </ul>
            )}
          </div>
        ))}

        <h2 className={s.h2}>Reserved for your diagnostic</h2>
        <div className={s.lockedGrid}>
          {p.locked.map((l) => (
            <div className={s.locked} key={l.name}>
              <div className={s.lockIcon}>🔒</div>
              <strong>{l.name}</strong>
              <div className={s.meta}>{l.tease}</div>
            </div>
          ))}
        </div>

        <h2 className={s.h2}>Compliance Surface</h2>
        <section className={s.compliance}>
          <div className={s.risk}>Risk score <strong>{p.compliance.risk}</strong>/100</div>
          {p.compliance.rows.length > 0 ? (
            <ul className={s.compRows}>
              {p.compliance.rows.map((r, i) => (
                <li key={i}>
                  <span className={cx("chip", `chip_t${r.tier}`)}>T{r.tier}</span>
                  {r.signal}: <em>{r.observed}</em> <span className={s.conf}>({r.confidence} confidence)</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={s.meta}>No high-risk tracking patterns detected on the public site.</div>
          )}
          <div className={s.disclaimer}>{p.compliance.disclaimer}</div>
        </section>

        {p.cwv.length > 0 && (
          <>
            <h2 className={s.h2}>Site Speed &amp; Stability</h2>
            <table className={s.cwv}>
              <thead><tr><th>Measure</th><th>Good</th><th>Yours</th></tr></thead>
              <tbody>
                {p.cwv.map((c, i) => (<tr key={i}><td>{c.metric}</td><td className={s.meta}>{c.good}</td><td><strong>{c.actual}</strong></td></tr>))}
              </tbody>
            </table>
            <div className={s.meta} style={{ fontSize: 12, marginTop: 8 }}>
              Measured on a typical mobile connection — your own phone on Wi-Fi may feel faster.
            </div>
          </>
        )}

        <section className={s.cta}>
          <strong>{p.cta.headline}</strong>
          <div className={s.meta}>{p.cta.body}</div>
          <button className={s.ctaBtn}>{p.cta.button}</button>
        </section>

        <div className={s.footer}>{p.footer_disclaimer}</div>
      </div>
    </main>
  );
}
