"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { BalanceCard } from "@/components/BalanceCard";
import { CoinFlip } from "@/components/CoinFlip";
import { DiceGame } from "@/components/DiceGame";
import { CrashGame } from "@/components/CrashGame";
import { SlotsGame } from "@/components/SlotsGame";
import { GameHistory } from "@/components/GameHistory";
import { HowItWorks } from "@/components/HowItWorks";
import {
  CONTRACT_ADDRESS,
  addressUrl,
  ETHERSCAN_BASE,
} from "@/lib/config";

// ── Game tab type ──────────────────────────────────────────────────
type GameTab = "coinflip" | "dice" | "limbo" | "slots";

const GAME_TABS: { id: GameTab; label: string; emoji: string }[] = [
  { id: "coinflip", label: "Coin Flip", emoji: "🪙" },
  { id: "dice",     label: "Dice",      emoji: "🎲" },
  { id: "limbo", label: "Crash", emoji: "🚀" },
  { id: "slots", label: "Slots", emoji: "🎰" },
];

// ── Stats strip shown in hero ─────────────────────────────────────
const HERO_STATS = [
  { label: "On-Chain", desc: "Every result lives on Ethereum" },
  { label: "Provably Fair", desc: "Verify any outcome yourself" },
  { label: "Instant", desc: "Same-tx settlement, no oracle" },
];

// ── Mini Guitar SVG ───────────────────────────────────────────────
function MiniGuitar({ size = 32, color = "#00f5ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 2.2} viewBox="0 0 32 70" fill="none">
      {/* Neck */}
      <rect x="13" y="0" width="6" height="38" rx="3" fill={color} opacity="0.9"/>
      {/* Headstock */}
      <path d="M12,0 L20,0 L21,8 C21,11 18,13 16,13 C14,13 11,11 11,8 Z" fill={color}/>
      {/* Tuning pegs */}
      {[3,6,9].map(y => <circle key={y} cx="10" cy={y} r="2" fill={color} opacity="0.8"/>)}
      {[3,6,9].map(y => <circle key={y} cx="22" cy={y} r="2" fill={color} opacity="0.8"/>)}
      {/* Frets */}
      {[15,20,25,30].map(y => <line key={y} x1="13" y1={y} x2="19" y2={y} stroke={color} strokeWidth="1" opacity="0.6"/>)}
      {/* Strings */}
      {[14,16,18].map(x => <line key={x} x1={x} y1="2" x2={x} y2="38" stroke={color} strokeWidth="0.5" opacity="0.5"/>)}
      {/* Strat body — double cutaway */}
      <path d="M8,38 C2,38 0,44 2,50 C4,54 8,55 12,52 L13,48 L13,38 Z" fill={color} opacity="0.9"/>
      <path d="M24,38 C30,38 32,44 30,50 C28,54 24,55 20,52 L19,48 L19,38 Z" fill={color} opacity="0.9"/>
      <path d="M2,50 C0,57 2,63 8,66 C12,68 20,68 24,66 C30,63 32,57 30,50 C26,44 22,38 19,38 L13,38 C10,38 6,44 2,50 Z" fill={color} opacity="0.9"/>
      {/* Pickguard */}
      <path d="M10,44 C8,48 8,56 12,60 C14,62 18,62 20,60 C22,56 22,48 20,44 Z" fill="#000" opacity="0.4"/>
      {/* Pickup */}
      <rect x="10" y="52" width="12" height="4" rx="1" fill="#000" opacity="0.5"/>
      {/* Body glow */}
      <path d="M2,50 C0,57 2,63 8,66 C12,68 20,68 24,66 C30,63 32,57 30,50 C26,44 22,38 19,38 L13,38 C10,38 6,44 2,50 Z"
        fill="none" stroke={color} strokeWidth="0.8" opacity="0.6"/>
    </svg>
  );
}

