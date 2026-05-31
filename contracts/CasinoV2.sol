// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CasinoV2
 * @notice Provably fair multi-game casino: Coin Flip, Dice, and Limbo.
 *         Educational / demo project on Ethereum Sepolia — no real money.
 *
 * @dev Randomness formula (same for all games):
 *      keccak256(block.prevrandao, block.timestamp, msg.sender, gameCount, betAmount)
 *      All inputs are observable on-chain and independently verifiable.
 *
 *      House edge: 1% on Dice and Limbo, 2.5% on Coin Flip.
 */
contract CasinoV2 {
    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────

    address public owner;

    /// @notice Shared game counter across all three games.
    uint256 public gameCount;

    /// @notice Casino balance per player (in wei).
    mapping(address => uint256) public balances;

    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.1 ether;

    // Coin Flip: 1.95x payout (2.5% house edge)
    uint256 private constant FLIP_WIN_NUM = 195;
    uint256 private constant FLIP_WIN_DEN = 100;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    /// @notice Emitted for every Coin Flip.
    event GamePlayed(
        uint256 indexed gameId,
        address indexed player,
        uint8 choice,
        uint8 result,
        bool won,
        uint256 betAmount,
        uint256 payout,
        bytes32 randomSeed
    );

    /// @notice Emitted for every Dice roll.
    event DicePlayed(
        uint256 indexed gameId,
        address indexed player,
        uint8 target,
        bool isOver,
        uint8 roll,
        bool won,
        uint256 betAmount,
        uint256 payout,
        bytes32 randomSeed
    );

    /// @notice Emitted for every Limbo round.
    event LimboPlayed(
        uint256 indexed gameId,
        address indexed player,
        uint256 targetMultiplierBps,
        uint256 crashPoint,
        bool won,
        uint256 betAmount,
        uint256 payout,
        bytes32 randomSeed
    );

    event Deposit(address indexed player, uint256 amount);
    event Withdrawal(address indexed player, uint256 amount);
    event OwnerDeposit(address indexed owner, uint256 amount);

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────

    constructor() payable {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────────────────────
    // Player Deposit / Withdraw
    // ─────────────────────────────────────────────────────────────

    /// @notice Deposit ETH into your casino balance.
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Withdraw ETH from your casino balance back to your wallet.
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────
    // Game: Coin Flip
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Flip the coin.
     * @param choice    0 = Heads, 1 = Tails.
     * @param betAmount Amount in wei to wager (must be <= player balance).
     */
    function flip(uint8 choice, uint256 betAmount) external {
        require(choice == 0 || choice == 1, "Choice must be 0 or 1");
        require(betAmount >= MIN_BET, "Bet below minimum");
        require(betAmount <= MAX_BET, "Bet above maximum");
        require(balances[msg.sender] >= betAmount, "Insufficient casino balance");

        uint256 maxPayout = (betAmount * FLIP_WIN_NUM) / FLIP_WIN_DEN;
        require(address(this).balance >= maxPayout, "Low liquidity");

        balances[msg.sender] -= betAmount;

        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                gameCount,
                betAmount
            )
        );

        uint8 result = uint8(uint256(seed) % 2);
        bool won = (result == choice);
        uint256 payout = 0;

        if (won) {
            payout = maxPayout;
            balances[msg.sender] += payout;
        }

        uint256 currentGameId = gameCount;
        gameCount++;

        emit GamePlayed(currentGameId, msg.sender, choice, result, won, betAmount, payout, seed);
    }

    // ─────────────────────────────────────────────────────────────
    // Game: Dice
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Roll the dice.
     * @param target    The pivot number (2–98).
     * @param isOver    True = player bets roll > target; False = roll < target.
     * @param betAmount Amount in wei to wager.
     *
     * Roll: 1–100.
     * Win probability (bps): isOver ? (100-target)*100 : (target-1)*100
     * Payout = betAmount * 9900 / winProbabilityBps  (1% house edge)
     */
    function dice(uint8 target, bool isOver, uint256 betAmount) external {
        require(target >= 2 && target <= 98, "Target must be 2-98");
        require(betAmount >= MIN_BET, "Bet below minimum");
        require(betAmount <= MAX_BET, "Bet above maximum");
        require(balances[msg.sender] >= betAmount, "Insufficient casino balance");

        // Win probability in basis points (1 bps = 0.01%)
        uint256 winProbabilityBps = isOver
            ? uint256(100 - target) * 100
            : uint256(target - 1) * 100;
        require(winProbabilityBps > 0, "Zero win probability");

        // Max payout: betAmount * 9900 / winProbabilityBps  (1% house edge, 9900 = 99*100)
        uint256 maxPayout = (betAmount * 9900) / winProbabilityBps;
        require(address(this).balance >= maxPayout, "Low liquidity");

        balances[msg.sender] -= betAmount;

        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                gameCount,
                betAmount
            )
        );

        // Roll gives 1–100
        uint8 roll = uint8(uint256(seed) % 100) + 1;
        bool won = isOver ? roll > target : roll < target;
        uint256 payout = 0;

        if (won) {
            payout = maxPayout;
            balances[msg.sender] += payout;
        }

        uint256 currentGameId = gameCount;
        gameCount++;

        emit DicePlayed(currentGameId, msg.sender, target, isOver, roll, won, betAmount, payout, seed);
    }

    // ─────────────────────────────────────────────────────────────
    // Game: Limbo
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Play Limbo.
     * @param targetMultiplierBps  Target multiplier in basis points (100 = 1.00x).
     *                             Range: 101 (1.01x) to 990000 (9900x).
     * @param betAmount            Amount in wei to wager.
     *
     * crashPoint = 9900 * 100 / (seed % 9900 + 1)  → 100 to ~990000 bps
     * Win: crashPoint >= targetMultiplierBps
     * Payout = betAmount * targetMultiplierBps / 100
     */
    function limbo(uint256 targetMultiplierBps, uint256 betAmount) external {
        require(targetMultiplierBps >= 101 && targetMultiplierBps <= 990000, "Multiplier out of range");
        require(betAmount >= MIN_BET, "Bet below minimum");
        require(betAmount <= MAX_BET, "Bet above maximum");
        require(balances[msg.sender] >= betAmount, "Insufficient casino balance");

        uint256 maxPayout = (betAmount * targetMultiplierBps) / 100;
        require(address(this).balance >= maxPayout, "Low liquidity");

        balances[msg.sender] -= betAmount;

        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                gameCount,
                betAmount
            )
        );

        // crashPoint in basis points: 100 (1.00x) to ~990000 (9900.00x)
        uint256 crashPoint = (9900 * 100) / (uint256(seed) % 9900 + 1);
        bool won = crashPoint >= targetMultiplierBps;
        uint256 payout = 0;

        if (won) {
            payout = maxPayout;
            balances[msg.sender] += payout;
        }

        uint256 currentGameId = gameCount;
        gameCount++;

        emit LimboPlayed(currentGameId, msg.sender, targetMultiplierBps, crashPoint, won, betAmount, payout, seed);
    }

    // ─────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────

    /// @notice Returns the casino balance for a player.
    function balanceOf(address player) external view returns (uint256) {
        return balances[player];
    }

    /// @notice Returns the total ETH held in the contract.
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─────────────────────────────────────────────────────────────
    // Owner Functions
    // ─────────────────────────────────────────────────────────────

    /// @notice Owner adds liquidity to the house float.
    function ownerDeposit() external payable onlyOwner {
        require(msg.value > 0, "Must send ETH");
        emit OwnerDeposit(msg.sender, msg.value);
    }

    /// @notice Owner withdraws from the contract.
    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Amount exceeds contract balance");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /// @notice Accept direct ETH transfers (house float top-up).
    receive() external payable {}
}
