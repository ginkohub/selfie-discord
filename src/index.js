/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { createClient } from "./client.js";
import { EVENTS } from "./const.js";
import { dispatcher } from "./handler.js";
import pen from "./pen.js";
import { initWatcher, loadPlugins } from "./plugin.js";
import settings from "./settings.js";

const start = async () => {
  await loadPlugins();
  initWatcher();

  const client = createClient();

  for (const [_key, eventName] of Object.entries(EVENTS)) {
    client.on(eventName, (...args) => {
      dispatcher(eventName, args[0], client);
    });
  }

  client.on(EVENTS.READY, () => {
    pen.Info(`${client.user.tag} is active`);
  });

  if (!settings.token) {
    pen.Error("DISCORD_TOKEN missing in .env");
    process.exit(1);
  }

  client.login(settings.token);
};

start();
