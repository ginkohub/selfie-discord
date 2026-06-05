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
import { searchWiki } from "../wiki.js";

export default {
  cmd: ["wiki", "wikipedia"],
  cat: "tools",
  desc: "Search Wikipedia for a topic",
  roles: [Role.USER],
  exec: async (c) => {
    const query = (c.args || "").trim();
    if (!query) return await c.react("❌");

    try {
      const result = await searchWiki(query);
      if (!result) return await c.reply("Not found.");

      const reply = `**${result.title}**\n${(result.text || "").slice(0, 1900)}\n${result.url}`;
      await c.reply(reply);
    } catch {
      await c.react("❌");
    }
  },
};
