/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Role, translate } from "#selfie";

const t = translate({
  en: {
    usage: "Usage: {prefix}lang [en|id]",
    current: "Current language: *{lang}*",
    success: "Language successfully set to: *{lang}*",
    invalid: "Invalid language. Available: en, id",
  },
  id: {
    usage: "Penggunaan: {prefix}lang [en|id]",
    current: "Bahasa saat ini: *{lang}*",
    success: "Bahasa berhasil diatur ke: *{lang}*",
    invalid: "Bahasa tidak valid. Tersedia: en, id",
  },
});

/** @type {import('../plugin.js').Plugin} */
export default {
  cmd: ["lang", "language"],
  cat: "system",
  desc: "Set your preferred language",
  roles: [Role.USER],
  exec: async (c) => {
    const lang = c.args.trim().toLowerCase();
    const available = ["en", "id"];
    const userManager = c.handler().userManager;
    const currentUser = c.user();

    if (!lang) {
      return await c.reply(
        `${t("current", { lang: currentUser.lang }, c)}\n${t("usage", { prefix: c.prefix }, c)}`,
      );
    }

    if (!available.includes(lang)) {
      return await c.reply(t("invalid", {}, c));
    }

    userManager.updateUser(c.senderJid, { lang });
    await c.reply(t("success", { lang }, c));
  },
};
