/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import settings from "./settings.js";

export const translate = (translations) => {
  return (key, variables = {}, context = {}) => {
    const lang = context.lang || settings.lang || "en";
    let text = translations[lang]?.[key] || translations.en?.[key] || key;

    for (const [vKey, vVal] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{${vKey}\\}`, "g"), vVal);
    }

    return text;
  };
};
