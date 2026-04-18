// RUNTIME — called by GitHub Actions on cron. Creates a Managed Agents session,
// streams events to stdout, exits when the session finishes or errors.
//
// Required env vars:
//   ANTHROPIC_API_KEY    — Anthropic API key
//   ANTHROPIC_ENV_ID     — from setup.ts
//   ANTHROPIC_AGENT_ID   — from setup.ts
//   GH_PAT               — GitHub PAT with repo scope (for clone + push)
//
// Optional env vars:
//   FOCUS                — human-provided focus area for this run
//   MAX_CHANGES          — soft cap on files changed (default 3)
//   RUN_ID               — GitHub Actions run id, for traceability

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const ENV_ID = requireEnv("ANTHROPIC_ENV_ID");
const AGENT_ID = requireEnv("ANTHROPIC_AGENT_ID");
const GH_TOKEN = requireEnv("GH_PAT");
const FOCUS = process.env.FOCUS?.trim() ?? "";
const MAX_CHANGES = process.env.MAX_CHANGES?.trim() || "3";
const RUN_ID = process.env.RUN_ID?.trim() || `local-${Date.now()}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  console.log(`[run ${RUN_ID}] creating session...`);
  const session = await client.beta.sessions.create({
    agent: AGENT_ID,
    environment_id: ENV_ID,
    title: `Autonomous improvement — run ${RUN_ID}`,
    resources: [
      {
        type: "github_repository",
        url: "https://github.com/Fredb031/shopify-merch-studio",
        mount_path: "/workspace/repo",
        authorization_token: GH_TOKEN,
        checkout: { type: "branch", name: "autonomous-improvements" },
      },
    ],
    metadata: {
      run_id: RUN_ID,
      source: "github-actions-cron",
      focus: FOCUS || "unspecified",
    },
  });
  console.log(`[run ${RUN_ID}] session_id: ${session.id}`);
  console.log(`[run ${RUN_ID}] console: https://console.anthropic.com/sessions/${session.id}`);

  const kickoff = [
    `Autonomous run ${RUN_ID}.`,
    `Max files to change this session: ${MAX_CHANGES}.`,
    FOCUS
      ? `Focus for this run: ${FOCUS}`
      : `No specific focus — pick the highest-impact improvement you can identify.`,
    ``,
    `Workspace is at /workspace/repo. Follow the workflow in your system prompt:`,
    `orient → audit → plan → implement → validate (tsc) → commit → push.`,
    ``,
    `If there's nothing worth shipping, say so clearly and stop. Don't invent work.`,
  ].join("\n");

  // Stream-first: open the stream before sending the kickoff
  const streamPromise = streamSession(session.id);
  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: kickoff }],
      },
    ],
  });

  await streamPromise;
  console.log(`[run ${RUN_ID}] done.`);
}

async function streamSession(sessionId: string) {
  const stream = await client.beta.sessions.events.stream(sessionId);
  let currentToolName = "";

  for await (const event of stream as AsyncIterable<any>) {
    switch (event.type) {
      case "agent.message": {
        const blocks = event.content ?? [];
        for (const block of blocks) {
          if (block.type === "text" && block.text) {
            process.stdout.write(block.text);
          }
        }
        break;
      }
      case "agent.thinking":
        // Thinking events happen frequently — skip verbose logging.
        break;
      case "agent.tool_use": {
        currentToolName = event.tool_name || event.name || "tool";
        const summary = summarizeToolInput(currentToolName, event.input);
        console.log(`\n[tool] ${currentToolName}${summary ? ` — ${summary}` : ""}`);
        break;
      }
      case "agent.custom_tool_use":
        console.log(
          `\n[custom-tool] ${event.tool_name} (not expected — no custom tools configured)`,
        );
        break;
      case "session.status_idle": {
        const stopType = event.stop_reason?.type;
        if (stopType && stopType !== "requires_action") {
          console.log(`\n--- idle (stop_reason: ${stopType}) ---`);
          return;
        }
        break;
      }
      case "session.status_terminated":
        console.log("\n--- session terminated ---");
        return;
      case "session.error":
        console.error("\n[session.error]", JSON.stringify(event.error ?? event, null, 2));
        break;
      case "span.model_request_end":
        if (event.usage) {
          const u = event.usage;
          console.log(
            `\n[usage] in:${u.input_tokens ?? "?"} out:${u.output_tokens ?? "?"} cache_read:${u.cache_read_input_tokens ?? 0}`,
          );
        }
        break;
      default:
        break;
    }
  }
}

function summarizeToolInput(toolName: string, input: any): string {
  if (!input || typeof input !== "object") return "";
  switch (toolName) {
    case "bash":
      return truncate(input.command ?? "", 120);
    case "read":
    case "write":
    case "edit":
      return input.file_path ?? input.path ?? "";
    case "glob":
      return input.pattern ?? "";
    case "grep":
      return `${input.pattern ?? ""}${input.path ? ` in ${input.path}` : ""}`;
    case "web_fetch":
    case "web_search":
      return input.url ?? input.query ?? "";
    default:
      return "";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
