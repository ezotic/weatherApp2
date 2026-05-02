const express = require("express");
const weatherRoutes = require("./routes/weather");
const { connectRedis } = require("./services/cache");

const PORT = Number(process.env.PORT || 3000);

async function start() {
  const app = express();

  app.use(express.json());
  app.use("/api", weatherRoutes);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Weather API listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});