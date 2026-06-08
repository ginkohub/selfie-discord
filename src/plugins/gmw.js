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
 * Cookie-based Gemini Web client (no API key required).
 * Cookies from gemini.google.com needed.
 */

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import pen from "../pen.js";
import { Role } from "../roles.js";
import { read, write } from "../store.js";
import { translate } from "../translate.js";

const GEMINI_APP_URL = "https://gemini.google.com/app";
const GEMINI_STREAM_GENERATE_URL =
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MODEL_HEADER_NAME = "x-goog-ext-525001261-jspb";

const MODEL_HEADER_VALUES = {
  "gemini-3.1-pro": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4]]',
  "gemini-3-flash": '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4]]',
  "gemini-3.1-flash-lite":
    '[1,null,null,null,"9d8ca3786ebdfbea",null,null,0,[4]]',
  "gemini-2.5-pro": '[1,null,null,null,"4af6c7f5da75d65d",null,null,0,[4]]',
  "gemini-2.5-flash": '[1,null,null,null,"9ec249fc9ad08861",null,null,0,[4]]',
};

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

const MODEL_NAMES = Object.keys(MODEL_HEADER_VALUES);

const modelListStr = () => MODEL_NAMES.map((m) => `- ${m}`).join("\n");

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

class GeminiWebClient {
  #agent;
  #cachedAccessToken = null;
  #accessTokenTime = 0;
  #cookieMap = {};
  #timeout = 300000;
  #log = () => {};

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
    if (options.log) this.#log = options.log;
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

