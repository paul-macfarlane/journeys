import type {
  Block,
  Content,
  Paragraph,
  TextElement,
} from "@/lib/graph/content";
import type {
  Choice,
  GraphDocument,
  Outcome,
  Prompt,
  Step,
} from "@/lib/graph/document";

/**
 * A hand-authored journey at the size a real one reaches: 44 Steps, 55
 * Choices, 6 Endings, and 3 Outcomes, with branches that split and merge and
 * never lead back on themselves. It is the success case for publish-time
 * validation, and the document the e2e spec round-trips through storage.
 *
 * The theme is deliberately neutral. Every field is written out so that
 * parsing it and round-tripping it through JSON both return it unchanged.
 */

function text(value: string): TextElement {
  return { type: "text", text: value };
}

function paragraph(...inline: TextElement[]): Paragraph {
  return { type: "paragraph", content: inline };
}

function doc(...blocks: Block[]): Content {
  return { type: "doc", content: blocks };
}

function choice(id: string, label: string, targetStepId: string): Choice {
  return { id, label, targetStepId, condition: null, effect: null };
}

function step(
  id: string,
  title: string,
  content: Content,
  choices: Choice[],
  options: { prompt?: Prompt; outcomeId?: string } = {},
): Step {
  return {
    id,
    title,
    content,
    choices,
    prompt: options.prompt ?? null,
    outcomeId: options.outcomeId ?? null,
    position: null,
  };
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const outcomes: Outcome[] = [
  { id: "outcome-kept-the-light", label: "Kept the light" },
  { id: "outcome-lost-the-light", label: "Lost the light" },
  { id: "outcome-left-the-rock", label: "Left the rock" },
];

const steps: Step[] = [
  step(
    "step-01",
    "The light fails",
    doc(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [text("A quarter past two")],
      },
      paragraph(
        text("The lamp stutters once and goes out. You are "),
        { type: "text", text: "alone", marks: [{ type: "bold" }] },
        text(" on the rock, and the tide is running onto the reef."),
      ),
    ),
    [
      choice("choice-01-1", "Go down to the oil store", "step-02"),
      choice("choice-01-2", "Climb to the lamp room", "step-03"),
      choice("choice-01-3", "Step out onto the gallery", "step-04"),
    ],
  ),
  step(
    "step-02",
    "Down to the oil store",
    doc(paragraph(text("The store smells of paraffin and cold stone."))),
    [choice("choice-02-1", "Look for a spare wick", "step-05")],
  ),
  step(
    "step-03",
    "Up to the lamp room",
    doc(
      paragraph(text("Glass rings under your boots. Something has cracked.")),
    ),
    [choice("choice-03-1", "Examine the lens", "step-06")],
  ),
  step(
    "step-04",
    "Out to the gallery",
    doc(paragraph(text("The wind takes the door out of your hand."))),
    [choice("choice-04-1", "Hold the rail and look east", "step-07")],
  ),
  step(
    "step-05",
    "The spare wick",
    doc(
      paragraph(
        text("One spare wick, dry, in a tin. It will burn for "),
        { type: "text", text: "one night", marks: [{ type: "italic" }] },
        text(", no more."),
      ),
    ),
    [choice("choice-05-1", "Carry oil up the stair", "step-08")],
  ),
  step(
    "step-06",
    "The cracked lens",
    doc(paragraph(text("A panel of the lens has split from rim to centre.")), {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [paragraph(text("The clockwork still turns"))],
        },
        {
          type: "listItem",
          content: [paragraph(text("The burner is sound"))],
        },
        {
          type: "listItem",
          content: [paragraph(text("The panel will not hold a beam"))],
        },
      ],
    }),
    [
      choice("choice-06-1", "Turn the lens by hand", "step-09"),
      choice("choice-06-2", "Write it up in the log", "step-10"),
    ],
    {
      prompt: {
        type: "free_text",
        label: "What would you do first, and why?",
        required: false,
        decides: false,
      },
    },
  ),
  step(
    "step-07",
    "The gale on the gallery",
    doc(
      paragraph(text("Spray reaches the gallery, sixty feet above the sea.")),
    ),
    [choice("choice-07-1", "Work along to the broken rail", "step-11")],
  ),
  step(
    "step-08",
    "Carrying oil up the stair",
    doc(paragraph(text("Ninety-four steps with a full can in each hand."))),
    [choice("choice-08-1", "Fill the burner", "step-12")],
  ),
  step(
    "step-09",
    "Turning the lens by hand",
    doc(paragraph(text("Your shoulder sets into the rhythm of the drive."))),
    [choice("choice-09-1", "Keep turning until the burner is lit", "step-12")],
  ),
  step(
    "step-10",
    "The logbook",
    doc(
      paragraph(
        text("You write the hour, the wind, and the fault. The "),
        {
          type: "text",
          text: "keeper's log",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://example.test/keepers-log",
                rel: "noopener noreferrer",
              },
            },
          ],
        },
        text(" has never missed a night."),
      ),
    ),
    [choice("choice-10-1", "Close the book and decide", "step-13")],
  ),
  step(
    "step-11",
    "The broken handrail",
    doc(
      paragraph(text("Two stanchions have gone. The rail hangs over the sea.")),
    ),
    [choice("choice-11-1", "Go back inside and decide", "step-13")],
  ),
  step(
    "step-12",
    "The lamp relit",
    doc(
      paragraph(
        text("The flame catches, steadies, and throws its first beam."),
      ),
    ),
    [
      choice("choice-12-1", "Signal the shore", "step-14"),
      choice("choice-12-2", "Wait for the tide", "step-15"),
    ],
  ),
  step(
    "step-13",
    "The keeper's decision",
    doc(paragraph(text("Nothing about the night is going to get easier."))),
    [
      choice("choice-13-1", "Wait for the tide", "step-15"),
      choice("choice-13-2", "Fire the lifeboat flare", "step-16"),
    ],
  ),
  step(
    "step-14",
    "Signal to the shore",
    doc(
      paragraph(
        text("You work the shutter: three long, three short, three long."),
      ),
      {
        type: "image",
        attrs: {
          src: "https://example.test/images/signal-lamp.jpg",
          alt: "A hand-worked signal lamp on a stone gallery",
          caption: "Coastal Archive, public domain",
        },
      },
    ),
    [choice("choice-14-1", "Stand the midnight watch", "step-17")],
  ),
  step(
    "step-15",
    "Wait for the tide",
    doc(paragraph(text("Low water is at four. Until then the reef is under."))),
    [choice("choice-15-1", "Watch the fog come in", "step-18")],
  ),
  step(
    "step-16",
    "The lifeboat flare",
    doc(
      paragraph(text("The flare climbs, hangs red over the water, and dies.")),
    ),
    [choice("choice-16-1", "Ring the bell", "step-19")],
  ),
  step(
    "step-17",
    "Midnight watch",
    doc(paragraph(text("An hour of nothing but the beam going round."))),
    [
      choice("choice-17-1", "A ship's light, too far west", "step-20"),
      choice("choice-17-2", "Get the rowing boat ready", "step-21"),
    ],
  ),
  step(
    "step-18",
    "The fog rolls in",
    doc(paragraph(text("The fog comes off the water in one slow wall.")), {
      type: "orderedList",
      attrs: { start: 1 },
      content: [
        {
          type: "listItem",
          content: [paragraph(text("Sound the fog signal"))],
        },
        {
          type: "listItem",
          content: [paragraph(text("Log the hour it closed in"))],
        },
        {
          type: "listItem",
          content: [paragraph(text("Keep the beam turning"))],
        },
      ],
    }),
    [
      choice("choice-18-1", "Get the rowing boat ready", "step-21"),
      choice("choice-18-2", "Watch the reef in the dark", "step-22"),
    ],
  ),
  step(
    "step-19",
    "The bell tower",
    doc(paragraph(text("The bell carries further than any light tonight."))),
    [
      choice("choice-19-1", "Watch the reef in the dark", "step-22"),
      choice("choice-19-2", "Try the radio", "step-23"),
    ],
  ),
  step(
    "step-20",
    "A ship on the reef",
    doc(
      paragraph(
        text("She strikes at ten past one, and the sound reaches you late."),
      ),
    ),
    [choice("choice-20-1", "Pull for the wreck", "step-24")],
  ),
  step(
    "step-21",
    "The rowing boat",
    doc(
      paragraph(
        text("The boat is sound, the oars are shipped, the sea is not."),
      ),
    ),
    [choice("choice-21-1", "Go out to whoever is there", "step-25")],
  ),
  step(
    "step-22",
    "The reef in the dark",
    doc(paragraph(text("You hear voices before you see anything at all."))),
    [choice("choice-22-1", "Go down to the water", "step-26")],
  ),
  step(
    "step-23",
    "The radio",
    doc(paragraph(text("The set warms, hisses, and finds the shore station."))),
    [choice("choice-23-1", "Ask for the shore party", "step-27")],
  ),
  step(
    "step-24",
    "Pulling for the wreck",
    doc(
      paragraph(
        text("Twenty minutes of rowing that feel like the whole night."),
      ),
    ),
    [choice("choice-24-1", "Come back with what you found", "step-28")],
  ),
  step(
    "step-25",
    "Two survivors",
    doc(paragraph(text("Two of them, in the water, holding a hatch cover."))),
    [
      choice("choice-25-1", "Row back to the rock", "step-28"),
      choice("choice-25-2", "Get them warm first", "step-29"),
    ],
  ),
  step(
    "step-26",
    "The cold water",
    doc(
      paragraph(
        text("The cold takes your breath before it takes anything else."),
      ),
    ),
    [
      choice("choice-26-1", "Get them warm", "step-29"),
      choice("choice-26-2", "Check what is left in the tank", "step-30"),
    ],
  ),
  step(
    "step-27",
    "The shore party",
    doc(paragraph(text("They will launch at first light, and not before."))),
    [
      choice("choice-27-1", "Check what is left in the tank", "step-30"),
      choice("choice-27-2", "Wait for the relief boat", "step-31"),
    ],
  ),
  step(
    "step-28",
    "Back on the rock",
    doc(paragraph(text("You get them onto the landing on the third attempt."))),
    [choice("choice-28-1", "Wait for morning", "step-32")],
  ),
  step(
    "step-29",
    "The stove and blankets",
    doc(
      paragraph(
        text("The stove is lit, the blankets are damp, and it is enough."),
      ),
    ),
    [choice("choice-29-1", "Write the letter", "step-33")],
  ),
  step(
    "step-30",
    "The last of the oil",
    doc(
      paragraph(
        text("An inch in the bottom of the tank, and eight hours of dark."),
      ),
    ),
    [choice("choice-30-1", "Measure what is left", "step-34")],
  ),
  step(
    "step-31",
    "The relief boat",
    doc(
      paragraph(text("The relief is nine days late and everyone knows why.")),
    ),
    [choice("choice-31-1", "Pack what is yours", "step-35")],
  ),
  step(
    "step-32",
    "Morning",
    doc(paragraph(text("Grey light, a flat sea, and a lamp still burning."))),
    [choice("choice-32-1", "Put out the light for the day", "step-36")],
  ),
  step(
    "step-33",
    "The inspector's letter",
    doc(paragraph(text("The letter asks how a lens came to be cracked."))),
    [
      choice("choice-33-1", "Say the light never failed", "step-36"),
      choice("choice-33-2", "Write the report as it happened", "step-37"),
    ],
  ),
  step(
    "step-34",
    "The empty tank",
    doc(paragraph(text("You tip the can and nothing comes out of it."))),
    [
      choice("choice-34-1", "Write the report as it happened", "step-37"),
      choice("choice-34-2", "Signal for the mainland", "step-38"),
    ],
  ),
  step(
    "step-35",
    "Leaving the rock",
    doc(paragraph(text("The kit bag has been packed since the spring."))),
    [
      choice("choice-35-1", "Take the boat to the mainland", "step-38"),
      choice("choice-35-2", "Walk away and say nothing", "step-44"),
    ],
  ),
  step(
    "step-36",
    "The light holds",
    doc(
      paragraph(
        text("The lamp is trimmed, the lens is bound, the night is over."),
      ),
    ),
    [
      choice("choice-36-1", "Enter it in the log", "step-39"),
      choice("choice-36-2", "Count the people on the landing", "step-40"),
    ],
  ),
  step(
    "step-37",
    "The report",
    doc(
      paragraph(text("Four pages, no excuses, and your name at the bottom.")),
    ),
    [
      choice("choice-37-1", "Count the people on the landing", "step-40"),
      choice("choice-37-2", "Ask to be relieved", "step-41"),
    ],
  ),
  step(
    "step-38",
    "The mainland",
    doc(
      paragraph(
        text("From the harbour wall the rock is a thumbnail on the horizon."),
      ),
      {
        type: "image",
        attrs: {
          src: "https://example.test/images/harbour-wall.jpg",
          alt: "",
          caption: "Harbour Trust collection",
        },
      },
    ),
    [
      choice("choice-38-1", "Look back at a dark tower", "step-42"),
      choice("choice-38-2", "Read the casualty list", "step-43"),
    ],
  ),
  step(
    "step-39",
    "The light never went out",
    doc(
      paragraph(
        text("Every hour of the night is in the book, and every hour is lit."),
      ),
    ),
    [],
    { outcomeId: "outcome-kept-the-light" },
  ),
  step(
    "step-40",
    "Both lives saved",
    doc(
      paragraph(text("Two people go ashore on the relief boat, and you stay.")),
    ),
    [],
    { outcomeId: "outcome-kept-the-light" },
  ),
  step(
    "step-41",
    "A new keeper takes the rock",
    doc(
      paragraph(
        text("You hand over the keys, the log, and the cracked panel."),
      ),
    ),
    [],
    { outcomeId: "outcome-left-the-rock" },
  ),
  step(
    "step-42",
    "The light went dark",
    doc(
      paragraph(
        text("For six hours the reef was unmarked, and the sea knew it."),
      ),
    ),
    [],
    { outcomeId: "outcome-lost-the-light" },
  ),
  step(
    "step-43",
    "Lost at the reef",
    doc(paragraph(text("The list is short, which is the only mercy in it."))),
    [],
    { outcomeId: "outcome-lost-the-light" },
  ),
  step(
    "step-44",
    "You walked away",
    doc(paragraph(text("Nobody asked you anything, and you never went back."))),
    [],
    { outcomeId: "outcome-left-the-rock" },
  ),
];

export const largeJourney: GraphDocument = {
  schemaVersion: 1,
  startStepId: "step-01",
  allowBack: true,
  steps: byId(steps),
  outcomes: byId(outcomes),
  layoutDirection: "TB",
};
