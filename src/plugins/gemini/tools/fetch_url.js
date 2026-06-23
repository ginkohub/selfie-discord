/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import https from "node:https";

export default {
  fn: {
    name: "fetch_url",
    description: "Download text content from a URL",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch (http/https only)",
        },
      },
      required: ["url"],
    },
  },
  execute: async (params) => {
    const url = params.url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { error: "Only http/https URLs are allowed" };
    }
    return new Promise((resolve) => {
      const req = https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            resolve({ error: `HTTP ${res.statusCode}` });
          } else {
            resolve({ url, status: res.statusCode, content: data, size: data.length });
          }
        });
      });
      req.on("error", (err) => resolve({ error: err.message }));
      req.setTimeout(15000, () => {
        req.destroy();
        resolve({ error: "Request timed out" });
      });
    });
  },
};
