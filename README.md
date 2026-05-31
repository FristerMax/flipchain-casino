# FlipChain Casino 🎰

> Provably fair on-chain casino on Ethereum Sepolia testnet.  
> Built in 48 hours · 3 games · 2 smart contracts · Zero real money.

## 🔗 Links

| | |
|---|---|
| **Live URL** | https://chainbet-casino.surge.sh |
| **CasinoFlip contract** | [0xd80512F239663157F89107A555d3437eCd1fB067](https://sepolia.etherscan.io/address/0xd80512F239663157F89107A555d3437eCd1fB067) |
| **CasinoV2 contract** | [0x846a27b62bbcdc40E09496E15d11095B48DE9caA](https://sepolia.etherscan.io/address/0x846a27b62bbcdc40E09496E15d11095B48DE9caA) |
| **Network** | Ethereum Sepolia (chainId 11155111) |

---

## ✅ What Works

- **Wallet connection** — MetaMask via RainbowKit, Sepolia testnet
- **Deposit** — Send Sepolia ETH to your casino balance on-chain
- **3 Games** — Coin Flip, Dice (1–100), Limbo (1.01×–9900×)
- **Withdraw** — Pull your balance back to MetaMask anytime
- **Provably fair** — Every result verifiable on Etherscan
- **Sound effects** — Web Audio API, no files needed
- **Mobile** — Works inside MetaMask in-app browser

---

## 🎮 Games

### 🪙 Coin Flip
Pick Heads or Tails. Win pays **1.95×** (house edge 2.5%).

### 🎲 Dice
Choose a number 2–98, bet Over or Under.  
- Higher probability = lower multiplier  
- Example: Under 50 → 49% chance → **2.02×**  
- Example: Under 10 → 9% chance → **11×**  
House edge: **1%**

### ⚡ Limbo
Set a target multiplier (1.01× to 9900×).  
A random crash point is generated — if it lands at or above your target, you win.  
- 2× target → ~50% win chance  
- 100× target → ~1% win chance  
House edge: **1%**

---

## 🔐 Provably Fair System

Every game uses the same on-chain randomness formula:

```solidity
bytes32 seed = keccak256(abi.encodePacked(
    block.prevrandao,   // Ethereum Beacon Chain RANDAO value
    block.timestamp,    // Block timestamp
    msg.sender,         // Player address
    gameCount,          // Monotonically increasing game index
    betAmount           // Bet in wei
));
```

**All 5 inputs are visible on Etherscan.** Any player can independently verify any result:

```js
import { keccak256, encodePacked } from "viem";

const seed = keccak256(encodePacked(
  ["uint256", "uint256", "address", "uint256", "uint256"],
  [prevrandao, timestamp, playerAddress, gameCountBefore, betAmountWei]
));

// Coin Flip: result = BigInt(seed) % 2n  (0 = Heads, 1 = Tails)
// Dice:      roll   = BigInt(seed) % 100n + 1n  (1–100)
// Limbo:     crash  = 990000n / (BigInt(seed) % 9900n + 1n)  (in bps)
```

### Limitation
`block.prevrandao` gives validators theoretical 1-bit influence (they can skip proposing). For production high-stakes use, Chainlink VRF is the right choice. For testnet play this is perfectly adequate.

---

## 🏗️ Architecture

```
Frontend (Next.js 14)
├── RainbowKit + wagmi v2 + viem
├── Tailwind CSS (Stake.com dark design)
├── Web Audio API (procedural sounds)
└── Deployed: Surge.sh

Smart Contracts (Solidity 0.8.24)
├── CasinoFlip.sol — Coin Flip only (v1)
└── CasinoV2.sol  — Coin Flip + Dice + Limbo (v2)
    Deployed: Ethereum Sepolia
    Verified: Sourcify + Blockscout
```

---

## ❓ Why Ethereum over Solana

1. **Tooling maturity** — Remix IDE, ethers.js, wagmi are battle-tested
2. **RainbowKit** — Handles wallet UX beautifully, works on mobile via MetaMask deep links
3. **EIP-4399 PREVRANDAO** — Beacon chain randomness is built-in, no oracle needed for testnet
4. **Etherscan** — Best-in-class block explorer for verifying provable fairness

---

## 🧗 Hardest Thing to Figure Out

**Mobile wallet connection.** WalletConnect requires a paid project ID; using `"demo"` causes connection errors. The fix: add a `🦊 Open in MetaMask App` deep link button (`metamask.app.link/dapp/...`) that opens the site directly inside MetaMask's in-app browser — zero WalletConnect required, works perfectly.

**CORS on public RPC.** The site served over `http://` was blocked from calling `rpc.sepolia.org`. Fix: force HTTPS + switch to a multi-RPC fallback (`publicnode.com`, `drpc.org`, `rpc2.sepolia.org`).

---

## 🚀 What's Next

- [ ] Crash/Aviator game (most viral crypto casino game)
- [ ] Plinko with visual ball-drop animation
- [ ] Chainlink VRF for production-grade randomness
- [ ] Game history leaderboard (read from events)
- [ ] Real WalletConnect project ID for full mobile support
- [ ] GitHub Actions CI/CD → auto-deploy on push

---

## 🤖 AI Tools Used

Built entirely with **Claude (Anthropic)** as the primary development partner.

**What worked brilliantly:**
- Writing complete Solidity contracts from scratch in seconds
- Generating all Web Audio API sound logic (no audio files needed)
- Debugging the RainbowKit mobile connection flow
- Redesigning the full UI from scratch (Stake.com dark style) in one pass

**What didn't work / needed human input:**
- Actually deploying contracts required manual Remix steps (Captcha on faucets, browser wallet interaction)
- WalletConnect OAuth registration needed browser access
- Recording the Loom video 😄

**Workflow:** describe what to build → AI writes complete code → deploy → test → iterate. Entire 48h sprint was essentially pair-programming with Claude.

---

## 🔧 Local Development

```bash
git clone <repo>
cd casino-flip/frontend

cp .env.example .env.local
# Fill in:
# NEXT_PUBLIC_CONTRACT_ADDRESS=0xd80512F239663157F89107A555d3437eCd1fB067
# NEXT_PUBLIC_CONTRACT_V2_ADDRESS=0x846a27b62bbcdc40E09496E15d11095B48DE9caA

npm install
npm run dev
# → http://localhost:3000
```

### Deploy your own contracts

1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Paste `contracts/CasinoV2.sol`
3. Compile with Solidity 0.8.24
4. Deploy to Sepolia with MetaMask (VALUE = 0.02 ETH)
5. Update `NEXT_PUBLIC_CONTRACT_V2_ADDRESS` in `.env.local`

### Get Sepolia ETH (free)

- https://cloud.google.com/application/web3/faucet/ethereum/sepolia (Google account)
- https://sepoliafaucet.com (Alchemy account)

---

*Educational demo — no real ETH involved.*
