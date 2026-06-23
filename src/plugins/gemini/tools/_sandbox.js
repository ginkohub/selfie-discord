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

const SANDBOX = path.resolve(process.cwd(), "sandbox");

export function sandboxPath(relative) {
  if (typeof relative !== "string" || !relative.trim()) {
    throw new Error("Path must be a non-empty string");
  }
  const resolved = path.resolve(SANDBOX, relative);
  const rel = path.relative(SANDBOX, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes sandbox");
  }
  return resolved;
}

export function ensureSandbox() {
  if (!fs.existsSync(SANDBOX)) {
    fs.mkdirSync(SANDBOX, { recursive: true });
  }
  return SANDBOX;
}
