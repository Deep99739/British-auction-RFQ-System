import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig() {
  const port = Number(process.env.PORT || 4000);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive whole number.");
  }

  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port,
    databaseUrl: required("DATABASE_URL"),
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || null,
    databaseSsl: process.env.DATABASE_SSL === "true",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  };
}
