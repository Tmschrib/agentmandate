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
    <div className="border border-gray-200 rounded-2xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Live status</h2>
        {m && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
            m.active ? "border-green-300 text-green-700" : "border-red-300 text-red-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${m.active ? "bg-green-500" : "bg-red-500"}`} />
            {m.active ? "Active" : "Paused"}
          </span>
        )}
      </div>

      {!m ? (
        <p className="text-gray-400 text-sm">No mandate set</p>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500">Today&apos;s volume</span>
              <span className="font-bold text-gray-900">
                {dailyVolNum.toFixed(0)} / {dailyLimitNum.toFixed(0)} USDC
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-green-700 h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-xl p-3">
              <span className="text-gray-500 text-xs">Contract balance</span>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {usdcBalance
                  ? Number(formatUnits(usdcBalance as bigint, 6)).toFixed(0)
                  : "0"}{" "}
                <span className="text-sm font-normal text-gray-500">USDC</span>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl p-3">
              <span className="text-gray-500 text-xs">+ WETH</span>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {wethBalance
                  ? Number(formatUnits(wethBalance as bigint, 18)).toFixed(3)
                  : "0.000"}{" "}
                <span className="text-sm font-normal text-gray-500">WETH</span>
              </div>
            </div>
          </div>

          {isOwner && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={m.active ? handlePause : handleResume}
                className="py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {m.active ? "Pause" : "Resume"}
              </button>
              <button
                className="py-2.5 rounded-xl text-sm font-medium border-2 border-gray-800 text-gray-800 hover:bg-gray-50"
              >
                Withdraw
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
