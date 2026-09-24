import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "How to write, publish, and share a Journey as an Author, and what to expect when you walk one as a Participant.",
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

export default function GuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto w-full max-w-prose px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex">
            <Wordmark className="text-base" markClassName="size-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            Guide
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Journeys is for writing branching, text-based experiences and
            sharing them by link. Authors sign in and build; Participants walk
            what is published without an account. This page covers both.
          </p>
        </div>

        <nav aria-label="On this page" className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground font-medium">On this page</p>
          <ol className="flex flex-col gap-1 pl-5 [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-foreground list-decimal">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="[&_a]:hover:text-foreground flex flex-col gap-4 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-medium [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6">
          <section
            id="for-authors"
            aria-labelledby="for-authors-heading"
            className="flex scroll-mt-6 flex-col gap-4"
          >
            <h2 id="for-authors-heading">For Authors</h2>
            <p>
              An Author is a signed-in person who writes Journeys. Everything an
              Author makes lives in a Project, and every Member of a Project can
              do everything within it.
            </p>

            <h3>Sign in</h3>
            <p>
              Go to <Link href="/sign-in">Sign in</Link> and choose Google or
              Discord. Journeys never sees a password; the provider tells it
              your name, email address, and picture, and you can change the name
              and picture later in Settings.
            </p>

            <h3>Create a Project</h3>
            <p>
              Your projects page lists every Project you belong to. Choose{" "}
              <strong>New project</strong>, give it a title, and you land on it.
              A Project has a public page that lists its Journeys with a live
              Published Version, so a set of related Journeys can be shared with
              one link.
            </p>

            <h3>Create a Journey</h3>
            <p>
              From a Project, choose <strong>New journey</strong> and give it a
              title. A new Journey begins with one Step, its Start, and opens on
              the canvas. Until you publish it, everything you do is on the
              Draft, which no Participant can see.
            </p>

            <h3>The canvas</h3>
            <p>
              The canvas draws the Draft as a map: every Step is a box, every
              Choice an arrow from the Step it belongs to into the Step it leads
              to. The map is laid out for you, top to bottom or left to right,
              and never by hand. Click a box to open that Step in the panel.
            </p>
            <ul>
              <li>
                <strong>Steps and Choices.</strong> A Step is one screen a
                Participant reads; a Choice is one option on it. A Step with no
                Choices is an Ending. From a box, <strong>Step actions</strong>{" "}
                adds a Step after it, adds a Choice, or deletes it.
              </li>
              <li>
                <strong>Drag a Choice onto bare map.</strong> Take hold of an
                arrow’s head, drag it onto empty map, and let go: the Step it
                leads to is made for you and the Choice points at it. Drop it on
                another box to point the Choice there instead.
              </li>
              <li>
                <strong>Direction and fit.</strong> Turn the whole map between
                top-to-bottom and left-to-right; the direction is stored on the
                Draft and shared by the Project’s Members. <strong>Fit</strong>{" "}
                brings the whole Journey back into view.
              </li>
              <li>
                <strong>Undo and redo.</strong> Every move on the map and in the
                panel can be undone, with the usual keyboard shortcuts or the
                buttons beside the map.
              </li>
              <li>
                <strong>Hide the panel</strong> to give the map the whole width.
                The choice is remembered in your browser, not on the Journey.
              </li>
            </ul>
            <Still
              slug="canvas"
              alt="The canvas: a Journey's Steps drawn as boxes joined by Choice arrows, with one Step open in the panel beside the map."
              caption="A Draft on the canvas, with a Step open in the panel."
            />

            <h3>The Step panel</h3>
            <p>
              The panel holds the open Step: its title, its content, its
              Choices, and, once it is an Ending, its Outcome. Content is rich
              text: headings, lists, quotes, emphasis, and images. An image
              needs alt text for people who cannot see it, and can carry a
              Caption beneath it, where a credit is simply written in. The panel
              saves as you go; a saved line near the title tells you when.
            </p>
            <Still
              slug="rich-text"
              alt="The Step panel with rich-text content: a heading, a paragraph, and an image with its Caption."
              caption="A Step's content in the panel."
            />

            <h3>Prompts and the AI-decided Choice</h3>
            <p>
              A Step can carry a Prompt: a free-text question a Participant may
              answer before choosing. By default the answer is simply kept as a
              Response for the Members to read. Mark the Prompt as deciding and
              the Participant answers instead of choosing: a Judge reads the
              Response against the Step’s Choices and picks the one that fits.
              The Judge sees only that Step, never an Ending, an Outcome,
              another Step, or anyone else’s Response, and when it has no answer
              the Participant chooses as usual.
            </p>
            <Still
              slug="prompt"
              alt="A Step in the runner with a Prompt: a question above a text box, and a Continue button instead of the Choices."
              caption="A deciding Prompt as a Participant sees it."
            />

            <h3>Themes</h3>
            <p>
              A Theme is a small set of colours and a font applied to what
              Participants see. Set one on the Project and every Journey in it
              follows; a Journey can carry its own instead. Preview shows the
              result before you publish.
            </p>
            <Still
              slug="themes"
              alt="A Journey in the runner with a Theme applied: its own colours and font on the Step text and the Choices."
              caption="A published Journey wearing its Theme."
            />

            <h3>Publish, restore, and Preview</h3>
            <p>
              Publishing takes a snapshot of the Draft and makes it a Published
              Version. A Published Version never changes: at most one is live to
              Participants at a time, and every earlier one is kept. The
              Versions tab lists them; from there you can make an earlier one
              live again, or restore its contents into the Draft to keep editing
              from there. <strong>Preview</strong> walks the Draft the way a
              Participant would, and records nothing.
            </p>
            <Still
              slug="versions"
              alt="The Versions tab: the Draft row and the Published Versions beneath it, one of them marked live."
              caption="The Versions tab."
            />

            <h3>Share the link</h3>
            <p>
              A live Journey has one link, shown on its page with a copy button.
              That link is the whole of discovery: nobody finds a Journey except
              by being given it. The Project’s public page has a link too,
              listing every Journey in it that is live.
            </p>

            <h3>Analytics on the graph</h3>
            <p>
              The Analytics tab draws a Published Version the same way the
              canvas does, read-only, with the number of Runs on every box and
              every arrow, so you can see where Participants went and where they
              stopped. Endings that share an Outcome are counted together. Pick
              a Version to see its Runs; a Run always belongs to the Version it
              began on.
            </p>
            <Still
              slug="analytics"
              alt="The Analytics tab: the Journey's map with a Run count on every Step and every Choice arrow."
              caption="Runs drawn onto the graph."
            />

            <h3>Members and Author pages</h3>
            <p>
              Invite another Author to a Project from its Members tab; every
              Member is equal and can do everything, including inviting and
              removing. From Settings you can turn on your Author page, a public
              page with your name, picture, bio, and links, together with the
              Projects you belong to that have a live Journey. It is off until
              you turn it on.
            </p>
          </section>

          <section
            id="for-participants"
            aria-labelledby="for-participants-heading"
            className="flex scroll-mt-6 flex-col gap-4"
          >
            <h2 id="for-participants-heading">For Participants</h2>
            <p>
              A Participant is anyone who opens a Journey’s link. You read a
              Step, make a Choice, and live with where it takes you, until you
              reach an Ending.
            </p>
            <ul>
              <li>
                <strong>No account.</strong> There is nothing to sign up for and
                nothing to sign in to. A walk stores nothing that identifies
                you: no name, no email address, no IP address. It stores which
                Steps you visited, which Choices you made, and any answer you
                type into a Prompt, which the Journey’s Authors can read.
              </li>
              <li>
                <strong>A Run.</strong> Your walk becomes a Run on your first
                Choice, not when you open the Journey, and it is pinned to the
                Published Version you started on. A cookie in your browser
                remembers the Run so a reload or a return picks up where you
                left off.
              </li>
              <li>
                <strong>Going back.</strong> Your browser’s Back returns you to
                an earlier Step to choose differently. That is a Backtrack: your
                Run’s path becomes the route you are on now, not every detour.
              </li>
              <li>
                <strong>Endings.</strong> A Step with no Choices is an Ending,
                and the Journey tells you so. Opening the link again begins a
                new Run.
              </li>
            </ul>
            <Still
              slug="run"
              alt="A Step in the runner: its text, then the Choices as buttons beneath it."
              caption="A Step as a Participant reads it."
            />
          </section>

          <section
            id="good-to-know"
            aria-labelledby="good-to-know-heading"
            className="flex scroll-mt-6 flex-col gap-4"
          >
            <h2 id="good-to-know-heading">Good to know</h2>
            <ul>
              <li>
                <strong>Discovery is link-only.</strong> There is no directory
                and no search. A Journey or a Project is found only by the link
                its Authors hand out.
              </li>
              <li>
                <strong>
                  A Published Version never changes under a Participant.
                </strong>{" "}
                Publishing again makes a new Version; a Run in progress stays on
                the one it began on, so nobody is moved mid-walk.
              </li>
              <li>
                <strong>Responses are for Members only.</strong> What a
                Participant types into a Prompt is readable by the Project’s
                Members on the Journey’s Responses tab, and shown to no one
                else, never to another Participant.
              </li>
              <li>
                <strong>What is stored.</strong> The{" "}
                <Link href="/privacy">privacy policy</Link> lists it in full,
                for Authors and Participants alike.
              </li>
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter width="prose" />
    </div>
  );
}

/**
 * One of ticket 38's stills, in the page's own theme: the light one unless
 * `<html>` carries next-themes' `dark` class, and the dark one only then.
 * Plain `<img>` on purpose: the files are static, already sized for the
 * page, and the two variants swap by CSS alone with no client script.
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
        <StillImage
          slug={slug}
          scheme="light"
          alt={alt}
          className="dark:hidden"
        />
        <StillImage
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

function StillImage({
  slug,
  scheme,
  alt,
  className,
}: {
  slug: string;
  scheme: "light" | "dark";
  alt: string;
  className: string;
}) {
  return (
    // Static files at their display size; the image optimizer would add
    // nothing (the same call as the landing page's poster).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/demo/${slug}-${scheme}.png`}
      alt={alt}
      width={1280}
      height={720}
      data-still={slug}
      data-scheme={scheme}
      className={cn("aspect-video w-full", className)}
    />
  );
}
