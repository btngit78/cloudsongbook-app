import { useState, useEffect } from 'react';
import { User, UserRole, UserSettings } from '../types';
import { MOCK_USER } from '../constants';
import { dbService } from '../services/dbService';
import { auth, googleProvider } from '../firebaseConfig';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  signOut
} from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Initialize user from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('cloudsong_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('cloudsong_user');
      }
    }
  }, []);

  const getAuthErrorMessage = (error: any): string => {
    switch (error.code) {
      case 'auth/invalid-credential': return "Invalid email or password.";
      case 'auth/email-already-in-use': return "An account with this email already exists.";
      case 'auth/weak-password': return "Password should be at least 6 characters.";
      case 'auth/user-not-found': return "No user found with this email.";
      case 'auth/invalid-email': return "Invalid email address.";
      case 'auth/popup-closed-by-user': return "";
      default: return error.message || "An authentication error occurred.";
    }
  };

  const handleSignInSuccess = async (firebaseUser: FirebaseUser) => {
    try {
      const userAuthData: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
        email: firebaseUser.email!,
        role: UserRole.FREE,
        settings: { ...MOCK_USER.settings }
      };

      const syncedUser = await dbService.syncUser(userAuthData);
      setUser(syncedUser);
      localStorage.setItem('cloudsong_user', JSON.stringify(syncedUser));
      return syncedUser;
    } catch (error) {
      console.error("Error syncing user:", error);
      setAuthError("Failed to sync user data.");
      throw error;
    }
  };

  const handleEmailSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // BUG FIX: Explicitly create the user object and await the DB sync 
      // BEFORE signing out or sending verification.
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || email.split('@')[0],
        email: firebaseUser.email || '',
        role: UserRole.FREE,
        settings: { ...MOCK_USER.settings }
      };
      
      await dbService.syncUser(newUser);
      
      await sendEmailVerification(firebaseUser, { url: window.location.origin });
      await signOut(auth); // User must verify before they can log in.
      
      setVerificationSent(true);

      // Simplified: Log in immediately
      // await handleSignInSuccess(firebaseUser);
      
      setIsSignUp(false);
      setAuthError(null);
    } catch (error: any) {
      console.error("Sign Up Error:", error);
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleEmailSignIn = async () => {
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      if (!firebaseUser.emailVerified) {
        setAuthError("Please verify your email to log in. Check your inbox.");
        await signOut(auth);
        return;
      }
      await handleSignInSuccess(firebaseUser);
    } catch (error: any) {
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetSent(false);
    setVerificationSent(false);

    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    if (isSignUp) await handleEmailSignUp();
    else await handleEmailSignIn();
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleSignInSuccess(result.user);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError("Google login failed. Please try again.");
      }
    }
  };

  const handlePasswordReset = async () => {
    setAuthError(null);
    setResetSent(false);
    if (!email) {
      setAuthError("Please enter your email address first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (error: any) {
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout error", e);
    }
    setUser(null);
    localStorage.removeItem('cloudsong_user');
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
  };

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const updatedUser = {
        ...prevUser,
        settings: { ...prevUser.settings, ...newSettings }
      };
      dbService.updateUserSettings(prevUser.id, newSettings);
      localStorage.setItem('cloudsong_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  return {
    user,
    showEmailForm, setShowEmailForm,
    email, setEmail,
    password, setPassword,
    isSignUp, setIsSignUp,
    authError,
    resetSent,
    verificationSent,
    handleEmailAuth,
    handleGoogleLogin,
    handleLogout,
    handlePasswordReset,
    handleUpdateSettings
  };
};
