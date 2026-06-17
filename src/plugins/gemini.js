/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { Role, read, splitText, translate, write } from "#selfie";

const GEMINI_APP_URL = "https://gemini.google.com/app";
const GEMINI_STREAM_GENERATE_URL =
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MODEL_HEADER_NAME = "x-goog-ext-525001261-jspb";

function makeModelHeader(hash, idx) {
  return JSON.stringify([
    1,
    null,
    null,
    null,
    hash,
    null,
    null,
    0,
    [4, 5, 6, 8],
    null,
    null,
    2,
    null,
    null,
    idx,
    1,
    crypto.randomUUID(),
  ]);
}

const MODEL_HEADERS = {
  "gemini-3.1-pro": makeModelHeader("e6fa609c3fa255c0", 3),
  "gemini-3.5-flash": makeModelHeader("56fdd199312815e2", 1),
  "gemini-3.1-flash-lite": makeModelHeader("8c46e95b1a07cecc", 6),
};
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const ALL_COOKIE_NAMES = [
  "__Secure-1PSID",
  "__Secure-1PSIDTS",
  "__Secure-1PSIDCC",
  "__Secure-1PAPISID",
  "NID",
  "AEC",
  "SOCS",
  "__Secure-BUCKET",
  "__Secure-ENID",
  "SID",
  "HSID",
  "SSID",
  "APISID",
  "SAPISID",
  "__Secure-3PSID",
  "__Secure-3PSIDTS",
  "__Secure-3PAPISID",
  "SIDCC",
];

const REQUIRED_COOKIES = ["__Secure-1PSID", "__Secure-1PSIDTS"];

function getNestedValue(value, pathParts, fallback) {
  let current = value;
  for (const part of pathParts) {
    if (current == null) return fallback;
    if (typeof part === "number") {
      if (!Array.isArray(current)) return fallback;
      current = current[part];
    } else {
      if (typeof current !== "object") return fallback;
      current = current[part];
    }
  }
  return current ?? fallback;
}

