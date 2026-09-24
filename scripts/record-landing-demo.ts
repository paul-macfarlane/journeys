/**
 * Records the landing page's canvas demo and the feature stills, from seeded
 * content only (ticket 38, 54's stills, and 58's demo Journey): by default
 * from `The Allotment`, the ten-Step Journey made for it, or with
 * `--source journey-stories` from Medha's three cases.
 *
 * The whole thing is reproducible: run it again after any canvas or page
 * change and every file under `public/demo/` is rewritten. Per theme it
 * writes `canvas-<scheme>.webm` (about twenty seconds of the map: open two
 * Steps in the panel, drag a Choice onto bare map to make a Step, fit the
 * view, turn the map), `canvas-<scheme>.png` (the first frame, the poster),
 * and six 1280 × 720 stills: `versions`, `run`, `analytics`, `prompt`,
 * `themes`, and `rich-text`.
 *
 * It runs the way the e2e suite runs: over the production build in `.next`,
 * on its own server (port `DEMO_PORT`, 3138 by default) against the
 * dedicated e2e database, which it creates and migrates itself; it never
 * touches the dev database or a running `pnpm dev`. The Author is a minted
 * better-auth session, the Project is the seed written for that Author, the
 * Runs behind the analytics still are walks this script makes, and it deletes
 * all of it when it is done. No real Participant, Run, or Response is ever
 * on screen.
 *
 * `pnpm demo:record` builds and then records; `pnpm demo:record:prebuilt`
 * records over the build already in `.next`.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  chromium,
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "@/db/schema";
import { SEED_JOURNEY_IDS } from "@/lib/demo";
import { isEnding, type GraphDocument } from "@/lib/graph/document";

import { chooseStep, editJourneyField } from "../e2e/setup/authoring";
import {
  canvas,
  canvasNode,
  connectHandle,
  emptySpot,
  settledTransform,
} from "../e2e/setup/canvas";
import globalSetup from "../e2e/setup/global-setup";
import {
  cleanup,
  closePools,
  mintSession,
  queryE2eDatabase,
  type MintedCookie,
} from "../e2e/setup/session";
import {
  DEMO_JOURNEY_ID,
  DEMO_PROJECT_ID,
  parseSeedJourneys,
  SEED_PROJECT_ID,
  seedJourneyStories,
  type SeedJourney,
} from "./seed/journey-stories-seed";

const PORT = Number(process.env.DEMO_PORT ?? 3138);
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve("public/demo");

/** The page size of everything written: the recording and every still. */
const SIZE = { width: 1280, height: 720 };
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];

/** Both recordings together (ticket 38), and the whole directory (54). */
const VIDEO_BUDGET = 3 * 1024 * 1024;
const DIRECTORY_BUDGET = 4 * 1024 * 1024;

/**
 * What the script records and photographs, per source (ticket 58): which
 * seed Project, which Journey each file comes from, and the Steps it opens,
 * drags from, walks to, and frames — by title, as an Author would name them.
 * `demo` is the default: `The Allotment`'s ten-Step Journey, made for this.
 * `journey-stories` regenerates the same files from Medha's three cases.
 */
type Source = {
  projectId: string;
  recording: {
    journeyId: string;
    /** Found by name, which zooms the map to it: the first frame. */
    firstStep: string;
    /** Where the first Step's first Choice leads; opened from its box. */
    secondStep: string;
    /** What the Step made by the drop is called. */
    newStepTitle: string;
  };
  versions: { journeyId: string; descriptionEdit: string };
  themes: { journeyId: string };
  prompt: {
    journeyId: string;
    step: string;
    /** Written in the panel; null when the seed already asks a deciding Prompt there. */
    text: string | null;
  };
  richText: { journeyId: string; step: string };
  analytics: { journeyId: string; startStep: string; zoomNotches: number };
  run: { journeyId: string; stepId: string };
};

const CASE_1 = SEED_JOURNEY_IDS.case1;
const CASE_2 = SEED_JOURNEY_IDS.case2;
const CASE_3 = SEED_JOURNEY_IDS.case3;

