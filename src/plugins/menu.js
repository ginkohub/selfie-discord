/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { plugins } from "../plugin.js";
import { Role } from "../roles.js";
import { translate } from "../translate.js";

const t = translate({
  en: {
    header: "--- SELFIE-DISCORD MENU ---",
    footer: "Use {prefix}command for details",
    category: "Category",
    total: "Total Commands",
  },
  id: {
    header: "--- MENU SELFIE-DISCORD ---",
    footer: "Gunakan {prefix}command untuk detail",
    category: "Kategori",
    total: "Total Perintah",
  },
});

/** @type {import('../plugin.js').Plugin} */
export default {
  cmd: ["menu", "help", "h"],
  cat: "system",
  desc: "Show all available commands",
  roles: [Role.USER],
  exec: async (c) => {
    const categories = {};
    const prefix = c.prefix;

    for (const plugin of plugins) {
      if (!plugin.cmd) continue;

      const cat = plugin.cat || "uncategorized";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(plugin.cmd[0]);
    }

    const menu = [t("header", {}, c), ""];

    for (const [cat, cmds] of Object.entries(categories)) {
      menu.push(`[ ${cat.toUpperCase()} ]`);
      menu.push(`> ${cmds.map((cmd) => `\`${cmd}\``).join(", ")}`);
      menu.push("");
    }

    menu.push(`${t("total", {}, c)}: ${plugins.filter((p) => p.cmd).length}`);
    menu.push(t("footer", { prefix }, c));

    await c.reply(menu.join("\n").trim());
  },
};
