import { z } from "zod";
export const revenueShareSchema = z.object({
  recipient: z
    .string()
    .regex(/^0x[\da-fA-F]{40}$/)
    .transform((a) => a.toLowerCase())
    .refine((a) => a !== "0x" + "0".repeat(40), "Recipient cannot be zero."),
  bps: z.number().int().min(1).max(10000),
  role: z.enum(["contributor", "verifier"]),
});
export type RevenueShare = z.infer<typeof revenueShareSchema>;
export const revenueSharesSchema = z
  .array(revenueShareSchema)
  .max(20)
  .default([])
  .superRefine((shares, ctx) => {
    if (new Set(shares.map((s) => s.recipient)).size !== shares.length)
      ctx.addIssue({
        code: "custom",
        message: "Each recipient wallet can appear only once.",
      });
    if (shares.reduce((sum, s) => sum + s.bps, 0) > 10000)
      ctx.addIssue({
        code: "custom",
        message: "Recipient shares cannot exceed 100%.",
      });
  })
  .transform((s) =>
    [...s].sort((a, b) => a.recipient.localeCompare(b.recipient)),
  );
export function validateShares(shares: unknown, company: string) {
  const parsed = revenueSharesSchema.parse(shares);
  if (parsed.some((s) => s.recipient === company.toLowerCase()))
    throw new Error(
      "Company receives the remainder automatically; do not list it as a recipient.",
    );
  return parsed;
}
export function allocateRevenue(
  amount: bigint,
  shares: RevenueShare[],
  company: string,
) {
  const result = shares.map((s) => ({
    recipient: s.recipient,
    amount: (amount * BigInt(s.bps)) / 10000n,
    role: s.role,
  }));
  return [
    ...result,
    {
      recipient: company,
      amount: amount - result.reduce((sum, s) => sum + s.amount, 0n),
      role: "company",
    },
  ];
}
