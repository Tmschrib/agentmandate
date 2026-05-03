// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentMandate} from "../src/AgentMandate.sol";
import {MockRouter} from "./MockRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPermit2 {
    function approve(address, address, uint160, uint48) external {}
}

contract AgentMandateTest is Test {
    AgentMandate public mandate;
    MockRouter public router;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockPermit2 public permit2;

    address owner = address(this);
    address agent = address(0xA6E47);
    address notOwner = address(0xBAD);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC");
        weth = new MockERC20("WETH", "WETH");

        // Deploy mock Permit2 at the canonical address
        permit2 = new MockPermit2();
        vm.etch(0x000000000022D473030F116dDEE9F6B43aC78BA3, address(permit2).code);

        // Deploy AgentMandate
        address[] memory permit2Tokens = new address[](2);
        permit2Tokens[0] = address(usdc);
        permit2Tokens[1] = address(weth);
        mandate = new AgentMandate(address(usdc), permit2Tokens);

        // Deploy mock router
        router = new MockRouter();

        // Set up mandate
        address[] memory allowed = new address[](2);
        allowed[0] = address(usdc);
        allowed[1] = address(weth);

        AgentMandate.MandateData memory data = AgentMandate.MandateData({
            agent: agent,
            allowedTokens: allowed,
            maxAmountPerSwap: 50_000_000, // 50 USDC
            maxDailyVolumeUSDC: 200_000_000, // 200 USDC
            maxSlippageBps: 100,
            active: true
        });
        mandate.setMandate(data);

        // Fund the contract with USDC and the router with WETH
        usdc.mint(address(mandate), 1000_000_000); // 1000 USDC
        weth.mint(address(router), 100 ether); // 100 WETH for router to send back
    }

    function test_ownerCanSetMandate() public {
        address[] memory allowed = new address[](1);
        allowed[0] = address(usdc);

        AgentMandate.MandateData memory data = AgentMandate.MandateData({
            agent: address(0x123),
            allowedTokens: allowed,
            maxAmountPerSwap: 100_000_000,
            maxDailyVolumeUSDC: 500_000_000,
            maxSlippageBps: 50,
            active: true
        });
        mandate.setMandate(data);

        AgentMandate.MandateData memory result = mandate.getMandate();
        assertEq(result.agent, address(0x123));
        assertEq(result.maxAmountPerSwap, 100_000_000);
    }

    function test_nonOwnerCannotSetMandate() public {
        address[] memory allowed = new address[](1);
        allowed[0] = address(usdc);

        AgentMandate.MandateData memory data = AgentMandate.MandateData({
            agent: agent,
            allowedTokens: allowed,
            maxAmountPerSwap: 50_000_000,
            maxDailyVolumeUSDC: 200_000_000,
            maxSlippageBps: 100,
            active: true
        });

        vm.prank(notOwner);
        vm.expectRevert(AgentMandate.NotOwner.selector);
        mandate.setMandate(data);
    }

    function test_agentSuccessfulSwap() public {
        uint256 amountIn = 30_000_000; // 30 USDC
        uint256 amountOut = 0.01 ether;

        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), address(weth), amountIn, amountOut, address(mandate))
        );

        vm.prank(agent);
        mandate.executeSwap(
            address(usdc),
            address(weth),
            amountIn,
            amountOut,
            calldata_,
            address(router)
        );

        assertEq(weth.balanceOf(address(mandate)), amountOut);
        assertEq(mandate.dailyVolume(mandate.getCurrentDay()), amountIn);
    }

    function test_nonAgentCannotExecuteSwap() public {
        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), address(weth), 30_000_000, 0.01 ether, address(mandate))
        );

        vm.prank(notOwner);
        vm.expectRevert(AgentMandate.NotAgent.selector);
        mandate.executeSwap(
            address(usdc),
            address(weth),
            30_000_000,
            0.01 ether,
            calldata_,
            address(router)
        );
    }

    function test_tokenInNotAllowed() public {
        address badToken = address(0xDEAD);
        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (badToken, address(weth), 30_000_000, 0.01 ether, address(mandate))
        );

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentMandate.TokenNotAllowed.selector, badToken));
        mandate.executeSwap(
            badToken,
            address(weth),
            30_000_000,
            0.01 ether,
            calldata_,
            address(router)
        );
    }

    function test_tokenOutNotAllowed() public {
        address badToken = address(0xDEAD);
        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), badToken, 30_000_000, 0.01 ether, address(mandate))
        );

        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentMandate.TokenNotAllowed.selector, badToken));
        mandate.executeSwap(
            address(usdc),
            badToken,
            30_000_000,
            0.01 ether,
            calldata_,
            address(router)
        );
    }

    function test_exceedsPerSwapLimit() public {
        uint256 amountIn = 100_000_000; // 100 USDC > 50 limit
        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), address(weth), amountIn, 0.01 ether, address(mandate))
        );

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(AgentMandate.ExceedsPerSwapLimit.selector, amountIn, 50_000_000)
        );
        mandate.executeSwap(
            address(usdc),
            address(weth),
            amountIn,
            0.01 ether,
            calldata_,
            address(router)
        );

        // Verify daily volume NOT incremented
        assertEq(mandate.dailyVolume(mandate.getCurrentDay()), 0);
    }

    function test_exceedsDailyLimit() public {
        uint256 amountIn = 50_000_000; // 50 USDC per swap
        uint256 amountOut = 0.01 ether;

        // Do 4 successful swaps (4 * 50 = 200, hitting the limit)
        for (uint256 i = 0; i < 4; i++) {
            bytes memory calldata_ = abi.encodeCall(
                MockRouter.mockSwap,
                (address(usdc), address(weth), amountIn, amountOut, address(mandate))
            );
            vm.prank(agent);
            mandate.executeSwap(
                address(usdc),
                address(weth),
                amountIn,
                amountOut,
                calldata_,
                address(router)
            );
        }

        // 5th swap should exceed daily limit (250 > 200)
        bytes memory calldata5 = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), address(weth), amountIn, amountOut, address(mandate))
        );

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(AgentMandate.ExceedsDailyLimit.selector, 250_000_000, 200_000_000)
        );
        mandate.executeSwap(
            address(usdc),
            address(weth),
            amountIn,
            amountOut,
            calldata5,
            address(router)
        );
    }

    function test_dailyVolumeResetsAfterDay() public {
        uint256 amountIn = 50_000_000;
        uint256 amountOut = 0.01 ether;

        // Max out daily volume (4 * 50 = 200)
        for (uint256 i = 0; i < 4; i++) {
            bytes memory calldata_ = abi.encodeCall(
                MockRouter.mockSwap,
                (address(usdc), address(weth), amountIn, amountOut, address(mandate))
            );
            vm.prank(agent);
            mandate.executeSwap(
                address(usdc),
                address(weth),
                amountIn,
                amountOut,
                calldata_,
                address(router)
            );
        }

        // Warp 1 day forward
        vm.warp(block.timestamp + 1 days);

        // Should succeed again
        bytes memory calldata_ = abi.encodeCall(
            MockRouter.mockSwap,
            (address(usdc), address(weth), amountIn, amountOut, address(mandate))
        );
        vm.prank(agent);
        mandate.executeSwap(
            address(usdc),
            address(weth),
            amountIn,
            amountOut,
            calldata_,
            address(router)
        );

        assertEq(mandate.dailyVolume(mandate.getCurrentDay()), amountIn);
    }
}
