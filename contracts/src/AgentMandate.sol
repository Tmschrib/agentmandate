// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPermit2} from "./IPermit2.sol";

contract AgentMandate {
    using SafeERC20 for IERC20;

    struct MandateData {
        address agent;
        address[] allowedTokens;
        uint256 maxAmountPerSwap;
        uint256 maxDailyVolumeUSDC;
        uint256 maxSlippageBps;
        bool active;
    }

    error NotOwner();
    error NotAgent();
    error MandateInactive();
    error TokenNotAllowed(address token);
    error ExceedsPerSwapLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 newTotal, uint256 limit);
    error SwapCallFailed();
    error InsufficientOutput();

    event MandateUpdated(address indexed agent);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed executor
    );

    address public owner;
    address public immutable USDC;
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    MandateData private _mandate;
    mapping(uint256 => uint256) public dailyVolume;

    constructor(address _usdc, address[] memory permit2Tokens) {
        owner = msg.sender;
        USDC = _usdc;
        for (uint256 i = 0; i < permit2Tokens.length; i++) {
            IERC20(permit2Tokens[i]).forceApprove(PERMIT2, type(uint256).max);
        }
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != _mandate.agent) revert NotAgent();
        _;
    }

    function setMandate(MandateData calldata mandate) external onlyOwner {
        _mandate = mandate;
        emit MandateUpdated(mandate.agent);
    }

    function getMandate() external view returns (MandateData memory) {
        return _mandate;
    }

    function getCurrentDay() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function pauseMandate() external onlyOwner {
        _mandate.active = false;
    }

    function resumeMandate() external onlyOwner {
        _mandate.active = true;
    }

    function deposit() external payable {}

    function withdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata uniswapCalldata,
        address uniswapRouter
    ) external onlyAgent {
        // 1. Active check
        if (!_mandate.active) revert MandateInactive();

        // 2. Token allowlist
        if (!_isTokenAllowed(tokenIn)) revert TokenNotAllowed(tokenIn);
        if (!_isTokenAllowed(tokenOut)) revert TokenNotAllowed(tokenOut);

        // 3. Per-swap limit
        if (amountIn > _mandate.maxAmountPerSwap) {
            revert ExceedsPerSwapLimit(amountIn, _mandate.maxAmountPerSwap);
        }

        // 4. Daily volume (USDC outflows only)
        if (tokenIn == USDC) {
            uint256 today = getCurrentDay();
            uint256 newTotal = dailyVolume[today] + amountIn;
            if (newTotal > _mandate.maxDailyVolumeUSDC) {
                revert ExceedsDailyLimit(newTotal, _mandate.maxDailyVolumeUSDC);
            }
            dailyVolume[today] = newTotal;
        }

        // 5. Permit2 authorization
        IPermit2(PERMIT2).approve(
            tokenIn,
            uniswapRouter,
            uint160(amountIn),
            uint48(block.timestamp + 1 hours)
        );

        // 6-7. Execute swap
        uint256 balBefore = IERC20(tokenOut).balanceOf(address(this));
        (bool success,) = uniswapRouter.call(uniswapCalldata);
        if (!success) revert SwapCallFailed();
        uint256 balAfter = IERC20(tokenOut).balanceOf(address(this));

        // 8. Output check
        uint256 amountOut = balAfter - balBefore;
        if (amountOut < minAmountOut) revert InsufficientOutput();

        // 9. Emit
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut, msg.sender);
    }

    function _isTokenAllowed(address token) internal view returns (bool) {
        address[] memory tokens = _mandate.allowedTokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == token) return true;
        }
        return false;
    }

    receive() external payable {}
}
