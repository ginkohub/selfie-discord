/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { read, write } from "./store.js";

export class ChatManager {
  constructor() {
    this.data = read().chats || {};
  }

  getChat(id) {
    if (!this.data[id]) {
      this.data[id] = {
        id,
        lang: "en",
      };
    }
    return this.data[id];
  }

  updateChat(id, update) {
    this.data[id] = { ...this.getChat(id), ...update };
    this.save();
  }

  save() {
    const current = read();
    write({ ...current, chats: this.data });
  }
}