const SOURCES: Record<"demo" | "journey-stories", Source> = {
  demo: {
    projectId: DEMO_PROJECT_ID,
    recording: {
      journeyId: DEMO_JOURNEY_ID,
      firstStep: "Waist-high grass",
      secondStep: "Blisters",
      newStepTitle: "Rain stops play",
    },
    versions: {
      journeyId: DEMO_JOURNEY_ID,
      descriptionEdit:
        "Goal: keep your aunt's allotment plot through the summer. Second edition.",
    },
    themes: { journeyId: DEMO_JOURNEY_ID },
    prompt: { journeyId: DEMO_JOURNEY_ID, step: "Blisters", text: null },
    richText: { journeyId: DEMO_JOURNEY_ID, step: "Waist-high grass" },
    analytics: {
      journeyId: DEMO_JOURNEY_ID,
      startStep: "A key on the doormat",
      zoomNotches: 2,
    },
    run: { journeyId: DEMO_JOURNEY_ID, stepId: "ada" },
  },
  // The recording and the analytics use Case 3, the smallest map; the
  // Prompt goes on a short Case 2 Step with two Choices and no image; the
  // Versions, the Theme, and the rich text are Case 1's.
  "journey-stories": {
    projectId: SEED_PROJECT_ID,
    recording: {
      journeyId: CASE_3,
      firstStep: "HHS",
      secondStep: "911",
      newStepTitle: "Follow-up visit",
    },
    versions: {
      journeyId: CASE_1,
      descriptionEdit: "Goal: Cross the border. Second edition.",
    },
    themes: { journeyId: CASE_1 },
    prompt: {
      journeyId: CASE_2,
      step: "Sponsor",
      text: "What do you tell the lawyer first?",
    },
    richText: { journeyId: CASE_1, step: "River" },
    analytics: { journeyId: CASE_3, startStep: "Preface", zoomNotches: 11 },
    run: { journeyId: CASE_3, stepId: "step-8" },
  },
};

type SourceName = keyof typeof SOURCES;

function isSourceName(name: string): name is SourceName {
  return Object.hasOwn(SOURCES, name);
}

/** `--source demo` (the default) or `--source journey-stories`. */
function chooseSource(argv: string[]): { name: SourceName; source: Source } {
  const at = argv.indexOf("--source");
  const name = at === -1 ? "demo" : (argv[at + 1] ?? "");
  if (!isSourceName(name)) {
    throw new Error(
      `Unknown --source "${name}": expected ${Object.keys(SOURCES).join(" or ")}`,
    );
  }
  return { name, source: SOURCES[name] };
}

/**
 * The demo Journey's image is stored at its raw GitHub address (stored
 * content keeps only absolute http(s) image URLs), which does not exist
 * until this branch lands on `staging`; every page here is served the
 * committed file for it instead, so the recording needs no network.
 */
const SEED_IMAGE_PATH = "/public/seed/";
async function serveSeedImages(context: BrowserContext): Promise<void> {
  await context.route(
    (url) =>
      url.hostname === "raw.githubusercontent.com" &&
      url.pathname.includes(SEED_IMAGE_PATH),
    async (route) => {
      const file = path.resolve(
        "public/seed",
        path.basename(new URL(route.request().url()).pathname),
      );
      await route.fulfill({ path: file, contentType: "image/jpeg" });
    },
  );
}

/** What a Participant of this script writes into a deciding Prompt. */
const FIXTURE_RESPONSE = "I'll come back at the weekend and bring gloves.";

/** The Step panel's deciding option (ticket 49), by its label. */
const DECIDES_LABEL = "AI decides the next step from the response";

function journeyPath(source: Source, journeyId: string): string {
  return `/projects/${source.projectId}/journeys/${journeyId}`;
}

// ---------------------------------------------------------------------------
// The server

