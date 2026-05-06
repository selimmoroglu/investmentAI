"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface DataPoint {
  time: number;
  value: number;
}

interface RSIMACDChartProps {
  rsi: DataPoint[];
  macd: DataPoint[];
  macdSignal: DataPoint[];
  macdHistogram: DataPoint[];
  height?: number;
}

export function RSIMACDChart({ rsi, macd, macdSignal, height = 160 }: RSIMACDChartProps) {
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!rsiRef.current || !macdRef.current) return;

    let rsiChart: any = null;
    let macdChart: any = null;

    import("lightweight-charts").then((lc) => {
      const { createChart, ColorType, LineSeries } = lc;
      const isDark = theme === "dark";

      const chartOpts = {
        layout: {
          background: { type: ColorType.Solid, color: isDark ? "#09090b" : "#ffffff" },
          textColor: isDark ? "#a1a1aa" : "#71717a",
        },
        grid: {
          vertLines: { color: isDark ? "#27272a" : "#f4f4f5" },
          horzLines: { color: isDark ? "#27272a" : "#f4f4f5" },
        },
        rightPriceScale: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
        timeScale: { borderColor: isDark ? "#27272a" : "#e4e4e7", timeVisible: false },
        handleScroll: false,
        handleScale: false,
      };

      if (!rsiRef.current || !macdRef.current) return;

      rsiChart = createChart(rsiRef.current, { ...chartOpts, width: rsiRef.current.clientWidth, height });
      const rsiSeries = rsiChart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1.5, title: "RSI" });
      rsiSeries.setData(rsi.map((d) => ({ time: d.time as any, value: d.value })));
      rsiChart.timeScale().fitContent();

      macdChart = createChart(macdRef.current, { ...chartOpts, width: macdRef.current.clientWidth, height });
      const macdLine = macdChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1.5, title: "MACD" });
      macdLine.setData(macd.map((d) => ({ time: d.time as any, value: d.value })));
      const signalLine = macdChart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, title: "Signal" });
      signalLine.setData(macdSignal.map((d) => ({ time: d.time as any, value: d.value })));
      macdChart.timeScale().fitContent();

      const roRsi = new ResizeObserver(() => {
        if (rsiRef.current && rsiChart) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
      });
      const roMacd = new ResizeObserver(() => {
        if (macdRef.current && macdChart) macdChart.applyOptions({ width: macdRef.current.clientWidth });
      });
      roRsi.observe(rsiRef.current);
      roMacd.observe(macdRef.current);

      return () => {
        roRsi.disconnect();
        roMacd.disconnect();
      };
    });

    return () => {
      if (rsiChart) { rsiChart.remove(); rsiChart = null; }
      if (macdChart) { macdChart.remove(); macdChart = null; }
    };
  }, [rsi, macd, macdSignal, theme, height]);

  return (
    <div className="space-y-4">
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide px-1 mb-1">
          RSI (14)
        </p>
        <div ref={rsiRef} style={{ width: "100%", height }} />
      </div>
      <div>
        <p style={{ color: "var(--text-muted)" }} className="text-[11px] uppercase tracking-wide px-1 mb-1">
          MACD
        </p>
        <div ref={macdRef} style={{ width: "100%", height }} />
      </div>
    </div>
  );
}
