/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { ChatManager } from "./chat_manager.js";
import { EVENTS } from "./const.js";
import pen from "./pen.js";
import { getPluginsByEvent } from "./plugin.js";
import settings from "./settings.js";
import { UserManager } from "./user_manager.js";

/**
 * Main command and event handler.
 */
export class Handler {
  constructor() {
    this.userManager = new UserManager();
    this.chatManager = new ChatManager();
  }

  /**
   * Dispatches an event to all interested plugins.
   * @param {string} eventType - The type of event.
   * @param {any} eventData - Data associated with the event.
   * @param {import('discord.js-selfbot-v13').Client} client - The Discord client.
   */
  async dispatch(eventType, eventData, client) {
    const plugins = getPluginsByEvent(eventType);

    for (const plugin of plugins) {
      try {
        if (eventType === EVENTS.MESSAGE_CREATE) {
          const message = eventData;
          const content = message.content;
          const prefix = settings.prefix.length ? settings.prefix : ["!"];

          if (plugin.cmd) {
            if (!content) continue;

            let matched = false;
            let commandUsed = "";
            let args = [];

            for (const p of prefix) {
              if (content.startsWith(p)) {
                const rawArgs = content.slice(p.length).trim().split(/ +/);
                const cmd = rawArgs.shift().toLowerCase();
                if (plugin.cmd.includes(cmd)) {
                  matched = true;
                  commandUsed = cmd;
                  args = rawArgs;
                  break;
                }
              }
            }

            if (matched) {
              await this.execute(plugin, {
                event: message,
                cmd: commandUsed,
                args,
                client,
              });
            }
          } else {
            await this.execute(plugin, { event: message, client });
          }
        } else {
          await this.execute(plugin, { event: eventData, client, eventType });
        }
      } catch (error) {
        pen.Error(`Dispatcher error for ${eventType}:`, error);
      }
    }
  }

  /**
   * Executes a specific plugin with a constructed context.
   * @param {import('./plugin.js').Plugin} plugin - The plugin to execute.
   * @param {Object} contextData - Raw data to build the context.
   */
  async execute(plugin, contextData) {
    const { client, cmd, args, event } = contextData;

    const senderId = event?.author?.id;
    const user = senderId ? this.userManager.getUser(senderId) : null;

    if (user && senderId !== client.user.id) {
      if (user.banned) return;
    }

    if (plugin.roles && user) {
      const hasRole =
        senderId === client.user.id ||
        plugin.roles.some((r) => user.isAtLeast(r));
      if (!hasRole) {
        pen.Warn(
          `Role insufficient for ${cmd}. Required: ${plugin.roles}, User: ${Math.max(...user.roles)}`,
        );
        return;
      }
    }

    /** @type {import('./plugin.js').PluginContext} */
    const c = {
      client,
      event,
      prefix: settings.prefix.length ? settings.prefix[0] : "!",
      lang: user?.lang || "en",
      cmd,
      args: Array.isArray(args) ? args.join(" ") : args,
      handler: () => this,
      user: () => user,
      chatData: () =>
        this.chatManager.getChat(event?.guild?.id || event?.channel?.id),
      senderJid: senderId,
      reply: async (content) => {
        if (event?.reply) {
          try {
            if (typeof content === "string") return await event.reply(content);
            if (content.text) return await event.reply(content.text);
            return await event.reply(content);
          } catch (e) {
            pen.Error("Failed to reply:", e);
          }
        }
      },
      react: async (emoji) => {
        if (event?.react) {
          try {
            return await event.react(emoji);
          } catch (e) {
            pen.Error("Failed to react:", e);
          }
        }
      },
    };

    try {
      await plugin.exec(c);
    } catch (error) {
      pen.Error(`Plugin execution failed: ${cmd || "listener"}`, error);
    }
  }
}

export const handler = new Handler();
/**
 * Global dispatcher function.
 */
export const dispatcher = (type, data, client) =>
  handler.dispatch(type, data, client);
