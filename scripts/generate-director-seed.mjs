import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { curatedDirectorIds, buildDirector } from "../netlify/functions/lib/director.mjs";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const CONCURRENCY = 3;
const directors = curatedDirectorIds();

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      output[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY is not available; writing curated director placeholders.");
}

console.log(`Generating director seed: ${directors.length} directors`);
const built = process.env.TMDB_API_KEY
  ? await mapWithConcurrency(directors, CONCURRENCY, async (director) => {
      try {
        const result = await buildDirector(director.id);
        return result.valid_work_count >= 3 ? result : null;
      } catch (error) {
        console.error(`\n[ERROR] ${director.name}: ${error.message}`);
        return null;
      }
    })
  : [];

const seed = built
  .filter(Boolean)
  .filter((director) => director.score > 0)
  .sort((a, b) => b.score - a.score);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(scriptDirectory, "../public/seed-directors.json");
await fs.writeFile(output, JSON.stringify(seed, null, 2));
console.log(`Saved ${seed.length} directors to ${output}`);
