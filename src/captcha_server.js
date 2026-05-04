/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import fs from "node:fs";
import http from "node:http";
import pen from "./pen.js";

let currentCaptcha = null;
let resolvePromise = null;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "/solver.html") {
    try {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync("web/solver.html"));
    } catch {
      res.writeHead(500);
      res.end("Error loading solver.html");
    }
  } else if (req.url === "/data") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(currentCaptcha || {}));
  } else if (req.url.startsWith("/submit")) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (token && resolvePromise) {
      const resolve = resolvePromise;
      resolvePromise = null;
      currentCaptcha = null;
      resolve(token);
      res.writeHead(200);
      res.end("Success! You can close this tab.");
      pen.Info("CAPTCHA token received from browser.");
    } else {
      res.writeHead(400);
      res.end(token ? "No pending CAPTCHA challenge." : "Missing token.");
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

/**
 * Starts the built-in CAPTCHA solver server.
 * @param {number} port
 */
export const startCaptchaServer = (port = 3000) => {
  try {
    server.listen(port, "0.0.0.0", () => {
      pen.Info(`Built-in solver server: http://local.discord.com:${port}`);
    });
  } catch (e) {
    pen.Error("Failed to start built-in solver server: ", e);
  }
};

/**
 * Sets the current challenge and returns a promise that resolves with the token.
 * @param {Object} data
 * @returns {Promise<string>}
 */
export const waitForCaptcha = (data) => {
  currentCaptcha = data;
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
};
