import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nabbMarketAbi } from "@nabb/config";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";
import {
  contractErrorName,
  describeError,
  isRateLimited,
  isTransientRpcError,
  isUserRejection,
} from "./errors";

/** An error shaped like the ones viem and wallets throw: a name, optional code/status, a cause. */
function err(
  name: string,
  props: {
    code?: number;
    status?: number;
    message?: string;
    shortMessage?: string;
    cause?: unknown;
  } = {},
) {
  return Object.assign(new Error(props.message ?? name), { name }, props);
}

function revert(errorName: string, args: readonly unknown[] = []) {
  const data = encodeErrorResult({
    abi: nabbMarketAbi,
    errorName: errorName as never,
    args: args as never,
  });
  return new ContractFunctionRevertedError({ abi: nabbMarketAbi, data, functionName: "claim" });
}

describe("contract reverts", () => {
  it("decodes the custom error name through wrapper errors", () => {
    const wrapped = err("ContractFunctionExecutionError", { cause: revert("SoldOut", [1n]) });
    assert.equal(contractErrorName(wrapped), "SoldOut");
    assert.match(describeError(wrapped), /sold out/i);
  });

  it("has a friendly message for every error NabbMarket can throw", () => {
    const names = nabbMarketAbi.filter((e) => e.type === "error").map((e) => e.name);
    assert.ok(names.length >= 12);
    for (const name of names) {
      const abiError = nabbMarketAbi.find((e) => e.type === "error" && e.name === name)!;
      const args = abiError.inputs.map((input) => (input.type === "uint256" ? 1n : 0n));
      const message = describeError(err("Wrapper", { cause: revert(name, args) }));
      assert.ok(!/reverted with|0x[0-9a-f]{8}/i.test(message), `${name}: ${message}`);
    }
  });
});

describe("wallet errors", () => {
  it("recognises a rejected signature by code or name, however deeply nested", () => {
    assert.equal(isUserRejection(err("X", { code: 4001 })), true);
    assert.equal(isUserRejection(err("Outer", { cause: err("UserRejectedRequestError") })), true);
    assert.equal(
      isUserRejection(err("Outer", { cause: err("Mid", { cause: err("Inner", { code: 4001 }) }) })),
      true,
    );
    assert.equal(
      describeError(err("UserRejectedRequestError")),
      "Request cancelled in your wallet.",
    );
    assert.equal(isUserRejection(err("Other")), false);
  });

  it("explains insufficient funds, a pending wallet request, bad nonces and chain-switch failures", () => {
    assert.match(
      describeError(err("X", { cause: err("InsufficientFundsError") })),
      /not enough eth/i,
    );
    assert.match(describeError(err("X", { code: -32002 })), /already has a request/i);
    assert.match(describeError(err("X", { cause: err("NonceTooLowError") })), /out of sync/i);
    assert.match(describeError(err("SwitchChainError")), /91342/);
    assert.match(describeError(err("X", { code: 4902 })), /91342/);
    assert.match(describeError(err("ConnectorNotFoundError")), /no browser wallet/i);
  });
});

describe("rpc failures", () => {
  it("treats HTTP 429 and JSON-RPC limit errors as rate limiting", () => {
    assert.equal(isRateLimited(err("HttpRequestError", { status: 429 })), true);
    assert.equal(isRateLimited(err("RpcRequestError", { code: -32005 })), true);
    assert.equal(isRateLimited(err("X", { message: "Too Many Requests" })), true);
    assert.match(describeError(err("HttpRequestError", { status: 429 })), /rate-limiting/i);
  });

  it("treats timeouts and unreachable RPCs as transient, with friendly text", () => {
    assert.equal(isTransientRpcError(err("TimeoutError")), true);
    assert.equal(isTransientRpcError(err("Wrap", { cause: err("HttpRequestError") })), true);
    assert.match(describeError(err("TimeoutError")), /too long/i);
    assert.match(describeError(err("HttpRequestError")), /couldn't reach/i);
  });

  it("never treats a contract revert or a rejection as transient", () => {
    assert.equal(isTransientRpcError(err("Wrap", { cause: revert("SoldOut", [1n]) })), false);
    assert.equal(isTransientRpcError(err("UserRejectedRequestError")), false);
    assert.equal(isTransientRpcError(err("Plain")), false);
  });
});

describe("unknown errors", () => {
  it("prefers viem's short message and truncates enormous ones", () => {
    assert.equal(describeError(err("X", { shortMessage: "short", message: "long" })), "short");
    const huge = describeError(err("X", { message: "x".repeat(10_000) }));
    assert.ok(huge.length <= 201);
    assert.equal(describeError(undefined), "Something went wrong.");
    assert.equal(describeError("a string"), "Something went wrong.");
  });
});
