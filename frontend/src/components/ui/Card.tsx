"use client";

import type { CSSProperties, ReactNode } from "react";

type CardVariant = "default" | "elevated" | "interactive" | "glass";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: () => void;
  as?: "div" | "button";
}

const PADDING_MAP: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  style,
  children,
  onClick,
  as,
}: CardProps) {
  const baseStyle: CSSProperties = {
    background: variant === "glass" ? "var(--glass-bg)" : "var(--bg-secondary)",
    border: `1px solid ${variant === "glass" ? "var(--glass-border)" : "var(--border)"}`,
    borderRadius: "var(--radius-xl)",
    transition: "background var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-base)",
    ...(variant === "elevated" && { boxShadow: "var(--shadow-sm)" }),
    ...(variant === "glass" && { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }),
    ...style,
  };

  const interactiveClass =
    variant === "interactive"
      ? "cursor-pointer hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] hover:-translate-y-px"
      : variant === "elevated"
        ? "hover:shadow-[var(--shadow-md)]"
        : "";

  const Component = as ?? (onClick ? "button" : "div");
  return (
    <Component
      onClick={onClick}
      style={baseStyle}
      className={`${PADDING_MAP[padding]} ${interactiveClass} ${className}`.trim()}
    >
      {children}
    </Component>
  );
}
