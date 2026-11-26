import fs from "node:fs";
import path from "node:path";
import { person, movieCredits, tvCredits, externalIds, reviews, movieDirectors, movieDetails, movieExternalIds, tvDetails, tvExternalIds } from "./tmdb.mjs";
import { fetchAwards } from "./wikidata.mjs";
import { getBackendImdbRatings } from "./imdb.mjs";
import { compute, reviewMovies, validCredits, validWorks, tvParticipationWeight } from "./scoring.mjs";

function prestigeDirectorIds() {
  try {
    const file = path.resolve(process.cwd(), "directors.json");
    const directors = JSON.parse(fs.readFileSync(file, "utf8"));
    return new Set(directors.filter((item) => item.tmdb_id).map((item) => item.tmdb_id));
  } catch {
    return new Set();
  }
}

function sagaCollectionIds() {
  try {
    const file = path.resolve(process.cwd(), "sagas.json");
    return new Set(JSON.parse(fs.readFileSync(file, "utf8"))
      .map((saga) => saga.tmdb_collection_id)
      .filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function qualityContext(personId, credits, tv = [], imdbRatings = {}) {
  const valid = validCredits(credits);
  const allWorks = validWorks(credits, tv);
  const leadMovieCount = valid.filter((credit) => credit.order <= 2).length;
  const fewLeadMovies = leadMovieCount < 5;
  const fewWorks = allWorks.length < 12;
  const weightedMovie = (movie) => {
    const weight = movie.order === 0 ? 1 : movie.order === 1 ? 0.8 :
      movie.order === 2 ? 0.6 : movie.order >= 3 && movie.order <= 5 ? 0.35 : 0.1;
    return weight * (movie.vote_count || 0);
  };
  const topMovies = [...valid]
    .sort((a, b) => weightedMovie(b) - weightedMovie(a))
    .slice(0, 15);
  const prestigeIds = prestigeDirectorIds();
  const sagaIds = sagaCollectionIds();
  const [directorResults, movieDetailsResults] = await Promise.all([
    Promise.all(topMovies.map((movie) => movieDirectors(movie.id))),
    Promise.all(topMovies.map((movie) => movieDetails(movie.id)))
  ]);
  const directorMovieIds = [];
  const sagaMovieIds = [];
  directorResults.forEach((directors, index) => {
    if (directors?.some((director) => director.id === personId)) return;
    if (directors?.some((director) => prestigeIds.has(director.id))) {
      directorMovieIds.push(topMovies[index].id);
    }
  });
  movieDetailsResults.forEach((details, index) => {
    const collectionId = details?.belongs_to_collection?.id;
    if (collectionId && sagaIds.has(collectionId)) sagaMovieIds.push(topMovies[index].id);
  });
  const tvWorks = allWorks.filter((work) => work.media_type === "tv");
  const [movieMetadata, tvDetailsList] = await Promise.all([
    Promise.all(valid.map(async (movie) => {
      const details = await movieDetails(movie.id);
      const ext = details?.imdb_id ? null : await movieExternalIds(movie.id);
      return { details, imdbId: details?.imdb_id || ext?.imdb_id || null };
    })),
    Promise.all(tvWorks.map((series) => tvDetails(series.id)))
  ]);
  const commercialDetails = movieMetadata.map((entry) => entry.details);
  const collectionByMovieId = new Map();
  const imdbIdByWorkKey = new Map();
  const validMovieIds = new Set();
  const today = new Date().toISOString().slice(0, 10);
  commercialDetails.forEach((details, index) => {
    const movie = valid[index];
    const imdbId = movieMetadata[index].imdbId;
    if (imdbId) imdbIdByWorkKey.set(`movie:${movie.id}`, imdbId);
    const releaseDate = details?.release_date || movie.release_date || "";
    const runtime = Number(details?.runtime) || 0;
    if (releaseDate.length >= 10 && releaseDate <= today && (!runtime || runtime >= 45)) {
      validMovieIds.add(movie.id);
    }
    if (details?.belongs_to_collection?.id) {
      collectionByMovieId.set(movie.id, {
        id: details.belongs_to_collection.id,
        name: details.belongs_to_collection.name
      });
    }
  });
  const tvTotalEpisodesById = new Map();
  await Promise.all(tvDetailsList.map(async (details, index) => {
    const series = tvWorks[index];
    let imdbId = details?.external_ids?.imdb_id;
    if (!imdbId) {
      const ext = await tvExternalIds(series.id);
      imdbId = ext?.imdb_id || null;
    }
    if (imdbId) imdbIdByWorkKey.set(`tv:${series.id}`, imdbId);
    const regularSeasons = (details?.seasons || []).filter((s) => Number(s.season_number) > 0);
    const totalRegularEpisodes = regularSeasons.length
      ? regularSeasons.reduce((sum, s) => sum + (Number(s.episode_count) || 0), 0)
      : (Number(details?.number_of_episodes) || 0);
    if (totalRegularEpisodes > 0) {
      tvTotalEpisodesById.set(series.id, totalRegularEpisodes);
    }
  }));
  const filteredWorks = [];
  allWorks.forEach((work) => {
    const mediaType = work.media_type || "movie";
    const imdbId = imdbIdByWorkKey.get(`${mediaType}:${work.id}`);
    if (imdbId) {
      work.imdb_id = imdbId;
      const entry = imdbRatings?.[imdbId];
      if (entry) {
        work.imdb_rating = entry[0];
        work.imdb_votes = entry[1];
      }
    }
    if (mediaType === "movie") {
      if (!validMovieIds.has(work.id)) return;
      const col = collectionByMovieId.get(work.id);
      if (col) {
        work.collectionId = col.id;
        work.collectionName = col.name;
      }
      filteredWorks.push(work);
    } else if (mediaType === "tv") {
      const tmdbVotes = Number(work.vote_count) || 0;
      const imdbVotes = Number(work.imdb_votes) || 0;
      if (tmdbVotes < 50 && imdbVotes < 1000) return;

      const totalEps = tvTotalEpisodesById.get(work.id) || 0;
      const epCount = Number(work.episode_count) || 0;
      work.number_of_episodes = totalEps;
      const { pct, weight: tvWeight } = tvParticipationWeight(epCount, totalEps);
      if (tvWeight <= 0) return;

      work.tvWeight = tvWeight;
      work.participationPct = Math.round(pct);
      work.order = tvWeight >= 1.00 ? 0 : tvWeight >= 0.75 ? 1 : tvWeight >= 0.50 ? 2 : 3;
      filteredWorks.push(work);
    }
  });
  const commercialEntries = commercialDetails.map((details, index) => {
    const movie = valid[index];
    const weight = movie.order === 0 ? 1 : movie.order === 1 ? 0.8 :
      movie.order === 2 ? 0.6 : movie.order >= 3 && movie.order <= 5 ? 0.35 : 0.1;
    return {
      id: movie.id,
      title: details?.title || movie.title || "",
      revenue: details?.revenue || 0,
      budget: details?.budget || 0,
      release_date: details?.release_date || movie.release_date || "",
      belongs_to_collection: details?.belongs_to_collection || null,
      weight
    };
  }).filter((movie) => validMovieIds.has(movie.id));
  const standaloneMovies = [];
  const collectionById = new Map();
  for (const movie of commercialEntries) {
    const collectionId = movie.belongs_to_collection?.id;
    if (!collectionId) {
      standaloneMovies.push(movie);
      continue;
    }
    const current = collectionById.get(collectionId);
    if (!current || (movie.revenue || 0) > (current.revenue || 0)) {
      collectionById.set(collectionId, movie);
    }
  }
  const representatives = [...standaloneMovies, ...collectionById.values()];
  const collectionMovies = [...collectionById.values()];
  let commercialMovies;
  if (fewLeadMovies || fewWorks) {
    commercialMovies = representatives;
  } else {
    const standaloneTop = standaloneMovies
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, 10 - collectionMovies.length));
    commercialMovies = [...collectionMovies, ...standaloneTop];
  }
  const commercialExcluded = { saga: 0, revenue: 0, date: 0 };
  commercialMovies.forEach((movie) => {
    if (!movie.revenue) commercialExcluded.revenue++;
    else if (!movie.release_date || Number(movie.release_date.slice(0, 4)) < 1980) commercialExcluded.date++;
  });
  return {
    directorMovieIds,
    directorMovieCount: directorMovieIds.length,
    sagaMovieIds,
    sagaMovieCount: sagaMovieIds.length,
    leadMovieCount,
    commercialMovies,
    commercialMovieCount: commercialMovies.filter((movie) =>
      movie.revenue > 0 &&
      movie.release_date &&
      Number(movie.release_date.slice(0, 4)) >= 1980
    ).length,
    commercialExcluded,
    collectionByMovieId,
    allWorks: filteredWorks
  };
}

export async function buildActor(id, attempt = 0) {
  const [personData, credits, tv, external, imdbRatings] = await Promise.all([
    person(id),
    movieCredits(id),
    tvCredits(id),
    externalIds(id),
    getBackendImdbRatings()
  ]);
  const valid = validCredits(credits);
  const selectedMovies = reviewMovies(valid);
  const [awards, reviewsByMovie, qualityOptions] = await Promise.all([
    fetchAwards(external.wikidata_id, { name: personData.name, birth: personData.birthday }),
    Promise.all(selectedMovies.map((movie) => reviews(movie.id))),
    qualityContext(personData.id, credits, tv, imdbRatings)
  ]);
  const actor = compute(personData, credits, awards, reviewsByMovie, selectedMovies, qualityOptions);
  if (actor.valid_work_count === 0) {
    if (attempt < 1) return buildActor(id, attempt + 1);
    throw new Error(`Actor profile ${id} has no valid works after retry`);
  }
  return actor;
}
