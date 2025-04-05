// src/firebase/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAecw-HwvBJ5ObrnWlqbCViG_tAT3uzB6Q",
    authDomain: "browseable-586fa.firebaseapp.com",
    projectId: "browseable-586fa",
    storageBucket: "browseable-586fa.firebasestorage.app",
    messagingSenderId: "881872144115",
    appId: "1:881872144115:web:54c7096d1e939eb33f9986"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore();

export { auth, db };