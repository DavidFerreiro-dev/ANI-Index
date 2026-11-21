import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { person, movieCredits, tvCredits, externalIds, reviews } from "../netlify/functions/lib/tmdb.mjs";
import { fetchAwards } from "../netlify/functions/lib/wikidata.mjs";
import { compute, reviewMovies, validCredits } from "../netlify/functions/lib/scoring.mjs";
import { qualityContext } from "../netlify/functions/lib/actor.mjs";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const names = [
  "Daniel Day-Lewis", "Meryl Streep", "Ryan Gosling", "Robert Pattinson", "Mikey Madison",
  "Cillian Murphy", "Emma Stone", "Brad Pitt", "Florence Pugh", "Zendaya",
  "Denzel Washington", "Frances McDormand", "Leonardo DiCaprio", "Cate Blanchett",
  "Viola Davis", "Mahershala Ali", "Michelle Yeoh", "Tilda Swinton", "Christian Bale",
  "Julianne Moore", "Joaquin Phoenix", "Amy Adams", "Ralph Fiennes", "Naomi Watts",
  "Pedro Pascal", "Song Kang-ho", "Penelope Cruz", "Javier Bardem",
  "John Travolta", "Samuel L. Jackson", "Al Pacino", "Robert De Niro",
  "Jack Nicholson", "Tom Hanks", "Morgan Freeman", "Sidney Poitier",
  "Katharine Hepburn", "Audrey Hepburn", "Laurence Olivier", "Gene Kelly",
  "Marilyn Monroe", "James Stewart", "Humphrey Bogart", "Cary Grant",
  "Saoirse Ronan", "Timothée Chalamet", "Adam Sandler", "Margot Robbie",
  "Scarlett Johansson", "Natalie Portman", "Nicole Kidman", "Charlize Theron",
  "Anthony Hopkins", "Helen Mirren", "Gary Oldman", "Jodie Foster",
  "Robert Downey Jr.", "Chris Evans", "Tom Cruise", "Keanu Reeves",
  "Nicole Beharie", "Lupita Nyong'o", "Viola Davis", "Jeffrey Wright",
  "Mahershala Ali", "Joaquin Phoenix", "Amy Adams", "Sally Hawkins",
];

async function searchPerson(name) {
  const url = new URL("https://api.themoviedb.org/3/search/person");
  const key = process.env.TMDB_API_KEY;
  const headers = {};
  if (key?.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key || "");
  url.searchParams.set("query", name);
  url.searchParams.set("include_adult", "false");
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`TMDb search failed for ${name}: ${response.status}`);
  const data = await response.json();
  return data.results?.find((item) => item.known_for_department === "Acting") || data.results?.[0];
}

async function buildOne(name) {
  const search = await searchPerson(name);
  if (!search) return null;
  try {
    const [personData, credits, tv, external] = await Promise.all([
      person(search.id),
      movieCredits(search.id),
      tvCredits(search.id),
      externalIds(search.id)
    ]);
    const valid = validCredits(credits);
    const selectedMovies = reviewMovies(valid);
    const [awards, reviewsByMovie, qualityOptions] = await Promise.all([
      fetchAwards(external.wikidata_id),
      Promise.all(selectedMovies.map((movie) => reviews(movie.id))),
      qualityContext(search.id, credits, tv)
    ]);
    return compute(personData, credits, awards, reviewsByMovie, selectedMovies, qualityOptions);
  } catch (error) {
    console.error(`Skipped ${name}: ${error.message}`);
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = [];
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
  console.error("TMDB_API_KEY is required to generate the seed.");
  process.exit(1);
}

const actors = await mapWithConcurrency(names, 1, buildOne);
const seed = actors.filter(Boolean).sort((a, b) => b.score - a.score);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(scriptDirectory, "../public/seed-actors.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(seed, null, 2));
console.log(`Wrote ${seed.length} actors to ${output}`);
