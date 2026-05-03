"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/Providers";
import MandateSetup from "@/components/MandateSetup";
import MandateStatus from "@/components/MandateStatus";
import ChatPanel from "@/components/ChatPanel";
import SwapHistory, { type RevertEntry } from "@/components/SwapHistory";

export default function AppContent() {
  const [recentReverts, setRecentReverts] = useState<RevertEntry[]>([]);

  const handleRevert = (entry: RevertEntry) => {
    setRecentReverts((prev) => [entry, ...prev].slice(0, 10));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-bold">A</div>
          <h1 className="text-xl font-bold text-gray-900">AgentMandate</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Base Sepolia</span>
          <ConnectButton />
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto w-full">
        <MandateSetup />
        <MandateStatus />
        <ChatPanel onRevert={handleRevert} />
        <SwapHistory recentReverts={recentReverts} />
      </main>
    </div>
  );
}
