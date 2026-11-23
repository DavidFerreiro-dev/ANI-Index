import fs from "node:fs";
import path from "node:path";
import { person, personCrewCredits, externalIds, movieDetails, movieCrew } from "./tmdb.mjs";
import { fetchAwards } from "./wikidata.mjs";

const C = 6.5;
const m = 200;
const clamp = (value) => Math.max(0, Math.min(100, value));
const bayes = (movie) => {
  const votes = Number(movie.vote_count) || 0;
  const rating = Number(movie.vote_average) || 0;
  return (votes / (votes + m)) * rating + (m / (votes + m)) * C;
};

const genreGroups = [
  [28, 12], [80, 53, 9648], [878, 14], [10749, 18],
  [16], [10751], [35], [27], [10402], [36, 10752], [37], [99]
];

export function curatedDirectorIds() {
  try {
    const file = path.resolve(process.cwd(), "directors.json");
    return JSON.parse(fs.readFileSync(file, "utf8"))
      .filter((director) => director.tmdb_id)
      .map((director) => ({ id: director.tmdb_id, name: director.name }));
  } catch {
    return [];
  }
}

function normalizeAward(award) {
  return (award.label || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function directorAwardDeduplicate(awards) {
  const deduplicated = new Map();
  for (const award of awards) {
    const label = normalizeAward(award);
    const qid = award.awardQid || "";
    const work = (award.workQid || award.work || "").toLowerCase();
    const year = award.year || "";
    const identity = qid ? `qid:${qid}` : `label:${label}`;
    const key = year ? `${identity}|${year}|${work}` : `${identity}|${work}`;
    const existing = deduplicated.get(key);
    if (!existing || award.kind === "won") deduplicated.set(key, { ...award, label: award.label || "", kind: award.kind === "won" ? "won" : "nominated" });
  }
  return [...deduplicated.values()];
}

export function directorAwardsScore(awards) {
  const awardsByCategory = directorAwardDeduplicate(awards);
  const counted = [];
  const ignored = [];
  let points = 0;
  for (const award of awardsByCategory) {
    const label = normalizeAward(award);
    const valid =
      /\b(best|academy|palme|golden lion|golden bear|director|directing|picture|film|screenplay|writing)\b/.test(label) &&
      !/\b(short|documentary|song|score|editing|cinematography|popular|people's|teen|kids|mtv)\b/.test(label);
    if (!valid) {
      ignored.push({ ...award, reason: "Not a directing, film or writing award" });
      continue;
    }
    let tier = "B";
    if (/academy award|oscar|palme d.?or|golden lion|golden bear/.test(label)) tier = "S";
    else if (/bafta|golden globe|directors guild|dga|critics.? choice|césar|cesar|goya|cannes|venice|berlin/.test(label)) tier = "A";
    else if (!/independent spirit|gotham|bifa|british independent|national board|nyfcc|new york film critics|lafca|los angeles film critics|nsfc|national society|saturn|satellite/.test(label)) {
      ignored.push({ ...award, reason: "Award not in director tier map" });
      continue;
    }
    const role = /screenplay|writing|writer|written/.test(label) ? "Writing" : "Directing & Film";
    const won = award.kind === "won";
    const awardPoints = tier === "S" ? (won ? 25 : 9) : tier === "A" ? (won ? 12 : 5) : (won ? 7 : 3);
    points += awardPoints;
    counted.push({ label: award.label, role, tier, won: won ? 1 : 0, nominated: won ? 0 : 1 });
  }
  const score = clamp(Math.min(100, Math.log(1 + points) * 100 / Math.log(101)));
  return [score, counted, ignored];
}

export async function buildDirector(id) {
  const [personData, credits, external] = await Promise.all([
    person(id), personCrewCredits(id), externalIds(id)
  ]);
  const directedCredits = credits.filter((credit) => credit.job === "Director");
  const detailEntries = await Promise.all(directedCredits.map(async (credit) => {
    const [details, crew] = await Promise.all([movieDetails(credit.id), movieCrew(credit.id)]);
    if (!details) return null;
    return {
      ...details,
      crew,
      crew_order: credit.order,
      vote_count: details.vote_count ?? credit.vote_count ?? 0,
      vote_average: details.vote_average ?? credit.vote_average ?? 0
    };
  }));
  const valid = detailEntries.filter((movie) =>
    movie &&
    !movie.adult &&
    movie.video !== true &&
    movie.status === "Released" &&
    Number(movie.runtime) >= 60 &&
    !(movie.genres || []).some((genre) => genre.id === 99) &&
    (movie.release_date || "").length >= 10
  );

  const validWithBayes = valid.map((movie) => ({ ...movie, bayesian: bayes(movie) }));

  // 1. Peak / Techo (Top 4 películas): máximo 1 película por franquicia
  const peakColGroups = new Map();
  const peakNonCol = [];
  for (const movie of validWithBayes) {
    const colId = movie.belongs_to_collection?.id;
    if (colId) {
      if (!peakColGroups.has(colId)) peakColGroups.set(colId, []);
      peakColGroups.get(colId).push(movie);
    } else {
      peakNonCol.push(movie);
    }
  }
  const peakEligible = [...peakNonCol];
  for (const [colId, group] of peakColGroups) {
    group.sort((a, b) => b.bayesian - a.bayesian);
    peakEligible.push(group[0]);
  }
  peakEligible.sort((a, b) => b.bayesian - a.bayesian);
  const peak = peakEligible.slice(0, 4);
  const peakScore = peak.length ? peak.reduce((sum, movie) => sum + movie.bayesian, 0) / peak.length : 0;

  // 2. Filmografía general: máximo 2 por franquicia
  const genColGroups = new Map();
  const genNonCol = [];
  for (const movie of validWithBayes) {
    const colId = movie.belongs_to_collection?.id;
    if (colId) {
      if (!genColGroups.has(colId)) genColGroups.set(colId, []);
      genColGroups.get(colId).push(movie);
    } else {
      genNonCol.push(movie);
    }
  }
  const genEligible = [...genNonCol];
  for (const [colId, group] of genColGroups) {
    group.sort((a, b) => b.bayesian - a.bayesian);
    genEligible.push(...group.slice(0, 2));
  }
  genEligible.sort((a, b) => b.bayesian - a.bayesian);

  // 3. Consistencia justa para carreras largas: Top 70% de sus largometrajes válidos (mínimo 3)
  const consistencyCount = Math.max(3, Math.ceil(genEligible.length * 0.70));
  const consistencyMovies = genEligible.slice(0, consistencyCount);
  const consistency = consistencyMovies.length
    ? consistencyMovies.reduce((sum, movie) => sum + movie.bayesian, 0) / consistencyMovies.length
    : 0;

  // 4. Conversión ajustada (divisor 2.35) para que las notas máximas ronden 93-95
  const peakNormalized = clamp(((peakScore - 6.0) / 2.35) * 100);
  const consistencyNormalized = clamp(((consistency - 6.0) / 2.35) * 100);
  const quality = clamp((0.60 * peakNormalized) + (0.40 * consistencyNormalized));

  const commercial = valid
    .filter((movie) => Number(movie.revenue) > 0)
    .filter((movie) => Number(movie.release_date?.slice(0, 4)) >= 1980)
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const collectionById = new Map();
  for (const movie of commercial) {
    const collectionId = movie.belongs_to_collection?.id;
    if (!collectionId) continue;
    if (!collectionById.has(collectionId)) collectionById.set(collectionId, movie);
  }
  const standalone = commercial.filter((movie) => !movie.belongs_to_collection?.id);
  const representatives = [...standalone, ...collectionById.values()];
  const topCommercial = [...representatives]
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 3);
  let commercialScore = 70;
  if (topCommercial.length >= 2) {
    const scores = topCommercial.map((movie) => {
      const revenue = Number(movie.revenue);
      const gross = clamp(((Math.log10(revenue) - 7) / 2) * 100);
      const budget = Number(movie.budget);
      let score = gross;
      if (budget > 0) {
        const roi = clamp((Math.log10(revenue / budget) / 1) * 100);
        score = clamp((0.70 * gross) + (0.30 * roi));
      }
      if (!movie.belongs_to_collection?.id) score = clamp(score * 1.10);
      return score;
    });
    commercialScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  const genreGroupsFound = new Set();
  for (const movie of valid) {
    if (Number(movie.vote_average) < 6.5) continue;
    const genreIds = (movie.genres || []).map((genre) => genre.id);
    genreGroups.forEach((ids, index) => {
      if (ids.some((id) => genreIds.includes(id))) genreGroupsFound.add(index);
    });
  }
  const genreVersatility = clamp((genreGroupsFound.size / 6) * 100);
  const writtenCount = valid.filter((movie) => (movie.crew || []).some((member) =>
    member.id === id && ["Writer", "Screenplay", "Story"].includes(member.job)
  )).length;
  const authorship = valid.length ? (writtenCount / valid.length) * 100 : 0;
  const authorshipVersatility = clamp((0.75 * genreVersatility) + (0.25 * authorship));

  const topLegacy = [...valid]
    .sort((a, b) => Number(b.vote_count) - Number(a.vote_count))
    .slice(0, 5);
  const legacyScores = topLegacy.map((movie) => {
    const count = Number(movie.vote_count) || 0;
    if (count <= 1000) return clamp((Math.log10(Math.max(count, 10)) / 3) * 85);
    return clamp(85 + ((Math.log10(count) - 3) / 3) * 15);
  });
  const legacy = legacyScores.length
    ? legacyScores.reduce((sum, score) => sum + score, 0) / legacyScores.length
    : 0;

  const [awards, notableRaw, ignored] = await Promise.all([
    fetchAwards(external.wikidata_id, { name: personData.name, birth: personData.birthday }),
    Promise.resolve([]),
    Promise.resolve([])
  ]);
  const [awardsValue, notable, ignoredAwards] = directorAwardsScore(awards.awards || []);

  const pillars = {
    quality,
    awards: awardsValue,
    commercial: commercialScore,
    versatility: authorshipVersatility,
    legacy
  };
  const baseKeys = ["quality", "commercial", "versatility", "legacy"];
  const baseWeights = { quality: 40, commercial: 15, versatility: 10, legacy: 10 };
  const baseAvailable = baseKeys.filter((key) => pillars[key] !== null);
  const baseWeightTotal = baseAvailable.reduce((sum, key) => sum + baseWeights[key], 0);
  const baseScore = baseWeightTotal
    ? baseAvailable.reduce((sum, key) => sum + pillars[key] * baseWeights[key] / baseWeightTotal, 0)
    : 0;
  const score = awardsValue >= baseScore
    ? clamp((0.75 * baseScore) + (0.25 * awardsValue))
    : clamp((0.95 * baseScore) + (0.05 * awardsValue));

  return {
    id: personData.id,
    name: personData.name,
    profile: personData.profile_path || null,
    summary: (personData.biography || "").replace(/\u00a0/g, " ").normalize("NFKC").trim().slice(0, 320),
    score: Math.round(score),
    scoring_version: "Director Scoring version 1.1",
    mode: "Directors",
    pillars: Object.fromEntries(Object.entries(pillars).map(([key, value]) => [key, Math.round(value)])),
    valid_work_count: valid.length,
    written_movie_count: writtenCount,
    award_count: notable.filter((award) => award.won > 0).length,
    awards,
    notable_awards: notable,
    ignored_awards: ignoredAwards,
    leads: [...valid].sort((a, b) => Number(b.vote_average) - Number(a.vote_average)).slice(0, 6).map((movie) => ({
      id: movie.id,
      title: movie.title,
      rating: Math.round(Number(movie.vote_average) * 10) / 10,
      year: (movie.release_date || "").slice(0, 4)
    }))
  };
}
