/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { Role } from "../roles.js";
import { translate, translateText } from "../translate.js";

const t = translate({
  en: {
    usage:
      "Usage: {prefix}tr [lang] [-r] [-e google|libre] <text>\n       {prefix}tr? — show this help\n       {prefix}trr — translate & edit in-place",
  },
  id: {
    usage:
      "Penggunaan: {prefix}tr [lang] [-r] [-e google|libre] <teks>\n       {prefix}tr? — bantuan ini\n       {prefix}trr — terjemahkan & edit langsung",
  },
});

export default {
  cmd: ["tr", "trr", "tr?", "translate"],
  cat: "tools",
  desc: "Translate text (Google/LibreTranslate)",
  roles: [Role.USER],
  exec: async (c) => {
    if (c.cmd === "tr?")
      return await c.reply(t("usage", { prefix: c.prefix }, c));

    const raw = c.args?.trim() || "";

    let target = "en";
    let editLast = c.cmd === "trr";
    let engine = "google";
    let langSet = false;
    const textParts = [];

    const tokens = raw.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const p = tokens[i];
      if (p === "-r") {
        editLast = true;
      } else if (p === "-e" && i + 1 < tokens.length) {
        engine = tokens[++i];
      } else if (!langSet && /^[a-z]{2}$/.test(p)) {
        target = p;
        langSet = true;
      } else {
        textParts.push(p);
      }
    }

    let text = textParts.join(" ");
    if (!text) {
      const ref = c.event.reference;
      if (ref?.messageId) {
        const replied = await c.event.channel.messages.fetch(ref.messageId);
        text = replied.content;
      }
    }
    if (!text) return await c.react("❌");

    try {
      const translated = await translateText(text, target, { engine });

      if (editLast) {
        await c.event.edit(translated);
      } else {
        await c.reply(translated);
      }
    } catch (_err) {
      await c.react("❌");
    }
  },
};
