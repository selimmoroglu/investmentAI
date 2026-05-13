"use client";

import type { CSSProperties } from "react";

type SkeletonVariant = "text" | "rect" | "circle";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  variant = "rect",
  width,
  height,
  radius,
  className = "",
  style,
}: SkeletonProps) {
  const baseRadius =
    variant === "circle"
      ? "var(--radius-full)"
      : variant === "text"
        ? "var(--radius-sm)"
        : "var(--radius-md)";

  const combined: CSSProperties = {
    width: width ?? (variant === "text" ? "100%" : undefined),
    height: height ?? (variant === "text" ? "0.9em" : variant === "circle" ? "40px" : "100%"),
    borderRadius: radius ?? baseRadius,
    display: "block",
    ...style,
  };

  return <div className={`shimmer ${className}`.trim()} style={combined} />;
}

/** Birden fazla skeleton hızlı oluşturmak için */
export function SkeletonGroup({ count, height = "16px", gap = "8px" }: { count: number; height?: string; gap?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="text" height={height} />
      ))}
    </div>
  );
}
