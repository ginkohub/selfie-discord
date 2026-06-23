/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { read, translate, write } from "#selfie";
import { DEFAULT_MODEL, MODEL_LIMITS } from "./client.js";
import {
  estHistoryTokens,
  getClient,
  getCompactBuffer,
  getCompactCeiling,
  getHistory,
  getSystemPrompt,
  getTimezone,
  loadCookies,
  saveCookies,
  shouldCompact,
  summarizeHistory,
} from "./history.js";

const t = translate({
  en: {
    usage: "Usage: `{prefix}gemini <message>` or reply to a message",
    no_cookies:
      "Gemini cookies not set.\nUse `{prefix}gmset __Secure-1PSID=xxx __Secure-1PSIDTS=yyy` first.",
    set_usage:
      "Usage: `{prefix}gmset <name>=<value> ...` or `{prefix}gmset clear`",
    set_done: "Cookies saved.",
    set_cleared: "Cookies cleared.",
    sys_usage:
      "Usage: `{prefix}gmset prompt <text>` or `{prefix}gmset prompt clear`",
    sys_set: "Prompt updated.",
    sys_cleared: "Prompt cleared.",
  },
  id: {
    usage: "Gunakan: `{prefix}gemini <pesan>` atau balas pesan",
    no_cookies:
      "Cookie Gemini belum diatur.\nGunakan `{prefix}gmset __Secure-1PSID=xxx __Secure-1PSIDTS=yyy` terlebih dahulu.",
    set_usage:
      "Gunakan: `{prefix}gmset <nama>=<nilai> ...` atau `{prefix}gmset clear`",
    set_done: "Cookie tersimpan.",
    set_cleared: "Cookie dihapus.",
    sys_usage:
      "Gunakan: `{prefix}gmset prompt <teks>` atau `{prefix}gmset prompt clear`",
    sys_set: "Prompt diperbarui.",
    sys_cleared: "Prompt dihapus.",
  },
});

export { t };

