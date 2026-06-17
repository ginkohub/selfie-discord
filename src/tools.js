/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import chokidar from "chokidar";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Split text into Discord-safe chunks (max 2000 chars).
 * Splits on \n\n paragraph boundaries; falls back per-line for oversize chunks.
 */
export function splitText(text, maxLen = 2000) {
  if (text.length <= maxLen) return [text];

  const splitLong = (s) => {
    const res = [];
    let i = 0;
    while (i < s.length) {
      let end = Math.min(i + maxLen, s.length);
      if (end < s.length) {
        const brk = s.lastIndexOf("\n", end);
        if (brk > i) end = brk;
      }
      res.push(s.slice(i, end).trim());
      i = end;
    }
    return res;
  };

  const parts = text.split(/\n\n+/);
  const chunks = [];
  let buf = "";
  for (const p of parts) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (next.length > maxLen) {
      if (buf) chunks.push(buf);
      if (p.length > maxLen) {
        chunks.push(...splitLong(p));
      } else {
        buf = p;
      }
    } else {
      buf = next;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export const formatDate = (date) => new Date(date).toISOString();

export const watchDir = (dir, callback) => {
  const watcher = chokidar.watch(dir, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("change", (path) => callback("change", path));
  watcher.on("add", (path) => callback("add", path));
  watcher.on("unlink", (path) => callback("unlink", path));

  return watcher;
};
