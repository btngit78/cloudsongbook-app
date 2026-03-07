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
 * Matches against Title, Author, and keywords.
 */
export const matchesSearch = (song: any, textQuery: string, keywordGroups: string[][]): boolean => {
  const hasTextQuery = textQuery.trim() !== '';
  const hasKeywordGroups = keywordGroups.length > 0;

  if (!hasTextQuery && !hasKeywordGroups) return true; // Empty query always matches

  // 1. Check keywords first
  if (hasKeywordGroups) {
    const songKeywords = song.keywords?.map(normalizeText) || [];
    
    // Match if ANY group matches (OR logic between groups)
    const matchesAnyGroup = keywordGroups.some(group => 
      // Group matches if ALL keywords in it match (AND logic within group)
      group.every(k => songKeywords.includes(k))
    );

    if (!matchesAnyGroup) {
      return false;
    }
    // If it's a keyword-only search that matched, we're done.
    if (!hasTextQuery) return true;
  }

  // 2. If we're here, either it's a text-only search, or a mixed search where keywords already matched.
  const title = normalizeText(song.title);
  const author = normalizeText(song.authors);

  return (
    title.includes(textQuery) ||
    author.includes(textQuery)    
  );
};

export const filterSongs = (songs: any[], query: string): any[] => {
  if (!query) return songs;
  
  const normalizedQuery = normalizeText(query);
  const rawTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  
  const keywordGroups: string[][] = [];
  let currentGroup: string[] = [];
  let isAndOperation = false;
  const textParts: string[] = [];

  rawTokens.forEach(token => {
    if (token === '&') {
      isAndOperation = true;
      return;
    }

    if (token.startsWith('#')) {
      const kw = token.substring(1);
      if (!kw) return;

      if (isAndOperation) {
        currentGroup.push(kw);
        isAndOperation = false;
      } else {
        if (currentGroup.length > 0) keywordGroups.push(currentGroup);
        currentGroup = [kw];
      }
    } else {
      textParts.push(token);
      isAndOperation = false;
    }
  });

  if (currentGroup.length > 0) keywordGroups.push(currentGroup);

  const textQuery = textParts.join(' ');

  return songs.filter((song) => matchesSearch(song, textQuery, keywordGroups));
};