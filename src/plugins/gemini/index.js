/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Role, splitText } from "#selfie";
import { tagIt } from "./client.js";
import { handleGmset, t } from "./gmset.js";
import {
  addHistory,
  formatHistory,
  geminiMessages,
  getClient,
  getSystemPrompt,
  shouldCompact,
  summarizeHistory,
} from "./history.js";
import { loadTools } from "./tools/index.js";

let toolsCache;
async function getTools() {
  if (!toolsCache) toolsCache = loadTools();
  return toolsCache;
}

export default [
  {
    cmd: ["gemini", "gm"],
    cat: "ai",
    desc: "Chat with Gemini (cookie-based, no API key)",
    roles: [Role.USER],
    exec: async (c) => {
      const query = (c.args || "").trim();
      const ref = c.event.reference;
      let replied = null;
      if (ref?.messageId) {
        try {
          replied = await c.event.channel.messages.fetch(ref.messageId);
        } catch {}
      }

      let prompt = query;
      if (replied) {
        const name = replied.author?.displayName || "Unknown";
        const username = replied.author?.username || "unknown";
        const quoted = tagIt("quoted", replied.content || "", {
          name,
          username,
        });
        prompt = prompt ? `${quoted}\n${prompt}` : quoted;
      }

      if (!prompt) return await c.reply(t("usage", { prefix: c.prefix }, c));

      const client = getClient();
      if (!client)
        return await c.reply(t("no_cookies", { prefix: c.prefix }, c));

      try {
        const sysPrompt = getSystemPrompt();
        const { tools, executor } = await getTools();
        const info = {
          user: {
            name: c.event.author?.displayName,
            username: c.event.author?.username,
          },
          channel: c.event.channel?.name || null,
          server: c.event.guild?.name || null,
          bot: c.client.user?.username || null,
        };
        const channelId = c.event.channel.id;
        const historyText = formatHistory(channelId);
        const fullPrompt = historyText ? `${historyText}${prompt}` : prompt;
        const r = await client.ask(fullPrompt, {
          systemPrompt: sysPrompt,
          info,
          tools,
          toolExecutor: executor,
        });
        if (!r.response?.trim()) return await c.react("❌");
        const userName =
          c.event.author?.displayName || c.event.author?.username || "User";
        const botName = c.client.user?.username || "Gemini";
        const chunks = splitText(r.response);
        const sent = await c.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await c.event.channel.send(chunks[i]);
        }
        if (sent?.id) geminiMessages.add(sent.id);
        addHistory(channelId, [
          {
            role: "user",
            name: userName,
            content: prompt,
            time: new Date().toISOString(),
            id: c.event.id,
          },
          {
            role: "assistant",
            name: botName,
            content: r.response,
            time: new Date().toISOString(),
            id: sent?.id,
          },
        ]);
        if (shouldCompact(channelId)) {
          summarizeHistory(channelId, client);
        }
      } catch (e) {
        console.error("[gemini]", e);
        await c.react("❌");
      }
    },
  },
  {
    events: ["messageCreate"],
    roles: [Role.USER],
    exec: async (c) => {
      const msg = c.event;
      const ref = msg.reference;
      if (!ref?.messageId) return;

      if (
        msg.author.id === c.client.user.id &&
        !geminiMessages.has(ref.messageId)
      )
        return;

      if (!geminiMessages.has(ref.messageId)) return;

      let query = msg.content || "";
      try {
        const replied = await msg.channel.messages.fetch(ref.messageId);
        if (replied) {
          const name = replied.author?.displayName || "Unknown";
          const username = replied.author?.username || "unknown";
          const quoted = tagIt("quoted", replied.content || "", {
            name,
            username,
          });
          query = query ? `${quoted}\n${query}` : quoted;
        }
      } catch {}
      if (!query) return;

      const client = getClient();
      if (!client) return;

      try {
        const sysPrompt = getSystemPrompt();
        const { tools, executor } = await getTools();
        const info = {
          user: {
            name: msg.author?.displayName,
            username: msg.author?.username,
          },
          channel: msg.channel?.name || null,
          server: msg.guild?.name || null,
          bot: c.client.user?.username || null,
        };
        const channelId = msg.channel.id;
        const historyText = formatHistory(channelId);
        const fullQuery = historyText ? `${historyText}${query}` : query;
        const r = await client.ask(fullQuery, {
          systemPrompt: sysPrompt,
          info,
          tools,
          toolExecutor: executor,
        });
        if (!r.response?.trim()) return;
        const userName =
          msg.author?.displayName || msg.author?.username || "User";
        const botName = c.client.user?.username || "Gemini";
        const chunks = splitText(r.response);
        const sent = await msg.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await c.event.channel.send(chunks[i]);
        }
        if (sent?.id) geminiMessages.add(sent.id);
        addHistory(channelId, [
          {
            role: "user",
            name: userName,
            content: query,
            time: new Date().toISOString(),
            id: msg.id,
          },
          {
            role: "assistant",
            name: botName,
            content: r.response,
            time: new Date().toISOString(),
            id: sent?.id,
          },
        ]);
        if (shouldCompact(channelId)) {
          summarizeHistory(channelId, client);
        }
      } catch (e) {
        console.error("[gemini]", e);
        await msg.react("❌").catch(() => {});
      }
    },
  },
  {
    cmd: ["gmset"],
    cat: "ai",
    desc: "Set Gemini Web cookies",
    roles: [Role.ADMIN],
    exec: handleGmset,
  },
];
