"use client";

import React, { useState } from "react";
import { CONTRACT_ADDRESS, addressUrl } from "@/lib/config";

// ── Numbered step ─────────────────────────────────────────────────
function Step({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-sm"
        style={{
          background: "rgba(0,199,77,0.1)",
          border: "1px solid rgba(0,199,77,0.3)",
          color: "#00c74d",
        }}
      >
        {num}
      </div>
      <div>
        <p className="text-white/80 font-semibold text-sm mb-1">{title}</p>
        <p className="text-white/40 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ── Code block with copy ──────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre
        className="rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto"
        style={{
          background: "#0a0c10",
          border: "1px solid rgba(0,199,77,0.12)",
          color: "rgba(0,199,77,0.75)",
        }}
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2.5 py-1 rounded-lg"
        style={{
          background: "rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: copied ? "#00c74d" : "rgba(255,255,255,0.45)",
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

// ── Info box ──────────────────────────────────────────────────────
function InfoBox({
  icon,
  title,
  children,
  accent,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  accent?: "gold" | "emerald";
}) {
  const styles =
    accent === "emerald"
      ? {
          container: {
            background: "rgba(0,199,77,0.05)",
            border: "1px solid rgba(0,199,77,0.15)",
          },
          titleColor: "#00c74d",
        }
      : accent === "gold"
      ? {
          container: {
            background: "rgba(240,185,11,0.05)",
            border: "1px solid rgba(240,185,11,0.15)",
          },
          titleColor: "#f0b90b",
        }
      : {
          container: {
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          },
          titleColor: "rgba(255,255,255,0.75)",
        };

  return (
    <div className="rounded-xl p-4" style={styles.container}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div>
          <p
            className="font-semibold text-sm mb-1"
            style={{ color: styles.titleColor }}
          >
            {title}
          </p>
          <p className="text-white/45 text-sm leading-relaxed">{children}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main HowItWorks ───────────────────────────────────────────────
export function HowItWorks() {
  const contractShort =
    CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
      ? "Not yet deployed"
      : `${CONTRACT_ADDRESS.slice(0, 10)}…${CONTRACT_ADDRESS.slice(-8)}`;

  const verifySample = `// Verify any game result yourself:
// 1. Get these from the GamePlayed event on Etherscan:
const prevrandao = "0x...";   // block.prevrandao
const timestamp  = "...";     // block.timestamp
const player     = "0x...";   // msg.sender
const gameCount  = "...";     // game index before flip
const betAmount  = "...";     // bet in wei

// 2. Reproduce the seed in any JS environment:
import { keccak256, encodePacked } from "viem";
const seed = keccak256(encodePacked(
  ["uint256","uint256","address","uint256","uint256"],
  [prevrandao, timestamp, player, gameCount, betAmount]
));

// 3. Derive result:
const result = BigInt(seed) % 2n;  // 0 = Heads, 1 = Tails`;

  return (
    <div
      className="glass-card rounded-2xl p-6 space-y-8"
      style={{ animation: "fadeIn 0.4s ease-out" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#00c74d]/10 border border-[#00c74d]/20 shrink-0 mt-0.5">
          <span className="text-sm">🔍</span>
        </div>
        <div>
          <h2 className="font-semibold text-white text-base mb-1">
            How It Works
          </h2>
          <p className="text-white/40 text-sm">
            FlipChain is{" "}
            <strong className="text-white/70">provably fair</strong> — every
            result can be independently verified using only public blockchain
            data.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Steps */}
        <div className="space-y-5">
          <p className="text-white/30 text-[10px] uppercase tracking-widest">
            How a Flip Works
          </p>

          <div className="space-y-5">
            <Step num="1" title="Deposit ETH into casino balance">
              Your ETH is held in the smart contract under your address. You can
              withdraw it at any time — no lockup, no KYC.
            </Step>

            <Step num="2" title="Choose Heads or Tails, set your bet">
              Pick your side and slide the bet slider between 0.001 and 0.1
              ETH. The potential payout is shown in real time.
            </Step>

            <Step num="3" title="Hit FLIP — contract resolves on-chain">
              Your transaction calls{" "}
              <code
                className="px-1.5 py-0.5 rounded text-xs font-mono"
                style={{
                  background: "rgba(0,199,77,0.1)",
                  color: "rgba(0,199,77,0.8)",
                }}
              >
                flip(choice, betAmount)
              </code>
              . The contract computes the result instantly in the same
              transaction — no oracle, no second call, no delay.
            </Step>

            <Step num="4" title="Result logged in GamePlayed event">
              The outcome, your random seed, bet amount, and payout are
              permanently stored on-chain. Anyone can verify the result using
              the seed.
            </Step>
          </div>
        </div>

        {/* Randomness */}
        <div className="space-y-5">
          <p className="text-white/30 text-[10px] uppercase tracking-widest">
            Randomness Formula
          </p>

          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "#0a0c10",
              border: "1px solid rgba(0,199,77,0.12)",
            }}
          >
            <p className="text-white/40 text-xs">
              The random seed is computed as:
            </p>
            <pre
              className="text-xs font-mono leading-relaxed overflow-x-auto"
              style={{ color: "rgba(0,199,77,0.75)" }}
            >
              {`keccak256(
  block.prevrandao,  // Beacon chain RANDAO
  block.timestamp,   // Block time
  msg.sender,        // Your address
  gameCount,         // Game index
  betAmount          // Bet in wei
)`}
            </pre>
            <p className="text-white/28 text-xs">
              All five inputs appear in the transaction — verifiable forever on
              Etherscan.
            </p>
          </div>

          <InfoBox icon="🎲" title="Why prevrandao?">
            EIP-4399 replaced the old blockhash randomness with Ethereum&apos;s
            RANDAO beacon, making it significantly harder for validators to
            manipulate (they would have to forfeit a 32 ETH stake per attempt).
          </InfoBox>

          <InfoBox icon="⚠️" title="Known limitation" accent="gold">
            Block proposers technically have 1-bit influence over prevrandao by
            choosing to skip. For a high-stakes production casino, use Chainlink
            VRF. This demo is suitable for testnet play.
          </InfoBox>
        </div>
      </div>

      {/* Verify yourself */}
      <div className="space-y-4">
        <p className="text-white/30 text-[10px] uppercase tracking-widest">
          Verify Any Result Yourself
        </p>
        <CodeBlock code={verifySample} />
        <p className="text-white/25 text-xs">
          1. Open any GamePlayed event on Etherscan. 2. Copy the five inputs
          from the transaction. 3. Run the snippet above — the result must match
          what was emitted.
        </p>
      </div>

      {/* Contract info cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        <InfoBox icon="📄" title="Smart Contract" accent="gold">
          <a
            href={addressUrl(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs hover:text-[#f0b90b] transition-colors break-all"
          >
            {contractShort} ↗
          </a>
        </InfoBox>

        <InfoBox icon="🔒" title="Non-Custodial" accent="emerald">
          You always control your funds. The contract cannot freeze or seize
          player balances.
        </InfoBox>

        <InfoBox icon="📊" title="House Edge">
          Win pays <strong className="text-white/70">1.95×</strong> your bet.
          Fair odds would be 2×, so the house edge is{" "}
          <strong className="text-white/70">2.5%</strong>.
        </InfoBox>
      </div>

      {/* External links */}
      <div
        className="flex flex-wrap gap-5 pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <a
          href={addressUrl(CONTRACT_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors"
          style={{ color: "rgba(0,199,77,0.5)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#00c74d")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(0,199,77,0.5)")
          }
        >
          Contract on Etherscan ↗
        </a>
        <a
          href="https://eips.ethereum.org/EIPS/eip-4399"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.6)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
          }
        >
          EIP-4399 (PREVRANDAO) ↗
        </a>
        <a
          href="https://sepolia.etherscan.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.6)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.25)")
          }
        >
          Sepolia Etherscan ↗
        </a>
        <a
          href="https://sepoliafaucet.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs transition-colors"
          style={{ color: "rgba(0,199,77,0.4)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#00c74d")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(0,199,77,0.4)")
          }
        >
          Get Sepolia ETH (faucet) ↗
        </a>
      </div>
    </div>
  );
}
