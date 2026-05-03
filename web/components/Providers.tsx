"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { ReactNode, useState, useEffect } from "react";

const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});

function ConnectButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const unsub = config.subscribe(
      (state) => state.connections,
      () => {
        const account = config.state.connections.get(config.state.current ?? "");
        setAddress(account?.accounts?.[0] ?? null);
      }
    );
    // Check initial state
    const account = config.state.connections.get(config.state.current ?? "");
    setAddress(account?.accounts?.[0] ?? null);
    return unsub;
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await config.connectors[0].connect();
    } catch {
      // user rejected
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    await config.connectors[0].disconnect();
    setAddress(null);
  };

  if (address) {
    return (
      <button
        onClick={handleDisconnect}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono text-gray-700 hover:bg-gray-50"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
    >
      {connecting ? "Connexion..." : "Connect Wallet"}
    </button>
  );
}

export { ConnectButton };

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
