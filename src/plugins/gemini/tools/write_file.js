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
import path from "node:path";
import { ensureSandbox, sandboxPath } from "./_sandbox.js";

export default {
  fn: {
    name: "write_file",
    description: "Create or overwrite a file inside the sandbox",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path inside sandbox (e.g. data.txt, notes/hello.txt)",
        },
        content: {
          type: "string",
          description: "Text content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  execute: async (params) => {
    ensureSandbox();
    const filePath = sandboxPath(params.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, params.content, "utf-8");
    return { path: params.path, written: params.content.length };
  },
};
