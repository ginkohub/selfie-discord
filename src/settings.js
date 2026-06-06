/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import "dotenv/config";
import { read, write } from "./store.js";

const parsePrefix = (raw) =>
  (raw || "!")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

class Settings {
  constructor() {
    const saved = read().settings || {};
    this._token = process.env.DISCORD_TOKEN;
    this._prefix = saved.prefix
      ? Array.isArray(saved.prefix)
        ? saved.prefix
        : parsePrefix(saved.prefix)
      : parsePrefix(process.env.PREFIX);
    this._serverPort =
      saved.serverPort ?? (Number(process.env.CAPTCHA_PORT) || 0);
  }

  get token() {
    return this._token;
  }

  get prefix() {
    return this._prefix;
  }

  set prefix(val) {
    this._prefix = Array.isArray(val) ? val : parsePrefix(val);
    this._save();
  }

  get serverPort() {
    return this._serverPort;
  }

  set serverPort(val) {
    this._serverPort = val;
    this._save();
  }

  _save() {
    const current = read();
    write({
      ...current,
      settings: { prefix: this._prefix, serverPort: this._serverPort },
    });
  }
}

export default new Settings();
