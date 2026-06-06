/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

export const Role = {
  GUEST: 0,
  USER: 1,
  ADMIN: 2,
  SUPERADMIN: 3,
};

/**
 * Returns a text-based badge for the role level.
 * @param {number} level - The role level.
 * @returns {string}
 */
export const getRoleBadge = (level) => {
  switch (level) {
    case Role.SUPERADMIN:
      return "[SA]";
    case Role.ADMIN:
      return "[A]";
    case Role.USER:
      return "[U]";
    case Role.GUEST:
      return "[G]";
    default:
      return "[?]";
  }
};
