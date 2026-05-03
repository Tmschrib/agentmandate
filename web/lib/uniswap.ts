import { parseUnits } from "viem";
import { TOKENS } from "./tokens";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_MANDATE_ADDRESS!;

export async function fetchUniswapQuote(
  tokenInSymbol: string,
  tokenOutSymbol: string,
  amount: number
) {
  const tokenIn = TOKENS[tokenInSymbol];
  const tokenOut = TOKENS[tokenOutSymbol];

  if (!tokenIn || !tokenOut) {
    throw new Error(`Unknown token: ${!tokenIn ? tokenInSymbol : tokenOutSymbol}`);
  }

  const rawAmount = parseUnits(amount.toString(), tokenIn.decimals).toString();

  const res = await fetch("/api/uniswap/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "EXACT_INPUT",
      amount: rawAmount,
      tokenIn: tokenIn.address,
      tokenInChainId: 8453,
      tokenOut: tokenOut.address,
      tokenOutChainId: 8453,
      swapper: CONTRACT_ADDRESS,
    }),
  });

  if (!res.ok) {
    throw new Error(`Quote failed: ${res.status}`);
  }

  return res.json();
}

export async function fetchUniswapSwap(quote: Record<string, unknown>) {
  const res = await fetch("/api/uniswap/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quote,
      recipient: CONTRACT_ADDRESS,
    }),
  });

  if (!res.ok) {
    throw new Error(`Swap failed: ${res.status}`);
  }

  return res.json();
}
