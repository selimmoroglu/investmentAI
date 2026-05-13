"use client";

import type { CSSProperties, ReactNode } from "react";

type BadgeTone = "up" | "down" | "neutral" | "warn" | "info" | "accent";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
  variant?: "soft" | "outline" | "solid";
}

function toneColors(tone: BadgeTone): { bg: string; fg: string; border: string } {
  switch (tone) {
    case "up":
      return { bg: "var(--up-bg)", fg: "var(--up)", border: "color-mix(in srgb, var(--up) 30%, transparent)" };
    case "down":
      return { bg: "var(--down-bg)", fg: "var(--down)", border: "color-mix(in srgb, var(--down) 30%, transparent)" };
    case "warn":
      return { bg: "rgba(245, 158, 11, 0.12)", fg: "#f59e0b", border: "rgba(245, 158, 11, 0.35)" };
    case "info":
      return { bg: "rgba(59, 130, 246, 0.12)", fg: "#3b82f6", border: "rgba(59, 130, 246, 0.35)" };
    case "accent":
      return { bg: "var(--accent-muted)", fg: "var(--accent-primary)", border: "color-mix(in srgb, var(--accent-primary) 35%, transparent)" };
    default:
      return { bg: "var(--bg-tertiary)", fg: "var(--text-secondary)", border: "var(--border)" };
  }
}

const SIZE_MAP: Record<BadgeSize, { padding: string; fontSize: string }> = {
  sm: { padding: "1px 6px", fontSize: "10px" },
  md: { padding: "3px 9px", fontSize: "11px" },
};

export function Badge({ tone = "neutral", size = "md", children, className = "", variant = "soft" }: BadgeProps) {
  const c = toneColors(tone);
  const dims = SIZE_MAP[size];
  const style: CSSProperties = {
    padding: dims.padding,
    fontSize: dims.fontSize,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
    ...(variant === "solid"
      ? { background: c.fg, color: "#fff", border: "1px solid transparent" }
      : variant === "outline"
        ? { background: "transparent", color: c.fg, border: `1px solid ${c.border}` }
        : { background: c.bg, color: c.fg, border: `1px solid ${c.border}` }),
  };
  return <span style={style} className={className}>{children}</span>;
}
