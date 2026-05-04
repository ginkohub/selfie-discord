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

/** @type {import('../plugin.js').Plugin} */
export default {
  cmd: ["ping", "p"],
  cat: "system",
  desc: "Ping command",
  roles: [Role.USER],
  exec: async (c) => {
    await c.reply("Pong!");
  },
};
