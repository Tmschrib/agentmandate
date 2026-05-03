"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { AGENT_MANDATE_ABI, AGENT_MANDATE_ADDRESS } from "@/lib/contract";
import { TOKENS } from "@/lib/tokens";

export default function MandateSetup() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [agentAddress, setAgentAddress] = useState("");
  const [maxPerSwap, setMaxPerSwap] = useState("50");
  const [dailyLimit, setDailyLimit] = useState("200");
  const [slippageBps, setSlippageBps] = useState("100");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    const allowedTokens = [TOKENS.USDC.address, TOKENS.WETH.address];

    await writeContractAsync({
      address: AGENT_MANDATE_ADDRESS,
      abi: AGENT_MANDATE_ABI,
      functionName: "setMandate",
      args: [
        {
          agent: agentAddress as `0x${string}`,
          allowedTokens,
          maxAmountPerSwap: parseUnits(maxPerSwap, 6),
          maxDailyVolumeUSDC: parseUnits(dailyLimit, 6),
          maxSlippageBps: BigInt(slippageBps),
          active: true,
        },
      ],
    });
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <h2 className="text-lg font-bold mb-3">Mandate Setup</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400">Agent Address</label>
          <input
            type="text"
            value={agentAddress}
            onChange={(e) => setAgentAddress(e.target.value)}
            placeholder="0x..."
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400">
              Max Per Swap (USDC)
            </label>
            <input
              type="number"
              value={maxPerSwap}
              onChange={(e) => setMaxPerSwap(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400">
              Daily Limit (USDC)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400">
            Slippage (bps, advisory)
          </label>
          <input
            type="number"
            value={slippageBps}
            onChange={(e) => setSlippageBps(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Allowed Tokens
          </label>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked disabled /> USDC
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked disabled /> WETH
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending || !address}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-medium text-sm"
        >
          {isPending ? "Saving..." : "Save Mandate"}
        </button>
      </form>
    </div>
  );
}
