"use client";

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import {
  useAccount, useReadContract, useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, decodeEventLog } from "viem";
import { CASINO_V2_ABI } from "@/lib/abi_v2";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import {
  CONTRACT_V2_ADDRESS, CONTRACT_V2_CONFIG,
  MIN_BET_ETH, MAX_BET_ETH, BET_STEP, txUrl, txErrMsg,
} from "@/lib/config";
import { startRocketEngine, stopRocketEngine, playExplosion, playWin } from "@/lib/sounds";
import { InfoButton, CrashInfo } from "@/components/InfoModal";

// ── Helpers ───────────────────────────────────────────────────────
const RATE = 0.0028;
function multAtFrame(f: number): number { return Math.exp(RATE * f); }
function frameAtMult(m: number): number { return Math.log(Math.max(1.001, m)) / RATE; }
function fmtM(m: number): string {
  if (!m || isNaN(m)) return "1.00×";
  if (m >= 100) return m.toFixed(0) + "×";
  if (m >= 10)  return m.toFixed(1) + "×";
  return m.toFixed(2) + "×";
}

// ── Canvas draw ───────────────────────────────────────────────────
function drawChart(
  canvas: HTMLCanvasElement,
  curFrame: number,
  cashoutMult: number,
  crashMult: number | null,
  crashed: boolean,
) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const P = { l: 48, r: 16, t: 16, b: 30 };
    const CW = W - P.l - P.r, CH = H - P.t - P.b;
    const VIEWPORT = 320;
    const drawF = Math.max(1, curFrame);
    const scrollStart = drawF > VIEWPORT * 0.68 ? drawF - VIEWPORT * 0.68 : 0;
    const maxMult = Math.max(multAtFrame(scrollStart + VIEWPORT), crashMult ? crashMult * 1.2 : 3, cashoutMult * 1.3, 3);

    function mY(m: number) { return P.t + CH - (Math.log(Math.max(1, m)) / Math.log(maxMult)) * CH; }
    function fX(f: number) { return P.l + ((f - scrollStart) / VIEWPORT) * CW; }

    ctx.fillStyle = "#060810"; ctx.fillRect(0, 0, W, H);
    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    [[40,18],[90,52],[160,16],[240,40],[310,14],[390,36],[460,22],[80,82],[200,68],[350,78]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.arc(x*W/520, y*H/210, 1, 0, Math.PI*2); ctx.fill();
    });
    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    [1.5,2,3,5,10,25].forEach(m => {
      if (m > maxMult * 0.95) return;
      const y = mY(m); if (y < P.t || y > P.t+CH) return;
      ctx.beginPath(); ctx.moveTo(P.l,y); ctx.lineTo(W-P.r,y); ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,0.18)"; ctx.font="9px monospace"; ctx.textAlign="right";
      ctx.fillText(fmtM(m), P.l-3, y+3);
    });
    if (drawF <= 0) return;
    // Curve
    const color = crashed ? "#f6465d" : "#00c74d";
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    const g = ctx.createLinearGradient(fX(scrollStart),0,fX(drawF),0);
    g.addColorStop(0, crashed ? "rgba(246,70,93,0.12)" : "rgba(0,199,77,0.1)");
    g.addColorStop(1, color);
    ctx.strokeStyle = g;
    ctx.beginPath();
    let started = false;
    const STEPS = Math.min(drawF, 400);
    for (let i=0;i<=STEPS;i++) {
      const f = scrollStart + (drawF-scrollStart)*(i/STEPS);
      const x = fX(f), y = mY(multAtFrame(f));
      if (x < P.l-2) continue;
      if (!started) { ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    // Cashout line
    if (cashoutMult > 1 && cashoutMult <= maxMult) {
      const ty = mY(cashoutMult);
      ctx.strokeStyle = "rgba(240,185,11,0.5)"; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
      ctx.beginPath(); ctx.moveTo(P.l,ty); ctx.lineTo(W-P.r,ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle="rgba(240,185,11,0.65)"; ctx.font="bold 9px monospace";
      ctx.textAlign="left"; ctx.textBaseline="top";
      ctx.fillText("exit "+fmtM(cashoutMult), P.l+3, ty+2);
      if (multAtFrame(drawF) >= cashoutMult) {
        const cf=frameAtMult(cashoutMult), cx=fX(cf), cy=mY(cashoutMult);
        if (cx>=P.l && cx<=W-P.r) {
          ctx.fillStyle="#00c74d"; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle="#060810"; ctx.font="bold 7px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("✓",cx,cy);
        }
      }
    }
    // Glow + rocket
    const rx=fX(drawF), ry=mY(multAtFrame(drawF));
    if (!crashed) {
      const gr=ctx.createRadialGradient(rx,ry,0,rx,ry,16);
      gr.addColorStop(0,"rgba(255,150,30,0.5)"); gr.addColorStop(1,"transparent");
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(rx,ry,16,0,Math.PI*2); ctx.fill();
    }
    // Rocket angle: travel direction
    const pF=Math.max(0,drawF-10);
    const dx=fX(drawF)-fX(pF), dy=ry-mY(multAtFrame(pF));
    // Travel angle; rocket nose points UP by default (-π/2), so rotate by angle+π/2
    const travelAngle = Math.atan2(dy, dx);
    const rocketAngle = travelAngle + Math.PI / 2;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(rocketAngle);

    if (crashed) {
      ctx.font = "22px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("💥", 0, 0);
    } else {
      // Draw custom rocket pointing UP (nose at top = -Y direction)
      const s = 1.1; // scale
      // Flame (at bottom = +Y)
      const flameH = 7 + Math.random() * 4;
      ctx.fillStyle = "rgba(255,120,0,0.9)";
      ctx.beginPath(); ctx.moveTo(0,10*s); ctx.lineTo(-4*s,10*s+flameH); ctx.lineTo(0,8*s); ctx.lineTo(4*s,10*s+flameH); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,220,0,0.85)";
      ctx.beginPath(); ctx.moveTo(0,10*s); ctx.lineTo(-2*s,10*s+flameH*0.6); ctx.lineTo(0,7*s); ctx.lineTo(2*s,10*s+flameH*0.6); ctx.closePath(); ctx.fill();
      // Body
      ctx.fillStyle = "#dce8f0";
      ctx.beginPath(); ctx.roundRect(-4*s, -4*s, 8*s, 14*s, 2*s); ctx.fill();
      // Nose cone (nose UP = toward -Y)
      ctx.fillStyle = "#b8cdd8";
      ctx.beginPath(); ctx.moveTo(0,-12*s); ctx.lineTo(-4*s,-4*s); ctx.lineTo(4*s,-4*s); ctx.closePath(); ctx.fill();
      // Window
      ctx.fillStyle = "#48cae4";
      ctx.beginPath(); ctx.arc(0, 2*s, 2.5*s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath(); ctx.arc(-0.8*s, 1.2*s, 0.9*s, 0, Math.PI*2); ctx.fill();
      // Left fin
      ctx.fillStyle = "#f0b90b";
      ctx.beginPath(); ctx.moveTo(-4*s,6*s); ctx.lineTo(-9*s,12*s); ctx.lineTo(-4*s,10*s); ctx.closePath(); ctx.fill();
      // Right fin
      ctx.beginPath(); ctx.moveTo(4*s,6*s); ctx.lineTo(9*s,12*s); ctx.lineTo(4*s,10*s); ctx.closePath(); ctx.fill();
    }

    ctx.restore();

    // Multiplier label near rocket
    if (!crashed) {
      const cur = multAtFrame(drawF);
      const reached = cashoutMult > 1 && cur >= cashoutMult;
      const label = cur >= 100 ? cur.toFixed(0) + "×" : cur.toFixed(2) + "×";
      const color = reached ? "#00c74d" : "#f0b90b";

      ctx.font = "bold 11px monospace";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      // Glow
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.fillStyle = color;

      // Position right of rocket, clamp inside canvas
      const lx = Math.min(rx + 20, W - P.r - 44);
      const ly = ry;
      ctx.fillText(label, lx, ly);
      ctx.shadowBlur = 0;
    }

    // Baseline
    ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(P.l,P.t+CH); ctx.lineTo(W-P.r,P.t+CH); ctx.stroke();
  } catch {}
}

// ── Types ─────────────────────────────────────────────────────────
type Phase = "idle" | "pending" | "flying" | "won" | "lost";

// ── Spinner / guards ──────────────────────────────────────────────
function Spinner() { return <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />; }
function NotDeployed() {
  return <div className="flex flex-col items-center justify-center py-16 gap-3"><span className="text-4xl">🚀</span><p className="text-white/50 font-semibold">Deploy contract first</p></div>;
}

// ── Main component ────────────────────────────────────────────────
export function CrashGame() {
  const { address } = useAccount();
  const isDeployed = CONTRACT_V2_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [phase, setPhase] = useState<Phase>("idle");
  const [betEth, setBetEth] = useState(0.01);
  const [showInfo, setShowInfo] = useState(false);
  const [targetMult, setTargetMult] = useState(2.0);
  const [targetInput, setTargetInput] = useState("2.00");
  // Live multiplier shown during animation — React state, no DOM hacks
  const [animMult, setAnimMult] = useState(1.0);
  const [finalCrash, setFinalCrash] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const targetMultRef = useRef(targetMult);
  // Set by blockchain result — animation reads this to know when to crash
  const pendingCrashRef = useRef<{ crash: number; cashout: number; won: boolean; payout: bigint } | null>(null);
  const onCompleteRef = useRef<((didWin: boolean) => void) | null>(null);
  useEffect(() => { targetMultRef.current = targetMult; }, [targetMult]);

  // ── Animation ─────────────────────────────────────────────────
  const stopAnim = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  // Start animation immediately (infinite flight until blockchain result arrives)
  const startFlight = useCallback((cashout: number, onComplete: (didWin: boolean) => void) => {
    stopAnim();
    pendingCrashRef.current = null;
    onCompleteRef.current = onComplete;
    frameRef.current = 0;
    try { startRocketEngine(); } catch {}

    const tick = () => {
      try {
        frameRef.current += 1;
        const cur = multAtFrame(frameRef.current);
        const result = pendingCrashRef.current;

        // Check if blockchain result arrived and we've reached the crash point
        const done = result !== null && cur >= result.crash;

        if (canvasRef.current) {
          drawChart(canvasRef.current, frameRef.current, cashout, result?.crash ?? null, done);
        }
        if (frameRef.current % 4 === 0 || done) setAnimMult(done && result ? result.crash : cur);
        if (result && cur >= cashout && cur <= result.crash) { try { stopRocketEngine(); } catch {} }

        if (!done) {
          rafRef.current = requestAnimationFrame(tick);
        } else if (result) {
          try { playExplosion(); } catch {}
          const didWin = result.won;
          setFinalCrash(result.crash);
          setPhase(didWin ? "won" : "lost");
          // Small pause so explosion is visible before toast
          setTimeout(() => onCompleteRef.current?.(didWin), 400);
        }
      } catch (e) {
        console.error("Anim error:", e);
        stopAnim();
        setPhase("lost");
        onCompleteRef.current?.(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAnim]);

  // ── Contract ──────────────────────────────────────────────────
  const { data: casinoBalance = 0n, refetch: refetchBalance } = useReadContract({
    ...CONTRACT_V2_CONFIG, functionName: "balanceOf", args: [address!],
    query: { enabled: !!address && isDeployed, refetchInterval: 60_000 },
  });
  const { data: poolBalance = 0n } = useReadContract({
    ...CONTRACT_V2_CONFIG, functionName: "contractBalance",
    query: { enabled: isDeployed, refetchInterval: 30_000 },
  });
  const balance = casinoBalance as bigint;
  const betWei = parseEther(betEth.toFixed(6));
  const hasEnough = balance >= betWei;
  const balanceEth = parseFloat(formatEther(balance));

  // Max payout for current bet × target — check against casino pool
  const targetBpsForCheck = BigInt(Math.round(targetMult * 100));
  const maxPayout = betWei * targetBpsForCheck / 100n;
  const poolTooLow = (poolBalance as bigint) < maxPayout;

  const { writeContract, data: writeTxHash, isPending: isSigning } = useWriteContract();
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isConfirming, isSuccess: txDone, isError: txFailed, error: txError, data: txReceipt } =
    useWaitForTransactionReceipt({ hash: pendingTxHash });

  useEffect(() => { if (writeTxHash) setPendingTxHash(writeTxHash); }, [writeTxHash]);

  // Safety timeout — reset if TX hangs for 90s
  useEffect(() => {
    if (!isConfirming) return;
    const t = setTimeout(() => {
      toast.dismiss();
      toast.error("Blockchain confirmation timed out — check MetaMask and try again");
      try { stopRocketEngine(); } catch {}
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      setPhase("idle");
      setPendingTxHash(undefined);
    }, 90_000);
    return () => clearTimeout(t);
  }, [isConfirming]);

  useEffect(() => {
    if (!txFailed || !pendingTxHash) return;
    toast.dismiss(pendingTxHash);
    toast.error(txErrMsg(txError ?? {}, "Transaction failed — try again"));
    try { stopRocketEngine(); } catch {}
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPhase("idle");
    setPendingTxHash(undefined);
  }, [txFailed, pendingTxHash, txError]);

  // ── Process result — TX confirmed, start animation, show toast after ──
  useEffect(() => {
    if (!txDone || !txReceipt) return;
    let cancelled = false;

    const run = async () => {
      try {
        let crashBps = 0n, won = false, payout = 0n;
        for (const log of txReceipt.logs) {
          try {
            const dec = decodeEventLog({ abi: CASINO_V2_ABI, data: log.data, topics: log.topics, eventName: "LimboPlayed" });
            if (dec) {
              const a = dec.args as { crashPoint: bigint; won: boolean; betAmount: bigint; payout: bigint };
              crashBps = a.crashPoint; won = a.won; payout = a.payout;
            }
          } catch {}
        }
        if (cancelled) return;

        const crashMult = Math.max(1.01, Number(crashBps) / 100);
        const cashout = targetMultRef.current;

        // Dismiss "Launching…" toast silently before animation
        toast.dismiss(txReceipt.transactionHash as `0x${string}`);
        setAnimMult(1.0);

        // Start animation — onComplete fires only AFTER explosion animation
        startFlight(cashout, (didWin) => {
          if (cancelled) return;
          refetchBalance();
          setPendingTxHash(undefined);
          if (didWin) {
            try { confetti({ particleCount: 140, spread: 75, origin: { y: 0.5 }, colors: ["#00c74d","#f0b90b","#fff"] }); } catch {}
            try { playWin(); } catch {}
            toast.success(`Exit ${fmtM(cashout)} ✅ Crash ${fmtM(crashMult)} — Won ${formatEther(payout).slice(0,7)} ETH 🚀`, { duration: 7000 });
          } else {
            toast.error(`Crashed at ${fmtM(crashMult)} before ${fmtM(cashout)} 💥`);
          }
        });

        // Set crash result so animation knows when to stop
        pendingCrashRef.current = { crash: crashMult, cashout, won, payout };

      } catch (e) {
        console.error("Result error:", e);
        if (!cancelled) { setPhase("lost"); setPendingTxHash(undefined); }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txDone, txReceipt]);

  useEffect(() => () => { stopAnim(); try { stopRocketEngine(); } catch {} }, [stopAnim]);

  useLayoutEffect(() => {
    if (canvasRef.current && (phase === "idle" || phase === "won" || phase === "lost")) {
      drawChart(canvasRef.current, 0, targetMult, finalCrash, phase === "lost");
    }
  }, [phase, targetMult, finalCrash]);

  // ── Launch ────────────────────────────────────────────────────
  const handleLaunch = useCallback(() => {
    if (!address || !hasEnough || phase !== "idle") return;
    stopAnim();
    pendingCrashRef.current = null;
    setAnimMult(1.0);
    setFinalCrash(null);
    setPhase("pending"); // wait for blockchain first

    const targetBps = BigInt(Math.round(targetMultRef.current * 100));
    const toastId = toast.loading("Placing bet…");
    writeContract(
      { ...CONTRACT_V2_CONFIG, functionName: "limbo", args: [targetBps, betWei] },
      {
        onSuccess: hash => { toast.dismiss(toastId); toast.loading("Launching…", { id: hash }); setPendingTxHash(hash); },
        onError: err => {
          toast.dismiss(toastId);
          toast.error(txErrMsg(err));
          setPhase("idle");
        },
      }
    );
  }, [address, hasEnough, phase, betWei, writeContract, stopAnim]);

  const handleReset = useCallback(() => {
    stopAnim(); try { stopRocketEngine(); } catch {}
    frameRef.current = 0;
    setAnimMult(1.0);
    setFinalCrash(null);
    setPhase("idle");
  }, [stopAnim]);

  const isPending = isSigning || isConfirming;
  const winChance = targetMult > 0 ? (99 / targetMult).toFixed(1) : "0";
  const isFlying = phase === "flying";
  const showControls = phase === "idle" || phase === "won" || phase === "lost";

  // Display multiplier
  const displayMult = phase === "idle" ? null
    : phase === "pending" ? null
    : phase === "won" ? targetMult
    : phase === "lost" && finalCrash ? finalCrash
    : animMult;

  const multColor = phase === "lost" ? "#f6465d" : phase === "won" ? "#00c74d" : "#f0b90b";

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(240,185,11,0.1)",border:"1px solid rgba(240,185,11,0.2)"}}>
            <span className="text-base">🚀</span>
          </div>
          <h2 className="font-semibold text-white text-base">Crash</h2>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded-full" style={{background:"rgba(240,185,11,0.08)",border:"1px solid rgba(240,185,11,0.2)",color:"#f0b90b"}}>
          Up to 9900×
        </span>
        <InfoButton onClick={() => setShowInfo(true)} />
      </div>

      {!isDeployed ? <NotDeployed /> : (<>

        {/* Canvas + overlay */}
        <div className="relative rounded-xl overflow-hidden" style={{background:"#060810",border:"1px solid rgba(255,255,255,0.06)"}}>
          <canvas ref={canvasRef} width={520} height={210} className="w-full" style={{display:"block"}} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              {phase === "idle" && (
                <div style={{fontSize:"clamp(28px,6vw,46px)",color:"rgba(255,255,255,0.08)"}} className="font-display font-black">1.00×</div>
              )}
              {phase === "pending" && (
                <div style={{fontSize:"18px",color:"rgba(255,255,255,0.25)"}} className="font-semibold">Placing bet…</div>
              )}
              {(phase === "flying" || phase === "won" || phase === "lost") && displayMult !== null && (
                <div style={{fontSize:"clamp(30px,7vw,50px)",color:multColor,textShadow:`0 0 24px ${multColor}55`}} className="font-display font-black leading-none">
                  {phase === "won" ? fmtM(displayMult) + " ✅"
                    : phase === "lost" ? fmtM(displayMult) + " 💥"
                    : fmtM(displayMult)}
                </div>
              )}
              {phase === "won" && <p className="text-[#00c74d] text-xs mt-1 font-bold">Cashed out!</p>}
              {phase === "lost" && finalCrash && (
                <p style={{color:"#f6465d"}} className="text-xs mt-1">
                  Your exit: {fmtM(targetMult)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live stats during flight */}
        {(phase === "flying" || phase === "pending") && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl px-3 py-2.5 text-center" style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Now</p>
              <p className="font-mono font-bold text-sm" style={{color:"#f0b90b"}}>{fmtM(animMult)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5 text-center" style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">If exit now</p>
              <p className="font-mono font-bold text-sm" style={{color:"#00c74d"}}>+{(betEth * animMult).toFixed(4)}</p>
            </div>
            <div className="rounded-xl px-3 py-2.5 text-center" style={{background:"rgba(0,0,0,0.25)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mb-0.5">Target</p>
              <p className="font-mono font-bold text-sm" style={{color:animMult>=targetMult?"#00c74d":"rgba(255,255,255,0.5)"}}>{fmtM(targetMult)}</p>
            </div>
          </div>
        )}

        {/* Controls */}
        {showControls && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/35 text-[10px] uppercase tracking-widest">Exit at multiplier</p>
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">×</span>
                <input type="number" min={1.01} max={9900} step={0.1} value={targetInput}
                  onChange={e => { setTargetInput(e.target.value); const v=parseFloat(e.target.value); if(!isNaN(v)&&v>=1.01) setTargetMult(Math.min(9900,v)); }}
                  onBlur={() => { const c=Math.min(9900,Math.max(1.01,targetMult)); setTargetMult(c); setTargetInput(c.toFixed(2)); }}
                  className="w-20 text-center font-mono font-bold text-sm rounded-lg px-2 py-1 focus:outline-none"
                  style={{background:"#0f1218",border:"1px solid rgba(255,255,255,0.12)",color:"#f0b90b"}} />
              </div>
            </div>
            <input type="range" min={1.01} max={20} step={0.01} value={Math.min(targetMult,20)}
              onChange={e=>{const v=parseFloat(e.target.value);setTargetMult(v);setTargetInput(v.toFixed(2));}}
              className="w-full"
              style={{background:`linear-gradient(to right,#f0b90b 0%,#f0b90b ${((Math.min(targetMult,20)-1.01)/18.99)*100}%,rgba(255,255,255,0.1) ${((Math.min(targetMult,20)-1.01)/18.99)*100}%,rgba(255,255,255,0.1) 100%)`}} />
            <div className="flex gap-2 mt-2">
              {[1.5,2,5,10,50].map(v=>(
                <button key={v} onClick={()=>{setTargetMult(v);setTargetInput(v.toFixed(2));}}
                  className="flex-1 py-1.5 text-xs rounded-lg transition-all"
                  style={{background:Math.abs(targetMult-v)<0.05?"rgba(240,185,11,0.15)":"rgba(255,255,255,0.04)",border:Math.abs(targetMult-v)<0.05?"1px solid rgba(240,185,11,0.4)":"1px solid rgba(255,255,255,0.08)",color:Math.abs(targetMult-v)<0.05?"#f0b90b":"rgba(255,255,255,0.4)"}}>
                  {v}×
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-white/25">Win chance</span>
              <span style={{color:"#00c74d"}}>{winChance}%</span>
            </div>
          </div>
        )}

        {showControls && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/35 text-[10px] uppercase tracking-widest">Bet</p>
              <div className="flex gap-2">
                <span className="font-mono text-[#f0b90b] font-bold text-sm">{betEth.toFixed(3)} ETH</span>
                <span className={`text-xs ${hasEnough?"text-white/25":"text-red-400"}`}>({hasEnough?balanceEth.toFixed(3):"insufficient"})</span>
              </div>
            </div>
            <input type="range" min={MIN_BET_ETH} max={MAX_BET_ETH} step={BET_STEP} value={betEth}
              onChange={e=>setBetEth(parseFloat(e.target.value))} className="w-full"
              style={{background:`linear-gradient(to right,#f0b90b 0%,#f0b90b ${((betEth-MIN_BET_ETH)/(MAX_BET_ETH-MIN_BET_ETH))*100}%,rgba(255,255,255,0.1) ${((betEth-MIN_BET_ETH)/(MAX_BET_ETH-MIN_BET_ETH))*100}%,rgba(255,255,255,0.1) 100%)`}} />
          </div>
        )}

        {showControls && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.05)"}}>
            <span className="text-white/35 text-sm">If rocket reaches {fmtM(targetMult)}</span>
            <span className="font-mono font-bold text-sm" style={{color:"#f0b90b"}}>+{(betEth*targetMult).toFixed(4)} ETH</span>
          </div>
        )}

        {phase === "idle" && poolTooLow && hasEnough && (
          <p className="text-center text-xs" style={{color:"#f6465d"}}>
            Pool too low for {fmtM(targetMult)} payout — reduce bet or target
          </p>
        )}

        {phase === "idle" && (
          <button onClick={handleLaunch} disabled={!hasEnough || poolTooLow}
            className="w-full py-5 rounded-2xl text-xl uppercase tracking-widest font-display font-black"
            style={{
              background: !hasEnough || poolTooLow ? "rgba(240,185,11,0.15)" : "linear-gradient(135deg,#f0b90b,#d4940a)",
              color: !hasEnough || poolTooLow ? "rgba(240,185,11,0.4)" : "#0a0c14",
              boxShadow: hasEnough && !poolTooLow ? "0 0 30px rgba(240,185,11,0.4)" : "none",
            }}>
            {!hasEnough ? "Deposit to Play" : poolTooLow ? "Pool too low" : "🚀 Launch!"}
          </button>
        )}

        {isPending && (
          <div className="flex items-center justify-center gap-3 py-2 text-[#f0b90b]">
            <Spinner /><span className="text-sm font-semibold">Confirming on blockchain…</span>
          </div>
        )}

        {(phase === "won" || phase === "lost") && (
          <button onClick={handleReset}
            className="w-full py-4 rounded-2xl text-base uppercase tracking-widest font-display font-bold"
            style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)"}}>
            Play Again
          </button>
        )}

        {pendingTxHash && (
          <a href={txUrl(pendingTxHash)} target="_blank" rel="noopener noreferrer"
            className="block text-center text-[#f0b90b]/35 hover:text-[#f0b90b] text-xs transition-colors">
            View on Etherscan ↗
          </a>
        )}

        {phase === "idle" && (
          <p className="text-white/12 text-[10px] text-center">
            Set exit target → Launch → win if rocket reaches it before crash
          </p>
        )}

      </>)}
      {showInfo && <CrashInfo onClose={() => setShowInfo(false)} />}
    </div>
  );
}
