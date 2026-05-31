"use client";
import React from "react";

function InfoModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.2s ease-out" }} onClick={onClose}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm border border-white/8 overflow-y-auto max-h-[85vh]"
        style={{ animation: "slideUp 0.25s ease-out" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base text-white font-semibold">{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white/70 hover:bg-white/8 transition-all text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.45)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}>
      i
    </button>
  );
}

// ── Coin Flip info ────────────────────────────────────────────────
export function CoinFlipInfo({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="🪙 Coin Flip — Rules" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-white/50 leading-relaxed">Pick Heads or Tails. The contract flips a provably fair coin using on-chain randomness.</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Payouts</p>
          </div>
          {[
            { sym: "👑 Heads (correct)", pay: "1.95×", color: "#f0b90b" },
            { sym: "⚡ Tails (correct)", pay: "1.95×", color: "#8fb8d4" },
            { sym: "Wrong side", pay: "0×", color: "#f6465d" },
          ].map((r, i) => (
            <div key={i} className="flex justify-between px-4 py-2" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              <span className="text-white/60">{r.sym}</span>
              <span className="font-mono font-bold" style={{ color: r.color }}>{r.pay}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-white/35 text-xs">🏦 House edge: <span className="text-white/60">2.5%</span></p>
          <p className="text-white/35 text-xs">🎲 Randomness: <span className="text-white/60">keccak256(prevrandao + player + bet)</span></p>
          <p className="text-white/35 text-xs">⚡ Settlement: <span className="text-white/60">Same transaction</span></p>
        </div>
      </div>
    </InfoModal>
  );
}

// ── Dice info ─────────────────────────────────────────────────────
export function DiceInfo({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="🎲 Dice — Rules" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-white/50 leading-relaxed">Set a target number (2–98) and bet Over or Under. A random number 1–100 is rolled.</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Example payouts</p>
          </div>
          {[
            { bet: "Under 50", chance: "49%",  mult: "2.02×" },
            { bet: "Under 25", chance: "24%",  mult: "4.13×" },
            { bet: "Under 10", chance: "9%",   mult: "11×"   },
            { bet: "Over 50",  chance: "49%",  mult: "2.02×" },
            { bet: "Over 75",  chance: "24%",  mult: "4.13×" },
            { bet: "Over 90",  chance: "9%",   mult: "11×"   },
          ].map((r, i) => (
            <div key={i} className="flex justify-between px-4 py-2" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              <span className="text-white/50">{r.bet}</span>
              <span className="text-white/35 text-xs">{r.chance}</span>
              <span className="font-mono font-bold text-[#00c74d]">{r.mult}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs text-center">Payout = 99 ÷ win_chance%</p>
        <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-white/35 text-xs">🏦 House edge: <span className="text-white/60">1%</span></p>
          <p className="text-white/35 text-xs">🎲 Roll range: <span className="text-white/60">1 to 100</span></p>
        </div>
      </div>
    </InfoModal>
  );
}

// ── Crash info ────────────────────────────────────────────────────
export function CrashInfo({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="🚀 Crash — Rules" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-white/50 leading-relaxed">Set an exit multiplier before launch. The rocket takes off — if the crash point is at or above your target, you win!</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Example targets</p>
          </div>
          {[
            { target: "1.5×", chance: "66%", win: "bet × 1.5" },
            { target: "2×",   chance: "49%", win: "bet × 2" },
            { target: "5×",   chance: "19%", win: "bet × 5" },
            { target: "10×",  chance: "9.9%", win: "bet × 10" },
            { target: "100×", chance: "~1%", win: "bet × 100" },
          ].map((r, i) => (
            <div key={i} className="flex justify-between px-4 py-2" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              <span className="font-mono text-[#f0b90b]">{r.target}</span>
              <span className="text-white/35 text-xs">{r.chance} win</span>
              <span className="text-white/60 text-xs">{r.win}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl px-4 py-3 space-y-1.5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-white/35 text-xs">🏦 House edge: <span className="text-white/60">1%</span></p>
          <p className="text-white/35 text-xs">📈 Max multiplier: <span className="text-white/60">9900×</span></p>
          <p className="text-white/35 text-xs">🎲 Crash point: <span className="text-white/60">determined on-chain after bet</span></p>
        </div>
      </div>
    </InfoModal>
  );
}

// ── Slots info ────────────────────────────────────────────────────
export function SlotsInfo({ onClose }: { onClose: () => void }) {
  return (
    <InfoModal title="🎰 Slots — Pay Table" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="text-white/50 leading-relaxed">3 reels, 8 symbols each. Win line is the middle row. Cherries pay even on partial matches!</p>
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2" style={{ background: "rgba(0,0,0,0.3)" }}>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Winning combinations</p>
          </div>
          {[
            { combo: "💎 💎 💎", pay: "50×",  color: "#ff6b6b" },
            { combo: "7️⃣ 7️⃣ 7️⃣", pay: "20×",  color: "#f0b90b" },
            { combo: "🎰 🎰 🎰", pay: "10×",  color: "#aaa"    },
            { combo: "⭐ ⭐ ⭐",  pay: "7×",   color: "#00c74d" },
            { combo: "Any 3 same", pay: "3×", color: "#48cae4" },
            { combo: "🍒 🍒 (any)", pay: "2×",  color: "#ff9999" },
            { combo: "🍒 (any 1)", pay: "1.5×", color: "#ffbbbb" },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center px-4 py-2" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              <span className="text-sm">{r.combo}</span>
              <span className="font-mono font-bold" style={{ color: r.color }}>{r.pay}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-white/35 text-xs">Symbols: 🍒🍋🍊🍇⭐🎰7️⃣💎</p>
          <p className="text-white/35 text-xs">Max bet: <span className="text-white/60">0.05 ETH</span></p>
        </div>
      </div>
    </InfoModal>
  );
}
