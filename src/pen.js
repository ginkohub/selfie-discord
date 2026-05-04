/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const getTimestamp = () => {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
};

const format = (level, color, ...args) => {
  const ts = `${colors.gray}[${getTimestamp()}]${colors.reset}`;
  const lvl = `${color}${level.toUpperCase().padEnd(7)}${colors.reset}`;
  console.log(`${ts} ${lvl} |`, ...args);
};

const pen = {
  Debug: (...args) => format("debug", colors.cyan, ...args),
  Info: (...args) => format("info", colors.green, ...args),
  Warn: (...args) => format("warn", colors.yellow, ...args),
  Error: (...args) => format("error", colors.red, ...args),
};

export default pen;
