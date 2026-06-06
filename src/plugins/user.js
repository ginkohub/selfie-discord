/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { getRoleBadge, Role } from "../roles.js";
import { translate } from "../translate.js";

const t = translate({
  en: {
    header: "--- User Information ---",
    username: "Username",
    display_name: "Display Name",
    id: "ID",
    roles: "Roles",
    level: "Level",
    xp: "XP",
    status: "Status",
    banned: "Banned (at {val})",
    active: "Active",
    added: "Added",
    no_user: "No user specified. Mention someone.",
    invalid_role: "Invalid role. Available: {val}",
    added_role: "Added role {role} to {count} user(s).",
    removed_role: "Removed role {role} from {count} user(s).",
    bio: "Bio",
  },
  id: {
    header: "--- Informasi User ---",
    username: "Username",
    display_name: "Nama Tampilan",
    id: "ID",
    roles: "Peran",
    level: "Level",
    xp: "XP",
    status: "Status",
    banned: "Diblokir (pada {val})",
    active: "Aktif",
    added: "Ditambahkan",
    no_user: "Tidak ada user yang ditentukan. Tag seseorang.",
    invalid_role: "Peran tidak valid. Tersedia: {val}",
    added_role: "Menambahkan peran {role} ke {count} user.",
    removed_role: "Menghapus peran {role} dari {count} user.",
    bio: "Bio",
  },
});

/** @type {import('../plugin.js').Plugin[]} */
export default [
  {
    cmd: ["user"],
    cat: "user",
    tags: ["user", "role"],
    desc: "Get user info",
    roles: [Role.USER],
    exec: async (c) => {
      const mentions = c.event.mentions.users;
      const targets =
        mentions.size > 0 ? mentions.map((u) => u.id) : [c.senderJid];

      const texts = [t("header", {}, c), ""];

      for (const id of targets) {
        const discordUser = await c.client.users.fetch(id).catch(() => null);

        const updateData = {};
        if (discordUser) {
          updateData.username = discordUser.username;
          updateData.displayName =
            discordUser.globalName || discordUser.username;
        }

        const user = c.handler().userManager.updateUser(id, updateData);
        if (!user) continue;

        const roles = user.roles
          .map(
            (r) =>
              `${getRoleBadge(r)} ${Object.keys(Role).find((k) => Role[k] === r)}`,
          )
          .join(", ");
        const added = new Date(user.addedAt).toLocaleString();

        const displayBio =
          id === c.client.user.id
            ? c.client.user.bio || "N/A"
            : discordUser?.bio || "N/A";

        texts.push(
          `${t("display_name", {}, c)}: ${user.displayName || "N/A"}`,
          `${t("username", {}, c)}: ${user.username || "N/A"}`,
          `${t("id", {}, c)}: ${id}`,
          `${t("roles", {}, c)}: ${roles}`,
          `${t("bio", {}, c)}: ${displayBio}`,
          `${t("level", {}, c)}: ${user.level}`,
          `${t("xp", {}, c)}: ${user.xp}`,
          `${t("status", {}, c)}: ${user.banned ? t("banned", { val: new Date(user.bannedAt).toLocaleString() }, c) : t("active", {}, c)}`,
          `${t("added", {}, c)}: ${added}`,
        );

        if (user.stats && Object.keys(user.stats).length > 0) {
          texts.push(`\n--- ${t("stats", {}, c)} ---`);
          for (const [type, count] of Object.entries(user.stats)) {
            texts.push(`- ${type.replace("Message", "")}: ${count}`);
          }
        }

        texts.push("");
      }

      await c.reply(texts.join("\n").trim());
    },
  },
  {
    cmd: ["role+"],
    cat: "admin",
    tags: ["user", "role"],
    desc: "Add role to mentioned user",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const mentions = c.event.mentions.users;
      if (mentions.size === 0) return await c.reply(t("no_user", {}, c));

      const args = c.args.split(" ");
      const roleName = args[0]?.toUpperCase();
      const role = Role[roleName];

      if (role === undefined) {
        return await c.reply(
          t("invalid_role", { val: Object.keys(Role).join(", ") }, c),
        );
      }

      mentions.forEach((u) => {
        const user = c.handler().userManager.updateUser(u.id, {});
        if (user && !user.roles.includes(role)) {
          user.roles.push(role);
          c.handler().userManager.updateUser(u.id, { roles: user.roles });
        }
      });

      await c.reply(
        t("added_role", { role: roleName, count: mentions.size }, c),
      );
    },
  },
  {
    cmd: ["role-"],
    cat: "admin",
    tags: ["user", "role"],
    desc: "Remove role from mentioned user",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const mentions = c.event.mentions.users;
      if (mentions.size === 0) return await c.reply(t("no_user", {}, c));

      const args = c.args.split(" ");
      const roleName = args[0]?.toUpperCase();
      const role = Role[roleName];

      if (role === undefined) {
        return await c.reply(
          t("invalid_role", { val: Object.keys(Role).join(", ") }, c),
        );
      }

      mentions.forEach((u) => {
        const user = c.handler().userManager.updateUser(u.id, {});
        if (user?.roles.includes(role)) {
          user.roles = user.roles.filter((r) => r !== role);
          if (user.roles.length === 0) user.roles.push(Role.GUEST);
          c.handler().userManager.updateUser(u.id, { roles: user.roles });
        }
      });

      await c.reply(
        t("removed_role", { role: roleName, count: mentions.size }, c),
      );
    },
  },
  {
    cmd: ["user+"],
    cat: "admin",
    tags: ["user"],
    desc: "Add/verify user(s) to database",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const mentions = c.event.mentions.users;
      const targets =
        mentions.size > 0
          ? mentions.map((u) => u.id)
          : c.args.trim()
            ? [c.args.trim()]
            : [];

      if (targets.length === 0)
        return await c.reply("Usage: .user+ <id> or @mention");

      for (const id of targets) {
        c.handler().userManager.updateUser(id, {});
      }

      await c.reply(`Added/verified ${targets.length} user(s).`);
    },
  },
  {
    cmd: ["user-"],
    cat: "admin",
    tags: ["user"],
    desc: "Remove user(s) from database",
    roles: [Role.ADMIN],
    exec: async (c) => {
      const mentions = c.event.mentions.users;
      const targets =
        mentions.size > 0
          ? mentions.map((u) => u.id)
          : c.args.trim()
            ? [c.args.trim()]
            : [];

      if (targets.length === 0)
        return await c.reply("Usage: .user- <id> or @mention");

      for (const id of targets) {
        delete c.handler().userManager.data[id];
      }
      c.handler().userManager.save();

      await c.reply(`Removed ${targets.length} user(s) from database.`);
    },
  },
];
