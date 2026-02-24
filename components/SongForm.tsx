
import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { useMetronome } from '../hooks/useMetronome.ts';

interface SongFormProps {
  song?: Song;
  onSave: (song: Partial<Song>) => void;
  onCancel: () => void;
}

const LANGUAGES = ['English', 'Vietnamese', 'French', 'Spanish'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const DEFAULT_FORM_DATA: Partial<Song> = {
  title: '',
  authors: '',
  body: '',
  key: '',
  tempo: undefined,
  keywords: [],
  language: 'English',
  isPdf: false,
  pdfData: ''
};

const SongForm: React.FC<SongFormProps> = ({ song, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Song>>(DEFAULT_FORM_DATA);

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    tempo: metronomeTempo, 
    tap: handleTap, 
    active: metronomeActive, 
    toggle: toggleMetronome, 
    beatFlash 
  } = useMetronome(formData.tempo);

  useEffect(() => {
    if (song) {
      setFormData(song);
    }
  }, [song]);

  // Sync tapped tempo back to form
  useEffect(() => {
    if (metronomeTempo !== undefined && metronomeTempo !== formData.tempo) {
      setFormData(prev => ({ ...prev, tempo: metronomeTempo }));
    }
  }, [metronomeTempo]);

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be under 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setFormData({ ...formData, pdfData: e.target.result as string });
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const validateKeywords = (val: string) => {
    return val.split(' ').every(word => /^[\p{L}\p{N}-]*$/u.test(word));
  };

  const handleSave = () => {
    console.log("Attempting to save song with data:", formData);
    if (!formData.title || formData.title.length > 80) {
      setError('Title is required and must be max 80 characters.');
      return;
    }
    if (formData.keywords && !validateKeywords(Array.isArray(formData.keywords) ? formData.keywords.join(' ') : formData.keywords)) {
      setError('Keywords must be alpha-numeric (international allowed) and hyphen only, separated by spaces.');
      return;
    }
    if (formData.tempo !== undefined && (formData.tempo < 0 || formData.tempo > 400)) {
      setError('Tempo must be a positive number (or 0) less than or equal to 400.');
      return;
    }
    if (formData.isPdf && !formData.pdfData) {
      setError('Please upload a PDF file.');
      return;
    }
    onSave(formData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleCancel = () => {
    const initialData = song || DEFAULT_FORM_DATA;
    // Check if form data has changed from initial state
    if (JSON.stringify(formData) !== JSON.stringify(initialData)) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
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
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all"
          >
            Save
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
          </div>

          {/* Tempo */}
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Tempo (BPM)</label>
            <div className="flex space-x-2">
              <input
                type="number"
                min={0}
                max={400}
                placeholder="e.g., 120"
                className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
                value={formData.tempo ?? ''}
                onChange={e => setFormData({ ...formData, tempo: e.target.value === '' ? undefined : parseInt(e.target.value) })}
              />
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
              value={Array.isArray(formData.keywords) ? formData.keywords.join(' ') : formData.keywords}
              onChange={e => setFormData({ ...formData, keywords: e.target.value.split(' ') })}
            />
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase font-bold tracking-wider">Alpha-numeric (intl allowed) and hyphen only, space separated</p>
          </div>

          {/* Language */}
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Language</label>
            <input
              list="languages"
              placeholder="Select or type..."
              className="w-full rounded-xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-400"
              value={formData.language}
              onChange={e => setFormData({ ...formData, language: e.target.value })}
            />
            <datalist id="languages">
              {LANGUAGES.map(lang => <option key={lang} value={lang} />)}
            </datalist>
          </div>
        </div>

        {/* PDF Toggle */}
        <div className="flex items-center space-x-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
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

        {/* Content Area */}
        <div>
          {formData.isPdf ? (
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
                dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
              } ${formData.pdfData ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''}`}
            >
              <input 
                type="file" 
                className="hidden" 
                id="pdf-upload" 
                accept="application/pdf"
                onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {formData.pdfData ? (
                  <div className="space-y-2">
                    <i className="fa-solid fa-file-circle-check text-5xl text-green-500 dark:text-green-400"></i>
                    <p className="text-green-700 dark:text-green-300 font-bold">PDF Ready (Under 4MB)</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <i className="fa-solid fa-file-pdf text-5xl text-gray-400 dark:text-gray-500"></i>
                    <div>
                      <p className="text-lg font-bold text-gray-700 dark:text-gray-200">Drop PDF here</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse</p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Lyrics & Chords (ChordPro-like format)</label>
              <textarea
                rows={15}
                required={!formData.isPdf}
                placeholder="[G]Amazing [G7]grace! How [C]sweet the [G]sound..."
                className="w-full rounded-2xl border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 transition-all min-h-[400px] placeholder-gray-400"
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
            Cancel
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none hover:-translate-y-0.5 transition-all"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default SongForm;
