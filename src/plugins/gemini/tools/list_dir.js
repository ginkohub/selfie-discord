/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import fs from "node:fs";
import { ensureSandbox, sandboxPath } from "./_sandbox.js";

export default {
  fn: {
    name: "list_dir",
    description: "List files and directories inside the sandbox",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path inside sandbox (default: root)",
        },
      },
    },
  },
  execute: async (params) => {
    ensureSandbox();
    const dir = params.path ? sandboxPath(params.path) : sandboxPath(".");
    if (!fs.existsSync(dir)) {
      return { error: `Directory not found: ${params.path || "."}` };
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => ({ name: e.name, type: "file" }));
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, type: "dir" }));
    return {
      path: params.path || ".",
      entries: [...dirs, ...files],
      total: entries.length,
    };
  },
};
