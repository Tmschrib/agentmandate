"use client";

import { useWatchContractEvent } from "wagmi";
import { useState } from "react";
import { formatUnits } from "viem";
import { AGENT_MANDATE_ABI, AGENT_MANDATE_ADDRESS } from "@/lib/contract";
import { TOKENS } from "@/lib/tokens";

export interface RevertEntry {
  id: string;
  errorName: string;
  timestamp: number;
}

interface SwapEntry {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  txHash?: string;
}

function getTokenSymbol(address: string): string {
  for (const [symbol, token] of Object.entries(TOKENS)) {
    if (token.address.toLowerCase() === address.toLowerCase()) return symbol;
  }
  return address.slice(0, 6) + "...";
}

function getDecimals(address: string): number {
  for (const token of Object.values(TOKENS)) {
    if (token.address.toLowerCase() === address.toLowerCase())
      return token.decimals;
  }
  return 18;
}

export default function SwapHistory({
  recentReverts,
}: {
  recentReverts: RevertEntry[];
}) {
  const [swapEvents, setSwapEvents] = useState<SwapEntry[]>([]);

  useWatchContractEvent({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    eventName: "SwapExecuted",
    onLogs(logs) {
      const newEntries: SwapEntry[] = logs.map((log) => {
        const entry = log as unknown as {
          args: {
            tokenIn: string;
            tokenOut: string;
            amountIn: bigint;
            amountOut: bigint;
            executor: string;
          };
          transactionHash: string;
        };
        const args = entry.args;
        return {
          id: entry.transactionHash || Math.random().toString(),
          tokenIn: args.tokenIn,
          tokenOut: args.tokenOut,
          amountIn: formatUnits(args.amountIn, getDecimals(args.tokenIn)),
          amountOut: formatUnits(args.amountOut, getDecimals(args.tokenOut)),
          timestamp: Date.now(),
          txHash: entry.transactionHash,
        };
      });
      setSwapEvents((prev) => [...newEntries, ...prev].slice(0, 10));
    },
  });

  // Merge and sort
  type Entry =
    | { type: "swap"; data: SwapEntry }
    | { type: "revert"; data: RevertEntry };

  const all: Entry[] = [
    ...swapEvents.map((s) => ({ type: "swap" as const, data: s })),
    ...recentReverts.map((r) => ({ type: "revert" as const, data: r })),
  ]
    .sort((a, b) => b.data.timestamp - a.data.timestamp)
    .slice(0, 10);

  return (
    <div className="border border-gray-200 rounded-2xl p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Onchain history</h2>
        <span className="text-sm text-gray-400">From events</span>
      </div>
      {all.length === 0 ? (
        <p className="text-gray-400 text-sm">No swaps yet</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {all.map((entry) =>
            entry.type === "swap" ? (
              <div
                key={entry.data.id}
                className="flex items-start gap-3 text-sm bg-green-50 rounded-xl p-3"
              >
                <span className="text-green-600 font-bold mt-0.5">&#10003;</span>
                <div>
                  <span className="font-medium text-gray-900">
                    {entry.data.amountIn} {getTokenSymbol(entry.data.tokenIn)}{" "}
                    &rarr; {entry.data.amountOut}{" "}
                    {getTokenSymbol(entry.data.tokenOut)}
                  </span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.data.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={entry.data.id}
                className="flex items-start gap-3 text-sm bg-red-50 rounded-xl p-3"
              >
                <span className="text-red-500 font-bold mt-0.5">&#10007;</span>
                <div>
                  <span className="font-medium text-gray-900">{entry.data.errorName}</span>
                  <div className="text-xs text-red-400 mt-0.5">
                    {new Date(entry.data.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
