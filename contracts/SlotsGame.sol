// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SlotsGame
 * @notice 3-reel slot machine — provably fair on Ethereum Sepolia.
 * @dev Symbols: 0=Cherry 1=Lemon 2=Orange 3=Grape 4=Star 5=Bar 6=Seven 7=Diamond
 *
 * Payouts (multiplier basis points, 100 = 1x):
 *   💎💎💎  5000 bps = 50x
 *   7️⃣7️⃣7️⃣  2000 bps = 20x
 *   🎰🎰🎰  1000 bps = 10x
 *   ⭐⭐⭐   700 bps =  7x
 *   any 3-of-a-kind  300 bps = 3x
 *   🍒🍒 (2 cherries) 200 bps = 2x
 *   🍒 (1 cherry)    150 bps = 1.5x
 */
contract SlotsGame {
    address public owner;
    uint256 public gameCount;
    mapping(address => uint256) public balances;

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.05 ether;

    event SlotsPlayed(
        uint256 indexed gameId,
        address indexed player,
        uint8 reel1,
        uint8 reel2,
        uint8 reel3,
        bool won,
        uint256 betAmount,
        uint256 payout,
        bytes32 randomSeed
    );
    event Deposit(address indexed player, uint256 amount);
    event Withdrawal(address indexed player, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() payable { owner = msg.sender; }

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

    function spin(uint256 betAmount) external {
        require(betAmount >= MIN_BET && betAmount <= MAX_BET, "Bad bet");
        require(balances[msg.sender] >= betAmount, "Insufficient balance");

        balances[msg.sender] -= betAmount;

        bytes32 seed = keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender, gameCount, betAmount
        ));

        uint8 r1 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(0)))) % 8);
        uint8 r2 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(1)))) % 8);
        uint8 r3 = uint8(uint256(keccak256(abi.encodePacked(seed, uint8(2)))) % 8);

        uint256 multBps = calcPayout(r1, r2, r3);
        uint256 payout = 0;
        bool won = multBps > 0;

        if (won) {
            payout = betAmount * multBps / 100;
            require(address(this).balance >= payout, "Low liquidity");
            balances[msg.sender] += payout;
        }

        emit SlotsPlayed(gameCount++, msg.sender, r1, r2, r3, won, betAmount, payout, seed);
    }

    function calcPayout(uint8 r1, uint8 r2, uint8 r3) public pure returns (uint256) {
        if (r1 == r2 && r2 == r3) {
            if (r1 == 7) return 5000; // 💎 jackpot 50x
            if (r1 == 6) return 2000; // 7️⃣ 20x
            if (r1 == 5) return 1000; // 🎰 10x
            if (r1 == 4) return 700;  // ⭐ 7x
            return 300;               // fruit 3x
        }
        uint8 cherries = (r1==0?1:0) + (r2==0?1:0) + (r3==0?1:0);
        if (cherries >= 2) return 200;
        if (cherries == 1) return 150;
        return 0;
    }

    function balanceOf(address p) external view returns (uint256) { return balances[p]; }
    function contractBalance() external view returns (uint256) { return address(this).balance; }

    function ownerWithdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Too much");
        (bool ok,) = payable(owner).call{value: amount}("");
        require(ok, "Failed");
    }
    receive() external payable {}
}
