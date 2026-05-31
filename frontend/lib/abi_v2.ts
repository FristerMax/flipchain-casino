/**
 * CasinoV2 contract ABI — generated from CasinoV2.sol
 * Covers all functions: deposit, withdraw, flip, dice, limbo,
 * balanceOf, contractBalance, gameCount, ownerDeposit, ownerWithdraw,
 * plus all events.
 */
export const CASINO_V2_ABI = [
  // ── Read ───────────────────────────────────────────────────────
  {
    inputs: [{ internalType: "address", name: "player", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "contractBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "gameCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_BET",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_BET",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Write ──────────────────────────────────────────────────────
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint8", name: "choice", type: "uint8" },
      { internalType: "uint256", name: "betAmount", type: "uint256" },
    ],
    name: "flip",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint8", name: "target", type: "uint8" },
      { internalType: "bool", name: "isOver", type: "bool" },
      { internalType: "uint256", name: "betAmount", type: "uint256" },
    ],
    name: "dice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "targetMultiplierBps", type: "uint256" },
      { internalType: "uint256", name: "betAmount", type: "uint256" },
    ],
    name: "limbo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "ownerDeposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "ownerWithdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // ── Events ─────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "gameId",     type: "uint256" },
      { indexed: true,  internalType: "address", name: "player",     type: "address" },
      { indexed: false, internalType: "uint8",   name: "choice",     type: "uint8"   },
      { indexed: false, internalType: "uint8",   name: "result",     type: "uint8"   },
      { indexed: false, internalType: "bool",    name: "won",        type: "bool"    },
      { indexed: false, internalType: "uint256", name: "betAmount",  type: "uint256" },
      { indexed: false, internalType: "uint256", name: "payout",     type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "randomSeed", type: "bytes32" },
    ],
    name: "GamePlayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "gameId",     type: "uint256" },
      { indexed: true,  internalType: "address", name: "player",     type: "address" },
      { indexed: false, internalType: "uint8",   name: "target",     type: "uint8"   },
      { indexed: false, internalType: "bool",    name: "isOver",     type: "bool"    },
      { indexed: false, internalType: "uint8",   name: "roll",       type: "uint8"   },
      { indexed: false, internalType: "bool",    name: "won",        type: "bool"    },
      { indexed: false, internalType: "uint256", name: "betAmount",  type: "uint256" },
      { indexed: false, internalType: "uint256", name: "payout",     type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "randomSeed", type: "bytes32" },
    ],
    name: "DicePlayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "uint256", name: "gameId",              type: "uint256" },
      { indexed: true,  internalType: "address", name: "player",              type: "address" },
      { indexed: false, internalType: "uint256", name: "targetMultiplierBps", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "crashPoint",          type: "uint256" },
      { indexed: false, internalType: "bool",    name: "won",                 type: "bool"    },
      { indexed: false, internalType: "uint256", name: "betAmount",           type: "uint256" },
      { indexed: false, internalType: "uint256", name: "payout",              type: "uint256" },
      { indexed: false, internalType: "bytes32", name: "randomSeed",          type: "bytes32" },
    ],
    name: "LimboPlayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "Withdrawal",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true,  internalType: "address", name: "owner",  type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "OwnerDeposit",
    type: "event",
  },
  // ── Fallback ───────────────────────────────────────────────────
  { stateMutability: "payable", type: "receive" },
] as const;

export type CasinoV2Abi = typeof CASINO_V2_ABI;
