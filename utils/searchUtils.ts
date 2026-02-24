/**
 * Normalizes text by converting to lowercase and removing diacritics (accents).
 * Example: "Crème Brûlée" -> "creme brulee"
 */
export const normalizeText = (text: string | undefined): string => {
  if (!text) return '';
  return text
    .normalize("NFD")
    .replace(/đ/g, "d")              // Explicitly handle Vietnamese d
    .replace(/Đ/g, "d")
    .replace(/\p{M}/gu, "")         // Modern Regex: Removes ALL combining marks
    .toLowerCase()
    .trim();
};

/**
 * Checks if a song matches the search query.
 * Matches against Title, Author, and Body.
 */
export const matchesSearch = (song: any, normalizedQuery: string): boolean => {
  if (!normalizedQuery) return true;

  const title = normalizeText(song.title);
  const author = normalizeText(song.authors);
  // Uncomment the line below if you want to search within lyrics (body) as well
  // const body = normalizeText(song.body);

  return (
    title.includes(normalizedQuery) ||
    author.includes(normalizedQuery) 
    // || body.includes(normalizedQuery)
  );
};

export const filterSongs = (songs: any[], query: string): any[] => {
  if (!query) return songs;
  const normalizedQuery = normalizeText(query);
  return songs.filter((song) => matchesSearch(song, normalizedQuery));
};