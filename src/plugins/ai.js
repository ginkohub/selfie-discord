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

import { Role, read, splitText, translate, write } from "#selfie";

const BASE = "https://api.siputzx.my.id/api/ai";

const MODELS = {
  gptoss120b: {
    promptKey: "prompt",
    systemKey: "system",
    tempKey: "temperature",
  },
  deepseekr1: {
    promptKey: "prompt",
    systemKey: "system",
    tempKey: "temperature",
  },
  qwq32b: { promptKey: "prompt", systemKey: "system", tempKey: "temperature" },
  glm47flash: {
    promptKey: "prompt",
    systemKey: "system",
    tempKey: "temperature",
  },
};

const MODEL_NAMES = Object.keys(MODELS);

const modelListStr = () => MODEL_NAMES.join(", ");

const t = translate({
  en: {
    usage: "Usage: `{prefix}ai <message>` or reply to a message",
    model_set: "_Model set to {model}_",
    prompt_set: "_System prompt updated_",
    temp_set: "_Temperature set to {temp}_",
    temp_range: "Temperature must be between 0 and 2",
    cleared: "_Conversation cleared_",
    models: "*Available models:* {models}",
    choose_model: "Usage: `{prefix}ai model <name>`\nAvailable: {models}",
    no_msg: "Please provide a message or reply to one",
  },
  id: {
    usage: "Gunakan: `{prefix}ai <pesan>` atau balas pesan",
    model_set: "_Model diubah ke {model}_",
    prompt_set: "_System prompt diperbarui_",
    temp_set: "_Temperature diubah ke {temp}_",
    temp_range: "Temperature harus antara 0 dan 2",
    cleared: "_Percakapan dihapus_",
    models: "*Model tersedia:* {models}",
    choose_model: "Gunakan: `{prefix}ai model <nama>`\nTersedia: {models}",
    no_msg: "Berikan pesan atau balas pesan",
  },
});

function loadSettings() {
  const data = read();
  return data.ai || {};
}

function saveSettings(s) {
  const data = read();
  data.ai = s;
  write(data);
}

const channels = new Map();
const aiMessages = new Set();

function getHistory(channelId) {
  if (!channels.has(channelId)) channels.set(channelId, []);
  return channels.get(channelId);
}

async function processQuery(query, channelId) {
  const settings = loadSettings();
  const settingsData = read().settings || {};
  const model = settings.model || "gptoss120b";
  const system =
    settingsData.systemPrompt ||
    "Your name is Ginko, humble, always energetic and enthusiastic, love programming, calm. Speak in casual, everyday language using 'you' (kamu) and 'I' (aku). Keep sentences as short as possible, like a Discord chat. Respond without conversational formatting and keep it under 2000 characters. Don't to much thinking.";
  const temperature = settings.temperature ?? 0.7;

  const history = getHistory(channelId);
  const context = [...history, { role: "user", content: query }]
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n\n");

  const result = await callApi(model, context, system, temperature);
  if (!result.status) return null;

  history.push({ role: "user", content: query });
  history.push({ role: "assistant", content: result.text });

  const maxHistory = 20;
  if (history.length > maxHistory)
    history.splice(0, history.length - maxHistory);

  return result.text;
}

async function replyOrEdit(c, text) {
  const chunks = splitText(text);
  if (c.cmd === "air") {
    const msg = await c.event.edit(chunks[0]);
    if (msg?.id) aiMessages.add(msg.id);
    for (let i = 1; i < chunks.length; i++) {
      const m = await msg.reply(chunks[i]);
      if (m?.id) aiMessages.add(m.id);
    }
  } else {
    for (const chunk of chunks) {
      const msg = await c.reply(chunk);
      if (msg?.id) aiMessages.add(msg.id);
    }
  }
}

