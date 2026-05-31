"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { parseEther, formatEther, decodeEventLog } from "viem";
import { CASINO_V2_ABI } from "@/lib/abi_v2";
import toast from "react-hot-toast";
import { InfoButton, DiceInfo } from "@/components/InfoModal";
import { TxProgress } from "@/components/TxProgress";
import confetti from "canvas-confetti";
import { playClick, startDiceRattle, stopSpinSound, playWin, playLose } from "@/lib/sounds";
import {
  CONTRACT_V2_ADDRESS,
  CONTRACT_V2_CONFIG,
  MIN_BET_ETH,
  MAX_BET_ETH,
  BET_STEP,
  txUrl,
  txErrMsg,
} from "@/lib/config";

// ── Helpers ────────────────────────────────────────────────────────
function calcDice(target: number, isOver: boolean) {
  const chance = isOver ? 100 - target : target - 1; // %
  const multiplier = chance > 0 ? 9900 / chance / 100 : 0;
  return { chance, multiplier };
}

// ── Dice face with pips ───────────────────────────────────────────
const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

function DiceFace({ value, color, size = 140 }: { value: number | null; color: string; size?: number }) {
  const pips = value !== null && value >= 1 && value <= 6 ? PIP_POSITIONS[value] : null;
  const r = size * 0.16; // corner radius
  const pipR = size * 0.09; // pip radius

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Dice body */}
      <rect
        x="4" y="4" width="92" height="92"
        rx={r * 100 / size}
        fill="rgba(255,255,255,0.04)"
        stroke={color}
        strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
      />
      {/* Pips for 1-6 */}
      {pips && pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={pipR * 100 / size} fill={color} />
      ))}
      {/* Number for 7-100 */}
      {value !== null && (value < 1 || value > 6) && (
        <text
          x="50" y="58"
          textAnchor="middle"
          fontSize={value >= 100 ? "26" : "32"}
          fontWeight="900"
          fontFamily="monospace"
          fill={color}
        >
          {value}
        </text>
      )}
      {/* Idle state */}
      {value === null && (
        <text x="50" y="60" textAnchor="middle" fontSize="36" fontWeight="900" fontFamily="monospace" fill="rgba(255,255,255,0.12)">
          ?
        </text>
      )}
    </svg>
  );
}

// ── Rolling dice animation ────────────────────────────────────────
function RollingDice() {
  const [frame, setFrame] = React.useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setFrame(f => (f % 6) + 1), 120);
    return () => clearInterval(id);
  }, []);
  return <DiceFace value={frame} color="rgba(255,255,255,0.25)" />;
}

// ── Spinner ────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

// ── Outcome banner ─────────────────────────────────────────────────
function OutcomeBanner({
  won,
  roll,
  target,
  isOver,
  betAmount,
  payout,
  onDismiss,
}: {
  won: boolean;
  roll: number;
  target: number;
  isOver: boolean;
  betAmount: bigint;
  payout: bigint;
  onDismiss: () => void;
}) {
  const betEth = parseFloat(formatEther(betAmount)).toFixed(4);
  const payoutEth = parseFloat(formatEther(payout)).toFixed(4);
  const condition = isOver ? `> ${target}` : `< ${target}`;

  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{
        animation: "slideUp 0.3s ease-out",
        background: won
          ? "linear-gradient(135deg, rgba(0,199,77,0.10) 0%, rgba(0,199,77,0.05) 100%)"
          : "linear-gradient(135deg, rgba(246,70,93,0.10) 0%, rgba(246,70,93,0.05) 100%)",
        border: won
          ? "1px solid rgba(0,199,77,0.25)"
          : "1px solid rgba(246,70,93,0.20)",
      }}
    >
      <div className="text-4xl mb-2">{won ? "🎉" : "💀"}</div>
      <p
        className="font-display text-2xl font-black mb-1"
        style={{ color: won ? "#00c74d" : "#f6465d" }}
      >
        {won ? "YOU WIN!" : "YOU LOSE"}
      </p>
      <p className="text-white/45 text-sm mb-1">
        Rolled{" "}
        <span
          className="font-mono font-bold text-base"
          style={{ color: won ? "#00c74d" : "#f6465d" }}
        >
          {roll}
        </span>{" "}
        — needed {condition}
      </p>
      {won ? (
        <p className="text-white/55 text-sm">
          Bet <span className="text-[#f0b90b] font-mono">{betEth} ETH</span>
          {" → "}Won{" "}
          <span className="text-[#00c74d] font-mono">{payoutEth} ETH</span>
        </p>
      ) : (
        <p className="text-white/45 text-sm">
          Lost <span className="text-[#f6465d] font-mono">{betEth} ETH</span>{" "}
          — better luck next time
        </p>
      )}
      <button
        onClick={onDismiss}
        className="mt-3 text-white/25 hover:text-white/55 text-xs transition-colors"
      >
        dismiss
      </button>
    </div>
  );
}

