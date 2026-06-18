import Link from "next/link";
import styles from "../chooser.module.css";

// A real scan that exists in the DB, so the report links render live.
const SLUG = "nileshchawla-com-fba5a5";

const VARIANTS = [
  { n: "01", name: "Console", tag: "Operator · dark · cyan", desc: "A clean, restrained operator console. The pipeline runs in a side panel. Fast and to the point.", landing: "/v1", report: `/r/${SLUG}` },
  { n: "02", name: "Command Center", tag: "Cinematic · sci-fi · cyan + violet", desc: "Animated grid horizon, a reactor core, drifting particles, and a live scan log. Full sci-fi.", landing: "/v2", report: `/v2/r/${SLUG}` },
  { n: "03", name: "Signal", tag: "Kinetic · bold · magenta", desc: "Full-screen scan takeover, decoding type, scroll-hijacked pillars. The cinematic showpiece.", landing: "/v3", report: `/v3/r/${SLUG}` },
  { n: "04", name: "Nexus", tag: "Interactive · 3D · WebGL", desc: "A live 3D wireframe core and plexus network you orbit with your mouse. It charges as the scan runs.", landing: "/v4", report: `/v4/r/${SLUG}` },
];

export function ConceptHub() {
  return (
    <main className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.kicker}>// Behind-the-Score Scanner · Concept Review</div>
        <h1 className={styles.h1}>Four directions. Pick one.</h1>
        <p className={styles.sub}>
          Same engine underneath. Open each landing to interact, and view its matching report.
        </p>

        <div className={styles.grid}>
          {VARIANTS.map((v) => (
            <div className={styles.card} key={v.landing}>
              <div className={styles.n}>{v.n}</div>
              <div className={styles.name}>{v.name}</div>
              <div className={styles.tag}>{v.tag}</div>
              <p className={styles.desc}>{v.desc}</p>
              <div className={styles.actions}>
                <Link href={v.landing} className={styles.go}>Open landing →</Link>
                <Link href={v.report} className={styles.goAlt}>View report</Link>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.note}>
          Tip: on the deployed (Hobby) site a fresh scan times out, so use the report links above to
          review each report theme. Full live scans run on localhost.
        </p>
      </div>
    </main>
  );
}
