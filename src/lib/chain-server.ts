import "server-only";
import { createPublicClient, http } from "viem";
import { appChain } from "./chain";
export const alchemyConfigured = Boolean(process.env.ALCHEMY_RPC_URL);
export const serverChainClient = createPublicClient({
  chain: appChain,
  transport: http(
    process.env.ALCHEMY_RPC_URL ||
      process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
      appChain.rpcUrls.default.http[0],
  ),
});
