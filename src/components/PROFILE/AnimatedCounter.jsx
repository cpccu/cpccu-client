"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({ value }) {
  const ref = useRef(null);
  const observerRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    setDisplayValue(0);

    const animate = (timestamp) => {
      const start = timestamp;
      const duration = 1100;

      const step = (ts) => {
        const elapsed = ts - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * eased));

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };

      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        animate(performance.now());
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [value]);

  return <span ref={ref}>{displayValue.toLocaleString()}</span>;
}
