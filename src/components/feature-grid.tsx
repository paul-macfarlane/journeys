import { cn } from "@/lib/utils";

/**
 * The splash page's six feature cards (ticket 54). Each shows a still that
 * `scripts/record-landing-demo.ts` wrote into `public/demo/<slug>-{light,
 * dark}.png`, switched with the page's theme by CSS alone like the recording
 * in `CanvasDemo`: no hand-captured screenshot anywhere on the page. The
 * canvas itself is the video hero above, not a card.
 */
const FEATURES = [
  {
    slug: "versions",
    title: "Publish immutable versions",
    text: "Publishing snapshots the draft. Participants walk the version you published while you keep editing, and any earlier version can be restored.",
  },
  {
    slug: "run",
    title: "Anonymous runs, no account",
    text: "A participant opens a link, reads a step, makes a choice, and lives with it. No sign-up, no tracking of who they are.",
  },
  {
    slug: "analytics",
    title: "Analytics on the graph",
    text: "See where participants went, drawn onto the same map you authored: which choices they took and which endings they reached.",
  },
  {
    slug: "prompt",
    title: "Prompts with an AI-decided choice",
    text: "A step can ask an open question. An AI reads the participant's answer and picks the choice that fits it.",
  },
  {
    slug: "themes",
    title: "Themes",
    text: "Give each journey its own look for participants: a palette preset and an accent colour, set for the project and overridable per journey.",
  },
  {
    slug: "rich-text",
    title: "Rich text with images and credits",
    text: "Steps carry headings, lists, quotes, and images with captions and credits, edited in place on the canvas.",
  },
] as const;

type FeatureSlug = (typeof FEATURES)[number]["slug"];

export function FeatureGrid() {
  return (
    <ul
      className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Features"
    >
      {FEATURES.map((feature) => (
        <li
          key={feature.slug}
          className="ring-foreground/10 bg-card flex flex-col overflow-hidden rounded-xl shadow-sm ring-1"
          data-feature={feature.slug}
        >
          <div className="bg-muted">
            <FeatureStill slug={feature.slug} scheme="light" />
            <FeatureStill slug={feature.slug} scheme="dark" />
          </div>
          <div className="flex flex-col gap-2 p-5">
            <h3 className="font-medium">{feature.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {feature.text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FeatureStill({
  slug,
  scheme,
}: {
  slug: FeatureSlug;
  scheme: "light" | "dark";
}) {
  return (
    // A plain <img>, like the recording's poster: a still of the app at
    // its own size, shipped beside the page. Decorative: the heading and
    // text beside it say what it shows.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn(
        "aspect-video w-full",
        scheme === "light" ? "block dark:hidden" : "hidden dark:block",
      )}
      src={`/demo/${slug}-${scheme}.png`}
      width={1280}
      height={720}
      alt=""
      loading="lazy"
      data-still-scheme={scheme}
    />
  );
}
