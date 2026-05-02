const DEFAULT_DAYS = 5;

const form = document.getElementById("weather-form");
const queryInput = document.getElementById("query");
const daysSelect = document.getElementById("days");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const forecastNoteEl = document.getElementById("forecast-note");

const locationEl = document.getElementById("location");
const currentDescriptionEl = document.getElementById("current-description");
const currentIconEl = document.getElementById("current-icon");
const currentTempEl = document.getElementById("current-temp");
const currentMetaEl = document.getElementById("current-meta");
const forecastGridEl = document.getElementById("forecast-grid");

let maxSupportedDays = DEFAULT_DAYS;

function setStatus(type, message) {
  if (!message) {
    statusEl.innerHTML = "";
    return;
  }

  statusEl.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
}

function toFahrenheit(temp) {
  if (!Number.isFinite(temp)) {
    return "--°";
  }

  return `${Math.round(temp)}°`;
}

function prettyDate(dateText) {
  return new Date(dateText).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function setForecastDayLimits(maxDays) {
  maxSupportedDays = Math.max(1, Math.min(10, maxDays || DEFAULT_DAYS));

  Array.from(daysSelect.options).forEach((option) => {
    if (!option.value) {
      return;
    }

    const value = Number(option.value);
    option.disabled = value > maxSupportedDays;
  });

  forecastNoteEl.textContent = `Your current OpenWeather setup supports up to ${maxSupportedDays} forecast day(s).`;
}

function renderWeather(data) {
  locationEl.textContent = data.location.state
    ? `${data.location.name}, ${data.location.state}, ${data.location.country}`
    : `${data.location.name}, ${data.location.country}`;
  currentDescriptionEl.textContent = data.current.description;
  currentTempEl.textContent = toFahrenheit(data.current.temp);
  currentMetaEl.textContent = `Humidity ${data.current.humidity}% | Wind ${Math.round(data.current.windSpeed)} mph`;
  currentIconEl.src = data.current.iconUrl;
  currentIconEl.alt = data.current.description;

  forecastGridEl.innerHTML = "";
  data.forecast.forEach((day) => {
    const fallbackTemp = day.temp;
    const highTemp = day.highTemp ?? fallbackTemp;
    const lowTemp = day.lowTemp ?? fallbackTemp;

    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4";
    col.innerHTML = `
      <article class="forecast-card rounded-4 p-3 h-100 shadow-sm">
        <p class="fw-semibold mb-2">${prettyDate(day.date)}</p>
        <div class="d-flex align-items-center gap-2 mb-2">
          <img src="${day.iconUrl}" alt="${day.description}" width="48" height="48" />
          <p class="text-capitalize mb-0">${day.description}</p>
        </div>
        <p class="temp mb-1">High ${toFahrenheit(highTemp)} | Low ${toFahrenheit(lowTemp)}</p>
        <p class="small text-muted mb-0">Humidity ${day.humidity}% | Wind ${Math.round(day.windSpeed)} mph</p>
      </article>
    `;
    forecastGridEl.appendChild(col);
  });

  resultsEl.classList.remove("d-none");
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) {
      setForecastDayLimits(DEFAULT_DAYS);
      return;
    }

    const data = await res.json();
    setForecastDayLimits(data.maxSupportedDays);
  } catch (error) {
    setForecastDayLimits(DEFAULT_DAYS);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) {
    setStatus("warning", "Please enter a city or zip code.");
    return;
  }

  const selectedDays = Number(daysSelect.value) || DEFAULT_DAYS;
  const clampedDays = Math.min(selectedDays, maxSupportedDays);

  setStatus("info", "Fetching weather data...");
  resultsEl.classList.add("d-none");

  try {
    const response = await fetch(
      `/api/weather?query=${encodeURIComponent(query)}&days=${clampedDays}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to fetch weather data.");
    }

    renderWeather(data);
    const cacheHeader = response.headers.get("x-cache") || "MISS";
    const cappedMessage = data.request?.capped
      ? ` Requested ${data.request.requestedDays} day(s), returned ${data.request.returnedDays} due to plan limits.`
      : "";
    setStatus(
      "success",
      `Weather loaded for ${data.location.name}. Cache status: ${cacheHeader}.${cappedMessage}`
    );
  } catch (error) {
    setStatus("danger", error.message);
  }
});

loadConfig();