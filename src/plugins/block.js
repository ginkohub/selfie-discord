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
    cmd: ["block", "b"],
    cat: "admin",
    desc: "Block a user",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const target = c.event.mentions.users.first();
      if (!target) return await c.reply("Mention a user to block.");
      c.handler().userManager.updateUser(target.id, {
        banned: true,
        bannedAt: new Date().toISOString(),
      });
      await c.reply(`Blocked ${target.username}.`);
    },
  },
  {
    cmd: ["unblock", "ub"],
    cat: "admin",
    desc: "Unblock a user",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const target = c.event.mentions.users.first();
      if (!target) return await c.reply("Mention a user to unblock.");
      c.handler().userManager.updateUser(target.id, {
        banned: false,
        bannedAt: null,
      });
      await c.reply(`Unblocked ${target.username}.`);
    },
  },
];
