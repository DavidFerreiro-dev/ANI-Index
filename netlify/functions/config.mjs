import { SCORING_CONFIG } from "./lib/scoring-config.mjs";

export const handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(SCORING_CONFIG)
});
