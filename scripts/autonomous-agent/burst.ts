// BURST MODE — runs N Managed Agents sessions sequentially, one per focus area.
// Designed for long GitHub Actions runs (timeout bumped to 6h in the workflow).
//
// Reads focus areas from ./focuses.json (array of strings).
// Between sessions, pulls latest from the branch so the next session sees
// the previous session's commits.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();

const ENV_ID = requireEnv("ANTHROPIC_ENV_ID");
const AGENT_ID = requireEnv("ANTHROPIC_AGENT_ID");
const GH_TOKEN = requireEnv("GH_PAT");
const MAX_CHANGES = process.env.MAX_CHANGES?.trim() || "5";
const RUN_ID = process.env.RUN_ID?.trim() || `burst-${Date.now()}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function runOne(sessionIndex: number, total: number, focus: string) {
  const label = `[${sessionIndex + 1}/${total}]`;
  console.log(`\n${"=".repeat(70)}\n${label} FOCUS: ${focus}\n${"=".repeat(70)}`);

  const session = await client.beta.sessions.create({
    agent: AGENT_ID,
    environment_id: ENV_ID,
    title: `${RUN_ID} — ${label} ${focus.slice(0, 60)}`,
    resources: [
      {
        type: "github_repository",
        url: "https://github.com/Fredb031/visionaffichage",
        mount_path: "/workspace/repo",
        authorization_token: GH_TOKEN,
        checkout: { type: "branch", name: "autonomous-improvements" },
      },
    ],
    metadata: {
      run_id: RUN_ID,
      source: "burst-mode",
      focus_index: String(sessionIndex),
    },
  });
  console.log(`${label} session: https://console.anthropic.com/sessions/${session.id}`);

  const kickoff = [
    `Session ${label} of burst run ${RUN_ID}.`,
    `Focus: ${focus}`,
    `Max files to change: ${MAX_CHANGES}.`,
    ``,
    `Previous sessions in this burst may have already committed to`,
    `autonomous-improvements. Start by pulling the latest state with`,
    `"git pull origin autonomous-improvements --rebase" to avoid conflicts.`,
    ``,
    `SHIP this session. If you find a legit issue matching the focus area,`,
    `fix it, validate with tsc, and push. Don't end without a commit unless`,
    `nothing shippable exists in this focus area.`,
  ].join("\n");

  const streamPromise = streamSession(session.id, label);
  await client.beta.sessions.events.send(session.id, {
    events: [{ type: "user.message", content: [{ type: "text", text: kickoff }] }],
  });
  await streamPromise;
}

async function streamSession(sessionId: string, label: string) {
  const stream = await client.beta.sessions.events.stream(sessionId);
  for await (const event of stream as AsyncIterable<any>) {
    switch (event.type) {
      case "agent.message": {
        for (const block of event.content ?? []) {
          if (block.type === "text" && block.text) process.stdout.write(block.text);
        }
        break;
      }
      case "agent.tool_use": {
        const name = event.tool_name || "tool";
        const s = summarize(name, event.input);
        console.log(`\n${label} [tool] ${name}${s ? ` — ${s}` : ""}`);
        break;
      }
      case "session.status_idle": {
        const stop = event.stop_reason?.type;
        if (stop && stop !== "requires_action") {
          console.log(`\n${label} --- idle (${stop}) ---`);
          return;
        }
        break;
      }
      case "session.status_terminated":
        console.log(`\n${label} --- terminated ---`);
        return;
      case "session.error":
        console.error(`\n${label} [error]`, JSON.stringify(event.error ?? event));
        break;
    }
  }
}

function summarize(tool: string, input: any): string {
  if (!input) return "";
  switch (tool) {
    case "bash":
      return trunc(input.command ?? "", 100);
    case "read":
    case "write":
    case "edit":
      return input.file_path ?? input.path ?? "";
    case "glob":
      return input.pattern ?? "";
    case "grep":
      return `${input.pattern ?? ""}${input.path ? ` @${input.path}` : ""}`;
    default:
      return "";
  }
}
function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Self-reschedule the next burst before this job ends, so the agent runs
// perpetually without depending solely on cron. Combined with the */20 min
// cron in the workflow, the agent never sits idle.
async function dispatchNextBurst() {
  const ghToken = process.env.GH_PAT;
  if (!ghToken) {
    console.warn("GH_PAT not set — skipping self-reschedule.");
    return;
  }
  const repo = "Fredb031/visionaffichage";
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/autonomous-agent.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { mode: "burst", max_changes: "5" },
        }),
      },
    );
    if (res.ok || res.status === 204) {
      console.log("Next burst dispatched — agent continues perpetually.");
    } else {
      const body = await res.text();
      console.warn(`Self-reschedule failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.warn("Self-reschedule errored:", err);
  }
}

async function main() {
  const focusesPath = join(__dirname, "focuses.json");
  const focuses: string[] = JSON.parse(readFileSync(focusesPath, "utf8"));
  console.log(`Burst run ${RUN_ID}: ${focuses.length} sessions queued.`);

  for (let i = 0; i < focuses.length; i++) {
    try {
      await runOne(i, focuses.length, focuses[i]);
    } catch (err: any) {
      console.error(`[${i + 1}/${focuses.length}] session failed:`, err?.message ?? err);
      // Continue to next focus — don't abort the whole burst on one failure
    }
  }

  console.log(`\nBurst run ${RUN_ID} complete.`);
  await dispatchNextBurst();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
