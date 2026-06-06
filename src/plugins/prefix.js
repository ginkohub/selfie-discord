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
import settings from "../settings.js";

export default [
  {
    cmd: ["prefix"],
    cat: "admin",
    desc: "Show current prefixes",
    roles: [Role.SUPERADMIN],
    exec: async (c) => {
      await c.reply(`Current prefixes: ${settings.prefix.join(", ")}`);
    },
  },
  {
    cmd: ["prefix+"],
    cat: "admin",
    desc: "Add a prefix",
    roles: [Role.SUPERADMIN],
    exec: async (c) => {
      const p = c.args?.trim();
      if (!p) return await c.reply("Usage: prefix+ <prefix>");
      if (settings.prefix.includes(p))
        return await c.reply(`"${p}" is already a prefix.`);
      settings.prefix = [...settings.prefix, p];
      await c.reply(`Added "${p}". Current: ${settings.prefix.join(", ")}`);
    },
  },
  {
    cmd: ["prefix-"],
    cat: "admin",
    desc: "Remove a prefix",
    roles: [Role.SUPERADMIN],
    exec: async (c) => {
      const p = c.args?.trim();
      if (!p) return await c.reply("Usage: prefix- <prefix>");
      if (!settings.prefix.includes(p))
        return await c.reply(`"${p}" is not a prefix.`);
      settings.prefix = settings.prefix.filter((x) => x !== p);
      await c.reply(`Removed "${p}". Current: ${settings.prefix.join(", ")}`);
    },
  },
];
