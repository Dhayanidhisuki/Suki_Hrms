"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/themes";

interface BrandLogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  /** Black rounded plate so the white “SUKI” type stays visible on light surfaces. */
  plate?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: "h-10 w-auto",
  md: "h-14 w-auto",
  lg: "h-16 w-auto",
  xl: "h-20 w-auto",
} as const;

/** Theme-aware Suki HRMS wordmark. Uses a real img so the SVG always paints. */
export function BrandLogo({
  variant = "full",
  size = "md",
  plate = false,
  className = "",
}: BrandLogoProps) {
  const { theme } = useTheme();
  const src = THEMES[theme].logo;

  const img = (
    <img
      src={src}
      alt="Suki HRMS"
      draggable={false}
      className={
        variant === "mark"
          ? "h-10 w-auto max-w-none select-none"
          : `${SIZE_CLASS[size]} select-none`
      }
    />
  );

  if (variant === "mark") {
    return (
      <span className={`inline-flex h-10 w-10 shrink-0 overflow-hidden ${className}`.trim()}>
        {img}
      </span>
    );
  }

  if (plate) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-black px-2.5 py-1.5 ${className}`.trim()}>
        {img}
      </span>
    );
  }

  return className ? (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>{img}</span>
  ) : (
    img
  );
}
