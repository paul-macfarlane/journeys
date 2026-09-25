import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/prose-page";
import { PLAY_JOURNEY_HREF, PLAY_JOURNEY_LABEL } from "@/lib/demo";

// The layout's template appends "· Journeys", so the title is the bare word.
export const metadata: Metadata = {
  title: "About",
  description:
    "Why Journeys exists: three hand-built cases for trauma-informed healthcare education, and the platform that grew out of them.",
};

const LEGACY_SITE_URL = "https://journey-stories.netlify.app/journeys/";
const TWINE_URL = "https://twinery.org/";

// The story, first person from Paul (ticket 54, decision 3). Medha agreed to
// be named. Nothing here mentions how the platform was built: that belongs
// to the judges' paragraph, not to the people who use the app.
export default function AboutPage() {
  return (
    <ProsePage title="About Journeys">
      <p>
        Journeys began with three stories my wife wrote. Medha is a family
        medicine doctor, and she built three branching cases for trauma-informed
        healthcare education: you play a migrant crossing a border, seeking
        care, and managing a condition, and you feel the choices and the dead
        ends before you ever meet someone like them in a clinic. Clinicians
        walked them and came out changed. She has taught with them at several
        hospitals and at family medicine conferences in Philadelphia and
        Atlanta.
      </p>
      <p>
        Medha wrote the cases in <a href={TWINE_URL}>Twine</a>, a free tool for
        interactive fiction. To get them onto the web, I wrote a gloriously
        hacky script that scraped the HTML Twine exports, pulled every passage
        and its links out of the markup, and turned them into JSON that a small
        Astro app rendered as a <a href={LEGACY_SITE_URL}>static site</a>. That
        worked, but it was fragile. Changing a word meant editing in Twine,
        re-exporting, re-running the script, and redeploying. The shape of a
        story — where it branched, where it looped, where it ended — could only
        be seen by clicking through it. Nothing recorded where participants
        went. And only one person could practically write.
      </p>

      <h2>What Journeys is</h2>
      <p>
        Journeys generalises those cases. An author builds a journey as a graph
        of steps and choices on a visual canvas, sees its whole shape at once,
        and publishes an immutable version that participants walk from a link
        without an account. Analytics are drawn on the graph itself, so you see
        which paths people took. A step can pose an open question that an AI
        reads to decide the next step. Steps carry rich text with images and
        credits, and each journey can have its own theme. Projects have members,
        authors can keep a public page, and every published journey carries a
        link preview.
      </p>
      <p>
        Medha&rsquo;s three cases were rebuilt from the legacy site in September
        2026 and live here as the demo, so you can{" "}
        <Link href={PLAY_JOURNEY_HREF}>{PLAY_JOURNEY_LABEL}</Link>.
      </p>

      <h2>Who it is for</h2>
      <p>
        Educators, trainers, and writers: anyone who wants a reader to make a
        choice and live with it. If that is you, sign in with Google or Discord,
        create a project, and start a draft. The{" "}
        <Link href="/guide">guide</Link> walks through the rest.
      </p>
      <p>&mdash; Paul</p>
    </ProsePage>
  );
}
