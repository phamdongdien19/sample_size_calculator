/**
 * Location Service
 * Handles location defaults for IR suggestions
 */

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedLocations = null;

/**
 * Load all location defaults from Firestore
 */
export async function loadLocations() {
    if (cachedLocations) return cachedLocations;

    try {
        const locRef = collection(db, 'location_defaults');
        const q = query(locRef, orderBy('tier', 'asc'));
        const snapshot = await getDocs(q);

        cachedLocations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return cachedLocations;
    } catch (error) {
        console.error('Error loading locations:', error);
        return getDefaultLocations();
    }
}

/**
 * Calculate weighted IR and samples/day for multiple locations
 */
export async function calculateWeightedIR(locationIds) {
    const locations = await loadLocations();
    const selected = locations.filter(l => locationIds.includes(l.id));

    if (selected.length === 0) return null;

    // Calculate averages
    const avgIR = Math.round(selected.reduce((sum, l) => sum + l.defaultIR, 0) / selected.length);
    const minIR = Math.min(...selected.map(l => l.irRange.min));
    const maxIR = Math.max(...selected.map(l => l.irRange.max));
    const avgSamplesPerDay = Math.round(selected.reduce((sum, l) => sum + (l.samplesPerDay || 50), 0) / selected.length);

    // Travel buffer: REMOVED for Online Quanti
    const travelBuffer = 0;

    return {
        defaultIR: avgIR,
        range: { min: minIR, max: maxIR },
        samplesPerDay: avgSamplesPerDay,
        travelBuffer: 0,
        notes: selected.map(l => l.name).join(', ')
    };
}

/**
 * Get IR suggestion for a specific location (or array of locations)
 */
export async function getIRSuggestion(locationIdOrIds) {
    if (!locationIdOrIds) return null;

    // Handle array input
    if (Array.isArray(locationIdOrIds)) {
        return calculateWeightedIR(locationIdOrIds);
    }

    // Handle single string
    return calculateWeightedIR([locationIdOrIds]);
}

/**
 * Default locations data (Vietnam focused for Online Quanti)
 */
function getDefaultLocations() {
    return [
        // Tier 1: Key Cities (High Online Panel Penetration)
        { id: 'hcm', name: 'TP. Hồ Chí Minh', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, notes: 'Rất dễ, panel lớn' },
        { id: 'hanoi', name: 'Hà Nội', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, notes: 'Rất dễ, panel lớn' },

        // Tier 2: Second-tier Cities
        { id: 'danang', name: 'Đà Nẵng', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 100, notes: 'Khá dễ' },
        { id: 'haiphong', name: 'Hải Phòng', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 100, notes: 'Khá dễ' },
        { id: 'cantho', name: 'Cần Thơ', tier: 2, defaultIR: 30, irRange: { min: 25, max: 35 }, samplesPerDay: 80, notes: 'Trung bình' },

        // Tier 3: Populous Provinces (Industrial/Urbanized)
        { id: 'binhduong', name: 'Bình Dương', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 60, notes: 'Đông công nhân/KCN' },
        { id: 'dongnai', name: 'Đồng Nai', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 60, notes: 'Đông dân cư' },
        { id: 'khanhhoa', name: 'Khánh Hòa (Nha Trang)', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 50, notes: 'Du lịch phát triển' },
        { id: 'nghean', name: 'Nghệ An', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 40, notes: 'Dân số đông nhưng online thấp hơn' },
        { id: 'thanhhoa', name: 'Thanh Hóa', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 40, notes: 'Dân số đông' },

        // Tier 4: Rural / Remote / Mountainous
        { id: 'mekong_delta', name: 'ĐBSCL (Các tỉnh khác)', tier: 4, defaultIR: 15, irRange: { min: 10, max: 20 }, samplesPerDay: 30, notes: 'Thấp, tiếp cận khó hơn' },
        { id: 'north_mountain', name: 'Tây Bắc / Đông Bắc', tier: 4, defaultIR: 10, irRange: { min: 5, max: 15 }, samplesPerDay: 20, notes: 'Rất khó tiếp cận online' },
        { id: 'central_highlands', name: 'Tây Nguyên', tier: 4, defaultIR: 12, irRange: { min: 8, max: 18 }, samplesPerDay: 25, notes: 'Thấp' }
    ];
}

export { getDefaultLocations };
