"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({ illustration, title, description, action, className = "", size = "md" }: EmptyStateProps) {
  const padding = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-14";
  return (
    <div className={`flex flex-col items-center justify-center text-center ${padding} px-6 ${className}`}>
      {illustration && <div className="mb-4">{illustration}</div>}
      <p style={{ color: "var(--text-primary)" }} className="text-[14px] font-semibold mb-1">{title}</p>
      {description && (
        <p style={{ color: "var(--text-muted)" }} className="text-[12px] max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// =========== Minimal stroke-only illustrations ===========

export function SelectIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <defs>
        <linearGradient id="il-select" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="52" height="44" rx="6" stroke="var(--border-strong)" strokeWidth="1.5" />
      <line x1="10" y1="26" x2="62" y2="26" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x="16" y="32" width="16" height="20" rx="3" fill="url(#il-select)" opacity="0.7" />
      <rect x="36" y="38" width="20" height="14" rx="3" stroke="var(--text-muted)" strokeWidth="1.4" />
      <circle cx="14" cy="20" r="1.5" fill="var(--text-muted)" />
      <circle cx="19" cy="20" r="1.5" fill="var(--text-muted)" />
      <circle cx="24" cy="20" r="1.5" fill="var(--text-muted)" />
    </svg>
  );
}

export function NoMatchesIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <defs>
        <linearGradient id="il-search" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="18" stroke="url(#il-search)" strokeWidth="2.5" />
      <line x1="44" y1="44" x2="58" y2="58" stroke="url(#il-search)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="22" y1="30" x2="38" y2="30" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="30" cy="30" r="1.5" fill="var(--text-muted)" />
    </svg>
  );
}

export function EmptyWatchlistIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <defs>
        <linearGradient id="il-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path
        d="M28 8 L33.3 19 L45 20.8 L36.5 29.2 L38.7 41 L28 35.4 L17.3 41 L19.5 29.2 L11 20.8 L22.7 19 Z"
        fill="url(#il-star)"
        stroke="var(--border-strong)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
