import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { buildActor } from "../netlify/functions/lib/actor.mjs";
import { buildDirector } from "../netlify/functions/lib/director.mjs";
import { SCORING_CONFIG } from "../netlify/functions/lib/scoring-config.mjs";

dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.env"
  )
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const actorsPath = path.resolve(__dirname, "../public/seed-actors.json");
const directorsPath = path.resolve(__dirname, "../public/seed-directors.json");

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY is required to rebuild the seeds.");
  process.exit(1);
}

const probeUrl = new URL("https://api.themoviedb.org/3/person/525");
const probeHeaders = {};
if (process.env.TMDB_API_KEY.split(".").length === 3) {
  probeHeaders.Authorization = `Bearer ${process.env.TMDB_API_KEY}`;
} else {
  probeUrl.searchParams.set("api_key", process.env.TMDB_API_KEY);
}
const probe = await fetch(probeUrl, { headers: probeHeaders });
if (!probe.ok) {
  console.error(`TMDb authentication failed (${probe.status}). Use a valid API key or Bearer token in .env.`);
  process.exit(1);
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

async function retry(fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function rebuildActors() {
  console.log("\n=== Rebuilding Actors Seed ===");
  const raw = await fs.readFile(actorsPath, "utf8");
  const existingActors = JSON.parse(raw);
  console.log(`Loaded ${existingActors.length} actors from ${actorsPath}`);

  let done = 0;
  const rebuilt = await mapWithConcurrency(existingActors, 5, async (actor) => {
    try {
      const result = await retry(() => buildActor(actor.id));
      done++;
      if (done % 10 === 0 || done === existingActors.length) {
        console.log(`Actors progress: ${done}/${existingActors.length}`);
      }
      return result;
    } catch (err) {
      console.warn(`[WARN] Failed to rebuild actor ${actor.name} (${actor.id}): ${err.message}. Using fallback calculation.`);
      // Fallback calculation using current pillars with 6% brake & micro awards
      const baseKeys = ["quality", "versatility", "sentiment", "commercial"];
      const baseAvailable = baseKeys.filter((k) => actor.pillars[k] !== null);
      const baseWeightTotal = baseAvailable.reduce((sum, k) => sum + SCORING_CONFIG.WEIGHTS[k], 0);
      const baseScore = baseWeightTotal ? baseAvailable.reduce((sum, k) => sum + actor.pillars[k] * SCORING_CONFIG.WEIGHTS[k] / baseWeightTotal, 0) : 0;
      const otherAwards = (actor.ignored_awards || []).filter((aw) => aw.reason !== "Popularity award");
      const microPoints = Math.min(10, otherAwards.length * 0.5);
      const awardsValue = Math.min(100, (actor.pillars.awards ?? 0) + microPoints);
      let score = awardsValue >= baseScore
        ? (0.70 * baseScore) + (0.30 * awardsValue)
        : (0.94 * baseScore) + (0.06 * awardsValue);
      return {
        ...actor,
        score,
        scoring_version: "22.0",
        pillars: {
          ...actor.pillars,
          awards: awardsValue
        }
      };
    }
  });

  const sortedActors = rebuilt
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  await fs.writeFile(actorsPath, JSON.stringify(sortedActors, null, 2));
  console.log(`Saved ${sortedActors.length} actors to ${actorsPath}. Top actor: ${sortedActors[0].name} (${sortedActors[0].score})`);
}

async function rebuildDirectors() {
  console.log("\n=== Rebuilding Directors Seed ===");
  const raw = await fs.readFile(directorsPath, "utf8");
  const existingDirectors = JSON.parse(raw);
  const benchmarkRaw = await fs.readFile(path.resolve(__dirname, "../directors.json"), "utf8");
  const benchmark = JSON.parse(benchmarkRaw).filter((item) => item.tmdb_id);
  if (!benchmark.some((item) => item.tmdb_id === 525)) {
    benchmark.push({ name: "Christopher Nolan", tmdb_id: 525 });
  }
  const existingById = new Map(existingDirectors.map((director) => [director.id, director]));
  const benchmarkById = new Map(benchmark.map((director) => [director.tmdb_id, director]));

  const items = [...new Map([
    ...existingDirectors.map((director) => [director.id, { id: director.id, name: director.name }]),
    ...benchmark.map((director) => [director.tmdb_id, { id: director.tmdb_id, name: director.name }])
  ]).values()];

  let done = 0;
  const rebuilt = await mapWithConcurrency(items, 3, async (item) => {
    try {
      const result = await retry(() => buildDirector(item.id));
      done++;
      if (done % 10 === 0 || done === items.length) {
        console.log(`Directors progress: ${done}/${items.length}`);
      }
      return result.valid_work_count >= 3 ? result : null;
    } catch (err) {
      console.warn(`[WARN] Failed to rebuild director ${item.name} (${item.id}): ${err.message}.`);
      return existingById.get(item.id) || null;
    }
  });

  const sortedDirectors = rebuilt
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  await fs.writeFile(directorsPath, JSON.stringify(sortedDirectors, null, 2));
  console.log(`Saved ${sortedDirectors.length} directors to ${directorsPath}`);
  console.log("Benchmark sync:", benchmarkById.has(525) ? "Christopher Nolan (525) included" : "Christopher Nolan missing");
}

async function main() {
  const start = Date.now();
  await rebuildActors();
  await rebuildDirectors();
  const actorSeed = JSON.parse(await fs.readFile(actorsPath, "utf8"))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const directorSeed = JSON.parse(await fs.readFile(directorsPath, "utf8"))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  console.log("\n=== Top 10 Actors (Actors v22.0) ===");
  actorSeed.forEach((actor, index) => console.log(`${index + 1}. ${actor.name}: ${Number(actor.score).toFixed(2)}`));
  console.log("\n=== Top 10 Directors (Directors v2.0) ===");
  directorSeed.forEach((director, index) => console.log(`${index + 1}. ${director.name}: ${Number(director.score).toFixed(2)}`));
  console.log(`\nRebuild finished in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

