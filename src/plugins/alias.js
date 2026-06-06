/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Role } from "../roles.js";

export default [
  {
    cmd: ["alias", "aliases"],
    cat: "admin",
    desc: "List all command aliases",
    roles: [Role.USER],
    exec: async (c) => {
      const aliases = c.handler().getAliases();
      const entries = Object.entries(aliases);
      if (entries.length === 0) return await c.reply("No aliases configured.");

      const lines = ["*Command Aliases*", ""];
      for (const [alias, target] of entries) {
        lines.push(`- **${alias}** → ${target}`);
      }
      await c.reply(lines.join("\n"));
    },
  },
  {
    cmd: ["alias+"],
    cat: "admin",
    desc: "Add a command alias. Usage: alias+ <name> <target_command>",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const parts = (c.args || "").split(/ +/);
      const name = parts.shift()?.toLowerCase();
      const target = parts.shift()?.toLowerCase();
      if (!name || !target) return await c.reply("Usage: `alias+ <name> <target_command>`");

      const handler = c.handler();
      const aliases = handler.getAliases();
      aliases[name] = target;
      handler.saveAliases(aliases);
      await c.react("✅");
    },
  },
  {
    cmd: ["alias-"],
    cat: "admin",
    desc: "Remove a command alias. Usage: alias- <name>",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const name = (c.args || "").trim().toLowerCase();
      if (!name) return await c.reply("Usage: `alias- <name>`");

      const handler = c.handler();
      const aliases = handler.getAliases();
      if (!aliases[name]) return await c.reply(`Alias "${name}" not found.`);

      delete aliases[name];
      handler.saveAliases(aliases);
      await c.react("✅");
    },
  },
];
