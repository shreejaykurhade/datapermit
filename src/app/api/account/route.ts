import { user, fail } from "@/lib/server";
import { serverChainClient, alchemyConfigured } from "@/lib/chain-server";
import { appChain, tokenAddress, tokenAbi } from "@/lib/chain";
import { formatEther, formatUnits } from "viem";
export async function GET() {
  try {
    const address = (await user()) as `0x${string}`;
    const [actualChain, block, balance] = await Promise.all([
      serverChainClient.getChainId(),
      serverChainClient.getBlockNumber(),
      serverChainClient.getBalance({ address }),
    ]);
    if (actualChain !== appChain.id)
      throw new Error("RPC network does not match configured Monad chain.");
    let tokenBalance = null;
    if (tokenAddress) {
      const [amount, decimals] = await Promise.all([
        serverChainClient.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "balanceOf",
          args: [address],
        }),
        serverChainClient.readContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: "decimals",
        }),
      ]);
      tokenBalance = formatUnits(amount, decimals);
    }
    return Response.json({
      address,
      chainId: actualChain,
      block: block.toString(),
      nativeBalance: formatEther(balance),
      tokenBalance,
      rpcProvider: alchemyConfigured ? "Alchemy" : "Configured Monad RPC",
    });
  } catch (e) {
    return fail(e);
  }
}
