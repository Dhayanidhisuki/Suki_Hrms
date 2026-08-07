"use client";

import { useEffect, useState, useRef } from "react";

export function AnimatedCountUp({
  value,
  duration = 1000,
  className = "",
}: {
  value: number | string;
  duration?: number;
  className?: string;
}) {
  const targetNum = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  const isNumeric = !isNaN(targetNum);

  const [displayValue, setDisplayValue] = useState<number | string>(isNumeric ? 0 : value);
  const startValRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric) {
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
      const current = Math.round(startValRef.current + (targetNum - startValRef.current) * easeOut);

      setDisplayValue(current);

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
      {typeof displayValue === "number" ? displayValue.toLocaleString() : displayValue}
    </span>
  );
}
