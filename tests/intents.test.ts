import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFunding } from "../src/lib/intents-policy";
const owner = "0x1111111111111111111111111111111111111111";
const config = {
  destinationAsset: "nep141:monad-token.omft.near",
  tokenAddress: "0x2222222222222222222222222222222222222222",
};
const payload = {
  version: "1.0",
  type: "evm",
  quote: {
    originAsset: "nep141:base-token.omft.near",
    destinationAsset: config.destinationAsset,
    amount: "1000000",
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    deadline: new Date(Date.now() + 60000).toISOString(),
  },
  steps: [
    {
      to: config.tokenAddress,
      functionSignature: "transfer(address,uint256)",
      parameters: [owner, "{MIN_AMOUNT_OUT}"],
      value: "0",
    },
  ],
  metadata: { title: "Fund DataPermit", intent: "datapermit_fund" },
  dry: true,
};
test("Aurora proxy permits only configured settlement token and signed-in recipient", () => {
  assert.equal(validateFunding(payload, owner, config).dry, true);
  const wrongRecipient = structuredClone(payload);
  wrongRecipient.steps[0].parameters[0] = config.tokenAddress;
  assert.throws(() => validateFunding(wrongRecipient, owner, config));
  const wrongToken = structuredClone(payload);
  wrongToken.steps[0].to = owner;
  assert.throws(() => validateFunding(wrongToken, owner, config));
  const wrongAsset = structuredClone(payload);
  wrongAsset.quote.destinationAsset = "other-chain";
  assert.throws(() => validateFunding(wrongAsset, owner, config));
  const extraCall = structuredClone(payload);
  extraCall.steps.push(payload.steps[0]);
  assert.throws(() => validateFunding(extraCall, owner, config));
  const arbitraryCall = structuredClone(payload);
  arbitraryCall.steps[0].functionSignature = "approve(address,uint256)";
  assert.throws(() => validateFunding(arbitraryCall, owner, config));
  const excessiveSlippage = structuredClone(payload);
  excessiveSlippage.quote.slippageTolerance = 1000;
  assert.throws(() => validateFunding(excessiveSlippage, owner, config));
});
