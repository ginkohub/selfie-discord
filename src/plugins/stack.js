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
 * Credits to https://github.com/siputzx for the search API.
 */

import * as cheerio from "cheerio";
import { browser, Role, splitText } from "#selfie";

export default [
  {
    cmd: ["stack", "stk"],
    cat: "tools",
    desc: "Read a Substack article",
    roles: [Role.USER],
    exec: async (c) => {
      let url = (c.args || "").trim();
      const urlRx = /https?:\/\/[^\s]+/;

      if (!url) {
        const match = c.event.content.match(urlRx);
        if (match) url = match[0];
      }

      if (!url) {
        const ref = c.event.reference;
        if (ref?.messageId) {
          const replied = await c.event.channel.messages.fetch(ref.messageId);
          const match = replied.content.match(urlRx);
          if (match) url = match[0];
        }
      }

      if (!url) return await c.react("❌");

      await c.react("⏳");

      try {
        const { data: html } = await browser.get(url);
        const $ = cheerio.load(html);
        $(".subscription-widget-wrap").remove();

        const title =
          $('meta[property="og:title"]').attr("content") ||
          $('meta[name="title"]').attr("content") ||
          $("title").text() ||
          "Substack Article";

        const author = $('meta[name="author"]').attr("content") || "Unknown";

        let content = "";

        const ldJson = $('script[type="application/ld+json"]').text();
        if (ldJson) {
          try {
            const parsed = JSON.parse(ldJson.trim());
            const body = parsed?.articleBody || "";
            if (body) content = body;
          } catch {}
        }

        if (!content) {
          const bodyEl = $('[class*="body-markup"]');
          if (bodyEl.length) content = bodyEl.html() || "";
        }

        if (!content) {
          const availEl = $('[class*="available-content"]');
          if (availEl.length) content = availEl.html() || "";
        }

        if (!content) {
          content =
            $('meta[property="og:description"]').attr("content") ||
            $('meta[name="description"]').attr("content") ||
            "Could not extract article content.";
        }

        if (content) {
          content = content
            .replace(
              /<\/?(?:p|br|div|h[1-6]|li|blockquote|tr|dt|dd|figcaption)\b[^>]*>/gi,
              "\n",
            )
            .replace(/<[^>]*>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }

        const header = [`**${title}**`, author ? `By *${author}*` : null]
          .filter(Boolean)
          .join("\n");

        const chunks = splitText(content, 1900);
        for (let i = 0; i < chunks.length; i++) {
          const msg = i === 0 ? `${header}\n\n${chunks[i]}` : chunks[i];
          if (i === 0) {
            await c.reply(msg);
          } else {
            await c.send(msg);
          }
        }
      } catch {
        await c.react("❌");
      }
    },
  },
  {
    cmd: ["stss", "substacksearch", "sts"],
    cat: "tools",
    desc: "Search Substack posts",
    roles: [Role.USER],
    exec: async (c) => {
      const query = (c.args || "").trim();
      if (!query) return await c.react("❌");

      await c.react("⏳");

      try {
        const res = await fetch(
          `https://api.siputzx.my.id/api/s/duckduckgo?query=${encodeURIComponent(`site:substack.com ${query}`)}`,
          { headers: { "User-Agent": "SelfieBot/1.0" } },
        );
        const data = await res.json();

        if (!data?.status || !data.data?.results?.length)
          return await c.reply("No results found.");

        const items = data.data.results.slice(0, 5);
        const lines = items.map(
          (r, i) => `**${i + 1}.** [${r.title}](${r.url})\n${r.snippet}`,
        );

        const msg = `**Substack Search: ${query}**\n\n${lines.join("\n\n")}`;
        await c.reply(msg.slice(0, 1900));
      } catch {
        await c.react("❌");
      }
    },
  },
];
