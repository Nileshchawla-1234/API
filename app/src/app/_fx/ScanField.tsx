// Full-bleed ambient background for the hero dead-space. Two variants behind a
// switch (?bg=mesh | ?bg=lab):
//   mesh — slow-drifting topographic contour lines (skin / terrain scan)
//   lab  — line-art laboratory apparatus in the margins (rack, flask, beaker)
// Both share the schematic marks + center safe-zone fade. Pure SVG/CSS, no
// assets, reduced-motion safe. craft-lab: directions A (topo) / lab apparatus.

const LINES = Array.from({ length: 16 }, (_, i) => {
  const y = 36 + i * 48;
  const edge = Math.abs(i - 7.5) / 7.5;
  const op = (0.18 - edge * 0.085).toFixed(3);
  const dur = 20 + (i % 5) * 1.7;
  const amp = 30 + (i % 4) * 7;
  const a = i % 2 === 0 ? amp : -amp;
  const d = `M-60,${y} C200,${y - a} 400,${y + a} 600,${y} C800,${y - a} 1000,${y + a} 1260,${y}`;
  return { d, op, dur, rev: i % 2 === 1 };
});

function MeshLayer() {
  return (
    <svg className="field-mesh" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      {LINES.map((l, i) => (
        <path
          key={i}
          className="field-topo"
          d={l.d}
          style={{ strokeOpacity: l.op, animationDuration: `${l.dur}s`, animationDirection: l.rev ? "reverse" : "normal" }}
        />
      ))}
    </svg>
  );
}

// one test tube: outline, rim, liquid to `level`, two rising bubbles
function TestTube({ x, level }: { x: number; level: number }) {
  const top = 8, arc = 118, r = 14;
  return (
    <g>
      <path className="lab-glass" d={`M${x - r},${top} V${arc} A${r},${r} 0 0 0 ${x + r},${arc} V${top}`} />
      <ellipse className="lab-rim" cx={x} cy={top} rx={r} ry="3.5" />
      <path className="lab-liquid" d={`M${x - r + 1},${level} V${arc} A${r - 1},${r - 1} 0 0 0 ${x + r - 1},${arc} V${level} Z`} />
      <line className="lab-meniscus" x1={x - r + 1} y1={level} x2={x + r - 1} y2={level} />
      <circle className="lab-bubble" cx={x - 3} cy={arc + 6} r="2" style={{ animationDelay: `${(x % 5) * 0.4}s` }} />
      <circle className="lab-bubble" cx={x + 4} cy={arc + 6} r="1.6" style={{ animationDelay: `${(x % 3) * 0.5 + 0.6}s` }} />
    </g>
  );
}

function LabLayer() {
  return (
    <>
      {/* erlenmeyer flask + dripping pipette — top-left */}
      <svg className="lab-piece lab-flask" viewBox="0 0 124 200">
        <ellipse className="lab-glass" cx="62" cy="12" rx="6" ry="9" />
        <line className="lab-glass" x1="62" y1="21" x2="62" y2="50" />
        <ellipse className="lab-drop" cx="62" cy="56" rx="2.6" ry="3.6" />
        <path className="lab-glass" d="M54,60 V84 L22,162 Q20,170 28,170 L96,170 Q104,170 102,162 L70,84 V60" />
        <line className="lab-rim" x1="52" y1="60" x2="72" y2="60" />
        <path className="lab-liquid" d="M35,136 L26,162 Q24,170 30,170 L94,170 Q100,170 98,162 L89,136 Z" />
        <line className="lab-meniscus" x1="35" y1="136" x2="89" y2="136" />
        <circle className="lab-bubble" cx="54" cy="164" r="2" style={{ animationDelay: "0s" }} />
        <circle className="lab-bubble" cx="64" cy="164" r="1.6" style={{ animationDelay: "0.8s" }} />
        <circle className="lab-bubble" cx="72" cy="164" r="1.8" style={{ animationDelay: "1.5s" }} />
      </svg>

      {/* test-tube rack — bottom-left */}
      <svg className="lab-piece lab-rack" viewBox="0 0 172 150">
        <path className="lab-glass" d="M0,30 H168 M0,140 H168 M2,30 V140 M166,30 V140" />
        <TestTube x={36} level={78} />
        <TestTube x={88} level={64} />
        <TestTube x={140} level={92} />
      </svg>

      {/* graduated beaker — bottom-right */}
      <svg className="lab-piece lab-beaker" viewBox="0 0 120 168">
        <path className="lab-glass" d="M8,10 L0,3 M8,10 L4,150 Q4,158 12,158 L106,158 Q114,158 114,150 L110,10" />
        <path className="lab-glass" d="M14,46 H28 M14,78 H28 M14,110 H28" style={{ opacity: 0.32 }} />
        <path className="lab-liquid" d="M5,98 L5,150 Q5,158 12,158 L106,158 Q113,158 112,150 L112,98 Z" />
        <line className="lab-meniscus" x1="5" y1="98" x2="112" y2="98" />
        <circle className="lab-bubble" cx="42" cy="152" r="2.2" style={{ animationDelay: "0.3s" }} />
        <circle className="lab-bubble" cx="62" cy="152" r="1.7" style={{ animationDelay: "1.1s" }} />
        <circle className="lab-bubble" cx="82" cy="152" r="2" style={{ animationDelay: "1.9s" }} />
      </svg>
    </>
  );
}

export function ScanField({ variant = "mesh" }: { variant?: "mesh" | "lab" }) {
  const tag = variant === "lab" ? "// bench 01 · assay" : "// field 01 · topo";
  return (
    <div className="scan-field" aria-hidden>
      {variant === "lab" ? <LabLayer /> : <MeshLayer />}

      <div className="field-fade" />

      <div className="field-marks">
        <span className="field-corner tl" style={{ top: 20, left: 20 }} />
        <span className="field-corner tr" style={{ top: 20, right: 20 }} />
        <span className="field-corner bl" style={{ bottom: 20, left: 20 }} />
        <span className="field-corner br" style={{ bottom: 20, right: 20 }} />
        <span className="field-coord" style={{ top: 24, left: 46 }}>{tag}</span>
        <span className="field-coord r" style={{ bottom: 24, left: 46 }}>lat 31.2613 · lon -97.7430</span>
        <span className="field-coord r" style={{ bottom: 24, right: 46 }}>scan Δ 0.42s</span>
        <span className="field-x" style={{ top: "28%", left: "5.5%" }} />
        <span className="field-x live" style={{ top: "66%", left: "8%" }} />
        <span className="field-x" style={{ top: "74%", right: "6%" }} />
        <span className="field-coord" style={{ top: "29%", left: "calc(5.5% + 18px)" }}>+ 042.18</span>
      </div>
    </div>
  );
}
