"use client";

import { useEffect, useState, useRef } from "react";

export function AnimatedCountUp({
  value,
  duration = 1000,
  className = "",
  format,
}: {
  value: number | string;
  duration?: number;
  className?: string;
  /**
   * Renders each frame's value. Lets a formatted figure (currency, a
   * percentage) count up too, instead of only a bare integer. The raw eased
   * number is passed through unrounded so the formatter decides precision.
   */
  format?: (n: number) => string;
}) {
  const targetNum = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  const isNumeric = !isNaN(targetNum);

  const [displayValue, setDisplayValue] = useState<number | string>(isNumeric ? 0 : value);
  // Callers pass `format` inline, so it is a new function every render. Held
  // in a ref it can be read by the animation frame without becoming an effect
  // dependency that restarts the count on each render. Assigned in an effect
  // rather than during render, which React does not allow.
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });

  const startValRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayValue(value);
      return;
    }

    startValRef.current = typeof displayValue === "number" ? displayValue : 0;
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      
      // Smooth easeOutCubic curve for elegant number acceleration and deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const raw = startValRef.current + (targetNum - startValRef.current) * easeOut;
      // Without a formatter the value is a plain count, so it stays integral.
      setDisplayValue(formatRef.current ? raw : Math.round(raw));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [targetNum, isNumeric, duration]);

  return (
    <span className={className}>
      {typeof displayValue === "number"
        ? format
          ? format(displayValue)
          : displayValue.toLocaleString()
        : displayValue}
    </span>
  );
}
