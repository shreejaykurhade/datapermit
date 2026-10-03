# Sponsor integration setup and evidence

The Next.js application deploys to Vercel. Envio and CRE run outside Vercel. Demo mode never invokes paid AI services or bridges funds. Every row in the README separates code from live evidence.

## Mera account and non-wallet keys

Set `DATA_ENCRYPTION_KEY` to a random 32-byte base64 secret before live publishing:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply the complete `supabase/schema.sql`, including the encrypted columns and provisioning function, even if the database was created previously. In Publisher studio, connect/create a Mera passkey and publish. The browser derives a non-extractable AES wrapping key with HKDF using a separate `non-wallet/dataset-key-wrapping` domain. Each collection gets a fresh random AES-256-GCM data key and authenticated dataset context. The passkey wraps a publisher recovery envelope; the server wraps a separate gateway envelope under `DATA_ENCRYPTION_KEY`.

Full records are stored as ciphertext; two samples remain intentionally public. Publishing sends plaintext over HTTPS for hash verification before discarding it from the stored full-record field. This is encryption at rest with a trusted gateway, not buyer end-to-end encryption. The server master key enables licensed delivery. Back up this key securely; losing it makes gateway envelopes unusable. The passkey recovery envelope remains independently recoverable with the original PRF output. Do not rotate the gateway master key without rewrapping existing envelopes. Changing the WebAuthn hostname changes account/recovery behavior, so use a stable production domain.

Use **Unlock publisher copy** to fetch only the publisher envelope, decrypt locally, verify the registered digest, and download. A different account cannot fetch or unlock it. No seed phrase or extension is required. The SDK session and vault key are discarded on sign-out or after ten minutes.

## Alchemy

Set server-only `ALCHEMY_RPC_URL` to your authenticated Monad endpoint for the selected network. `NEXT_PUBLIC_MONAD_RPC_URL` is a separate browser-safe RPC URL. Authoritative registration, purchase, access, and provisioning reads use the server client. Publisher studio's infrastructure button reads chain ID, current block, MON, and payment-token balances and identifies whether Alchemy was configured. An endpoint configuration flag is not proof that Alchemy succeeded.

## Qwen and Kimi

Set `QWEN_API_KEY`, `QWEN_BASE_URL`, and the exact eligible `QWEN_MODEL`. In Developer, run the procurement agent, inspect its trace/recommendation, approve the license in checkout, purchase, retrieve records, then approve data sharing and click **Run licensed benchmark with Qwen**. Qwen generates a response to the first licensed input and grades it against the expected behavior. This is an illustrative model-graded result, not a statistically validated benchmark. License terms must permit provider processing. The agent cannot bypass payment approval.

Set `KIMI_API_KEY`, `KIMI_MODEL`, and optionally `KIMI_BASE_URL` (default `https://api.moonshot.ai/v1`). In Publisher studio, explicitly approve sharing up to 50 current form records, then click **Review dataset with Kimi**. The server validates the structured review and record indices. Missing credentials return an explicit error; no fallback AI response is fabricated.

## Chainlink CRE

The workflow source and independent SDK package are in `cre/`. It uses a cron trigger, HTTP capability, secrets, and identical-result consensus. It obtains a consensus job list before verifying receipts and calling an idempotent provisioning endpoint. The app rechecks the contract and buyer before storing `workflow_results` and enabling access. With `CRE_PROVISIONING_ENABLED=true`, imported purchases remain pending and the gateway returns HTTP 425 until provisioning succeeds. SQL also denies pending permits.

1. Install the official CRE CLI/runtime, authenticate, and obtain deployment access according to [Chainlink's guide](https://docs.chain.link/cre/getting-started/cli-installation/windows).
2. In `cre/`, run `npm ci` and `npm run typecheck`.
3. Set `cre/config.staging.json` to the final HTTPS Vercel domain and the matching Monad RPC. Redirecting/protected preview URLs will fail.
4. Generate a random secret (at least 32 characters). Set Vercel `CRE_API_SECRET` and the CRE secret `DATAPERMIT_CRE_SECRET` to the same value. For simulation, the mapping in `secrets.yaml` reads `DATAPERMIT_CRE_SECRET_ALL` from your shell environment. Do not commit its value.
5. Use the installed CLI's workflow simulation command for this directory and `staging-settings`; inspect its supported flags with `cre workflow simulate --help`. Then deploy/activate with your authorized CRE account.
6. Set `CRE_PROVISIONING_ENABLED=true`, purchase a permit, show pending access denial, the successful workflow execution, the recorded block in Activity, and subsequent successful access.

The API authenticates a shared CRE secret; it does not verify a cryptographically signed DON report. Do not describe the database result as an on-chain attestation. Repeated provisioning is safe and creates one record per permit. SDK typechecking and SQL behavior are locally verified; actual CRE simulation/deployment requires external tooling and account access.

## Aurora Intents

Aurora funding uses the official headless `@aurora-is-near/intents-connect` SDK while keeping Mera as the account/signing layer. A manual source deposit can come from an exchange or an external account; DataPermit does not require that wallet extension for account management.

1. Use Monad **mainnet**: set `NEXT_PUBLIC_MONAD_CHAIN_ID=143`, a matching RPC, deployed permit contract, payment token, symbol, and Alchemy endpoint. Keep testnet and mainnet deployments separate.
2. Set server `AURORA_API_KEY` and `AURORA_API_URL`. Set the matching public service base `NEXT_PUBLIC_AURORA_API_URL` (contains no key).
3. Set `NEXT_PUBLIC_AURORA_DESTINATION_ASSET` to the actual supported 1Click asset ID matching the deployed Monad payment token. The app fetches supported tokens and refuses an unsupported destination. Do not guess this ID.
4. In Developer, choose a supported Ethereum/Base/Arbitrum source token and amount. Request a dry quote and inspect minimum output, network fees, and transfer steps.
5. Explicitly approve/sign the funding intent. Deposit only the quoted source asset/amount to the returned address before its deadline. The SDK monitors execution; saved execution IDs support resume/cancel. The service intermediate account transfers settlement tokens to the Mera buyer account, not to the dataset publisher.
6. Confirm the payment-token balance on Monad, then approve and purchase the chosen permit through DataPermit. Retain MON for gas. Funding success alone does not grant dataset access.

The authenticated API-key proxy only accepts the configured destination asset and a single token transfer to the signed-in account. The default testnet app cannot bridge real funds. Quotes, signatures, settlement, and cancellation have not been exercised against live Aurora credentials here.

## Envio and submission

Use the existing README instructions to deploy the indexer separately and match its contract/network configuration. Native Windows Envio codegen remains unverified; use WSL or Envio Cloud.

Capture actual transaction links, model IDs and responses, Envio receipts, the CRE execution ID/result, passkey recovery, and Aurora settlement. Confirm award amounts, supported networks/models, and stacking with organizers before claiming eligibility. An implementation checklist or configuration flag is not evidence of a sponsor service call.