// ── Circuit board background elements ─────────────────────────────
function CircuitBg() {
  const lines = [
    "M0,120 L80,120 L80,80 L160,80","M480,200 L380,200 L380,240 L300,240",
    "M100,300 L100,380 L200,380","M400,100 L400,180 L480,180",
    "M50,450 L150,450 L150,400 L250,400","M350,350 L350,280 L430,280",
    "M0,250 L60,250 L60,200","M480,380 L420,380 L420,320",
    "M200,500 L200,460 L280,460 L280,500","M130,150 L200,150 L200,100",
  ];
  const dots = [
    [80,120],[80,80],[160,80],[380,200],[380,240],[300,240],
    [100,380],[200,380],[400,180],[480,180],[150,450],[150,400],
    [350,280],[430,280],[60,250],[420,380],[200,460],[280,460],
  ];
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 480 560" preserveAspectRatio="xMidYMid slice">
      {lines.map((d,i) => (
        <path key={i} d={d} stroke={["#00f5ff","#00ff88","#ff8800","#aa00ff"][i%4]}
          strokeWidth="1" fill="none" opacity={0.12 + (i%3)*0.04}/>
      ))}
      {dots.map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill={["#00f5ff","#00ff88","#ff8800","#aa00ff"][i%4]}
          opacity={0.3 + (i%2)*0.15}/>
      ))}
      {/* Hex grid hint */}
      {[[120,180],[240,160],[360,180],[180,260],[300,260],[120,340],[240,320],[360,340]].map(([cx,cy],i) => (
        <polygon key={i} points={`${cx},${cy-20} ${cx+17},${cy-10} ${cx+17},${cy+10} ${cx},${cy+20} ${cx-17},${cy+10} ${cx-17},${cy-10}`}
          fill="none" stroke={["#00f5ff","#aa00ff"][i%2]} strokeWidth="0.6" opacity="0.08"/>
      ))}
    </svg>
  );
}

// ── Mini SVG icons ────────────────────────────────────────────────
function IconGasMask({ c="#00f5ff" }: { c?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Head/mask shell */}
      <path d="M14,3 C8,3 4,7 4,13 C4,18 7,22 10,24 L10,26 L18,26 L18,24 C21,22 24,18 24,13 C24,7 20,3 14,3 Z" fill={c} opacity="0.85"/>
      {/* Visor/lenses — two circular eyes */}
      <circle cx="10" cy="13" r="3.5" fill="#000d15" stroke={c} strokeWidth="1"/>
      <circle cx="18" cy="13" r="3.5" fill="#000d15" stroke={c} strokeWidth="1"/>
      <circle cx="10" cy="13" r="1.5" fill={c} opacity="0.5"/>
      <circle cx="18" cy="13" r="1.5" fill={c} opacity="0.5"/>
      {/* Bridge between lenses */}
      <line x1="13.5" y1="13" x2="14.5" y2="13" stroke={c} strokeWidth="1.5"/>
      {/* Filter canister bottom */}
      <rect x="10" y="22" width="8" height="5" rx="2" fill={c} opacity="0.7"/>
      <line x1="11" y1="24" x2="17" y2="24" stroke="#000d15" strokeWidth="0.8"/>
      <line x1="11" y1="25.5" x2="17" y2="25.5" stroke="#000d15" strokeWidth="0.8"/>
      {/* Straps */}
      <path d="M4,11 C2,11 2,15 4,15" stroke={c} strokeWidth="1.2" fill="none"/>
      <path d="M24,11 C26,11 26,15 24,15" stroke={c} strokeWidth="1.2" fill="none"/>
    </svg>
  );
}

function IconSynth({ c="#aa00ff" }: { c?: string }) {
  return (
    <svg width="36" height="22" viewBox="0 0 36 22" fill="none">
      {/* Body */}
      <rect x="1" y="4" width="34" height="15" rx="3" fill="#0d0020" stroke={c} strokeWidth="1.5"/>
      {/* Keys — black & white */}
      {[3,5.5,8,10.5,13,16,18.5,21,23.5,26,28.5].map((x,i) => (
        <rect key={i} x={x} y="9" width="2" height="8" rx="0.5"
          fill={i%3===1?"#000d15":c} opacity={i%3===1?0.9:0.5}/>
      ))}
      {/* Black keys */}
      {[4.2,6.7,11.2,13.7,17.2,19.7,22.2,24.7,29.2].map((x,i) => (
        <rect key={i} x={x} y="9" width="1.5" height="5" rx="0.3"
          fill="#000d15" stroke={c} strokeWidth="0.5" opacity="0.9"/>
      ))}
      {/* Knobs row */}
      {[4,8,12,16,20,24,28,32].map((x,i) => (
        <circle key={i} cx={x} cy="6.5" r="1.5" fill={["#00f5ff","#ff006e","#00ff88","#aa00ff"][i%4]} opacity="0.8"/>
      ))}
      {/* Pitch bend */}
      <rect x="1" y="6" width="5" height="5" rx="1.5" fill={c} opacity="0.3" stroke={c} strokeWidth="0.8"/>
      {/* Screen */}
      <rect x="28" y="5" width="6" height="4" rx="1" fill="#001a0d" stroke="#00ff88" strokeWidth="0.8"/>
      <text x="31" y="8.5" fontSize="2.5" fill="#00ff88" textAnchor="middle" fontFamily="monospace">BPM</text>
    </svg>
  );
}

