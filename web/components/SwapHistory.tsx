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
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
      <h2 className="text-lg font-bold mb-3">Swap History</h2>
      {all.length === 0 ? (
        <p className="text-gray-400 text-sm">No swaps yet</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {all.map((entry) =>
            entry.type === "swap" ? (
              <div
                key={entry.data.id}
                className="flex items-center gap-2 text-xs bg-gray-800 rounded p-2"
              >
                <span className="text-green-400 font-bold">&#10003;</span>
                <span>
                  {entry.data.amountIn} {getTokenSymbol(entry.data.tokenIn)}{" "}
                  &rarr; {entry.data.amountOut}{" "}
                  {getTokenSymbol(entry.data.tokenOut)}
                </span>
              </div>
            ) : (
              <div
                key={entry.data.id}
                className="flex items-center gap-2 text-xs bg-gray-800 rounded p-2"
              >
                <span className="text-red-400 font-bold">&#10007;</span>
                <span className="text-red-300">{entry.data.errorName}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