async function callApi(model, prompt, system, temperature) {
  const cfg = MODELS[model];
  if (!cfg) return { status: false, error: `Unknown model: ${model}` };

  const params = new URLSearchParams();
  params.set(cfg.promptKey, prompt);
  if (system && cfg.systemKey) params.set(cfg.systemKey, system);
  if (temperature != null && cfg.tempKey)
    params.set(cfg.tempKey, String(temperature));

  const url = `${BASE}/${model}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return { status: false, error: `API error: ${res.status}` };

  const json = await res.json();
  if (!json.status) return { status: false, error: "API returned error" };

  const data = json.data;
  let text = data.response || data.message || data.content || "";
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return { status: true, text };
}

export default [
  {
    cmd: ["ai", "air"],
    cat: "ai",
    desc: "Chat with AI via free API",
    roles: [Role.USER],
    exec: async (c) => {
      const args = (c.args || "").trim();
      const [sub, ...rest] = args.split(/ +/);

      const settings = loadSettings();

      if (sub === "model") {
        const model = rest.join(" ").trim();
        if (!model) {
          return await c.reply(
            t("choose_model", { prefix: c.prefix, models: modelListStr() }, c),
          );
        }
        if (!MODELS[model]) {
          return await c.reply(`Unknown model. Available: ${modelListStr()}`);
        }
        settings.model = model;
        saveSettings(settings);
        channels.delete(c.event.channel?.id || c.event.author?.id);
        return await c.reply(t("model_set", { model }, c));
      }

      if (sub === "prompt" || sub === "system") {
        const prompt = rest.join(" ").trim();
        const data = read();
        if (!data.settings) data.settings = {};
        data.settings.systemPrompt = prompt;
        write(data);
        return await c.reply(t("prompt_set", {}, c));
      }

      if (sub === "temp" || sub === "temperature") {
        const val = parseFloat(rest.join(" "));
        if (Number.isNaN(val) || val < 0 || val > 2) {
          return await c.reply(t("temp_range", {}, c));
        }
        settings.temperature = val;
        saveSettings(settings);
        return await c.reply(t("temp_set", { temp: val }, c));
      }

      if (sub === "clear") {
        const ch = c.event.channel?.id || c.event.author?.id;
        channels.delete(ch);
        return await c.reply(t("cleared", {}, c));
      }

      const channelId = c.event.channel?.id || c.event.author?.id;

      let query = args;

      const ref = c.event.reference;
      let replied = null;
      if (ref?.messageId) {
        try {
          replied = await c.event.channel.messages.fetch(ref.messageId);
        } catch {}
      }

      if (replied) {
        const name = replied.author?.displayName || "Unknown";
        const username = replied.author?.username || "unknown";
        const quoted = `<quoted name="${name}" username="${username}">${replied.content || ""}</quoted>`;
        query = query ? `${query}\n${quoted}` : quoted;
      }

      if (!query) return await c.reply(t("no_msg", {}, c));

      try {
        const text = await processQuery(query, channelId);
        if (!text) return await c.react("❌");
        await replyOrEdit(c, text);
      } catch {
        await c.react("❌");
      }
    },
  },
  {
    events: ["messageCreate"],
    roles: [Role.USER],
    exec: async (c) => {
      const msg = c.event;
      if (msg.author.id === c.client.user.id) return;

      const ref = msg.reference;
      if (!ref?.messageId) return;
      if (!aiMessages.has(ref.messageId)) return;

      const channelId = msg.channel?.id || msg.author?.id;
      let query = msg.content || "";
      try {
        const replied = await msg.channel.messages.fetch(ref.messageId);
        if (replied) {
          const name =
            replied.author?.displayName ||
            replied.author?.username ||
            "Unknown";
          const quoted = `<quoted name="${name}">${replied.content || ""}</quoted>`;
          query = query ? `${query}\n${quoted}` : quoted;
        }
      } catch {}
      if (!query) return;

      try {
        const text = await processQuery(query, channelId);
        if (!text) return;
        const sent = await msg.reply(text);
        if (sent?.id) aiMessages.add(sent.id);
      } catch {}
    },
  },
];
