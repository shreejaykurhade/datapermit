import { user, fail } from "@/lib/server";
import { serverChainClient } from "@/lib/chain-server";
import {
  contractAddress,
  permitAbi,
  tokenAddress,
  tokenAbi,
} from "@/lib/chain";
import { formatUnits } from "viem";
export async function GET() {
  try {
    const address = (await user()) as `0x${string}`;
    if (!contractAddress || !tokenAddress)
      throw new Error("Contract is not configured.");
    const [amount, decimals] = await Promise.all([
      serverChainClient.readContract({
        address: contractAddress,
        abi: permitAbi,
        functionName: "earnings",
        args: [address],
      }),
      serverChainClient.readContract({
        address: tokenAddress,
        abi: tokenAbi,
        functionName: "decimals",
      }),
    ]);
    return Response.json({
      address,
      amount: amount.toString(),
      formatted: formatUnits(amount, decimals),
    });
  } catch (e) {
    return fail(e);
  }
}
