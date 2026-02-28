import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { app } from '../firebaseConfig'; // Assumes 'app' is exported from your firebase config

const storage = getStorage(app);
const auth = getAuth(app);

export const storageService = {
  /**
   * Uploads a file to Cloud Storage for a specific song.
   * @param file The PDF file to upload.
   * @param songId The ID of the song this file belongs to.
   * @param onProgress Optional callback for upload progress (0-100).
   * @returns The public download URL for the file.
   */
  async uploadSongPdf(file: File, songId: string, onProgress?: (progress: number) => void): Promise<string> {
    const storageRef = ref(storage, `songs/${songId}/${file.name}`);

    return new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    }).catch(async (error: any) => {
      // If unauthorized, the token might be stale (missing the new role).
      // Force a refresh and retry once.
      if (error.code === 'storage/unauthorized' && auth.currentUser) {
        console.warn("Upload unauthorized. Refreshing ID token and retrying...");
        await auth.currentUser.getIdToken(true);
        
        // Recursive retry so we keep the progress callback working
        return this.uploadSongPdf(file, songId, onProgress);
      }
      console.error("Error uploading file:", error);
      throw error; // Re-throw to be handled by the calling component
    });
  }
};