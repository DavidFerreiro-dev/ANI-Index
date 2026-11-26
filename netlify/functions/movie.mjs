import { movie, movieCast, movieCrew, movieExternalIds } from "./lib/tmdb.mjs";
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
  const pathMatch = (event.path || "").match(/(?:movies?)\/(\d+)/);
  const idStr = pathMatch?.[1] ||
    event.queryStringParameters?.id ||
    pathParts[pathParts.length - 1];
  const id = Number(idStr);

  if (!id || Number.isNaN(id)) {
    return {
      statusCode: 400,
      headers: headers(),
      body: JSON.stringify({ detail: `Missing or invalid movie id from path: ${event.path}` })
    };
  }

  try {
    const [details, cast, crew, ext, imdbRatings] = await Promise.all([
      movie(id),
      movieCast(id),
      movieCrew(id),
      movieExternalIds(id),
      getBackendImdbRatings()
    ]);
    const imdbId = ext?.imdb_id || details.imdb_id || null;
    const imdbEntry = imdbId ? imdbRatings?.[imdbId] : null;

    // Directors from crew
    const directors = (crew || [])
      .filter((person) => person.job === "Director")
      .map((person) => ({
        id: person.id,
        name: person.name,
        profile_path: person.profile_path || null,
        job: "Director"
      }));

    // Top 15 cast members by billing order
    const mainCast = (cast || [])
      .filter((member) => member.known_for_department === "Acting" || member.order <= 20)
      .slice(0, 16)
      .map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        order: member.order,
        profile_path: member.profile_path || null
      }));

    const responseData = {
      id: details.id,
      title: details.title,
      original_title: details.original_title,
      overview: details.overview || "",
      poster_path: details.poster_path || null,
      backdrop_path: details.backdrop_path || null,
      release_date: details.release_date || "",
      year: (details.release_date || "").slice(0, 4),
      runtime: details.runtime || 0,
      genres: details.genres || [],
      vote_average: details.vote_average || 0,
      vote_count: details.vote_count || 0,
      imdb_id: imdbId,
      imdb_rating: imdbEntry?.[0] ?? null,
      imdb_votes: imdbEntry?.[1] ?? null,
      directors,
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

