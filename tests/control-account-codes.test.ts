import { test } from "node:test";
import assert from "node:assert/strict";
import { getControlCodes } from "../lib/api/control-account-codes";

test("getControlCodes falls back to generic codes for US and unmapped countries", () => {
  for (const cc of [null, undefined, "US", "GB", "ZZ"]) {
    const codes = getControlCodes(cc);
    assert.equal(codes.ar, "1200");
    assert.equal(codes.ap, "2100");
    assert.equal(codes.outputVat, "2200");
    assert.equal(codes.inputVat, "1500");
  }
});

test("getControlCodes returns FR's real PCG codes", () => {
  const codes = getControlCodes("FR");
  assert.equal(codes.ar, "411");
  assert.equal(codes.ap, "401");
  assert.equal(codes.outputVat, "4457");
  assert.equal(codes.inputVat, "4456");
});

test("getControlCodes returns MA's real PCGE codes", () => {
  const codes = getControlCodes("ma");
  assert.equal(codes.ar, "3421");
  assert.equal(codes.ap, "4411");
  assert.equal(codes.outputVat, "4455");
  assert.equal(codes.inputVat, "3455");
});

test("getControlCodes maps only ar/ap for BR (no unified VAT concept), VAT fields inherit the generic fallback", () => {
  const codes = getControlCodes("BR");
  assert.equal(codes.ar, "1.1.04");
  assert.equal(codes.ap, "2.1.01");
  assert.equal(codes.outputVat, "2200");
  assert.equal(codes.inputVat, "1500");
});
