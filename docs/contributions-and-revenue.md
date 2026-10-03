# Human contributions, dataset versions, and revenue

## Product flow

1. Open **Contributions → Company workspace**. Create a campaign with a brief and at least one independent expert wallet. The starter template contains 50 distinct 4×4 illustration layouts. Download/import question JSON to use your own HTTPS image assets. Keep those assets available at stable URLs and ensure you have rights to use them.
2. Contributors choose English, Hindi, Marathi, or Tamil, practice on an example, select images, and write an explanation for each question. **Save & next** saves progress locally; unsaved edits should be saved before jumping between questions. All 50 answers and explicit training/review consent are required for submission.
3. In live mode, the contributor signs a canonical answer hash with their Mera wallet. The server verifies that signature, binds the record to the signed-in account, and saves it once. Company and assigned expert wallets cannot contribute to their own campaign.
4. The company approves sharing answers with Qwen and clusters one question or all 50. Starting clustering permanently closes submissions, so reviewed clusters cannot become stale as new responses arrive. Qwen groups selections and explanation meaning within each question/language. Membership validation rejects omissions, duplicates, fabricated participants, and mixed-language groups. A failed question can be retried; previously saved questions are skipped.
5. Assigned experts inspect each question's images, selected positions, and original explanations. They accept or reject each cluster with notes and a wallet signature. The server checks assignment and independence. Reviews are immutable; the model's cluster label is not a correctness certification.
6. The company downloads accepted answers plus contributor and expert signatures, IDs, and hashes. Unreviewed/rejected answers stay in the audit history but are excluded from this export. **Prepare reviewed dataset for publishing** converts accepted rows into marketplace records and fills recipient wallets. At least three accepted rows are required. This action does not publish or spend funds; the company reviews rights, price, terms, version, and payout shares first.

The demo uses distinct simulated identities and deterministic grouping. It never fabricates Qwen output, signatures, money, or on-chain transactions. The training output is a reviewed dataset export; this app does not automatically fine-tune a model. Company/expert workspace labels are account roles, not proof of a legally registered company or professional certification.

## Compact on-chain state

One dataset family belongs to its company wallet. Each published version stores a family identifier, version hash, record-content hash, price, access terms, and a locked recipient schedule. The company is the owner of every subsequent version in that family. Changes to data, terms, or payout shares require a new version.

Only identifiers/hashes, ownership, recipient wallets/roles/shares, purchase permits, and accumulated earnings are stored on-chain. Questions, images, answers, clustering, and expert review records remain in the database/export. There is no question transaction, answer transaction, review transaction, or batch-anchor registry.

Recipient schedules are capped at **20 wallets per version** to bound storage and the purchase loop. Each recipient's wallet, basis points, and role fit into one packed Solidity storage slot. A schedule of 20 recipients still adds storage/gas; it is not free. The company chooses which recipients receive contractual revenue shares. All contribution attribution stays in the off-chain export even if a recipient has no payout allocation. Campaigns currently accept up to 20 complete contributor submissions and 10 assigned expert wallets; the combined payout roster must be reviewed against the 20-recipient limit. When preparing an export with more than 20 recipient wallets, the app proposes no allocation instead of dropping wallets silently.

## Purchase and payout accounting

Example: company 70%, contributor 25%, verifier 5%. Publish the recipients at 2,500 and 500 basis points; the company's 7,000-point share is the remainder. Total recipient shares cannot exceed 10,000. Wallets must be unique, nonzero, and different from the company.

The buyer approves the ERC-20 and purchases a particular version. The contract receives the payment and credits each recipient's cumulative `earnings`. The company receives the remainder, including indivisible rounding units. **Developer → Revenue & withdrawals** reads and withdraws the connected wallet's earnings. Each recipient signs their own withdrawal. No automatic transfer to every wallet occurs on purchase, and the company cannot withdraw someone else's balance.

Checks-effects-interactions and a shared reentrancy guard protect purchase/withdrawal. Failed transfers revert credits and permits. Purchases check the exact received token amount to reject fee-on-transfer behavior. Use a vetted standard boolean-returning ERC-20 that supports both `transferFrom` and `transfer`; rebasing and unusual token behavior are unsupported. This is locally tested code, not independently audited financial infrastructure.

## Live setup and migration

Apply the complete updated `supabase/schema.sql`; it adds campaign, contribution, cluster, review, dataset-family, and revenue-share storage. Only server service-role access is granted; public table policies remain disabled. Configure Qwen using the sponsor setup guide.

**Deploy a new DataPermit contract** using the updated compile/deploy scripts and set its address in Vercel and Envio. The old deployed contract cannot gain revenue sharing through a frontend update. If an existing deployment already has purchases, plan a migration or a separate database/indexer namespace; permit IDs restart in a new deployment. No live contract or database was migrated here.

Envio now indexes withdrawal events in addition to purchases/revocations; regenerate and redeploy its schema. Purchases represent accrued revenue; `EarningsWithdrawn` represents actual payout. Keep the content/provenance export backed up: on-chain payout attribution does not reproduce the original answers or signed reviews.

## Validation

Local EVM tests cover company ownership, version immutability, duplicate/excess shares, two purchases accumulating earnings, exact remainder accounting, withdrawals, unauthorized revocation, and preventing the legacy registration path from hijacking a company family. Domain tests cover all 50 image grids, answer completeness, cluster coverage/language isolation, independent-review export, and revenue validation. SQL tests cover role separation, duplicate submissions, campaign closing, and atomic question-cluster writes. Browser tests exercise the full demo from 50 answers to reviewed publishing and split earnings.
