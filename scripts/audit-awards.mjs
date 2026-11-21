import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { externalIds } from "../netlify/functions/lib/tmdb.mjs";
import { awardsScore } from "../netlify/functions/lib/scoring.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, "../.env") });

const names = [
  "Javier Bardem",
  "Daniel Day-Lewis",
  "Meryl Streep",
  "Mikey Madison",
  "Cillian Murphy",
  "Brad Pitt",
  "Frances McDormand",
  "Robert Pattinson"
];

const headers = {
  Accept: "application/sparql-results+json",
  "User-Agent": "ActorMeritRanker/1.0 (contact@example.com)"
};

async function tmdbSearch(name) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is required");
  const url = new URL("https://api.themoviedb.org/3/search/person");
  const tmdbHeaders = {};
  if (key.split(".").length === 3) tmdbHeaders.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  url.searchParams.set("query", name);
  url.searchParams.set("include_adult", "false");
  const response = await fetch(url, { headers: tmdbHeaders });
  if (!response.ok) throw new Error(`TMDb search failed: ${response.status}`);
  const data = await response.json();
  return data.results?.find((person) =>
    person.name.toLowerCase() === name.toLowerCase() &&
    person.known_for_department === "Acting"
  ) || data.results?.find((person) => person.known_for_department === "Acting") || null;
}

async function sparqlQuery(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { bindings: data.results?.bindings || [], error: null };
    } catch (error) {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      else return { bindings: [], error: error.name === "AbortError" ? "timeout" : error.message };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function wikidataSearch(name) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  const response = await fetch(url, { headers: { "User-Agent": "ActorMeritRanker/1.0" } });
  if (!response.ok) return { qid: null, error: `HTTP ${response.status}` };
  const data = await response.json();
  if (!data.search?.length) return { qid: null, error: "no search results" };
  for (const candidate of data.search) {
    const qid = candidate.id;
    const query = `SELECT ?birth ?occupation WHERE {
      OPTIONAL { wd:${qid} wdt:P569 ?birth }
      OPTIONAL { wd:${qid} wdt:P106 ?occupation }
    }`;
    const result = await sparqlQuery(query);
    if (result.error) continue;
    const birth = result.bindings.find((row) => row.birth)?.birth?.value;
    const occupations = result.bindings.map((row) => row.occupation?.value).filter(Boolean);
    const hasActorOccupation = occupations.some((uri) => [
      "http://www.wikidata.org/entity/Q33999",
      "http://www.wikidata.org/entity/Q10800557",
      "http://www.wikidata.org/entity/Q2259451"
    ].includes(uri));
    if (hasActorOccupation) return { qid, birth: birth || null, error: null };
  }
  return { qid: null, error: "no candidate with actor occupation P106" };
}

async function diagnose(name) {
  const tmdbPerson = await tmdbSearch(name);
  let wikidataId = tmdbPerson ? (await externalIds(tmdbPerson.id)).wikidata_id : null;
  let fallback = null;
  if (!wikidataId) fallback = await wikidataSearch(name);
  const qid = wikidataId || fallback?.qid;
  if (!qid) {
    return { name, tmdbId: tmdbPerson?.id || null, wikidataId: null, cause: fallback?.error || "missing external id" };
  }
  const p166 = await sparqlQuery(`SELECT ?awardLabel ?kind ?year ?workLabel WHERE {
    wd:${qid} p:P166 ?statement . ?statement ps:P166 ?award .
    BIND("won" AS ?kind)
    OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?statement pq:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  const p1411 = await sparqlQuery(`SELECT ?awardLabel ?kind ?year ?workLabel WHERE {
    wd:${qid} p:P1411 ?statement . ?statement ps:P1411 ?award .
    BIND("nominated" AS ?kind)
    OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?statement pq:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  const p1346 = await sparqlQuery(`SELECT ?awardLabel ?year ?workLabel WHERE {
    ?award wdt:P1346 wd:${qid} .
    OPTIONAL { ?award wdt:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?award wdt:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  const awards = [
    ...p166.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "won",
      year: row.year?.value || "", work: row.workLabel?.value || ""
    })),
    ...p1411.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "nominated",
      year: row.year?.value || "", work: row.workLabel?.value || ""
    })),
    ...p1346.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "won",
      year: row.year?.value || "", work: row.workLabel?.value || ""
    }))
  ].filter((award) => award.label);
  const [, , counted, ignored] = awardsScore(awards);
  const ignoredCounts = new Map();
  for (const item of ignored) ignoredCounts.set(item.label, (ignoredCounts.get(item.label) || 0) + 1);
  const topIgnored = [...ignoredCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    name,
    tmdbId: tmdbPerson?.id || null,
    wikidataId: qid,
    p166: p166.bindings.length,
    p1411: p1411.bindings.length,
    p1346: p1346.bindings.length,
    errors: [p166.error, p1411.error, p1346.error].filter(Boolean),
    counted,
    ignored: ignored.length,
    topIgnored
  };
}

console.log("Wikidata awards diagnosis");
for (const name of names) {
  try {
    const result = await diagnose(name);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.log(JSON.stringify({ name, error: error.message }));
  }
}
