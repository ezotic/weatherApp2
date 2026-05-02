const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const REDIS_CONNECT_RETRIES = Number(process.env.REDIS_CONNECT_RETRIES || 12);

const client = createClient({ url: REDIS_URL });
let connected = false;

client.on("error", (error) => {
  console.error("Redis error:", error.message);
});

async function connectRedis() {
  if (connected) {
    return;
  }

  for (let attempt = 1; attempt <= REDIS_CONNECT_RETRIES; attempt += 1) {
    try {
      await client.connect();
      connected = true;
      return;
    } catch (error) {
      if (attempt === REDIS_CONNECT_RETRIES) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function buildCacheKey({ query, units, days }) {
  return `weather:v2:${units}:${query.toLowerCase()}:${days}`;
}

async function getCachedValue(key) {
  const raw = await client.get(key);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

async function setCachedValue(key, value, ttlSeconds) {
  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds
  });
}

module.exports = {
  connectRedis,
  buildCacheKey,
  getCachedValue,
  setCachedValue
};