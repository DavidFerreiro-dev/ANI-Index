import fs from "node:fs";
import path from "node:path";
import { person, movieCredits, tvCredits, externalIds, reviews, movieDirectors, movieDetails, tvDetails } from "./tmdb.mjs";
import { fetchAwards } from "./wikidata.mjs";
import { getBackendImdbRatings } from "./imdb.mjs";
import { compute, reviewMovies, validCredits, validWorks } from "./scoring.mjs";

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
  const [commercialDetails, tvDetailsList] = await Promise.all([
    Promise.all(valid.map((movie) => movieDetails(movie.id))),
    Promise.all(tvWorks.map((series) => tvDetails(series.id)))
  ]);
  const collectionByMovieId = new Map();
  const imdbIdByWorkKey = new Map();
  commercialDetails.forEach((details, index) => {
    const movie = valid[index];
    if (details?.imdb_id) imdbIdByWorkKey.set(`movie:${movie.id}`, details.imdb_id);
    if (details?.belongs_to_collection?.id) {
      collectionByMovieId.set(movie.id, {
        id: details.belongs_to_collection.id,
        name: details.belongs_to_collection.name
      });
    }
  });
  const tvTotalEpisodesById = new Map();
  tvDetailsList.forEach((details, index) => {
    const series = tvWorks[index];
    const imdbId = details?.external_ids?.imdb_id;
    if (imdbId) imdbIdByWorkKey.set(`tv:${series.id}`, imdbId);
    if (details?.number_of_episodes) {
      tvTotalEpisodesById.set(series.id, Number(details.number_of_episodes));
    }
  });
  allWorks.forEach((work) => {
    const mediaType = work.media_type || "movie";
    if (mediaType === "movie") {
      const col = collectionByMovieId.get(work.id);
      if (col) {
        work.collectionId = col.id;
        work.collectionName = col.name;
      }
    } else if (mediaType === "tv") {
      const totalEps = tvTotalEpisodesById.get(work.id) || 0;
      const epCount = Number(work.episode_count) || 0;
      work.number_of_episodes = totalEps;
      if (totalEps > 0) {
        const ratio = epCount / totalEps;
        work.order = (epCount >= totalEps || ratio >= 0.85) ? 0
          : ratio >= 0.50 ? 1
          : ratio >= 0.25 ? 2
          : 3;
      }
    }
    const imdbId = imdbIdByWorkKey.get(`${mediaType}:${work.id}`);
    if (imdbId) {
      work.imdb_id = imdbId;
      const entry = imdbRatings?.[imdbId];
      if (entry) {
        work.imdb_rating = entry[0];
        work.imdb_votes = entry[1];
      }
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
  });
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
    allWorks
  };
}

export async function buildActor(id) {
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
  return actor;
}
