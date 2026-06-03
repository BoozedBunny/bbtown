import test from "node:test";
import assert from "node:assert/strict";
import { askRunPodBartender } from "../lib/chat/runpodNpc.ts";

test("askRunPodBartender - missing api key returns warning", async () => {
  const originalApiKey = process.env.LOCAL_GEMMA_KEY;
  delete process.env.LOCAL_GEMMA_KEY;

  try {
    const result = await askRunPodBartender("Hello");
    assert.ok(result.includes("Missing Local API Key"), "Should return warning about missing local API key");
  } finally {
    process.env.LOCAL_GEMMA_KEY = originalApiKey;
  }
});

test("askRunPodBartender - successfully triggers local Gemma proxy", async () => {
  const originalApiKey = process.env.LOCAL_GEMMA_KEY;
  process.env.LOCAL_GEMMA_KEY = "mocked-gemma-key";

  const originalFetch = global.fetch;
  let fetchCalls: { url: string; method: string; headers?: Record<string, string>; body?: string }[] = [];

  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? String(init.body) : undefined;
    const headers = init?.headers as Record<string, string>;
    
    fetchCalls.push({ url, method, headers, body });

    if (url.includes("/api/chat")) {
      return new Response(JSON.stringify({
        message: {
          role: "assistant",
          content: "Get lost."
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  };

  try {
    const result = await askRunPodBartender("Give me a milkshake");
    
    // Assertions
    assert.equal(result, "Get lost.", "Should parse the local Gemma output content correctly");
    assert.equal(fetchCalls.length, 1, "Should have made exactly 1 HTTP call to the proxy");
    assert.equal(fetchCalls[0].method, "POST", "Call should be POST");
    assert.equal(fetchCalls[0].url, "https://agent.boozedbunnytown.com/api/chat", "Should call local gemma proxy URL");
    
    // Check headers
    assert.equal(fetchCalls[0].headers?.["X-API-Key"], "mocked-gemma-key", "Should set X-API-Key header correctly");
    
    // Check body
    const bodyObj = JSON.parse(fetchCalls[0].body || "{}");
    assert.equal(bodyObj.character.id, "barkeeper_benny", "Character ID should match");
    assert.equal(bodyObj.character.name, "Barkeeper Benny", "Character Name should match");
    assert.equal(bodyObj.model, "gemma2:latest", "Model should match global default");
    assert.equal(bodyObj.player_name, "Player", "Player name should default to Player");
    assert.equal(bodyObj.messages[0].role, "user", "Should wrap prompt in user role");
    assert.ok(bodyObj.messages[0].content.includes("Give me a milkshake"), "Body should contain user message");
  } finally {
    process.env.LOCAL_GEMMA_KEY = originalApiKey;
    global.fetch = originalFetch;
  }
});

test("askRunPodBartender - sanitizes HTML, outer quotes, and Gemma markup", async () => {
  const originalApiKey = process.env.LOCAL_GEMMA_KEY;
  process.env.LOCAL_GEMMA_KEY = "mocked-gemma-key";

  const originalFetch = global.fetch;

  const messyOutputs = [
    {
      raw: `</start_of_turn> <p>Milkshake? Look, I don't have time to listen to your questions. Just'elling it. </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p> </p>`,
      expected: "Milkshake? Look, I don't have time to listen to your questions. Just'elling it."
    },
    {
      raw: `"Ugh, yeah. Now quit wasting my time & just order something already!"`,
      expected: "Ugh, yeah. Now quit wasting my time & just order something already!"
    },
    {
      raw: `Bartender: "Ugh, scram!"`,
      expected: "Ugh, scram!"
    },
    {
      raw: `<start_of_turn>model\nUgh, be quiet.<end_of_turn>`,
      expected: "Ugh, be quiet."
    }
  ];

  for (const scenario of messyOutputs) {
    global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      return new Response(JSON.stringify({
        message: {
          role: "assistant",
          content: scenario.raw
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    try {
      const result = await askRunPodBartender("Hello");
      assert.equal(result, scenario.expected, `Messy output [${scenario.raw}] should be correctly sanitized`);
    } catch (e) {
      process.env.LOCAL_GEMMA_KEY = originalApiKey;
      global.fetch = originalFetch;
      throw e;
    }
  }

  process.env.LOCAL_GEMMA_KEY = originalApiKey;
  global.fetch = originalFetch;
});