async function listening(url: string): Promise<boolean> {
  try {
    await fetch(url, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/**
 * `next start` over the build in `.next`, on the demo port, pointed at the
 * e2e database exactly as `playwright.config.ts` points its own server: no
 * gateway key, so nothing here ever spends a token. Spawned in its own
 * process group so the whole tree goes when the script does.
 */
async function startServer(databaseUrl: string): Promise<ChildProcess> {
  if (!existsSync(path.resolve(".next/BUILD_ID"))) {
    throw new Error(
      "No production build in .next: run `pnpm build` first, or `pnpm demo:record`, which builds.",
    );
  }
  if (await listening(BASE_URL)) {
    throw new Error(
      `Something is already listening on ${BASE_URL}; stop it or set DEMO_PORT.`,
    );
  }

  const child = spawn(
    path.resolve("node_modules/.bin/next"),
    ["start", "-p", String(PORT)],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_URL: BASE_URL,
        AI_GATEWAY_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[next] ${chunk}`);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[next] ${chunk}`);
  });

  const deadline = Date.now() + 60_000;
  while (!(await listening(BASE_URL))) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited with ${child.exitCode}`);
    }
    if (Date.now() > deadline) {
      stopServer(child);
      throw new Error(`next start did not answer on ${BASE_URL} in 60s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return child;
}

function stopServer(child: ChildProcess): void {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

// ---------------------------------------------------------------------------
// The map, driven the way the canvas spec drives it (the shared helpers
// are in e2e/setup/canvas.ts; what is here is the recording's own pace)

/**
 * The page scrolled so the whole Canvas frame sits just under the sticky
 * rows (the navbar and the tab strip): the recording is the viewport, and
 * the map is what it is a recording of.
 */
async function frameCanvas(page: Page): Promise<void> {
  await settledTransform(page);
  await frameElement(page.getByRole("region", { name: "Canvas" }));
  await settledTransform(page);
}

/**
 * An element scrolled to sit just under whatever is stuck to the top of the
 * window (the navbar, the tab strip). The focus is let go of first: the
 * browser scrolls a focused field back into view, which is what undid an
 * earlier framing after "Find step" had handed the focus on. Read back
 * after a beat, so a scroll the page undid is reported rather than kept.
 */
async function frameElement(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const wanted = await locator.evaluate((element) => {
    if (window.document.activeElement instanceof HTMLElement) {
      window.document.activeElement.blur();
    }
    // The navbar (`AppNavbar`, sticky at the top) and the tab strip
    // (`UrlTabs`, sticky beneath it) stack over the page once it has
    // scrolled; the element goes just under the two of them.
    const covered = ["header", "[data-slot='sticky-tabs']"]
      .map(
        (selector) =>
          window.document.querySelector(selector)?.getBoundingClientRect()
            .height ?? 0,
      )
      .reduce((sum, height) => sum + height, 0);
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, top - covered - 8),
      behavior: "instant",
    });
    return window.scrollY;
  });
  await expect
    .poll(() => locator.evaluate(() => window.scrollY), { timeout: 3_000 })
    .toBe(wanted);
}

/**
 * One Choice dropped on bare map, dragged from a box's connect dot the way
 * an Author drags one: slowly enough to be seen. React Flow decides what a
 * drop lands on from the last move it saw, so the pointer arrives twice.
 */
async function dropChoiceOnEmptyMap(page: Page, from: string): Promise<void> {
  const nowhere = await emptySpot(page);
  const handle = await connectHandle(page, from).boundingBox();
  if (!handle) throw new Error(`no connect dot on "${from}"`);

  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(nowhere.x, nowhere.y, { steps: 40 });
  await page.mouse.move(nowhere.x, nowhere.y);
  await page.mouse.up();

  const title = page.getByLabel("Step title");
  await expect(title).toHaveValue("Untitled step");
  await expect(title).toBeFocused();
}

/**
 * A click at a control's centre, from the mouse rather than the locator: a
 * locator click first scrolls its target into view, and a control near the
 * bottom of the frame would take the page with it, mid-recording.
 */
async function clickCenter(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("the control has no box");
  await locator
    .page()
    .mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** One box clicked, the way an Author clicks one: once the map has stopped moving. */
async function clickBox(page: Page, title: string): Promise<void> {
  await settledTransform(page);
  await clickCenter(canvasNode(page, title));
  await expect(page.getByLabel("Step title")).toHaveValue(title);
}

async function setDirection(
  page: Page,
  name: "Top to bottom" | "Left to right",
): Promise<void> {
  const radio = canvas(page).getByRole("radio", { name, exact: true });
  await clickCenter(radio);
  await expect(radio).toHaveAttribute("aria-checked", "true");
}

async function fitView(page: Page): Promise<void> {
  await clickCenter(canvas(page).getByRole("button", { name: /fit view/i }));
  await settledTransform(page);
}

/** A beat for the viewer: the recording runs in real time. */
function pause(page: Page, ms: number): Promise<void> {
  return page.waitForTimeout(ms);
}

// ---------------------------------------------------------------------------
// Contexts

async function newContext(
  browser: Browser,
  scheme: Scheme,
  cookie: MintedCookie | null,
  videoDir?: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: scheme,
    reducedMotion: "no-preference",
    recordVideo: videoDir ? { dir: videoDir, size: SIZE } : undefined,
  });
  if (cookie) await context.addCookies([cookie]);
  await serveSeedImages(context);
  return context;
}

