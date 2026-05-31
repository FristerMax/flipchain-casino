// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CasinoAll
 * @notice All 4 games in one contract with a shared balance.
 *         Coin Flip + Dice + Crash/Limbo + Slots
 *         Educational demo on Ethereum Sepolia — no real money.
 */
contract CasinoAll {
    address public owner;
    uint256 public gameCount;
    mapping(address => uint256) public balances;

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.1 ether;

    // ── Events ────────────────────────────────────────────────────
    event GamePlayed(uint256 indexed gameId, address indexed player, uint8 choice, uint8 result, bool won, uint256 betAmount, uint256 payout, bytes32 randomSeed);
    event DicePlayed(uint256 indexed gameId, address indexed player, uint8 target, bool isOver, uint8 roll, bool won, uint256 betAmount, uint256 payout, bytes32 randomSeed);
    event LimboPlayed(uint256 indexed gameId, address indexed player, uint256 targetMultiplierBps, uint256 crashPoint, bool won, uint256 betAmount, uint256 payout, bytes32 randomSeed);
    event SlotsPlayed(uint256 indexed gameId, address indexed player, uint8 reel1, uint8 reel2, uint8 reel3, bool won, uint256 betAmount, uint256 payout, bytes32 randomSeed);
    event Deposit(address indexed player, uint256 amount);
    event Withdrawal(address indexed player, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    constructor() payable { owner = msg.sender; }

    // ── Deposit / Withdraw ────────────────────────────────────────
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0 && balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Failed");
        emit Withdrawal(msg.sender, amount);
    }

    // ── Coin Flip (2.5% edge, 1.95x) ─────────────────────────────
    function flip(uint8 choice, uint256 betAmount) external {
        require(choice < 2, "Bad choice");
        _checkBet(betAmount);
        balances[msg.sender] -= betAmount;
        bytes32 seed = _seed(betAmount);
        uint8 result = uint8(uint256(seed) % 2);
        bool won = result == choice;
        uint256 payout = won ? betAmount * 195 / 100 : 0;
        if (won) { require(address(this).balance >= payout, "Low liquidity"); balances[msg.sender] += payout; }
        emit GamePlayed(gameCount++, msg.sender, choice, result, won, betAmount, payout, seed);
    }

    // ── Dice (1% edge) ────────────────────────────────────────────
    function dice(uint8 target, bool isOver, uint256 betAmount) external {
        require(target >= 2 && target <= 98, "Bad target");
        _checkBet(betAmount);
        balances[msg.sender] -= betAmount;
        bytes32 seed = _seed(betAmount);
        uint8 roll = uint8(uint256(seed) % 100) + 1;
        bool won = isOver ? roll > target : roll < target;
        uint256 prob = isOver ? uint256(100 - target) * 100 : uint256(target - 1) * 100;
        uint256 payout = won ? betAmount * 9900 / prob : 0;
        if (won) { require(address(this).balance >= payout, "Low liquidity"); balances[msg.sender] += payout; }
        emit DicePlayed(gameCount++, msg.sender, target, isOver, roll, won, betAmount, payout, seed);
    }

    // ── Crash / Limbo (1% edge) ───────────────────────────────────
    function limbo(uint256 targetBps, uint256 betAmount) external {
        require(targetBps >= 101 && targetBps <= 990000, "Bad multiplier");
        _checkBet(betAmount);
        balances[msg.sender] -= betAmount;
        bytes32 seed = _seed(betAmount);
        uint256 crashPoint = 990000 / (uint256(seed) % 9900 + 1);
        bool won = crashPoint >= targetBps;
        uint256 payout = won ? betAmount * targetBps / 100 : 0;
        if (won) { require(address(this).balance >= payout, "Low liquidity"); balances[msg.sender] += payout; }
        emit LimboPlayed(gameCount++, msg.sender, targetBps, crashPoint, won, betAmount, payout, seed);
    }

    // ── Slots (8 symbols, various payouts) ───────────────────────
    // 0=Cherry 1=Lemon 2=Orange 3=Grape 4=Star 5=Bar 6=Seven 7=Diamond
    function spin(uint256 betAmount) external {
        require(betAmount >= MIN_BET && betAmount <= 0.05 ether, "Bad bet");
        require(balances[msg.sender] >= betAmount, "Insufficient balance");
        balances[msg.sender] -= betAmount;
        bytes32 seed = _seed(betAmount);
        uint8 r1 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(0)))) % 8);
        uint8 r2 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(1)))) % 8);
        uint8 r3 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(2)))) % 8);
        uint256 multBps = _slotPayout(r1, r2, r3);
        bool won = multBps > 0;
        uint256 payout = won ? betAmount * multBps / 100 : 0;
        if (won) { require(address(this).balance >= payout, "Low liquidity"); balances[msg.sender] += payout; }
        emit SlotsPlayed(gameCount++, msg.sender, r1, r2, r3, won, betAmount, payout, seed);
    }

    // ── View helpers ──────────────────────────────────────────────
    function balanceOf(address p) external view returns (uint256) { return balances[p]; }
    function contractBalance() external view returns (uint256) { return address(this).balance; }

    // ── Owner ─────────────────────────────────────────────────────
    function ownerWithdraw(uint256 amount) external onlyOwner {
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Failed");
    }
    receive() external payable {}

    // ── Internal ──────────────────────────────────────────────────
    function _seed(uint256 betAmount) internal returns (bytes32) {
        return keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender, gameCount, betAmount));
    }

    function _checkBet(uint256 betAmount) internal view {
        require(betAmount >= MIN_BET && betAmount <= MAX_BET, "Bad bet");
        require(balances[msg.sender] >= betAmount, "Insufficient balance");
        require(address(this).balance >= betAmount * 2, "Low liquidity");
    }

    function _slotPayout(uint8 r1, uint8 r2, uint8 r3) internal pure returns (uint256) {
        if (r1 == r2 && r2 == r3) {
            if (r1 == 7) return 5000;
            if (r1 == 6) return 2000;
            if (r1 == 5) return 1000;
            if (r1 == 4) return 700;
            return 300;
        }
        uint8 c = (r1==0?1:0) + (r2==0?1:0) + (r3==0?1:0);
        if (c >= 2) return 200;
        if (c == 1) return 150;
        return 0;
    }
}
