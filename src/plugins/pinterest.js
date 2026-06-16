/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

/**
 * Credits to https://github.com/siputzx for the API.
 */

import { Role, translate } from "#selfie";

const t = translate({
  en: {
    help: "Use `{prefix}pinterest <query>` to get 5 Pinterest images.",
    not_found: 'No results found for "{query}".',
    api_error: "API request failed.",
    header: 'Pinterest results for "{query}"',
  },
  id: {
    help: "Gunakan `{prefix}pinterest <query>` untuk 5 gambar Pinterest.",
    not_found: 'Tidak ada hasil untuk "{query}".',
    api_error: "Gagal mengambil data.",
    header: 'Hasil Pinterest untuk "{query}"',
  },
});

export default {
  cmd: ["pinterest", "pin"],
  cat: "tools",
  desc: "Search Pinterest images",
  roles: [Role.USER],
  exec: async (c) => {
    let args = (c.args || "").trim();
    if (!args || args === "?") return await c.reply(t("help", {}, c));

    const maxMatch = args.match(/(?:^|\s)-n\s+(\d+)(?:\s|$)/);
    const limit = Math.min(Math.max(parseInt(maxMatch?.[1], 10) || 5, 1), 10);
    args = args.replace(/(?:^|\s)-n\s+\d+(?:\s|$)/, " ").trim();

    await c.react("⏳");

    try {
      const res = await fetch(
        `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(args)}&type=image`,
        { headers: { "User-Agent": "SelfieBot/1.0" } },
      );
      if (!res.ok) {
        await c.react("❌");
        return;
      }

      const data = await res.json();
      if (!data?.status || !data.data?.length)
        return await c.reply(t("not_found", { query: args }, c));

      const items = data.data.slice(0, limit);

      await c.reply({
        content: `${data.data.length} results found for "${args}"`,
        files: items.map((i) => i.image_url),
      });
    } catch {
      await c.react("❌");
    }
  },
};
