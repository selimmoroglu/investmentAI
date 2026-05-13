"use client";

import type { ReactNode } from "react";

type StatTone = "default" | "up" | "down" | "accent" | "muted";
type StatSize = "sm" | "md" | "lg";

interface StatProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  tone?: StatTone;
  size?: StatSize;
  hint?: string;
  className?: string;
}

const TONE_COLOR: Record<StatTone, string> = {
  default: "var(--text-primary)",
  up: "var(--up)",
  down: "var(--down)",
  accent: "var(--accent-primary)",
  muted: "var(--text-muted)",
};

const SIZE_MAP: Record<StatSize, { value: string; label: string; gap: string }> = {
  sm: { value: "13px", label: "10px", gap: "2px" },
  md: { value: "15px", label: "10px", gap: "4px" },
  lg: { value: "22px", label: "11px", gap: "4px" },
};

/** Tekrar eden "label + value" mini-block için tek bir component. */
export function Stat({ label, value, subtitle, tone = "default", size = "md", hint, className = "" }: StatProps) {
  const dims = SIZE_MAP[size];
  return (
    <div className={`flex flex-col ${className}`} style={{ gap: dims.gap }} title={hint}>
      <span
        style={{ color: "var(--text-muted)", fontSize: dims.label, letterSpacing: "0.04em" }}
        className="uppercase font-medium"
      >
        {label}
      </span>
      <span
        style={{
          color: TONE_COLOR[tone],
          fontSize: dims.value,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {subtitle && (
        <span style={{ color: "var(--text-muted)", fontSize: "10px" }} className="tabular-nums">
          {subtitle}
        </span>
      )}
    </div>
  );
}
