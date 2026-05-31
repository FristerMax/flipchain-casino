"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { CONTRACT_V2_ADDRESS, txUrl } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────
type GameType = "flip" | "dice" | "crash" | "slots";

const SYMS = ["🍒","🍋","🍊","🍇","⭐","🎰","7️⃣","💎"];

interface GameEvent {
  gameId: bigint;
  player: string;
  gameType: GameType;
  // flip
  choice?: number;
  result?: number;
  // dice
  target?: number;
  roll?: number;
  isOver?: boolean;
  // crash
  targetMult?: number;
  crashPoint?: number;
  // slots
  reel1?: number;
  reel2?: number;
  reel3?: number;
  won: boolean;
  betAmount: bigint;
  payout: bigint;
  randomSeed: string;
  txHash: string;
  blockNumber: bigint;
}

// ── Helpers ───────────────────────────────────────────────────────
function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function shortSeed(s: string) { return `${s.slice(0, 10)}…`; }
function fmtEth(wei: bigint) { return parseFloat(formatEther(wei)).toFixed(4); }
function fmtMult(m: number) {
  return m >= 100 ? m.toFixed(0) + "×" : m.toFixed(2) + "×";
}

// ── Pick/Result cell per game type ────────────────────────────────
function PickCell({ game }: { game: GameEvent }) {
  if (game.gameType === "flip") {
    const isH = game.choice === 0;
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
        style={{ background: isH ? "rgba(240,185,11,0.1)" : "rgba(138,109,255,0.1)", border: `1px solid ${isH ? "rgba(240,185,11,0.25)" : "rgba(138,109,255,0.25)"}`, color: isH ? "#f0b90b" : "#a78bfa" }}>
        {isH ? "👑" : "⚡"}
      </span>
    );
  }
  if (game.gameType === "dice") {
    return (
      <span className="text-xs font-mono text-white/60">
        {game.isOver ? ">" : "<"}{game.target}
      </span>
    );
  }
  if (game.gameType === "slots") {
    return (
      <span className="text-xs font-mono text-white/50">
        {SYMS[game.reel1 ?? 0]}…
      </span>
    );
  }
  // crash
  return (
    <span className="text-xs font-mono" style={{ color: "#f0b90b" }}>
      {fmtMult(game.targetMult ?? 1)}
    </span>
  );
}

function ResultCell({ game }: { game: GameEvent }) {
  if (game.gameType === "flip") {
    const isH = game.result === 0;
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
        style={{ background: isH ? "rgba(240,185,11,0.1)" : "rgba(138,109,255,0.1)", border: `1px solid ${isH ? "rgba(240,185,11,0.25)" : "rgba(138,109,255,0.25)"}`, color: isH ? "#f0b90b" : "#a78bfa" }}>
        {isH ? "👑" : "⚡"}
      </span>
    );
  }
  if (game.gameType === "dice") {
    return (
      <span className="text-xs font-mono font-bold"
        style={{ color: game.won ? "#00c74d" : "#f6465d" }}>
        {game.roll}
      </span>
    );
  }
  if (game.gameType === "slots") {
    return (
      <span className="text-xs font-mono" style={{ color: game.won ? "#00c74d" : "#f6465d" }}>
        {SYMS[game.reel1 ?? 0]}{SYMS[game.reel2 ?? 0]}{SYMS[game.reel3 ?? 0]}
      </span>
    );
  }
  // crash
  return (
    <span className="text-xs font-mono"
      style={{ color: game.won ? "#00c74d" : "#f6465d" }}>
      {fmtMult(game.crashPoint ?? 1)} {game.won ? "" : "💥"}
    </span>
  );
}

function GameTypeBadge({ type }: { type: GameType }) {
  const cfg = {
    flip:  { icon: "🪙", color: "#f0b90b", bg: "rgba(240,185,11,0.08)" },
    dice:  { icon: "🎲", color: "#48cae4", bg: "rgba(72,202,228,0.08)" },
    crash: { icon: "🚀", color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
    slots: { icon: "🎰", color: "#ff6b6b", bg: "rgba(255,107,107,0.08)" },
  }[type];
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      {cfg.icon}
    </span>
  );
}

