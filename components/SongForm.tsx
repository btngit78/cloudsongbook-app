
import React, { useState, useEffect } from 'react';
import { Song } from '../types';

interface SongFormProps {
  song?: Song;
  onSave: (song: Partial<Song>) => void;
  onCancel: () => void;
}

const LANGUAGES = ['English', 'Vietnamese', 'French', 'Spanish'];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const SongForm: React.FC<SongFormProps> = ({ song, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<Song>>({
    title: '',
    author: '',
    body: '',
    key: '',
    tempo: undefined,
    keywords: '',
    language: 'English',
    isPdf: false,
    pdfData: ''
  });

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (song) {
      setFormData(song);
    }
  }, [song]);

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
    if (!formData.title || formData.title.length > 80) {
      setError('Title is required and must be max 80 characters.');
      return;
    }
    if (formData.keywords && !validateKeywords(formData.keywords)) {
      setError('Keywords must be alpha-numeric (international allowed) and hyphen only, separated by spaces.');
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

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-3xl shadow-xl mt-8 mb-12">
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {song ? 'Edit Song' : 'Add New Song'}
        </h2>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
          >
            Save
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg">
          <i className="fa-solid fa-circle-exclamation mr-2"></i>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">Song Title *</label>
            <input
              type="text"
              required
              maxLength={80}
              placeholder="e.g., Amazing Grace"
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Author(s)</label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g., John Newton"
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.author}
              onChange={e => setFormData({ ...formData, author: e.target.value })}
            />
          </div>

          {/* Key */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Key</label>
            <input
              type="text"
              placeholder="e.g., G, C#m, Bb"
              pattern="^[A-G][#b]?m?$"
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.key}
              onChange={e => setFormData({ ...formData, key: e.target.value })}
            />
          </div>

          {/* Tempo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Tempo (BPM)</label>
            <input
              type="number"
              max={400}
              placeholder="e.g., 120"
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.tempo || ''}
              onChange={e => setFormData({ ...formData, tempo: parseInt(e.target.value) || undefined })}
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Language</label>
            <input
              list="languages"
              placeholder="Select or type..."
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.language}
              onChange={e => setFormData({ ...formData, language: e.target.value })}
            />
            <datalist id="languages">
              {LANGUAGES.map(lang => <option key={lang} value={lang} />)}
            </datalist>
          </div>

          {/* Keywords */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">Keywords / Tags</label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g., hymn classic worship"
              className="w-full rounded-xl border-gray-200 shadow-sm border p-3 focus:ring-2 focus:ring-blue-500 transition-all"
              value={formData.keywords}
              onChange={e => setFormData({ ...formData, keywords: e.target.value })}
            />
            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Alpha-numeric (intl allowed) and hyphen only, space separated</p>
          </div>
        </div>

        {/* PDF Toggle */}
        <div className="flex items-center space-x-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <input
            id="pdf-check"
            type="checkbox"
            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
            checked={formData.isPdf}
            onChange={e => setFormData({ ...formData, isPdf: e.target.checked })}
          />
          <label htmlFor="pdf-check" className="text-sm font-bold text-blue-900 select-none cursor-pointer">
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
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
              } ${formData.pdfData ? 'bg-green-50 border-green-300' : ''}`}
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
                    <i className="fa-solid fa-file-circle-check text-5xl text-green-500"></i>
                    <p className="text-green-700 font-bold">PDF Ready (Under 4MB)</p>
                    <p className="text-xs text-green-600">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <i className="fa-solid fa-file-pdf text-5xl text-gray-400"></i>
                    <div>
                      <p className="text-lg font-bold text-gray-700">Drop PDF here</p>
                      <p className="text-sm text-gray-500">or click to browse</p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Lyrics & Chords (ChordPro-like format)</label>
              <textarea
                rows={15}
                required={!formData.isPdf}
                placeholder="[G]Amazing [G7]grace! How [C]sweet the [G]sound..."
                className="w-full rounded-2xl border-gray-200 shadow-sm border p-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 transition-all min-h-[400px]"
                value={formData.body}
                onChange={e => setFormData({ ...formData, body: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4 pt-8 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-200 hover:-translate-y-0.5 transition-all"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

export default SongForm;
