import { z } from "zod";
export function validateFunding(
  payload: unknown,
  owner: string,
  config: { destinationAsset: string; tokenAddress: string },
) {
  const input = z
    .object({
      version: z.literal("1.0"),
      type: z.literal("evm"),
      quote: z.object({
        originAsset: z.string().min(3).max(300),
        destinationAsset: z.literal(config.destinationAsset),
        amount: z.string().regex(/^[1-9]\d{0,25}$/),
        swapType: z.literal("EXACT_INPUT"),
        slippageTolerance: z.number().int().min(0).max(100),
        deadline: z.string().datetime(),
      }),
      steps: z
        .array(
          z.object({
            to: z.string(),
            functionSignature: z.literal("transfer(address,uint256)"),
            parameters: z.tuple([z.string(), z.literal("{MIN_AMOUNT_OUT}")]),
            value: z.literal("0"),
          }),
        )
        .length(1),
      metadata: z
        .object({
          title: z.literal("Fund DataPermit"),
          intent: z.literal("datapermit_fund"),
        })
        .passthrough(),
      dry: z.boolean(),
    })
    .parse(payload);
  if (
    input.steps[0].to.toLowerCase() !== config.tokenAddress.toLowerCase() ||
    input.steps[0].parameters[0].toLowerCase() !== owner
  )
    throw new Error("Funds must settle to your DataPermit account.");

  return input;
}
