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
 * Credits to yt-dlp (https://github.com/yt-dlp/yt-dlp) for media downloading.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import YtDlpWrap from "yt-dlp-wrap";
import { download, Role } from "#selfie";

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

getYT().catch(() => {});

const YTDLP_SITES =
  /youtube\.com|youtu\.be|soundcloud\.com|twitter\.com|x\.com|reddit\.com/;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default {
  cmd: ["download", "dl"],
  cat: "tools",
  desc: "Download media from TikTok, Instagram, YouTube, etc.",
  roles: [Role.USER],
  exec: async (c) => {
    const raw = c.args || "";
    const allowLarge = /(?:^|\s)(?:-f|--force)(?:\s|$)/.test(raw);
    const clean = raw.replace(/(?:^|\s)(?:-f|--force)(?:\s|$)/, " ").trim();
    let urls = clean.match(/https?:\/\/[^\s]+/g) || [];
    if (urls.length === 0) {
      const ref = c.event.reference;
      if (ref?.messageId) {
        const replied = await c.event.channel.messages.fetch(ref.messageId);
        urls = replied.content?.match(/https?:\/\/[^\s]+/g) || [];
      }
    }
    if (urls.length === 0) return await c.react("❌");

    for (const url of urls) {
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

          if (info.duration && info.duration > 600) {
            await c.reply(lines);
            continue;
          }

          const buffer = await yt.getBuffer(url, ["-f", "best[ext=mp4]/best"]);
          if (buffer?.length) {
            if (!allowLarge && buffer.length > MAX_FILE_SIZE) {
              await c.reply(`${lines}\n*(file too large, not uploaded)*`);
            } else {
              await c.reply({
                content: lines,
                files: [{ attachment: buffer, name: `${info.title}.mp4` }],
              });
            }
          } else {
            await c.reply(lines);
          }
          continue;
        } catch {
          await c.react("❌");
          continue;
        }
      }

      try {
        const result = await download(url);
        const lines = [
          `**${result.platform}**`,
          result.title && `Title: ${result.title}`,
          result.metadata?.author && `Author: ${result.metadata.author}`,
        ]
          .filter(Boolean)
          .join("\n");

        const mediaUrl = result.media?.url;
        if (mediaUrl) {
          const res = await fetch(mediaUrl);
          if (res.ok) {
            const cl = Number(res.headers.get("content-length"));
            if (!allowLarge && cl && cl > MAX_FILE_SIZE) {
              await c.reply(`${lines}\nURL: ${mediaUrl} *(file too large)*`);
            } else {
              const buf = Buffer.from(await res.arrayBuffer());
              if (!allowLarge && buf.length > MAX_FILE_SIZE) {
                await c.reply(`${lines}\nURL: ${mediaUrl} *(file too large)*`);
              } else {
                const ext = result.media.type === "image" ? "jpg" : "mp4";
                const name = `${result.title || "media"}.${ext}`;
                await c.reply({
                  content: lines,
                  files: [{ attachment: buf, name }],
                });
              }
            }
          } else {
            await c.reply(`${lines}\nURL: ${mediaUrl}`);
          }
        } else {
          await c.reply(lines);
        }
      } catch {
        await c.react("❌");
      }
    }
  },
};
