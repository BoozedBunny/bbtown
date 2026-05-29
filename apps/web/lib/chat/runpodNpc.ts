const RUNPOD_ENDPOINT_URL = "https://api.runpod.ai/v2/j4tzv3jckwjp99";

/**
 * Sends a prompt to the RunPod serverless vLLM Gemma instance and polls until the job is completed.
 */
export async function askRunPodBartender(userMessage: string): Promise<string> {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    console.error("[RunPod NPC] Missing RUNPOD_API_KEY environment variable.");
    return "I'm too grumpy to talk right now. (Missing API Key)";
  }

  try {
    // 1. Trigger the RunPod Serverless Job
    const runUrl = `${RUNPOD_ENDPOINT_URL}/run`;
    const runResponse = await fetch(runUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          messages: [
            {
              role: "system",
              content:
                "You are a grumpy, cynical bartender in a 3D browser game called BBTown. You are very easily annoyed. Keep your responses short, snappy, and irritated.",
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          max_tokens: 120,
          temperature: 0.8,
        },
      }),
    });

    if (!runResponse.ok) {
      throw new Error(`Failed to initialize RunPod job: ${runResponse.status} ${runResponse.statusText}`);
    }

    const jobData = (await runResponse.json()) as { id: string; status: string };
    const jobId = jobData.id;

    if (!jobId) {
      throw new Error("Did not receive a job ID from RunPod.");
    }

    console.log(`[RunPod NPC] Job created successfully. Job ID: ${jobId}. Polling status...`);

    // 2. Poll the status of the job
    const statusUrl = `${RUNPOD_ENDPOINT_URL}/status/${jobId}`;
    const maxRetries = 30; // 30 seconds max
    let retries = 0;

    while (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s
      retries++;

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.warn(`[RunPod NPC] Polling status failed (${statusResponse.status}). Retrying...`);
        continue;
      }

      const statusData = (await statusResponse.json()) as {
        id: string;
        status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
        output?: any;
        error?: string;
      };

      console.log(`[RunPod NPC] Polling (${retries}/${maxRetries}): status is "${statusData.status}"`);

      if (statusData.status === "COMPLETED") {
        const output = statusData.output;
        if (!output) {
          throw new Error("Job completed but returned no output.");
        }

        // Parse the vLLM output format robustly
        let replyText = "";
        if (typeof output === "string") {
          replyText = output.trim();
        } else if (output?.choices?.[0]?.message?.content) {
          replyText = output.choices[0].message.content.trim();
        } else if (output?.text) {
          replyText = output.text.trim();
        } else {
          replyText = JSON.stringify(output);
        }

        return replyText || "Hmph. I've got nothing to say.";
      }

      if (statusData.status === "FAILED") {
        throw new Error(`Job failed: ${statusData.error ?? "Unknown error"}`);
      }

      if (statusData.status === "CANCELLED") {
        throw new Error("Job was cancelled on RunPod.");
      }
    }

    throw new Error("Polling timed out. The bartender is ignoring you.");
  } catch (error: any) {
    console.error("[RunPod NPC] Error communicating with AI Bartender:", error);
    return `*grumbles and cleans a glass* (Error: ${error?.message ?? "Connection failed"})`;
  }
}