function buildCookieHeader(cookieMap) {
  return Object.entries(cookieMap)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function buildCookieMap(cookies) {
  const cookieMap = {};
  for (const name of ALL_COOKIE_NAMES) {
    const cookie = cookies.find((c) => c.name === name && c.value);
    if (cookie) cookieMap[name] = cookie.value;
  }
  return cookieMap;
}

function hasRequiredCookies(cookieMap) {
  return REQUIRED_COOKIES.every((name) => Boolean(cookieMap[name]));
}

class GeminiClient {
  #agent;
  #cachedAccessToken = null;
  #accessTokenTime = 0;
  #cookieMap = {};
  #timeout = 300000;

  constructor(options = {}) {
    this.#agent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 5,
    });
    if (options.cookies) {
      this.#cookieMap = buildCookieMap(options.cookies);
    } else if (options.cookiesFile) {
      this.loadCookiesFromFile(options.cookiesFile);
    }
    if (options.timeout) this.#timeout = options.timeout;
  }

  loadCookiesFromFile(filePath = "cookies.json") {
    const absPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Cookies file not found: ${absPath}`);
    }
    const cookies = JSON.parse(fs.readFileSync(absPath, "utf-8"));
    const arr = Array.isArray(cookies)
      ? cookies
      : Object.entries(cookies).map(([name, value]) => ({ name, value }));
    this.#cookieMap = buildCookieMap(arr);
    if (!hasRequiredCookies(this.#cookieMap)) {
      const missing = REQUIRED_COOKIES.filter((c) => !this.#cookieMap[c]);
      throw new Error(`Missing required cookies: ${missing.join(", ")}`);
    }
    return this;
  }

  loadCookies(cookies) {
    this.#cookieMap = buildCookieMap(cookies);
    if (!hasRequiredCookies(this.#cookieMap)) {
      const missing = REQUIRED_COOKIES.filter((c) => !this.#cookieMap[c]);
      throw new Error(`Missing required cookies: ${missing.join(", ")}`);
    }
    return this;
  }

  get hasCookies() {
    return hasRequiredCookies(this.#cookieMap);
  }

  async #httpsGet(url, headers, opts = {}) {
    const { binary = false, timeoutMs = 30000, label = "httpsGet" } = opts;
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        headers: {
          "user-agent": USER_AGENT,
          connection: "keep-alive",
          ...headers,
        },
        agent: this.#agent,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };
      const req = https.request(options, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: binary ? null : buffer.toString("utf-8"),
            buffer: binary ? buffer : null,
          });
        });
        res.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error(`${label}: timeout`)));
      req.on("error", reject);
      req.end();
    });
  }

  async #httpsPost(url, headers, body, opts = {}) {
    const { timeoutMs = 30000, label = "httpsPost" } = opts;
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const bodyBuffer = Buffer.isBuffer(body)
        ? body
        : Buffer.from(String(body), "utf-8");
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "user-agent": USER_AGENT,
          connection: "keep-alive",
          ...headers,
          "content-length": bodyBuffer.length,
        },
        agent: this.#agent,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: data,
          }),
        );
        res.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error(`${label}: timeout`)));
      req.on("error", reject);
      req.write(bodyBuffer);
      req.end();
    });
  }

  async #fetchWithRedirects(
    url,
    headers,
    maxRedirects = 10,
    binary = false,
    opts = {},
  ) {
    let current = url;
    for (let i = 0; i <= maxRedirects; i++) {
      const res = await this.#httpsGet(current, headers, { ...opts, binary });
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        current = new URL(res.headers.location, current).toString();
        continue;
      }
      return res;
    }
    throw new Error("Too many redirects");
  }

  async #getAccessToken() {
    const now = Date.now();
    if (
      this.#cachedAccessToken &&
      now - this.#accessTokenTime < 5 * 60 * 1000
    ) {
      return this.#cachedAccessToken;
    }
    const cookieHeader = buildCookieHeader(this.#cookieMap);
    const res = await this.#fetchWithRedirects(
      GEMINI_APP_URL,
      { cookie: cookieHeader },
      10,
      false,
      { label: "accessToken" },
    );
    const html = res.text;
    for (const key of ["SNlM0e", "thykhd"]) {
      const match = html.match(new RegExp(`"${key}":"(.*?)"`));
      if (match?.[1]) {
        this.#cachedAccessToken = match[1];
        this.#accessTokenTime = now;
        return this.#cachedAccessToken;
      }
    }
    throw new Error("Failed to get access token. Cookies may be expired.");
  }

  #trimJsonEnvelope(text) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Invalid JSON response");
    return text.slice(start, end + 1);
  }

  #parseTextForCalls(text) {
    const calls = [];
    const regex = /<tool_call>([^<]+)<\/tool_call>/g;
    for (;;) {
      const match = regex.exec(text);
      if (!match) break;
      try {
        const data = JSON.parse(match[1]);
        if (data.name && data.params) {
          calls.push({ name: data.name, params: data.params });
        }
      } catch {}
    }
    return calls.length > 0 ? calls : null;
  }

  #cleanText(text) {
    let cleaned = text.replace(/<tool_call>[^<]+<\/tool_call>/g, "");
    cleaned = cleaned
      .split("\n")
      .filter(
        (line) =>
          !line.match(/^https?:\/\/googleusercontent\.com\/card_content\//),
      )
      .join("\n");
    return cleaned.trim();
  }

  #parseResponse(rawText) {
    const trimmed = this.#trimJsonEnvelope(rawText);
    const parts = JSON.parse(trimmed);
    const texts = [];
    for (const part of parts) {
      const partData = getNestedValue(part, [2], null);
      if (!partData || typeof partData !== "string") continue;
      try {
        const parsed = JSON.parse(partData);
        const candidate = getNestedValue(parsed, [4, 0, 1, 0], null);
        if (
          candidate &&
          typeof candidate === "string" &&
          !candidate.includes("rc_")
        ) {
          texts.push(candidate);
        }
      } catch {}
    }
    let text =
      texts.length > 0
        ? texts.reduce((a, b) => (a.length > b.length ? a : b), "")
        : "";
    const functionCalls = this.#parseTextForCalls(text);
    text = this.#cleanText(text);
    return { text, metadata: [], functionCalls };
  }

  async #request(
    prompt,
    model = DEFAULT_MODEL,
    chatMetadata = null,
    tools = null,
    systemPrompt = null,
  ) {
    const at = await this.#getAccessToken();
    const cookieHeader = buildCookieHeader(this.#cookieMap);

    let promptPayload = [prompt];
    if (systemPrompt) {
      promptPayload = [`<system>${systemPrompt}</system>\n\n${prompt}`];
    }
    const inner = [promptPayload, null, chatMetadata];
    const fReq = JSON.stringify([null, JSON.stringify(inner)]);

    const params = new URLSearchParams();
    params.set("at", at);
    params.set("f.req", fReq);

    const headers = {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
      host: "gemini.google.com",
      origin: "https://gemini.google.com",
      referer: "https://gemini.google.com/",
      "x-same-domain": "1",
      cookie: cookieHeader,
      [MODEL_HEADER_NAME]: MODEL_HEADERS[model] || MODEL_HEADERS[DEFAULT_MODEL],
    };

    if (tools && tools.length > 0) {
      headers["x-goog-function-call"] = JSON.stringify(
        tools.map((t) => ({
          functionCall: t.function || t.functionDeclaration,
        })),
      );
    }

    const res = await this.#httpsPost(
      GEMINI_STREAM_GENERATE_URL,
      headers,
      params.toString(),
      { timeoutMs: this.#timeout, label: "generate" },
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Request failed: ${res.status}`);
    }

    const parsed = this.#parseResponse(res.text);
    return { ...parsed, effectiveModel: model };
  }

  async ask(prompt, options = {}) {
    if (!this.hasCookies)
      throw new Error(
        "No cookies loaded. Use loadCookies() or loadCookiesFromFile() first.",
      );

    const model = options.model || DEFAULT_MODEL;
    const tools = options.tools;
    const toolExecutor = options.toolExecutor;
    let systemPrompt = options.systemPrompt || null;
    const startTime = Date.now();

    if (tools && tools.length > 0) {
      const toolList = tools
        .map((t) => t.function?.name || t.functionDeclaration?.name)
        .filter(Boolean)
        .join(", ");
      const tagInstructions = `\nIf you need to call tools, output ONLY: <tool_call>{"name":"fn","params":{...}}</tool_call>. Available: ${toolList}`;
      systemPrompt = (systemPrompt || "") + tagInstructions;
    }

    let result = await this.#request(prompt, model, null, tools, systemPrompt);

    let functionCalls = null;
    if (tools && result.functionCalls && result.functionCalls.length > 0) {
      functionCalls = result.functionCalls;
    }

    if (toolExecutor && functionCalls && functionCalls.length > 0) {
      const toolResults = [];
      for (const call of functionCalls) {
        try {
          const fn = tools.find((t) => t.function?.name === call.name);
          if (!fn) {
            toolResults.push({
              name: call.name,
              result: { error: `Unknown function: ${call.name}` },
            });
            continue;
          }
          const execResult = await toolExecutor(call.name, call.params);
          toolResults.push({ name: call.name, result: execResult });
        } catch (err) {
          toolResults.push({ name: call.name, result: { error: err.message } });
        }
      }

      const toolResultsText = toolResults
        .map((r) => `Function ${r.name} result: ${JSON.stringify(r.result)}`)
        .join("\n");

      const followUpPrompt = `${prompt}\n\nTool Results:\n${toolResultsText}`;
      result = await this.#request(
        followUpPrompt,
        model,
        result.metadata,
        tools,
        systemPrompt,
      );

      return {
        response: result.text,
        model: result.effectiveModel,
        tookMs: Date.now() - startTime,
      };
    }

    return {
      response: result.text,
      model: result.effectiveModel,
      tookMs: Date.now() - startTime,
      tools: functionCalls,
    };
  }

  async chat(prompt, model = DEFAULT_MODEL) {
    return this.ask(prompt, { model });
  }
}

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