export function handleGmset(c) {
  const raw = (c.args || "").trim();
  const [sub, ...rest] = raw.split(/ +/);

  if (sub === "timezone" || sub === "tz") {
    const tz = rest.join(" ").trim();
    if (!tz) {
      const current = getTimezone() || "Asia/Jakarta (default)";
      return c.reply(`Current timezone: ${current}`);
    }
    if (tz === "clear") {
      const data = read();
      if (data.gemini) delete data.gemini.timezone;
      write(data);
      return c.reply("Timezone reset to default (Asia/Jakarta).");
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      return c.reply(
        "Invalid timezone. Use IANA zone (e.g. Asia/Jakarta, UTC, America/New_York).",
      );
    }
    const data = read();
    data.gemini = data.gemini || {};
    data.gemini.timezone = tz;
    write(data);
    return c.reply(`Timezone set to ${tz}.`);
  }

  if (sub === "prompt" || sub === "system") {
    const prompt = rest.join(" ").trim();
    if (!prompt) {
      const current = getSystemPrompt();
      if (!current) return c.reply(t("sys_usage", { prefix: c.prefix }, c));
      return c.reply(`Current prompt:\n${current}`);
    }
    if (prompt === "clear") {
      const data = read();
      if (data.gemini) delete data.gemini.systemPrompt;
      write(data);
      return c.reply(t("sys_cleared", {}, c));
    }
    const data = read();
    data.gemini = data.gemini || {};
    data.gemini.systemPrompt = prompt;
    write(data);
    return c.reply(t("sys_set", {}, c));
  }

  if (sub === "compact") {
    const [key, ...vals] = rest;
    if (!key || key === "status") {
      const ceiling = getCompactCeiling();
      const buffer = getCompactBuffer();
      const modelLimit = MODEL_LIMITS[DEFAULT_MODEL];
      const triggerAt = ceiling > 0 ? ceiling - buffer : 0;
      const lines = [
        `ceiling: ${ceiling.toLocaleString()} tokens (model: ${modelLimit.toLocaleString()})`,
        `buffer:  ${buffer.toLocaleString()} tokens`,
        `trigger: ${ceiling > 0 ? `~${(triggerAt * 4).toLocaleString()} chars / ${triggerAt.toLocaleString()} tokens` : "disabled"}`,
        "",
        "Subcommands: ceiling <n>, buffer <n>, clear, now",
      ];
      return c.reply(`\`\`\`\nCompact settings:\n${lines.join("\n")}\n\`\`\``);
    }
    if (key === "now") {
      const channelId = c.event.channel?.id;
      if (!channelId) return c.reply("No channel context.");
      const h = getHistory(channelId);
      const tokens = estHistoryTokens(channelId);
      const msgs = h.length;
      const info = [
        `messages: ${msgs}`,
        `estimated: ${tokens.toLocaleString()} tokens`,
        `trigger:   ${shouldCompact(channelId)}`,
      ];
      if (!h.length || h.length < 4) {
        info.push("", "Need at least 4 messages to compact.");
        return c.reply(`\`\`\`\nCompact info:\n${info.join("\n")}\n\`\`\``);
      }
      const client = getClient();
      if (!client) return c.reply("Gemini not configured.");
      info.push("", "Compacting...");
      c.reply(`\`\`\`\nCompact info:\n${info.join("\n")}\n\`\`\``);
      summarizeHistory(channelId, client);
      return;
    }
    if (key === "clear") {
      const data = read();
      if (data.gemini) delete data.gemini.compactCeiling;
      if (data.gemini) delete data.gemini.compactBuffer;
      write(data);
      return c.reply("Compact settings reset to defaults.");
    }
    const num = Number.parseInt(vals.join(" "), 10);
    if (!Number.isFinite(num) || num < 0) {
      return c.reply("Must be a positive number or 0 to disable.");
    }
    const data = read();
    data.gemini = data.gemini || {};
    if (key === "ceiling") {
      data.gemini.compactCeiling = num;
      write(data);
      return c.reply(`Compact ceiling set to ${num.toLocaleString()} tokens.`);
    }
    if (key === "buffer") {
      data.gemini.compactBuffer = num;
      write(data);
      return c.reply(`Compact buffer set to ${num.toLocaleString()} tokens.`);
    }
    return c.reply(
      "Usage: `gmset compact [status|ceiling <n>|buffer <n>|now|clear]`",
    );
  }

  if (!raw || !sub) {
    const stored = loadCookies();
    const keys = Object.keys(stored);
    if (keys.length === 0) {
      return c.reply(`not set\n${t("set_usage", { prefix: c.prefix }, c)}`);
    }
    const lines = keys.map((k) => `${k}=${stored[k]}`);
    return c.reply(`${keys.length} cookie(s):\n${lines.join("\n")}`);
  }

  if (raw === "clear") {
    const data = read();
    if (data.gemini) delete data.gemini.cookies;
    write(data);
    return c.reply(t("set_cleared", {}, c));
  }

  let map = {};

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      map = JSON.parse(raw.replace(/'/g, '"'));
    } catch {
      return c.react("❌");
    }
    if (Array.isArray(map)) {
      const arr = map;
      map = {};
      for (const item of arr) {
        if (item.name && item.value) map[item.name] = item.value;
      }
    }
  } else if (/[=:]/.test(raw)) {
    const pairs = raw.split(/ +/);
    for (const pair of pairs) {
      const sep = pair.indexOf("=") !== -1 ? "=" : ":";
      const idx = pair.indexOf(sep);
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      let value = pair.slice(idx + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      if (name && value) map[name] = value;
    }
  }

  const keys = Object.keys(map);
  if (keys.length === 0) return c.react("❌");
  saveCookies(map);
  return c.reply(t("set_done", {}, c));
}
