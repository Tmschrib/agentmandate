// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockRouter {
    using SafeERC20 for IERC20;

    function mockSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    ) external {
        // Transfer tokenIn from caller (the AgentMandate contract) — not needed for Permit2 path
        // In the real flow, the router pulls via Permit2. For testing, we skip the pull.
        // Transfer tokenOut to recipient
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }
}
