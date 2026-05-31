"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { playClick, startSpinSound, stopSpinSound, playWin, playLose } from "@/lib/sounds";
import { InfoButton, CoinFlipInfo } from "@/components/InfoModal";
import { TxProgress } from "@/components/TxProgress";
import {
  CONTRACT_V2_CONFIG,
  MIN_BET_ETH,
  MAX_BET_ETH,
  BET_STEP,
  COIN_LABELS,
  txUrl,
  txErrMsg,
  type CoinSide,
} from "@/lib/config";

// ── Crown SVG (Heads) ─────────────────────────────────────────────
function CrownIcon({ color }: { color: string }) {
  return (
    <svg width="52" height="44" viewBox="0 0 52 44" fill="none">
      {/* Crown base */}
      <rect x="6" y="30" width="40" height="8" rx="3" fill={color} opacity="0.9"/>
      {/* Crown body */}
      <path
        d="M6 30 L6 16 L14 24 L26 8 L38 24 L46 16 L46 30 Z"
        fill={color}
        opacity="0.95"
      />
      {/* Crown gems */}
      <circle cx="26" cy="10" r="3.5" fill={color} opacity="0.6"/>
      <circle cx="26" cy="10" r="2" fill="white" opacity="0.5"/>
      <circle cx="10" cy="20" r="2.5" fill={color} opacity="0.5"/>
      <circle cx="42" cy="20" r="2.5" fill={color} opacity="0.5"/>
      {/* Shine */}
      <path d="M12 22 L18 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/>
    </svg>
  );
}

