/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { EVENTS } from "../const.js";
import pen from "../pen.js";

/** @type {import('../plugin.js').Plugin} */
export default {
  events: [EVENTS.MESSAGE_CREATE],
  exec: async (c) => {
    const message = c.event;
    if (!message?.author) return;

    const client = c.client;

    const location = message.guild ? message.guild.name : "Direct Message";
    const type = message.author.id === client.user.id ? "OUT" : "IN";
    const content =
      message.content?.length > 70
        ? `${message.content.slice(0, 70)}...`
        : message.content || "(no content)";

    pen.Info(`${type} | [${location}] ${message.author.tag}: ${content}`);
  },
};
