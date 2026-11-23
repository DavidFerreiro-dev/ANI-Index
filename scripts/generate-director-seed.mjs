import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { curatedDirectorIds, buildDirector } from "../netlify/functions/lib/director.mjs";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const CONCURRENCY = 3;
const directors = (() => {
  const benchmark = curatedDirectorIds();
  const merged = new Map(benchmark.map((director) => [director.id, director]));
  merged.set(525, { id: 525, name: "Christopher Nolan" });
  return [...merged.values()];
})();

if (!directors.some((director) => director.id === 525)) {
  throw new Error("Christopher Nolan (TMDb 525) is missing from the director benchmark list");
}

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
  console.error("TMDB_API_KEY is not set. Add a valid key to .env before generating seeds.");
  process.exit(1);
}

const tmdbHeaders = process.env.TMDB_API_KEY.split(".").length === 3
  ? { Authorization: `Bearer ${process.env.TMDB_API_KEY}` }
  : {};
const tmdbUrl = new URL("https://api.themoviedb.org/3/person/525");
if (!tmdbHeaders.Authorization) tmdbUrl.searchParams.set("api_key", process.env.TMDB_API_KEY);
const tmdbProbe = await fetch(tmdbUrl, { headers: tmdbHeaders });
if (!tmdbProbe.ok) {
  console.error(`TMDb authentication failed (${tmdbProbe.status}). Use a valid API key or Bearer token in .env.`);
  process.exit(1);
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
