"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, decodeEventLog } from "viem";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import {
  CONTRACT_V2_ADDRESS, MIN_BET_ETH, BET_STEP, txUrl, txErrMsg,
} from "@/lib/config";
import { playWin, playLose, playClick } from "@/lib/sounds";
import { InfoButton, SlotsInfo } from "@/components/InfoModal";
import { TxProgress } from "@/components/TxProgress";

// ── Config ────────────────────────────────────────────────────────
const SLOTS_ADDRESS = (process.env.NEXT_PUBLIC_SLOTS_ADDRESS as `0x${string}`)
  ?? "0x0000000000000000000000000000000000000000";
const SLOTS_DEPLOYED = SLOTS_ADDRESS !== "0x0000000000000000000000000000000000000000";
const MAX_BET_SLOTS = 0.05;

const SLOTS_ABI = [
  { name: "deposit",       type: "function", inputs: [],                                           outputs: [], stateMutability: "payable"  },
  { name: "withdraw",      type: "function", inputs: [{ name: "amount", type: "uint256" }],        outputs: [], stateMutability: "nonpayable" },
  { name: "spin",          type: "function", inputs: [{ name: "betAmount", type: "uint256" }],     outputs: [], stateMutability: "nonpayable" },
  { name: "balanceOf",     type: "function", inputs: [{ name: "p", type: "address" }],             outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "contractBalance", type: "function", inputs: [],                                         outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    name: "SlotsPlayed", type: "event", anonymous: false,
    inputs: [
      { indexed: true,  name: "gameId",    type: "uint256" },
      { indexed: true,  name: "player",    type: "address" },
      { indexed: false, name: "reel1",     type: "uint8"   },
      { indexed: false, name: "reel2",     type: "uint8"   },
      { indexed: false, name: "reel3",     type: "uint8"   },
      { indexed: false, name: "won",       type: "bool"    },
      { indexed: false, name: "betAmount", type: "uint256" },
      { indexed: false, name: "payout",    type: "uint256" },
      { indexed: false, name: "randomSeed", type: "bytes32" },
    ],
  },
  { name: "Deposit",    type: "event", anonymous: false, inputs: [{ indexed: true, name: "player", type: "address" }, { indexed: false, name: "amount", type: "uint256" }] },
  { name: "Withdrawal", type: "event", anonymous: false, inputs: [{ indexed: true, name: "player", type: "address" }, { indexed: false, name: "amount", type: "uint256" }] },
] as const;

const SLOTS_CONFIG = { address: SLOTS_ADDRESS, abi: SLOTS_ABI } as const;

// ── Symbols ───────────────────────────────────────────────────────
const SYMS = ["🍒","🍋","🍊","🍇","⭐","🎰","7️⃣","💎"];
const SYM_NAMES = ["Cherry","Lemon","Orange","Grape","Star","Bar","Seven","Diamond"];
const PAYOUTS = [
  { label: "💎 💎 💎",  mult: "50×", color: "#ff6b6b" },
  { label: "7️⃣ 7️⃣ 7️⃣", mult: "20×", color: "#f0b90b" },
  { label: "🎰 🎰 🎰",  mult: "10×", color: "#aaa"    },
  { label: "⭐ ⭐ ⭐",   mult: "7×",  color: "#00c74d" },
  { label: "Any 3 same", mult: "3×",  color: "#48cae4" },
  { label: "🍒 🍒",     mult: "2×",  color: "#ff8888" },
  { label: "🍒",        mult: "1.5×", color: "#ffaaaa" },
];

