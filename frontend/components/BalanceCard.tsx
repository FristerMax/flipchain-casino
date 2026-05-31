"use client";

import React, { useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import toast from "react-hot-toast";
import { CONTRACT_V2_CONFIG, formatEth, txUrl } from "@/lib/config";

// ── Slots contract config (inline to avoid circular deps) ─────────
const SLOTS_ADDRESS = (process.env.NEXT_PUBLIC_SLOTS_ADDRESS as `0x${string}`)
  ?? "0x0000000000000000000000000000000000000000";
const SLOTS_ABI = [
  { name: "deposit",    type: "function", inputs: [],                                    outputs: [], stateMutability: "payable"  },
  { name: "withdraw",   type: "function", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "balanceOf",  type: "function", inputs: [{ name: "p", type: "address" }],      outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "contractBalance", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;
const SLOTS_CONFIG = { address: SLOTS_ADDRESS, abi: SLOTS_ABI } as const;

// ── Spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
      aria-hidden
    />
  );
}

// ── Mini stat box ─────────────────────────────────────────────────
function MiniStat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex-1 min-w-0 inner-card px-4 py-3">
      <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1.5">
        {label}
      </p>
      <p
        className={`font-bold text-base truncate ${
          valueColor ?? "text-white/75"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.2s ease-out" }}
      onClick={onClose}
    >
      <div
        className="glass-card rounded-2xl p-6 w-full max-w-sm border border-white/8"
        style={{ animation: "slideUp 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-base text-white font-semibold">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white/35 hover:text-white/70 hover:bg-white/8 transition-all text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Deposit modal ─────────────────────────────────────────────────
function DepositModal({
  contractConfig,
  onClose,
  onSuccess,
}: {
  contractConfig?: typeof CONTRACT_V2_CONFIG | typeof SLOTS_CONFIG;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ethAmount, setEthAmount] = useState("0.01");
  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  React.useEffect(() => {
    if (isSuccess) {
      toast.success("Deposit confirmed!");
      onSuccess();
      onClose();
    }
  }, [isSuccess, onClose, onSuccess]);

  const handleDeposit = () => {
    const parsed = parseFloat(ethAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const toastId = toast.loading("Confirm in wallet…");
    writeContract(
      {
        ...(contractConfig ?? CONTRACT_V2_CONFIG) as typeof CONTRACT_V2_CONFIG,
        functionName: "deposit",
        value: parseEther(ethAmount),
      },
      {
        onSuccess: (hash) => {
          toast.dismiss(toastId);
          toast.loading("Depositing…", { id: hash });
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(
            err.message.includes("User rejected")
              ? "Transaction rejected"
              : "Deposit failed"
          );
        },
      }
    );
  };

  const pending = isPending || isConfirming;

  return (
    <Modal title="Deposit ETH" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-white/40 text-xs uppercase tracking-widest block mb-2">
            Amount (ETH)
          </label>
          <input
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            min="0.001"
            step="0.001"
            disabled={pending}
            className="w-full rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none transition-colors disabled:opacity-50"
            style={{
              background: "#0f1218",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border =
                "1px solid rgba(0,199,77,0.4)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border =
                "1px solid rgba(255,255,255,0.1)")
            }
          />
          <p className="text-white/25 text-xs mt-1.5">
            ETH goes into your casino balance
          </p>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2">
          {["0.005", "0.01", "0.05", "0.1"].map((v) => (
            <button
              key={v}
              onClick={() => setEthAmount(v)}
              disabled={pending}
              className="flex-1 py-2 text-xs rounded-lg transition-all disabled:opacity-40"
              style={{
                background:
                  ethAmount === v
                    ? "rgba(0,199,77,0.12)"
                    : "rgba(255,255,255,0.04)",
                border:
                  ethAmount === v
                    ? "1px solid rgba(0,199,77,0.35)"
                    : "1px solid rgba(255,255,255,0.08)",
                color: ethAmount === v ? "#00c74d" : "rgba(255,255,255,0.45)",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          onClick={handleDeposit}
          disabled={pending}
          className="btn-primary w-full py-3 rounded-xl text-sm uppercase tracking-wider disabled:opacity-50"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />{" "}
              {isConfirming ? "Confirming…" : "Confirm in wallet…"}
            </span>
          ) : (
            "Deposit"
          )}
        </button>

        {txHash && (
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[#00c74d]/55 hover:text-[#00c74d] text-xs transition-colors"
          >
            View on Etherscan ↗
          </a>
        )}
      </div>
    </Modal>
  );
}

// ── Withdraw modal ────────────────────────────────────────────────
function WithdrawModal({
  contractConfig,
  casinoBalance,
  onClose,
  onSuccess,
}: {
  contractConfig?: typeof CONTRACT_V2_CONFIG | typeof SLOTS_CONFIG;
  casinoBalance: bigint;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Floor to 6 decimal places to avoid rounding above actual balance
  const maxEth = Math.floor(Number(formatEther(casinoBalance)) * 1e6) / 1e6;
  const [ethAmount, setEthAmount] = useState(
    (Math.floor(Math.min(maxEth, 0.01) * 1e6) / 1e6).toFixed(4)
  );

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  React.useEffect(() => {
    if (isSuccess) {
      toast.success("Withdrawal confirmed!");
      onSuccess();
      onClose();
    }
  }, [isSuccess, onClose, onSuccess]);

  const handleWithdraw = () => {
    const parsed = parseFloat(ethAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    // Compare in wei to avoid float precision issues
    if (parseEther(ethAmount) > casinoBalance) {
      toast.error("Exceeds casino balance");
      return;
    }
    const toastId = toast.loading("Confirm in wallet…");
    writeContract(
      {
        ...(contractConfig ?? CONTRACT_V2_CONFIG) as typeof CONTRACT_V2_CONFIG,
        functionName: "withdraw",
        args: [parseEther(ethAmount)],
      },
      {
        onSuccess: (hash) => {
          toast.dismiss(toastId);
          toast.loading("Withdrawing…", { id: hash });
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(
            err.message.includes("User rejected")
              ? "Transaction rejected"
              : "Withdrawal failed"
          );
        },
      }
    );
  };

  const pending = isPending || isConfirming;

  return (
    <Modal title="Withdraw ETH" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-white/40 text-xs uppercase tracking-widest block mb-2">
            Amount (ETH)
          </label>
          <input
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            min="0.001"
            max={maxEth}
            step="0.001"
            disabled={pending}
            className="w-full rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none transition-colors disabled:opacity-50"
            style={{
              background: "#0f1218",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border =
                "1px solid rgba(0,199,77,0.4)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.border =
                "1px solid rgba(255,255,255,0.1)")
            }
          />
          <p className="text-white/25 text-xs mt-1.5">
            Available: {maxEth.toFixed(4)} ETH
          </p>
        </div>

        <button
          onClick={() => setEthAmount((Math.floor(maxEth * 1e6) / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''))}
          disabled={pending || casinoBalance === 0n}
          className="text-[#00c74d]/55 hover:text-[#00c74d] text-xs transition-colors disabled:opacity-35"
        >
          Withdraw all
        </button>

        <button
          onClick={handleWithdraw}
          disabled={pending || casinoBalance === 0n}
          className="btn-outline w-full py-3 rounded-xl text-sm uppercase tracking-wider"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />{" "}
              {isConfirming ? "Confirming…" : "Confirm in wallet…"}
            </span>
          ) : (
            "Withdraw"
          )}
        </button>

        {txHash && (
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[#00c74d]/55 hover:text-[#00c74d] text-xs transition-colors"
          >
            View on Etherscan ↗
          </a>
        )}
      </div>
    </Modal>
  );
}

// ── Withdraw ALL button (direct, no modal, no amount validation) ──
function WithdrawAllButton({
  contractConfig,
  amount,
  onSuccess,
}: {
  contractConfig: typeof CONTRACT_V2_CONFIG | typeof SLOTS_CONFIG;
  amount: bigint;
  onSuccess: () => void;
}) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  React.useEffect(() => {
    if (isSuccess) { toast.success("Withdrawal confirmed!"); onSuccess(); }
  }, [isSuccess, onSuccess]);

  const handleWithdrawAll = () => {
    const id = toast.loading("Confirm in wallet…");
    writeContract(
      { ...(contractConfig as typeof CONTRACT_V2_CONFIG), functionName: "withdraw", args: [amount] },
      {
        onSuccess: hash => { toast.dismiss(id); toast.loading("Withdrawing…", { id: hash }); },
        onError: err => { toast.dismiss(id); toast.error(err.message.includes("User rejected") ? "Cancelled" : "Withdraw failed"); },
      }
    );
  };

  const pending = isPending || isConfirming;
  const ethStr = parseFloat(formatEther(amount)).toFixed(4);

  return (
    <button
      onClick={handleWithdrawAll}
      disabled={pending}
      className="w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
    >
      {pending
        ? <span className="flex items-center justify-center gap-2"><span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Withdrawing…</span>
        : `Withdraw all ${ethStr} ETH`}
    </button>
  );
}

// ── Legacy contract addresses (old balances) ─────────────────────
const LEGACY = [
  { label: "CasinoV2", address: "0x846a27b62bbcdc40E09496E15d11095B48DE9caA" as `0x${string}` },
  { label: "SlotsGame", address: "0xF037dd67e461BD331Ee363217b0806677D995c45" as `0x${string}` },
];
const LEGACY_ABI = [
  { name: "withdraw",  type: "function", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { name: "balanceOf", type: "function", inputs: [{ name: "p", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;

function LegacyWithdraw({ label, contractAddress, player }: { label: string; contractAddress: `0x${string}`; player: `0x${string}` }) {
  const { data: bal = 0n, refetch } = useReadContract({
    address: contractAddress, abi: LEGACY_ABI, functionName: "balanceOf", args: [player],
    query: { enabled: !!player, refetchInterval: 5000 },
  });
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  React.useEffect(() => {
    if (isSuccess) { toast.success(`Withdrawn from ${label}!`); refetch(); }
  }, [isSuccess, label, refetch]);

  if ((bal as bigint) === 0n) return null;

  const ethStr = parseFloat(formatEther(bal as bigint)).toFixed(4);
  const pending = isPending || isConfirming;

  const doWithdraw = () => {
    const id = toast.loading(`Withdrawing from ${label}…`);
    writeContract(
      { address: contractAddress, abi: LEGACY_ABI, functionName: "withdraw", args: [bal as bigint] },
      {
        onSuccess: hash => { toast.dismiss(id); toast.loading("Confirming…", { id: hash }); },
        onError: err => { toast.dismiss(id); toast.error(err.message.includes("User rejected") ? "Cancelled" : "Failed"); },
      }
    );
  };

  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
      style={{ background: "rgba(240,185,11,0.08)", border: "1px solid rgba(240,185,11,0.25)" }}>
      <div>
        <p className="text-[#f0b90b] text-[10px] font-semibold uppercase tracking-wider">Old: {label}</p>
        <p className="text-white/70 text-xs font-mono">{ethStr} ETH</p>
      </div>
      <button onClick={doWithdraw} disabled={pending}
        className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-50 transition-all"
        style={{ background: "rgba(240,185,11,0.2)", border: "1px solid rgba(240,185,11,0.5)", color: "#f0b90b" }}>
        {pending ? "…" : "Withdraw ↗"}
      </button>
    </div>
  );
}

// ── Main BalanceCard ──────────────────────────────────────────────
export function BalanceCard({ game }: { game?: string }) {
  const { address } = useAccount();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // All games use the same CasinoAll contract
  const activeConfig = CONTRACT_V2_CONFIG;
  const gameLabel = "🎮 Games";
  const accentColor = "#00c74d";
  const accentBg = "rgba(0,199,77,0.08)";
  const accentBorder = "rgba(0,199,77,0.15)";

  const { data: walletBalance } = useBalance({ address });

  const { data: casinoBalance = 0n, refetch: refetchBalance } =
    useReadContract({
      ...(activeConfig as typeof CONTRACT_V2_CONFIG),
      functionName: "balanceOf",
      args: [address!],
      query: { enabled: !!address, refetchInterval: 60_000 },
    });

  const { data: contractBalance = 0n } = useReadContract({
    ...(activeConfig as typeof CONTRACT_V2_CONFIG),
    functionName: "contractBalance",
    query: { refetchInterval: 60_000 },
  });

  const handleSuccess = useCallback(() => {
    refetchBalance();
    setRefreshKey((k) => k + 1);
  }, [refetchBalance]);

  const casinoEth = formatEth(casinoBalance as bigint);
  const contractEth = formatEth(contractBalance as bigint);
  const walletEth = walletBalance
    ? parseFloat(formatEther(walletBalance.value)).toFixed(4)
    : "—";

  return (
    <>
      <div className="glass-card rounded-2xl p-5 h-full flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accentBg, border: `1px solid ${accentBorder}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-white text-base leading-none">My Balance</h2>
              <p className="text-[10px] mt-0.5" style={{ color: accentColor + "99" }}>{gameLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor, animation: "pulseGlow 2s ease-in-out infinite" }} />
            Live
          </div>
        </div>

        {/* Casino balance */}
        <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg,${accentBg} 0%,transparent 100%)`, border: `1px solid ${accentBorder}` }}>
          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: accentColor + "99" }}>Casino Balance</p>
          <p className="font-display font-black text-4xl leading-none" style={{ color: accentColor }}>
            {casinoEth}
            <span className="text-lg font-normal ml-1.5" style={{ color: accentColor + "88" }}>ETH</span>
          </p>
          <p className="text-xs mt-1" style={{ color: accentColor + "55" }}>Available for bets</p>
        </div>

        {/* Legacy balances — old contracts */}
        {address && LEGACY.map(lg => (
          <LegacyWithdraw key={lg.address} label={lg.label} contractAddress={lg.address} player={address} />
        ))}

        {/* Wallet + house float */}
        <div className="flex gap-3">
          <MiniStat label="Your Wallet" value={`${walletEth} ETH`} valueColor="text-[#f0b90b]" />
          <MiniStat label="Casino Pool" value={`${contractEth} ETH`} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-auto">
          <button onClick={() => setShowDeposit(true)} className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide">
            Deposit
          </button>
          <button onClick={() => setShowWithdraw(true)} disabled={(casinoBalance as bigint) === 0n} className="btn-outline flex-1 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-wide">
            Withdraw
          </button>
        </div>

        {/* Withdraw ALL — bypasses modal amount validation */}
        {(casinoBalance as bigint) > 0n && (
          <WithdrawAllButton
            contractConfig={activeConfig}
            amount={casinoBalance as bigint}
            onSuccess={handleSuccess}
          />
        )}

        <p className="text-white/20 text-[11px] text-center leading-relaxed">
          Deposit ETH to start playing. Winnings credited instantly.
        </p>
      </div>

      {showDeposit && (
        <DepositModal contractConfig={activeConfig} onClose={() => setShowDeposit(false)} onSuccess={handleSuccess} />
      )}
      {showWithdraw && (
        <WithdrawModal contractConfig={activeConfig} casinoBalance={casinoBalance as bigint} onClose={() => setShowWithdraw(false)} onSuccess={handleSuccess} />
      )}
    </>
  );
}
