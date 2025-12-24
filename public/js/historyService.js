/**
 * History Service
 * Handles saving and retrieving calculation history
 */

import { db, APP_CONFIG } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    limit,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const COLLECTION_NAME = 'calculation_history';

/**
 * Save a calculation to history
 * @param {Object} data - Calculation data to save
 */
export async function saveCalculation(data) {
    try {
        const historyRef = collection(db, COLLECTION_NAME);

        const record = {
            projectName: data.projectName || 'Untitled Project',
            mode: data.mode || 'detailed',
            input: data.input,
            systemResult: data.systemResult,
            expertConclusion: data.expertConclusion,
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(historyRef, record);
        console.log('Saved to history:', docRef.id);

        // Cleanup old records
        await cleanupOldHistory();

        return docRef.id;
    } catch (error) {
        console.error('Error saving to history:', error);
        // Fallback to localStorage
        saveToLocalStorage(data);
        return null;
    }
}

/**
 * Get recent history
 * @param {number} count - Number of records to retrieve
 */
export async function getRecentHistory(count = 10) {
    try {
        const historyRef = collection(db, COLLECTION_NAME);
        const q = query(historyRef, orderBy('createdAt', 'desc'), limit(count));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
    } catch (error) {
        console.error('Error loading history:', error);
        return getFromLocalStorage();
    }
}

/**
 * Delete a history record
 * @param {string} historyId - Document ID to delete
 */
export async function deleteHistoryRecord(historyId) {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, historyId));
        console.log('Deleted history record:', historyId);
        return true;
    } catch (error) {
        console.error('Error deleting history:', error);
        return false;
    }
}

/**
 * Cleanup old history records beyond the limit
 */
export async function cleanupOldHistory() {
    try {
        const historyLimit = APP_CONFIG.HISTORY_LIMIT || 50;
        const historyRef = collection(db, COLLECTION_NAME);
        const q = query(historyRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const docs = snapshot.docs;

        if (docs.length > historyLimit) {
            const toDelete = docs.slice(historyLimit);
            console.log(`Cleaning up ${toDelete.length} old history records...`);

            for (const docSnapshot of toDelete) {
                await deleteDoc(doc(db, COLLECTION_NAME, docSnapshot.id));
            }

            console.log('History cleanup complete.');
        }
    } catch (error) {
        console.error('Error during history cleanup:', error);
    }
}

/**
 * Clear all history (admin function)
 */
export async function clearAllHistory() {
    try {
        const historyRef = collection(db, COLLECTION_NAME);
        const snapshot = await getDocs(historyRef);

        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(db, COLLECTION_NAME, docSnapshot.id));
        }

        console.log('All history cleared.');
        return true;
    } catch (error) {
        console.error('Error clearing history:', error);
        return false;
    }
}

// ============ LocalStorage Fallback ============

const LOCAL_STORAGE_KEY = 'sample_calc_history';

function saveToLocalStorage(data) {
    try {
        const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        existing.unshift({
            ...data,
            id: 'local_' + Date.now(),
            createdAt: new Date().toISOString()
        });

        // Keep only last 50
        const trimmed = existing.slice(0, 50);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('LocalStorage save error:', e);
    }
}

function getFromLocalStorage() {
    try {
        const data = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        return data.map(item => ({
            ...item,
            createdAt: new Date(item.createdAt)
        }));
    } catch (e) {
        return [];
    }
}
