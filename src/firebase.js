import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB-Q0gdE408V2A-KIqR01bZJNVZCKXXQdc",
  authDomain: "privitipizza41.firebaseapp.com",
  databaseURL: "https://privitipizza41-default-rtdb.firebaseio.com",
  projectId: "privitipizza41",
  storageBucket: "privitipizza41.appspot.com",
  messagingSenderId: "XXXXXXX",
  appId: "XXXXXXX"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);