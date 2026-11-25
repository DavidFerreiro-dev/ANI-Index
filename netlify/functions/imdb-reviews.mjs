// Netlify Function to fetch public IMDb reviews for a given title (tt...)
// Header: User-Agent standard, max 15-20 reviews, Cache-Control 7 days

function extractReviewsFromHtml(html) {
  const reviews = [];

  // Match review containers or text blocks from IMDb user reviews page
  // Pattern 1: class="text show-more__control" (legacy and modern desktop IMDb review structure)
  // Pattern 2: data-testid="review-overflow" / class="ipc-html-content-inner-div"
  const regexList = [
    /<div[^>]*class=["'][^"']*text\s+show-more__control[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class=["'][^"']*ipc-html-content-inner-div[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*text[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
  ];

  for (const regex of regexList) {
    let match;
    while ((match = regex.exec(html)) !== null && reviews.length < 20) {
      let rawText = match[1] || "";
      // Strip HTML tags & decode basic entities
      rawText = rawText
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/?[^>]+(>|$)/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

      if (rawText.length >= 30 && !reviews.some((r) => r.content === rawText)) {
        reviews.push({
          content: rawText,
          author: "IMDb User",
          source: "imdb"
        });
      }
    }
    if (reviews.length >= 10) break;
  }

  return reviews;
}

export async function fetchImdbReviews(imdbId, timeoutMs = 7000) {
  if (!imdbId || !/^tt\d+$/.test(imdbId)) return [];

  const url = `https://www.imdb.com/title/${imdbId}/reviews?sort=helpfulnessScore&dir=desc&ratingFilter=0`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      signal: controller.signal
    });

    if (!res.ok) return [];
    const html = await res.text();
    return extractReviewsFromHtml(html);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const handler = async (event) => {
  const imdbId = (event.queryStringParameters?.imdbId || event.queryStringParameters?.id || "").trim();

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    "Access-Control-Allow-Origin": "*"
  };

  if (!imdbId || !/^tt\d+$/.test(imdbId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid or missing IMDb ID. Expected format: tt1234567", reviews: [] })
    };
  }

  try {
    const reviews = await fetchImdbReviews(imdbId);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ imdbId, count: reviews.length, reviews })
    };
  } catch (err) {
    return {
      statusCode: 200, // Return empty array on failure so client sentiment continues seamlessly
      headers,
      body: JSON.stringify({ imdbId, count: 0, reviews: [], error: err.message })
    };
  }
};