/** The app's theme follows the scheme (next-themes, `system`); proven. */
async function expectScheme(page: Page, scheme: Scheme): Promise<void> {
  const html = page.locator("html");
  if (scheme === "dark") await expect(html).toHaveClass(/\bdark\b/);
  else await expect(html).not.toHaveClass(/\bdark\b/);
}

/** Every image on the page loaded (or failed), so a still never shows a hole. */
async function imagesSettled(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => Array.from(window.document.images).every((image) => image.complete),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => {
      console.warn("[demo] an image did not finish loading in 20s");
    });
}

// ---------------------------------------------------------------------------
// The recording

async function recordCanvas(
  browser: Browser,
  cookie: MintedCookie,
  source: Source,
  scheme: Scheme,
  videoDir: string,
): Promise<{ rawVideo: string; leadMs: number }> {
  const take = source.recording;
  const context = await newContext(browser, scheme, cookie, videoDir);
  const page = await context.newPage();
  const video = page.video();
  if (!video) throw new Error("the page is not being recorded");
  const startedAt = Date.now();

  try {
    await page.goto(journeyPath(source, take.journeyId));
    await expectScheme(page, scheme);
    await expect(canvasNode(page, take.firstStep)).toBeVisible();
    await imagesSettled(page);

    // The first Step is found by name, which zooms the map to its box: a
    // map fitted whole into this frame can be a thumbnail (the 36-Step case
    // is), and the recording is of boxes an Author can read. The first
    // frame is that zoom, settled, with the map framed; the poster is this
    // moment.
    await chooseStep(page, take.firstStep);
    // Opening a Step whose content ends in an image can leave that image
    // selected, with its floating toolbar over the text; the caret goes
    // into the first paragraph instead, and the framing lets go of it.
    await page.getByLabel("Step content").locator("p").first().click();
    await frameCanvas(page);
    await pause(page, 400);
    const leadMs = Date.now() - startedAt;
    await page.screenshot({
      path: path.join(OUT_DIR, `canvas-${scheme}.png`),
      type: "png",
    });
    await pause(page, 1_600);

    // A second Step, the one the first's Choice leads to, opened from its
    // box on the map. (The panel's Choice row has an Open button too, but
    // that row sits far down a Step this long, and scrolling the page there
    // and back is not what the recording is of.)
    await clickBox(page, take.secondStep);
    await pause(page, 1_800);

    // A Choice dropped on bare map makes the Step it leads to, and the map
    // zooms to it; the new Step is named where the panel is waiting.
    await dropChoiceOnEmptyMap(page, take.secondStep);
    await settledTransform(page);
    await pause(page, 600);
    // Typed over the placeholder title key by key, so the name appears on
    // the box as it is written. The field is taken hold of again first: the
    // zoom to the new box can have moved the focus on since the drop.
    const title = page.getByLabel("Step title");
    await title.click();
    await title.press("ControlOrMeta+a");
    await title.pressSequentially(take.newStepTitle, { delay: 70 });
    await expect(title).toHaveValue(take.newStepTitle);
    await expect(canvasNode(page, take.newStepTitle)).toBeVisible();
    await pause(page, 1_400);

    // The whole map back, turned the other way round, and the new Step
    // found again on the turned map — so the loop ends, as it began, on
    // boxes an Author can read.
    await fitView(page);
    await pause(page, 1_600);
    await setDirection(page, "Left to right");
    await settledTransform(page);
    await pause(page, 1_800);
    await chooseStep(page, take.newStepTitle);
    await frameCanvas(page);
    await pause(page, 2_200);

    return { rawVideo: await video.path(), leadMs };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// ffmpeg, for the lead-in and the size

/**
 * Playwright's own ffmpeg, which it downloads beside its browsers to write
 * these recordings in the first place; `DEMO_FFMPEG` names another, and a
 * plain `ffmpeg` on the PATH is the last resort. Null when there is none:
 * the raw recording is then used as it is.
 */
function findFfmpeg(): string | null {
  if (process.env.DEMO_FFMPEG) return process.env.DEMO_FFMPEG;

  const cache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
      : process.platform === "win32"
        ? path.join(
            process.env.LOCALAPPDATA ??
              path.join(os.homedir(), "AppData", "Local"),
            "ms-playwright",
          )
        : path.join(
            process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"),
            "ms-playwright",
          ));
  const binary =
    process.platform === "darwin"
      ? "ffmpeg-mac"
      : process.platform === "win32"
        ? "ffmpeg-win64.exe"
        : "ffmpeg-linux";
  if (existsSync(cache)) {
    const builds = readdirSync(cache)
      .filter((name) => name.startsWith("ffmpeg-"))
      .sort()
      .reverse();
    for (const build of builds) {
      const candidate = path.join(cache, build, binary);
      if (existsSync(candidate)) return candidate;
    }
  }

  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0
    ? "ffmpeg"
    : null;
}

/**
 * The recording with its lead-in cut (the blank frames before the page had
 * painted, which would flash on every loop) and re-encoded at a bitrate that
 * keeps both themes under the budget. VP8, which is what the raw recording
 * already is and the one WebM encoder Playwright's ffmpeg is built with.
 */
async function finishVideo(
  ffmpeg: string | null,
  rawVideo: string,
  leadMs: number,
  target: string,
): Promise<void> {
  if (ffmpeg === null) {
    console.warn(
      `[demo] no ffmpeg found: keeping the raw recording, lead-in and all, as ${path.basename(target)}`,
    );
    await copyFile(rawVideo, target);
    return;
  }

  const lead = Math.max(0, (leadMs - 150) / 1000).toFixed(3);
  const result = spawnSync(
    ffmpeg,
    [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      lead,
      "-i",
      rawVideo,
      "-an",
      "-c:v",
      "libvpx",
      "-b:v",
      "550k",
      "-crf",
      "32",
      "-deadline",
      "good",
      "-cpu-used",
      "1",
      "-r",
      "25",
      "-vf",
      `scale=${SIZE.width}:${SIZE.height}`,
      target,
    ],
    { stdio: ["ignore", "inherit", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr?.toString().trim()}`);
  }
}

// ---------------------------------------------------------------------------
// The state behind the stills

/**
 * The shortest route of Choice labels from the Start to a Step, over the
 * document's own Choices, so a content edit upstream never breaks a walk.
 */
function routeTo(document: GraphDocument, targetStepId: string): string[] {
  const visited = new Set<string>([document.startStepId]);
  const queue: { stepId: string; route: string[] }[] = [
    { stepId: document.startStepId, route: [] },
  ];
  while (queue.length > 0) {
    const { stepId, route } = queue.shift()!;
    if (stepId === targetStepId) return route;
    for (const choice of document.steps[stepId].choices) {
      if (visited.has(choice.targetStepId)) continue;
      visited.add(choice.targetStepId);
      queue.push({
        stepId: choice.targetStepId,
        route: [...route, choice.label],
      });
    }
  }
  throw new Error(`No route from the Start to ${targetStepId}`);
}

/** One of the seed's Journeys, by id; the seed is the script's own, so it is there. */
function seedJourney(journeys: SeedJourney[], journeyId: string): SeedJourney {
  const journey = journeys.find(
    (candidate) => candidate.journeyId === journeyId,
  );
  if (!journey) throw new Error(`${journeyId} is not in the seed`);
  return journey;
}

/** The runner's Choice: a button for the first (it creates the Run), then links. */
function choiceControl(page: Page, label: string, index: number): Locator {
  const main = page.getByRole("main");
  return index === 0
    ? main.getByRole("button", { name: label, exact: true })
    : main
        .getByRole("link", { name: label, exact: true })
        // After a deciding Prompt falls back to the Choices (no gateway key
        // here, so the judge never answers), they are offered as buttons.
        .or(main.getByRole("button", { name: label, exact: true }));
}

/**
 * A deciding Prompt on the current Step answered, if there is one: the
 * fixture Response typed and Continue pressed, after which the judge —
 * unavailable on this server — hands the Participant the Choices to pick
 * from themselves. A Step that asks nothing deciding is left alone.
 */
async function answerDecidingPrompt(participant: Page): Promise<void> {
  const main = participant.getByRole("main");
  const submit = main.getByRole("button", { name: "Continue", exact: true });
  // The Step has arrived once it offers either its deciding form or its
  // Choices; asked before that, "no Continue here" would be a race.
  await expect(
    submit.or(main.locator('[aria-label="Choices"]')).first(),
  ).toBeVisible();
  if ((await submit.count()) === 0) return;
  await main.getByRole("textbox").fill(FIXTURE_RESPONSE);
  await submit.click();
  await expect(
    main.getByRole("heading", { name: "Choose for yourself" }),
  ).toBeVisible();
}

/**
 * One anonymous walk of the live version, in a context of its own so each
 * is a new Participant; closed when it is over, so a walk that stops short
 * has abandoned there. These Runs are the script's, never a real one.
 */
async function walk(
  browser: Browser,
  journeyId: string,
  choices: string[],
): Promise<void> {
  const context = await newContext(browser, "light", null);
  try {
    const participant = await context.newPage();
    await participant.goto(`/j/${journeyId}`);
    for (const [index, label] of choices.entries()) {
      await answerDecidingPrompt(participant);
      const control = choiceControl(participant, label, index);
      await control.click();
      await expect(control).toBeHidden();
    }
  } finally {
    await context.close();
  }
}

/** The header's Publish, pressed, and the version count it produced. */
async function publishFromHeader(
  page: Page,
  journeyId: string,
  expectedVersions: number,
): Promise<void> {
  const publish = page
    .locator("main header")
    .getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(publish).toBeDisabled();
  await expect
    .poll(async () => {
      const [row] = await queryE2eDatabase<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM "published_version" WHERE journey_id = $1',
        [journeyId],
      );
      return Number(row.count);
    })
    .toBe(expectedVersions);
}

async function prepareStillsState(
  browser: Browser,
  cookie: MintedCookie,
  source: Source,
  journeys: SeedJourney[],
): Promise<void> {
  const context = await newContext(browser, "light", cookie);
  const page = await context.newPage();
  try {
    // Prompt first, so a Prompt the panel writes is in what gets published
    // below. Written in the panel unless the seed already asks a deciding
    // Prompt on that Step, which is then only checked.
    await page.goto(journeyPath(source, source.prompt.journeyId));
    await chooseStep(page, source.prompt.step);
    if (source.prompt.text !== null) {
      await page.getByLabel("Prompt", { exact: true }).fill(source.prompt.text);
      await page.getByLabel(DECIDES_LABEL).check();
    }
    await expect(page.getByLabel(DECIDES_LABEL)).toBeChecked();
    await expect
      .poll(async () => {
        const [row] = await queryE2eDatabase<{ document: GraphDocument }>(
          'SELECT document FROM "draft" WHERE journey_id = $1',
          [source.prompt.journeyId],
        );
        const step = Object.values(row.document.steps).find(
          (candidate) => candidate.title === source.prompt.step,
        );
        return step?.prompt?.decides ?? false;
      })
      .toBe(true);

    // Versions: one Journey published twice, with a description edit
    // between — the second version is the live one, the first restorable.
    await page.goto(journeyPath(source, source.versions.journeyId));
    await publishFromHeader(page, source.versions.journeyId, 1);
    await editJourneyField(
      page,
      source.versions.journeyId,
      "description",
      source.versions.descriptionEdit,
    );
    await publishFromHeader(page, source.versions.journeyId, 2);

    // Themes: a Journey given a Theme of its own, Dusk.
    await page.goto(
      `${journeyPath(source, source.themes.journeyId)}?tab=settings`,
    );
    await page
      .getByRole("checkbox", { name: "Use a different theme for this journey" })
      .check();
    await expect(page.getByRole("radio", { name: /^Trail/ })).toBeChecked();
    await page.getByRole("radio", { name: /^Dusk/ }).check();
    await expect
      .poll(async () => {
        const [row] = await queryE2eDatabase<{ theme_preset: string | null }>(
          'SELECT theme_preset FROM "journey" WHERE id = $1',
          [source.themes.journeyId],
        );
        return row.theme_preset;
      })
      .toBe("dusk");

    // Run and analytics: their Journeys published (once each, unless one
    // is the versions Journey, already live), then the analytics Journey
    // walked by this script's own Participants — one to every Ending, the
    // last twice, and two who stop three Choices in.
    for (const journeyId of new Set([
      source.analytics.journeyId,
      source.run.journeyId,
    ])) {
      if (source.versions.journeyId === journeyId) continue;
      await page.goto(journeyPath(source, journeyId));
      await publishFromHeader(page, journeyId, 1);
    }
  } finally {
    await context.close();
  }

  const walked = seedJourney(journeys, source.analytics.journeyId);
  const endings = Object.values(walked.document.steps).filter((step) =>
    isEnding(step),
  );
  const routes = endings.map((ending) => routeTo(walked.document, ending.id));
  const longest = routes.reduce((a, b) => (b.length > a.length ? b : a));
  const walks = [
    ...routes,
    routes[routes.length - 1],
    longest.slice(0, 3),
    longest.slice(0, 3),
  ];
  for (const [index, route] of walks.entries()) {
    console.log(
      `[demo] walk ${index + 1}/${walks.length}: ${route.length} choices`,
    );
    await walk(browser, source.analytics.journeyId, route);
  }
}

// ---------------------------------------------------------------------------
// The stills

async function still(page: Page, slug: string, scheme: Scheme): Promise<void> {
  await imagesSettled(page);
  await page.screenshot({
    path: path.join(OUT_DIR, `${slug}-${scheme}.png`),
    type: "png",
  });
  console.log(`[demo] ${slug}-${scheme}.png`);
}

async function captureStills(
  browser: Browser,
  cookie: MintedCookie,
  source: Source,
  journeys: SeedJourney[],
  scheme: Scheme,
): Promise<void> {
  const context = await newContext(browser, scheme, cookie);
  const page = await context.newPage();
  try {
    // versions: two Published Versions, the live one marked, the other
    // restorable.
    await page.goto(
      `${journeyPath(source, source.versions.journeyId)}?tab=versions`,
    );
    await expectScheme(page, scheme);
    const versions = page
      .getByRole("list", { name: "Versions" })
      .getByRole("listitem");
    await expect(versions).toHaveCount(2);
    await expect(
      versions.getByRole("button", { name: "Restore" }).first(),
    ).toBeVisible();
    await still(page, "versions", scheme);

    // themes: the Theme row with Dusk chosen.
    await page.goto(
      `${journeyPath(source, source.themes.journeyId)}?tab=settings`,
    );
    await expect(page.getByRole("radio", { name: /^Dusk/ })).toBeChecked();
    await frameElement(page.getByRole("region", { name: "Theme" }));
    await still(page, "themes", scheme);

    // prompt: the Step panel on the deciding Prompt.
    await page.goto(journeyPath(source, source.prompt.journeyId));
    await chooseStep(page, source.prompt.step);
    const decides = page.getByLabel(DECIDES_LABEL);
    await expect(decides).toBeChecked();
    await frameCanvas(page);
    // The deciding option and its explanation are what the still is of:
    // brought up to the bottom edge, so the map keeps most of the frame.
    await page
      .getByText("Participants answer and press Continue")
      .evaluate((element) => {
        element.scrollIntoView({ block: "end", behavior: "instant" });
        window.scrollBy({ top: 16, behavior: "instant" });
      });
    await still(page, "prompt", scheme);

    // rich-text: a Step's rich text with its image and its caption. The
    // figure is brought up by as little as it takes, so the map keeps most
    // of the frame's left; the caption's long URL can overflow the panel,
    // so the page is put back on its left edge afterwards.
    await page.goto(journeyPath(source, source.richText.journeyId));
    await chooseStep(page, source.richText.step);
    const figure = page.getByLabel("Step content").locator("figure").first();
    await expect(figure.locator("figcaption")).not.toBeEmpty();
    // Opening the Step can leave the image selected, with its floating
    // toolbar over the text; a click into the first paragraph puts the
    // caret there instead, and the framing below lets go of the focus.
    await page.getByLabel("Step content").locator("p").first().click();
    await frameCanvas(page);
    await figure.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      window.scrollTo({ left: 0, behavior: "instant" });
      if (window.document.activeElement instanceof HTMLElement) {
        window.document.activeElement.blur();
      }
    });
    await still(page, "rich-text", scheme);

    // analytics: the map with the walks' numbers on it, zoomed in around
    // the Start with the wheel — the whole map fitted into this frame is a
    // thumbnail, and the numbers are the point.
    await page.goto(
      `${journeyPath(source, source.analytics.journeyId)}?tab=analytics`,
    );
    const analyticsMap = page.getByRole("region", { name: "Analytics map" });
    await expect(
      analyticsMap.locator("[data-step-figure]").first(),
    ).toBeVisible();
    await frameElement(analyticsMap);
    await page.waitForTimeout(600);
    const startBox = await analyticsMap
      .getByRole("group", { name: source.analytics.startStep, exact: true })
      .boundingBox();
    if (!startBox) throw new Error("the Start is not on the analytics map");
    // The wheel zooms around the pointer, so the Start's top edge stays
    // where it is and the map grows downwards from it.
    await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 4);
    for (let notch = 0; notch < source.analytics.zoomNotches; notch += 1) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);
    await still(page, "analytics", scheme);
  } finally {
    await context.close();
  }

  // run: a Participant of their own, no session, a few Choices in.
  const played = seedJourney(journeys, source.run.journeyId);
  const route = routeTo(played.document, source.run.stepId);
  const participant = await newContext(browser, scheme, null);
  try {
    const runner = await participant.newPage();
    await runner.goto(`/j/${source.run.journeyId}`);
    await expectScheme(runner, scheme);
    for (const [index, label] of route.entries()) {
      await answerDecidingPrompt(runner);
      const control = choiceControl(runner, label, index);
      await control.click();
      await expect(control).toBeHidden();
    }
    await expect(runner).toHaveURL(
      `${BASE_URL}/j/${source.run.journeyId}/${source.run.stepId}`,
    );
    // Its Choices are the point: brought up to the bottom edge of the frame,
    // once the image above them has its height and cannot push them back
    // down.
    await imagesSettled(runner);
    const choices = runner.locator('[aria-label="Choices"]');
    await expect(choices.getByRole("link").first()).toBeVisible();
    await choices.evaluate((element) => {
      element.scrollIntoView({ block: "end", behavior: "instant" });
      window.scrollBy({ top: 16, behavior: "instant" });
    });
    await still(runner, "run", scheme);
  } finally {
    await participant.close();
  }
}

// ---------------------------------------------------------------------------
// Sizes

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function reportSizes(): Promise<void> {
  const names = (await readdir(OUT_DIR)).sort();
  let videos = 0;
  let total = 0;
  for (const name of names) {
    const { size } = await stat(path.join(OUT_DIR, name));
    total += size;
    if (name.endsWith(".webm")) videos += size;
    console.log(`  ${name.padEnd(24)} ${formatBytes(size).padStart(9)}`);
  }
  console.log(
    `  recordings ${formatBytes(videos)} of ${formatBytes(VIDEO_BUDGET)}; public/demo ${formatBytes(total)} of ${formatBytes(DIRECTORY_BUDGET)}`,
  );
  if (videos > VIDEO_BUDGET) {
    throw new Error("the two recordings together are over the 3 MB budget");
  }
  if (total > DIRECTORY_BUDGET) {
    throw new Error("public/demo is over the 4 MB budget");
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { name, source } = chooseSource(process.argv.slice(2));

  // The e2e database, created and migrated if need be; `loadE2eEnv` inside
  // it swaps the database name and never touches the dev one.
  await globalSetup();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set after setup");

  const server = await startServer(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const videoDir = await mkdtemp(path.join(os.tmpdir(), "journeys-demo-"));
  const authorIds: string[] = [];
  let browser: Browser | null = null;

  try {
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });

    const { user, cookie } = await mintSession({ name: "Demo Author" });
    authorIds.push(user.id);
    const journeys = parseSeedJourneys();
    await seedJourneyStories(db, user.id, journeys);
    console.log(
      `[demo] seeded ${journeys.length} Journeys for ${user.name}; source: ${name}`,
    );

    browser = await chromium.launch();
    const ffmpeg = findFfmpeg();
    console.log(`[demo] ffmpeg: ${ffmpeg ?? "none"}`);

    for (const scheme of SCHEMES) {
      console.log(`[demo] recording the canvas (${scheme})`);
      const { rawVideo, leadMs } = await recordCanvas(
        browser,
        cookie,
        source,
        scheme,
        videoDir,
      );
      await finishVideo(
        ffmpeg,
        rawVideo,
        leadMs,
        path.join(OUT_DIR, `canvas-${scheme}.webm`),
      );
      // The recording added a Step and turned the map; the next take starts
      // from the seed again.
      await seedJourneyStories(db, user.id, journeys);
    }

    console.log("[demo] preparing the stills' state");
    await prepareStillsState(browser, cookie, source, journeys);
    for (const scheme of SCHEMES) {
      await captureStills(browser, cookie, source, journeys, scheme);
    }

    console.log("[demo] written to public/demo:");
    await reportSizes();
  } finally {
    await browser?.close();
    await cleanup(authorIds);
    await closePools();
    await pool.end();
    await rm(videoDir, { recursive: true, force: true });
    stopServer(server);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
