// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { dialogIsOpen } from "@/components/journeys/editor-shared";

/**
 * The page-wide "is a dialog holding the keyboard?" guard the Draft editor's
 * shortcuts ask before they claim a press (ticket 53): every open dialog
 * counts, and the Step sheet counts too unless the asker says it may be
 * ignored — which only undo and redo do.
 */

function openDialog(attributes: Record<string, string> = {}): HTMLElement {
  const dialog = window.document.createElement("div");
  dialog.setAttribute("role", "dialog");
  for (const [name, value] of Object.entries(attributes)) {
    dialog.setAttribute(name, value);
  }
  window.document.body.append(dialog);
  return dialog;
}

afterEach(() => {
  window.document.body.replaceChildren();
});

describe("dialogIsOpen", () => {
  it("is false with no dialog on the page", () => {
    expect(dialogIsOpen()).toBe(false);
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(false);
  });

  it("is true for an ordinary dialog, whether or not the Step sheet is ignored", () => {
    openDialog();
    expect(dialogIsOpen()).toBe(true);
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(true);
  });

  it("is true for an alert dialog", () => {
    const alert = window.document.createElement("div");
    alert.setAttribute("role", "alertdialog");
    window.document.body.append(alert);
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(true);
  });

  it("counts the Step sheet by default and not when it is ignored", () => {
    openDialog({ "data-step-sheet": "" });
    expect(dialogIsOpen()).toBe(true);
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(false);
  });

  it("ignores a dialog inside the Step sheet's marked container", () => {
    const sheet = window.document.createElement("div");
    sheet.setAttribute("data-step-sheet", "");
    const inner = window.document.createElement("div");
    inner.setAttribute("role", "dialog");
    sheet.append(inner);
    window.document.body.append(sheet);
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(false);
  });

  it("still counts another dialog opened over the Step sheet", () => {
    openDialog({ "data-step-sheet": "" });
    openDialog();
    expect(dialogIsOpen({ ignoreStepSheet: true })).toBe(true);
  });
});
