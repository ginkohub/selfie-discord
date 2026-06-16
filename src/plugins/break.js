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
import { read, write } from "../store.js";
import { translate } from "../translate.js";

const t = translate({
  en: { paused: "_Bot paused_", unpaused: "_Bot resumed_" },
  id: { paused: "_Bot dijeda_", unpaused: "_Bot dilanjutkan_" },
});

export default {
  cmd: ["break"],
  cat: "system",
  desc: "Pause/resume all bot responses",
  roles: [Role.ADMIN],
  exec: async (c) => {
    const data = read();
    data.paused = !data.paused;
    write(data);
    await c.reply(t(data.paused ? "paused" : "unpaused", {}, c));
  },
};
