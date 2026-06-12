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
 * @typedef {Object} PluginContext
 * @property {import('discord.js-selfbot-v13').Client} client - The Discord client instance.
 * @property {any} event - The event data (e.g., Message object).
 * @property {string} prefix - The command prefix.
 * @property {string} lang - The user's preferred language.
 * @property {string} [cmd] - The command name used.
 * @property {string} [args] - The command arguments.
 * @property {() => import('./handler.js').Handler} handler - Access to the handler instance.
 * @property {() => any} user - Get current user data.
 * @property {() => any} chatData - Get current chat/guild data.
 * @property {string} senderJid - The sender's unique ID.
 * @property {(content: string | {text: string}) => Promise<any>} reply - Reply to the message.
 * @property {(emoji: string) => Promise<any>} react - React to the message.
 * @property {(content: string | {}) => Promise<any>} send - Send a message to the channel.
 * @property {(content: string | {}) => Promise<any>} edit - Edit the message (only works on bot's own messages).
 * @property {() => Promise<any>} delete - Delete the message.
 */

/**
 * @typedef {Object} Plugin
 * @property {string[]} [cmd] - Array of command triggers.
 * @property {string[]} [events] - Array of event names to listen to.
 * @property {string} [cat] - Category name.
 * @property {string} [desc] - Command description.
 * @property {number[]} [roles] - Required role levels.
 * @property {boolean} [noPrefix] - Whether the command works without a prefix.
 * @property {(c: PluginContext) => Promise<void>} exec - The execution function.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pen from "./pen.js";
import { watchDir } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.join(__dirname, "plugins");

/** @type {Plugin[]} */
let plugins = [];

/**
 * Loads all plugins from the plugins directory.
 * @returns {Promise<void>}
 */
export const loadPlugins = async () => {
  if (!fs.existsSync(pluginDir)) return;

  const files = fs
    .readdirSync(pluginDir)
    .filter((file) => file.endsWith(".js"));

  const newPlugins = [];
  for (const file of files) {
    const pluginPath = path.join(pluginDir, file);
    try {
      const { default: module } = await import(
        `file://${pluginPath}?update=${Date.now()}`
      );
      const items = Array.isArray(module) ? module : [module];

      for (const plugin of items) {
        if (plugin && (plugin.cmd || plugin.events) && plugin.exec) {
          plugin._filename = file;
          newPlugins.push(plugin);
        }
      }
    } catch (e) {
      pen.Error(`Failed to load plugin ${file}:`, e);
    }
  }
  plugins = newPlugins;
  pen.Info(`Loaded ${plugins.length} plugins/listeners`);
};

/**
 * Initializes the file watcher for hot reloading plugins.
 */
export const initWatcher = () => {
  watchDir(pluginDir, async (event, filePath) => {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith(".js")) return;

    pen.Info(
      `[HOT RELOAD] ${event.toUpperCase()} detected in ${fileName}. Reloading...`,
    );
    await loadPlugins();
  });
};

/**
 * Finds plugins subscribed to a specific event.
 * @param {string} event - The event name.
 * @returns {Plugin[]}
 */
export const getPluginsByEvent = (event) => {
  return plugins.filter(
    (p) =>
      p.events?.includes(event) || (!p.events && event === "messageCreate"),
  );
};

/**
 * Finds a plugin by its command trigger.
 * @param {string} cmd - The command name.
 * @returns {Plugin | undefined}
 */
export const getPluginByCommand = (cmd) => {
  return plugins.find((p) => p.cmd?.includes(cmd));
};

export { plugins };
