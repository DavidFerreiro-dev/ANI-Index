import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { person, personCrewCredits, personTvCrewCredits, externalIds, movieDetails, movieExternalIds, movieCrew, tvDetails, tvExternalIds, tvCreditsByShow } from "./tmdb.mjs";
import { fetchAwards } from "./wikidata.mjs";
import { getBackendImdbRatings, computeDualRating } from "./imdb.mjs";

const EXCLUDED_TV_GENRES = [99, 10763, 10764, 10767, 10770];
const clamp = (value) => Math.max(0, Math.min(100, value));
const blendedRating = (work) => computeDualRating(
  work.vote_average,
  work.imdb_rating
);

const genreGroups = [
  [28, 12], [80, 53, 9648], [878, 14], [10749, 18],
  [16], [10751], [35], [27], [10402], [36, 10752], [37], [99]
];

export function curatedDirectorIds() {
  try {
    const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../directors.json");
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

export async function buildDirector(id, attempt = 0) {
  const [personData, credits, tvCrewCredits, external, imdbRatings] = await Promise.all([
    person(id), personCrewCredits(id), personTvCrewCredits(id), externalIds(id), getBackendImdbRatings()
  ]);
  const directedCredits = credits.filter((credit) => credit.job === "Director");
  const detailEntries = await Promise.all(directedCredits.map(async (credit) => {
    const [details, crew] = await Promise.all([movieDetails(credit.id), movieCrew(credit.id)]);
    if (!details) return null;
    const ext = details.imdb_id ? null : await movieExternalIds(credit.id);
    return {
      ...details,
      media_type: "movie",
      imdb_id: details.imdb_id || ext?.imdb_id || null,
      crew,
      crew_order: credit.order,
      vote_count: details.vote_count ?? credit.vote_count ?? 0,
      vote_average: details.vote_average ?? credit.vote_average ?? 0
    };
  }));
  const validMovies = detailEntries.filter((movie) =>
    movie &&
    !movie.adult &&
    movie.video !== true &&
    movie.status === "Released" &&
    (!Number(movie.runtime) || Number(movie.runtime) >= 45) &&
    !(movie.genres || []).some((genre) => genre.id === 99) &&
    (movie.release_date || "").length >= 10 &&
    movie.release_date <= new Date().toISOString().slice(0, 10)
  );

  // Directed TV series & miniseries (deduplicated per series ID)
  const directedTvMap = new Map();
  for (const credit of (tvCrewCredits || [])) {
    if (credit.job !== "Director") continue;
    if ((credit.genre_ids || []).some((gid) => EXCLUDED_TV_GENRES.includes(gid))) continue;
    const prev = directedTvMap.get(credit.id);
    if (!prev || (credit.episode_count || 0) > (prev.episode_count || 0)) {
      directedTvMap.set(credit.id, credit);
    }
  }
  const tvDetailEntries = await Promise.all([...directedTvMap.values()].map(async (credit) => {
    const [details, tvCreds] = await Promise.all([tvDetails(credit.id), tvCreditsByShow(credit.id)]);
    if (!details) return null;
    const isMiniseries = details.type === "Miniseries";
    const epCount = credit.episode_count ?? 0;
    if (isMiniseries ? epCount < 1 : epCount < 2) return null;
    if (details.adult) return null;
    if (["Planned", "In Production", "Rumored"].includes(details.status)) return null;
    if ((details.genres || []).some((genre) => EXCLUDED_TV_GENRES.includes(genre.id))) return null;
    let imdbId = details.external_ids?.imdb_id || null;
    if (!imdbId) imdbId = (await tvExternalIds(credit.id))?.imdb_id || null;
    const imdbEntry = imdbId ? imdbRatings?.[imdbId] : null;
    const voteCount = details.vote_count ?? credit.vote_count ?? 0;
    const imdbVotes = Number(imdbEntry?.[1]) || 0;
    if (voteCount < 50 && imdbVotes < 1000) return null;
    const releaseDate = details.first_air_date || "";
    if (releaseDate.length < 10 || releaseDate > new Date().toISOString().slice(0, 10)) return null;
    return {
      ...details,
      media_type: "tv",
      title: details.name || credit.name || "",
      release_date: releaseDate,
      imdb_id: imdbId,
      imdb_rating: imdbEntry?.[0] || null,
      imdb_votes: imdbVotes,
      belongs_to_collection: { id: `tv:${details.id}`, name: details.name || "" },
      crew: tvCreds?.crew || [],
      revenue: 0,
      budget: 0,
      vote_count: voteCount,
      vote_average: details.vote_average ?? credit.vote_average ?? 0
    };
  }));
  const validTv = tvDetailEntries.filter(Boolean);

  const valid = [...validMovies, ...validTv].map((work) => {
    const entry = work.imdb_id ? imdbRatings?.[work.imdb_id] : null;
    return entry ? { ...work, imdb_rating: entry[0], imdb_votes: entry[1] } : work;
  });
  if (valid.length === 0) {
    if (attempt < 1) return buildDirector(id, attempt + 1);
    throw new Error(`Director profile ${id} has no valid works after retry`);
  }

  const validWithRatings = valid.map((movie) => ({ ...movie, rating: blendedRating(movie) }));

  // 1. Peak / Techo (Top 4 películas): máximo 1 película por franquicia
  const peakColGroups = new Map();
  const peakNonCol = [];
  for (const movie of validWithRatings) {
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
    group.sort((a, b) => b.rating - a.rating);
    peakEligible.push(group[0]);
  }
  peakEligible.sort((a, b) => b.rating - a.rating);
  const peak = peakEligible.slice(0, 4);
  const peakScore = peak.length ? peak.reduce((sum, movie) => sum + movie.rating, 0) / peak.length : 0;

  // 2. Filmografía general: máximo 2 por franquicia
  const genColGroups = new Map();
  const genNonCol = [];
  for (const movie of validWithRatings) {
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
    group.sort((a, b) => b.rating - a.rating);
    genEligible.push(...group.slice(0, 2));
  }
  genEligible.sort((a, b) => b.rating - a.rating);

  // Consistency: smooth 6–12 feature sliding window, with franchise capping already applied.
  const consistencyCount = Math.max(6, Math.min(12, Math.round(6 + ((genEligible.length - 6) / 24) * 6)));
  const consistencyMovies = genEligible.slice(0, consistencyCount);
  const consistency = consistencyMovies.length
    ? consistencyMovies.reduce((sum, movie) => sum + movie.rating, 0) / consistencyMovies.length
    : 0;

  // 70/30 peak/consistency conversion, capped for very large career filmographies.
  const peakNormalized = clamp(((peakScore - 6.0) / 2.35) * 100);
  const consistencyNormalized = clamp(((consistency - 6.0) / 2.35) * 100);
  const quality = clamp((0.70 * peakNormalized) + (0.30 * consistencyNormalized));

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
    let legacyScore = count <= 1000
      ? clamp((Math.log10(Math.max(count, 10)) / 3) * 85)
      : clamp(85 + ((Math.log10(count) - 3) / 3) * 15);
    const year = Number(String(movie.release_date || "").slice(0, 4));
    if (count >= 100000 && year > 0 && year < 1990) {
      const eraFactor = 1.08 + (Math.max(0, 1990 - year) / 100) * 0.40;
      legacyScore = clamp(legacyScore * Math.min(1.12, eraFactor));
    }
    return legacyScore;
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
  let score = awardsValue >= baseScore
    ? clamp((0.75 * baseScore) + (0.25 * awardsValue))
    : clamp((0.95 * baseScore) + (0.05 * awardsValue));
  if (score > 88) {
    const r = (score - 88) / 12;
    score = clamp(88 + (7.5 * (Math.log1p(1.5 * r) / Math.log(2.5))));
  }

  return {
    id: personData.id,
    name: personData.name,
    profile: personData.profile_path || null,
    summary: (personData.biography || "").replace(/\u00a0/g, " ").normalize("NFKC").trim().slice(0, 320),
    score,
    scoring_version: "Director Scoring version 5.2",
    mode: "Directors",
    pillars: Object.fromEntries(Object.entries(pillars).map(([key, value]) => [key, value])),
    valid_work_count: valid.length,
    written_movie_count: writtenCount,
    award_count: notable.filter((award) => award.won > 0).length,
    awards,
    notable_awards: notable,
    ignored_awards: ignoredAwards,
    leads: [...valid].sort((a, b) => Number(b.vote_average) - Number(a.vote_average)).slice(0, 6).map((movie) => ({
      id: movie.id,
      title: movie.title,
      media_type: movie.media_type || "movie",
      rating: Math.round(Number(movie.vote_average) * 10) / 10,
      tmdb_rating: Number(movie.vote_average) || 0,
      tmdb_votes: Number(movie.vote_count) || 0,
      imdb_rating: Number(movie.imdb_rating) || null,
      imdb_votes: Number(movie.imdb_votes) || 0,
      final_rating: Math.round(blendedRating(movie) * 10) / 10,
      year: (movie.release_date || "").slice(0, 4)
    }))
  };
}
