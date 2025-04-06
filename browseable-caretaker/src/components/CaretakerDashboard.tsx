import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDocs, collection, query, where, updateDoc, arrayUnion, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { useState } from 'react';
import './CaretakerDashboard.css';
import InsightGenerator from '../components/InsightGenerator';


export default function CaretakerDashboard() {
    const navigate = useNavigate();

    const handleLogout = () => {
        signOut(auth).then(() => navigate('/'));
    };
    const [linkEmail, setLinkEmail] = useState('');
    const [selectedMode, setSelectedMode] = useState<string | null>(null);

    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                navigate('/', { replace: true });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const [linkedUsers, setLinkedUsers] = useState<{ name: string; email: string }[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [userFeatures, setUserFeatures] = useState<Record<string, boolean>>({});
    const [userModes, setUserModes] = useState<Record<string, boolean>>({});
    const [featureLabels, _setFeatureLabels] = useState<Record<string, string>>({});
    const [modeLabels, setModeLabels] = useState<Record<string, string>>({});

    const handleSelectUser = async (email: string) => {
        if (selectedUser === email) {
            setSelectedUser(null);
            setUserFeatures({});
            setUserModes({});
            setSelectedMode(null);
            return;
        }

        setSelectedUser(email);
        setUserFeatures({});
        setUserModes({});
        setSelectedMode(null);

        try {
            // Fetch user data
            const q = query(collection(db, "users"), where("email", "==", email));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const data = userDoc.data();
                setUserFeatures(data.features || {});
                setSelectedMode(data.selectedMode || null);

                // Now fetch available modes from the "modes" collection
                const modesCollectionRef = collection(db, "modes");
                const modesSnapshot = await getDocs(modesCollectionRef);

                // Create a modes object to display all available modes
                const availableModes: Record<string, boolean> = {};
                const newModeLabels: Record<string, string> = {};

                modesSnapshot.forEach((modeDoc) => {
                    const modeData = modeDoc.data();
                    availableModes[modeDoc.id] = data.selectedMode === modeDoc.id;
                    if (modeData.label) {
                        newModeLabels[modeDoc.id] = modeData.label;
                    }
                });

                setUserModes(availableModes);
                setModeLabels(newModeLabels);
            }
        } catch (err) {
            console.error("Error fetching user data:", err);
        }
    };

    useEffect(() => {
        const fetchLinkedUsers = async () => {
            try {
                const caretakerRef = doc(db, "users", auth.currentUser?.uid || "");
                const caretakerSnap = await getDoc(caretakerRef);

                const linked = caretakerSnap.exists() ? caretakerSnap.data().linkedUsers || [] : [];

                const users: { name: string; email: string }[] = [];
                for (const uid of linked) {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                        const email = data.email;
                        if (email) users.push({ name: name || email, email });
                    }
                }

                setLinkedUsers(users);
            } catch (err) {
                console.error("Error fetching linked users:", err);
            }
        };

        fetchLinkedUsers();
    }, [message]);

    const handleLinkUser = async () => {
        try {
            setMessage('');
            setMessageType('');

            if (!linkEmail.trim()) {
                setMessage("Please enter an email address.");
                setMessageType('error');
                return;
            }

            const q = query(collection(db, "users"), where("email", "==", linkEmail));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setMessage("User not found.");
                setMessageType('error');
                return;
            }

            const userDoc = snapshot.docs[0];
            const userId = userDoc.id;

            const caretakerRef = doc(db, "users", auth.currentUser?.uid || "");
            await updateDoc(caretakerRef, {
                linkedUsers: arrayUnion(userId)
            });

            setMessage("User linked successfully!");
            setMessageType('success');
            setLinkEmail('');
        } catch (error) {
            console.error("Error linking user:", error);
            setMessage("Failed to link user.");
            setMessageType('error');
        }
    };

    const toggleUserFeature = async (key: string) => {
        const updated = { ...userFeatures, [key]: !userFeatures[key] };
        setUserFeatures(updated);

        try {
            const q = query(collection(db, "users"), where("email", "==", selectedUser));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const userRef = doc(db, "users", userDoc.id);
                await updateDoc(userRef, { features: updated });
            }
        } catch (err) {
            console.error("Error updating user features:", err);
        }
    };

    const toggleUserMode = async (key: string) => {
        try {
            // Get all available modes from the modes collection
            const modesCollectionRef = collection(db, "modes");
            const modesSnapshot = await getDocs(modesCollectionRef);

            // Create a new userModes object where all modes reflect selection state
            const updatedModes: Record<string, boolean> = {};

            // Set all modes based on whether they match the selected key
            modesSnapshot.forEach((modeDoc) => {
                updatedModes[modeDoc.id] = modeDoc.id === key;
            });

            // Update the UI state
            setUserModes(updatedModes);
            setSelectedMode(key);

            // Update user data in the database - only store the selected mode
            const q = query(collection(db, "users"), where("email", "==", selectedUser));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const userRef = doc(db, "users", userDoc.id);
                await updateDoc(userRef, {
                    selectedMode: key  // Only store the selected mode key
                });
            }
        } catch (err) {
            console.error("Error updating user mode:", err);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="top-bar"></div>
            <div className="dashboard-sidebar">
                <div className="sidebar-header">
                    <h2>BrowseAble</h2>
                    <div className="caretaker-badge">Caretaker Portal</div>
                </div>

                <div className="sidebar-content">
                    <div className="link-user-form">
                        <h3>Connect New User</h3>
                        <div className="input-wrapper">
                            <input
                                type="email"
                                placeholder="User Email"
                                value={linkEmail}
                                onChange={(e) => setLinkEmail(e.target.value)}
                                className="email-input"
                            />
                            <button className="connect-button" onClick={handleLinkUser}>
                                <span className="button-icon">+</span>
                                <span>Connect</span>
                            </button>
                        </div>
                        {message && (
                            <div className={`message ${messageType}`}>
                                {message}
                            </div>
                        )}
                    </div>

                    <div className="users-list-container">
                        <h3>Connected Users</h3>
                        {linkedUsers.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">👥</div>
                                <p>No users connected yet</p>
                                <p className="empty-hint">Enter an email above to connect a user</p>
                            </div>
                        ) : (
                            <ul className="users-list">
                                {linkedUsers.map((user, idx) => (
                                    <li key={idx} className={selectedUser === user.email ? 'active' : ''}>
                                        <button onClick={() => handleSelectUser(user.email)}>
                                            <div className="user-avatar">{user.name.charAt(0)}</div>
                                            <div className="user-info">
                                                <span className="user-name">{user.name}</span>
                                                <span className="user-email">{user.email}</span>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="logout-button" onClick={handleLogout}>
                        <span className="button-icon">↪</span>
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            <div className="dashboard-main-content">
                {!selectedUser ? (
                    <div className="empty-selection">
                        <div className="empty-icon">👈</div>
                        <h3>Select a user</h3>
                        <p>Choose a user from the sidebar to view and manage their preferences</p>
                    </div>
                ) : (
                    <div className="user-preferences">
                        <div className="preferences-header">
                            <h2>Preferences for {linkedUsers.find(u => u.email === selectedUser)?.name || selectedUser}</h2>
                            <p className="user-email">{selectedUser}</p>
                        </div>

                        <div className="preferences-grid">
                            <div className="preferences-card">
                                <div className="card-header">
                                    <h3>Features</h3>
                                    <p>Enable or disable specific accessibility features</p>
                                </div>
                                <div className="options-list">
                                    {Object.entries(userFeatures).length === 0 ? (
                                        <p className="no-options">No features available for this user</p>
                                    ) : (
                                        Object.entries(userFeatures).map(([key, val]) => (
                                            <label key={key} className="toggle-switch">
                                                <span className="toggle-label">{featureLabels[key] || key}</span>
                                                <div className="toggle-container">
                                                    <input
                                                        type="checkbox"
                                                        checked={val}
                                                        onChange={() => toggleUserFeature(key)}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="preferences-card">
                                <div className="card-header">
                                    <h3>Modes</h3>
                                    <p>Configure display and interaction modes</p>
                                </div>
                                <div className="options-list">
                                    {Object.entries(userModes).length === 0 ? (
                                        <p className="no-options">No modes available for this user</p>
                                    ) : (
                                        Object.entries(userModes).map(([key, val]) => (
                                            <label key={key} className="toggle-switch">
                                                <span className="toggle-label">{modeLabels[key] || key}</span>
                                                <div className="toggle-container">
                                                    <input
                                                        type="checkbox"
                                                        checked={val}
                                                        onChange={() => toggleUserMode(key)}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                        </div>
                        <div className="section-divider"></div>

                        <InsightGenerator disorder={selectedMode} />
                    </div>

                )}
            </div>
        </div>
    );
}