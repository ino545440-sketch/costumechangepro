import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// TODO: Replace with your actual Firebase project configuration
// You can get this from the Firebase Console: Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyD4KsfafKqLXj6HLsVs0i3JWsE7O6laHpA",
  authDomain: "costumechange-pro.firebaseapp.com",
  projectId: "costumechange-pro",
  storageBucket: "costumechange-pro.firebasestorage.app",
  messagingSenderId: "827254541102",
  appId: "1:827254541102:web:b3f3f4c1a2340fb4b708bf",
  measurementId: "G-3BCKLLJQR0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// Hook-like helper to subscribe to auth state
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