function loadCookies() {
  const data = read();
  const s = data.gemini || {};
  return s.cookies || {};
}

function saveCookies(map) {
  const data = read();
  data.gemini = data.gemini || {};
  data.gemini.cookies = { ...(data.gemini.cookies || {}), ...map };
  write(data);
}

function getSystemPrompt() {
  const data = read();
  return data.gemini?.systemPrompt || null;
}

function getClient() {
  const cookies = loadCookies();
  if (Object.keys(cookies).length === 0) return null;
  const arr = Object.entries(cookies).map(([name, value]) => ({
    name,
    value,
  }));
  return new GeminiClient({ cookies: arr });
}

const geminiMessages = new Set();

function handleGmset(c) {
  const raw = (c.args || "").trim();
  const [sub, ...rest] = raw.split(/ +/);

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
        const name =
          replied.author?.displayName || replied.author?.username || "Unknown";
        const quoted = `${name}: ${replied.content || ""}`;
        prompt = prompt ? `${prompt}\n${quoted}` : quoted;
      }

      if (!prompt) return await c.reply(t("usage", { prefix: c.prefix }, c));

      const client = getClient();
      if (!client)
        return await c.reply(t("no_cookies", { prefix: c.prefix }, c));

      try {
        const sysPrompt = getSystemPrompt();
        const r = await client.ask(prompt, { systemPrompt: sysPrompt });
        if (!r.response?.trim()) return await c.react("❌");
        const chunks = splitText(r.response);
        const sent = await c.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await c.event.channel.send(chunks[i]);
        }
        if (sent?.id) geminiMessages.add(sent.id);
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
      if (msg.author.id === c.client.user.id) return;

      const ref = msg.reference;
      if (!ref?.messageId) return;
      if (!geminiMessages.has(ref.messageId)) return;

      let query = msg.content || "";
      try {
        const replied = await msg.channel.messages.fetch(ref.messageId);
        if (replied) {
          const name =
            replied.author?.displayName ||
            replied.author?.username ||
            "Unknown";
          const quoted = `${name}: ${replied.content || ""}`;
          query = query ? `${query}\n${quoted}` : quoted;
        }
      } catch {}
      if (!query) return;

      const client = getClient();
      if (!client) return;

      try {
        const sysPrompt = getSystemPrompt();
        const r = await client.ask(query, { systemPrompt: sysPrompt });
        if (!r.response?.trim()) return;
        const chunks = splitText(r.response);
        const sent = await msg.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await c.event.channel.send(chunks[i]);
        }
        if (sent?.id) geminiMessages.add(sent.id);
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
