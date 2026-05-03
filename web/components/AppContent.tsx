"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">AgentMandate</h1>
          <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-200 rounded">
            Base
          </span>
        </div>
        <ConnectButton />
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