  #httpsGet(url, headers, opts = {}) {
    const { timeoutMs = 30000, label = "httpsGet" } = opts;
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
            text: buffer.toString("utf-8"),
          });
        });
        res.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error(`${label}: timeout`)));
      req.on("error", reject);
      req.end();
    });
  }

  #httpsPost(url, headers, body, opts = {}) {
    const { timeoutMs = 30000, label = "httpsPost" } = opts;
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const bodyBuffer = Buffer.from(String(body), "utf-8");
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
          resolve({ status: res.statusCode, headers: res.headers, text: data }),
        );
        res.on("error", reject);
      });
      req.on("timeout", () => req.destroy(new Error(`${label}: timeout`)));
      req.on("error", reject);
      req.write(bodyBuffer);
      req.end();
    });
  }

  async #fetchWithRedirects(url, headers, maxRedirects = 10, opts = {}) {
    let current = url;
    for (let i = 0; i <= maxRedirects; i++) {
      const res = await this.#httpsGet(current, headers, opts);
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
      const m = regex.exec(text);
      if (!m) break;
      try {
        const data = JSON.parse(m[1]);
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
    model = "gemini-3-flash",
    tools = null,
    systemPrompt = null,
  ) {
    const at = await this.#getAccessToken();
    const cookieHeader = buildCookieHeader(this.#cookieMap);
    let promptPayload = [prompt];
    if (systemPrompt) {
      promptPayload = [`${systemPrompt}\n\n${prompt}`];
    }
    const inner = [promptPayload, null, null];
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
      [MODEL_HEADER_NAME]:
        MODEL_HEADER_VALUES[model] || MODEL_HEADER_VALUES["gemini-3-flash"],
    };

    if (tools && tools.length > 0) {
      headers["x-goog-function-call"] = JSON.stringify(
        tools.map((t) => ({ functionCall: t.function })),
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
    if (!this.hasCookies) throw new Error("No cookies loaded.");

    const model = options.model || "gemini-3-flash";
    const tools = options.tools;
    const toolExecutor = options.toolExecutor;
    let systemPrompt = options.systemPrompt || null;

    if (tools && tools.length > 0) {
      const toolList = tools
        .map((t) => t.function?.name)
        .filter(Boolean)
        .join(", ");
      systemPrompt =
        (systemPrompt || "") +
        `\nIf you need to call tools, output ONLY: <tool_call>{"name":"fn","params":{...}}</tool_call>. Available: ${toolList}`;
    }

    let result = await this.#request(prompt, model, tools, systemPrompt);

    let functionCalls = null;
    if (tools && result.functionCalls && result.functionCalls.length > 0) {
      functionCalls = result.functionCalls;
    }

    if (toolExecutor && functionCalls && functionCalls.length > 0) {
      const toolResults = [];
      for (const call of functionCalls) {
        try {
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
      result = await this.#request(followUpPrompt, model, tools, systemPrompt);
      return { response: result.text, model: result.effectiveModel };
    }

    return {
      response: result.text,
      model: result.effectiveModel,
      tools: functionCalls,
    };
  }
}

const t = translate({
  en: {
    usage: "Usage: `{prefix}gmw <message>` or reply to a message",
    no_cookies:
      'Gemini Web cookies not set.\nExtract from Chrome DevTools (F12 → Application → Cookies → gemini.google.com) then paste the values:\n`{prefix}gmw cookies __Secure-1PSID=xxx __Secure-1PSIDTS=yyy`\nOr paste colon format: `{prefix}gmw cookies __Secure-1PSID:"xxx" __Secure-1PSIDTS:"yyy"`',
    model_set: "_Model set to {model}_",
    prompt_set: "_System prompt updated_",
    cookies_set: "_Cookies updated_",
    cookies_loaded: "_Cookies loaded from {path}_",
    cookies_cleared: "_Cookies cleared_",
    cookies_status: "Cookies: {status}\nRequired: `{required}`",
    models: "*Available models*",
  },
  id: {
    usage: "Gunakan: `{prefix}gmw <pesan>` atau balas pesan",
    no_cookies:
      'Cookie Gemini Web belum diatur.\nAmbil dari Chrome DevTools (F12 → Application → Cookies → gemini.google.com) lalu paste nilainya:\n`{prefix}gmw cookies __Secure-1PSID=xxx __Secure-1PSIDTS=yyy`\nAtau format colon: `{prefix}gmw cookies __Secure-1PSID:"xxx" __Secure-1PSIDTS:"yyy"`',
    model_set: "_Model diubah ke {model}_",
    prompt_set: "_System prompt diperbarui_",
    cookies_set: "_Cookies diperbarui_",
    cookies_loaded: "_Cookies dimuat dari {path}_",
    cookies_cleared: "_Cookies dihapus_",
    cookies_status: "Cookies: {status}\nDiperlukan: `{required}`",
    models: "*Model tersedia*",
  },
});

function loadSettings() {
  const data = read();
  return data.gmw || {};
}

function saveSettings(s) {
  const data = read();
  data.gmw = s;
  write(data);
}

function getClient() {
  const s = loadSettings();
  try {
    const cl = new GeminiWebClient({ log: () => {} });
    if (!s.cookies || Object.keys(s.cookies).length === 0) return null;
    const arr = Object.entries(s.cookies).map(([name, value]) => ({
      name,
      value,
    }));
    cl.loadCookies(arr);
    return cl;
  } catch {
    return null;
  }
}

const gmwMessages = new Set();

export default [
  {
    cmd: ["gmw", "gmwr"],
    cat: "ai",
    desc: "Chat with Gemini (web, no API key)",
    roles: [Role.USER],
    exec: async (c) => {
      const args = (c.args || "").trim();
      const sp = args.indexOf(" ");
      const sub = sp === -1 ? args : args.slice(0, sp);
      const rest = sp === -1 ? [] : [args.slice(sp + 1).trim()];

      if (sub === "cookies") {
        const raw = rest.join(" ").trim();
        const s = loadSettings();

        if (!raw) {
          const stored = s.cookies ? Object.keys(s.cookies).length : 0;
          const status = stored > 0 ? `${stored} cookie(s) stored` : "not set";
          return await c.reply(
            t(
              "cookies_status",
              { status, required: REQUIRED_COOKIES.join(", ") },
              c,
            ),
          );
        }

        if (raw === "clear") {
          delete s.cookies;
          saveSettings(s);
          return await c.reply(t("cookies_cleared", {}, c));
        }

        if (raw.startsWith("{") || raw.startsWith("[")) {
          let map = {};
          try {
            map = JSON.parse(raw.replace(/'/g, '"'));
          } catch {
            return await c.reply(
              'Invalid JSON. Use format: `{ "name": "value" }`',
            );
          }
          if (!map || typeof map !== "object" || Array.isArray(map)) {
            const arr = Array.isArray(map) ? map : [];
            map = {};
            for (const item of arr) {
              if (item.name && item.value) map[item.name] = item.value;
            }
          }
          const keys = Object.keys(map);
          if (keys.length === 0) return await c.react("❌");
          s.cookies = { ...(s.cookies || {}), ...map };
          saveSettings(s);
          const ok = REQUIRED_COOKIES.every((n) => s.cookies[n]);
          const reply = `${t("cookies_set", {}, c)}${ok ? "" : `\nMissing required: ${REQUIRED_COOKIES.filter((n) => !s.cookies[n]).join(", ")}`}`;
          return await c.reply(reply);
        }

        if (/[=:]/.test(raw)) {
          const pairs = raw.split(/ +/);
          const map = {};
          let hasPair = false;
          for (const pair of pairs) {
            const sep = pair.indexOf("=") !== -1 ? "=" : ":";
            const idx = pair.indexOf(sep);
            if (idx === -1) continue;
            const name = pair.slice(0, idx).trim();
            let value = pair.slice(idx + 1).trim();
            value = value.replace(/^["']|["']$/g, "");
            if (name && value) {
              map[name] = value;
              hasPair = true;
            }
          }
          if (!hasPair) return await c.react("❌");
          s.cookies = { ...(s.cookies || {}), ...map };
          saveSettings(s);
          const ok = REQUIRED_COOKIES.every((n) => s.cookies[n]);
          const reply = `${t("cookies_set", {}, c)}${ok ? "" : `\nMissing required: ${REQUIRED_COOKIES.filter((n) => !s.cookies[n]).join(", ")}`}`;
          return await c.reply(reply);
        }

        return await c.react("❌");
      }

      if (sub === "model") {
        const model = rest.join(" ").trim();
        if (!model)
          return await c.reply(`${t("models", {}, c)}\n${modelListStr()}`);
        if (!MODEL_NAMES.includes(model)) {
          return await c.reply(`Invalid model. Available:\n${modelListStr()}`);
        }
        const s = loadSettings();
        s.model = model;
        saveSettings(s);
        return await c.reply(t("model_set", { model }, c));
      }

      if (sub === "prompt") {
        const prompt = rest.join(" ").trim();
        const s = loadSettings();
        s.systemPrompt = prompt;
        saveSettings(s);
        return await c.reply(t("prompt_set", {}, c));
      }

      if (sub === "models") {
        return await c.reply(`${t("models", {}, c)}\n${modelListStr()}`);
      }

      const client = getClient();
      if (!client) return await c.react("🔑");

      const s = loadSettings();
      const model = s.model || "gemini-3-flash";
      const systemPrompt = s.systemPrompt || "";

      let query = args;

      const ref = c.event.reference;
      let replied = null;
      if (ref?.messageId) {
        try {
          replied = await c.event.channel.messages.fetch(ref.messageId);
        } catch {}
      }

      if (replied) {
        if (query) {
          query = `${query} ${replied.content || ""}`;
        } else {
          query = replied.content || "";
        }
      }

      if (!query) return await c.reply(t("usage", { prefix: c.prefix }, c));

      try {
        const r = await client.ask(query, { model, systemPrompt });
        if (c.cmd === "gmwr") {
          const msg = await c.event.edit(r.response);
          if (msg?.id) gmwMessages.add(msg.id);
        } else {
          const msg = await c.reply(r.response);
          if (msg?.id) gmwMessages.add(msg.id);
        }
      } catch (e) {
        pen.Error("gmw:", e.message);
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
      if (!gmwMessages.has(ref.messageId)) return;

      const query = msg.content || "";
      if (!query) return;

      const s = loadSettings();
      const model = s.model || "gemini-3-flash";
      const systemPrompt = s.systemPrompt || "";

      const client = getClient();
      if (!client) return;

      try {
        const r = await client.ask(query, { model, systemPrompt });
        const sent = await msg.reply(r.response);
        if (sent?.id) gmwMessages.add(sent.id);
      } catch {}
    },
  },
];
