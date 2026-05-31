# FlipChain Casino 🎰

> Provably fair on-chain casino on Ethereum Sepolia — every result lives on the blockchain.

**Live demo:** https://chainbet-casino.surge.sh  
**Contract:** [0xC3dc2f4f706f71120c944BE26D6f19100eB896a0](https://sepolia.etherscan.io/address/0xC3dc2f4f706f71120c944BE26D6f19100eB896a0)

---

## What Works

### ✅ Core Flow
1. **Connect wallet** — MetaMask or Phantom (Ethereum mode), switches to Sepolia automatically
2. **Deposit** — send Sepolia ETH into the casino contract via the Balance Card
3. **Play** — 4 fully on-chain games
4. **Withdraw** — pull your balance back to your wallet at any time

### 🎮 Games

| Game | Mechanics | House Edge | Max Payout |
|------|-----------|-----------|------------|
| **Coin Flip** | Pick Heads or Tails | 2.5% | 1.95× |
| **Dice** | Set a target (2–98), bet Over or Under | 1% | ~99× |
| **Crash** | Set an exit multiplier, rocket flies until it crashes | 1% | 9900× |
| **Slots** | 3 reels × 8 symbols, middle row wins | 1% | 50× |

### 🔍 Provably Fair Verification
Every bet emits a blockchain event with the player address, bet amount, payout, and random seed: `keccak256(block.prevrandao + player + gameCount)`. Anyone can verify any outcome on [Sepolia Etherscan](https://sepolia.etherscan.io/address/0xC3dc2f4f706f71120c944BE26D6f19100eB896a0#events).

---

## Known Limitations

- **Pool liquidity** — contract needs house float ETH. If pool runs dry, large wins revert with "House pool insufficient". UI warns you before betting.
- **Block times** — Sepolia confirms in ~12–15s. All animations wait for blockchain confirmation before showing results.
- **No WalletConnect** — removed due to Reown's paid plan. Mobile users: open in MetaMask's built-in browser.

---

## Why Ethereum

1. `block.prevrandao` (EIP-4399) gives clean on-chain randomness
2. wagmi v2 + viem + RainbowKit ecosystem is mature for 48h builds
3. Sepolia has the best free faucet + explorer coverage

---

## Hardest Problem: TX Timing vs Animation

Results arrive ~12s after bet. The challenge: animations must feel natural — coin stops *after* result, result toast appears *after* animation ends.

**Solution:** store blockchain result in a `ref` (not state). Animation reads the ref on every frame, stops when it reaches the result. Only after animation ends → toast shows. Crash game uses this most visibly — the rocket flies until it hits the randomly-determined crash point stored in the ref.

---

## What I'd Build Next

1. **Chainlink VRF** — replace `block.prevrandao` with stronger randomness
2. **Base Sepolia** — 2-second blocks for snappier UX
3. **Multiplayer** — shared pool, live bet feed, leaderboard

---

## How I Used AI Tools

**Worked well:**
- Full smart contract generation from spec (correct payout math + events on first compile)
- Game component scaffolding with iterative UX steering
- Debugging async timing: describing "result appears before animation ends" → ref-based solution
- SVG/CSS generation: neuropunk hero, mini guitar icons, circuit board patterns

**Required human judgment:**
- `coolMode` in RainbowKit fired confetti during wallet selection — caught only by manual testing
- Mobile coin flip: AI suggested CSS 3D `backface-visibility` which fails on Safari — rewrote to JS single-face approach
- Pool liquidity edge case: AI didn't catch that player's own deposit IS the contract's ETH — required reasoning about contract state

---

## Stack

```
Contract:   Solidity ^0.8.24 (Remix IDE → Sepolia)
Frontend:   Next.js 14 · wagmi v2 · viem · RainbowKit v2
Styling:    Tailwind CSS + Web Audio API (procedural sounds)
Hosting:    Surge.sh
```

## Local Setup

```bash
git clone https://github.com/FristerMax/flipchain-casino
cd flipchain-casino/frontend
npm install
cp .env.example .env.local
npm run dev
```
