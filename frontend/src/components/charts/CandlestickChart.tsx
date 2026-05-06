"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { OHLCVBar } from "@/lib/api";

interface CandlestickChartProps {
  data: OHLCVBar[];
  overlays?: {
    sma20?: { time: number; value: number }[];
    sma50?: { time: number; value: number }[];
    sma200?: { time: number; value: number }[];
    bbUpper?: { time: number; value: number }[];
    bbMid?: { time: number; value: number }[];
    bbLower?: { time: number; value: number }[];
  };
  height?: number;
}

export function CandlestickChart({ data, overlays, height = 420 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let chart: any = null;

    import("lightweight-charts").then((lc) => {
      const { createChart, ColorType, CandlestickSeries, LineSeries } = lc;

      if (!containerRef.current) return;

      const isDark = theme === "dark";

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: isDark ? "#09090b" : "#ffffff" },
          textColor: isDark ? "#a1a1aa" : "#71717a",
        },
        grid: {
          vertLines: { color: isDark ? "#27272a" : "#f4f4f5" },
          horzLines: { color: isDark ? "#27272a" : "#f4f4f5" },
        },
        rightPriceScale: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
        timeScale: { borderColor: isDark ? "#27272a" : "#e4e4e7", timeVisible: true },
        handleScroll: true,
        handleScale: true,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: isDark ? "#22c55e" : "#16a34a",
        downColor: isDark ? "#ef4444" : "#dc2626",
        borderUpColor: isDark ? "#22c55e" : "#16a34a",
        borderDownColor: isDark ? "#ef4444" : "#dc2626",
        wickUpColor: isDark ? "#22c55e" : "#16a34a",
        wickDownColor: isDark ? "#ef4444" : "#dc2626",
      });

      candleSeries.setData(
        data.map((d) => ({ time: d.time as any, open: d.open, high: d.high, low: d.low, close: d.close }))
      );

      if (overlays?.sma20?.length) {
        const s = chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1, title: "SMA20" });
        s.setData(overlays.sma20.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (overlays?.sma50?.length) {
        const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, title: "SMA50" });
        s.setData(overlays.sma50.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (overlays?.sma200?.length) {
        const s = chart.addSeries(LineSeries, { color: "#ec4899", lineWidth: 1, title: "SMA200" });
        s.setData(overlays.sma200.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (overlays?.bbUpper?.length) {
        const bbU = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 1, lineStyle: 2, title: "BB+" });
        bbU.setData(overlays.bbUpper.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (overlays?.bbLower?.length) {
        const bbL = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 1, lineStyle: 2, title: "BB-" });
        bbL.setData(overlays.bbLower.map((d) => ({ time: d.time as any, value: d.value })));
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
      };
    });

    return () => {
      if (chart) {
        chart.remove();
        chart = null;
      }
    };
  }, [data, overlays, theme, height]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
