const RUNPOD_ENDPOINT_URL = "https://api.runpod.ai/v2/3n3lyfjnhcbz2p";

/**
 * Sends a prompt to the RunPod serverless Gemma instance and polls until the job is completed.
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
    const systemInstructions = "You are a grumpy, cynical bartender in a 3D browser game called BBTown. You are very easily annoyed. Keep your responses short, snappy, irritated, and always in English.";
    const prompt = `<start_of_turn>user\n${systemInstructions}\n\nCustomer: "${userMessage}"<end_of_turn>\n<start_of_turn>model\n`;

    const runResponse = await fetch(runUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: {
          prompt,
          max_new_tokens: 120,
          temperature: 0.85,
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

        // Parse the vLLM output format robustly, including unwrapping arrays
        const target = Array.isArray(output) ? output[0] : output;
        
        let replyText = "";
        if (typeof target === "string") {
          replyText = target.trim();
        } else if (target?.choices?.[0]?.tokens?.[0]) {
          replyText = target.choices[0].tokens[0].trim();
        } else if (target?.choices?.[0]?.message?.content) {
          replyText = target.choices[0].message.content.trim();
        } else if (target?.choices?.[0]?.text) {
          replyText = target.choices[0].text.trim();
        } else if (target?.text) {
          replyText = target.text.trim();
        } else {
          replyText = JSON.stringify(output);
        }

        // Clean up any turn markup or prompt echo
        if (replyText.includes("<start_of_turn>") || replyText.includes("<end_of_turn>")) {
          const parts = replyText.split(/<start_of_turn>model|<start_of_turn>assistant|<start_of_turn>|<end_of_turn>|thought/);
          const cleanPart = parts.map(p => p.trim()).filter(p => p && !p.startsWith("0") && p.length > 2).pop();
          if (cleanPart) {
            replyText = cleanPart;
          }
        }
        
        // Remove trailing thought blocks or echo of "Bartender:"
        replyText = replyText.replace(/^(Bartender|thought|model|assistant|system)\b[\s*:\n]*/i, "").trim();

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
