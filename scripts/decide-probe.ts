/**
 * Development-only probe for ticket 43's manual real-model run: asks jev, on
 * the Vercel AI Gateway, which Choice one Response takes on the e2e
 * fixture's queue Step, and prints what a live Run would have done with the
 * answer.
 *
 *   pnpm decide:probe "I keep my eyes down and hold out my papers."
 *
 * The key comes from the developer's own `.env.local` (or the process
 * environment), loaded exactly as the e2e setup loads it; this script never
 * prints it. The Step is built here rather than imported from `e2e/`, since
 * scripts import only `src/lib/graph` and `src/lib/ai` — it mirrors
 * `decidingDocument()`'s queue Step: same title, content, Prompt, and
 * Choices. Nothing is read from or written to a database.
 */

import { config } from "dotenv";

import {
  DECISION_THRESHOLD,
  decideChoice,
  gatewayJudge,
} from "@/lib/ai/decide";
import type { Step } from "@/lib/graph/document";

config({ path: ".env.local" });

const queueStep: Step = {
  id: "queue",
  title: "Still waiting",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "The line inches forward, then stops again." },
        ],
      },
    ],
  },
  choices: [
    {
      id: "choice-papers",
      label: "Show your papers",
      targetStepId: "waved-through",
      condition: null,
      effect: null,
    },
    {
      id: "choice-give-up",
      label: "Leave the queue",
      targetStepId: "turned-back",
      condition: null,
      effect: null,
    },
  ],
  prompt: {
    type: "free_text",
    label: "What do you do when the officer looks up?",
    required: true,
    decides: true,
  },
  outcomeId: null,
  position: null,
};

async function main(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error(
      "decide:probe: AI_GATEWAY_API_KEY is not set (checked .env.local and the process environment). Add it to .env.local and run again.",
    );
    process.exit(2);
  }

  const response = process.argv[2];
  if (!response || response.trim().length === 0) {
    console.error(
      'decide:probe: pass the Response to judge, e.g. pnpm decide:probe "I show my papers."',
    );
    process.exit(1);
  }

  const decision = await decideChoice(queueStep, response.trim(), gatewayJudge);

  console.log(JSON.stringify({ response: response.trim(), decision }, null, 2));
  if (decision.kind === "confident") {
    console.log(
      `A live Run would have advanced along "${decision.choiceId}" (probability ${decision.probability} >= ${DECISION_THRESHOLD}).`,
    );
  } else if (decision.kind === "weak") {
    console.log(
      `A live Run would have asked, with "${decision.choiceId}" suggested (probability ${decision.probability} < ${DECISION_THRESHOLD}).`,
    );
  } else {
    console.log(
      "A live Run would have asked, with nothing suggested (the judge had no usable answer).",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
