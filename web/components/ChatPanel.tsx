"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { AGENT_MANDATE_ABI, AGENT_MANDATE_ADDRESS } from "@/lib/contract";
import type { RevertEntry } from "./SwapHistory";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  status?: "pending" | "success" | "error";
  txHash?: string;
}

export default function ChatPanel({
  onRevert,
}: {
  onRevert: (entry: RevertEntry) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: mandate } = useReadContract({
    address: AGENT_MANDATE_ADDRESS,
    abi: AGENT_MANDATE_ABI,
    functionName: "getMandate",
    query: { refetchInterval: 4000 },
  });

  const m = mandate as { agent: string; active: boolean } | undefined;
  const isWrongAccount =
    address &&
    m?.agent &&
    address.toLowerCase() !== m.agent.toLowerCase();

  const addMessage = (msg: Omit<Message, "id">) => {
    const newMsg = { ...msg, id: Math.random().toString(36) };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg.id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleSend = async () => {
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");
    addMessage({ role: "user", text: userMsg });
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      if (data.kind === "text") {
        addMessage({ role: "agent", text: data.text });
      } else if (data.kind === "swap") {
        const pendingId = addMessage({
          role: "system",
          text: `Submitting swap: ${data.amount} ${data.tokenInSymbol} → ${data.tokenOutSymbol}...`,
          status: "pending",
        });

        try {
          const hash = await writeContractAsync({
            address: AGENT_MANDATE_ADDRESS,
            abi: AGENT_MANDATE_ABI,
            functionName: "executeSwap",
            args: [
              data.tokenInAddress as `0x${string}`,
              data.tokenOutAddress as `0x${string}`,
              BigInt(data.amountIn),
              BigInt(data.minAmountOut),
              data.calldata as `0x${string}`,
              data.router as `0x${string}`,
            ],
          });

          const receipt = await publicClient!.waitForTransactionReceipt({
            hash,
            confirmations: 1,
            timeout: 60_000,
          });

          if (receipt.status !== "success") {
            throw new Error("Transaction reverted onchain");
          }

          updateMessage(pendingId, {
            text: `Swap executed! Tx: ${hash}`,
            status: "success",
            txHash: hash,
          });
        } catch (err: unknown) {
          const error = err as { cause?: { data?: { errorName?: string } }; message?: string };
          const errorName =
            error?.cause?.data?.errorName ||
            extractErrorName(error?.message) ||
            "Reverted onchain";

          updateMessage(pendingId, {
            text: `Reverted by mandate: ${errorName}`,
            status: "error",
          });

          onRevert({
            id: Math.random().toString(36),
            errorName,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      addMessage({ role: "agent", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900 flex flex-col h-full">
      <h2 className="text-lg font-bold mb-3">Agent Chat</h2>

      {isWrongAccount && (
        <div className="mb-3 p-2 bg-yellow-900/50 border border-yellow-600 rounded text-xs text-yellow-200">
          ⚠ Wrong account connected. Connected:{" "}
          <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>.
          Expected agent:{" "}
          <span className="font-mono">{m?.agent.slice(0, 6)}...{m?.agent.slice(-4)}</span>.
          Switch accounts in your wallet to enable swaps.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[200px] max-h-[400px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm p-2 rounded ${
              msg.role === "user"
                ? "bg-blue-900/40 ml-8"
                : msg.status === "success"
                ? "bg-green-900/40 border border-green-700"
                : msg.status === "error"
                ? "bg-red-900/40 border border-red-700"
                : msg.status === "pending"
                ? "bg-purple-900/40 border border-purple-700"
                : "bg-gray-800 mr-8"
            }`}
          >
            {msg.text}
            {msg.txHash && (
              <a
                href={`https://basescan.org/tx/${msg.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-400 mt-1 hover:underline"
              >
                View on Basescan
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="e.g. Swap 30 USDC for WETH"
          disabled={busy || !!isWrongAccount}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={busy || !!isWrongAccount || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function extractErrorName(message?: string): string | undefined {
  if (!message) return undefined;
  const patterns = [
    /reverted with custom error '(\w+)\(/,
    /error (\w+)\(/,
    /reason: "([^"]+)"/,
  ];
  for (const p of patterns) {
    const match = message.match(p);
    if (match) return match[1];
  }
  return undefined;
}
