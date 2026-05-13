"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const SIZE_MAP: Record<ButtonSize, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: "0 10px", fontSize: "12px", height: "28px" },
  md: { padding: "0 14px", fontSize: "13px", height: "34px" },
  lg: { padding: "0 18px", fontSize: "14px", height: "40px" },
};

export function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  fullWidth,
  className = "",
  style,
  children,
  ...rest
}: ButtonProps) {
  const dims = SIZE_MAP[size];

  const variantStyle: CSSProperties = (() => {
    switch (variant) {
      case "primary":
        return {
          background: "var(--brand-gradient)",
          color: "#fff",
          border: "1px solid transparent",
          fontWeight: 600,
        };
      case "danger":
        return {
          background: "var(--down-bg)",
          color: "var(--down)",
          border: "1px solid color-mix(in srgb, var(--down) 40%, transparent)",
          fontWeight: 600,
        };
      case "ghost":
        return {
          background: "transparent",
          color: "var(--text-secondary)",
          border: "1px solid transparent",
          fontWeight: 500,
        };
      default: // secondary
        return {
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          fontWeight: 500,
        };
    }
  })();

  const hoverClass = (() => {
    switch (variant) {
      case "primary":
        return "hover:shadow-[var(--shadow-glow-accent)] hover:-translate-y-px";
      case "danger":
        return "hover:bg-[var(--down-bg)] hover:border-[var(--down)]";
      case "ghost":
        return "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";
      default:
        return "hover:border-[var(--border-strong)] hover:bg-[var(--bg-tertiary)]";
    }
  })();

  const combinedStyle: CSSProperties = {
    ...variantStyle,
    padding: dims.padding,
    fontSize: dims.fontSize,
    height: dims.height,
    width: fullWidth ? "100%" : undefined,
    borderRadius: "var(--radius-md)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    transition: "all var(--transition-fast)",
    whiteSpace: "nowrap",
    opacity: rest.disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <button {...rest} style={combinedStyle} className={`${hoverClass} ${className}`.trim()}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
