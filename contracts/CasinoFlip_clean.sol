// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CasinoFlip {
    address public owner;
    uint256 public gameCount;
    mapping(address => uint256) public balances;
    uint256 private constant WIN_NUM = 195;
    uint256 private constant WIN_DEN = 100;
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.1 ether;

    event GamePlayed(uint256 indexed gameId, address indexed player, uint8 choice, uint8 result, bool won, uint256 betAmount, uint256 payout, bytes32 randomSeed);
    event Deposit(address indexed player, uint256 amount);
    event Withdrawal(address indexed player, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() payable {
        owner = msg.sender;
    }

    function deposit() external payable {
        require(msg.value > 0, "Send ETH");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Zero");
        require(balances[msg.sender] >= amount, "Low balance");
        balances[msg.sender] -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Failed");
        emit Withdrawal(msg.sender, amount);
    }

    function flip(uint8 choice, uint256 betAmount) external {
        require(choice < 2, "Bad choice");
        require(betAmount >= MIN_BET, "Too small");
        require(betAmount <= MAX_BET, "Too big");
        require(balances[msg.sender] >= betAmount, "Low balance");
        uint256 maxPayout = betAmount * WIN_NUM / WIN_DEN;
        require(address(this).balance >= maxPayout, "Low liquidity");
        balances[msg.sender] -= betAmount;
        bytes32 seed = keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender, gameCount, betAmount));
        uint8 result = uint8(uint256(seed) % 2);
        bool won = result == choice;
        uint256 payout = 0;
        if (won) {
            payout = maxPayout;
            balances[msg.sender] += payout;
        }
        emit GamePlayed(gameCount++, msg.sender, choice, result, won, betAmount, payout, seed);
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
