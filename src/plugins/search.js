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

const API = "https://api.siputzx.my.id/api/s";

const t = translate({
  en: {
    help: "Use `{prefix}search <query>` to search the web (DuckDuckGo).\n`{prefix}search yt <query>` for YouTube.\n`{prefix}search gsm <query>` for GSMArena.",
    not_found: "No results.",
    yt_result: "[{title}]({url})",
    gsm_result: "**{name}**\n{description}",
  },
  id: {
    help: "Gunakan `{prefix}search <query>` untuk cari web (DuckDuckGo).\n`{prefix}search yt <query>` untuk YouTube.\n`{prefix}search gsm <query>` untuk GSMArena.",
    not_found: "Tidak ada hasil.",
    yt_result: "[{title}]({url})",
    gsm_result: "**{name}**\n{description}",
  },
});

export default {
  cmd: ["search", "s"],
  cat: "tools",
  desc: "Search web, YouTube, or GSMArena",
  roles: [Role.USER],
  exec: async (c) => {
    let args = (c.args || "").trim();
    if (!args || args === "?") return await c.reply(t("help", {}, c));

    const maxMatch = args.match(/(?:^|\s)-n\s+(\d+)(?:\s|$)/);
    const limit = Math.min(Math.max(parseInt(maxMatch?.[1], 10) || 5, 1), 10);
    args = args.replace(/(?:^|\s)-n\s+\d+(?:\s|$)/, " ").trim();

    await c.react("⏳");

    try {
      const parts = args.split(/\s+/);
      const engine = parts[0].toLowerCase();
      const query = parts.slice(1).join(" ");

      if (engine === "yt" && query) {
        const res = await fetch(
          `${API}/youtube?query=${encodeURIComponent(query)}`,
          { headers: { "User-Agent": "SelfieBot/1.0" } },
        );
        const data = await res.json();
        if (!data?.status || !data.data?.length)
          return await c.reply(t("not_found", {}, c));

        const items = data.data.slice(0, limit);
        const lines = items.map((i) =>
          t("yt_result", { title: i.title || i.name, url: i.url }, c),
        );
        return await c.reply(lines.join("\n\n"));
      }

      if (engine === "gsm" && query) {
        const res = await fetch(
          `${API}/gsmarena?query=${encodeURIComponent(query)}`,
          { headers: { "User-Agent": "SelfieBot/1.0" } },
        );
        const data = await res.json();
        if (!data?.status || !data.data?.length)
          return await c.reply(t("not_found", {}, c));

        const items = data.data.slice(0, limit);
        const lines = items.map((i) =>
          t(
            "gsm_result",
            { name: i.name, description: (i.description || "").slice(0, 200) },
            c,
          ),
        );
        return await c.reply(lines.join("\n\n"));
      }

      // Default: DuckDuckGo
      const res = await fetch(
        `${API}/duckduckgo?query=${encodeURIComponent(args)}`,
        { headers: { "User-Agent": "SelfieBot/1.0" } },
      );
      const data = await res.json();
      if (!data?.status || !data.data?.results?.length)
        return await c.reply(t("not_found", {}, c));

      const items = data.data.results.slice(0, limit);
      const lines = items.map((i) => `[${i.title}](${i.url})\n${i.snippet}`);
      return await c.reply(
        `${data.data.results.length} results found\n\n${lines.join("\n\n").slice(0, 1900)}`,
      );
    } catch {
      await c.react("❌");
    }
  },
};
