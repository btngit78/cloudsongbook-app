
import React, { useState, useEffect } from 'react';
import { Song, Languages } from '../types';
import { useMetronome } from '../hooks/useMetronome.ts';
import { PdfUploader } from './PdfUploader';
import { storageService } from '../services/storageService';


interface SongFormProps {
  song?: Song;
  onSave: (song: Partial<Song>, keepOpen?: boolean) => void;
  onCancel: () => void;
  batchCount?: number;
  onQuitBatch?: () => void;
}

const VIETNAMESE_REGEX = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const LANGUAGES = ['English', 'Vietnamese', 'French', 'Spanish'];

const DEFAULT_FORM_DATA: Partial<Song> = {
  title: '',
  authors: '',
  body: '',
  key: '',
  tempo: undefined,
  keywords: [],
  language: 'English',
  isPdf: false,
  pdfUrl: ''
};

const SongForm: React.FC<SongFormProps> = ({ song, onSave, onCancel, batchCount, onQuitBatch }) => {
  const [formData, setFormData] = useState<Partial<Song>>(DEFAULT_FORM_DATA);
  const [initialData, setInitialData] = useState<Partial<Song>>(DEFAULT_FORM_DATA);
  const [isDirty, setIsDirty] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof Song, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState<'auto' | 'hopamviet' | 'ultimate' | 'google'>('auto');

  const { 
    tempo: metronomeTempo, 
    tap: handleTap, 
    active: metronomeActive, 
    toggle: toggleMetronome, 
    beatFlash 
  } = useMetronome(formData.tempo);

  useEffect(() => {
    if (song) {
      const data = { ...DEFAULT_FORM_DATA, ...song };
      setFormData(data);
      setInitialData(data);
      setKeywordsInput(Array.isArray(data.keywords) ? data.keywords.join(' ') : '');
    } else {
      setInitialData(DEFAULT_FORM_DATA);
      setKeywordsInput('');
    }
  }, [song]);

  // Sync tapped tempo back to form
  useEffect(() => {
    if (metronomeTempo !== undefined && metronomeTempo !== formData.tempo) {
      setFormData(prev => ({ ...prev, tempo: metronomeTempo }));
    }
  }, [metronomeTempo]);

  // Check for unsaved changes
  useEffect(() => {
    setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialData));
  }, [formData, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave(false); // Default form submission is Save & Exit
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof Song, string>> = {};
    
    if (!formData.title || formData.title.trim() === '') {
      newErrors.title = 'Title is required.';
    } else if (formData.title.length > 80) {
      newErrors.title = 'Title must be 80 characters or less.';
    }

    if (formData.key && !/^[A-G][#b]?m?$/.test(formData.key)) {
      newErrors.key = 'Invalid key format. Use G, C#m, Bb, etc.';
    }

    if (formData.tempo !== undefined && (formData.tempo < 0 || formData.tempo > 400)) {
      newErrors.tempo = 'Tempo must be between 0 and 400.';
    }
    
    const keywords = Array.isArray(formData.keywords) ? formData.keywords : [];
    const invalidKeyword = keywords.find(word => !/^[\p{L}\p{N}/\-._]*$/u.test(word));
    if (invalidKeyword) {
      newErrors.keywords = `Invalid keyword "${invalidKeyword}". Keywords must be alpha-numeric (intl allowed), hyphens, slashes, periods, or underscores.`;
    }

    if (formData.isPdf && !formData.pdfUrl) {
      newErrors.pdfUrl = 'A PDF file must be uploaded.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = (keepOpen: boolean) => {
    if (!validate()) {
      setError('Please fix the errors before saving.');
      return;
    }
    setError(null);

    const processedData = { ...formData };
    if (Array.isArray(processedData.keywords)) {
      // Use a Set to get unique keywords before saving.
      processedData.keywords = [...new Set(processedData.keywords)];
    }

    onSave(processedData, keepOpen);
  };

  const handleLyricsSearch = () => {
    if (!formData.title?.trim()) return;
    
    const title = formData.title.trim();
    const langLower = formData.language?.toLowerCase();
    
    let provider = searchProvider;
    if (provider === 'auto') {
      if (langLower === 'vietnamese' || langLower === 'french' || VIETNAMESE_REGEX.test(title)) {
        provider = 'hopamviet';
      } else if (langLower === 'english') {
        provider = 'ultimate';
      } else {
        provider = 'google';
      }
    }

    const url = provider === 'hopamviet'
      ? `https://hopamviet.vn/chord/search?song=${title.replace(/\s+/g, '+')}`
      : provider === 'ultimate'
        ? `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(title)}`
        : `https://www.google.com/search?q=${encodeURIComponent(title)}+lyrics`;
    
    window.open(url, '_blank');
  };

  const langLower = formData.language?.toLowerCase();
  let effectiveProvider = searchProvider;
  if (effectiveProvider === 'auto') {
    if (langLower === 'vietnamese' || langLower === 'french' || (formData.title ? VIETNAMESE_REGEX.test(formData.title) : false)) {
      effectiveProvider = 'hopamviet';
    } else if (langLower === 'english') {
      effectiveProvider = 'ultimate';
    } else {
      effectiveProvider = 'google';
    }
  }

  const searchLabel = effectiveProvider === 'hopamviet'
    ? "Search at hopamviet.vn"
    : (effectiveProvider === 'ultimate' ? "Search at ultimate-guitar.com" : "Default browser search");

  const handleCancel = async () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        // Check if a new PDF was uploaded and is different from the initial one
        const newPdfUploaded = formData.isPdf && formData.pdfUrl && formData.pdfUrl !== initialData.pdfUrl;
        if (newPdfUploaded) {
          try {
            await storageService.deleteSongPdf(formData.pdfUrl!);
          } catch (error) {
            console.error("Failed to delete orphaned PDF:", error);
            // Non-critical error, proceed with cancellation.
          }
        }
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-xl mt-8 mb-12 transition-colors">
      <div className="flex items-center justify-between mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {song ? 'Edit Song' : 'Add New Song'}
        </h2>
        <div className="flex items-center space-x-3">
          {batchCount !== undefined && batchCount > 0 && onQuitBatch && (
            <button
              type="button"
              onClick={onQuitBatch}
              className="px-4 py-2 text-red-600 dark:text-red-400 font-bold border border-red-300 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Quit Batch
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {batchCount && batchCount > 0 ? 'Skip' : (isDirty ? 'Cancel' : 'Back')}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={!formData.title?.trim() || !isDirty}
            className={`px-4 py-2 rounded-lg font-bold transition-all border ${
              !formData.title?.trim() || !isDirty ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!formData.title?.trim() || !isDirty}
            className={`px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all ${
              !formData.title?.trim() || !isDirty ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {batchCount && batchCount > 0 ? `Save & Next (${batchCount})` : 'Save & Exit'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 text-sm rounded-r-lg">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Title */}
          <div className="md:col-span-4">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Song Title *</label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="e.g., Amazing Grace"
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
            {errors.title && <p className="text-red-500 text-xs mt-1 ml-1">{errors.title}</p>}
          </div>

          {/* Author */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Author(s)</label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g., John Newton"
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
              value={formData.authors}
              onChange={e => setFormData({ ...formData, authors: e.target.value })}
            />
            {errors.authors && <p className="text-red-500 text-xs mt-1 ml-1">{errors.authors}</p>}
          </div>

          {/* Key */}
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Key</label>
            <input
              type="text"
              placeholder="e.g., G, C#m, Bb"
              pattern="^[A-G][#b]?m?$"
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
              value={formData.key}
              onChange={e => setFormData({ ...formData, key: e.target.value })}
            />
            {errors.key && <p className="text-red-500 text-xs mt-1 ml-1">{errors.key}</p>}
          </div>

          {/* Tempo */}
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tempo (BPM)</label>
            <div className="flex space-x-2 relative">
              <input
                type="number"
                min={0}
                max={400}
                placeholder="e.g., 120"
                className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
                value={formData.tempo ?? ''}
                onChange={e => setFormData({ ...formData, tempo: e.target.value === '' ? undefined : parseInt(e.target.value) })}
              />
              {errors.tempo && <p className="absolute -bottom-4 left-1 text-red-500 text-xs">{errors.tempo}</p>}
              <button
                type="button"
                onClick={handleTap}
                className="px-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Tap Tempo"
              >
                TAP
              </button>
              <button
                type="button"
                onClick={toggleMetronome}
                className={`px-3 rounded-xl border transition-colors ${metronomeActive ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400'}`}
                title="Toggle Metronome"
              >
                <i className="fa-solid fa-stopwatch"></i>
              </button>
            </div>
            {metronomeActive && (
              <div className="mt-2 flex items-center gap-2 animate-fadeIn">
                <div className={`w-2 h-2 rounded-full transition-all duration-75 ${beatFlash ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-150' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Metronome Active</span>
              </div>
            )}
          </div>

          {/* Keywords */}
          <div className="md:col-span-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Keywords / Tags</label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g., hymn classic worship"
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
              value={keywordsInput}
              onChange={e => {
                const val = e.target.value;
                setKeywordsInput(val);
                setFormData(prev => ({ ...prev, keywords: val.split(/\s+/).filter(Boolean) }));
              }}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase font-bold tracking-wider">Alpha-numeric (intl allowed) and hyphen only, space separated</p>
            {errors.keywords && <p className="text-red-500 text-xs mt-1 ml-1">{errors.keywords}</p>}
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Language</label>
            <input
              id="language"
              name="language"
              type="text"
              list="language-options"
              value={formData.language || ''}
              onChange={e => setFormData({ ...formData, language: e.target.value })}
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="e.g., English"
            />
            <datalist id="language-options">
              {Object.values(Languages)
                .filter(lang => lang) // Filter out empty string from enum
                .map(lang => (
                  <option key={lang} value={lang.charAt(0).toUpperCase() + lang.slice(1)} />
                ))
              }
            </datalist>
          </div>
        </div> 

        {/* PDF Toggle & Lyrics Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 flex items-center space-x-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
            <input
              id="pdf-check"
              type="checkbox"
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              checked={formData.isPdf}
              onChange={e => setFormData({ ...formData, isPdf: e.target.checked })}
            />
            <label htmlFor="pdf-check" className="text-sm font-bold text-blue-900 dark:text-blue-100 select-none cursor-pointer">
              This song uses a PDF file instead of ChordPro-like text
            </label>
          </div>

          <div className="md:col-span-1 flex flex-col gap-2">
            <select
              aria-label="Search Provider"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs p-2 focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchProvider}
              onChange={e => setSearchProvider(e.target.value as any)}
            >
              <option value="auto">Auto-detect</option>
              <option value="hopamviet">Hop Am Viet</option>
              <option value="ultimate">Ultimate Guitar</option>
              <option value="google">Google Search</option>
            </select>
            <button
              type="button"
              onClick={handleLyricsSearch}
              disabled={!formData.title?.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-2xl border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title={searchLabel}
            >
              <i className="fa-solid fa-magnifying-glass"></i>
              Search for lyrics
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div>
          {formData.isPdf ? (
            <PdfUploader
              songId={formData.id}
              currentPdfUrl={formData.pdfUrl}
              validationError={errors.pdfUrl}
              onUploadSuccess={(url, id) => {
                setFormData(prev => ({ ...prev, id, isPdf: true, pdfUrl: url, body: '' }));
                setError(null);
                setErrors(prev => ({ ...prev, pdfUrl: undefined }));
              }}
              onUploadError={(msg) => setError(msg)}
            />
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Lyrics & Chords (ChordPro-like format)</label>
              <textarea
                rows={15}
                required={!formData.isPdf}
                placeholder="[G]Amazing [G7]grace! How [C]sweet the [G]sound..."
                className="w-full rounded-2xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-4 font-mono text-md focus:ring-2 focus:ring-blue-500 transition-all min-h-[400px] placeholder-gray-400"
                value={formData.body}
                onChange={e => setFormData({ ...formData, body: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isDirty ? 'Cancel' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={!formData.title?.trim() || !isDirty}
            className={`px-8 py-3 rounded-xl font-bold transition-all border ${
              !formData.title?.trim() || !isDirty ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
          >
            Save
          </button>
          <button
            type="submit"
            disabled={!formData.title?.trim() || !isDirty}
            className={`px-8 py-3 rounded-xl font-bold shadow-xl shadow-blue-200 dark:shadow-none hover:-translate-y-0.5 transition-all ${
              !formData.title?.trim() || !isDirty ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Save & Exit
          </button>
        </div>
      </form>
    </div>
  );
};

export default SongForm;
