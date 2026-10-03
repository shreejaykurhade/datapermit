import { createPublicClient, http, parseAbi, keccak256, toBytes } from "viem";
import { monadTestnet, monad } from "viem/chains";
export const appChain =
  process.env.NEXT_PUBLIC_MONAD_CHAIN_ID === "143" ? monad : monadTestnet;
export const explorerUrl = appChain.blockExplorers.default.url;
export const permitAbi = parseAbi([
  "function registerDataset(bytes32 id, uint256 price, uint64 duration, uint32 quota, bytes32 contentHash, bytes32 termsHash)",
  "function purchase(bytes32 datasetId, bytes32 acceptedTermsHash) returns (uint256)",
  "function revoke(uint256 id)",
  "function permits(uint256) view returns (address buyer, bytes32 datasetId, uint64 expiresAt, uint32 quota, bool revoked)",
  "function datasets(bytes32) view returns (address publisher, uint256 price, uint64 duration, uint32 quota, bytes32 contentHash, bytes32 termsHash)",
  "event DatasetRegistered(bytes32 indexed datasetId, address indexed publisher, bytes32 contentHash, bytes32 termsHash)",
  "event PermitPurchased(uint256 indexed permitId, bytes32 indexed datasetId, address indexed buyer, address publisher, uint256 amount, uint64 expiresAt, uint32 quota)",
  "event PermitRevoked(uint256 indexed permitId)",
]);
export const tokenAbi = parseAbi([
  "function approve(address spender,uint256 amount) returns(bool)",
  "function decimals() view returns(uint8)",
  "function allowance(address owner,address spender) view returns(uint256)",
  "function balanceOf(address owner) view returns(uint256)",
]);
export const contractAddress = process.env.NEXT_PUBLIC_PERMIT_CONTRACT as
  `0x${string}` | undefined;
export const tokenAddress = process.env.NEXT_PUBLIC_PAYMENT_TOKEN as
  `0x${string}` | undefined;
export const chainClient = createPublicClient({
  chain: appChain,
  transport: http(
    process.env.NEXT_PUBLIC_MONAD_RPC_URL || appChain.rpcUrls.default.http[0],
  ),
});
export const datasetKey = (id: string) => keccak256(toBytes(id));
export const termsKey = (terms: string) => keccak256(toBytes(terms));
