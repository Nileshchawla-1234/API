"use client";

import { useRef } from "react";
import { Geode } from "../../Geode";

// The interactive geode living behind the report, dimmed. Still mouse-reactive.
export function V4ReportBg() {
  const idle = useRef(false);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.32, pointerEvents: "none" }}>
        <Geode activeRef={idle} />
      </div>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(120% 90% at 50% 30%, rgba(5,7,13,0.55), rgba(5,7,13,0.9) 75%)",
        }}
        aria-hidden
      />
    </>
  );
}