// ── Lightning bolt SVG (Tails) ────────────────────────────────────
function BoltIcon({ color }: { color: string }) {
  return (
    <svg width="44" height="52" viewBox="0 0 44 52" fill="none">
      <path
        d="M26 2 L8 28 L20 28 L18 50 L36 22 L24 22 Z"
        fill={color}
        opacity="0.9"
        strokeLinejoin="round"
      />
      {/* Inner shine */}
      <path
        d="M24 6 L12 26 L20 26"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

// ── Coin face ─────────────────────────────────────────────────────
function CoinFace({ side }: { side: "H" | "T" }) {
  const isHeads = side === "H";
  const iconColor = isHeads ? "#3d2000" : "#1e3248";
  return (
    <div
      className="absolute inset-0 rounded-full flex items-center justify-center select-none"
      style={{
        background: isHeads
          ? "radial-gradient(circle at 35% 30%, #fff3b0 0%, #f0b90b 40%, #b8860b 75%, #8a6200 100%)"
          : "radial-gradient(circle at 35% 30%, #ffffff 0%, #c8d6e5 30%, #8fa3b8 65%, #4a6278 100%)",
        boxShadow: isHeads
          ? "inset -4px -4px 12px rgba(0,0,0,0.3), inset 3px 3px 8px rgba(255,255,255,0.35)"
          : "inset -4px -4px 12px rgba(0,0,0,0.35), inset 3px 3px 8px rgba(255,255,255,0.5)",
      }}
    >
      {/* Engraved ring */}
      <div
        className="absolute inset-3 rounded-full border-2 opacity-20"
        style={{ borderColor: iconColor }}
      />
      {/* Symbol */}
      <div className="relative z-10" style={{ filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.25))` }}>
        {isHeads ? <CrownIcon color={iconColor} /> : <BoltIcon color={iconColor} />}
      </div>
    </div>
  );
}

// ── Animated coin ─────────────────────────────────────────────────
function AnimatedCoin({
  isFlipping,
  result,
  choice,
  fast,
}: {
  isFlipping: boolean;
  result: CoinSide | null;
  choice: CoinSide;
  fast: boolean;
}) {
  const [displayResult, setDisplayResult] = useState<CoinSide | null>(null);
  const [visibleFace, setVisibleFace] = useState<CoinSide>(choice);
  const ivRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  // Target face tracked in a ref so idle loop reads it without restarting
  const targetRef   = useRef<CoinSide>(choice);

  // Keep targetRef in sync with choice / result — no restart of the loop
  useEffect(() => {
    if (!isFlipping) {
      targetRef.current = result !== null ? result : choice;
    }
  }, [choice, result, isFlipping]);

  // IDLE: continuous loop, never restarts on choice change
  // — reads targetRef each edge-on moment and switches toward target
  useEffect(() => {
    if (isFlipping || displayResult !== null) return;

    const idleCycle = fast ? 1200 : 4000;
    const quarter   = idleCycle * 0.25; // first edge-on
    const half      = idleCycle * 0.5;  // interval between edge-ons

    // Start face from current target
    setVisibleFace(targetRef.current);

    const t = setTimeout(() => {
      // At each edge-on: if we need to match target, switch; else alternate
      const doSwitch = () => {
        setVisibleFace(cur => {
          // If target differs → switch to it; otherwise keep alternating
          return cur !== targetRef.current ? targetRef.current : (cur === 0 ? 1 : 0);
        });
      };
      doSwitch();
      ivRef.current = setInterval(doSwitch, half);
    }, quarter);

    return () => {
      clearTimeout(t);
      if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
    };
  // Only restart on flipping/result/fast — NOT on choice
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipping, displayResult, fast]);

  // FLIP: fast alternation
  useEffect(() => {
    if (!isFlipping) {
      if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
      return;
    }
    setDisplayResult(null);
    const half = fast ? 60 : 175;
    ivRef.current = setInterval(() => setVisibleFace(f => f === 0 ? 1 : 0), half);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [isFlipping, fast]);

  // Freeze on result
  useEffect(() => {
    if (!isFlipping && result !== null) {
      setDisplayResult(result);
      setVisibleFace(result);
      if (pauseRef.current) clearTimeout(pauseRef.current);
      pauseRef.current = setTimeout(() => setDisplayResult(null), 20000);
    }
    return () => { if (pauseRef.current) clearTimeout(pauseRef.current); };
  }, [isFlipping, result]);

  const halfCycleMs = fast ? 60 : 175;
  const spinStyle: React.CSSProperties = {
    animation: `coinScaleX ${halfCycleMs * 2}ms linear infinite`,
  };
  // linear — smooth approach already baked into keyframes
  const idleStyle: React.CSSProperties = {
    animation: `coinSpinSmooth ${fast ? "1.2s" : "4s"} linear infinite`,
  };

  const glowColor =
    displayResult === choice && displayResult !== null ? "rgba(0,199,77,0.65)"
    : displayResult !== null && displayResult !== choice ? "rgba(246,70,93,0.5)"
    : visibleFace === 0 ? "rgba(240,185,11,0.35)" : "rgba(150,180,210,0.5)";

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ filter: `drop-shadow(0 0 ${isFlipping ? "28px rgba(240,185,11,0.7)" : `20px ${glowColor}`})` }}
      >
        <div
          key={`coin-${fast}-${isFlipping}`}
          className="w-40 h-40 relative"
          style={isFlipping ? spinStyle : idleStyle}
        >
          <CoinFace side={visibleFace === 0 ? "H" : "T"} />
        </div>
      </div>

      {/* Result label */}
      <div className="mt-4 h-6 flex items-center justify-center">
        {/* After game result: show result face name with win/lose color */}
        {displayResult !== null ? (
          <span
            className="text-base font-bold tracking-widest uppercase"
            style={{ color: displayResult === choice ? "#00c74d" : "#f6465d", animation: "fadeIn 0.3s ease-out" }}
          >
            {displayResult === 0 ? "HEADS" : "TAILS"}
          </span>
        ) : !isFlipping ? (
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ color: choice === 0 ? "rgba(240,185,11,0.7)" : "rgba(140,180,210,0.7)", animation: "fadeIn 0.2s ease-out" }}
          >
            {choice === 0 ? "HEADS" : "TAILS"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── HEADS / TAILS selector ────────────────────────────────────────
function ChoiceButton({
  side,
  selected,
  disabled,
  onClick,
}: {
  side: CoinSide;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-4 rounded-xl font-display font-bold text-lg uppercase tracking-wider transition-all duration-150 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={
        selected
          ? side === 0
            ? { // HEADS — gold like the coin
                background: "rgba(240,185,11,0.14)",
                border: "2px solid #f0b90b",
                color: "#f0b90b",
                boxShadow: "0 0 18px rgba(240,185,11,0.3)",
              }
            : { // TAILS — silver-blue like the coin
                background: "rgba(140,180,210,0.14)",
                border: "2px solid #8fb8d4",
                color: "#a8ccdf",
                boxShadow: "0 0 18px rgba(140,180,210,0.25)",
              }
          : {
              background: "rgba(255,255,255,0.03)",
              border: "2px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.35)",
            }
      }
    >
      <div className="flex justify-center mb-1" style={{
        transform: "scale(0.55)", transformOrigin: "center bottom", height: 28,
        filter: selected
          ? side === 0
            ? "drop-shadow(0 0 4px rgba(240,185,11,0.8))"
            : "drop-shadow(0 0 6px rgba(180,220,255,0.9))"
          : undefined,
      }}>
        {side === 0
          ? <CrownIcon color={selected ? "#3d2000" : "rgba(255,255,255,0.3)"} />
          : <BoltIcon  color={selected ? "#d0eeff" : "rgba(255,255,255,0.3)"} />
        }
      </div>
      {COIN_LABELS[side]}
    </button>
  );
}

// ── Win / Lose outcome banner ─────────────────────────────────────
function OutcomeBanner({
  won,
  betAmount,
  payout,
  onDismiss,
}: {
  won: boolean;
  betAmount: bigint;
  payout: bigint;
  onDismiss: () => void;
}) {
  const betEth = parseFloat(formatEther(betAmount)).toFixed(4);
  const payoutEth = parseFloat(formatEther(payout)).toFixed(4);

  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{
        animation: "slideUp 0.3s ease-out",
        background: won
          ? "linear-gradient(135deg, rgba(0,199,77,0.1) 0%, rgba(0,199,77,0.05) 100%)"
          : "linear-gradient(135deg, rgba(246,70,93,0.1) 0%, rgba(246,70,93,0.05) 100%)",
        border: won
          ? "1px solid rgba(0,199,77,0.25)"
          : "1px solid rgba(246,70,93,0.2)",
      }}
    >
      <div className="text-4xl mb-2">{won ? "🎉" : "💀"}</div>
      <p
        className="font-display text-2xl font-black mb-1"
        style={{ color: won ? "#00c74d" : "#f6465d" }}
      >
        {won ? "YOU WIN!" : "YOU LOSE"}
      </p>
      {won ? (
        <p className="text-white/55 text-sm">
          Bet{" "}
          <span className="text-[#f0b90b] font-mono">{betEth} ETH</span>
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

// ── Spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

// ── Main CoinFlip ─────────────────────────────────────────────────
export function CoinFlip() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [choice, setChoice] = useState<CoinSide>(0);
  const [betEth, setBetEth] = useState(0.01);
  const [isFlipping, setIsFlipping] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [flipResult, setFlipResult] = useState<CoinSide | null>(null);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    betAmount: bigint;
    payout: bigint;
    txHash: string;
  } | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<
    `0x${string}` | undefined
  >();

  // Read casino balance
  const { data: casinoBalance = 0n, refetch: refetchBalance } =
    useReadContract({
      ...CONTRACT_V2_CONFIG,
      functionName: "balanceOf",
      args: [address!],
      query: { enabled: !!address, refetchInterval: 60_000 },
    });
  const { data: poolBalance = 0n } = useReadContract({
    ...CONTRACT_V2_CONFIG, functionName: "contractBalance",
    query: { refetchInterval: 30_000 },
  });

  const balance = casinoBalance as bigint;
  const betWei = parseEther(betEth.toFixed(6));
  const hasEnoughBalance = balance >= betWei;
  const maxPayoutWei = betWei * 195n / 100n;
  const poolTooLow = (poolBalance as bigint) > 0n && (poolBalance as bigint) < maxPayoutWei;
  const flipStartRef = useRef<number>(0); // when flip animation started

  const {
    writeContract,
    data: writeTxHash,
    isPending: isSigning,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: txConfirmed,
    isError: txFailed,
    data: txReceipt,
  } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // Track writeTxHash
  useEffect(() => {
    if (writeTxHash) {
      setPendingTxHash(writeTxHash);
    }
  }, [writeTxHash]);

  // Safety timeout — reset if TX hangs for 90s
  useEffect(() => {
    if (!isConfirming) return;
    const t = setTimeout(() => {
      toast.dismiss();
      toast.error("Blockchain confirmation timed out — check MetaMask and try again");
      stopSpinSound();
      setIsFlipping(false);
      setPendingTxHash(undefined);
    }, 90_000);
    return () => clearTimeout(t);
  }, [isConfirming]);

  useEffect(() => {
    if (!txFailed || !pendingTxHash) return;
    toast.dismiss(pendingTxHash);
    toast.error("Transaction failed — try again");
    stopSpinSound();
    setIsFlipping(false);
    setPendingTxHash(undefined);
  }, [txFailed, pendingTxHash]);

  // Parse GamePlayed event from receipt
  useEffect(() => {
    if (!txConfirmed || !txReceipt || !publicClient) return;

    const txHash = pendingTxHash; // capture before async
    const processReceipt = async () => {
      try {
        // Wait until animation has played for at least 1.2s from when Flip was pressed
        const MIN_ANIM_MS = 1200;
        const elapsed = Date.now() - flipStartRef.current;
        const remaining = Math.max(0, MIN_ANIM_MS - elapsed);
        await new Promise((r) => setTimeout(r, remaining));

        let won = false;
        let betAmount = betWei;
        let payout = 0n;
        let resultSide: CoinSide = 0;

        for (const log of txReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CASINO_V2_ABI,
              data: log.data,
              topics: log.topics,
              eventName: "GamePlayed",
            });
            if (decoded) {
              const args = decoded.args as {
                choice: number;
                result: number;
                won: boolean;
                betAmount: bigint;
                payout: bigint;
              };
              resultSide = args.result as CoinSide;
              // Compute won from choice vs result directly — more reliable than bool field
              const playerChoice = Number(args.choice) as CoinSide;
              won = Number(resultSide) === Number(playerChoice);
              betAmount = args.betAmount;
              payout = args.payout;
            }
          } catch {
            // Not a GamePlayed log — skip
          }
        }

        // 1. Stop coin — "Flipping…" toast stays while coin animates
        setFlipResult(resultSide);
        setIsFlipping(false);

        // 2. Wait for coin flip-transition (0.6s CSS) to fully complete
        await new Promise((r) => setTimeout(r, 750));

        // 3. Animation done — dismiss loading toast and show result
        toast.dismiss(txHash);
        setLastOutcome({
          won,
          betAmount,
          payout,
          txHash: txReceipt.transactionHash,
        });
        setShowOutcome(true);
        refetchBalance();

        if (won) {
          confetti({
            particleCount: 180,
            spread: 80,
            origin: { y: 0.55 },
            colors: ["#f0b90b", "#ffe066", "#00c74d", "#ffffff"],
            gravity: 0.9,
          });
          playWin();
          toast.success(`You won ${formatEther(payout).slice(0, 7)} ETH!`, {
            duration: 6000,
          });
        } else {
          playLose();
          toast.error("Bad luck — try again 🎲");
        }
      } catch (err) {
        setIsFlipping(false);
        console.error("Error parsing receipt:", err);
      }
    };

    processReceipt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, txReceipt]);

  const handleFlip = useCallback(() => {
    if (!address || isFlipping || isSigning || isConfirming) return;
    if (!hasEnoughBalance) {
      toast.error("Deposit ETH to your balance first to play");
      return;
    }

    setShowOutcome(false);
    setFlipResult(null);
    setIsFlipping(true);
    flipStartRef.current = Date.now();
    playClick();
    setPendingTxHash(undefined);

    const toastId = toast.loading("Confirm in wallet…");

    writeContract(
      {
        ...CONTRACT_V2_CONFIG,
        functionName: "flip",
        args: [choice, betWei],
      },
      {
        onSuccess: (hash) => {
          toast.dismiss(toastId);
          toast.loading("Flipping…", { id: hash });
          startSpinSound();
          setPendingTxHash(hash);
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(txErrMsg(err, "Flip failed"));
          stopSpinSound();
          setIsFlipping(false);
        },
      }
    );
  }, [
    address,
    isFlipping,
    isSigning,
    isConfirming,
    hasEnoughBalance,
    choice,
    betWei,
    writeContract,
  ]);

  const isPending = isSigning || isConfirming || isFlipping;
  const balanceEth = parseFloat(formatEther(balance));

  // Slider fill % for green fill
  const sliderPct =
    ((betEth - MIN_BET_ETH) / (MAX_BET_ETH - MIN_BET_ETH)) * 100;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#f0b90b]/10 border border-[#f0b90b]/20">
            <span className="text-sm">🪙</span>
          </div>
          <h2 className="font-semibold text-white text-base">Coin Flip</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(0,199,77,0.08)",
              border: "1px solid rgba(0,199,77,0.2)",
              color: "#00c74d",
            }}
          >
            1.95× on win
          </span>
          {/* Speed toggle button */}
          <button
            onClick={() => setFastMode((f) => !f)}
            title={fastMode ? "Fast mode ON" : "Fast mode OFF"}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200"
            style={fastMode ? {
              background: "rgba(240,185,11,0.18)",
              border: "1px solid rgba(240,185,11,0.6)",
              color: "#f0b90b",
              boxShadow: "0 0 10px rgba(240,185,11,0.35)",
            } : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <span style={{ fontSize: "13px" }}>⚡</span>
            {fastMode ? "Fast" : "Slow"}
          </button>
          <InfoButton onClick={() => setShowInfo(true)} />
        </div>
      </div>

      {/* Coin */}
      <div className="flex justify-center py-2">
        <AnimatedCoin
          isFlipping={isFlipping}
          result={flipResult}
          choice={choice}
          fast={fastMode}
        />
      </div>

      {/* HEADS / TAILS selector */}
      <div>
        <p className="text-white/35 text-[10px] uppercase tracking-widest mb-2.5">
          Choose your side
        </p>
        <div className="flex gap-3">
          <ChoiceButton
            side={0}
            selected={choice === 0}
            disabled={isPending}
            onClick={() => setChoice(0)}
          />
          <ChoiceButton
            side={1}
            selected={choice === 1}
            disabled={isPending}
            onClick={() => setChoice(1)}
          />
        </div>
      </div>

      {/* Bet slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/35 text-[10px] uppercase tracking-widest">
            Bet Amount
          </p>
          <div className="flex items-center gap-2">
            <span
              className="font-mono font-bold text-sm"
              style={{ color: "#f0b90b" }}
            >
              {betEth.toFixed(3)} ETH
            </span>
            {betWei > 0n && (
              <span
                className="text-xs"
                style={{
                  color: hasEnoughBalance
                    ? "rgba(255,255,255,0.3)"
                    : "#f6465d",
                }}
              >
                {hasEnoughBalance
                  ? `(bal: ${balanceEth.toFixed(3)})`
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
            background: `linear-gradient(to right, #00c74d 0%, #00c74d ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%, rgba(255,255,255,0.1) 100%)`,
          }}
        />

        {/* Quick bet buttons */}
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
                color: "rgba(255,255,255,0.4)",
              }}
              onMouseEnter={(e) => {
                if (!isPending) {
                  e.currentTarget.style.borderColor = "rgba(0,199,77,0.35)";
                  e.currentTarget.style.color = "#00c74d";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(255,255,255,0.4)";
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Potential win row */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span className="text-white/40 text-sm">Potential win</span>
        <span
          className="font-mono font-bold"
          style={{ color: "#00c74d" }}
        >
          {(betEth * 1.95).toFixed(4)} ETH
        </span>
      </div>

      {/* Outcome banner */}
      {showOutcome && lastOutcome && (
        <OutcomeBanner
          won={lastOutcome.won}
          betAmount={lastOutcome.betAmount}
          payout={lastOutcome.payout}
          onDismiss={() => setShowOutcome(false)}
        />
      )}

      {/* FLIP button */}
      {poolTooLow && hasEnoughBalance && !isPending && (
        <p className="text-center text-xs" style={{ color: "#f6465d" }}>
          House pool insufficient for this payout — lower your bet
        </p>
      )}
      <button
        onClick={handleFlip}
        disabled={isPending || !hasEnoughBalance || poolTooLow}
        className="w-full py-5 rounded-2xl text-xl uppercase tracking-widest font-display font-black transition-all"
        style={
          isPending
            ? { background: "rgba(0,199,77,0.3)", color: "rgba(255,255,255,0.7)", cursor: "not-allowed", border: "none" }
            : !hasEnoughBalance || poolTooLow
            ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", cursor: "not-allowed", border: "1px solid rgba(255,255,255,0.08)" }
            : { background: "linear-gradient(135deg, #00c74d 0%, #009e3d 100%)", color: "#fff", boxShadow: "0 0 32px rgba(0,199,77,0.35)", border: "none" }
        }
      >
        {isSigning ? (
          <span className="flex items-center justify-center gap-3"><Spinner /> Confirm…</span>
        ) : isConfirming || isFlipping ? (
          <span className="flex items-center justify-center gap-3"><Spinner /> Flipping…</span>
        ) : !hasEnoughBalance ? "Deposit to Play"
          : poolTooLow ? "Pool too low"
          : `Flip — ${COIN_LABELS[choice]}`}
      </button>

      <TxProgress active={isConfirming} />
      {showInfo && <CoinFlipInfo onClose={() => setShowInfo(false)} />}
      {/* Tx link — show only after result is revealed */}
      {pendingTxHash && showOutcome && (
        <a
          href={txUrl(pendingTxHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-xs transition-colors"
          style={{ color: "rgba(0,199,77,0.45)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#00c74d")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(0,199,77,0.45)")
          }
        >
          View transaction on Etherscan ↗
        </a>
      )}
    </div>
  );
}
