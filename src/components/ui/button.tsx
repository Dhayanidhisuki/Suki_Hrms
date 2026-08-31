"use client";

import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", type = "button", className = "", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
      md: "px-4 py-2.5 text-sm gap-2",
      lg: "px-6 py-2.5 text-sm gap-2",
    };

    const variantStyles = {
      primary:
        "bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:opacity-90 text-white shadow-sm hover:shadow-md",
      secondary:
        "bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)]",
      outline:
        "border border-[var(--border-main)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
      ghost:
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
      danger:
        "bg-[var(--color-danger)] hover:opacity-90 text-white shadow-sm",
    };

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
