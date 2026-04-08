import * as functions from "firebase-functions";
import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {onObjectFinalized} from "firebase-functions/v2/storage";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {StorageObjectData} from "firebase-functions/v2/storage";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as path from "path";
import pdf from "pdf-parse";

admin.initializeApp();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript
const db = admin.firestore();
const storage = admin.storage();

export const extractTextFromPdf = onObjectFinalized(async (event) => {
  const file: StorageObjectData = event.data;
  // event.data contains the ObjectMetadata
  if (!file) {
    console.error("No file metadata found in event.");
    return;
  }

  // --- 1. Get file metadata ---
  const fileBucket = file.bucket;
  const filePath = file.name;
  const contentType = file.contentType;

  // --- 2. Validate the file ---
  // Exit if this is not a PDF.
  if (!contentType || !contentType.startsWith("application/pdf")) {
    return functions.logger.log(`File ${filePath} is not a PDF.`);
  }

  // Exit if the file is not in the 'songs/' directory.
  if (!filePath || !filePath.startsWith("songs/")) {
    return functions.logger.log(`File ${filePath} is not in a song folder.`);
  }

  // --- 3. Extract Song ID from path ---
  // Path format is "songs/SONG_ID/filename.pdf"
  const pathParts = filePath.split("/");
  if (pathParts.length < 3) {
    return functions.logger.warn(`Invalid file path structure: ${filePath}`);
  }
  const songId = pathParts[1];
  const fileName = path.basename(filePath);

  functions.logger.log(
    `Processing PDF "${fileName}" for song ID: ${songId}.`);

  // --- 4. Download and Parse the PDF ---
  const bucket = storage.bucket(fileBucket);
  const pdfFile = bucket.file(filePath);

  try {
    const [pdfBuffer] = await pdfFile.download();
    functions.logger.log("PDF downloaded successfully.");

    // Use pdf-parse to extract text content
    const data = await pdf(pdfBuffer);
    const extractedText = data.text;

    if (!extractedText) {
      functions.logger.warn(`No text could be extracted from ${fileName}.`);
    }

    // --- 5. Update Firestore Document ---
    await db.collection("songs").doc(songId).update({
      body: extractedText || "", // Save empty string if no text found
    });

    functions.logger.log(
      `Successfully updated song ${songId} with extracted PDF text.`);
  } catch (error) {
    functions.logger.error(
      `Failed to process PDF for song ${songId}.`, error);
    // Optional: Update the document to indicate an error occurred
    await db.collection("songs").doc(songId).update({
      body:
`[PDF_EXTRACTION_ERROR] Failed to process ${fileName}. Please re-upload.`,
    });
  }
});

/**
 * Syncs the 'role' field from Firestore to Firebase Auth Custom Claims.
 * Triggered whenever a document in the 'users' collection is created or
 * updated.
 */
export const syncRoleToUserClaims = onDocumentWritten(
  "users/{userId}", async (event) => {
    const userId = event.params.userId;
    const newData = event.data?.after.data();
    const previousData = event.data?.before.data();

    // 1. Get the new and old role values
    // If document was deleted, newData is undefined
    const newRole = newData?.role;
    const previousRole = previousData?.role;

    // 2. Check if the role has actually changed
    if (newRole === previousRole) {
      // No change in role, stop execution
      return null;
    }

    console.log(`Syncing role '${newRole}' for user ${userId}`);

    try {
      // 3. Set the custom claims
      // WARNING: setCustomUserClaims overwrites *all* existing custom
      // claims for this user. If you use other claims, you should fetch
      // the user first, get existing claims, and merge.
      const customClaims = {
        role: newRole,
      };

      await admin.auth().setCustomUserClaims(userId, customClaims);

      console.log(`Successfully updated custom claims for ${userId}`);

      // Optional: Update a timestamp in Firestore so the client knows
      // the claim is ready
      // if (change.after.exists) {
      //   await change.after.ref.set({ claimsUpdatedAt:
      //   admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      // }
    } catch (error) {
      console.error("Error setting custom claims:", error);
    }

    return null;
  });

export const deleteUser = onCall({
  // Explicitly allow common origins to ensure preflight success for
  // credentialed requests
  cors: true,
}, async (request) => {
  // 1. Authentication and Authorization
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const callerUid = request.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();
  const callerData = callerDoc.data();

  if (callerData?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }

  const {userId, contentOption} = request.data;
  if (!userId || !contentOption ||
    !["transfer", "delete"].includes(contentOption)) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with 'userId' and " +
      "'contentOption' ('transfer' or 'delete')."
    );
  }

  if (userId === callerUid) {
    throw new HttpsError(
      "invalid-argument",
      "Admins cannot delete themselves."
    );
  }

  try {
    // 2. Handle user content in Firestore
    const songsRef = db.collection("songs");
    const setlistsRef = db.collection("setlists");
    const userSongsQuery = songsRef.where("ownerId", "==", userId);
    const userSetlistsQuery = setlistsRef.where("ownerId", "==", userId);

    const songsSnapshot = await userSongsQuery.get();
    const setlistsSnapshot = await userSetlistsQuery.get();

    const batch = db.batch();

    songsSnapshot.forEach((doc) => {
      if (contentOption === "delete") {
        batch.delete(doc.ref);
      } else { // transfer to the calling admin
        batch.update(doc.ref, {ownerId: callerUid});
      }
    });

    setlistsSnapshot.forEach((doc) => {
      if (contentOption === "delete") {
        batch.delete(doc.ref);
      } else { // transfer to the calling admin
        batch.update(doc.ref, {ownerId: callerUid});
      }
    });

    // 3. Delete the user document from 'users' collection
    const userDocRef = db.collection("users").doc(userId);
    batch.delete(userDocRef);

    // Commit all Firestore changes
    await batch.commit();

    // 4. Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);

    return {success: true, message: `Successfully deleted user ${userId}.`};
  } catch (error) {
    console.error(`Error deleting user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "An internal error occurred while deleting the user."
    );
  }
});

export const sendWelcomeEmail = onCall({
  cors: true,
}, async (request) => {
  try {
    // 1. Authentication and Authorization
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const callerUid = request.auth.uid;
    const callerDoc = await db.collection("users").doc(callerUid).get();
    const callerData = callerDoc.data();

    if (callerData?.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admins can perform this action."
      );
    }

    // Safe destructuring in case request.data is null
    const data = request.data || {};
    const userId = data.userId;

    if (!userId) {
      throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'userId'."
      );
    }

    // 2. Get user details
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();
    const userEmail = userData?.email;
    const userName = userData?.name || "there";

    if (!userEmail) {
      throw new HttpsError(
        "failed-precondition", "User does not have an email address.");
    }

    // 3. Send the email (placeholder logic)
    // In a real app, integrate a service like SendGrid, Mailgun,
    // or Nodemailer here.
    logger.log(`Simulating sending welcome email to ${userEmail} ` +
      `for user ${userId}.`);

    // 4. Update the user document to mark that a welcome email has been sent
    await db.collection("users").doc(userId).set(
      {welcomeEmailSentAt: Date.now()}, {merge: true});

    return {success: true, message: `Welcome email sent to ${userName}.`};
  } catch (error) {
    logger.error("Error sending welcome email:", error);
    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal",
      "An internal error occurred.");
  }
});
