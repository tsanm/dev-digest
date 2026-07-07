import type { IconName } from "@devdigest/ui";

/** Add-skill dropdown menu items (labels resolved via i18n at render).
 *  "create" = a blank manual skill (edited inline); "file" = import a markdown
 *  body (untrusted → lands disabled). URL + community import are out of scope. */
export const ADD_MENU: readonly { action: "create" | "file"; labelKey: string; icon: IconName }[] = [
  { action: "create", labelKey: "page.menu.create", icon: "Plus" },
  { action: "file", labelKey: "page.menu.fromFile", icon: "Upload" },
];

/** Starter body for a brand-new manual skill (user edits it inline after). */
export const NEW_SKILL_BODY = "# New skill\n\nDescribe the rule the reviewer should enforce here.";

/** Left rail / dropdown widths (px). */
export const SIDEBAR_WIDTH = 290;
export const ADD_MENU_WIDTH = 230;
