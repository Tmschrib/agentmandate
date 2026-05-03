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
    <div className="border border-gray-200 rounded-2xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Mandate setup</h2>
        <span className="text-sm text-gray-400">Owner only</span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Agent address</label>
          <input
            type="text"
            value={agentAddress}
            onChange={(e) => setAgentAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-2">Allowed tokens</label>
          <div className="flex gap-2">
            <span className="px-3 py-1 border border-green-300 text-green-700 rounded-full text-sm font-medium">USDC</span>
            <span className="px-3 py-1 border border-green-300 text-green-700 rounded-full text-sm font-medium">WETH</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Max / swap</label>
            <div className="text-lg font-bold text-gray-900">
              <input
                type="number"
                value={maxPerSwap}
                onChange={(e) => setMaxPerSwap(e.target.value)}
                className="w-20 bg-transparent text-lg font-bold text-gray-900 outline-none"
              /> <span className="text-gray-500 font-normal text-sm">USDC</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Daily limit</label>
            <div className="text-lg font-bold text-gray-900">
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="w-20 bg-transparent text-lg font-bold text-gray-900 outline-none"
              /> <span className="text-gray-500 font-normal text-sm">USDC</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Max slippage</label>
          <div className="text-lg font-bold text-gray-900">
            <input
              type="number"
              value={slippageBps}
              onChange={(e) => setSlippageBps(e.target.value)}
              className="w-16 bg-transparent text-lg font-bold text-gray-900 outline-none"
            /><span className="text-gray-500 font-normal text-sm">%</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending || !address}
          className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg font-medium text-sm"
        >
          {isPending ? "Saving..." : "Save Mandate"}
        </button>
      </form>
    </div>
  );
}
