import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { curatedDirectorIds, buildDirector } from "../netlify/functions/lib/director.mjs";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const CONCURRENCY = 2;
const BAR_SIZE = 30;
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

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function drawProgress(completed, total, successful, failed, startTime) {
  const percent = total === 0 ? 100 : (completed / total) * 100;
  const filled = Math.round((percent / 100) * BAR_SIZE);
  const bar = "█".repeat(filled) + "░".repeat(BAR_SIZE - filled);
  const elapsed = (Date.now() - startTime) / 1000;
  const avg = completed > 0 ? elapsed / completed : 0;
  const remaining = avg * (total - completed);
  process.stdout.write(
    `\r[${bar}] ${percent.toFixed(1)}% | ${completed}/${total} | ` +
    `OK: ${successful} | Errores: ${failed} | ` +
    `Transcurrido: ${formatTime(elapsed)} | ETA: ${formatTime(remaining)}   `
  );
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

let existingById = new Map();
try {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const existingOutput = path.resolve(scriptDirectory, "../public/seed-directors.json");
  const existing = JSON.parse(await fs.readFile(existingOutput, "utf8"));
  existingById = new Map(existing.map((director) => [director.id, director]));
} catch {}

const startTime = Date.now();
let completed = 0;
let successful = 0;
let failed = 0;
const built = await mapWithConcurrency(directors, CONCURRENCY, async (director) => {
  try {
    const result = await buildDirector(director.id);
    const valid = result.valid_work_count >= 3 ? result : null;
    completed++;
    if (valid) successful++;
    else failed++;
    drawProgress(completed, directors.length, successful, failed, startTime);
    return valid || existingById.get(director.id) || null;
  } catch (error) {
    completed++;
    failed++;
    console.error(`\n[ERROR] ${director.name}: ${error.message}`);
    drawProgress(completed, directors.length, successful, failed, startTime);
    return existingById.get(director.id) || null;
  }
});

const seed = built
  .filter(Boolean)
  .filter((director) => director.score > 0)
  .sort((a, b) => b.score - a.score);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(scriptDirectory, "../public/seed-directors.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(seed, null, 2));
process.stdout.write("\n\n");
const elapsed = (Date.now() - startTime) / 1000;
console.log("----------------------------------------");
console.log("        DIRECTOR SEED GENERATION");
console.log("----------------------------------------");
console.log(`Total directors: ${directors.length}`);
console.log(`Successful:      ${successful}`);
console.log(`Failed:          ${failed}`);
console.log(`Saved:           ${seed.length}`);
console.log(`Time:            ${formatTime(elapsed)}`);
console.log(`Output:          ${output}`);
console.log("----------------------------------------\n");
