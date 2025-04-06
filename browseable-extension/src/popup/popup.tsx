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
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [wantsCaretaker, setWantsCaretaker] = useState(false);
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
            setUserWantsCaretaker(!!data.wantsCaretaker);

            // Set features and modes in state
            const userFeatures = data.features || {};
            const userSelectedMode = data.selectedMode || 'adhd';

            setFeatures(userFeatures);
            chrome.storage.sync.set({ features: userFeatures });

            if (data.modes) {
              setSelectedModes(data.modes);
              chrome.storage.sync.set({ modes: data.modes });
            }

            if (userSelectedMode) {
              setSelectedMode(userSelectedMode);
              chrome.storage.sync.set({ neurotype: userSelectedMode });
            }

            // Send ALL user data to background script on login
            chrome.runtime.sendMessage({
              type: 'userLoggedIn',
              user: user.uid,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || user.email || '',
              neurotype: userSelectedMode,
              features: userFeatures
            });

            await fetchModesAndFeatures();
          }
        }
      } else {
        // User has logged out
        setIsLoggedIn(false);

        // Notify background script about logout
        chrome.runtime.sendMessage({
          type: 'userLoggedOut'
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      const featureSnap = await getDocs(collection(db, "features"));
      const featuresInit: Record<string, boolean> = {};
      featureSnap.forEach(doc => {
        featuresInit[doc.id] = false;
      });

      const modeSnap = await getDocs(collection(db, "modes"));
      const modesInit: Record<string, boolean> = {};
      modeSnap.forEach(doc => {
        modesInit[doc.id] = false;
      });

      await setDoc(doc(db, "users", uid), {
        role: "user",
        email,
        firstName,
        lastName,
        wantsCaretaker,
        features: featuresInit
      });
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred.");
      }
    }
  };

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

    // Send updated features to background script
    chrome.runtime.sendMessage({
      type: 'updateFeatures',
      features: updated
    });

    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { features: updated }, { merge: true });
    }
  };

  const toggleMode = async (key: string) => {
    // Update the selected mode immediately for UI feedback
    setSelectedMode(key);

    // Also update the selectedModes object if needed elsewhere
    setSelectedModes({ [key]: true });

    // Store just the mode key in storage
    chrome.storage.sync.set({ neurotype: key });

    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'updateNeurotype',
      neurotype: key
    });

    // Update user document in Firestore
    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { selectedMode: key }, { merge: true });
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
            <h4 className="section-title">🧠 Select Your Mode:</h4>
            <div className="radio-options-container">
              {Object.entries(modeList).map(([key, label]) => (
                <label key={key} className="radio-group">
                  <input
                    type="radio"
                    name="neurotype"
                    checked={selectedMode === key}
                    onChange={() => toggleMode(key)}
                  />
                  <span className="radio-label">{label}</span>
                </label>
              ))}
            </div>
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