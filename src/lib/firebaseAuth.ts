import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../firebase';

const provider = new GoogleAuthProvider();
// Request Workspace scopes for Picker
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

let _isSigningIn = false;
let cachedAccessToken: string | null = null;

// Helper to silently request Google OAuth token using Google Identity Services (GSI) - Disabled since GSI is removed
export const requestSilentToken = (_email: string): Promise<string | null> => {
  return Promise.resolve(null);
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Call success callback immediately
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    _isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken || '' };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    _isSigningIn = false;
  }
};

export const emailSignUp = async (username: string, password: string): Promise<User> => {
  const email = `${username.toLowerCase().trim()}@studysync.local`;
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const emailSignIn = async (username: string, password: string): Promise<User> => {
  const email = `${username.toLowerCase().trim()}@studysync.local`;
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

