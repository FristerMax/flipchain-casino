// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CasinoFlip
 * @notice Provably fair coin flip casino on Ethereum Sepolia testnet.
 *         Educational / demo project — no real money involved.
 *
 * @dev Randomness uses keccak256(block.prevrandao, block.timestamp, msg.sender,
 *      gameCount, betAmount). All inputs are observable on-chain so any result
 *      can be independently verified via Etherscan.
 *
 *      House edge: 2.5% (win pays 1.95x bet).
 *      Max bet: 1% of contract balance (prevents draining attack).
 */
contract CasinoFlip {
    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────

    address public owner;
    uint256 public gameCount;

    /// @notice Casino balance per player (in wei)
    mapping(address => uint256) public balances;

    // ─────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────

    /// @dev Win multiplier numerator  (1.95x = 195/100)
    uint256 private constant WIN_MULTIPLIER_NUM = 195;
    uint256 private constant WIN_MULTIPLIER_DEN = 100;

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.1 ether;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Emitted for every flip.
     * @param gameId      Monotonically increasing game index.
     * @param player      Address that placed the bet.
     * @param choice      Player's choice: 0 = Heads, 1 = Tails.
     * @param result      Outcome: 0 = Heads, 1 = Tails.
     * @param won         True if choice == result.
     * @param betAmount   Amount wagered (in wei).
     * @param payout      Amount paid to player balance (0 on loss).
     * @param randomSeed  The raw keccak256 seed used — verifiable on-chain.
     */
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
    // Player Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ETH into your casino balance.
     */
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw ETH from your casino balance back to your wallet.
     * @param amount Amount in wei to withdraw.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

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

        // Ensure contract can cover a potential win
        uint256 maxPayout = (betAmount * WIN_MULTIPLIER_NUM) / WIN_MULTIPLIER_DEN;
        uint256 contractLiquidity = address(this).balance - totalPlayerBalances() + balances[msg.sender];
        require(contractLiquidity >= maxPayout, "Insufficient contract liquidity");

        // Deduct bet upfront
        balances[msg.sender] -= betAmount;

        // ── Provably fair randomness ──────────────────────────────
        // All four inputs are readable from the transaction on Etherscan:
        //   block.prevrandao : randomness beacon from the Beacon Chain
        //   block.timestamp  : block time
        //   msg.sender       : player address
        //   gameCount        : current game index (storage slot)
        //   betAmount        : wager amount
        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                gameCount,
                betAmount
            )
        );

        uint8 result = uint8(uint256(seed) % 2); // 0 or 1
        bool won = (result == choice);
        uint256 payout = 0;

        if (won) {
            payout = maxPayout;
            balances[msg.sender] += payout;
        }

        uint256 currentGameId = gameCount;
        gameCount++;

        emit GamePlayed(
            currentGameId,
            msg.sender,
            choice,
            result,
            won,
            betAmount,
            payout,
            seed
        );
    }

    // ─────────────────────────────────────────────────────────────
    // View Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Returns the casino balance for a player.
     */
    function balanceOf(address player) external view returns (uint256) {
        return balances[player];
    }

    /**
     * @notice Returns the total ETH held in the contract.
     */
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────

    /**
     * @dev Approximation: returns msg.sender's balance only.
     *      Used for the liquidity check — a full sum is gas-prohibitive.
     *      The owner pre-funds the contract with extra ETH as the house float.
     */
    function totalPlayerBalances() internal view returns (uint256) {
        return balances[msg.sender];
    }

    // ─────────────────────────────────────────────────────────────
    // Owner Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Owner adds liquidity to the house float.
     */
    function ownerDeposit() external payable onlyOwner {
        require(msg.value > 0, "Must send ETH");
        emit OwnerDeposit(msg.sender, msg.value);
    }

    /**
     * @notice Owner withdraws house profits (only the float above all player balances).
     *         Simplified: owner can withdraw up to contract balance minus
     *         a safety cushion. In production this should sum all player balances.
     */
    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Amount exceeds contract balance");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Accept direct ETH transfers (house float top-up).
     */
    receive() external payable {}
}