// ── Not deployed notice ────────────────────────────────────────────
function NotDeployed() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{
          background: "rgba(246,70,93,0.10)",
          border: "1px solid rgba(246,70,93,0.25)",
        }}
      >
        <span className="text-2xl">⚙️</span>
      </div>
      <p className="text-white/50 font-semibold mb-1">Deploy contract first</p>
      <p className="text-white/25 text-xs">
        Set <span className="font-mono text-white/40">NEXT_PUBLIC_CONTRACT_V2_ADDRESS</span> in{" "}
        <span className="font-mono text-white/40">.env.local</span>
      </p>
    </div>
  );
}

// ── Main DiceGame ──────────────────────────────────────────────────
export function DiceGame() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const isDeployed =
    CONTRACT_V2_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [betEth, setBetEth] = useState(0.01);
  const [isRolling, setIsRolling] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    roll: number;
    betAmount: bigint;
    payout: bigint;
    txHash: string;
  } | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  const { data: casinoBalance = 0n, refetch: refetchBalance } = useReadContract({
    ...CONTRACT_V2_CONFIG,
    functionName: "balanceOf",
    args: [address!],
    query: { enabled: !!address && isDeployed, refetchInterval: 60_000 },
  });
  const { data: poolBalance = 0n } = useReadContract({
    ...CONTRACT_V2_CONFIG, functionName: "contractBalance",
    query: { enabled: isDeployed, refetchInterval: 30_000 },
  });

  const balance = casinoBalance as bigint;
  const betWei = parseEther(betEth.toFixed(6));
  const hasEnoughBalance = balance >= betWei;

  // Max payout for current dice settings
  const { chance: winChance } = calcDice(target, isOver);
  const winProb = Math.round(winChance);
  const maxPayoutWei = winProb > 0 ? betWei * 9900n / BigInt(winProb) : 0n;
  const poolTooLow = (poolBalance as bigint) > 0n && (poolBalance as bigint) < maxPayoutWei;

  const { writeContract, data: writeTxHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txConfirmed, isError: txFailed, data: txReceipt } =
    useWaitForTransactionReceipt({ hash: pendingTxHash });

  useEffect(() => {
    if (writeTxHash) setPendingTxHash(writeTxHash);
  }, [writeTxHash]);

  // Safety timeout — reset if TX hangs for 90s
  useEffect(() => {
    if (!isConfirming) return;
    const t = setTimeout(() => {
      toast.dismiss();
      toast.error("Blockchain confirmation timed out — check MetaMask and try again");
      stopSpinSound();
      setIsRolling(false);
      setPendingTxHash(undefined);
    }, 90_000);
    return () => clearTimeout(t);
  }, [isConfirming]);

  useEffect(() => {
    if (!txFailed || !pendingTxHash) return;
    toast.dismiss(pendingTxHash);
    toast.error("Transaction failed — try again");
    stopSpinSound();
    setIsRolling(false);
    setPendingTxHash(undefined);
  }, [txFailed, pendingTxHash]);

  useEffect(() => {
    if (!txConfirmed || !txReceipt || !publicClient) return;

    const txHash = pendingTxHash; // capture before async
    const processReceipt = async () => {
      try {
        await new Promise((r) => setTimeout(r, 400));

        let won = false;
        let roll = 0;
        let betAmount = betWei;
        let payout = 0n;

        for (const log of txReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CASINO_V2_ABI,
              data: log.data,
              topics: log.topics,
              eventName: "DicePlayed",
            });
            if (decoded) {
              const args = decoded.args as {
                roll: number;
                won: boolean;
                betAmount: bigint;
                payout: bigint;
              };
              roll = Number(args.roll);
              won = args.won;
              betAmount = args.betAmount;
              payout = args.payout;
            }
          } catch {
            // Not a DicePlayed log — skip
          }
        }

        // 1. Show dice result, stop rolling animation
        stopSpinSound();
        setRollResult(roll);
        setIsRolling(false);

        // 2. Tiny pause for bump animation
        await new Promise((r) => setTimeout(r, 150));

        // 3. Animation done — dismiss loading toast and show result
        toast.dismiss(txHash);
        setLastOutcome({ won, roll, betAmount, payout, txHash: txReceipt.transactionHash });
        setShowOutcome(true);
        refetchBalance();
        setPendingTxHash(undefined);

        if (won) {
          confetti({
            particleCount: 160,
            spread: 75,
            origin: { y: 0.55 },
            colors: ["#00c74d", "#ffe066", "#f0b90b", "#ffffff"],
            gravity: 0.9,
          });
          playWin();
          toast.success(`You won ${formatEther(payout).slice(0, 7)} ETH!`, { duration: 6000 });
        } else {
          playLose();
          toast.error("Bad luck — try again 🎲");
        }
      } catch (err) {
        setIsRolling(false);
        console.error("Error parsing receipt:", err);
      }
    };

    processReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, txReceipt]);

  const handleRoll = useCallback(() => {
    if (!address || isRolling || isSigning || isConfirming) return;
    if (!hasEnoughBalance) {
      toast.error("Deposit ETH to your balance first to play");
      return;
    }

    setShowOutcome(false);
    setRollResult(null);
    setIsRolling(true);
    playClick();
    setPendingTxHash(undefined);

    const toastId = toast.loading("Confirm in wallet…");

    writeContract(
      {
        ...CONTRACT_V2_CONFIG,
        functionName: "dice",
        args: [target, isOver, betWei],
      },
      {
        onSuccess: (hash) => {
          toast.dismiss(toastId);
          toast.loading("Rolling…", { id: hash });
          startDiceRattle();
          setPendingTxHash(hash);
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(txErrMsg(err, "Roll failed"));
          stopSpinSound();
          setIsRolling(false);
        },
      }
    );
  }, [address, isRolling, isSigning, isConfirming, hasEnoughBalance, target, isOver, betWei, writeContract]);

  const isPending = isSigning || isConfirming || isRolling;
  const { chance, multiplier } = calcDice(target, isOver);
  const sliderPct = ((betEth - MIN_BET_ETH) / (MAX_BET_ETH - MIN_BET_ETH)) * 100;

  // Dice slider fill: left side = lose (red), right side = win (green) or vice-versa
  const diceSliderGreenPct = isOver ? 100 - target : target - 1; // % of slider that's "win"

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(240,185,11,0.10)",
              border: "1px solid rgba(240,185,11,0.20)",
            }}
          >
            <span className="text-sm">🎲</span>
          </div>
          <h2 className="font-semibold text-white text-base">Dice</h2>
        </div>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(0,199,77,0.08)",
            border: "1px solid rgba(0,199,77,0.20)",
            color: "#00c74d",
          }}
        >
          Up to 99x
        </span>
        <InfoButton onClick={() => setShowInfo(true)} />
      </div>

      {!isDeployed ? (
        <NotDeployed />
      ) : (
        <>
          {/* Dice visual */}
          <div className="flex flex-col items-center py-4 gap-2">
            <div style={{ animation: rollResult !== null ? "fadeIn 0.3s ease-out" : undefined }}>
              {isRolling ? (
                <RollingDice />
              ) : rollResult !== null ? (
                <DiceFace
                  value={rollResult}
                  color={lastOutcome?.won ? "#00c74d" : "#f6465d"}
                />
              ) : (
                <DiceFace value={null} color="rgba(255,255,255,0.15)" />
              )}
            </div>
            {/* Roll number label */}
            {rollResult !== null && (
              <p className="text-xs font-mono" style={{ color: lastOutcome?.won ? "#00c74d" : "#f6465d" }}>
                Rolled: <strong>{rollResult}</strong>
              </p>
            )}
          </div>

          {/* Under / Over toggle */}
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2.5">
              Bet direction
            </p>
            <div className="flex gap-3">
              {(["under", "over"] as const).map((dir) => {
                const selected = dir === "over" ? isOver : !isOver;
                return (
                  <button
                    key={dir}
                    onClick={() => setIsOver(dir === "over")}
                    disabled={isPending}
                    className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={
                      selected
                        ? {
                            background: "rgba(0,199,77,0.12)",
                            border: "2px solid #00c74d",
                            color: "#00c74d",
                            boxShadow: "0 0 16px rgba(0,199,77,0.20)",
                          }
                        : {
                            background: "rgba(255,255,255,0.03)",
                            border: "2px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.40)",
                          }
                    }
                  >
                    {dir === "under" ? "Under" : "Over"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/35 text-[10px] uppercase tracking-widest">
                Target Number
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={98}
                  value={target}
                  disabled={isPending}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setTarget(Math.min(98, Math.max(2, v)));
                  }}
                  className="w-16 text-center font-mono font-bold text-sm rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50"
                  style={{
                    background: "#0f1218",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#f0b90b",
                  }}
                />
              </div>
            </div>

            {/* Visual dice range bar */}
            <div className="relative h-5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
              {/* Win zone */}
              <div
                className="absolute top-0 h-full transition-all duration-150"
                style={{
                  background: "rgba(0,199,77,0.35)",
                  left: isOver ? `${target}%` : "0%",
                  width: `${diceSliderGreenPct}%`,
                }}
              />
              {/* Target line */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white/60"
                style={{ left: `${target}%`, transition: "left 0.15s ease" }}
              />
              {/* Labels */}
              <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                <span className="text-[9px] text-white/40">1</span>
                <span className="text-[9px] text-white/40">100</span>
              </div>
            </div>

            <input
              type="range"
              min={2}
              max={98}
              step={1}
              value={target}
              disabled={isPending}
              onChange={(e) => setTarget(parseInt(e.target.value, 10))}
              className="w-full"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.12) ${((target - 2) / 96) * 100}%, rgba(255,255,255,0.06) ${((target - 2) / 96) * 100}%, rgba(255,255,255,0.06) 100%)`,
              }}
            />
          </div>

          {/* Win chance + multiplier info */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">
                Win Chance
              </p>
              <p className="font-mono font-bold text-white text-lg">
                {chance}%
              </p>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">
                Multiplier
              </p>
              <p className="font-mono font-bold text-lg" style={{ color: "#f0b90b" }}>
                {multiplier > 0 ? `${multiplier.toFixed(2)}x` : "—"}
              </p>
            </div>
          </div>

          {/* Bet slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/35 text-[10px] uppercase tracking-widest">
                Bet Amount
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm" style={{ color: "#f0b90b" }}>
                  {betEth.toFixed(3)} ETH
                </span>
                {betWei > 0n && (
                  <span
                    className="text-xs"
                    style={{ color: hasEnoughBalance ? "rgba(255,255,255,0.30)" : "#f6465d" }}
                  >
                    {hasEnoughBalance
                      ? `(bal: ${parseFloat(formatEther(balance)).toFixed(3)})`
                      : "insufficient"}
                  </span>
                )}
              </div>
            </div>

            <input
              type="range"
              min={MIN_BET_ETH}
              max={MAX_BET_ETH}
              step={BET_STEP}
              value={betEth}
              disabled={isPending}
              onChange={(e) => setBetEth(parseFloat(e.target.value))}
              className="w-full"
              style={{
                background: `linear-gradient(to right, #00c74d 0%, #00c74d ${sliderPct}%, rgba(255,255,255,0.10) ${sliderPct}%, rgba(255,255,255,0.10) 100%)`,
              }}
            />

            <div className="flex gap-2 mt-3">
              {[
                { label: "Min", val: MIN_BET_ETH },
                { label: "¼", val: MAX_BET_ETH / 4 },
                { label: "½", val: MAX_BET_ETH / 2 },
                { label: "Max", val: MAX_BET_ETH },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  onClick={() => setBetEth(val)}
                  disabled={isPending}
                  className="flex-1 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.40)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isPending) {
                      e.currentTarget.style.borderColor = "rgba(0,199,77,0.35)";
                      e.currentTarget.style.color = "#00c74d";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.40)";
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Potential win */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span className="text-white/40 text-sm">Potential win</span>
            <span className="font-mono font-bold" style={{ color: "#00c74d" }}>
              {multiplier > 0 ? (betEth * multiplier).toFixed(4) : "0.0000"} ETH
            </span>
          </div>

          {/* Outcome banner */}
          {showOutcome && lastOutcome && (
            <OutcomeBanner
              won={lastOutcome.won}
              roll={lastOutcome.roll}
              target={target}
              isOver={isOver}
              betAmount={lastOutcome.betAmount}
              payout={lastOutcome.payout}
              onDismiss={() => setShowOutcome(false)}
            />
          )}

          {/* ROLL button */}
          {poolTooLow && hasEnoughBalance && !isPending && (
            <p className="text-center text-xs" style={{ color: "#f6465d" }}>
              House pool insufficient — lower your bet or adjust target
            </p>
          )}
          <button
            onClick={handleRoll}
            disabled={isPending || !hasEnoughBalance || poolTooLow}
            className="w-full py-5 rounded-2xl text-xl uppercase tracking-widest font-display font-black transition-all"
            style={
              isPending
                ? { background: "rgba(0,199,77,0.30)", color: "rgba(255,255,255,0.70)", cursor: "not-allowed", border: "none" }
                : !hasEnoughBalance || poolTooLow
                ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.30)", cursor: "not-allowed", border: "1px solid rgba(255,255,255,0.08)" }
                : { background: "linear-gradient(135deg, #00c74d 0%, #009e3d 100%)", color: "#fff", boxShadow: "0 0 32px rgba(0,199,77,0.35)", border: "none" }
            }
          >
            {isSigning ? (
              <span className="flex items-center justify-center gap-3"><Spinner /> Confirm…</span>
            ) : isConfirming || isRolling ? (
              <span className="flex items-center justify-center gap-3"><Spinner /> Rolling…</span>
            ) : !hasEnoughBalance ? "Deposit to Play"
              : poolTooLow ? "Pool too low"
              : `Roll ${isOver ? "Over" : "Under"} ${target}`}
          </button>

          <TxProgress active={isConfirming} />

          {/* Tx link */}
          {pendingTxHash && (
            <a
              href={txUrl(pendingTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs transition-colors"
              style={{ color: "rgba(0,199,77,0.45)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#00c74d")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,199,77,0.45)")}
            >
              View transaction on Etherscan ↗
            </a>
          )}
        </>
      )}
      {showInfo && <DiceInfo onClose={() => setShowInfo(false)} />}
    </div>
  );
}
