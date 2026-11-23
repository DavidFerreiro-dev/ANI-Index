const SPARQL_URL = "https://query.wikidata.org/sparql";

async function sparql(query, timeoutMs = 8000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": "ActorMeritRanker/1.0 (contact@example.com)"
          },
          signal: controller.signal
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { ok: true, bindings: data.results?.bindings || [] };
    } catch (error) {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      else return { ok: false, bindings: [], error: error.name === "AbortError" ? "timeout" : error.message };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, bindings: [], error: "unavailable" };
}

async function searchWikidataActor(name, birthDate) {
  if (!name) return null;
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  try {
    const response = await fetch(url, { headers: { "User-Agent": "ActorMeritRanker/1.0 (contact@example.com)" } });
    if (!response.ok) return null;
    const data = await response.json();
    for (const candidate of data.search || []) {
      const qid = candidate.id;
      const validation = await sparql(`SELECT ?birth ?occupation WHERE {
        OPTIONAL { wd:${qid} wdt:P569 ?birth }
        OPTIONAL { wd:${qid} wdt:P106 ?occupation }
      }`);
      if (!validation.ok) continue;
      const actor = validation.bindings.some((row) =>
        row.occupation?.value === "http://www.wikidata.org/entity/Q33999"
      );
      const birth = validation.bindings.find((row) => row.birth)?.birth?.value;
      if (actor && (!birthDate || !birth || birth.slice(0, 10) === birthDate)) return qid;
      if (actor && birth && birthDate && birth.slice(0, 10) === birthDate) return qid;
    }
  } catch {}
  return null;
}

export async function fetchAwards(wikidataId, person = {}) {
  let qid = wikidataId;
  if (!qid) qid = await searchWikidataActor(person.name, person.birth);
  if (!qid) return { available: false, status: "unavailable", awards: [] };

  const directP166 = await sparql(`SELECT ?award ?awardLabel ?year ?work ?workLabel WHERE {
    wd:${qid} p:P166 ?statement . ?statement ps:P166 ?award .
    BIND("won" AS ?kind)
    OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?statement pq:P805 ?edition . OPTIONAL { ?edition wdt:P585 ?editionDate } }
    BIND(COALESCE(?year, YEAR(?editionDate)) AS ?resolvedYear)
    OPTIONAL { ?statement pq:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  const directP1411 = await sparql(`SELECT ?award ?awardLabel ?year ?work ?workLabel WHERE {
    wd:${qid} p:P1411 ?statement . ?statement ps:P1411 ?award .
    BIND("nominated" AS ?kind)
    OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?statement pq:P805 ?edition . OPTIONAL { ?edition wdt:P585 ?editionDate } }
    BIND(COALESCE(?year, YEAR(?editionDate)) AS ?resolvedYear)
    OPTIONAL { ?statement pq:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);
  const inverseP1346 = await sparql(`SELECT ?award ?awardLabel ?year ?work ?workLabel WHERE {
    ?award wdt:P1346 wd:${qid} .
    OPTIONAL { ?award wdt:P585 ?date . BIND(YEAR(?date) AS ?year) }
    OPTIONAL { ?award wdt:P805 ?edition . OPTIONAL { ?edition wdt:P585 ?editionDate } }
    BIND(COALESCE(?year, YEAR(?editionDate)) AS ?resolvedYear)
    OPTIONAL { ?award wdt:P1686 ?work }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`);

  if (!directP166.ok || !directP1411.ok || !inverseP1346.ok) {
    return { available: false, status: "unavailable", awards: [] };
  }
  const awards = [
    ...directP166.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "won",
      year: row.resolvedYear?.value || row.year?.value || "", work: row.workLabel?.value || "",
      awardQid: row.award?.value?.match(/Q\d+$/)?.[0] || "",
      workQid: row.work?.value?.match(/Q\d+$/)?.[0] || ""
    })),
    ...directP1411.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "nominated",
      year: row.resolvedYear?.value || row.year?.value || "", work: row.workLabel?.value || "",
      awardQid: row.award?.value?.match(/Q\d+$/)?.[0] || "",
      workQid: row.work?.value?.match(/Q\d+$/)?.[0] || ""
    })),
    ...inverseP1346.bindings.map((row) => ({
      label: row.awardLabel?.value || "", kind: "won",
      year: row.resolvedYear?.value || row.year?.value || "", work: row.workLabel?.value || "",
      awardQid: row.award?.value?.match(/Q\d+$/)?.[0] || "",
      workQid: row.work?.value?.match(/Q\d+$/)?.[0] || ""
    }))
  ].filter((award) => award.label);
  return { available: true, status: "available", awards };
}
