import { tvDetails, tvExternalIds, tvCreditsByShow } from "./lib/tmdb.mjs";
import { getBackendImdbRatings } from "./lib/imdb.mjs";

function headers() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    "Access-Control-Allow-Origin": "*"
  };
}

export const handler = async (event) => {
  const pathParts = (event.path || "").split("/").filter(Boolean);
  const pathMatch = (event.path || "").match(/(?:tv)\/(\d+)/);
  const idStr = pathMatch?.[1] ||
    event.queryStringParameters?.id ||
    pathParts[pathParts.length - 1];
  const id = Number(idStr);

  if (!id || Number.isNaN(id)) {
    return {
      statusCode: 400,
      headers: headers(),
      body: JSON.stringify({ detail: `Missing or invalid TV series id from path: ${event.path}` })
    };
  }

  try {
    const [details, credits, imdbRatings] = await Promise.all([
      tvDetails(id),
      tvCreditsByShow(id),
      getBackendImdbRatings()
    ]);

    if (!details) {
      return {
        statusCode: 404,
        headers: headers(),
        body: JSON.stringify({ detail: "TV series not found" })
      };
    }

    // Combine creators and directors, deduplicated by id
    const directorMap = new Map();
    for (const creator of (details.created_by || [])) {
      if (!directorMap.has(creator.id)) {
        directorMap.set(creator.id, {
          id: creator.id,
          name: creator.name,
          profile_path: creator.profile_path || null,
          job: "Creator"
        });
      }
    }
    for (const member of (credits?.crew || [])) {
      if (member.job === "Director" && !directorMap.has(member.id)) {
        directorMap.set(member.id, {
          id: member.id,
          name: member.name,
          profile_path: member.profile_path || null,
          job: "Director"
        });
      }
    }

    const mainCast = (credits?.cast || [])
      .filter((member) => member.known_for_department === "Acting" || (member.order ?? 99) <= 20)
      .slice(0, 16)
      .map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        order: member.order,
        profile_path: member.profile_path || null
      }));

    const startYear = (details.first_air_date || "").slice(0, 4);
    const endYear = details.in_production ? "Present" : (details.last_air_date || "").slice(0, 4);
    const years = startYear
      ? (endYear && endYear !== startYear ? `${startYear} – ${endYear}` : startYear)
      : "";

    const imdbId = details.external_ids?.imdb_id || (await tvExternalIds(id))?.imdb_id || null;
    const imdbEntry = imdbId ? imdbRatings?.[imdbId] : null;
    const responseData = {
      id: details.id,
      media_type: "tv",
      title: details.name,
      original_title: details.original_name,
      overview: details.overview || "",
      poster_path: details.poster_path || null,
      backdrop_path: details.backdrop_path || null,
      first_air_date: details.first_air_date || "",
      last_air_date: details.last_air_date || "",
      in_production: Boolean(details.in_production),
      year: startYear,
      years,
      number_of_seasons: details.number_of_seasons || 0,
      number_of_episodes: details.number_of_episodes || 0,
      type: details.type || "",
      genres: details.genres || [],
      vote_average: details.vote_average || 0,
      vote_count: details.vote_count || 0,
      imdb_id: imdbId,
      imdb_rating: imdbEntry?.[0] ?? null,
      imdb_votes: imdbEntry?.[1] ?? null,
      directors: [...directorMap.values()],
      cast: mainCast
    };

    return {
      statusCode: 200,
      headers: headers(),
      body: JSON.stringify(responseData)
    };
  } catch (error) {
    const statusCode = /404/.test(error.message) ? 404 : 502;
    return {
      statusCode,
      headers: headers(),
      body: JSON.stringify({ detail: error.message })
    };
  }
};
