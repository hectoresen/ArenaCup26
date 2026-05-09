"use client";

import { useEffect, useRef } from "react";

const EMOJIS = ["⚽", "🏃", "⚽", "🌍", "⚽", "🎯", "⚽"] as const;

export function FloatingBalls({ count = 7 }: { count?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;

    const elements: HTMLSpanElement[] = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.textContent = EMOJIS[i % EMOJIS.length] ?? "⚽";
      el.setAttribute("aria-hidden", "true");
      el.style.position = "fixed";
      el.style.pointerEvents = "none";
      el.style.opacity = "0.07";
      el.style.left = `${8 + i * 13}vw`;
      el.style.fontSize = `${12 + Math.random() * 16}px`;
      el.style.animation = `floatUp ${20 + Math.random() * 18}s linear infinite`;
      el.style.animationDelay = `${-Math.random() * 22}s`;
      c.appendChild(el);
      elements.push(el);
    }

    return () => {
      for (const el of elements) {
        el.remove();
      }
    };
  }, [count]);

  return <div ref={containerRef} aria-hidden="true" className="pointer-events-none" />;
}
