import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  person,
  movieCredits,
  tvCredits,
  externalIds,
  reviews
} from "../netlify/functions/lib/tmdb.mjs";

import { fetchAwards } from "../netlify/functions/lib/wikidata.mjs";
import {
  compute,
  reviewMovies,
  validCredits
} from "../netlify/functions/lib/scoring.mjs";
import { qualityContext } from "../netlify/functions/lib/actor.mjs";

import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.env"
  )
});

const names = [
  "James Stewart", "Leonardo DiCaprio", "Robert Downey Jr.", "Brad Pitt", "Tom Hanks",
  "Robert De Niro", "Emma Stone", "Denzel Washington", "Al Pacino", "Morgan Freeman",
  "Ryan Gosling", "Jack Nicholson", "Humphrey Bogart", "Audrey Hepburn", "Timothée Chalamet",
  "Jodie Foster", "Cate Blanchett", "Frances McDormand", "Katharine Hepburn", "Laurence Olivier",
  "Natalie Portman", "Anthony Hopkins", "Joaquin Phoenix", "Javier Bardem", "Samuel L. Jackson",
  "Nicole Kidman", "Daniel Day-Lewis", "Cillian Murphy", "Meryl Streep", "Christian Bale",
  "Tom Cruise", "Michelle Yeoh", "Ralph Fiennes", "Cary Grant", "Jared Leto",
  "Margot Robbie", "Charlize Theron", "Mikey Madison", "Helen Mirren", "Gary Oldman",
  "Viola Davis", "Scarlett Johansson", "Mahershala Ali", "Song Kang-ho", "John Travolta",
  "Julianne Moore", "Gene Kelly", "Pedro Pascal", "Florence Pugh", "Marilyn Monroe",
  "Adam Sandler", "Keanu Reeves", "Chris Evans", "Robert Pattinson", "Christopher Walken",
  "David Corenswet", "Henry Cavill", "Marlon Brando", "Donald O'Connor", "Willem Dafoe",
  "Andrew Garfield", "Christoph Waltz", "Hugh Jackman", "Tom Hardy", "Colin Firth",
  "Taron Egerton", "Sam Rockwell", "John Malkovich", "Steve Buscemi", "Daniel Craig",
  "Clint Eastwood", "Heath Ledger", "Bryan Cranston", "Edward Norton", "Jake Gyllenhaal",
  "Matthew McConaughey", "Matt Damon", "Michael Caine", "Harrison Ford", "Kurt Russell",
  "Uma Thurman", "Harvey Keitel", "Tim Roth", "J.K. Simmons", "Nicolas Cage",
  "Johnny Depp", "Robin Williams", "Jim Carrey", "Santiago Segura", "Charlie Chaplin",
  "Milly Alcock", "Paul Newman", "Jack Lemmon", "Emma Watson", "Margaret Qualley",
  "Amanda Seyfried", "Anya Taylor-Joy", "Sadie Sink", "Jenna Ortega", "Mads Mikkelsen"
];

// Configuración
const CONCURRENCY = 3;
const REVIEWS_CONCURRENCY = 4;
const BAR_SIZE = 30;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function drawProgress(completed, total, successful, failed, startTime) {
  const percent = total === 0 ? 100 : (completed / total) * 100;
  const filled = Math.round((percent / 100) * BAR_SIZE);

  const bar =
    "█".repeat(filled) +
    "░".repeat(BAR_SIZE - filled);

  const elapsed = (Date.now() - startTime) / 1000;
  const avg = completed > 0 ? elapsed / completed : 0;
  const remaining = avg * (total - completed);

  process.stdout.write(
    `\r[${bar}] ${percent.toFixed(1)}% | ` +
    `${completed}/${total} | ` +
    `OK: ${successful} | Errores: ${failed} | ` +
    `Transcurrido: ${formatTime(elapsed)} | ` +
    `ETA: ${formatTime(remaining)}   `
  );
}

async function searchPerson(name) {
  const url = new URL("https://api.themoviedb.org/3/search/person");
  const key = process.env.TMDB_API_KEY;

  const headers = {};

  if (key?.split(".").length === 3) {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key || "");
  }

  url.searchParams.set("query", name);
  url.searchParams.set("include_adult", "false");

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`TMDb search failed: ${response.status}`);
  }

  const data = await response.json();

  return (
    data.results?.find(
      (item) => item.known_for_department === "Acting"
    ) || data.results?.[0]
  );
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index++;

      if (current >= items.length) return;

      output[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )
  );

  return output;
}

async function buildOne(name) {
  try {
    const search = await searchPerson(name);

    if (!search) {
      throw new Error("Actor not found on TMDB");
    }

    const [personData, credits, tv, external] = await Promise.all([
      person(search.id),
      movieCredits(search.id),
      tvCredits(search.id),
      externalIds(search.id)
    ]);

    const valid = validCredits(credits);
    const selectedMovies = reviewMovies(valid);

    // Reviews limitadas para evitar demasiadas peticiones simultáneas
    const [awards, reviewsByMovie, qualityOptions] = await Promise.all([
      fetchAwards(external.wikidata_id, {
        name: personData.name,
        birth: personData.birthday
      }),

      mapWithConcurrency(
        selectedMovies,
        REVIEWS_CONCURRENCY,
        (movie) => reviews(movie.id)
      ),

      qualityContext(search.id, credits, tv)
    ]);

    return compute(
      personData,
      credits,
      awards,
      reviewsByMovie,
      selectedMovies,
      qualityOptions
    );

  } catch (error) {
    console.error(`\n[ERROR] ${name}: ${error.message}`);
    return null;
  }
}

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY is required to generate the seed.");
  process.exit(1);
}

// Ejecución con barra de progreso
const startTime = Date.now();

let completed = 0;
let successful = 0;
let failed = 0;

console.log(`\nGenerating actor seed: ${names.length} actors\n`);

const actors = await mapWithConcurrency(
  names,
  CONCURRENCY,
  async (name) => {
    const result = await buildOne(name);

    completed++;

    if (result) successful++;
    else failed++;

    drawProgress(
      completed,
      names.length,
      successful,
      failed,
      startTime
    );

    return result;
  }
);

process.stdout.write("\n\n");

// Ordenar por puntuación
const seed = actors
  .filter(Boolean)
  .sort((a, b) => b.score - a.score);

// Exportar
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

const output = path.resolve(
  scriptDirectory,
  "../public/seed-actors.json"
);

await fs.mkdir(path.dirname(output), { recursive: true });

await fs.writeFile(
  output,
  JSON.stringify(seed, null, 2)
);

const elapsed = (Date.now() - startTime) / 1000;

console.log("----------------------------------------");
console.log("           SEED GENERATION");
console.log("----------------------------------------");
console.log(`Total actors: ${names.length}`);
console.log(`Successful:   ${successful}`);
console.log(`Failed:       ${failed}`);
console.log(`Saved:        ${seed.length}`);
console.log(`Time:         ${formatTime(elapsed)}`);
console.log(`Output:       ${output}`);
console.log("----------------------------------------\n");