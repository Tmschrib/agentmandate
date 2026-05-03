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
    <div className="border border-gray-200 rounded-2xl p-5 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Chat with agent</h2>
        {m?.agent && (
          <span className="text-sm text-gray-400">
            Signed by {m.agent.slice(0, 4)}...{m.agent.slice(-3)}
          </span>
        )}
      </div>

      {isWrongAccount && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          Wrong account connected. Connected:{" "}
          <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>.
          Expected agent:{" "}
          <span className="font-mono">{m?.agent.slice(0, 6)}...{m?.agent.slice(-4)}</span>.
          Switch accounts in your wallet to enable swaps.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 mb-4 min-h-[200px] max-h-[400px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm p-2.5 rounded-xl ${
              msg.role === "user"
                ? "bg-gray-100 ml-8 text-gray-900"
                : msg.status === "success"
                ? "bg-green-50 border border-green-200 text-green-900 mr-8"
                : msg.status === "error"
                ? "bg-red-50 border border-red-200 text-red-800 mr-8"
                : msg.status === "pending"
                ? "bg-yellow-50 border border-yellow-200 text-yellow-800 mr-8"
                : "bg-gray-50 mr-8 text-gray-700"
            }`}
          >
            {msg.text}
            {msg.txHash && (
              <a
                href={`https://basescan.org/tx/${msg.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 mt-1 hover:underline font-mono"
              >
                tx: {msg.txHash.slice(0, 8)}...{msg.txHash.slice(-4)} &rarr;
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
          placeholder="Type instruction..."
          disabled={busy || !!isWrongAccount}
          className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={busy || !!isWrongAccount || !input.trim()}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 rounded-xl text-sm font-medium text-gray-700"
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
