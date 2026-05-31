"use client";
import { useEffect, useRef, useState } from "react";

const TOTAL_MS = 14000; // typical Sepolia block time

export function TxProgress({ active }: { active: boolean }) {
  const [pct, setPct] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setPct(0);
      startRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startRef.current = Date.now();

    const tick = () => {
      if (!startRef.current) return;
      const elapsed = Date.now() - startRef.current;
      // ease-out: fast at start, slower near end, caps at 95%
      const raw = Math.min(elapsed / TOTAL_MS, 0.95);
      const eased = 1 - Math.pow(1 - raw, 2);
      setPct(Math.round(eased * 100));
      if (raw < 0.95) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active]);

  if (!active) return null;

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/35">Confirming on blockchain…</span>
        <span className="text-xs font-mono text-white/25">{pct}%</span>
      </div>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(0,199,77,0.6), rgba(0,199,77,1))",
            boxShadow: "0 0 6px rgba(0,199,77,0.5)",
          }}
        />
      </div>
    </div>
  );
}
