import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(scriptDirectory, "../directors.json");
const reportPath = path.resolve(scriptDirectory, "../directors-unresolved.json");

if (!process.env.TMDB_API_KEY) {
  const missingDirectors = JSON.parse(await fs.readFile(dataPath, "utf8"));
  await fs.writeFile(reportPath, JSON.stringify(
    missingDirectors.map((director) => ({ name: director.name, reason: "TMDB_API_KEY is required" })),
    null,
    2
  ));
  console.error("TMDB_API_KEY is required.");
  process.exit(1);
}

const directors = JSON.parse(await fs.readFile(dataPath, "utf8"));
const unresolved = [];
const key = process.env.TMDB_API_KEY;

async function resolveDirector(director) {
  if (director.tmdb_id) return director;
  const url = new URL("https://api.themoviedb.org/3/search/person");
  const headers = {};
  if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  url.searchParams.set("query", director.name);
  url.searchParams.set("include_adult", "false");
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`TMDb returned ${response.status}`);
    const data = await response.json();
    const exact = (data.results || []).filter((person) =>
      person.known_for_department === "Directing" &&
      person.name.toLowerCase() === director.name.toLowerCase());
    if (exact.length === 1) return { ...director, tmdb_id: exact[0].id };
    unresolved.push({
      name: director.name,
      reason: exact.length === 0 ? "No exact Directing match" : "Multiple exact matches"
    });
  } catch (error) {
    unresolved.push({ name: director.name, reason: error.message });
  }
  return director;
}

async function mapConcurrency(items, limit, mapper) {
  let index = 0;
  const output = new Array(items.length);
  async function worker() {
    while (index < items.length) {
      const current = index++;
      output[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

const resolved = await mapConcurrency(directors, 4, resolveDirector);
await fs.writeFile(dataPath, JSON.stringify(resolved, null, 2));
await fs.writeFile(reportPath, JSON.stringify(unresolved, null, 2));
console.log(`Resolved ${resolved.filter((item) => item.tmdb_id).length}/${resolved.length} directors.`);
console.log(`Unresolved report: ${reportPath}`);
