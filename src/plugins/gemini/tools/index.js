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
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadTools() {
  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith(".js") && f !== "index.js" && !f.startsWith("_"))
    .sort();

  const tools = [];
  const executors = {};

  for (const file of files) {
    try {
      const mod = await import(`./${file}`);
      const tool = mod.default || mod;
      if (!tool.fn?.name || !tool.execute) continue;
      tools.push({ function: tool.fn });
      executors[tool.fn.name] = tool.execute;
    } catch (e) {
      console.error(`[gemini tools] failed to load ${file}:`, e);
    }
  }

  return {
    tools,
    executor: (name, params) => {
      const fn = executors[name];
      if (!fn) return { error: `Unknown tool: ${name}` };
      return fn(params);
    },
  };
}
