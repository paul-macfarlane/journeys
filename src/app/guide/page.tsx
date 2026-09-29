import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { DemoStill } from "@/components/demo-still";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "How to write, publish, and share a Journey as an Author, and what to expect when you walk one as a Participant.",
  alternates: { canonical: "/guide" },
};

/**
 * The user guide (ticket 55): one static, public page in the product's own
 * voice, for Authors who want to know what the editor can do and for
 * Participants who want to know what a walk records. It uses only the
 * vocabulary in CONTEXT.md, and every claim maps to a surface that exists;
 * change the surface, change this page. The stills are the ones
 * `scripts/record-landing-demo.ts` writes under `public/demo/` (ticket 38),
 * never hand-captured, so they can be re-made after any change.
 *
 * There is no in-app help yet (that is ticket 57); this page is the help.
 */

const SECTIONS = [
  { id: "for-authors", title: "For Authors" },
  { id: "for-participants", title: "For Participants" },
  { id: "good-to-know", title: "Good to know" },
] as const;

/**
 * The "For Authors" section in the order an Author meets it (ticket 93):
 * from signing in to reading what Participants did. Each is an `h3` with
 * this id, and the contents list names them under "For Authors".
 */
const AUTHOR_STAGES = [
  { id: "sign-in", title: "Sign in" },
  { id: "create-a-project", title: "Create a Project" },
  { id: "add-members", title: "Add Members" },
  { id: "create-a-journey", title: "Create a Journey" },
  { id: "build-it", title: "Build it" },
  { id: "customise-it", title: "Customise it" },
  { id: "preview", title: "Preview" },
  { id: "publish", title: "Publish" },
  { id: "share-the-link", title: "Share the link" },
  { id: "edit-after-publishing", title: "Edit after publishing" },
  { id: "analytics-and-responses", title: "Read Analytics and Responses" },
  { id: "your-author-page", title: "Your Author page" },
] as const;

type AuthorStageId = (typeof AUTHOR_STAGES)[number]["id"];

/** One lifecycle stage's heading, its text taken from AUTHOR_STAGES. */
function Stage({ id }: { id: AuthorStageId }) {
  return (
    <h3 id={id} className="scroll-mt-6">
      {AUTHOR_STAGES.find((stage) => stage.id === id)?.title}
    </h3>
  );
}

