import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeCallInputSchema } from "../make-call.tool";

const VALID_UUID = "00000000-0000-4000-8000-000000000000";

describe("makeCallInputSchema", () => {
  describe("valid E.164 phone numbers", () => {
    const validNumbers = ["+919876543210", "+12125551234", "+441234567890", "+1234"];

    for (const toNumber of validNumbers) {
      it(`accepts ${toNumber}`, () => {
        const result = makeCallInputSchema.safeParse({
          toNumber,
          userId: VALID_UUID,
        });
        assert.equal(result.success, true);
      });
    }
  });

  describe("invalid phone numbers", () => {
    const invalidNumbers = [
      { value: "9876543210", label: "missing +" },
      { value: "+0123456789", label: "starts with +0" },
      { value: "not-a-number", label: "alphabetic string" },
      { value: "", label: "empty string" },
      { value: "+", label: "plus sign only" },
      { value: "+1234567890123456", label: "exceeds 15 digits" },
    ];

    for (const { value, label } of invalidNumbers) {
      it(`rejects "${value}" (${label})`, () => {
        const result = makeCallInputSchema.safeParse({
          toNumber: value,
          userId: VALID_UUID,
        });
        assert.equal(result.success, false);
      });
    }
  });

  describe("error messages", () => {
    it("includes 'international format' in the error message", () => {
      const result = makeCallInputSchema.safeParse({
        toNumber: "9876543210",
        userId: VALID_UUID,
      });
      assert.equal(result.success, false);
      if (!result.success) {
        const messages = result.error.errors.map((e) => e.message).join(" ");
        assert.ok(
          messages.includes("international format"),
          `Expected error to mention "international format", got: ${messages}`,
        );
      }
    });
  });

  describe("userId validation", () => {
    it("rejects non-UUID userId", () => {
      const result = makeCallInputSchema.safeParse({
        toNumber: "+919876543210",
        userId: "not-a-uuid",
      });
      assert.equal(result.success, false);
    });
  });
});
