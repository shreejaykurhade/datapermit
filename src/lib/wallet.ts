"use client";
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createWalletClient, http } from "viem";
import { appChain } from "./chain";
import { derivePublisherKey } from "./encryption";
let current: ReturnType<typeof createSecp256k1SigningSession> | undefined;
let publisherKey: CryptoKey | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
export function disconnectWallet() {
  current?.end();
  current = undefined;
  publisherKey = undefined;
  clearTimeout(idle);
}
export async function connectWallet(create = false) {
  disconnectWallet();
  const stored = localStorage.getItem("datapermit.credential");
  const result = create
    ? await createPasskeyWithPrfOutput({
        rp: { id: location.hostname, name: "DataPermit" },
        user: { name: "DataPermit member", displayName: "DataPermit member" },
      })
    : await getPasskeyPrfOutput({
        rpId: location.hostname,
        credential: stored ? JSON.parse(stored) : undefined,
      });
  localStorage.setItem(
    "datapermit.credential",
    JSON.stringify({
      credentialId: result.credentialId,
      ...("transports" in result ? { transports: result.transports } : {}),
    }),
  );
  publisherKey = await derivePublisherKey(result.prfOutput);
  const seed = mnemonicToSeedSync(
    entropyToMnemonic(result.prfOutput, wordlist),
  );
  const key = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0").privateKey;
  if (!key) throw new Error("Could not derive account.");
  current = createSecp256k1SigningSession({ privateKey: key });
  key.fill(0);
  seed.fill(0);
  result.prfOutput.fill(0);
  idle = setTimeout(disconnectWallet, 10 * 60 * 1000);
  return wallet();
}
export function wallet() {
  if (!current)
    throw new Error(
      "Sign in with your passkey again. Signing sessions expire after 10 minutes.",
    );
  return createWalletClient({
    account: toViemAccount(current),
    chain: appChain,
    transport: http(
      process.env.NEXT_PUBLIC_MONAD_RPC_URL || appChain.rpcUrls.default.http[0],
    ),
  });
}
export function publisherVaultKey() {
  if (!publisherKey)
    throw new Error(
      "Sign in with your Mera passkey to unlock the publisher vault.",
    );
  return publisherKey;
}
