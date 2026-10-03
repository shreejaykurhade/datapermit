import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import solc from "solc";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createVM, runTx } from "@ethereumjs/vm";
import { createLegacyTx } from "@ethereumjs/tx";
import {
  createAccount,
  createAddressFromPrivateKey,
  hexToBytes,
  bytesToHex,
} from "@ethereumjs/util";
import {
  encodeDeployData,
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
  encodeAbiParameters,
  toBytes,
  type Abi,
  type Hex,
} from "viem";
test("contract enforces payment, terms, unique versions and revocation authorization", async () => {
  const mock =
    'pragma solidity ^0.8.24; contract MockToken { mapping(address=>uint) public balanceOf; mapping(address=>mapping(address=>uint)) public allowance; function mint(address to,uint amount) external {balanceOf[to]+=amount;} function approve(address spender,uint amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;} function transfer(address to,uint amount) external returns(bool){require(balanceOf[msg.sender]>=amount,"insufficient");balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;} function transferFrom(address from,address to,uint amount) external returns(bool){require(balanceOf[from]>=amount && allowance[from][msg.sender]>=amount,"insufficient");balanceOf[from]-=amount;balanceOf[to]+=amount;allowance[from][msg.sender]-=amount;return true;}}';
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          "DataPermit.sol": {
            content: fs.readFileSync("contracts/DataPermit.sol", "utf8"),
          },
          "MockToken.sol": { content: mock },
        },
        settings: {
          viaIR: true,
          evmVersion: "cancun",
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const token = output.contracts["MockToken.sol"].MockToken,
    permit = output.contracts["DataPermit.sol"].DataPermit;
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
  const vm = await createVM({ common });
  const keys = [
    hexToBytes(`0x${"11".repeat(32)}`),
    hexToBytes(`0x${"22".repeat(32)}`),
    hexToBytes(`0x${"33".repeat(32)}`),
    hexToBytes(`0x${"44".repeat(32)}`),
  ];
  const addresses = keys.map(createAddressFromPrivateKey);
  for (const a of addresses)
    await vm.stateManager.putAccount(a, createAccount({ balance: 10n ** 22n }));
  async function send(who: number, data: Hex, to?: Hex) {
    const account = await vm.stateManager.getAccount(addresses[who]);
    const tx = createLegacyTx(
      {
        nonce: account?.nonce || 0n,
        gasLimit: 5000000n,
        gasPrice: 2000000000n,
        data,
        ...(to ? { to } : {}),
      },
      { common },
    ).sign(keys[who]);
    return runTx(vm, { tx });
  }
  async function invoke(
    who: number,
    address: Hex,
    abi: Abi,
    name: string,
    args: unknown[] = [],
  ) {
    return send(
      who,
      encodeFunctionData({ abi, functionName: name, args }),
      address,
    );
  }
  const tokenDeploy = await send(
    0,
    encodeDeployData({
      abi: token.abi,
      bytecode: `0x${token.evm.bytecode.object}`,
    }),
  );
  assert.equal(tokenDeploy.execResult.exceptionError, undefined);
  const tokenAddress = tokenDeploy.createdAddress!.toString() as Hex;
  const permitDeploy = await send(
    0,
    encodeDeployData({
      abi: permit.abi,
      bytecode: `0x${permit.evm.bytecode.object}`,
      args: [tokenAddress],
    }),
  );
  assert.equal(permitDeploy.execResult.exceptionError, undefined);
  const permitAddress = permitDeploy.createdAddress!.toString() as Hex;
  const id = keccak256(toBytes("original-v1")),
    terms = keccak256(toBytes("Evaluation only")),
    digest = keccak256(toBytes("records"));
  assert.equal(
    (
      await invoke(0, permitAddress, permit.abi, "registerDataset", [
        id,
        5n,
        604800n,
        100,
        digest,
        terms,
      ])
    ).execResult.exceptionError,
    undefined,
  );
  assert.ok(
    (
      await invoke(0, permitAddress, permit.abi, "registerDataset", [
        id,
        5n,
        604800n,
        100,
        digest,
        terms,
      ])
    ).execResult.exceptionError,
    "versions cannot be overwritten",
  );
  assert.ok(
    (await invoke(1, permitAddress, permit.abi, "purchase", [id, terms]))
      .execResult.exceptionError,
    "unfunded purchase must revert",
  );
  await invoke(0, tokenAddress, token.abi, "mint", [
    addresses[1].toString(),
    20n,
  ]);
  await invoke(1, tokenAddress, token.abi, "approve", [permitAddress, 5n]);
  assert.ok(
    (
      await invoke(1, permitAddress, permit.abi, "purchase", [
        id,
        keccak256(toBytes("wrong terms")),
      ])
    ).execResult.exceptionError,
    "wrong terms must revert",
  );
  const bought = await invoke(1, permitAddress, permit.abi, "purchase", [
    id,
    terms,
  ]);
  assert.equal(bought.execResult.exceptionError, undefined);
  assert.equal(bought.receipt.logs.length, 1);
  const credited = await invoke(0, permitAddress, permit.abi, "earnings", [
    addresses[0].toString(),
  ]);
  assert.equal(
    decodeFunctionResult({
      abi: permit.abi,
      functionName: "earnings",
      data: bytesToHex(credited.execResult.returnValue),
    }),
    5n,
  );
  assert.equal(
    (await invoke(0, permitAddress, permit.abi, "withdrawEarnings")).execResult
      .exceptionError,
    undefined,
  );
  assert.ok(
    (await invoke(0, permitAddress, permit.abi, "withdrawEarnings")).execResult
      .exceptionError,
    "double withdrawal denied",
  );
  const balance = await invoke(0, tokenAddress, token.abi, "balanceOf", [
    addresses[0].toString(),
  ]);
  assert.equal(
    decodeFunctionResult({
      abi: token.abi,
      functionName: "balanceOf",
      data: bytesToHex(balance.execResult.returnValue),
    }),
    5n,
  );
  assert.ok(
    (await invoke(2, permitAddress, permit.abi, "revoke", [1n])).execResult
      .exceptionError,
    "strangers cannot revoke",
  );
  assert.equal(
    (await invoke(0, permitAddress, permit.abi, "revoke", [1n])).execResult
      .exceptionError,
    undefined,
  );
  const state = await invoke(0, permitAddress, permit.abi, "permits", [1n]);
  const decoded = decodeFunctionResult({
    abi: permit.abi,
    functionName: "permits",
    data: bytesToHex(state.execResult.returnValue),
  }) as unknown[];
  assert.equal(decoded[4], true);
  const family = keccak256(toBytes("commercial-family")),
    v1 = keccak256(toBytes("1.0"));
  const versionId = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [family, v1],
    ),
  );
  const split = [
    { address: addresses[2].toString(), bps: 2500, role: 1 },
    { address: addresses[3].toString(), bps: 500, role: 2 },
  ].sort((a, b) => a.address.localeCompare(b.address));
  const registration = [
    family,
    v1,
    10003n,
    604800n,
    100,
    digest,
    terms,
    split.map((s) => s.address),
    split.map((s) => s.bps),
    split.map((s) => s.role),
  ];
  assert.equal(
    (
      await invoke(
        0,
        permitAddress,
        permit.abi,
        "registerVersion",
        registration,
      )
    ).execResult.exceptionError,
    undefined,
  );
  assert.ok(
    (
      await invoke(
        0,
        permitAddress,
        permit.abi,
        "registerVersion",
        registration,
      )
    ).execResult.exceptionError,
    "version split is immutable",
  );
  assert.ok(
    (
      await invoke(2, permitAddress, permit.abi, "registerVersion", [
        family,
        keccak256(toBytes("2.0")),
        100n,
        604800n,
        100,
        digest,
        terms,
        [],
        [],
        [],
      ])
    ).execResult.exceptionError,
    "stranger cannot publish company version",
  );
  assert.ok(
    (
      await invoke(2, permitAddress, permit.abi, "registerDataset", [
        family,
        5n,
        604800n,
        100,
        digest,
        terms,
      ])
    ).execResult.exceptionError,
    "legacy registration cannot hijack family ownership",
  );
  const badFamily = keccak256(toBytes("bad-family"));
  assert.ok(
    (
      await invoke(0, permitAddress, permit.abi, "registerVersion", [
        badFamily,
        v1,
        100n,
        604800n,
        100,
        digest,
        terms,
        split.map((s) => s.address),
        [9000, 9000],
        split.map((s) => s.role),
      ])
    ).execResult.exceptionError,
    "over allocation denied",
  );
  assert.ok(
    (
      await invoke(0, permitAddress, permit.abi, "registerVersion", [
        badFamily,
        v1,
        100n,
        604800n,
        100,
        digest,
        terms,
        [addresses[2].toString(), addresses[2].toString()],
        [1000, 1000],
        [1, 2],
      ])
    ).execResult.exceptionError,
    "duplicate recipient denied",
  );
  await invoke(0, tokenAddress, token.abi, "mint", [
    addresses[1].toString(),
    20006n,
  ]);
  await invoke(1, tokenAddress, token.abi, "approve", [permitAddress, 20006n]);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await invoke(1, permitAddress, permit.abi, "purchase", [
          versionId,
          terms,
        ])
      ).execResult.exceptionError,
      undefined,
    );
  for (const [who, expected] of [
    [0, 14006n],
    [2, 5000n],
    [3, 1000n],
  ] as const) {
    const earned = await invoke(who, permitAddress, permit.abi, "earnings", [
      addresses[who].toString(),
    ]);
    assert.equal(
      decodeFunctionResult({
        abi: permit.abi,
        functionName: "earnings",
        data: bytesToHex(earned.execResult.returnValue),
      }),
      expected,
    );
  }
  const liability = await invoke(
    0,
    permitAddress,
    permit.abi,
    "totalLiability",
  );
  assert.equal(
    decodeFunctionResult({
      abi: permit.abi,
      functionName: "totalLiability",
      data: bytesToHex(liability.execResult.returnValue),
    }),
    20006n,
  );
  assert.equal(
    (await invoke(3, permitAddress, permit.abi, "withdrawEarnings")).execResult
      .exceptionError,
    undefined,
  );
  const verifierBalance = await invoke(
    0,
    tokenAddress,
    token.abi,
    "balanceOf",
    [addresses[3].toString()],
  );
  assert.equal(
    decodeFunctionResult({
      abi: token.abi,
      functionName: "balanceOf",
      data: bytesToHex(verifierBalance.execResult.returnValue),
    }),
    1000n,
  );
  assert.equal(
    (
      await invoke(0, permitAddress, permit.abi, "registerVersion", [
        family,
        keccak256(toBytes("2.0")),
        100n,
        604800n,
        100,
        digest,
        terms,
        [],
        [],
        [],
      ])
    ).execResult.exceptionError,
    undefined,
    "company can publish a new version without changing older terms",
  );
});
