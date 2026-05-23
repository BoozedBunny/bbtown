import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { doWork } from "../app/actions/work.ts";
import { prisma } from "../lib/prisma.ts";

test("doWork action", async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  await t.test("throws error in production", async () => {
    process.env.NODE_ENV = "production";

    await assert.rejects(
      doWork(),
      /Go to Work is not available in production\./
    );
  });

});