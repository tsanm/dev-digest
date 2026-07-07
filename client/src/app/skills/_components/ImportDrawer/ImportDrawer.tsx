"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Drawer } from "@devdigest/ui";
import { DRAWER_WIDTH } from "./constants";
import { s } from "./styles";
import { FilePanel } from "./_components/FilePanel";

/** Skills import drawer: paste/upload a markdown skill body → preview → save.
 *  (URL + community import are out of scope for this build — file import only.) */
export function ImportDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  return (
    <Drawer width={DRAWER_WIDTH} title={t("drawer.title")} subtitle={t("drawer.subtitle")} onClose={onClose}>
      <div style={s.tabBody}>
        <FilePanel onDone={onClose} />
      </div>
    </Drawer>
  );
}