function IconDrum({ c="#ff8800" }: { c?: string }) {
  return (
    <svg width="30" height="28" viewBox="0 0 30 28" fill="none">
      {/* Kick drum body */}
      <ellipse cx="15" cy="14" rx="13" ry="12" fill="#0a0008" stroke={c} strokeWidth="1.8"/>
      {/* Top head */}
      <ellipse cx="15" cy="5" rx="13" ry="4" fill="#000d15" stroke={c} strokeWidth="1.5"/>
      {/* Tension rods */}
      {[0,45,90,135,180,225,270,315].map((deg,i) => {
        const rad = deg*Math.PI/180;
        const x1 = 15 + 11*Math.cos(rad), y1 = 14 + 10*Math.sin(rad);
        const x2 = 15 + 12*Math.cos(rad), y2 = 5 + 3.5*Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="0.8" opacity="0.5"/>;
      })}
      {/* Center logo */}
      <circle cx="15" cy="14" r="4" fill={c} opacity="0.2"/>
      <circle cx="15" cy="14" r="2" fill={c} opacity="0.5"/>
      {/* HiHat on stick */}
      <line x1="24" y1="2" x2="28" y2="8" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
      <ellipse cx="24" cy="2" rx="4" ry="1.5" fill={c} opacity="0.6" transform="rotate(-20,24,2)"/>
      <ellipse cx="24" cy="2.8" rx="4" ry="1.5" fill={c} opacity="0.4" transform="rotate(-20,24,2.8)"/>
    </svg>
  );
}

function IconSakura({ c="#ff88bb" }: { c?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {[0,72,144,216,288].map((deg,i) => {
        const rad = deg*Math.PI/180;
        const cx = 11 + 6*Math.cos(rad), cy = 11 + 6*Math.sin(rad);
        return <ellipse key={i} cx={cx} cy={cy} rx="4" ry="2.5"
          fill={c} opacity="0.85"
          transform={`rotate(${deg+90},${cx},${cy})`}/>;
      })}
      <circle cx="11" cy="11" r="3" fill="#ffdd44" opacity="0.9"/>
      <circle cx="11" cy="11" r="1.5" fill="#ff8800" opacity="0.7"/>
    </svg>
  );
}

// ── Floating items ────────────────────────────────────────────────
function FloatingParticles() {
  const guitarColors = ["#00f5ff","#ff006e","#00ff88","#aa00ff","#ff8800","#ffffff"];
  const symbols = ["⚡","💀","⚙","◈","⬡","∞","⚡","◈"];

  const items = [
    // guitars — 5 штук
    ...([0,1,2,3,4] as number[]).map(i => ({
      key:`g${i}`, left:`${10+(i*20)%80}%`,
      delay:`${i*3}s`, dur:`${18+(i*2)%8}s`,
      rotate:`rotate(${(i*55)%360}deg)`,
      el: <MiniGuitar size={18+(i%3)*6} color={guitarColors[i%6]}/>,
    })),
    // drums — 4 штуки
    ...([0,1,2,3] as number[]).map(i => ({
      key:`dr${i}`, left:`${15+(i*22)%70}%`,
      delay:`${5+i*4}s`, dur:`${20+(i*2)%8}s`,
      rotate:`rotate(${(i*20)%30-10}deg)`,
      el: <IconDrum c={["#ff8800","#ff006e","#f0b90b","#aa00ff"][i%4]}/>,
    })),
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map(item => (
        <div key={item.key} className="absolute anime-particle"
          style={{ left:item.left, animationDelay:item.delay, animationDuration:item.dur,
            transform:item.rotate, opacity:0.55 }}>
          {item.el}
        </div>
      ))}
    </div>
  );
}