// ── Row ───────────────────────────────────────────────────────────
function HistoryRow({ game, index }: { game: GameEvent; index: number }) {
  return (
    <tr className="history-table-row text-sm" style={{ animationDelay: `${index * 40}ms` }}>
      <td className="px-2 py-2.5 text-white/30 font-mono text-xs">#{game.gameId.toString()}</td>
      <td className="px-2 py-2.5 hidden md:table-cell">
        <div className="flex items-center gap-1.5">
          <GameTypeBadge type={game.gameType} />
          <a href={`https://sepolia.etherscan.io/address/${game.player}`} target="_blank" rel="noopener noreferrer"
            className="font-mono text-xs" style={{ color: "rgba(240,185,11,0.55)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f0b90b")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(240,185,11,0.55)")}>
            {shortAddr(game.player)}
          </a>
        </div>
      </td>
      <td className="px-2 py-2.5 text-center"><PickCell game={game} /></td>
      <td className="px-2 py-2.5 text-center"><ResultCell game={game} /></td>
      <td className="px-2 py-2.5 text-center">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${game.won ? "badge-win" : "badge-lose"}`}>
          {game.won ? "WIN" : "LOSS"}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right hidden sm:table-cell">
        <span className="font-mono text-white/40 text-xs">{fmtEth(game.betAmount)}</span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className="font-mono text-xs font-semibold" style={{ color: game.won ? "#00c74d" : "#f6465d" }}>
          {game.won ? `+${fmtEth(game.payout)}` : `-${fmtEth(game.betAmount)}`}
        </span>
      </td>
      <td className="px-2 py-2.5 hidden lg:table-cell">
        <span className="font-mono text-white/20 text-xs">{shortSeed(game.randomSeed)}</span>
      </td>
      <td className="px-2 py-2.5 text-center">
        <a href={txUrl(game.txHash)} target="_blank" rel="noopener noreferrer"
          className="text-white/25 hover:text-[#00c74d] transition-colors text-xs">↗</a>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export function GameHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [games, setGames] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMine, setFilterMine] = useState(false);
  const [gameCount, setGameCount] = useState<bigint | undefined>();

  const V2 = CONTRACT_V2_ADDRESS as `0x${string}`;

  const fetchEvents = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = latest > 10000n ? latest - 10000n : 0n;

      // Fetch all four event types from V2 in parallel
      const [flipLogs, diceLogs, crashLogs, slotsLogs] = await Promise.all([
        publicClient.getLogs({
          address: V2,
          event: { type: "event", name: "GamePlayed", inputs: [
            { indexed: true, name: "gameId", type: "uint256" },
            { indexed: true, name: "player", type: "address" },
            { indexed: false, name: "choice", type: "uint8" },
            { indexed: false, name: "result", type: "uint8" },
            { indexed: false, name: "won", type: "bool" },
            { indexed: false, name: "betAmount", type: "uint256" },
            { indexed: false, name: "payout", type: "uint256" },
            { indexed: false, name: "randomSeed", type: "bytes32" },
          ]}, fromBlock: from, toBlock: latest,
        }),
        publicClient.getLogs({
          address: V2,
          event: { type: "event", name: "DicePlayed", inputs: [
            { indexed: true, name: "gameId", type: "uint256" },
            { indexed: true, name: "player", type: "address" },
            { indexed: false, name: "target", type: "uint8" },
            { indexed: false, name: "isOver", type: "bool" },
            { indexed: false, name: "roll", type: "uint8" },
            { indexed: false, name: "won", type: "bool" },
            { indexed: false, name: "betAmount", type: "uint256" },
            { indexed: false, name: "payout", type: "uint256" },
            { indexed: false, name: "randomSeed", type: "bytes32" },
          ]}, fromBlock: from, toBlock: latest,
        }),
        publicClient.getLogs({
          address: V2,
          event: { type: "event", name: "LimboPlayed", inputs: [
            { indexed: true, name: "gameId", type: "uint256" },
            { indexed: true, name: "player", type: "address" },
            { indexed: false, name: "targetMultiplierBps", type: "uint256" },
            { indexed: false, name: "crashPoint", type: "uint256" },
            { indexed: false, name: "won", type: "bool" },
            { indexed: false, name: "betAmount", type: "uint256" },
            { indexed: false, name: "payout", type: "uint256" },
            { indexed: false, name: "randomSeed", type: "bytes32" },
          ]}, fromBlock: from, toBlock: latest,
        }),
        publicClient.getLogs({
          address: V2,
          event: { type: "event", name: "SlotsPlayed", inputs: [
            { indexed: true,  name: "gameId",     type: "uint256" },
            { indexed: true,  name: "player",     type: "address" },
            { indexed: false, name: "reel1",      type: "uint8"   },
            { indexed: false, name: "reel2",      type: "uint8"   },
            { indexed: false, name: "reel3",      type: "uint8"   },
            { indexed: false, name: "won",        type: "bool"    },
            { indexed: false, name: "betAmount",  type: "uint256" },
            { indexed: false, name: "payout",     type: "uint256" },
            { indexed: false, name: "randomSeed", type: "bytes32" },
          ]}, fromBlock: from, toBlock: latest,
        }),
      ]);

      const allEvents: GameEvent[] = [
        ...flipLogs.map(l => {
          const a = l.args as { gameId: bigint; player: string; choice: number; result: number; won: boolean; betAmount: bigint; payout: bigint; randomSeed: string };
          return { gameId: a.gameId, player: a.player, gameType: "flip" as GameType, choice: a.choice, result: a.result, won: a.won, betAmount: a.betAmount, payout: a.payout, randomSeed: a.randomSeed, txHash: l.transactionHash ?? "", blockNumber: l.blockNumber ?? 0n };
        }),
        ...diceLogs.map(l => {
          const a = l.args as { gameId: bigint; player: string; target: number; isOver: boolean; roll: number; won: boolean; betAmount: bigint; payout: bigint; randomSeed: string };
          return { gameId: a.gameId, player: a.player, gameType: "dice" as GameType, target: a.target, isOver: a.isOver, roll: a.roll, won: a.won, betAmount: a.betAmount, payout: a.payout, randomSeed: a.randomSeed, txHash: l.transactionHash ?? "", blockNumber: l.blockNumber ?? 0n };
        }),
        ...crashLogs.map(l => {
          const a = l.args as { gameId: bigint; player: string; targetMultiplierBps: bigint; crashPoint: bigint; won: boolean; betAmount: bigint; payout: bigint; randomSeed: string };
          return { gameId: a.gameId, player: a.player, gameType: "crash" as GameType, targetMult: Number(a.targetMultiplierBps) / 100, crashPoint: Number(a.crashPoint) / 100, won: a.won, betAmount: a.betAmount, payout: a.payout, randomSeed: a.randomSeed, txHash: l.transactionHash ?? "", blockNumber: l.blockNumber ?? 0n };
        }),
        ...slotsLogs.map(l => {
          const a = l.args as { gameId: bigint; player: string; reel1: number; reel2: number; reel3: number; won: boolean; betAmount: bigint; payout: bigint; randomSeed: string };
          return { gameId: a.gameId, player: a.player, gameType: "slots" as GameType, reel1: a.reel1, reel2: a.reel2, reel3: a.reel3, won: a.won, betAmount: a.betAmount, payout: a.payout, randomSeed: a.randomSeed, txHash: l.transactionHash ?? "", blockNumber: l.blockNumber ?? 0n };
        }),
      ];

      // Sort by blockNumber desc, then gameId desc
      allEvents.sort((a, b) => {
        const bd = Number(b.blockNumber - a.blockNumber);
        return bd !== 0 ? bd : Number(b.gameId - a.gameId);
      });

      setGameCount(BigInt(allEvents.length));
      setGames(allEvents);
    } catch (err) {
      console.error("Failed to fetch game history:", err);
    } finally {
      setLoading(false);
    }
  }, [publicClient, V2]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(fetchEvents, 15000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const displayGames = filterMine && address
    ? games.filter(g => g.player.toLowerCase() === address.toLowerCase())
    : games;

  const top10 = displayGames.slice(0, 10);

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-base font-semibold" style={{ color: "#f0b90b" }}>
            📋 Game History
          </h2>
          {gameCount !== undefined && (
            <span className="text-white/30 text-xs font-mono">{gameCount.toString()} total</span>
          )}
          {loading && <span className="inline-block w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {[{ label: "All Players", val: false }, { label: "My Games", val: true }].map(({ label, val }) => (
            <button key={label} onClick={() => setFilterMine(val)} disabled={val && !address}
              className="px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
              style={filterMine === val ? { background: "rgba(240,185,11,0.15)", color: "#f0b90b", border: "1px solid rgba(240,185,11,0.3)" } : { color: "rgba(255,255,255,0.3)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {top10.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              Loading history…
            </div>
          ) : (
            <div><p className="text-2xl mb-2">🎲</p><p>No games yet — deposit ETH and place your first bet!</p></div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="text-white/25 text-xs uppercase tracking-widest border-b border-white/5">
                <th className="px-2 py-2 text-left font-normal">#</th>
                <th className="px-2 py-2 text-left font-normal hidden md:table-cell">Player</th>
                <th className="px-2 py-2 text-center font-normal">Pick</th>
                <th className="px-2 py-2 text-center font-normal">Result</th>
                <th className="px-2 py-2 text-center font-normal">Outcome</th>
                <th className="px-2 py-2 text-right font-normal hidden sm:table-cell">Bet</th>
                <th className="px-2 py-2 text-right font-normal">+/-</th>
                <th className="px-2 py-2 text-left font-normal hidden lg:table-cell">Seed</th>
                <th className="px-2 py-2 text-center font-normal">Tx</th>
              </tr>
            </thead>
            <tbody className="history-table">
              {top10.map((game, i) => <HistoryRow key={`${game.txHash}-${i}`} game={game} index={i} />)}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-white/20 text-xs mt-4 text-center">
        Showing {top10.length} of {displayGames.length} games from the last ~33h
      </p>
    </div>
  );
}
