/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { Client } from "discord.js-selfbot-v13";
import { startCaptchaServer, waitForCaptcha } from "./captcha_server.js";
import pen from "./pen.js";
import settings from "./settings.js";

if (settings.serverPort > 0) startCaptchaServer(settings.serverPort);

export const createClient = () => {
  const client = new Client({
    checkUpdate: false,
    captchaSolver: async (captchaData, userAgent) => {
      pen.Warn("--- CAPTCHA REQUIRED ---");
      pen.Debug("Captcha Payload:", JSON.stringify(captchaData));

      const sitekey =
        captchaData.sitekey ||
        captchaData.captcha_sitekey ||
        "b2b02ab5-7dae-4d6f-830e-7b55634c888b";

      pen.Info(`Sitekey: ${sitekey}`);
      pen.Info(`User-Agent: ${userAgent}`);
      pen.Info(
        `Built-in solver: http://local.discord.com:${settings.serverPort}`,
      );
      pen.Info("------------------------");

      const token = await waitForCaptcha({
        ...captchaData,
        userAgent,
        sitekey,
      });
      pen.Info(`Token received (${token.length} chars). Retrying request...`);
      return token;
    },
  });

  return client;
};
