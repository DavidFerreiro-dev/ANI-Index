import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { person, movieCredits, tvCredits, externalIds, reviews } from "../netlify/functions/lib/tmdb.mjs";
import { fetchAwards } from "../netlify/functions/lib/wikidata.mjs";
import { compute, reviewMovies, validCredits } from "../netlify/functions/lib/scoring.mjs";
import { qualityContext } from "../netlify/functions/lib/actor.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../.env") });

const names = [
  "Daniel Day-Lewis", "Meryl Streep", "Ryan Gosling", "Robert Pattinson", "Mikey Madison",
  "Cillian Murphy", "Emma Stone", "Brad Pitt", "Florence Pugh", "Zendaya",
  "Denzel Washington", "Frances McDormand", "Leonardo DiCaprio", "Cate Blanchett",
  "Viola Davis", "Mahershala Ali", "Michelle Yeoh", "Tilda Swinton", "Christian Bale",
  "Julianne Moore", "Joaquin Phoenix", "Amy Adams", "Ralph Fiennes", "Naomi Watts",
  "Pedro Pascal", "Song Kang-ho", "Penelope Cruz", "Javier Bardem", "Jodie Foster", "Gary Oldman"
];

if (!process.env.TMDB_API_KEY) {
  console.error("TMDB_API_KEY is required.");
  process.exit(1);
}

async function search(name) {
  const url = new URL("https://api.themoviedb.org/3/search/person");
  const headers = {};
  if (process.env.TMDB_API_KEY.split(".").length === 3) {
    headers.Authorization = `Bearer ${process.env.TMDB_API_KEY}`;
  } else {
    url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  }
  url.searchParams.set("query", name);
  url.searchParams.set("include_adult", "false");
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  const data = await response.json();
  return data.results?.find((item) => item.known_for_department === "Acting") || null;
}

async function auditOne(name) {
  try {
    const found = await search(name);
    if (!found) return { name, error: "not found" };
    const [personData, credits, tv, external] = await Promise.all([
      person(found.id), movieCredits(found.id), tvCredits(found.id), externalIds(found.id)
    ]);
    const valid = validCredits(credits);
    const selected = reviewMovies(valid);
    const [awards, reviewResults, qualityOptions] = await Promise.all([
      fetchAwards(external.wikidata_id, { name: personData.name, birth: personData.birthday }),
      Promise.all(selected.map((movie) => reviews(movie.id))),
      qualityContext(found.id, credits, tv)
    ]);
    const result = compute(personData, credits, awards, reviewResults, selected, qualityOptions);
    return result;
  } catch (error) {
    return { name, error: error.message };
  }
}

async function mapConcurrency(items, limit, mapper) {
  const output = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      output[current] = await mapper(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

const actors = await mapConcurrency(names, 4, auditOne);
console.log("Actor Merit Ranker score audit");
console.log("Ranges below are common-sense estimates, not truths or pass/fail assertions.");
console.log("Suggested ranges: Daniel Day-Lewis/Meryl Streep 85–97; Mikey Madison 65–80; Robert Pattinson 50–70.");
console.log("");
console.log(["Actor", "Score", "Quality", "Awards", "Versatility", "Sentiment", "Commercial", "Lead films", "Saga films", "Director films", "Commercial counted", "Commercial excluded", "Commercial included", "Valid works", "Few works", "Recent Oscar", "Awards+", "Ignored", "Wikidata"].join(" | "));
console.log("-".repeat(155));
for (const actor of actors) {
  if (actor.error) {
    console.log([actor.name, "ERROR", "-", "-", "-", "-", "-", "-", "-", "-"].join(" | "));
    continue;
  }
  const examples = (actor.ignored_awards || []).slice(0, 3).map((item) => item.label).join("; ") || "-";
  console.log([
    actor.name,
    actor.score,
    actor.pillars.quality,
    actor.pillars.awards,
    actor.pillars.versatility,
    actor.pillars.sentiment ?? "omitted",
    actor.pillars.commercial ?? "omitted",
    actor.lead_movie_count ?? 0,
    actor.saga_movie_count ?? 0,
    actor.director_movie_count ?? 0,
    actor.commercial_movie_count ?? 0,
    actor.commercial_excluded ? `${actor.commercial_excluded.saga} saga / ${actor.commercial_excluded.revenue} revenue / ${actor.commercial_excluded.date} date` : "0",
    (actor.commercial_included_titles || []).slice(0, 3).join("; ") || "-",
    actor.valid_work_count ?? 0,
    actor.few_works ? "yes" : "no",
    actor.recent_oscar_won ? "yes" : "no",
    actor.award_count,
    `${actor.ignored_awards?.length || 0} (${examples})`,
    actor.awards_available ? "yes" : "missing"
  ].join(" | "));
}
