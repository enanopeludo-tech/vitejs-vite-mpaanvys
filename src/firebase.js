import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Pega aquí las claves exactas que te dio la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAYC7eIMnCSP7IVnSTTKPxJJbtUaRar5l0",
  authDomain: "taller-b2b.firebaseapp.com",
  projectId: "taller-b2b",
  storageBucket: "taller-b2b.firebasestorage.app",
  messagingSenderId: "1042603964035",
  appId: "1:1042603964035:web:206a44cee2494f8893cdb6",
  measurementId: "G-XSSGXZHFXY"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);