// ── Single reel ───────────────────────────────────────────────────
function Reel({
  spinning, result, stopDelay, onStopped, won,
}: {
  spinning: boolean;
  result: number | null;
  stopDelay: number;
  onStopped: () => void;
  won: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const [bump, setBump] = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (spinning) {
      setLocked(false);
      setBump(false);
      ivRef.current = setInterval(() => setIdx(i => (i + 1) % 8), 55);

      if (result !== null) {
        stRef.current = setTimeout(() => {
          if (ivRef.current) clearInterval(ivRef.current);
          setIdx(result);
          setLocked(true);
          setBump(true);
          setTimeout(() => setBump(false), 300);
          onStopped();
        }, stopDelay);
      }
    } else {
      if (ivRef.current) clearInterval(ivRef.current);
    }
    return () => {
      if (ivRef.current) clearInterval(ivRef.current);
      if (stRef.current) clearTimeout(stRef.current);
    };
  }, [spinning, result, stopDelay, onStopped]);

  // Show 3 rows: prev, current, next
  const prev = (idx - 1 + 8) % 8;
  const next = (idx + 1) % 8;

  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-xl"
      style={{
        width: 90, height: 240,
        background: "linear-gradient(180deg,#0a0c14 0%,#111520 50%,#0a0c14 100%)",
        border: locked
          ? `2px solid ${won ? "#00c74d" : "rgba(255,255,255,0.15)"}`
          : "2px solid rgba(255,255,255,0.08)",
        boxShadow: locked && won ? "0 0 16px rgba(0,199,77,0.4)" : undefined,
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(180deg,#0a0c14 0%,transparent 100%)" }} />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(0deg,#0a0c14 0%,transparent 100%)" }} />

      {/* Win line highlight */}
      <div className="absolute left-0 right-0 z-0 pointer-events-none"
        style={{ top: 80, height: 80, background: locked && won ? "rgba(0,199,77,0.08)" : "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }} />

      {/* Symbols */}
      <div
        className="flex flex-col items-center justify-center w-full"
        style={{
          transform: bump ? "translateY(6px)" : "translateY(0)",
          transition: bump ? "transform 0.15s ease-out" : "transform 0.15s ease-in",
        }}
      >
        {[prev, idx, next].map((s, i) => (
          <div key={i} className="flex items-center justify-center"
            style={{ height: 80, fontSize: i === 1 ? (spinning ? 44 : 48) : 34, opacity: i === 1 ? 1 : (spinning ? 0.5 : 0.35), filter: spinning && i !== 1 ? "blur(1px)" : undefined, transition: "font-size 0.15s, opacity 0.15s" }}>
            {SYMS[s]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payout table ──────────────────────────────────────────────────
function PayTable() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-3 py-2" style={{ background: "rgba(0,0,0,0.3)" }}>
        <p className="text-white/40 text-[10px] uppercase tracking-widest text-center">Pay Table</p>
      </div>
      {PAYOUTS.map((p, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-1.5" style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
          <span className="text-sm">{p.label}</span>
          <span className="font-mono font-bold text-sm" style={{ color: p.color }}>{p.mult}</span>
        </div>
      ))}
    </div>
  );
}

function Spinner() { return <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />; }

// ── Quick deposit inside Slots ────────────────────────────────────
function QuickDeposit({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState("0.01");
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) { toast.success("Deposited! You can spin now 🎰"); onSuccess(); }
  }, [isSuccess, onSuccess]);

  const handleDeposit = () => {
    const v = parseFloat(amount);
    if (isNaN(v) || v <= 0) return;
    const id = toast.loading("Confirm deposit…");
    writeContract(
      { ...SLOTS_CONFIG, functionName: "deposit", value: parseEther(amount) },
      {
        onSuccess: hash => { toast.dismiss(id); toast.loading("Depositing…", { id: hash }); },
        onError: err => { toast.dismiss(id); toast.error(err.message.includes("User rejected") ? "Cancelled" : "Failed"); },
      }
    );
  };

  const pending = isPending || isConfirming;
  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(0,199,77,0.06)", border: "1px solid rgba(0,199,77,0.2)" }}>
      <p className="text-xs font-semibold text-center" style={{ color: "#00c74d" }}>Deposit ETH to play</p>
      <div className="flex gap-2">
        {["0.005","0.01","0.02","0.05"].map(v => (
          <button key={v} onClick={() => setAmount(v)} disabled={pending}
            className="flex-1 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40"
            style={{ background: amount===v?"rgba(0,199,77,0.15)":"rgba(255,255,255,0.04)", border: amount===v?"1px solid rgba(0,199,77,0.4)":"1px solid rgba(255,255,255,0.08)", color: amount===v?"#00c74d":"rgba(255,255,255,0.4)" }}>
            {v}
          </button>
        ))}
      </div>
      <button onClick={handleDeposit} disabled={pending}
        className="w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
        style={{ background: pending ? "rgba(0,199,77,0.15)" : "linear-gradient(135deg,#00c74d,#009e3d)", color: pending ? "rgba(0,199,77,0.5)" : "#fff", boxShadow: pending ? "none" : "0 0 16px rgba(0,199,77,0.3)" }}>
        {pending ? <span className="flex items-center justify-center gap-2"><Spinner /> {isConfirming ? "Confirming…" : "Confirm…"}</span> : `Deposit ${amount} ETH →`}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export function SlotsGame() {
  const { address } = useAccount();

  const [betEth, setBetEth] = useState(0.01);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<[number, number, number] | null>(null);
  const [stoppedCount, setStoppedCount] = useState(0);
  const [won, setWon] = useState(false);
  const [lastPayout, setLastPayout] = useState<string | null>(null);
  const [showPayTable, setShowPayTable] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const betWei = parseEther(betEth.toFixed(6));
  const stoppedCountRef = useRef(0);
  const spinToastRef = useRef<string | undefined>(); // holds hash of "Spinning…" toast

  // Contract reads
  const { data: casinoBalance = 0n, refetch: refetchBalance } = useReadContract({
    ...SLOTS_CONFIG, functionName: "balanceOf", args: [address!],
    query: { enabled: !!address && SLOTS_DEPLOYED, refetchInterval: 60_000 },
  });
  const { data: poolBalance = 0n } = useReadContract({
    ...SLOTS_CONFIG, functionName: "contractBalance",
    query: { enabled: SLOTS_DEPLOYED, refetchInterval: 30_000 },
  });
  const bal = casinoBalance as bigint;
  const hasEnough = bal >= betWei;
  const balEth = parseFloat(formatEther(bal));
  const maxPayoutWei = betWei * 50n; // max 50x (diamonds)
  const poolTooLow = (poolBalance as bigint) > 0n && (poolBalance as bigint) < maxPayoutWei;

  // Refetch balance when window gets focus (e.g. after MetaMask closes)
  useEffect(() => {
    const onFocus = () => refetchBalance();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchBalance]);

  const { writeContract, data: writeTxHash, isPending: isSigning } = useWriteContract();
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess: txDone, isError: txFailed, data: txReceipt } =
    useWaitForTransactionReceipt({ hash: pendingTxHash });

  useEffect(() => { if (writeTxHash) setPendingTxHash(writeTxHash); }, [writeTxHash]);

  // Safety timeout — reset if TX hangs for 90s
  useEffect(() => {
    if (!isConfirming) return;
    const t = setTimeout(() => {
      toast.dismiss();
      toast.error("Blockchain confirmation timed out — check MetaMask and try again");
      setSpinning(false);
      setPendingTxHash(undefined);
    }, 90_000);
    return () => clearTimeout(t);
  }, [isConfirming]);

  useEffect(() => {
    if (!txFailed || !pendingTxHash) return;
    toast.dismiss(pendingTxHash);
    toast.error("Transaction failed — try again");
    setSpinning(false);
    setPendingTxHash(undefined);
  }, [txFailed, pendingTxHash]);

  // Handle reel stop
  const handleReelStop = useCallback(() => {
    stoppedCountRef.current += 1;
    setStoppedCount(stoppedCountRef.current);
  }, []);

  // Process result
  useEffect(() => {
    if (!txDone || !txReceipt) return;

    let r1 = 0, r2 = 0, r3 = 0, didWin = false, payout = 0n;
    for (const log of txReceipt.logs) {
      try {
        const dec = decodeEventLog({ abi: SLOTS_ABI, data: log.data, topics: log.topics, eventName: "SlotsPlayed" });
        if (dec) {
          const a = dec.args as { reel1: number; reel2: number; reel3: number; won: boolean; payout: bigint };
          r1 = a.reel1; r2 = a.reel2; r3 = a.reel3; didWin = a.won; payout = a.payout;
        }
      } catch {}
    }

    // Save toast hash so we can dismiss it after reels stop
    spinToastRef.current = pendingTxHash;
    setResults([r1, r2, r3]);
    setWon(didWin);
    if (didWin) setLastPayout(formatEther(payout).slice(0, 8));
    setPendingTxHash(undefined);
  }, [txDone, txReceipt]);

  // After all reels stop
  useEffect(() => {
    if (stoppedCount < 3 || !spinning) return;
    setSpinning(false);
    stoppedCountRef.current = 0;
    setStoppedCount(0);

    // Reels stopped — dismiss loading toast, then show result
    const w = won, p = lastPayout, h = spinToastRef.current;
    setTimeout(() => {
      toast.dismiss(h); // dismiss "Spinning…" only after animation done
      refetchBalance();
      if (w) {
        try { confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 }, colors: ["#f0b90b","#00c74d","#ff6b6b","#fff"] }); } catch {}
        try { playWin(); } catch {}
        toast.success(`🎰 Winner! +${p} ETH`, { duration: 6000 });
      } else {
        try { playLose(); } catch {}
        toast.error("Bad luck — spin again! 🎰");
      }
    }, 250);
  }, [stoppedCount, spinning, won, lastPayout, refetchBalance]);

  const handleSpin = useCallback(() => {
    if (!address || !hasEnough || spinning || isSigning || isConfirming) return;
    try { playClick(); } catch {}
    setResults(null);
    setWon(false);
    setLastPayout(null);
    setSpinning(true);
    stoppedCountRef.current = 0;
    setStoppedCount(0);

    const toastId = toast.loading("Confirm in wallet…");
    writeContract(
      { ...SLOTS_CONFIG, functionName: "spin", args: [betWei] },
      {
        onSuccess: hash => { toast.dismiss(toastId); toast.loading("Spinning…", { id: hash }); setPendingTxHash(hash); },
        onError: err => {
          toast.dismiss(toastId);
          toast.error(txErrMsg(err, "Spin failed"));
          setSpinning(false);
        },
      }
    );
  }, [address, hasEnough, spinning, isSigning, isConfirming, betWei, writeContract]);

  const isPending = isSigning || isConfirming;

  if (!SLOTS_DEPLOYED) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)" }}>
            <span>🎰</span>
          </div>
          <h2 className="font-semibold text-white text-base">Slots</h2>
        </div>
        <div className="text-center py-12">
          <p className="text-5xl mb-4">🍒🍋🍊</p>
          <p className="text-white/50 font-semibold mb-2">Deploy SlotsGame contract</p>
          <p className="text-white/25 text-xs">Set <span className="font-mono text-white/40">NEXT_PUBLIC_SLOTS_ADDRESS</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.2)" }}>
            <span>🎰</span>
          </div>
          <h2 className="font-semibold text-white text-base">Slots</h2>
        </div>
        <button onClick={() => setShowPayTable(v => !v)}
          className="text-xs px-2.5 py-1 rounded-full transition-all"
          style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#ff8888" }}>
          {showPayTable ? "Hide" : "Pay Table"}
        </button>
        <InfoButton onClick={() => setShowInfo(true)} />
      </div>

      {showPayTable && <PayTable />}
      {showInfo && <SlotsInfo onClose={() => setShowInfo(false)} />}

      {/* Slot machine */}
      <div className="relative">
        {/* Machine frame */}
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg,#1a0a2e,#0f0818)", border: "2px solid rgba(255,107,107,0.25)", boxShadow: "0 0 30px rgba(255,107,107,0.08)" }}>
          {/* Win line indicator */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-white/25 uppercase tracking-widest">Spin</span>
            <div className="flex items-center gap-1.5">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#ff8888]/40" />
              <span className="text-[#ff8888]/60 text-[10px]">WIN LINE</span>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#ff8888]/40" />
            </div>
            <span className="text-[10px] text-white/25 uppercase tracking-widest">Game</span>
          </div>

          {/* Reels */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                spinning={spinning}
                result={results ? results[i] : null}
                stopDelay={100 + i * 180}
                onStopped={handleReelStop}
                won={won && stoppedCount >= 3}
              />
            ))}
          </div>

          {/* Result message */}
          <div className="h-10 flex items-center justify-center mt-3">
            {!spinning && results && (
              <div style={{ animation: "fadeIn 0.3s ease-out" }}>
                {won ? (
                  <p className="font-display font-black text-lg" style={{ color: "#00c74d", textShadow: "0 0 20px rgba(0,199,77,0.5)" }}>
                    🎉 +{lastPayout} ETH!
                  </p>
                ) : (
                  <p className="text-white/30 text-sm">
                    {SYMS[results[0]]} {SYMS[results[1]]} {SYMS[results[2]]} — Try again!
                  </p>
                )}
              </div>
            )}
            {spinning && results === null && (
              <p className="text-white/25 text-xs animate-pulse">Waiting for blockchain…</p>
            )}
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between px-1 py-1 rounded-lg" style={{
        background: bal === 0n ? "rgba(246,70,93,0.08)" : "rgba(0,199,77,0.06)",
        border: bal === 0n ? "1px solid rgba(246,70,93,0.2)" : "1px solid rgba(0,199,77,0.1)",
      }}>
        <span className="text-white/35 text-xs">Slots Balance</span>
        <div className="flex items-center gap-2">
          {bal === 0n && <span className="text-[10px] text-red-400">← Deposit first</span>}
          <span className="font-mono font-bold text-sm" style={{ color: bal === 0n ? "#f6465d" : "#00c74d" }}>
            {balEth.toFixed(4)} ETH
          </span>
        </div>
      </div>

      {/* Bet — only shown when player has balance */}
      {hasEnough && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/35 text-[10px] uppercase tracking-widest">Bet</p>
            <span className="text-xs text-white/25">{betEth.toFixed(3)} ETH</span>
          </div>
          <input type="range" min={MIN_BET_ETH} max={MAX_BET_SLOTS} step={BET_STEP}
            value={betEth} onChange={e => setBetEth(parseFloat(e.target.value))}
            disabled={spinning || isPending}
            className="w-full disabled:opacity-50"
            style={{ background: `linear-gradient(to right,#ff6b6b 0%,#ff6b6b ${((betEth-MIN_BET_ETH)/(MAX_BET_SLOTS-MIN_BET_ETH))*100}%,rgba(255,255,255,0.1) ${((betEth-MIN_BET_ETH)/(MAX_BET_SLOTS-MIN_BET_ETH))*100}%,rgba(255,255,255,0.1) 100%)` }} />
          <div className="flex gap-2 mt-2">
            {[0.001, 0.005, 0.01, 0.05].map(v => (
              <button key={v} onClick={() => setBetEth(v)} disabled={spinning || isPending}
                className="flex-1 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40"
                style={{ background: Math.abs(betEth-v)<0.0001?"rgba(255,107,107,0.15)":"rgba(255,255,255,0.04)", border: Math.abs(betEth-v)<0.0001?"1px solid rgba(255,107,107,0.4)":"1px solid rgba(255,255,255,0.08)", color: Math.abs(betEth-v)<0.0001?"#ff8888":"rgba(255,255,255,0.4)" }}>
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick deposit when no balance */}
      {!hasEnough && !spinning && !isPending && (
        <QuickDeposit onSuccess={refetchBalance} />
      )}

      {/* Spin button */}
      {hasEnough && (
        <>
        {poolTooLow && !spinning && !isPending && (
          <p className="text-center text-xs" style={{ color: "#f6465d" }}>
            House pool insufficient for max payout — lower your bet
          </p>
        )}
        <button onClick={handleSpin}
          disabled={spinning || isPending || poolTooLow}
          className="w-full py-5 rounded-2xl text-xl uppercase tracking-widest font-display font-black transition-all"
          style={{
            background: spinning || isPending || poolTooLow ? "rgba(255,107,107,0.08)" : "linear-gradient(135deg,#ff6b6b,#c0392b)",
            color: spinning || isPending || poolTooLow ? "rgba(255,107,107,0.25)" : "#fff",
            boxShadow: !spinning && !isPending && !poolTooLow ? "0 0 30px rgba(255,107,107,0.4)" : "none",
          }}>
          {isSigning ? <span className="flex items-center justify-center gap-3"><Spinner /> Confirm…</span>
            : isConfirming || spinning ? <span className="flex items-center justify-center gap-3"><Spinner /> 🎰 Spinning…</span>
            : poolTooLow ? "Pool too low"
            : "🎰 Spin!"}
        </button>
        </>
      )}

      <TxProgress active={isConfirming} />

      {pendingTxHash && !spinning && (
        <a href={txUrl(pendingTxHash)} target="_blank" rel="noopener noreferrer"
          className="block text-center text-[#ff8888]/35 hover:text-[#ff8888] text-xs transition-colors">
          View on Etherscan ↗
        </a>
      )}
    </div>
  );
}
