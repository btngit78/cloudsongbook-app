import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { ProgressBar } from './ProgressBar';
import { db } from '../firebaseConfig';
import { doc, collection } from 'firebase/firestore';

interface PdfUploaderProps {
  songId?: string;
  currentPdfUrl?: string;
  onUploadSuccess: (url: string, songId: string) => void;
  onUploadError: (error: string) => void;
  validationError?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const PdfUploader: React.FC<PdfUploaderProps> = ({ 
  songId, 
  currentPdfUrl, 
  onUploadSuccess, 
  onUploadError,
  validationError
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (currentPdfUrl) {
      try {
        const url = new URL(currentPdfUrl);
        const pathParts = url.pathname.split('/');
        setFileName(decodeURIComponent(pathParts[pathParts.length - 1]));
      } catch {
        setFileName("PDF file");
      }
    } else {
      setFileName(null);
    }
  }, [currentPdfUrl]);

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      onUploadError('Only PDF files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onUploadError('File size must be under 10MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setFileName(file.name);

    // Use provided ID or generate new one if this is a new song
    const targetId = songId || doc(collection(db, 'songs')).id;

    try {
      const downloadUrl = await storageService.uploadSongPdf(file, targetId, (progress) => {
        setUploadProgress(progress);
      });
      onUploadSuccess(downloadUrl, targetId);
    } catch (err) {
      console.error("PDF Upload failed:", err);
      onUploadError('Failed to upload PDF. Please try again.');
      setFileName(null);
    } finally {
      setUploading(false);
    }
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

  return (
    <div 
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all ${
        dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
      } ${currentPdfUrl && !uploading ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''}`}
    >
      <input 
        type="file" 
        className="hidden" 
        id="pdf-upload" 
        accept="application/pdf"
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        disabled={uploading}
      />
      {validationError && <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-red-500 text-xs mt-1">{validationError}</p>}
      
      <label htmlFor="pdf-upload" className={`cursor-pointer ${uploading ? 'cursor-not-allowed' : ''}`}>
        {uploading ? (
          <div className="space-y-2">
            <i className="fa-solid fa-cloud-arrow-up text-5xl text-blue-500 dark:text-blue-400 animate-bounce"></i>
            <p className="text-blue-700 dark:text-blue-300 font-bold">Uploading PDF...</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-full">{fileName}</p>
            <div className="max-w-xs mx-auto pt-2"><ProgressBar progress={uploadProgress} /></div>
          </div>
        ) : currentPdfUrl ? (
          <div className="space-y-2">
            <i className="fa-solid fa-file-circle-check text-5xl text-green-500 dark:text-green-400"></i>
            <p className="text-green-700 dark:text-green-300 font-bold">PDF Uploaded</p>
            <p className="text-xs text-green-600 dark:text-green-400 truncate max-w-full">{fileName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click or drag to replace</p>
          </div>
        ) : (
          <div className="space-y-4">
            <i className="fa-solid fa-file-pdf text-5xl text-gray-400 dark:text-gray-500"></i>
            <div>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-200">Drop PDF here</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">or click to browse</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Max file size: 10MB</p>
            </div>
          </div>
        )}
      </label>
    </div>
  );
};