// ── Neuropunk skull emblem ─────────────────────────────────────────
function NeuropunkEmblem() {
  return (
    <svg viewBox="0 0 200 200" width="200" height="200" fill="none" style={{filter:"drop-shadow(0 0 28px rgba(0,245,255,0.6))"}}>
      <defs>
        <radialGradient id="emblG" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#001a22"/>
          <stop offset="100%" stopColor="#000508"/>
        </radialGradient>
        <radialGradient id="btcGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffdd44"/>
          <stop offset="100%" stopColor="#f0b90b"/>
        </radialGradient>
        <filter id="eg2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="btcF"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Outer hex */}
      <polygon points="100,6 172,50 172,138 100,182 28,138 28,50"
        fill="none" stroke="#00f5ff" strokeWidth="2.5" opacity="0.7"/>
      <polygon points="100,18 162,59 162,129 100,170 38,129 38,59"
        fill="none" stroke="#aa00ff" strokeWidth="1" opacity="0.35"/>

      {/* Circuit nubs on hex corners */}
      {[[100,6],[172,50],[172,138],[100,182],[28,138],[28,50]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#00f5ff" opacity="0.8"/>
      ))}
      {/* Connector lines hex→circle */}
      <line x1="100" y1="6"   x2="100" y2="34"  stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>
      <line x1="172" y1="50"  x2="154" y2="62"  stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>
      <line x1="172" y1="138" x2="154" y2="126" stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>
      <line x1="100" y1="182" x2="100" y2="154" stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>
      <line x1="28"  y1="138" x2="46"  y2="126" stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>
      <line x1="28"  y1="50"  x2="46"  y2="62"  stroke="#00f5ff" strokeWidth="1.5" opacity="0.7"/>

      {/* Background circle */}
      <circle cx="100" cy="97" r="66" fill="url(#emblG)" stroke="#00f5ff" strokeWidth="1.5" opacity="0.9"/>

      {/* ── SKULL ── */}
      {/* Cranium — wider, more skull-like */}
      <path d="M100,38 C72,38 54,56 54,76 C54,92 60,103 70,110 L70,128 L130,128 L130,110 C140,103 146,92 146,76 C146,56 128,38 100,38 Z"
        fill="#000d1a" stroke="#00f5ff" strokeWidth="2"/>
      {/* Cranium highlight */}
      <path d="M72,52 C78,44 90,40 100,40 C110,40 122,44 128,52"
        stroke="#00f5ff" strokeWidth="1" opacity="0.3" fill="none"/>

      {/* ── BITCOIN EYES ── */}
      {/* Left eye socket */}
      <circle cx="78" cy="82" r="16" fill="#0a1520" stroke="#f0b90b" strokeWidth="1.5" opacity="0.9" filter="url(#eg2)"/>
      {/* Left Bitcoin ₿ */}
      <circle cx="78" cy="82" r="12" fill="url(#btcGlow)" filter="url(#btcF)"/>
      <circle cx="78" cy="82" r="12" fill="#f0b90b"/>
      <text x="78" y="87" textAnchor="middle" fontSize="14" fontWeight="900"
        fill="#5a3200" fontFamily="serif" style={{userSelect:"none"}}>₿</text>
      {/* Left eye glow ring */}
      <circle cx="78" cy="82" r="14" fill="none" stroke="#ffdd44" strokeWidth="1" opacity="0.6"/>

      {/* Right eye socket */}
      <circle cx="122" cy="82" r="16" fill="#0a1520" stroke="#f0b90b" strokeWidth="1.5" opacity="0.9" filter="url(#eg2)"/>
      {/* Right Bitcoin ₿ */}
      <circle cx="122" cy="82" r="12" fill="#f0b90b"/>
      <text x="122" y="87" textAnchor="middle" fontSize="14" fontWeight="900"
        fill="#5a3200" fontFamily="serif" style={{userSelect:"none"}}>₿</text>
      <circle cx="122" cy="82" r="14" fill="none" stroke="#ffdd44" strokeWidth="1" opacity="0.6"/>

      {/* Nose cavity */}
      <path d="M95,100 L100,108 L105,100 Z" fill="#00f5ff" opacity="0.5"/>

      {/* Teeth — 6 alternating cyan/purple */}
      {[72,80,88,96,104,112,120].map((x,i) => (
        <rect key={i} x={x} y="118" width="7" height="10" rx="1.5"
          fill={i%2===0?"#00f5ff":"#aa00ff"} opacity="0.85"/>
      ))}
      {/* Jaw line */}
      <path d="M70,118 L130,118" stroke="#00f5ff" strokeWidth="1" opacity="0.4"/>

      {/* Circuit wires from skull */}
      <path d="M70,95 L54,90 L46,90" stroke="#00f5ff" strokeWidth="1.2" opacity="0.5" fill="none"/>
      <path d="M70,108 L54,115 L46,115" stroke="#00f5ff" strokeWidth="1.2" opacity="0.5" fill="none"/>
      <path d="M130,95 L146,90 L154,90" stroke="#00f5ff" strokeWidth="1.2" opacity="0.5" fill="none"/>
      <path d="M130,108 L146,115 L154,115" stroke="#00f5ff" strokeWidth="1.2" opacity="0.5" fill="none"/>
      <circle cx="46" cy="90" r="2.5" fill="#00f5ff" opacity="0.7"/>
      <circle cx="46" cy="115" r="2.5" fill="#00f5ff" opacity="0.7"/>
      <circle cx="154" cy="90" r="2.5" fill="#00f5ff" opacity="0.7"/>
      <circle cx="154" cy="115" r="2.5" fill="#00f5ff" opacity="0.7"/>

      {/* Headphones */}
      <path d="M56,80 C54,64 62,50 78,44" stroke="#00ff88" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8"/>
      <path d="M144,80 C146,64 138,50 122,44" stroke="#00ff88" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8"/>
      <rect x="46" y="74" width="13" height="18" rx="5" fill="#00ff88" opacity="0.8"/>
      <rect x="141" y="74" width="13" height="18" rx="5" fill="#00ff88" opacity="0.8"/>
      <rect x="49" y="77" width="7" height="12" rx="3" fill="#001a0d" opacity="0.6"/>
      <rect x="144" y="77" width="7" height="12" rx="3" fill="#001a0d" opacity="0.6"/>

      {/* Pulse dashed ring */}
      <circle cx="100" cy="97" r="76" fill="none" stroke="#00f5ff" strokeWidth="0.8"
        opacity="0.15" strokeDasharray="5,8"/>
    </svg>
  );
}

