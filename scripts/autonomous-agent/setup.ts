// ONE-TIME SETUP — run once locally to create the Managed Agent + Environment
// in the Anthropic console. Store the returned IDs as GitHub Actions secrets.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx setup.ts
//
// After running, add these as repo secrets in
// https://github.com/Fredb031/visionaffichage/settings/secrets/actions:
//   ANTHROPIC_ENV_ID      (from the output)
//   ANTHROPIC_AGENT_ID    (from the output)
//   ANTHROPIC_API_KEY     (your existing API key)
//   GH_PAT                (a GitHub PAT with `repo` scope — the agent uses this
//                          to clone + push to the autonomous-improvements branch)

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Anthropic();

const SYSTEM_PROMPT = readFileSync(join(__dirname, "SYSTEM_PROMPT.md"), "utf8");
const IDS_FILE = join(__dirname, ".agent-ids.json");

type AgentIds = {
  environment_id: string;
  agent_id: string;
  agent_version: number | string;
};

async function main() {
  const existing: Partial<AgentIds> = existsSync(IDS_FILE)
    ? JSON.parse(readFileSync(IDS_FILE, "utf8"))
    : {};

  let environment_id = existing.environment_id;
  if (!environment_id) {
    console.log("Creating environment...");
    const environment = await client.beta.environments.create({
      name: "vision-affichage-env",
      config: {
        type: "cloud",
        networking: { type: "unrestricted" },
      },
    });
    environment_id = environment.id;
    console.log(`  env_id: ${environment_id}`);
  } else {
    console.log(`Reusing existing environment: ${environment_id}`);
  }

  let agent_id = existing.agent_id;
  let agent_version: number | string | undefined = existing.agent_version;

  if (!agent_id) {
    console.log("Creating agent...");
    const agent = await client.beta.agents.create({
      name: "Vision Affichage Site Improver",
      description:
        "Autonomous Claude Opus 4.7 agent that audits and incrementally improves the Vision Affichage merch studio website. Runs on a 6-hour GitHub Actions cron.",
      model: "claude-opus-4-7",
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "agent_toolset_20260401",
          default_config: { enabled: true },
        },
      ],
      metadata: {
        project: "vision-affichage",
        repo: "Fredb031/visionaffichage",
      },
    });
    agent_id = agent.id;
    agent_version = agent.version;
    console.log(`  agent_id: ${agent_id}`);
    console.log(`  agent_version: ${agent_version}`);
  } else {
    console.log(`Updating existing agent: ${agent_id}`);
    const current = await client.beta.agents.retrieve(agent_id);
    const updated = await client.beta.agents.update(agent_id, {
      version: current.version,
      system: SYSTEM_PROMPT,
      model: "claude-opus-4-7",
      tools: [
        {
          type: "agent_toolset_20260401",
          default_config: { enabled: true },
        },
      ],
    });
    agent_version = updated.version;
    console.log(`  new version: ${agent_version}`);
  }

  const ids: AgentIds = {
    environment_id,
    agent_id,
    agent_version: agent_version!,
  };
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));

  console.log("\n✅ Setup complete.");
  console.log("\nAdd these as GitHub repo secrets:");
  console.log(`  ANTHROPIC_ENV_ID   = ${environment_id}`);
  console.log(`  ANTHROPIC_AGENT_ID = ${agent_id}`);
  console.log("\nAlso needed (if not already set):");
  console.log("  ANTHROPIC_API_KEY  = your console.anthropic.com API key");
  console.log(
    "  GH_PAT             = a GitHub PAT with `repo` scope (for clone + push)",
  );
  console.log(
    "\nThe agent is visible at: https://console.anthropic.com/agents",
  );
  console.log(`IDs also saved locally at: ${IDS_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
