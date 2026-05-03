import AgentMandateArtifact from "./AgentMandate.json";

export const AGENT_MANDATE_ADDRESS = process.env
  .NEXT_PUBLIC_AGENT_MANDATE_ADDRESS as `0x${string}`;

export const AGENT_MANDATE_ABI = AgentMandateArtifact.abi;
