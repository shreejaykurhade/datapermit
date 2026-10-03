import { createWalletClient, createPublicClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad, monadTestnet } from "viem/chains";
import { compile } from "./compile";
const chain =
  process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143" ? monad : monadTestnet;
const key = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
const token = process.env.PAYMENT_TOKEN;
if (!key || !token || !isAddress(token))
  throw new Error("Set DEPLOYER_PRIVATE_KEY and PAYMENT_TOKEN in .env.local.");
const transport = http(
  process.env.NEXT_PUBLIC_MONAD_RPC_URL || chain.rpcUrls.default.http[0],
);
const account = privateKeyToAccount(key);
const client = createWalletClient({ account, chain, transport });
const publicClient = createPublicClient({ chain: monadTestnet, transport });
if ((await publicClient.getChainId()) !== chain.id)
  throw new Error("RPC network mismatch.");
const artifact = compile();
const hash = await client.deployContract({
  abi: artifact.abi,
  bytecode: `0x${artifact.evm.bytecode.object}`,
  args: [token],
});
console.log("Deployment transaction:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success")
  throw new Error("Contract deployment reverted.");
console.log("NEXT_PUBLIC_PERMIT_CONTRACT=" + receipt.contractAddress);
