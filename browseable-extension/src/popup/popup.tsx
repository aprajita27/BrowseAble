import { useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { getDocs, collection } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { db } from '../firebase/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './popup.css';

export default function Popup() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [featureList, setFeatureList] = useState<Record<string, string>>({});
  const [modeList, setModeList] = useState<Record<string, string>>({});
  const [selectedModes, setSelectedModes] = useState<Record<string, boolean>>({});
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [wantsCaretaker, setWantsCaretaker] = useState(false);
  // Add this new state along with your other state declarations at the top:
  const [userWantsCaretaker, setUserWantsCaretaker] = useState(false);

  const fetchModesAndFeatures = async () => {
    const featureSnap = await getDocs(collection(db, "features"));
    const featureData: Record<string, string> = {};
    featureSnap.forEach(doc => {
      featureData[doc.id] = doc.data().label;
    });
    setFeatureList(featureData);
    const modeSnap = await getDocs(collection(db, "modes"));
    const modeData: Record<string, string> = {};
    modeSnap.forEach(doc => {
      modeData[doc.id] = doc.data().label;
    });
    setModeList(modeData);
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsLoggedIn(true);

        const docRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.role === "caretaker") {
            alert("You are a caretaker. Please use the caretaker web app.");
            signOut(auth);
          } else {
            // Set the caretaker flag from the user's data
            setUserWantsCaretaker(!!data.wantsCaretaker);
            if (data.features) {
              setFeatures(data.features);
              chrome.storage.sync.set({ features: data.features });
            }
            if (data.modes) {
              setSelectedModes(data.modes);
              chrome.storage.sync.set({ modes: data.modes });
            }
            await fetchModesAndFeatures();
          }
        }
      } else {
        setIsLoggedIn(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Fetch available features and set all to false
      const featureSnap = await getDocs(collection(db, "features"));
      const featuresInit: Record<string, boolean> = {};
      featureSnap.forEach(doc => {
        featuresInit[doc.id] = false;
      });

      // Fetch available modes and set all to false
      const modeSnap = await getDocs(collection(db, "modes"));
      const modesInit: Record<string, boolean> = {};
      modeSnap.forEach(doc => {
        modesInit[doc.id] = false;
      });

      // Store user profile data in Firestore with all fields
      await setDoc(doc(db, "users", uid), {
        role: "user",
        email,
        firstName,
        lastName,
        wantsCaretaker,  // this will be true or false based on the radio selection
        features: featuresInit,
        modes: modesInit
      });
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred.");
      }
    }
  };;

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred.");
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const toggleFeature = async (key: string) => {
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    chrome.storage.sync.set({ features: updated });

    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { features: updated }, { merge: true });
    }
  };

  const toggleMode = async (key: string) => {
    const updated = { ...selectedModes, [key]: !selectedModes[key] };
    setSelectedModes(updated);
    chrome.storage.sync.set({ modes: updated });

    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { modes: updated }, { merge: true });
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-container">
        <h3 className="auth-title">🔒 {isSignup ? "Create an Account" : "Login to BrowseAble"}</h3>

        {isSignup && (
          <>
            <input
              className="auth-input"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="auth-input"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />

            <div style={{ marginBottom: '15px', marginTop: '8px' }}>
              <span style={{ marginRight: '10px', fontSize: '14px' }}>Do you want a caretaker?</span>
              <label className="radio-option">
                <input
                  type="radio"
                  name="wantsCaretaker"
                  checked={wantsCaretaker === true}
                  onChange={() => setWantsCaretaker(true)}
                />
                Yes
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="wantsCaretaker"
                  checked={wantsCaretaker === false}
                  onChange={() => setWantsCaretaker(false)}
                />
                No
              </label>
            </div>
          </>
        )}

        <input
          className="auth-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="auth-input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isSignup ? (
          <>
            <button className="auth-btn" onClick={handleSignup}>Sign Up</button>
            <p className="auth-switch">
              Already have an account? <button onClick={() => setIsSignup(false)}>Login</button>
            </p>
          </>
        ) : (
          <>
            <button className="auth-btn" onClick={handleLogin}>Login</button>
            <p className="auth-switch">
              Don't have an account? <button onClick={() => setIsSignup(true)}>Sign Up</button>
            </p>
          </>
        )}
      </div>
    );
  }

  // If the user wants a caretaker, do not show the feature/mode controls.
  if (userWantsCaretaker) {
    return (
      <div style={{ padding: '1rem' }}>
        <h3>Welcome!</h3>
        <p>Your caretaker will control your settings.</p>
        <button style={{ marginTop: '10px' }} onClick={handleLogout}>
          Logout
        </button>
      </div>
    );
  }

  // Otherwise, show the feature and mode controls.
  return (
    <div className="container">
      <h2 className="heading">✨ Welcome to BrowseAble ✨</h2>

      {userWantsCaretaker ? (
        <p className="notice">
          Your caretaker will manage your preferences.
        </p>
      ) : (
        <>
          <div>
            <h4 className="section-title">🧠 Select Your Modes:</h4>
            {Object.entries(modeList).map(([key, label]) => (
              <label key={key} className="checkbox-group">
                <input
                  type="checkbox"
                  checked={!!selectedModes[key]}
                  onChange={() => toggleMode(key)}
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <h4 className="section-title">⚙️ Select Your Features:</h4>
            {Object.entries(featureList).map(([key, label]) => (
              <label key={key} className="checkbox-group">
                <input
                  type="checkbox"
                  checked={!!features[key]}
                  onChange={() => toggleFeature(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </>
      )}

      <button
        onClick={handleLogout}
        className="primary-btn">
        Logout
      </button>
    </div>
  );
}