// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentMandate} from "../src/AgentMandate.sol";

contract Deploy is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address weth = vm.envAddress("WETH_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        address[] memory permit2Tokens = new address[](2);
        permit2Tokens[0] = usdc;
        permit2Tokens[1] = weth;

        vm.startBroadcast(deployerKey);
        AgentMandate mandate = new AgentMandate(usdc, permit2Tokens);
        vm.stopBroadcast();

        console.log("AgentMandate deployed at:", address(mandate));
    }
}
