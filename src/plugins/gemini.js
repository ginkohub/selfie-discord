/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { GoogleGenAI } from "@google/genai";
import { Role } from "../roles.js";
import { read, write } from "../store.js";
import { translate } from "../translate.js";
import pen from "../pen.js";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const t = translate({
  en: {
    usage: "Usage: `{prefix}gm <message>` or reply to a message",
    no_key: "Gemini API key not set. Set it via `{prefix}gm key <key>` or GEMINI_API_KEY env.",
    model_set: "_Model set to {model}_",
    key_set: "_API key updated_",
    key_usage: "Usage: `{prefix}gm key <api_key>`",
    models: "*Available models*",
  },
  id: {
    usage: "Gunakan: `{prefix}gm <pesan>` atau balas pesan",
    no_key: "API key Gemini belum diatur. Atur via `{prefix}gm key <key>` atau env GEMINI_API_KEY.",
    model_set: "_Model diubah ke {model}_",
    key_set: "_API key diperbarui_",
    key_usage: "Penggunaan: `{prefix}gm key <api_key>`",
    models: "*Model yang tersedia*",
  },
});

function loadGeminiSettings() {
  const data = read();
  return data.gemini || {};
}

function saveGeminiSettings(settings) {
  const data = read();
  data.gemini = settings;
  write(data);
}

function getApiKey() {
  const saved = loadGeminiSettings();
  return saved.apiKey || process.env.GEMINI_API_KEY;
}

function getModelName() {
  const saved = loadGeminiSettings();
  return saved.model || MODELS[0];
}

function getSystemInstruction() {
  const saved = loadGeminiSettings();
  return saved.systemInstruction || "";
}

let genAI = null;

function getGenAI() {
  const key = getApiKey();
  if (!key) return null;
  if (!genAI) genAI = new GoogleGenAI({ apiKey: key });
  return genAI;
}

const chats = new Map();

export default {
  cmd: ["gm", "gemini"],
  cat: "ai",
  desc: "Chat with Gemini AI",
  roles: [Role.USER],
  exec: async (c) => {
    const args = (c.args || "").trim();
    const [sub, ...rest] = args.split(/ +/);

    if (sub === "key") {
      const key = rest.join(" ").trim();
      if (!key) return await c.reply(t("key_usage", { prefix: c.prefix }, c));
      const s = loadGeminiSettings();
      s.apiKey = key;
      saveGeminiSettings(s);
      genAI = null;
      chats.clear();
      return await c.reply(t("key_set", {}, c));
    }

    if (sub === "model") {
      const model = rest.join(" ").trim();
      if (!model) return await c.reply(`${t("models", {}, c)}\n${MODELS.map((m) => `- ${m}`).join("\n")}`);
      if (!MODELS.includes(model)) {
        return await c.reply(`Invalid model. Available: ${MODELS.join(", ")}`);
      }
      const s = loadGeminiSettings();
      s.model = model;
      saveGeminiSettings(s);
      chats.clear();
      return await c.reply(t("model_set", { model }, c));
    }

    if (sub === "prompt") {
      const prompt = rest.join(" ").trim();
      const s = loadGeminiSettings();
      s.systemInstruction = prompt;
      saveGeminiSettings(s);
      chats.clear();
      return await c.reply("_System instruction updated_");
    }

    if (sub === "models") {
      return await c.reply(`${t("models", {}, c)}\n${MODELS.map((m) => `- ${m}`).join("\n")}`);
    }

    const client = getGenAI();
    if (!client) return await c.reply(t("no_key", { prefix: c.prefix }, c));

    let query = args;
    const ref = c.event.reference;
    if (ref?.messageId) {
      try {
        const replied = await c.event.channel.messages.fetch(ref.messageId);
        if (query) {
          query = `${query} ${replied.content || ""}`;
        } else {
          query = replied.content || "";
        }
      } catch { }
    }

    query = query?.trim() || "";
    if (!query) return await c.reply(t("usage", { prefix: c.prefix }, c));

    const channelId = c.event.channel?.id || c.event.author?.id;

    try {
      const model = getModelName();
      const si = getSystemInstruction();
      const config = si ? { systemInstruction: { text: si } } : {};

      let chat = chats.get(channelId);
      if (!chat) {
        chat = client.chats.create({ model, config });
        chats.set(channelId, chat);
      }

      const resp = await chat.sendMessage({ message: query });
      const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) await c.reply(text);
    } catch (e) {
      pen.Error("gemini:", e.message);
      if (e.status === 429) {
        chats.delete(channelId);
        await c.reply("Rate limited. Try again later or switch model.");
      } else if (e.status === 401 || e.status === 403) {
        genAI = null;
        chats.clear();
        await c.reply("API key invalid. Update via `gm key`.");
      } else {
        await c.react("❌");
      }
    }
  },
};
