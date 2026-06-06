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
