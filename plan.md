# DataPermit implementation checklist

## Requirements and architecture

- [x] Choose Next.js App Router, TypeScript, and Vercel deployment.
- [x] Define primary track: Trust, Identity & AI Infrastructure.
- [x] Fetch live track page; use detailed pasted requirements and document dynamic-page limitation.
- [x] Create responsive marketplace, dataset detail, permits, publisher, activity, and developer views.
- [x] Provide an explicitly labeled local demo with no account or funding prerequisites.
- [x] Implement Supabase live persistence, not local filesystem storage on Vercel.

## End-to-end product

- [x] Search and filter sample datasets; preview original illustrative records.
- [x] Publish validated JSON datasets with price, terms, version, and content digest.
- [x] Accept terms and acquire expiring, quota-limited permits.
- [x] Issue hashed tokens and rotate them; enforce expiry, revocation, and atomic gateway quotas.
- [x] Retrieve/download records; provide manual demo rubric and configured Qwen evaluation.
- [x] Display purchase/access receipts and optional Envio settlement receipts.
- [x] Revoke future gateway access; explain limits on previously downloaded data.
- [x] Persist demo state and allow reset.

## Monad and sponsor integrations

- [x] Mera: real passkey onboarding and signing, separate from demo sessions.
- [x] Wallet authentication: single-use challenge, signature recovery, HttpOnly session, rate limits.
- [x] Monad: ERC-20 permit contract, registration/receipt verification, and deployment script.
- [x] Envio: indexer configuration, purchase/revocation handlers, GraphQL adapter, receipt view.
- [x] Qwen: evaluation and tool-based procurement agent with human payment approval.
- [x] Record implementation/configuration/live verification separately in README and app.
- [x] PRF dataset encryption: implement separate HKDF-derived wrapping key, encrypted records, and publisher recovery.
- [x] Aurora Intents: implement headless cross-chain funding to Mera account, settlement status, and explicit purchase continuation.
- [x] Chainlink CRE: implement a real workflow that checks receipts and coordinates idempotent access provisioning.
- [x] Alchemy: implement server-side RPC for authoritative verification and account funding information.
- [x] Kimi: implement dataset quality review with clear permission before sending records to provider.
- [x] Qwen: connect recommended license to approved purchase and post-purchase evaluation.
- [x] Test encryption isolation/tampering, Aurora proxy input restrictions, workflow idempotency, and cross-chain boundaries.
- [x] Update README and sponsor evidence matrix for all eight requested integrations.
- [ ] Cleanverse: CVI/CVA movement flow, not implemented; no qualification claim.

## Verification and delivery

- [x] Initial type checking and production Next.js build.
- [x] Automated permit authorization, expiry, quota, revocation, validation, and digest tests.
- [x] Actual SQL atomic quota and access denial tests using PGlite.
- [x] Contract compilation and local EVM tests for payment, terms, payout, versions, and revocation.
- [x] Browser flow and desktop/mobile screenshots inspected; one selector fixed.
- [x] Final production-server browser/API regression: six tests pass under Node.js 24.
- [x] Final production Next.js build under Node.js 24; root/indexer/CRE dependency audits clean.
- [x] CRE SDK 1.23.0 workflow independently typechecked.
- [ ] CRE CLI simulation and deployed workflow: external CLI/account/secret required.
- [ ] Aurora funded mainnet quote/intent/settlement: external API key and supported token required.
- [x] Ten unit/database/contract tests pass under Node.js 24.
- [ ] Envio code generation/handler types: native Windows binary unavailable; requires WSL/Envio Cloud.
- [x] README, environment example, SQL schema, and Vercel setup.
- [x] Document credentials/funding/deployment still needed for live verification.
- [x] Prepare repeatable demonstration flow in README.
- [x] Write docs/demo-script.md with three-minute demo and submission evidence checklist.

## External setup and live verification

- [ ] Create Supabase project and apply hosted schema.
- [ ] Fund deployment account; deploy with a vetted Monad testnet token.
- [ ] Configure database, session, token, contract, RPC, and provider variables.
- [ ] Deploy to authenticated Vercel account and stable hostname.
- [ ] Create two supported-device Mera accounts and fund them.
- [ ] Publish, purchase, access, and revoke using real testnet transactions.
- [ ] Deploy/sync Envio and show indexed receipts.
- [ ] Configure exact sponsor Qwen model and show real tools/evaluation.
- [ ] Configure Kimi model and demonstrate a real quality review.
- [ ] Configure Alchemy and verify authoritative RPC reads.
- [ ] Verify passkey-based encrypted publisher recovery on a supported device.
- [ ] Deploy CRE and show pending → ready provisioning with recorded result.
- [ ] Verify Aurora mainnet funding → Monad settlement → approved permit purchase.
- [ ] Verify current eligibility and award stacking with organizers.

## Submission and startup launch

- [ ] Interview a dataset supplier and two prospective buyers.
- [ ] Replace illustrative sample data with a useful permissioned collection.
- [ ] Record live demo including transactions, gateway denial, and agent trace.
- [ ] Submit repository, deployed URL, contract address, and genuine sponsor evidence.
- [ ] Complete independent security review, operational recovery, and load testing.
- [ ] Verify supplier rights/license terms and secure a paid customer pilot.
