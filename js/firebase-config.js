// Firebase Configuration
// IMPORTANT: Replace these values with your Firebase project credentials
// Go to https://console.firebase.google.com > Project Settings > General > Your apps > Web app
const firebaseConfig = {
  apiKey: "AIzaSyCnV7heF2vU2tA7uOTrf4tEamVW73yUp1o",
  authDomain: "tprezpro-web.firebaseapp.com",
  databaseURL: "https://tprezpro-web-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tprezpro-web",
  storageBucket: "tprezpro-web.firebasestorage.app",
  messagingSenderId: "190667786733",
  appId: "1:190667786733:web:dcd2a2d52855ca63cc7fe4"
};

let app = null;
let db = null;

export function initFirebase(firebaseApp, firebaseDatabase) {
  app = firebaseApp.initializeApp(firebaseConfig);
  db = firebaseDatabase.getDatabase(app);
  return { app, db };
}

export function getDb() {
  return db;
}

export { firebaseConfig };
