/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com)
 */

import pen from "../pen.js";
import { Role } from "../roles.js";
import { translate } from "../translate.js";

const t = translate({
  en: {
    help_title: "🌦 WEATHER INFO",
    help_usage: "Use `{prefix}weather [city_name]` to check current weather.",
    help_example: "💡 Example: `{prefix}weather jakarta` or `{prefix}weather london`",
    not_found: '❌ City "{query}" not found!',
    api_error: "❌ Failed to fetch weather data.",
    header: "🌦 Weather in {location}",
    temp: "🌡 Temperature: {temp}°C",
    condition: "☁ Condition: {condition}",
    humidity: "💧 Humidity: {humidity}%",
    wind: "💨 Wind Speed: {wind} km/h",
    footer: "_Data provided by Open-Meteo_",
  },
  id: {
    help_title: "🌦 INFO CUACA",
    help_usage: "Gunakan `{prefix}weather [nama_kota]` untuk cek cuaca.",
    help_example: "💡 Contoh: `{prefix}weather jakarta` atau `{prefix}weather bandung`",
    not_found: '❌ Kota "{query}" tidak ditemukan!',
    api_error: "❌ Gagal memuat data cuaca.",
    header: "🌦 Cuaca di {location}",
    temp: "🌡 Suhu: {temp}°C",
    condition: "☁ Kondisi: {condition}",
    humidity: "💧 Kelembapan: {humidity}%",
    wind: "💨 Kecepatan Angin: {wind} km/h",
    footer: "_Data oleh Open-Meteo_",
  },
});

const weatherCodes = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  95: "Thunderstorm",
};

export default {
  cmd: ["weather", "cuaca"],
  cat: "tools",
  desc: "Check current weather for a city",
  roles: [Role.USER],
  exec: async (c) => {
    const query = (c.args || "").trim();

    if (!query || query === "?") {
      const helpText = [
        t("help_title", {}, c),
        "",
        t("help_usage", {}, c),
        t("help_example", {}, c),
      ].join("\n");
      return await c.reply(helpText);
    }

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl, {
        headers: { "User-Agent": "SelfieBot/1.0" },
      });
      if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return await c.reply(t("not_found", { query }, c));
      }

      const location = geoData.results[0];
      const { latitude, longitude, name, country } = location;

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
      const weatherRes = await fetch(weatherUrl, {
        headers: { "User-Agent": "SelfieBot/1.0" },
      });
      if (!weatherRes.ok)
        throw new Error(`Weather fetch failed: ${weatherRes.status}`);
      const weatherData = await weatherRes.json();

      const current = weatherData.current;
      const condition = weatherCodes[current.weather_code] || "Unknown";

      const results = [
        t("header", { location: `${name}, ${country}` }, c),
        "",
        t("temp", { temp: current.temperature_2m }, c),
        t("condition", { condition }, c),
        t("humidity", { humidity: current.relative_humidity_2m }, c),
        t("wind", { wind: current.wind_speed_10m }, c),
        "",
        t("footer", {}, c),
      ];

      await c.reply(results.join("\n"));
    } catch (e) {
      pen.Error(`weather-error: ${e.message}`);
      await c.reply(t("api_error", {}, c));
    }
  },
};
