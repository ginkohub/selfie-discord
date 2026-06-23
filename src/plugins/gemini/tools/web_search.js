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

import https from "node:https";

function jsonGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: "Invalid JSON response" });
        }
      });
      res.on("error", reject);
    });
  });
}

export default {
  fn: {
    name: "web_search",
    description: "Search the web using DuckDuckGo",
    parameters: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "Search query",
        },
      },
      required: ["q"],
    },
  },
  execute: async (params) => {
    const query = params.q?.trim();
    if (!query) return { error: "Query is required" };
    const data = await jsonGet(
      `https://api.siputzx.my.id/api/s/duckduckgo?query=${encodeURIComponent(query)}`,
    );
    if (data.error) return { error: data.error };
    const items = data.data?.results || data.data || data.results || [];
    if (!Array.isArray(items)) {
      return { query, results: [{ text: JSON.stringify(data.data || data).slice(0, 2000) }] };
    }
    const results = items.slice(0, 8).map((r) => ({
      title: r.title || r.name || "",
      url: r.url || r.link || "",
      snippet: r.snippet || r.description || r.body || "",
    }));
    return { query, results };
  },
};
