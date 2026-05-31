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
import confetti from "canvas-confetti";
import { playClick, startLimboTension, stopSpinSound, playWin, playLose } from "@/lib/sounds";
import {
  CONTRACT_V2_ADDRESS,
  CONTRACT_V2_CONFIG,
  MIN_BET_ETH,
  MAX_BET_ETH,
  BET_STEP,
  txUrl,
} from "@/lib/config";

// ── Helpers ────────────────────────────────────────────────────────

/** Clamp multiplier to valid range [1.01, 9900] */
function clampMultiplier(v: number): number {
  return Math.min(9900, Math.max(1.01, v));
}

/** Win chance % = 99 / targetMultiplier (1% house edge) */
function calcChance(mult: number): number {
  return Math.min(99, 99 / mult);
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
  targetMultiplier,
  crashPointBps,
  betAmount,
  payout,
  onDismiss,
}: {
  won: boolean;
  targetMultiplier: number;
  crashPointBps: bigint;
  betAmount: bigint;
  payout: bigint;
  onDismiss: () => void;
}) {
  const betEth = parseFloat(formatEther(betAmount)).toFixed(4);
  const payoutEth = parseFloat(formatEther(payout)).toFixed(4);
  const crashMult = (Number(crashPointBps) / 100).toFixed(2);

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
      <div className="text-4xl mb-2">{won ? "🎉" : "💥"}</div>
      <p
        className="font-display text-2xl font-black mb-1"
        style={{ color: won ? "#00c74d" : "#f6465d" }}
      >
        {won ? "YOU WIN!" : "CRASHED!"}
      </p>
      <p className="text-white/45 text-sm mb-1">
        Crash point:{" "}
        <span
          className="font-mono font-bold text-base"
          style={{ color: won ? "#00c74d" : "#f6465d" }}
        >
          {crashMult}x
        </span>{" "}
        — target was {targetMultiplier.toFixed(2)}x
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

// ── Main LimboGame ─────────────────────────────────────────────────
export function LimboGame() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const isDeployed =
    CONTRACT_V2_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // targetMultiplier is a float like 2.50
  const [targetMultiplier, setTargetMultiplier] = useState(2.0);
  const [inputValue, setInputValue] = useState("2.00");
  const [betEth, setBetEth] = useState(0.01);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    crashPointBps: bigint;
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
    query: { enabled: !!address && isDeployed, refetchInterval: 5000 },
  });

  const balance = casinoBalance as bigint;
  const betWei = parseEther(betEth.toFixed(6));
  const hasEnoughBalance = balance >= betWei;

  const { writeContract, data: writeTxHash, isPending: isSigning } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txConfirmed, data: txReceipt } =
    useWaitForTransactionReceipt({ hash: pendingTxHash });

  useEffect(() => {
    if (writeTxHash) setPendingTxHash(writeTxHash);
  }, [writeTxHash]);

  useEffect(() => {
    if (!txConfirmed || !txReceipt || !publicClient) return;

    const processReceipt = async () => {
      try {
        await new Promise((r) => setTimeout(r, 1500));

        let won = false;
        let crashPointBps = 0n;
        let betAmount = betWei;
        let payout = 0n;

        for (const log of txReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CASINO_V2_ABI,
              data: log.data,
              topics: log.topics,
              eventName: "LimboPlayed",
            });
            if (decoded) {
              const args = decoded.args as {
                crashPoint: bigint;
                won: boolean;
                betAmount: bigint;
                payout: bigint;
              };
              crashPointBps = args.crashPoint;
              won = args.won;
              betAmount = args.betAmount;
              payout = args.payout;
            }
          } catch {
            // Not a LimboPlayed log — skip
          }
        }

        setIsPlaying(false);
        setLastOutcome({ won, crashPointBps, betAmount, payout, txHash: txReceipt.transactionHash });
        setShowOutcome(true);
        refetchBalance();

        if (won) {
          confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.50 },
            colors: ["#f0b90b", "#ffe066", "#00c74d", "#ffffff"],
            gravity: 0.85,
          });
          playWin();
          toast.success(`You won ${formatEther(payout).slice(0, 7)} ETH!`, { duration: 6000 });
        } else {
          playLose();
          toast.error("Crashed! Better luck next time.");
        }
      } catch (err) {
        setIsPlaying(false);
        console.error("Error parsing receipt:", err);
      }
    };

    processReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, txReceipt]);

  const handlePlay = useCallback(() => {
    if (!address || isPlaying || isSigning || isConfirming) return;
    if (!hasEnoughBalance) {
      toast.error("Deposit ETH to your casino balance first");
      return;
    }

    setShowOutcome(false);
    setIsPlaying(true);
    playClick();
    setPendingTxHash(undefined);

    // Convert float multiplier to bps: 2.50x → 250
    const targetMultiplierBps = BigInt(Math.round(targetMultiplier * 100));
    const toastId = toast.loading("Confirm in wallet…");

    writeContract(
      {
        ...CONTRACT_V2_CONFIG,
        functionName: "limbo",
        args: [targetMultiplierBps, betWei],
      },
      {
        onSuccess: (hash) => {
          toast.dismiss(toastId);
          toast.loading("Limbo launching…", { id: hash });
          startLimboTension();
          setPendingTxHash(hash);
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(
            err.message.includes("User rejected")
              ? "Transaction rejected"
              : err.message.includes("Insufficient casino balance")
              ? "Insufficient casino balance — deposit first"
              : "Play failed"
          );
          stopSpinSound();
          setIsPlaying(false);
        },
      }
    );
  }, [address, isPlaying, isSigning, isConfirming, hasEnoughBalance, targetMultiplier, betWei, writeContract]);

  const isPending = isSigning || isConfirming || isPlaying;
  const winChance = calcChance(targetMultiplier);
  const sliderPct = ((betEth - MIN_BET_ETH) / (MAX_BET_ETH - MIN_BET_ETH)) * 100;
  const potentialWin = betEth * targetMultiplier;

  // Slider position for multiplier (log scale, 1.01–100 displayed, capped at 100 in UI)
  const SLIDER_MAX_MULT = 100;
  const logMin = Math.log(1.01);
  const logMax = Math.log(SLIDER_MAX_MULT);
  const multToSlider = (m: number) =>
    Math.round(
      ((Math.log(Math.min(m, SLIDER_MAX_MULT)) - logMin) / (logMax - logMin)) * 100
    );
  const sliderToMult = (s: number) =>
    parseFloat(Math.exp(logMin + (s / 100) * (logMax - logMin)).toFixed(2));

  const multSliderVal = multToSlider(targetMultiplier);

  // Determine display color for the center multiplier
  const resultMult =
    lastOutcome && showOutcome
      ? (Number(lastOutcome.crashPointBps) / 100).toFixed(2)
      : null;
  const resultWon = lastOutcome?.won ?? false;

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
            <span className="text-sm">⚡</span>
          </div>
          <h2 className="font-semibold text-white text-base">Limbo</h2>
        </div>
        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(240,185,11,0.08)",
            border: "1px solid rgba(240,185,11,0.20)",
            color: "#f0b90b",
          }}
        >
          Instant
        </span>
      </div>

      {!isDeployed ? (
        <NotDeployed />
      ) : (
        <>
          {/* Large multiplier display */}
          <div className="flex justify-center py-4">
            <div className="text-center">
              <p className="text-white/25 text-[10px] uppercase tracking-widest mb-2">
                {showOutcome && lastOutcome ? "Crash Point" : "Target Multiplier"}
              </p>
              <div
                className="font-display font-black leading-none"
                style={{
                  fontSize: "clamp(40px, 12vw, 72px)",
                  color:
                    showOutcome && lastOutcome
                      ? resultWon
                        ? "#00c74d"
                        : "#f6465d"
                      : "#f0b90b",
                  textShadow:
                    showOutcome && lastOutcome
                      ? resultWon
                        ? "0 0 40px rgba(0,199,77,0.55)"
                        : "0 0 40px rgba(246,70,93,0.45)"
                      : "0 0 40px rgba(240,185,11,0.45)",
                  animation: showOutcome ? "fadeIn 0.35s ease-out" : undefined,
                  transition: "color 0.3s ease, text-shadow 0.3s ease",
                }}
              >
                {isPlaying ? (
                  <span style={{ animation: "pulseGlow 0.6s ease-in-out infinite", color: "#f0b90b" }}>
                    …
                  </span>
                ) : showOutcome && resultMult ? (
                  `${resultMult}x`
                ) : (
                  `${targetMultiplier.toFixed(2)}x`
                )}
              </div>
              {showOutcome && lastOutcome && !resultWon && (
                <p className="text-[#f6465d]/60 text-xs mt-1">
                  Needed ≥ {targetMultiplier.toFixed(2)}x
                </p>
              )}
              {showOutcome && lastOutcome && resultWon && (
                <p className="text-[#00c74d]/60 text-xs mt-1">
                  Target {targetMultiplier.toFixed(2)}x reached!
                </p>
              )}
            </div>
          </div>

          {/* Multiplier input + slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/35 text-[10px] uppercase tracking-widest">
                Target Multiplier
              </p>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">×</span>
                <input
                  type="number"
                  min={1.01}
                  max={9900}
                  step={0.01}
                  value={inputValue}
                  disabled={isPending}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 1.01) {
                      setTargetMultiplier(clampMultiplier(v));
                    }
                  }}
                  onBlur={() => {
                    const clamped = clampMultiplier(targetMultiplier);
                    setTargetMultiplier(clamped);
                    setInputValue(clamped.toFixed(2));
                  }}
                  className="w-20 text-center font-mono font-bold text-sm rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50"
                  style={{
                    background: "#0f1218",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#f0b90b",
                  }}
                />
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={multSliderVal}
              disabled={isPending}
              onChange={(e) => {
                const mult = sliderToMult(parseInt(e.target.value, 10));
                setTargetMultiplier(mult);
                setInputValue(mult.toFixed(2));
              }}
              className="w-full"
              style={{
                background: `linear-gradient(to right, #f0b90b 0%, #f0b90b ${multSliderVal}%, rgba(255,255,255,0.10) ${multSliderVal}%, rgba(255,255,255,0.10) 100%)`,
              }}
            />

            {/* Quick multiplier presets */}
            <div className="flex gap-2 mt-3">
              {[1.5, 2, 5, 10, 50].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setTargetMultiplier(m);
                    setInputValue(m.toFixed(2));
                  }}
                  disabled={isPending}
                  className="flex-1 py-1.5 text-xs rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background:
                      targetMultiplier === m
                        ? "rgba(240,185,11,0.12)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      targetMultiplier === m
                        ? "1px solid rgba(240,185,11,0.40)"
                        : "1px solid rgba(255,255,255,0.08)",
                    color: targetMultiplier === m ? "#f0b90b" : "rgba(255,255,255,0.40)",
                  }}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>

          {/* Win chance info */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span className="text-white/40 text-sm">Win Chance</span>
            <span className="font-mono font-bold text-white">
              {winChance.toFixed(2)}%
            </span>
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
                    style={{
                      color: hasEnoughBalance ? "rgba(255,255,255,0.30)" : "#f6465d",
                    }}
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
              {potentialWin.toFixed(4)} ETH
            </span>
          </div>

          {/* Outcome banner */}
          {showOutcome && lastOutcome && (
            <OutcomeBanner
              won={lastOutcome.won}
              targetMultiplier={targetMultiplier}
              crashPointBps={lastOutcome.crashPointBps}
              betAmount={lastOutcome.betAmount}
              payout={lastOutcome.payout}
              onDismiss={() => setShowOutcome(false)}
            />
          )}

          {/* ROLL button */}
          <button
            onClick={handlePlay}
            disabled={isPending || !hasEnoughBalance}
            className="w-full py-5 rounded-2xl text-xl uppercase tracking-widest font-display font-black transition-all"
            style={
              isPending
                ? {
                    background: "rgba(0,199,77,0.30)",
                    color: "rgba(255,255,255,0.70)",
                    cursor: "not-allowed",
                    border: "none",
                  }
                : !hasEnoughBalance
                ? {
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.30)",
                    cursor: "not-allowed",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }
                : {
                    background: "linear-gradient(135deg, #00c74d 0%, #009e3d 100%)",
                    color: "#fff",
                    boxShadow: "0 0 32px rgba(0,199,77,0.35)",
                    border: "none",
                  }
            }
          >
            {isSigning ? (
              <span className="flex items-center justify-center gap-3">
                <Spinner /> Confirm…
              </span>
            ) : isConfirming || isPlaying ? (
              <span className="flex items-center justify-center gap-3">
                <Spinner /> Launching…
              </span>
            ) : !hasEnoughBalance ? (
              "Deposit to Play"
            ) : (
              `Launch at ${targetMultiplier.toFixed(2)}x`
            )}
          </button>

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
    </div>
  );
}
