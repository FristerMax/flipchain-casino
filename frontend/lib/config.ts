import { http, createConfig, fallback } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, rainbowWallet, phantomWallet } from "@rainbow-me/rainbowkit/wallets";
import { CASINO_FLIP_ABI } from "./abi";
import { CASINO_V2_ABI } from "./abi_v2";

// ─────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────

/** Replace with your deployed contract address after Remix deploy */
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const CONTRACT_CONFIG = {
  address: CONTRACT_ADDRESS,
  abi: CASINO_FLIP_ABI,
} as const;

// ─────────────────────────────────────────────────────────────────
// CasinoV2 Contract (Dice + Limbo + Coin Flip combined)
// ─────────────────────────────────────────────────────────────────

export const CONTRACT_V2_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_V2_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

export const CONTRACT_V2_CONFIG = {
  address: CONTRACT_V2_ADDRESS,
  abi: CASINO_V2_ABI,
} as const;

// ─────────────────────────────────────────────────────────────────
// Chain
// ─────────────────────────────────────────────────────────────────

export const SUPPORTED_CHAIN = sepolia;
export const CHAIN_ID = sepolia.id; // 11155111

export const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

export function txUrl(hash: string): string {
  return `${ETHERSCAN_BASE}/tx/${hash}`;
}

export function addressUrl(addr: string): string {
  return `${ETHERSCAN_BASE}/address/${addr}`;
}

// ─────────────────────────────────────────────────────────────────
// Wagmi / RainbowKit config
// ─────────────────────────────────────────────────────────────────

const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo_project_id";

const connectors = connectorsForWallets(
  [{ groupName: "Wallets", wallets: [metaMaskWallet, phantomWallet, rainbowWallet] }],
  { appName: "FlipChain Casino", projectId: WALLETCONNECT_PROJECT_ID }
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      http("https://ethereum-sepolia-rpc.publicnode.com", { timeout: 4_000 }),
      http("https://rpc.ankr.com/eth_sepolia",           { timeout: 4_000 }),
      http("https://sepolia.drpc.org",                   { timeout: 4_000 }),
      http("https://eth-sepolia.public.blastapi.io",     { timeout: 4_000 }),
      http("https://rpc2.sepolia.org",                   { timeout: 4_000 }),
      http("https://sepolia.gateway.tenderly.co",        { timeout: 4_000 }),
    ], { retryCount: 2, retryDelay: 500 }),
  },
  ssr: true,
});

// ─────────────────────────────────────────────────────────────────
// Game helpers
// ─────────────────────────────────────────────────────────────────

export const MIN_BET_ETH = 0.001;
export const MAX_BET_ETH = 0.1;
export const BET_STEP = 0.001;

/** Format a bigint wei value to a readable ETH string */
/** Parse contract revert reason into user-friendly message */
export function txErrMsg(err: { message?: string }, fallback = "Transaction failed"): string {
  const m = err?.message ?? "";
  if (m.includes("User rejected") || m.includes("user rejected")) return "Cancelled";
  if (m.includes("insufficient funds")) return "Not enough ETH in wallet for gas";
  if (m.includes("Low liquidity") || m.includes("low liquidity")) return "Casino pool too low — reduce bet or multiplier";
  if (m.includes("Insufficient") || m.includes("insufficient")) return "Insufficient casino balance";
  if (m.includes("Bad bet") || m.includes("bad bet")) return "Invalid bet amount";
  if (m.includes("Bad multiplier")) return "Invalid multiplier";
  return fallback;
}

export function formatEth(wei: bigint, decimals = 4): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(decimals);
}

/** Parse an ETH float string to bigint wei */
export function parseEthToBigInt(eth: number): bigint {
  return BigInt(Math.round(eth * 1e18));
}

export type CoinSide = 0 | 1; // 0 = Орёл, 1 = Решка

export const COIN_LABELS: Record<CoinSide, string> = {
  0: "HEADS",
  1: "TAILS",
};
