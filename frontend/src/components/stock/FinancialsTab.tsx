"use client";

import { useEffect, useState } from "react";
import { api, type FinancialStatement } from "@/lib/api";

interface FinancialsTabProps {
  ticker: string;
}

type StatementType = "income" | "balance" | "cashflow";
type Freq = "annual" | "quarterly";

const STATEMENTS: { id: StatementType; label: string }[] = [
  { id: "income", label: "Gelir Tablosu" },
  { id: "balance", label: "Bilanço" },
  { id: "cashflow", label: "Nakit Akışı" },
];

function formatStatValue(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function FinancialsTab({ ticker }: FinancialsTabProps) {
  const [statement, setStatement] = useState<StatementType>("income");
  const [freq, setFreq] = useState<Freq>("annual");
  const [data, setData] = useState<FinancialStatement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.financials(ticker, statement, freq)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker, statement, freq]);

  return (
    <div className="p-6 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex rounded-lg p-[3px] gap-[2px]"
        >
          {STATEMENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatement(s.id)}
              style={{
                background: statement === s.id ? "var(--bg-card)" : "transparent",
                color: statement === s.id ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: statement === s.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="flex rounded-lg p-[3px] gap-[2px]"
        >
          {(["annual", "quarterly"] as Freq[]).map((f) => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              style={{
                background: freq === f ? "var(--bg-card)" : "transparent",
                color: freq === f ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: freq === f ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-all cursor-pointer"
            >
              {f === "annual" ? "Yıllık" : "Çeyreklik"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="rounded-xl h-64 animate-pulse"
        />
      ) : !data || data.rows.length === 0 ? (
        <div
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          className="rounded-xl p-8 text-center"
        >
          <p style={{ color: "var(--text-muted)" }} className="text-[13px]">
            Bu hisse için finansal tablo verisi bulunamadı.
          </p>
        </div>
      ) : (
        <div
          style={{ border: "1px solid var(--border)" }}
          className="rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th
                    style={{ color: "var(--text-muted)" }}
                    className="text-left px-4 py-3 font-medium w-[220px]"
                  >
                    Kalem
                  </th>
                  {data.columns.map((col) => (
                    <th
                      key={col}
                      style={{ color: "var(--text-muted)" }}
                      className="text-right px-4 py-3 font-medium tabular-nums"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-secondary)",
                    }}
                    className="hover:brightness-95 transition-all"
                  >
                    <td
                      style={{ color: "var(--text-secondary)" }}
                      className="px-4 py-2.5 font-medium"
                    >
                      {row.label}
                    </td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        style={{ color: "var(--text-primary)" }}
                        className="px-4 py-2.5 text-right tabular-nums"
                      >
                        {formatStatValue(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
