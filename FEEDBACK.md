# Uniswap API — Builder Feedback

## Pre-flight observations
- Chain: 8453 (Base mainnet) — Base Sepolia returned "No quotes available", pivoted to mainnet
- Path detected (A/B/C): **A (Permit2)** — confirmed by `permitData` in quote response with Permit2 contract `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- Router address: `0x6fF5693b99212Da76ad316178A184AB56D299b43` (Universal Router on Base)
- Selector: `0x3593564c` = Universal Router `execute(bytes,bytes[],uint256)`
- First 100 bytes of sample calldata: `0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0`
- Quote→swap field mapping: POST `/v1/swap` with `{ quote: <full quote response object>, recipient: "0x..." }`
- Sample successful /swap request body: `{ "quote": { chainId, swapper, tradeType, route, input, output, slippage, priceImpact, gasFee, gasFeeUSD, gasFeeQuote, gasUseEstimate, quoteId, gasPrice, txFailureReasons, gasEstimates, aggregatedOutputs }, "recipient": "0x..." }`
- Response field paths: `swap.to` (router), `swap.data` (calldata), `quote.output.amount` (output), `quote.aggregatedOutputs[0].minAmount` (min amount)

## What Worked
- (fill as you go)

## What Didn't
- (fill as you go)

## Bugs Encountered
- (fill as you go)

## Documentation Gaps
- (fill as you go)

## Missing Endpoints / Feature Requests
- We needed onchain enforcement of trading permissions. The Trading API gives us calldata but no native concept of "scoped agent permissions." We had to build AgentMandate as a wrapper to enforce limits.
- The calldata flow assumes Permit2 setup or direct router transfer. A clear non-Permit2 mode for contract-based integrations would simplify the developer experience significantly.
- A native "permissioned swap" endpoint where developers attach scoped permissions to an API key would solve this use case for non-onchain agents.
- For Permit2-based integration in a contract wrapper, supporting tokens added after deployment requires either lazy approval logic in setMandate or a dedicated admin function. The current spec pre-approves only constructor-time tokens — production would need to handle dynamic token sets.

## DX Friction
- (fill as you go)

## What We Wish Existed
- (fill as you go)
