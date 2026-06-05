/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { execSync } from "node:child_process";
import { Role } from "../roles.js";

export default {
  cmd: ["shell", "sh"],
  cat: "system",
  desc: "Execute shell commands",
  roles: [Role.SUPERADMIN],
  exec: async (c) => {
    const cmd = c.args?.trim();
    if (!cmd) return await c.react("❌");

    try {
      const out = execSync(cmd, { encoding: "utf-8", timeout: 30000 });
      const reply = `$ ${cmd}\n${out}`.trim();
      await c.reply(reply || "(empty output)");
    } catch (e) {
      const msg = `$ ${cmd}\n${e.stdout || ""}\n${e.stderr || e.message}`.trim();
      await c.reply(msg || "(command failed)");
    }
  },
};
