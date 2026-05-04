/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import { Role } from "./roles.js";
import { read, write } from "./store.js";

/**
 * Manager for user-related data and roles.
 */
export class UserManager {
  constructor() {
    /** @type {Object.<string, any>} */
    this.data = read().users || {};
  }

  /**
   * Retrieves or initializes user data by ID.
   * @param {string} id - The user's unique ID.
   * @returns {any} The user data object.
   */
  getUser(id) {
    if (!this.data[id]) {
      this.data[id] = {
        id,
        username: null,
        displayName: null,
        roles: [Role.USER],
        level: 1,
        xp: 0,
        addedAt: new Date().toISOString(),
        banned: false,
        bannedAt: null,
        stats: {},
        lang: "en",
      };
    }
    return this.data[id];
  }

  /**
   * Updates user data and saves to store.
   * @param {string} id - The user ID.
   * @param {Object} update - The fields to update.
   * @returns {any} The updated user object.
   */
  updateUser(id, update) {
    const user = { ...this.getUser(id), ...update };
    this.data[id] = user;
    this.save();
    return user;
  }

  /**
   * Checks if a user has sufficient roles.
   * @param {string} id - The user ID.
   * @param {number[]} requiredRoles - Array of required role levels.
   * @returns {boolean}
   */
  rolesEnough(id, requiredRoles) {
    const user = this.getUser(id);
    const maxRole = Math.max(...user.roles);
    return requiredRoles.some((role) => maxRole >= role);
  }

  /**
   * Saves current user data to the global store.
   */
  save() {
    const current = read();
    write({ ...current, users: this.data });
  }
}
