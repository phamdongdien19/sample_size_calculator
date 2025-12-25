// ============ AUTH SERVICE ============
// Firebase Authentication with Owner Approval System

import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { app } from './firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Owner email (auto-approved as admin)
const OWNER_EMAIL = 'phamdongdien19@gmail.com';

// ============ AUTH FUNCTIONS ============

// Sign in with Google
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if user exists in approved_users
        const userRef = doc(db, 'approved_users', user.email);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            // First time user - create pending approval record
            const isOwner = user.email === OWNER_EMAIL;
            await setDoc(userRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: isOwner ? 'admin' : 'user',
                approved: isOwner, // Owner is auto-approved
                requestedAt: serverTimestamp(),
                approvedAt: isOwner ? serverTimestamp() : null
            });

            return {
                success: true,
                user: user,
                approved: isOwner,
                message: isOwner ? 'Chào mừng Admin!' : 'Yêu cầu truy cập đã được gửi. Vui lòng chờ phê duyệt.'
            };
        }

        const userData = userDoc.data();
        return {
            success: true,
            user: user,
            approved: userData.approved,
            role: userData.role,
            message: userData.approved ? 'Đăng nhập thành công!' : 'Tài khoản đang chờ phê duyệt.'
        };

    } catch (error) {
        console.error('Sign in error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Sign out
export async function logOut() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get current user
export function getCurrentUser() {
    return auth.currentUser;
}

// Check if current user is approved
export async function checkApproval() {
    const user = auth.currentUser;
    if (!user) return { approved: false, loggedIn: false };

    try {
        const userRef = doc(db, 'approved_users', user.email);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) return { approved: false, loggedIn: true };

        const data = userDoc.data();
        return {
            approved: data.approved,
            loggedIn: true,
            role: data.role,
            user: user
        };
    } catch (error) {
        console.error('Check approval error:', error);
        return { approved: false, loggedIn: true, error: error.message };
    }
}

// Check if current user is owner/admin
export async function isAdmin() {
    const user = auth.currentUser;
    if (!user) return false;

    if (user.email === OWNER_EMAIL) return true;

    try {
        const userRef = doc(db, 'approved_users', user.email);
        const userDoc = await getDoc(userRef);
        return userDoc.exists() && userDoc.data().role === 'admin';
    } catch (error) {
        return false;
    }
}

// Listen to auth state changes
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ============ ADMIN FUNCTIONS ============

// Get all users (for admin panel)
export async function getAllUsers() {
    try {
        const usersRef = collection(db, 'approved_users');
        const snapshot = await getDocs(usersRef);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
}

// Approve user
export async function approveUser(email) {
    try {
        const userRef = doc(db, 'approved_users', email);
        await setDoc(userRef, {
            approved: true,
            approvedAt: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Reject/Remove user
export async function removeUser(email) {
    if (email === OWNER_EMAIL) {
        return { success: false, error: 'Cannot remove owner' };
    }
    try {
        await deleteDoc(doc(db, 'approved_users', email));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Set user role
export async function setUserRole(email, role) {
    if (email === OWNER_EMAIL) {
        return { success: false, error: 'Cannot change owner role' };
    }
    try {
        const userRef = doc(db, 'approved_users', email);
        await setDoc(userRef, { role: role }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export { OWNER_EMAIL };
