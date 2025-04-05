import { db } from './firebaseConfig';
import { setDoc, doc } from 'firebase/firestore';

// MODE documents
const modes = {
  autism: "Autism",
  adhd: "ADHD",
  sensory: "Sensory Processing Disorder",
  blind_deaf: "Blind/Deaf/Dumb"
};

// FEATURE documents
const features = {
  simplifyUI: "Simplify UI",
  textToSpeech: "Text-to-Speech",
  colorFilter: "Low Stimulus Visual Mode",
  summarize: "Summarize Page"
};

export const seedFirestore = async () => {
  try {
    for (const [id, label] of Object.entries(modes)) {
      await setDoc(doc(db, "modes", id), { label });
    }

    for (const [id, label] of Object.entries(features)) {
      await setDoc(doc(db, "features", id), { label });
    }

    console.log("Firestore seeded successfully!");
  } catch (err) {
    console.error("Error seeding Firestore:", err);
  }
};