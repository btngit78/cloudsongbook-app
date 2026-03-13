import { jsPDF } from "jspdf";
import { Song, UserSettings } from "../types";
import { getShouldUseFlats, transposeChord } from "../utils/musicUtils";

const loadFont = async (doc: jsPDF, url: string, fontName: string, fontStyle: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const filename = `${fontName}-${fontStyle}.ttf`;
    doc.addFileToVFS(filename, binary);
    doc.addFont(filename, fontName, fontStyle);
    return true;
  } catch (e) {
    console.warn(`Failed to load font ${fontName} ${fontStyle}:`, e);
    return false;
  }
};

export const generateSongPdf = async (song: Song, settings: UserSettings, transpose: number) => {
  // 1. Setup Document & Transposition
  const doc = new jsPDF();
  
  // Load Roboto Mono (supports Vietnamese & Monospace)
  const fontName = 'RobotoMono';
  const [reg] = await Promise.all([
    loadFont(doc, 'https://cdn.jsdelivr.net/npm/roboto-mono-webfont@2.0.986/fonts/RobotoMono-Regular.ttf', fontName, 'normal'),
    loadFont(doc, 'https://cdn.jsdelivr.net/npm/roboto-mono-webfont@2.0.986/fonts/RobotoMono-Bold.ttf', fontName, 'bold'),
    loadFont(doc, 'https://cdn.jsdelivr.net/npm/roboto-mono-webfont@2.0.986/fonts/RobotoMono-Italic.ttf', fontName, 'italic')
  ]);

  const primaryFont = reg ? fontName : 'courier';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // mm
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  const shouldUseFlats = getShouldUseFlats(song.key, transpose);

  // 2. Helper to check Page Breaks
  const checkPageBreak = (heightNeeded: number) => {
    if (y + heightNeeded > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // 3. Render Header
  doc.setFont(primaryFont, "bold");
  doc.setFontSize(17);
  checkPageBreak(10);
  doc.text(song.title, margin, y);
  y += 8;

  doc.setFont(primaryFont, "italic");
  doc.setFontSize(10);
  checkPageBreak(8);
  doc.text(`By ${song.authors}`, margin, y);
  y += 12;

  // 4. Render Body
  doc.setFont(primaryFont, "normal");
  const baseFontSize = 12; // Fixed size for print, ignoring screen settings
  doc.setFontSize(baseFontSize);
  
  // Approximate line height in mm for 12pt font. Reduced slightly for compact print.
  const lineHeight = 5; 
  const chorusIndent = 10;
  let inChorus = false;
  let isGlobalChorus = false;   // Tracks if we're in a {soc} block which can span multiple sections

  const lines = song.body.split('\n');

  lines.forEach(line => {
    let trimmedLine = line.trim();
  
    // Handle Labels (Chorus:, Coda:, Verse 1:, [Chorus])
    let isLabel = /^(Chorus|Coda|Verse|Bridge|Intro|Outro|Pre-Chorus).*[:]?$/i.test(trimmedLine) || (trimmedLine.endsWith(':') && trimmedLine.length < 20);
    
    if (!isLabel) {
      // Handle Directives
      if (trimmedLine.startsWith('{soc}')) {
        inChorus = true;
        isGlobalChorus = true;
        line = "Chorus:";       // so the chorus label can be printed
        isLabel = true;         // change flag for correct treatment later
      }
      else if (trimmedLine.startsWith('{eoc}')) {
        inChorus = false;         // multi-block chorus terminated here
        return;
      }
    
      if (trimmedLine.startsWith('#')) {
        return; // Skip comments
      }
    } else {
      // If it's a label line, we check if it starts with "Chorus:" to set chorus state
      if (/^Chorus[:]?$/i.test(trimmedLine)) {
        inChorus = true;
        isGlobalChorus = false;   // This is a single-block chorus, not a global {soc} section
      }
    }

    if ((trimmedLine === '') && !isGlobalChorus) {
      // empty line, single block chorus terminated here
      inChorus = false;
      y += lineHeight + 2; // Add spacing for empty lines
      return;
    }
    
    // Determine Indentation & Width
    // Explicit chorus ({soc}) OR implicit if the line is just "Chorus:" usually implies subsequent lines are chorus, 
    // but sticking to strict {soc} block or manual indent is safer. 
    // We will indent only if we are inside a {soc} block.
    const currentMargin = margin + (inChorus ? chorusIndent : 0);
    const maxLineWidth = contentWidth - (inChorus ? chorusIndent : 0);

    // Logic similar to LyricsRenderer to split chords/lyrics
    let chordLine = "";
    let lyricLine = "";

    // Process Chords vs Lyrics
    if (settings.showChords) {
        const parts = line.split(/(\[.*?\])/g).filter(p => p !== '');
        parts.forEach(part => {
            if (part.startsWith('[') && part.endsWith(']')) {
                const chordRaw = part.slice(1, -1);
                // Skip chords on label lines if desired, but usually labels are on their own line.
                // If a line is just a label, it might not have chords.
                
                const chord = transposeChord(chordRaw, transpose, shouldUseFlats);
                // For simplified PDF monospace, we just stack them. 
                // A robust implementation would need exact character spacing matching,
                // which is complex. Here we use a simplified alignment approach.
                
                // Aligning chords in simple text export is tricky without a specific parser.
                // We will use the existing logic: Chords above lyrics.
                
                // padding logic for alignment
                const padLen = Math.max(chordLine.length, lyricLine.length);
                chordLine = chordLine.padEnd(padLen, ' ');
                lyricLine = lyricLine.padEnd(padLen, ' ');
                
                chordLine += chord + " ";
                // Lyrics don't get added here, they are in the 'else' block
            } else {
                lyricLine += part;
                // Pad chord line to match
                if (chordLine.length < lyricLine.length) {
                     chordLine = chordLine.padEnd(lyricLine.length, ' ');
                }
            }
        });
    } else {
        lyricLine = line.replace(/\[.*?\]/g, '');
    }

    // Render Chords
    if (chordLine.trim().length > 0) {
        checkPageBreak(lineHeight*2); // Ensure enough space for chords + lyrics
        doc.setFont(primaryFont, "bold");
        doc.setTextColor(50, 50, 200); // Blue-ish for chords
        doc.text(chordLine, currentMargin, y);
        y += lineHeight;
    }

    // Render Lyrics
    checkPageBreak(lineHeight);

    if (isLabel) {
      doc.setFont(primaryFont, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(lyricLine, currentMargin, y);
      y += lineHeight;
    } else {
      // Normal Lyrics with Parentheses Styling
      doc.setFont(primaryFont, "normal");
      doc.setTextColor(0, 0, 0);
      
      // Handle wrapping for very long lines
      const splitLyrics = doc.splitTextToSize(lyricLine, maxLineWidth);
      
      splitLyrics.forEach((lyricPart: string) => {
          checkPageBreak(lineHeight);

          // Split by parenthesis groups inclusive: "Hello (world)" -> ["Hello ", "(world)", ""]
          const parts = lyricPart.split(/(\([^)]+\))/g);
          let currentX = currentMargin;

          parts.forEach(part => {
            if (!part) return;
            
            const isParen = part.startsWith('(') && part.endsWith(')');
            
            if (isParen) {
              const pStyle = settings.parenthesesStyle || 'italic';
              if (pStyle === 'italic') {
                doc.setFont(primaryFont, 'italic');
                doc.setTextColor(0, 0, 0);
              } else if (pStyle === 'colored') {
                doc.setFont(primaryFont, 'normal');
                doc.setTextColor(165, 42, 42); // Brownish Red
              } else {
                // Normal
                doc.setFont(primaryFont, 'normal');
                doc.setTextColor(0, 0, 0);
              }
            } else {
              doc.setFont(primaryFont, 'normal');
              doc.setTextColor(0, 0, 0);
            }

            doc.text(part, currentX, y);
            currentX += doc.getTextWidth(part);
          });

          y += lineHeight;
      });
    }

    // Add extra spacing after line
    y += 2;
  });

  // Footer: Page Numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 25, pageHeight - 10);
  }

  // 5. Output
  // Open in new tab (blob) which gives the browser's native PDF viewer with print controls
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
};
