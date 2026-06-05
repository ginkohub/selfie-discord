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

export class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username ?? null;
    this.displayName = data.displayName ?? null;
    this.roles = data.roles ?? [Role.GUEST];
    this.level = data.level ?? 1;
    this.xp = data.xp ?? 0;
    this.addedAt = data.addedAt ?? new Date().toISOString();
    this.banned = data.banned ?? false;
    this.bannedAt = data.bannedAt ?? null;
    this.stats = data.stats ?? {};
    this.lang = data.lang ?? "en";
  }

  isAtLeast(role) {
    return Math.max(...this.roles) >= role;
  }

  hasRole(role) {
    return this.roles.includes(role);
  }
}

/**
 * Manager for user-related data and roles.
 */
export class UserManager {
  constructor() {
    /** @type {Object.<string, User>} */
    this.data = read().users || {};
    this._saveTimer = null;
  }

  /**
   * Retrieves or initializes user data by ID.
   * @param {string} id - The user's unique ID.
   * @returns {User} The user object.
   */
  getUser(id) {
    if (!this.data[id]) {
      this.data[id] = new User({ id });
    } else if (!(this.data[id] instanceof User)) {
      this.data[id] = new User(this.data[id]);
    }
    return this.data[id];
  }

  /**
   * Updates user data and saves to store.
   * @param {string} id - The user ID.
   * @param {Object} update - The fields to update.
   * @returns {User} The updated user object.
   */
  updateUser(id, update) {
    const data = { ...this.getUser(id), ...update };
    this.data[id] = data instanceof User ? data : new User(data);
    this.save();
    return this.data[id];
  }

  /**
   * Checks if a user has sufficient roles.
   * @param {string} id - The user ID.
   * @param {number[]} requiredRoles - Array of required role levels.
   * @returns {boolean}
   */
  rolesEnough(id, requiredRoles) {
    return requiredRoles.some((role) => this.getUser(id).isAtLeast(role));
  }

  /**
   * Saves current user data to the global store (debounced).
   */
  save() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      const current = read();
      write({ ...current, users: this.data });
    }, 5000);
  }
}
