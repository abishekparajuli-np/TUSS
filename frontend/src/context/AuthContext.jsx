import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebaseInit';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Set loading=true at the START so ProtectedRoute waits during async
      // Firestore role check — prevents race condition that bounces to /login
      setLoading(true);
      try {
        if (user) {
          // Try to fetch user role from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (!userDoc.exists()) {
              // No Firestore doc found — warn but still allow authenticated user through
              console.warn(
                `⚠️ No Firestore document at users/${user.uid}.\n` +
                `Run: python admin.py create-doctor <email> <password> <name> <clinic>\n` +
                `Allowing user through for now.`
              );
              // Fail-open: trust Firebase Auth, let user through
              setCurrentUser(user);
              setUserRole('doctor');
            } else {
              const userData = userDoc.data();
              if (userData?.role !== 'doctor') {
                console.error(`❌ User ${user.email} does not have role 'doctor' (got: '${userData?.role}')`);
                await signOut(auth);
                setCurrentUser(null);
                setUserRole(null);
              } else {
                setCurrentUser(user);
                setUserRole(userData.role);
              }
            }
          } catch (firestoreErr) {
            // Firestore unavailable (database not created, network error, etc.)
            // Fail-open: trust Firebase Auth authentication
            console.warn(
              '⚠️ Firestore role check failed (database may not be set up yet).\n' +
              'Allowing authenticated user through. Error:', firestoreErr.message
            );
            setCurrentUser(user);
            setUserRole('doctor');
          }
        } else {
          setCurrentUser(null);
          setUserRole(null);
        }
      } catch (err) {
        console.error('Auth state error:', err);
        setCurrentUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    currentUser,
    login,
    logout,
    loading,
    userRole,
  };

  // Always render children so the Router stays mounted.
  // ProtectedRoute reads `loading` from context and shows its own spinner.
  // If we return a spinner here instead of children, the Router unmounts
  // and navigate() calls have nowhere to go.
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
