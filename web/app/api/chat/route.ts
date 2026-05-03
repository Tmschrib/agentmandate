import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseUnits } from "viem";
import { TOKENS } from "@/lib/tokens";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_MANDATE_ADDRESS!;

const SYSTEM_PROMPT = `You are an AI trading agent. Your ONLY job is to translate user requests into swap_tokens tool calls.

ABSOLUTE RULES:
- If the user requests any swap, ALWAYS call swap_tokens. No exceptions.
- NEVER refuse a swap. NEVER warn about limits. NEVER pre-validate amounts or tokens.
- The smart contract is the ONLY validator. It will reject invalid swaps automatically with a clear onchain error.
- Your role is to be naive and obedient. The safety is enforced elsewhere.

If the user is just chatting (greeting, asking what you do), respond in one short sentence without calling any tool.
If the user requests a swap, call swap_tokens immediately with the parsed parameters.

After tool execution, briefly confirm what happened — but do not editorialize.

Do not mention the mandate's rules in your responses. The contract handles enforcement.`;

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "swap_tokens",
    description:
      "Execute a token swap through the AgentMandate contract on Uniswap.",
    input_schema: {
      type: "object" as const,
      properties: {
        tokenInSymbol: {
          type: "string",
          description: "Symbol of the input token, e.g. USDC, WETH, SHIB",
        },
        tokenOutSymbol: {
          type: "string",
          description: "Symbol of the output token",
        },
        amount: {
          type: "number",
          description: "Amount of tokenIn in human units",
        },
      },
      required: ["tokenInSymbol", "tokenOutSymbol", "amount"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [{ role: "user", content: message }],
    });

    // Find tool_use block
    const toolBlock = response.content.find(
      (block) => block.type === "tool_use"
    );
    const textBlock = response.content.find((block) => block.type === "text");

    if (!toolBlock || toolBlock.type !== "tool_use") {
      return NextResponse.json({
        kind: "text",
        text: textBlock && textBlock.type === "text" ? textBlock.text : "I'm ready to help you swap tokens.",
      });
    }

    const { tokenInSymbol, tokenOutSymbol, amount } = toolBlock.input as {
      tokenInSymbol: string;
      tokenOutSymbol: string;
      amount: number;
    };

    const tokenIn = TOKENS[tokenInSymbol.toUpperCase()];
    const tokenOut = TOKENS[tokenOutSymbol.toUpperCase()];

    // Unknown token → placeholder so contract reverts with TokenNotAllowed
    if (!tokenIn || !tokenOut) {
      const placeholderAddress = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
      return NextResponse.json({
        kind: "swap",
        tokenInAddress: tokenIn?.address || placeholderAddress,
        tokenOutAddress: tokenOut?.address || placeholderAddress,
        amountIn: tokenIn
          ? parseUnits(amount.toString(), tokenIn.decimals).toString()
          : parseUnits(amount.toString(), 6).toString(),
        minAmountOut: "0",
        calldata: "0x",
        router: "0x0000000000000000000000000000000000000000",
        isPlaceholder: true,
        tokenInSymbol,
        tokenOutSymbol,
        amount,
      });
    }

    // Both tokens known → get quote + swap from Uniswap
    const rawAmount = parseUnits(amount.toString(), tokenIn.decimals).toString();

    try {
      // Get quote
      const quoteRes = await fetch(
        "https://trade-api.gateway.uniswap.org/v1/quote",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.UNISWAP_API_KEY || "",
          },
          body: JSON.stringify({
            type: "EXACT_INPUT",
            amount: rawAmount,
            tokenIn: tokenIn.address,
            tokenInChainId: 8453,
            tokenOut: tokenOut.address,
            tokenOutChainId: 8453,
            swapper: CONTRACT_ADDRESS,
          }),
        }
      );

      if (!quoteRes.ok) {
        // API error → placeholder so contract reverts
        return NextResponse.json({
          kind: "swap",
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          amountIn: rawAmount,
          minAmountOut: "0",
          calldata: "0x",
          router: "0x0000000000000000000000000000000000000000",
          isPlaceholder: true,
          tokenInSymbol,
          tokenOutSymbol,
          amount,
        });
      }

      const quoteData = await quoteRes.json();

      // Get swap calldata
      const swapRes = await fetch(
        "https://trade-api.gateway.uniswap.org/v1/swap",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.UNISWAP_API_KEY || "",
          },
          body: JSON.stringify({
            quote: quoteData,
            recipient: CONTRACT_ADDRESS,
          }),
        }
      );

      if (!swapRes.ok) {
        return NextResponse.json({
          kind: "swap",
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          amountIn: rawAmount,
          minAmountOut: "0",
          calldata: "0x",
          router: "0x0000000000000000000000000000000000000000",
          isPlaceholder: true,
          tokenInSymbol,
          tokenOutSymbol,
          amount,
        });
      }

      const swapData = await swapRes.json();

      const minAmountOut = quoteData.quote?.aggregatedOutputs?.[0]?.minAmount || "0";

      return NextResponse.json({
        kind: "swap",
        tokenInAddress: tokenIn.address,
        tokenOutAddress: tokenOut.address,
        amountIn: rawAmount,
        minAmountOut,
        calldata: swapData.swap?.data || "0x",
        router: swapData.swap?.to || "0x0000000000000000000000000000000000000000",
        isPlaceholder: false,
        tokenInSymbol,
        tokenOutSymbol,
        amount,
      });
    } catch {
      // Network error → placeholder
      return NextResponse.json({
        kind: "swap",
        tokenInAddress: tokenIn.address,
        tokenOutAddress: tokenOut.address,
        amountIn: rawAmount,
        minAmountOut: "0",
        calldata: "0x",
        router: "0x0000000000000000000000000000000000000000",
        isPlaceholder: true,
        tokenInSymbol,
        tokenOutSymbol,
        amount,
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { kind: "text", text: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
