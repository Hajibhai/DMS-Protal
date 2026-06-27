import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-1befa271-378d-46fb-90e8-ebc035d1db13');
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/meetings.space.created");
googleProvider.addScope("https://www.googleapis.com/auth/meetings.space.readonly");
googleProvider.addScope("https://www.googleapis.com/auth/chat.spaces");
googleProvider.addScope("https://www.googleapis.com/auth/chat.memberships");
googleProvider.addScope("https://www.googleapis.com/auth/chat.messages.create");
googleProvider.addScope("https://www.googleapis.com/auth/classroom.courses");
googleProvider.addScope("https://www.googleapis.com/auth/classroom.coursework.me");
googleProvider.addScope("https://www.googleapis.com/auth/classroom.announcements");
googleProvider.addScope("https://www.googleapis.com/auth/classroom.rosters");
googleProvider.addScope("https://www.googleapis.com/auth/classroom.topics");
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Cache the access token in memory.
let cachedGoogleAccessToken: string | null = null;

export const getGoogleAccessToken = () => cachedGoogleAccessToken;
export const setGoogleAccessToken = (token: string | null) => {
  cachedGoogleAccessToken = token;
};

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    cachedGoogleAccessToken = credential.accessToken;
  }
  return result;
};

export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const logout = async () => {
  cachedGoogleAccessToken = null;
  await signOut(auth);
};
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

// Function to create a user without logging in (using a secondary app instance)
export const adminCreateUser = async (email: string, pass: string) => {
  const secondaryAppName = `Secondary_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await signOut(secondaryAuth);
    // Delete the secondary app to clean up
    await deleteApp(secondaryApp);
    return userCredential.user;
  } catch (error) {
    try { await deleteApp(secondaryApp); } catch (e) {}
    throw error;
  }
};

// Function to delete a user from Auth (requires their email and password)
export const adminDeleteUser = async (email: string, pass: string) => {
  const secondaryAppName = `DeleteUserApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    console.log(`Attempting to delete Auth user: ${email}`);
    const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, pass);
    const user = userCredential.user;
    await deleteUser(user);
    console.log(`Successfully deleted Auth user: ${email}`);
    await deleteApp(secondaryApp);
  } catch (error: any) {
    console.warn(`Auth deletion error for ${email}:`, error.code || error.message);
    try { await deleteApp(secondaryApp); } catch (e) {}
    
    // If user is already gone or password changed, we don't want to block Firestore deletion
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      console.log("User not found in Auth or invalid credentials, proceeding...");
      return; 
    }
    throw error;
  }
};

// Function to update user credentials/password in Auth
export const adminUpdateUser = async (oldEmail: string, oldPass: string, newEmail: string, newPass: string) => {
  const secondaryAppName = `UpdateUserApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    console.log(`Attempting to update Auth user from ${oldEmail} to ${newEmail}`);
    let user;
    try {
      const userCredential = await signInWithEmailAndPassword(secondaryAuth, oldEmail, oldPass);
      user = userCredential.user;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        console.log("Old credentials not found in Auth or password mismatch, trying to create new user credentials directly...");
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPass);
          user = userCredential.user;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            console.log(`New email ${newEmail} already exists in Auth. Checking if it is an orphan to clean up...`);
            // Attempt to login to target email with both newPass and oldPass to delete it
            let orphanCredential = null;
            try {
              orphanCredential = await signInWithEmailAndPassword(secondaryAuth, newEmail, newPass);
            } catch (p1) {
              try {
                orphanCredential = await signInWithEmailAndPassword(secondaryAuth, newEmail, oldPass);
              } catch (p2) {}
            }

            if (orphanCredential) {
              console.log(`Found orphan user ${newEmail} in Auth. Deleting to clean up...`);
              await deleteUser(orphanCredential.user);
              // Now create the user credentials again
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPass);
              user = userCredential.user;
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      } else {
        throw err;
      }
    }

    if (newEmail !== oldEmail) {
      try {
        await updateEmail(user, newEmail);
      } catch (updateEmailErr: any) {
        if (updateEmailErr.code === 'auth/email-already-in-use') {
          console.log(`Target email ${newEmail} already exists in Auth. Checking if it is an orphan to clean up...`);
          const orphanAppName = `OrphanCleanApp_${Date.now()}`;
          const orphanApp = initializeApp(firebaseConfig, orphanAppName);
          const orphanAuth = getAuth(orphanApp);
          try {
            let orphanCredential = null;
            try {
              orphanCredential = await signInWithEmailAndPassword(orphanAuth, newEmail, newPass);
            } catch (p1) {
              try {
                orphanCredential = await signInWithEmailAndPassword(orphanAuth, newEmail, oldPass);
              } catch (p2) {}
            }

            if (orphanCredential) {
              console.log(`Found orphan user ${newEmail}. Deleting it to complete email update...`);
              await deleteUser(orphanCredential.user);
              await signOut(orphanAuth);
              await deleteApp(orphanApp);
              
              // Retry the update email
              await updateEmail(user, newEmail);
            } else {
              await signOut(orphanAuth);
              await deleteApp(orphanApp);
              throw updateEmailErr;
            }
          } catch (cleanupErr) {
            try { await deleteApp(orphanApp); } catch (e) {}
            throw updateEmailErr;
          }
        } else {
          throw updateEmailErr;
        }
      }
    }
    if (newPass !== oldPass) {
      await updatePassword(user, newPass);
    }
    
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    return user;
  } catch (error) {
    try { await deleteApp(secondaryApp); } catch (e) {}
    throw error;
  }
};
