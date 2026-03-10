import { getStorage, ref, uploadBytes, getDownloadURL, uploadBytesResumable, deleteObject, listAll, getMetadata } from "firebase/storage";
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
  },

  /**
   * Deletes a file from Cloud Storage using its download URL.
   * @param url The public download URL of the file to delete.
   */
  async deleteSongPdf(url: string): Promise<void> {
    if (!url) return;
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        console.warn(`Tried to delete a non-existent file: ${url}`);
        return;
      }
      console.error("Error deleting file from storage:", error);
      throw error;
    }
  },

  /**
   * Lists all files in the 'songs' directory and calculates total size.
   * NOTE: This can be resource-intensive if there are many files.
   * This should only be available to Admin users.
   */
  async getStorageUsageDetails(): Promise<{ totalSize: number; files: { path: string; size: number; url: string; songId: string; name: string; }[] }> {
    const listRef = ref(storage, 'songs');
    let totalSize = 0;
    const fileDetails: { path: string; size: number; url: string; songId: string; name: string; }[] = [];

    try {
      const res = await listAll(listRef);
      
      // listAll is not recursive, so we need to go one level deeper for each song folder
      const promises = res.prefixes.map(async (folderRef) => {
        const songId = folderRef.name;
        const songFolderItems = await listAll(folderRef);
        
        for (const itemRef of songFolderItems.items) {
          try {
            const metadata = await getMetadata(itemRef);
            const url = await getDownloadURL(itemRef);
            totalSize += metadata.size;
            fileDetails.push({
              path: itemRef.fullPath,
              size: metadata.size,
              url,
              songId,
              name: metadata.name,
            });
          } catch (e) {
            console.error(`Could not get metadata for ${itemRef.fullPath}`, e);
          }
        }
      });

      await Promise.all(promises);
      return { totalSize, files: fileDetails.sort((a, b) => a.path.localeCompare(b.path)) };
    } catch (error) {
      console.error("Error getting storage usage details:", error);
      throw error;
    }
  },

  /**
   * Deletes a file from Cloud Storage using its full path.
   * @param filePath The full path of the file to delete (e.g., 'songs/songId/filename.pdf').
   */
  async deleteFileByPath(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        console.warn(`Tried to delete a non-existent file by path: ${filePath}`);
        return;
      }
      console.error("Error deleting file from storage by path:", error);
      throw error;
    }
  }
};