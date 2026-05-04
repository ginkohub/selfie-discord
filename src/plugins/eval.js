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
  cmd: ["eval", ">"],
  cat: "system",
  desc: "Evaluate JavaScript code",
  roles: [Role.SUPERADMIN],

  exec: async (c) => {
    const src = c.args?.trim();
    if (!src) return;

    try {
      /* biome-ignore lint/security/noGlobalEval: it's a feature */
      let res = await eval(`(async () => { ${src} })()`);
      if (!res) return;

      if (typeof res === "object") res = JSON.stringify(res, null, 2);
      await c.reply(`${res}`);
    } catch (e) {
      await c.reply(`${e}`);
    }
  },
};
