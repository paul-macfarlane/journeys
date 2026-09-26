// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useAutosavedForm } from "@/components/autosaved-form";
import type { ActionResult } from "@/lib/action-result";

/**
 * `useAutosavedForm` as the Settings page holds it: a record of fields whose
 * refusal is shown under the field, and the server's values arriving on a
 * refresh some other save asked for.
 */

const schema = z.object({
  name: z.string().min(1, "Enter a name"),
  website: z
    .string()
    .refine((url) => url === "" || url.startsWith("https://"), {
      message: "Use an https:// link",
    }),
});
type Fields = z.infer<typeof schema>;

type Held = ReturnType<typeof useAutosavedForm<Fields>>;
let held: Held | null = null;

function expose(autosaved: Held) {
  held = autosaved;
}

function Surface({
  values,
  submit,
}: {
  values: Fields;
  submit: (values: Fields, baseline: Fields) => Promise<ActionResult>;
}) {
  const autosaved = useAutosavedForm<Fields>({
    schema,
    values,
    submit,
    onSaved: () => {},
  });
  // Every render hands the test the latest, as the page would read it.
  useEffect(() => {
    expose(autosaved);
  });
  return null;
}

function surface(): Held {
  if (held === null) throw new Error("Surface has not rendered");
  return held;
}

let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
  held = null;
});

describe("useAutosavedForm", () => {
  it("a refusal under a field still being edited survives the server's values arriving, while an untouched field adopts them", async () => {
    const submit = vi.fn(async (): Promise<ActionResult> => ({
      ok: true,
      id: "u1",
    }));
    act(() => {
      root.render(
        <Surface values={{ name: "Ada", website: "" }} submit={submit} />,
      );
    });

    // The Author leaves the Website field holding a link that is not https.
    await act(async () => {
      surface().form.setValue("website", "http://example.com");
      await surface().flush("website");
    });
    expect(surface().form.getFieldState("website").error?.message).toBe(
      "Use an https:// link",
    );
    expect(submit).not.toHaveBeenCalled();

    // Another save's refresh hands the form the server's values: a fresh
    // object, with a name another tab stored.
    act(() => {
      root.render(
        <Surface values={{ name: "Grace", website: "" }} submit={submit} />,
      );
    });

    expect(surface().form.getValues()).toEqual({
      name: "Grace",
      website: "http://example.com",
    });
    expect(surface().form.getFieldState("website").error?.message).toBe(
      "Use an https:// link",
    );
    expect(surface().form.getFieldState("name").error).toBeUndefined();
    expect(surface().status).toBe("unsaved");
  });
});
