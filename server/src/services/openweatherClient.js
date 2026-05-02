const axios = require("axios");

const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast";

function isZipQuery(query) {
  return /^\d{5}(?:,\w{2})?$/.test(query.trim());
}

function toIconUrl(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function buildDailyForecast(list) {
  const byDate = new Map();

  for (const item of list) {
    const dateKey = item.dt_txt.slice(0, 10);
    const existing = byDate.get(dateKey);

    if (!existing) {
      byDate.set(dateKey, {
        representative: item,
        highTemp: item.main.temp_max,
        lowTemp: item.main.temp_min
      });
      continue;
    }

    existing.highTemp = Math.max(existing.highTemp, item.main.temp_max);
    existing.lowTemp = Math.min(existing.lowTemp, item.main.temp_min);

    const existingIsNoon = existing.representative.dt_txt.endsWith("12:00:00");
    if (!existingIsNoon && item.dt_txt.endsWith("12:00:00")) {
      existing.representative = item;
    }
  }

  return Array.from(byDate.values());
}

async function fetchForecast({ query, units, days, apiKey }) {
  const params = {
    appid: apiKey,
    units
  };

  if (isZipQuery(query)) {
    params.zip = query;
  } else {
    params.q = query;
  }

  const response = await axios.get(OPENWEATHER_URL, { params, timeout: 10000 });
  const payload = response.data;

  if (!payload.list || payload.list.length === 0) {
    throw new Error("No weather data available for this location.");
  }

  const currentEntry = payload.list[0];
  const daily = buildDailyForecast(payload.list).slice(0, days);

  return {
    location: {
      name: payload.city.name,
      state: payload.city.state || null,
      country: payload.city.country
    },
    current: {
      temp: currentEntry.main.temp,
      humidity: currentEntry.main.humidity,
      windSpeed: currentEntry.wind.speed,
      description: currentEntry.weather[0].description,
      iconUrl: toIconUrl(currentEntry.weather[0].icon)
    },
    forecast: daily.map((day) => ({
      date: day.representative.dt_txt,
      temp: day.representative.main.temp,
      highTemp: day.highTemp,
      lowTemp: day.lowTemp,
      humidity: day.representative.main.humidity,
      windSpeed: day.representative.wind.speed,
      description: day.representative.weather[0].description,
      iconUrl: toIconUrl(day.representative.weather[0].icon)
    }))
  };
}

module.exports = {
  fetchForecast
};