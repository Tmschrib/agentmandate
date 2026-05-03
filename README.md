# AgentMandate

A programmable trust layer for AI agents trading on Uniswap.

## Pitch

Today, if you want an AI agent to trade for you on Uniswap, you face a brutal trade-off: give the agent your private key (full access, one stolen seed = wiped) or sign every transaction yourself (kills the point of autonomy). AgentMandate fixes this. It's a smart contract that sits between your AI agent and Uniswap, enforcing programmable trading permissions onchain. You define the rules: token pairs, max amount per swap, daily limits, slippage. The agent operates freely within those bounds, and physically cannot violate them — because the contract reverts any swap that breaks the rules. It's the missing trust layer for agentic finance.

## Live Demo

- Vercel: (pending deployment)
- Demo video: (pending recording)

## Architecture

```
User (Owner Wallet)
  │
  ├── setMandate() ──► AgentMandate Contract ◄── executeSwap() ── Agent Wallet
  │                         │                                         ▲
  │                         │ (enforces rules)                        │
  │                         ▼                                         │
  │                    Uniswap Router                            Chat UI
  │                                                                   │
  └── deposit/withdraw ──► Contract holds funds              Claude (AI) ──► Uniswap Trading API
```

## Setup

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js 18+](https://nodejs.org/) and pnpm
- Two wallet accounts in MetaMask/Rabby (Owner + Agent)

### Install & Deploy

```bash
# Clone
git clone https://github.com/YOUR_USER/agentmandate.git
cd agentmandate

# Contracts
cd contracts
forge install
forge build
forge test

# Deploy (fill .env first)
cp .env.example .env
# Edit .env with your keys
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Frontend
cd ../web
pnpm install
cp .env.example .env.local
# Edit .env.local with deployed contract address + API keys
pnpm dev
```

### Environment Variables

Copy `.env.example` in both `contracts/` and `web/` directories and fill in your keys.

## Demo Flow

1. **Setup**: Connect Owner wallet → Set mandate (agent address, tokens, limits)
2. **Fund**: Deposit USDC into the contract
3. **Switch**: Switch to Agent wallet in MetaMask
4. **Valid swap**: "Swap 30 USDC for WETH" → succeeds, green ✓
5. **Per-swap violation**: "Swap 100 USDC for WETH" → reverts ExceedsPerSwapLimit, red ✗
6. **Token violation**: "Swap 30 USDC for SHIB" → reverts TokenNotAllowed, red ✗
7. **Daily limit**: Multiple 30 USDC swaps until daily limit hit → reverts ExceedsDailyLimit, red ✗

## Security Model

**Two wallets, two security levels:**

- **Owner wallet** (Account 1): Human's wallet. Can deploy, fund, set mandate, pause, withdraw. Holds all risk and control.
- **Agent wallet** (Account 2): Separate wallet. Can ONLY call `executeSwap` within the mandate's bounds. Even if compromised, attacker cannot drain funds — they can only execute swaps within the defined rules.

**Funds live in the contract**, never in the agent wallet. The agent wallet only holds ~0.01 ETH for gas.

The contract enforces all rules onchain. The AI agent is intentionally "naive" — it submits every swap request without pre-validation. The contract is the sole authority on what's allowed.

## Limitations

- Daily volume limit is denominated in USDC and applies only to USDC outflows. A production version would use a price oracle.
- User-controlled agent wallet via wallet UI switch (no server-side signing for demo).
- No conversation history — agent is action-oriented, each message is independent.
- Single chain: Base Sepolia (84532), USDC↔WETH only.
- Slippage enforced by Uniswap calldata, not by the mandate (mandate's slippage field is advisory).
- For Path A (Permit2) deployments, approvals are pre-set in the constructor; tokens added later via setMandate would need a follow-up admin call (not implemented in MVP).

## Tech Stack

- Solidity ^0.8.24, Foundry, OpenZeppelin
- Next.js 14 (App Router) + TypeScript + TailwindCSS
- wagmi v2 + viem + RainbowKit
- Anthropic SDK (Claude Sonnet 4.5)
- Uniswap Trading API
- Base Sepolia (84532)
