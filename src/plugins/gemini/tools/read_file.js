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
    name: "read_file",
    description: "Read the contents of a file inside the sandbox",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path inside sandbox (e.g. data.txt, notes/hello.txt)",
        },
      },
      required: ["path"],
    },
  },
  execute: async (params) => {
    ensureSandbox();
    const filePath = sandboxPath(params.path);
    if (!fs.existsSync(filePath)) {
      return { error: `File not found: ${params.path}` };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return { path: params.path, content, size: content.length };
  },
};
