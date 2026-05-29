import test from "node:test";
import assert from "node:assert/strict";
import { askRunPodBartender } from "../lib/chat/runpodNpc.ts";

test("askRunPodBartender - missing api key returns warning", async () => {
  const originalApiKey = process.env.RUNPOD_API_KEY;
  delete process.env.RUNPOD_API_KEY;

  try {
    const result = await askRunPodBartender("Hello");
    assert.ok(result.includes("Missing API Key"), "Should return warning about missing API key");
  } finally {
    process.env.RUNPOD_API_KEY = originalApiKey;
  }
});

test("askRunPodBartender - successfully triggers and polls runpod serverless job", async () => {
  const originalApiKey = process.env.RUNPOD_API_KEY;
  process.env.RUNPOD_API_KEY = "mocked-runpod-key";

  const originalFetch = global.fetch;
  let fetchCalls: { url: string; method: string; body?: string }[] = [];
  let pollCount = 0;

  // Intercept fetch calls to simulate RunPod Serverless API transitions
  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? String(init.body) : undefined;
    
    fetchCalls.push({ url, method, body });

    if (url.endsWith("/run")) {
      return new Response(JSON.stringify({ id: "job_xyz123", status: "IN_QUEUE" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (url.includes("/status/job_xyz123")) {
      pollCount++;
      if (pollCount === 1) {
        return new Response(JSON.stringify({ id: "job_xyz123", status: "IN_QUEUE" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else if (pollCount === 2) {
        return new Response(JSON.stringify({ id: "job_xyz123", status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        return new Response(JSON.stringify({
          id: "job_xyz123",
          status: "COMPLETED",
          output: {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Stop bothering me, kid."
                }
              }
            ]
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  };

  try {
    const result = await askRunPodBartender("Give me a beer");
    
    // Assertions
    assert.equal(result, "Stop bothering me, kid.", "Should parse the vLLM output content correctly");
    assert.equal(fetchCalls.length, 4, "Should have made 4 HTTP calls (1 to trigger, 3 to poll)");
    assert.equal(fetchCalls[0].method, "POST", "First call should be POST to /run");
    assert.ok(fetchCalls[0].body?.includes("Give me a beer"), "POST body should contain user message");
    
    for (let i = 1; i < 4; i++) {
      assert.equal(fetchCalls[i].method, "GET", `Call ${i} should be GET to status endpoint`);
      assert.ok(fetchCalls[i].url.endsWith("/status/job_xyz123"), "Should hit correct job status URL");
    }
  } finally {
    process.env.RUNPOD_API_KEY = originalApiKey;
    global.fetch = originalFetch;
  }
});

test("askRunPodBartender - sanitizes HTML, outer quotes, and Gemma markup", async () => {
  const originalApiKey = process.env.RUNPOD_API_KEY;
  process.env.RUNPOD_API_KEY = "mocked-runpod-key";

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
      const url = String(input);
      if (url.endsWith("/run")) {
        return new Response(JSON.stringify({ id: "job_messy", status: "IN_QUEUE" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/status/job_messy")) {
        return new Response(JSON.stringify({
          id: "job_messy",
          status: "COMPLETED",
          output: scenario.raw
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    };

    try {
      const result = await askRunPodBartender("Hello");
      assert.equal(result, scenario.expected, `Messy output [${scenario.raw}] should be correctly sanitized`);
    } catch (e) {
      process.env.RUNPOD_API_KEY = originalApiKey;
      global.fetch = originalFetch;
      throw e;
    }
  }

  process.env.RUNPOD_API_KEY = originalApiKey;
  global.fetch = originalFetch;
});