export default function GuidePage() {
  return (
    <ProsePage
      title="Guide"
      subtitle="Journeys is for writing branching journeys, where each Step is one screen holding text and images, and sharing them by link. Authors sign in and build; Participants walk what is published without an account. This page covers both."
    >
      <nav
        aria-labelledby="contents-heading"
        className="flex flex-col gap-2 text-sm"
      >
        <p id="contents-heading" className="text-muted-foreground font-medium">
          On this page
        </p>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
              {section.id === "for-authors" ? (
                <ol
                  aria-label="Stages for Authors"
                  className="mt-1 flex list-[lower-alpha] flex-col gap-1 pl-5"
                >
                  {AUTHOR_STAGES.map((stage) => (
                    <li key={stage.id}>
                      <a href={`#${stage.id}`}>{stage.title}</a>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

      <Section {...SECTIONS[0]}>
        <p>
          An Author is a signed-in user who writes Journeys. Everything an
          Author makes lives in a Project, and every Member of a Project can do
          everything within it. This section follows a Journey from the first
          sign-in to reading what Participants did.
        </p>

        <Stage id="sign-in" />
        <p>
          Go to <Link href="/sign-in">Sign in</Link> and pick Google or Discord.
          Journeys never sees a password; the provider tells it your name, email
          address, and picture, and you can change the name and picture later
          from Settings in your account menu.
        </p>

        <Stage id="create-a-project" />
        <p>
          Your projects page lists every Project you belong to. Press{" "}
          <strong>New project</strong>, give it a title, and you land on it. A
          Project has a public page that lists its Journeys with a live
          Published Version, so a set of related Journeys can be shared with one
          link.
        </p>

        <Stage id="add-members" />
        <p>
          Members are the Authors you share a Project with. Add another Author
          from the Project’s Members tab by the email address they signed in
          with; every Member is equal and can do everything, including adding
          and removing Members.
        </p>

        <Stage id="create-a-journey" />
        <p>
          From a Project, press <strong>New journey</strong> and give it a
          title. A new Journey begins with one Step, its Start, and opens on the
          canvas. Until you publish it, everything you do is on the Draft, which
          no Participant can see.
        </p>

        <Stage id="build-it" />
        <p>
          You build a Journey on its Editor tab: the canvas draws its shape, the
          Step panel holds the words and images of one Step, and a Prompt lets a
          Step ask a question.
        </p>

        <h4 id="the-canvas">The canvas</h4>
        <p>
          The canvas draws the Draft as a map: every Step is a box, every Choice
          an arrow from the Step it belongs to into the Step it leads to. The
          map is laid out for you, top to bottom or left to right, and never by
          hand; it fits itself into view when it opens and whenever you turn it.
          Click a box to open that Step in the panel.
        </p>
        <ul>
          <li>
            <strong>Steps and Choices.</strong> A Step is one screen a
            Participant reads; a Choice is one way onward from it. A Step with
            no Choices is an Ending. Each box carries{" "}
            <strong>Step actions</strong>: add the next Step, duplicate this
            one, zoom to it, make it the Start, or delete it.
          </li>
          <li>
            <strong>Drag a Choice onto bare map.</strong> Every box has a
            connect dot. Drag from it onto empty map and let go: a new Step is
            made there and a Choice points at it. Drag from it onto another box
            to draw a Choice there instead. To move a Choice that already
            exists, take hold of its arrow’s head and drop it on the box it
            should lead to.
          </li>
          <li>
            <strong>Direction.</strong> Turn the whole map between top-to-bottom
            and left-to-right. The direction is stored on the Draft and shared
            by the Project’s Members.
          </li>
          <li>
            <strong>Undo and redo.</strong> Every move on the map and in the
            panel can be undone, with the usual keyboard shortcuts or the Undo
            and Redo buttons above the map.
          </li>
          <li>
            <strong>Hide the panel</strong> to give the map the whole width.
            Your browser remembers whether the panel is hidden; it isn’t saved
            on the Journey.
          </li>
        </ul>
        <Still
          slug="canvas"
          alt="The canvas: a Journey’s Steps drawn as boxes joined by Choice arrows, with one Step open in the panel beside the map."
          caption="A Draft on the canvas, with a Step open in the panel."
        />

        <h4 id="the-step-panel">The Step panel</h4>
        <p>
          The panel holds the open Step: its title, its content, its Choices,
          and, once it is an Ending, its Outcome. Content is rich text:
          headings, lists, quotes, emphasis, and images. An image needs alt text
          for people who cannot see it, and can carry a Caption beneath it,
          where a credit is simply written in. The panel saves as you go; a
          status line in the editor’s header tells you when.
        </p>
        <Still
          slug="rich-text"
          alt="The Step panel with rich-text content: a heading, a paragraph, and an image with its Caption."
          caption="A Step’s content in the panel."
        />

        <h4 id="prompts">Prompts</h4>
        <p>
          A Step can carry a Prompt: a free-text question a Participant may
          answer before making a Choice. The Response is kept with the Run for
          the Project’s Members to read; it never changes which Choice the
          Participant takes.
        </p>
        <Still
          slug="prompt"
          alt="A Step in the runner with a Prompt: a question above a text box, shown together with its Choices."
          caption="A Prompt shown above its Choices, as a Participant sees it."
        />

        <Stage id="customise-it" />
        <p>
          A Theme is a small set of colours and a font applied to what
          Participants see. Set one on the Project’s Settings tab and every
          Journey in it follows; a Journey can carry its own instead, from the
          Journey’s Settings tab. A Journey’s title and description are edited
          at the top of its own page.
        </p>
        <Still
          slug="themes"
          alt="A Journey in the runner with a Theme applied: its own colours and font on the Step text and the Choices."
          caption="A published Journey wearing its Theme."
        />

        <Stage id="preview" />
        <p>
          <strong>Preview</strong>, on the Journey’s page, walks the Draft the
          way a Participant would, in the Journey’s Theme, and records nothing.
          Use it to check a path before anyone else can walk it.
        </p>

        <Stage id="publish" />
        <p>
          Publishing makes a Published Version from the Draft as it stands. A
          Published Version never changes: at most one is live to Participants
          at a time, and every earlier one is kept.
        </p>

        <Stage id="share-the-link" />
        <p>
          A live Journey has one link, shown on its page with a copy button.
          That link is the whole of discovery: nobody finds a Journey except by
          being given it. The Project’s public page has a link too, listing
          every Journey in it that is live.
        </p>

        <Stage id="edit-after-publishing" />
        <p>
          Keep editing after you publish: the Draft stays private, and
          Participants go on walking the live Published Version until you
          publish again, which makes a new Version. The Versions tab lists every
          Published Version. From there you can <strong>View</strong> an earlier
          one or <strong>Preview</strong> it, and restore any of them into the
          Draft to keep editing from that point.
        </p>
        <Still
          slug="versions"
          alt="The Versions tab: the Draft row and the Published Versions beneath it, one of them marked live."
          caption="The Versions tab."
        />

        <Stage id="analytics-and-responses" />
        <p>
          The Analytics tab draws a Published Version the same way the canvas
          does, read-only, with the number of Runs on every box and every arrow,
          so you can see where Participants went and where they stopped. Endings
          that share an Outcome are counted together. Pick a Version to see its
          Runs; a Run always belongs to the Version it began on.
        </p>
        <Still
          slug="analytics"
          alt="The Analytics tab: the Journey’s map with a Run count on every Step and every Choice arrow."
          caption="Runs drawn onto the graph."
        />
        <p>
          The Responses tab lists what Participants typed into the Journey’s
          Prompts, one list per Step that asks one, with nothing that says who
          wrote which, or when.
        </p>

        <Stage id="your-author-page" />
        <p>
          From Settings in your account menu you can turn on your Author page, a
          public page with your name, picture, bio, and links, together with the
          Projects you belong to that have a live Journey. It is off until you
          turn it on.
        </p>
      </Section>

      <Section {...SECTIONS[1]}>
        <p>
          A Participant is anyone who opens a Journey’s link. You read a Step,
          make a Choice, and live with where it takes you, until you reach an
          Ending.
        </p>
        <ul>
          <li>
            <strong>No account.</strong> There is nothing to sign up for and
            nothing to sign in to. A walk stores nothing that identifies you: no
            name, no email address, no IP address. It stores which Steps you
            visited, which Choices you made, and any Response you type into a
            Prompt, which the Journey’s Authors can read.
          </li>
          <li>
            <strong>A Run.</strong> Your walk becomes a Run on your first
            Choice, not when you open the Journey, and it is pinned to the
            Published Version you started on. A cookie in your browser remembers
            the Run so a reload or a return picks up where you left off.
          </li>
          <li>
            <strong>Going back.</strong> Your browser’s Back returns you to an
            earlier Step to make a different Choice. That is a Backtrack: your
            Run’s path becomes the route you are on now, not every detour.
          </li>
          <li>
            <strong>Endings.</strong> A Step with no Choices is an Ending, and
            the Journey tells you so. From there, or from any Step with{" "}
            <strong>Start over</strong> in the header, you can start again from
            the Start; a new Run begins with your first Choice.
          </li>
        </ul>
        <Still
          slug="run"
          alt="A Step in the runner: its text, then the Choices as buttons beneath it."
          caption="A Step as a Participant reads it."
        />
      </Section>

      <Section {...SECTIONS[2]}>
        <ul>
          <li>
            <strong>Discovery is link-only.</strong> There is no directory and
            no search. A Journey or a Project is found only by the link its
            Authors hand out.
          </li>
          <li>
            <strong>
              A Published Version never changes under a Participant.
            </strong>{" "}
            Publishing again makes a new Version; a Run in progress stays on the
            one it began on, so nobody is moved mid-walk.
          </li>
          <li>
            <strong>Responses are for Members only.</strong> What a Participant
            types into a Prompt is readable by the Project’s Members on the
            Journey’s Responses tab, and shown to no one else, never to another
            Participant.
          </li>
          <li>
            <strong>What is stored.</strong> The{" "}
            <Link href="/privacy">privacy policy</Link> lists it in full, for
            Authors and Participants alike.
          </li>
        </ul>
      </Section>
    </ProsePage>
  );
}

/** One of the three sections the contents list points at. */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * One of ticket 38's stills in the page's own theme: the light one unless
 * `<html>` carries next-themes' `dark` class, and the dark one only then.
 * Both are fetched so that a theme switch shows the other at once and a
 * full-page screenshot never catches an empty frame.
 */
function Still({
  slug,
  alt,
  caption,
}: {
  slug: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="my-2 flex flex-col gap-2">
      <div className="ring-foreground/10 overflow-hidden rounded-xl bg-muted shadow-sm ring-1">
        <DemoStill
          slug={slug}
          scheme="light"
          alt={alt}
          className="dark:hidden"
        />
        <DemoStill
          slug={slug}
          scheme="dark"
          alt={alt}
          className="hidden dark:block"
        />
      </div>
      <figcaption className="text-muted-foreground text-sm">
        {caption}
      </figcaption>
    </figure>
  );
}
