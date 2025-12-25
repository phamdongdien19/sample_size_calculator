/**
 * Admin Service
 * Handles CRUD operations for cases, locations, templates
 */

import { db, auth, googleProvider, APP_CONFIG } from './firebase-config.js';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    setDoc,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getDefaultCases } from './caseLogic.js';
import { getDefaultLocations } from './locationService.js';
import { getDefaultTemplates } from './templateService.js';

// ============ GENERIC CRUD ============

async function getAll(collectionName, orderField = 'order') {
    try {
        const ref = collection(db, collectionName);
        const q = query(ref, orderBy(orderField, 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error getting ${collectionName}:`, error);
        return [];
    }
}

async function addItem(collectionName, data) {
    try {
        const ref = collection(db, collectionName);
        const docRef = await addDoc(ref, data);
        return docRef.id;
    } catch (error) {
        console.error(`Error adding to ${collectionName}:`, error);
        throw error;
    }
}

async function updateItem(collectionName, id, data) {
    try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error(`Error updating ${collectionName}/${id}:`, error);
        throw error;
    }
}

async function deleteItem(collectionName, id) {
    try {
        const docRef = doc(db, collectionName, id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error(`Error deleting ${collectionName}/${id}:`, error);
        throw error;
    }
}

// ============ CASES ============

export async function getAllCases() {
    return getAll('feasibility_cases', 'order');
}

export async function addCase(data) {
    return addItem('feasibility_cases', data);
}

export async function updateCase(id, data) {
    return updateItem('feasibility_cases', id, data);
}

export async function deleteCase(id) {
    return deleteItem('feasibility_cases', id);
}

export async function seedDefaultCases() {
    const cases = getDefaultCases();
    for (const c of cases) {
        const docRef = doc(db, 'feasibility_cases', c.id);
        await setDoc(docRef, c);
    }
    console.log('Seeded default cases');
    return cases.length;
}

// ============ LOCATIONS ============

export async function getAllLocations() {
    return getAll('location_defaults', 'tier');
}

export async function addLocation(data) {
    return addItem('location_defaults', data);
}

export async function updateLocation(id, data) {
    return updateItem('location_defaults', id, data);
}

export async function deleteLocation(id) {
    return deleteItem('location_defaults', id);
}

export async function seedDefaultLocations() {
    const locations = getDefaultLocations();
    for (const l of locations) {
        const docRef = doc(db, 'location_defaults', l.id);
        await setDoc(docRef, l);
    }
    console.log('Seeded default locations');
    return locations.length;
}

// ============ TEMPLATES ============

export async function getAllTemplates() {
    return getAll('project_templates', 'order');
}

export async function addTemplate(data) {
    return addItem('project_templates', data);
}

export async function updateTemplate(id, data) {
    return updateItem('project_templates', id, data);
}

export async function deleteTemplate(id) {
    return deleteItem('project_templates', id);
}

export async function saveTemplate(template) {
    const templateRef = doc(db, 'project_templates', template.id);
    await setDoc(templateRef, template);
}

export async function seedDefaultTemplates() {
    const templates = getDefaultTemplates();
    for (const t of templates) {
        const docRef = doc(db, 'project_templates', t.id);
        await setDoc(docRef, t);
    }
    console.log('Seeded default templates');
    return templates.length;
}

// ============ HISTORY ============

export async function getAllHistory() {
    try {
        const ref = collection(db, 'calculation_history');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
    } catch (error) {
        console.error('Error getting history:', error);
        return [];
    }
}

export async function deleteHistoryItem(id) {
    return deleteItem('calculation_history', id);
}

export async function clearAllHistory() {
    try {
        const ref = collection(db, 'calculation_history');
        const snapshot = await getDocs(ref);
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(db, 'calculation_history', docSnapshot.id));
        }
        console.log('Cleared all history');
        return true;
    } catch (error) {
        console.error('Error clearing history:', error);
        throw error;
    }
}