// ── Hero — disconnected users ─────────────────────────────────────
function HeroDisconnected() {
  return (
    <div className="relative min-h-screen" style={{
      background:"radial-gradient(ellipse at 30% 20%, #001a33 0%, #0a0015 40%, #000508 100%)",
    }}>
      <TopNav />
      {/* Circuit board bg */}
      <CircuitBg />

      {/* Scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,245,255,0.015) 2px, rgba(0,245,255,0.015) 4px)",
      }}/>

      {/* Neon horizon */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none" style={{
        background:"radial-gradient(ellipse at 50% 100%, rgba(0,245,255,0.12) 0%, rgba(170,0,255,0.08) 40%, transparent 70%)"
      }}/>

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(35)].map((_,i) => (
          <div key={i} className="absolute rounded-full anime-star"
            style={{
              width:`${1+(i%3)}px`, height:`${1+(i%3)}px`,
              left:`${(i*17+5)%100}%`, top:`${(i*13+2)%90}%`,
              background:["#00f5ff","#ffffff","#00ff88","#aa00ff"][i%4],
              animationDelay:`${(i*0.5)%5}s`,
            }}/>
        ))}
      </div>

      {/* Floating guitars + neuropunk symbols */}
      <FloatingParticles />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">

        {/* Emblem */}
        <div className="mb-6" style={{animation:"heroFloat 4s ease-in-out infinite"}}>
          <NeuropunkEmblem />
        </div>


        {/* Title with glitch effect */}
        <h1 className="font-display font-black leading-none mb-2 relative"
          style={{fontSize:"clamp(3.5rem,10vw,6.5rem)"}}>
          <span className="relative inline-block" style={{
            background:"linear-gradient(135deg, #00f5ff 0%, #ffffff 35%, #aa00ff 65%, #ff006e 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            filter:"drop-shadow(0 0 30px rgba(0,245,255,0.6))",
          }}>
            FlipChain
          </span>
        </h1>
        <p className="font-display text-base md:text-xl tracking-[0.5em] uppercase mb-2"
          style={{color:"rgba(0,245,255,0.4)"}}>
          CASINO
        </p>
        <p className="text-xs tracking-[0.3em] mb-8" style={{color:"rgba(0,255,136,0.5)"}}>
          ◈ PROVABLY FAIR · ON-CHAIN · ETHEREUM ◈
        </p>

        {/* Stats row */}
        <div className="flex gap-6 mb-8 flex-wrap justify-center">
          {[
            {v:"4", l:"GAMES", c:"#00f5ff"},
            {v:"100%", l:"ON-CHAIN", c:"#00ff88"},
            {v:"0%", l:"KYC", c:"#aa00ff"},
            {v:"∞", l:"PROVABLY FAIR", c:"#ff8800"},
          ].map(s => (
            <div key={s.l} className="text-center px-4 py-2 rounded-lg"
              style={{background:"rgba(0,0,0,0.4)", border:`1px solid ${s.c}33`}}>
              <p className="font-black text-2xl font-mono" style={{color:s.c, textShadow:`0 0 12px ${s.c}`}}>{s.v}</p>
              <p className="text-white/30 text-[10px] tracking-widest">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Game icons strip */}
        <div className="flex gap-3 mb-8 flex-wrap justify-center">
          {[{e:"🪙",n:"COIN FLIP"},{e:"🎲",n:"DICE"},{e:"🚀",n:"CRASH"},{e:"🎰",n:"SLOTS"}].map(g => (
            <div key={g.n} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{background:"rgba(0,0,0,0.5)", border:"1px solid rgba(0,245,255,0.15)", color:"rgba(0,245,255,0.6)"}}>
              {g.e} {g.n}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <div style={{filter:"drop-shadow(0 0 20px rgba(0,245,255,0.5))"}}>
            <ConnectButton label="⚡ CONNECT & PLAY" />
          </div>
          <a href="https://metamask.app.link/dapp/chainbet-casino.surge.sh"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)"}}>
            🦊 Open in MetaMask App
          </a>
          <p className="text-white/20 text-xs tracking-wider">SEPOLIA TESTNET · NO REAL ETH</p>
        </div>

        {/* Bottom neon line */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-30">
          <div className="h-px w-24" style={{background:"linear-gradient(to right, transparent, #00f5ff)"}}/>
          <span className="text-xs text-[#00f5ff] tracking-widest font-mono">◈</span>
          <div className="h-px w-24" style={{background:"linear-gradient(to left, transparent, #00f5ff)"}}/>
        </div>
      </div>
    </div>
  );
}
function WrongNetwork() {
  return (
    <div
      className="max-w-sm mx-auto mt-24 text-center glass-card p-8 rounded-2xl"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-[#f6465d]/10 border border-[#f6465d]/25">
        <span className="text-2xl">⚠️</span>
      </div>
      <h2 className="font-display text-xl text-white font-semibold mb-3">
        Wrong Network
      </h2>
      <p className="text-white/45 text-sm mb-6 leading-relaxed">
        FlipChain Casino runs on{" "}
        <span className="text-[#00c74d] font-semibold">Ethereum Sepolia</span>{" "}
        testnet. Please switch your wallet.
      </p>
      <ConnectButton />
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────
function Footer() {
  const shortAddr =
    CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
      ? "Not deployed"
      : `${CONTRACT_ADDRESS.slice(0, 8)}…${CONTRACT_ADDRESS.slice(-6)}`;

  return (
    <footer className="border-t border-white/5 mt-16 py-7">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #fff3b0, #f0b90b 50%, #8a6200)",
            }}
          >
            ₿
          </div>
          <span className="font-display text-sm text-white/30">
            FlipChain Casino
          </span>
        </div>

        <p className="text-white/20 text-xs">
          Sepolia Testnet Educational demo &nbsp;•&nbsp; No real ETH &nbsp;•&nbsp; Sepolianbsp;•Educational demo &nbsp;•&nbsp; No real ETH &nbsp;•&nbsp; Sepolianbsp; No Real ETH Educational demo &nbsp;•&nbsp; No real ETH &nbsp;•&nbsp; Sepolianbsp;•Educational demo &nbsp;•&nbsp; No real ETH &nbsp;•&nbsp; Sepolianbsp; Provably Fair
          testnet
        </p>

        <div className="flex items-center gap-4">
          <a
            href={addressUrl(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/25 hover:text-white/55 text-xs transition-colors font-mono"
          >
            {shortAddr}
          </a>
          <a
            href={ETHERSCAN_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/25 hover:text-white/55 text-xs transition-colors"
          >
            Etherscan ↗
          </a>
        </div>
      </div>
    </footer>
  );
}

// ── Top Nav ───────────────────────────────────────────────────────
function TopNav() {
  return (
    <header
      className="sticky top-0 z-50 border-b border-white/5"
      style={{ background: "rgba(15,18,24,0.92)", backdropFilter: "blur(16px)" }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #fff3b0, #f0b90b 50%, #8a6200)",
            }}
          >
            ₿
          </div>
          <span className="font-display font-bold text-base text-white hidden sm:block">
            FlipChain
          </span>
          <span className="font-display font-light text-base text-white/30 hidden sm:block">
            Casino
          </span>
          <span className="network-badge hidden md:inline-flex">SEPOLIA</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <span className="network-badge md:hidden">SEPOLIA</span>
          <ConnectButton
            showBalance={{ smallScreen: false, largeScreen: true }}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
          />
        </div>
      </div>
    </header>
  );
}

// ── Game Tabs ─────────────────────────────────────────────────────
function GameTabs({
  active,
  onChange,
}: {
  active: GameTab;
  onChange: (tab: GameTab) => void;
}) {
  return (
    <div
      className="flex gap-1 p-1 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {GAME_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150"
            style={
              isActive
                ? {
                    background: "rgba(0,199,77,0.12)",
                    color: "#00c74d",
                    borderBottom: "2px solid #00c74d",
                  }
                : {
                    background: "transparent",
                    color: "rgba(255,255,255,0.40)",
                    borderBottom: "2px solid transparent",
                  }
            }
          >
            <span className="text-base leading-none">{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function Home() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === sepolia.id;
  const [activeGame, setActiveGame] = useState<GameTab>("coinflip");

  if (!isConnected) {
    return <HeroDisconnected />;
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{
      background:"radial-gradient(ellipse at 30% 20%, #001a33 0%, #0a0015 40%, #000508 100%)",
    }}>
      {/* Same neuropunk background — no floating objects */}
      <CircuitBg />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,245,255,0.012) 2px, rgba(0,245,255,0.012) 4px)",
      }}/>
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_,i) => (
          <div key={i} className="absolute rounded-full anime-star"
            style={{
              width:`${1+(i%3)}px`, height:`${1+(i%3)}px`,
              left:`${(i*17+5)%100}%`, top:`${(i*13+2)%90}%`,
              background:["#00f5ff","#ffffff","#00ff88","#aa00ff"][i%4],
              animationDelay:`${(i*0.5)%5}s`,
            }}/>
        ))}
      </div>

      <TopNav />

      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {!isCorrectNetwork ? (
          <WrongNetwork />
        ) : (
          <div className="space-y-6" style={{ animation: "fadeIn 0.4s ease-out" }}>
            {/* Top row: balance + game */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Balance card always visible */}
              <div className="lg:col-span-2">
                <BalanceCard game={activeGame} />
              </div>

              {/* Game area with tabs */}
              <div className="lg:col-span-3 flex flex-col gap-4">
                <GameTabs active={activeGame} onChange={setActiveGame} />

                {activeGame === "coinflip" && <CoinFlip />}
                {activeGame === "dice" && <DiceGame />}
                {activeGame === "limbo" && <CrashGame />}
                {activeGame === "slots" && <SlotsGame />}
              </div>
            </div>

            {/* Game history */}
            <GameHistory />

            {/* How it works */}
            <HowItWorks />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
