/**
 * Firebase Configuration
 * Replace with your actual Firebase project config
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyB1RUsguLzUVAsUz1uaKXzN3blkRCSOD9Y",
    authDomain: "sample-size-calculator-3538b.firebaseapp.com",
    projectId: "sample-size-calculator-3538b",
    storageBucket: "sample-size-calculator-3538b.firebasestorage.app",
    messagingSenderId: "468949468708",
    appId: "1:468949468708:web:8b8d1046232687ff607ab1",
    measurementId: "G-PX3VDZR62E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export { app };
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// App configuration
export const APP_CONFIG = {
    HISTORY_LIMIT: 50,
    ADMIN_EMAILS: ['phamdongdien19@gmail.com'] // Add your admin emails here
};
