
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const geminiService = {
  async semanticSearch(query: string, songs: any[]) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Given this song list: ${JSON.stringify(songs.map(s => ({id: s.id, title: s.title, author: s.author})))}, 
                   find songs that match the user request: "${query}". 
                   Return ONLY a JSON array of matching song IDs.`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("AI Search failed", e);
      return [];
    }
  },

  async generateSongSuggestions(theme: string) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a simple song lyric with chords in [Chord] format for the theme: ${theme}. 
                 Include a Title and Author. Output as plain text with [Chord] markers.`,
    });
    return response.text;
  }
};
