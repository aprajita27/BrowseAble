import { useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import CaretakerDashboard from './CaretakerDashboard';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { db } from '../firebase/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import './AuthPage.css';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);

      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const snapshot = await getDoc(docRef);

          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.role === "caretaker") {
              setUser({ ...currentUser, role: "caretaker" });
            } else {
              setError("You are a user. Please use the extension.");
              signOut(auth);
            }
          } else {
            setError("No role found. Please contact support.");
            signOut(auth);
          }
        } catch (err) {
          setError("An error occurred while fetching your profile.");
          signOut(auth);
        }
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Store role as "caretaker"
      await setDoc(doc(db, "users", uid), {
        role: "caretaker",
        email
      });
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !user) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>BrowseAble</h1>
            <div className="caretaker-badge">Caretaker Portal</div>
          </div>

          <div className="auth-tabs">
            <button
              className={isLogin ? 'active' : ''}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={!isLogin ? 'active' : ''}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={isLogin ? handleLogin : handleSignup}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isLogin ?
                "Don't have an account? " :
                "Already have an account? "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-button"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
        <div className="top-bar"></div>
        <div className="grid"></div>
        <div className="wave"></div>
        <div className="wave-2"></div>
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
        <div className="circle-decoration circle-decoration-1"></div>
        <div className="circle-decoration circle-decoration-2"></div>
        <div className="polygon polygon-1"></div>
        <div className="polygon polygon-2"></div>
      </div>
    );
  }

  if (user?.role === "caretaker") {
    return <CaretakerDashboard />;
  }

  return null;
}