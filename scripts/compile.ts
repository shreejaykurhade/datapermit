import fs from "node:fs";
import solc from "solc";
export function compile() {
  const source = fs.readFileSync("contracts/DataPermit.sol", "utf8");
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "DataPermit.sol": { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun",
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const errors = (output.errors || []).filter(
    (e: { severity: string }) => e.severity === "error",
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
  return output.contracts["DataPermit.sol"].DataPermit;
}
const artifact = compile();
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  "artifacts/DataPermit.json",
  JSON.stringify(
    { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` },
    null,
    2,
  ),
);
console.log("Compiled DataPermit → artifacts/DataPermit.json");
