const express = require("express");
const { fetchForecast } = require("../services/openweatherClient");
const {
  buildCacheKey,
  getCachedValue,
  setCachedValue
} = require("../services/cache");

const router = express.Router();

const DEFAULT_DAYS = 5;
const MIN_DAYS = 1;
const MAX_UI_DAYS = 5;
const MAX_SUPPORTED_DAYS = Number(process.env.MAX_FORECAST_DAYS || 5);
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 600);
const MOCK_MODE = String(process.env.MOCK_MODE || "false").toLowerCase() === "true";

const inFlight = new Map();

function buildMockWeather(query, requestedDays, returnedDays) {
  const normalizedQuery = query.trim();
  const seed = normalizedQuery
    .toLowerCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;

  const conditions = [
    { description: "clear sky", icon: "01d" },
    { description: "few clouds", icon: "02d" },
    { description: "scattered clouds", icon: "03d" },
    { description: "light rain", icon: "10d" },
    { description: "mist", icon: "50d" }
  ];

  const baseTemp = 52 + (seed % 20);
  const baseHumidity = 40 + (seed % 35);
  const baseWind = 4 + (seed % 8);
  const now = new Date();

  const forecast = Array.from({ length: returnedDays }, (_unused, index) => {
    const forecastDate = new Date(now);
    forecastDate.setDate(now.getDate() + index);

    const condition = conditions[(seed + index) % conditions.length];
    const temp = baseTemp + ((index % 3) - 1) * 2;
    return {
      date: forecastDate.toISOString().slice(0, 19).replace("T", " "),
      temp,
      highTemp: temp + 3,
      lowTemp: temp - 3,
      humidity: Math.min(95, baseHumidity + (index % 4) * 3),
      windSpeed: baseWind + (index % 3),
      description: condition.description,
      iconUrl: `https://openweathermap.org/img/wn/${condition.icon}@2x.png`
    };
  });

  const currentCondition = conditions[seed % conditions.length];

  return {
    location: {
      name: normalizedQuery,
      state: null,
      country: "MOCK"
    },
    current: {
      temp: baseTemp,
      humidity: baseHumidity,
      windSpeed: baseWind,
      description: currentCondition.description,
      iconUrl: `https://openweathermap.org/img/wn/${currentCondition.icon}@2x.png`
    },
    forecast,
    request: {
      requestedDays,
      returnedDays,
      capped: requestedDays !== returnedDays,
      maxSupportedDays: MAX_SUPPORTED_DAYS
    }
  };
}

router.get("/config", (_req, res) => {
  res.json({
    maxSupportedDays: Math.min(MAX_UI_DAYS, Math.max(MIN_DAYS, MAX_SUPPORTED_DAYS)),
    defaultDays: DEFAULT_DAYS
  });
});

router.get("/weather", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    if (!query) {
      return res.status(400).json({
        error: "Query is required. Provide a city name or zip code."
      });
    }

    const units = "imperial";
    const requestedDays = Number(req.query.days) || DEFAULT_DAYS;
    const cappedDays = Math.min(
      MAX_SUPPORTED_DAYS,
      Math.max(MIN_DAYS, Math.min(MAX_UI_DAYS, requestedDays))
    );

    if (MOCK_MODE) {
      const mockData = buildMockWeather(query, requestedDays, cappedDays);
      res.set("X-Cache", "MOCK");
      return res.json(mockData);
    }

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Server is missing OPENWEATHER_API_KEY configuration."
      });
    }

    const cacheKey = buildCacheKey({
      query,
      units,
      days: cappedDays
    });

    const cached = await getCachedValue(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }

    if (inFlight.has(cacheKey)) {
      const data = await inFlight.get(cacheKey);
      res.set("X-Cache", "COALESCED");
      return res.json(data);
    }

    const fetchPromise = fetchForecast({ query, units, days: cappedDays, apiKey })
      .then(async (data) => {
        data.request = {
          requestedDays,
          returnedDays: cappedDays,
          capped: requestedDays !== cappedDays,
          maxSupportedDays: MAX_SUPPORTED_DAYS
        };
        await setCachedValue(cacheKey, data, CACHE_TTL_SECONDS);
        return data;
      })
      .finally(() => {
        inFlight.delete(cacheKey);
      });

    inFlight.set(cacheKey, fetchPromise);

    const data = await fetchPromise;
    res.set("X-Cache", "MISS");
    return res.json(data);
  } catch (error) {
    const upstreamStatus = error.response?.status;
    if (upstreamStatus === 404) {
      return res.status(404).json({ error: "Location not found." });
    }

    if (upstreamStatus === 401) {
      return res.status(500).json({ error: "Invalid OpenWeather API key." });
    }

    if (upstreamStatus === 429) {
      return res.status(429).json({ error: "Rate limit reached. Please try again shortly." });
    }

    return res.status(500).json({ error: "Unable to fetch weather data right now." });
  }
});

module.exports = router;