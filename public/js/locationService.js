/**
 * Location Service
 * Handles location defaults for IR suggestions
 */

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedLocations = null;

/**
 * Load all location defaults from Firestore
 * Merges with default locations to ensure all required fields exist
 */
export async function loadLocations() {
    if (cachedLocations) return cachedLocations;

    const defaults = getDefaultLocations();
    const defaultsMap = new Map(defaults.map(d => [d.id, d]));

    try {
        const locRef = collection(db, 'location_defaults');
        const q = query(locRef, orderBy('tier', 'asc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // No Firestore data, use defaults
            cachedLocations = defaults;
            return cachedLocations;
        }

        // Merge Firestore data with defaults - Firestore values override defaults
        cachedLocations = snapshot.docs.map(doc => {
            const firestoreData = { id: doc.id, ...doc.data() };
            const defaultData = defaultsMap.get(doc.id) || {};

            // Merge: default first, then Firestore overrides
            return {
                ...defaultData,
                ...firestoreData,
                // Ensure critical fields have fallback
                difficultyFactor: firestoreData.difficultyFactor ?? defaultData.difficultyFactor ?? 1.0,
                samplesPerDay: firestoreData.samplesPerDay ?? defaultData.samplesPerDay ?? 50
            };
        });

        console.log('📍 Loaded locations with merged defaults:', cachedLocations.length);
        return cachedLocations;
    } catch (error) {
        console.error('Error loading locations:', error);
        cachedLocations = defaults;
        return cachedLocations;
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
    const avgDifficultyFactor = selected.reduce((sum, l) => sum + (l.difficultyFactor || 1.0), 0) / selected.length;

    // Travel buffer: REMOVED for Online Quanti
    const travelBuffer = 0;

    return {
        defaultIR: avgIR,
        range: { min: minIR, max: maxIR },
        samplesPerDay: avgSamplesPerDay,
        travelBuffer: 0,
        difficultyFactor: avgDifficultyFactor,
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
 * Calculate location difficulty factor for selected locations
 * Returns weighted average of difficultyFactor (higher = slower FW)
 */
export async function calculateLocationFactor(locationIds) {
    if (!locationIds || locationIds.length === 0) {
        return { factor: 1.0, avgSamplesPerDay: 100, notes: '' };
    }

    const locations = await loadLocations();
    const selected = locations.filter(l => locationIds.includes(l.id));

    if (selected.length === 0) {
        return { factor: 1.0, avgSamplesPerDay: 100, notes: '' };
    }

    // Calculate weighted average difficulty factor
    const avgFactor = selected.reduce((sum, l) => sum + (l.difficultyFactor || 1.0), 0) / selected.length;
    const avgSamplesPerDay = Math.round(selected.reduce((sum, l) => sum + (l.samplesPerDay || 50), 0) / selected.length);

    return {
        factor: avgFactor,
        avgSamplesPerDay: avgSamplesPerDay,
        notes: selected.map(l => l.name).join(', ')
    };
}

/**
 * Default locations data (Vietnam focused for Online Quanti)
 * Categories: 'city' (specific cities), 'cci' (CCI classification), 'gso' (GSO classification), 'region' (3-region)
 * difficultyFactor: 1.0 = baseline, >1 = harder/slower, <1 = easier/faster
 */
function getDefaultLocations() {
    return [
        // ============ SPECIFIC CITIES (Tier-based) ============
        // Tier 1: Key Cities - Responses nhiều nhất, tốc độ FW nhanh nhất
        { id: 'hcm', name: 'TP. Hồ Chí Minh', category: 'city', tier: 1, defaultIR: 50, irRange: { min: 45, max: 55 }, samplesPerDay: 200, difficultyFactor: 0.80, notes: 'Tier 1 - Panel lớn nhất, rất dễ recruit' },
        { id: 'hanoi', name: 'Hà Nội', category: 'city', tier: 1, defaultIR: 50, irRange: { min: 45, max: 55 }, samplesPerDay: 200, difficultyFactor: 0.80, notes: 'Tier 1 - Panel lớn, rất dễ recruit' },

        // Tier 2: Second-tier Cities - Số lượng responses bằng 1/4 của HCM và HN
        { id: 'danang', name: 'Đà Nẵng', category: 'city', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 50, difficultyFactor: 1.0, notes: 'Tier 2 - ~1/4 responses so với Tier 1' },
        { id: 'haiphong', name: 'Hải Phòng', category: 'city', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 50, difficultyFactor: 1.0, notes: 'Tier 2 - ~1/4 responses so với Tier 1' },
        { id: 'cantho', name: 'Cần Thơ', category: 'city', tier: 2, defaultIR: 32, irRange: { min: 28, max: 38 }, samplesPerDay: 50, difficultyFactor: 1.0, notes: 'Tier 2 - ~1/4 responses so với Tier 1' },

        // Tier 3: Populous Provinces - Responses thấp hơn
        { id: 'binhduong', name: 'Bình Dương', category: 'city', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 30, difficultyFactor: 1.5, notes: 'Tier 3 - Responses thấp' },
        { id: 'dongnai', name: 'Đồng Nai', category: 'city', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 30, difficultyFactor: 1.5, notes: 'Tier 3 - Responses thấp' },
        { id: 'khanhhoa', name: 'Khánh Hòa (Nha Trang)', category: 'city', tier: 3, defaultIR: 22, irRange: { min: 18, max: 28 }, samplesPerDay: 25, difficultyFactor: 1.6, notes: 'Tier 3 - Responses thấp' },
        { id: 'nghean', name: 'Nghệ An', category: 'city', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 25, difficultyFactor: 1.6, notes: 'Tier 3 - Dân đông nhưng online thấp' },
        { id: 'thanhhoa', name: 'Thanh Hóa', category: 'city', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 25, difficultyFactor: 1.6, notes: 'Tier 3 - Dân đông nhưng online thấp' },

        // Tier 4: Rural / Remote - Responses rất thấp
        { id: 'mekong_delta', name: 'ĐBSCL (Các tỉnh khác)', category: 'city', tier: 4, defaultIR: 15, irRange: { min: 10, max: 20 }, samplesPerDay: 15, difficultyFactor: 2.0, notes: 'Tier 4 - Responses rất thấp' },
        { id: 'north_mountain', name: 'Tây Bắc / Đông Bắc', category: 'city', tier: 4, defaultIR: 10, irRange: { min: 5, max: 15 }, samplesPerDay: 10, difficultyFactor: 2.5, notes: 'Tier 4 - Rất khó tiếp cận online' },
        { id: 'central_highlands', name: 'Tây Nguyên', category: 'city', tier: 4, defaultIR: 12, irRange: { min: 8, max: 18 }, samplesPerDay: 12, difficultyFactor: 2.2, notes: 'Tier 4 - Responses rất thấp' },

        // ============ CCI CLASSIFICATION ============
        { id: 'cci_hcm', name: 'Ho Chi Minh (CCI)', category: 'cci', tier: 1, defaultIR: 50, irRange: { min: 45, max: 55 }, samplesPerDay: 200, difficultyFactor: 0.80, notes: 'CCI: Tier 1 - Fastest' },
        { id: 'cci_hanoi', name: 'Ha Noi (CCI)', category: 'cci', tier: 1, defaultIR: 50, irRange: { min: 45, max: 55 }, samplesPerDay: 200, difficultyFactor: 0.80, notes: 'CCI: Tier 1 - Fastest' },
        { id: 'cci_secondary_city', name: 'Secondary City', category: 'cci', tier: 2, defaultIR: 35, irRange: { min: 28, max: 42 }, samplesPerDay: 50, difficultyFactor: 1.0, notes: 'CCI: Tier 2 - 1/4 of Tier 1' },
        { id: 'cci_southeast_rural', name: 'Southeast Rural', category: 'cci', tier: 3, defaultIR: 22, irRange: { min: 18, max: 28 }, samplesPerDay: 25, difficultyFactor: 1.6, notes: 'CCI: Tier 3' },
        { id: 'cci_mekong_rural', name: 'Mekong River Delta Rural', category: 'cci', tier: 3, defaultIR: 18, irRange: { min: 12, max: 25 }, samplesPerDay: 20, difficultyFactor: 1.8, notes: 'CCI: Tier 3-4' },
        { id: 'cci_north_rural', name: 'North Rural', category: 'cci', tier: 4, defaultIR: 15, irRange: { min: 10, max: 22 }, samplesPerDay: 15, difficultyFactor: 2.0, notes: 'CCI: Tier 4' },
        { id: 'cci_central_rural', name: 'Central Rural', category: 'cci', tier: 4, defaultIR: 15, irRange: { min: 10, max: 22 }, samplesPerDay: 15, difficultyFactor: 2.0, notes: 'CCI: Tier 4' },

        // ============ GSO CLASSIFICATION ============
        { id: 'gso_urban_t1', name: 'Urban T1', category: 'gso', tier: 1, defaultIR: 50, irRange: { min: 45, max: 55 }, samplesPerDay: 200, difficultyFactor: 0.80, notes: 'GSO: Đô thị loại 1 (HCM, HN)' },
        { id: 'gso_urban_t2', name: 'Urban T2', category: 'gso', tier: 2, defaultIR: 35, irRange: { min: 28, max: 42 }, samplesPerDay: 50, difficultyFactor: 1.0, notes: 'GSO: Đô thị loại 2,3' },
        { id: 'gso_rural', name: 'Rural', category: 'gso', tier: 3, defaultIR: 18, irRange: { min: 12, max: 25 }, samplesPerDay: 20, difficultyFactor: 1.8, notes: 'GSO: Nông thôn' },

        // ============ 3-REGION (BẮC - TRUNG - NAM) ============
        { id: 'region_north', name: 'Miền Bắc', category: 'region', tier: 2, defaultIR: 38, irRange: { min: 32, max: 45 }, samplesPerDay: 80, difficultyFactor: 1.1, notes: '3-Region: Bắc (incl. Hà Nội)' },
        { id: 'region_central', name: 'Miền Trung', category: 'region', tier: 3, defaultIR: 25, irRange: { min: 18, max: 32 }, samplesPerDay: 35, difficultyFactor: 1.5, notes: '3-Region: Trung (incl. Đà Nẵng)' },
        { id: 'region_south', name: 'Miền Nam', category: 'region', tier: 1, defaultIR: 45, irRange: { min: 38, max: 52 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: '3-Region: Nam (incl. HCM)' }
    ];
}

export { getDefaultLocations };
