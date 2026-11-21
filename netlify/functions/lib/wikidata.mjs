export async function fetchAwards(wikidataId) {
  if (!wikidataId) return { available: false, awards: [] };
  const query = `SELECT ?awardLabel ?kind ?year ?workLabel WHERE {
    {
      wd:${wikidataId} p:P166 ?statement .
      ?statement ps:P166 ?award .
      BIND("won" AS ?kind)
      OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
      OPTIONAL { ?statement pq:P1686 ?work }
    }
    UNION
    {
      wd:${wikidataId} p:P1411 ?statement .
      ?statement ps:P1411 ?award .
      BIND("nominated" AS ?kind)
      OPTIONAL { ?statement pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
      OPTIONAL { ?statement pq:P1686 ?work }
    }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
      const response = await fetch(url, {
        headers: {
          "Accept": "application/sparql-results+json",
          "User-Agent": "ActorMeritRanker/1.0 (contact@example.com)"
        },
        signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        const awards = (data.results?.bindings || []).map((row) => ({
          label: row.awardLabel?.value || "",
          kind: row.kind?.value === "won" ? "won" : "nominated",
          year: row.year?.value ? String(row.year.value) : "",
          work: row.workLabel?.value || ""
        })).filter((award) => award.label);
        return { available: true, awards };
      }
    } catch {}
    finally { clearTimeout(timer); }
  }
  return { available: false, awards: [] };
}
