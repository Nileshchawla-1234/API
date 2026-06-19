"use client";

import { Fragment } from "react";

// Staggered word reveal — each word rises + fades in, in reading order, on the
// Expo-out curve. The "authored, not loaded" entrance. Pure CSS (the animation
// runs even without JS); reduced-motion shows it instantly.
// craft-lab: entrance-choreography (Essential-tier baseline), dep-free.

type Tag = "span" | "div" | "h1" | "h2" | "p";

export function RevealText({
  text,
  className,
  as: Element = "span",
  delay = 0.15,
  stagger = 0.07,
  duration = 0.7,
}: {
  text: string;
  className?: string;
  as?: Tag;
  /** seconds before the first word starts */
  delay?: number;
  /** seconds between each word */
  stagger?: number;
  /** seconds per word */
  duration?: number;
}) {
  const lines = text.split("\n");
  let wi = 0;
  return (
    <Element className={className} aria-label={text}>
      <span aria-hidden="true">
        {lines.map((line, li) => (
          <Fragment key={li}>
            {line.split(" ").map((word, i, arr) => {
              const d = delay + wi * stagger;
              wi++;
              return (
                <Fragment key={i}>
                  <span className="rt-word">
                    <span
                      className="rt-inner"
                      style={{ animationDelay: `${d}s`, animationDuration: `${duration}s` }}
                    >
                      {word}
                    </span>
                  </span>
                  {i < arr.length - 1 ? " " : null}
                </Fragment>
              );
            })}
            {li < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </span>
    </Element>
  );
}
