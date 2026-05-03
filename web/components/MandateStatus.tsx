"use client";

import { useReadContract, useAccount, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { AGENT_MANDATE_ABI, AGENT_MANDATE_ADDRESS } from "@/lib/contract";
import { TOKENS } from "@/lib/tokens";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function MandateStatus() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data: mandate } = useReadContract({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    functionName: "getMandate",
    query: { refetchInterval: 4000 },
  });

  const { data: currentDay } = useReadContract({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    functionName: "getCurrentDay",
    query: { refetchInterval: 4000 },
  });

  const { data: dailyVol } = useReadContract({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    functionName: "dailyVolume",
    args: currentDay != null ? [currentDay as bigint] : undefined,
    query: { enabled: currentDay != null, refetchInterval: 4000 },
  });

  const { data: usdcBalance } = useReadContract({
    address: TOKENS.USDC.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [AGENT_MANDATE_ADDRESS],
    query: { refetchInterval: 4000 },
  });

  const { data: wethBalance } = useReadContract({
    address: TOKENS.WETH.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [AGENT_MANDATE_ADDRESS],
    query: { refetchInterval: 4000 },
  });

  const { data: owner } = useReadContract({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    functionName: "owner",
  });

  const m = mandate as
    | {
        agent: string;
        allowedTokens: string[];
        maxAmountPerSwap: bigint;
        maxDailyVolumeUSDC: bigint;
        maxSlippageBps: bigint;
        active: boolean;
      }
    | undefined;

  const isOwner = Boolean(
    address && owner && address.toLowerCase() === (owner as string).toLowerCase()
  );

  const dailyVolNum = dailyVol ? Number(formatUnits(dailyVol as bigint, 6)) : 0;
  const dailyLimitNum = m ? Number(formatUnits(m.maxDailyVolumeUSDC, 6)) : 0;
  const pct = dailyLimitNum > 0 ? (dailyVolNum / dailyLimitNum) * 100 : 0;

  const handlePause = async () => {
    await writeContractAsync({
      address: AGENT_MANDATE_ADDRESS,
      abi: AGENT_MANDATE_ABI,
      functionName: "pauseMandate",
    });
  };

  const handleResume = async () => {
    await writeContractAsync({
      address: AGENT_MANDATE_ADDRESS,
      abi: AGENT_MANDATE_ABI,
      functionName: "resumeMandate",
    });
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <h2 className="text-lg font-bold mb-3">Mandate Status</h2>

      {!m ? (
        <p className="text-gray-400 text-sm">No mandate set</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                m.active ? "bg-green-400" : "bg-red-400"
              }`}
            />
            <span>{m.active ? "Active" : "Paused"}</span>
          </div>

          <div>
            <span className="text-gray-400">Agent:</span>{" "}
            <span className="font-mono text-xs">
              {m.agent.slice(0, 6)}...{m.agent.slice(-4)}
            </span>
          </div>

          <div>
            <span className="text-gray-400">Daily USDC Volume:</span>
            <div className="mt-1 w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {dailyVolNum.toFixed(2)} / {dailyLimitNum.toFixed(2)} USDC
            </span>
          </div>

          <div>
            <span className="text-gray-400">Max Per Swap:</span>{" "}
            {Number(formatUnits(m.maxAmountPerSwap, 6)).toFixed(2)} USDC
          </div>

          <div>
            <span className="text-gray-400">Contract Balances:</span>
            <div className="ml-2 text-xs font-mono">
              USDC:{" "}
              {usdcBalance
                ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(2)
                : "0.00"}
              <br />
              WETH:{" "}
              {wethBalance
                ? Number(formatUnits(wethBalance as bigint, 18)).toFixed(6)
                : "0.000000"}
            </div>
          </div>

          {isOwner && (
            <button
              onClick={m.active ? handlePause : handleResume}
              className={`w-full py-1.5 rounded text-sm font-medium ${
                m.active
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {m.active ? "Pause Mandate" : "Resume Mandate"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
