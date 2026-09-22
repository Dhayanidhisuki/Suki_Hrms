"use client";

import { SukiHrmsWordmark } from "@/components/ui/SukiHrmsWordmark";

interface BrandLogoProps {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Black rounded plate. No longer needed — the inline wordmark reads on any
   * surface — and kept only so existing callers stay valid.
   *
   * @deprecated
   */
  plate?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: "h-10 w-auto",
  md: "h-14 w-auto",
  lg: "h-16 w-auto",
  xl: "h-20 w-auto",
} as const;

/**
 * Suki HRMS wordmark.
 *
 * Draws the inline SVG rather than an <img> of /branding/suki-hrms-*.svg: those
 * files paint "SUKI" solid white for a black plate, so an image of them needs a
 * dark box behind it wherever it goes. Inline, the chevrons take the live
 * theme's accent and the word takes the surrounding text colour, so the logo
 * works on a light login card, a dark rail and a themed dialog alike.
 *
 * On a dark surface, give it a light text colour (e.g. `text-white`).
 */
export function BrandLogo({
  variant = "full",
  size = "md",
  plate = false,
  className = "",
}: BrandLogoProps) {
  const mark = (
    <SukiHrmsWordmark
      variant={variant}
      className={variant === "mark" ? "h-10 w-auto" : SIZE_CLASS[size]}
    />
  );

  if (variant === "mark") {
    return (
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center ${className}`.trim()}>
        {mark}
      </span>
    );
  }

  if (plate) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-black px-2.5 py-1.5 text-white ${className}`.trim()}
      >
        {mark}
      </span>
    );
  }

  return className ? (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`}>{mark}</span>
  ) : (
    mark
  );
}
