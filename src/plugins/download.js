/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import YtDlpWrap from "yt-dlp-wrap";
import { download } from "../browser.js";
import { Role } from "../roles.js";

const BIN_DIR = resolve("./bin");
const YTDLP_PATHS = [
  join(BIN_DIR, process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"),
  resolve("./node_modules/.bin/yt-dlp"),
  resolve("bin/yt-dlp"),
];

let ytDlpPromise = null;

async function resolveYT() {
  for (const p of YTDLP_PATHS) {
    if (existsSync(p)) return p;
  }
  if (!existsSync(BIN_DIR)) mkdirSync(BIN_DIR, { recursive: true });
  return await YtDlpWrap.downloadBinary(BIN_DIR);
}

async function getYT() {
  if (!ytDlpPromise) {
    ytDlpPromise = resolveYT().then((bin) => new YtDlpWrap(bin));
  }
  return ytDlpPromise;
}

getYT().catch(() => { });

const YTDLP_SITES =
  /youtube\.com|youtu\.be|soundcloud\.com|twitter\.com|x\.com|reddit\.com/;

export default {
  cmd: ["download", "dl"],
  cat: "tools",
  desc: "Download media from TikTok, Instagram, YouTube, etc.",
  roles: [Role.USER],
  exec: async (c) => {
    const url = c.args?.trim();
    if (!url || !/^https?:\/\//.test(url)) return await c.react("❌");

    if (YTDLP_SITES.test(url)) {
      try {
        const yt = await getYT();
        const info = await yt.getVideoInfo(url);

        const lines = [
          `**${info.title}**`,
          info.uploader && `Uploader: ${info.uploader}`,
          info.duration_string && `Duration: ${info.duration_string}`,
          info.view_count && `Views: ${info.view_count.toLocaleString()}`,
        ]
          .filter(Boolean)
          .join("\n");

        await c.reply(lines);

        if (info.duration && info.duration > 600) return;

        const buffer = await yt.getBuffer(url, ["-f", "best[ext=mp4]/best"]);
        if (buffer?.length) {
          await c.event.channel.send({
            files: [{ attachment: buffer, name: `${info.title}.mp4` }],
          });
        }
      } catch {
        await c.react("❌");
      }
      return;
    }

    try {
      const result = await download(url);
      const lines = [
        `**${result.platform}**`,
        result.title && `Title: ${result.title}`,
        result.metadata?.author && `Author: ${result.metadata.author}`,
        result.media?.url && `URL: ${result.media.url}`,
      ]
        .filter(Boolean)
        .join("\n");

      await c.reply(lines);
    } catch {
      await c.react("❌");
    }
  },
};
