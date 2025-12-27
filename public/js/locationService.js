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
        // Tier 1: Key Cities (High Online Panel Penetration)
        { id: 'hcm', name: 'TP. Hồ Chí Minh', category: 'city', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: 'Rất dễ, panel lớn' },
        { id: 'hanoi', name: 'Hà Nội', category: 'city', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: 'Rất dễ, panel lớn' },

        // Tier 2: Second-tier Cities
        { id: 'danang', name: 'Đà Nẵng', category: 'city', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 100, difficultyFactor: 1.0, notes: 'Khá dễ' },
        { id: 'haiphong', name: 'Hải Phòng', category: 'city', tier: 2, defaultIR: 35, irRange: { min: 30, max: 40 }, samplesPerDay: 100, difficultyFactor: 1.0, notes: 'Khá dễ' },
        { id: 'cantho', name: 'Cần Thơ', category: 'city', tier: 2, defaultIR: 30, irRange: { min: 25, max: 35 }, samplesPerDay: 80, difficultyFactor: 1.1, notes: 'Trung bình' },

        // Tier 3: Populous Provinces
        { id: 'binhduong', name: 'Bình Dương', category: 'city', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 60, difficultyFactor: 1.2, notes: 'Đông công nhân/KCN' },
        { id: 'dongnai', name: 'Đồng Nai', category: 'city', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 60, difficultyFactor: 1.2, notes: 'Đông dân cư' },
        { id: 'khanhhoa', name: 'Khánh Hòa (Nha Trang)', category: 'city', tier: 3, defaultIR: 25, irRange: { min: 20, max: 30 }, samplesPerDay: 50, difficultyFactor: 1.25, notes: 'Du lịch phát triển' },
        { id: 'nghean', name: 'Nghệ An', category: 'city', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 40, difficultyFactor: 1.35, notes: 'Dân số đông nhưng online thấp hơn' },
        { id: 'thanhhoa', name: 'Thanh Hóa', category: 'city', tier: 3, defaultIR: 20, irRange: { min: 15, max: 25 }, samplesPerDay: 40, difficultyFactor: 1.35, notes: 'Dân số đông' },

        // Tier 4: Rural / Remote
        { id: 'mekong_delta', name: 'ĐBSCL (Các tỉnh khác)', category: 'city', tier: 4, defaultIR: 15, irRange: { min: 10, max: 20 }, samplesPerDay: 30, difficultyFactor: 1.5, notes: 'Thấp, tiếp cận khó hơn' },
        { id: 'north_mountain', name: 'Tây Bắc / Đông Bắc', category: 'city', tier: 4, defaultIR: 10, irRange: { min: 5, max: 15 }, samplesPerDay: 20, difficultyFactor: 1.8, notes: 'Rất khó tiếp cận online' },
        { id: 'central_highlands', name: 'Tây Nguyên', category: 'city', tier: 4, defaultIR: 12, irRange: { min: 8, max: 18 }, samplesPerDay: 25, difficultyFactor: 1.6, notes: 'Thấp' },

        // ============ CCI CLASSIFICATION ============
        { id: 'cci_hcm', name: 'Ho Chi Minh (CCI)', category: 'cci', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: 'CCI: Thành phố lớn nhất' },
        { id: 'cci_hanoi', name: 'Ha Noi (CCI)', category: 'cci', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: 'CCI: Thủ đô' },
        { id: 'cci_secondary_city', name: 'Secondary City', category: 'cci', tier: 2, defaultIR: 30, irRange: { min: 25, max: 38 }, samplesPerDay: 80, difficultyFactor: 1.15, notes: 'CCI: Thành phố cấp 2 (Đà Nẵng, Cần Thơ...)' },
        { id: 'cci_southeast_rural', name: 'Southeast Rural', category: 'cci', tier: 3, defaultIR: 22, irRange: { min: 18, max: 28 }, samplesPerDay: 50, difficultyFactor: 1.35, notes: 'CCI: Nông thôn Đông Nam Bộ' },
        { id: 'cci_mekong_rural', name: 'Mekong River Delta Rural', category: 'cci', tier: 3, defaultIR: 18, irRange: { min: 12, max: 25 }, samplesPerDay: 40, difficultyFactor: 1.45, notes: 'CCI: Nông thôn ĐBSCL' },
        { id: 'cci_north_rural', name: 'North Rural', category: 'cci', tier: 4, defaultIR: 15, irRange: { min: 10, max: 22 }, samplesPerDay: 35, difficultyFactor: 1.55, notes: 'CCI: Nông thôn miền Bắc' },
        { id: 'cci_central_rural', name: 'Central Rural', category: 'cci', tier: 4, defaultIR: 15, irRange: { min: 10, max: 22 }, samplesPerDay: 35, difficultyFactor: 1.55, notes: 'CCI: Nông thôn miền Trung' },

        // ============ GSO CLASSIFICATION ============
        { id: 'gso_urban_t1', name: 'Urban T1', category: 'gso', tier: 1, defaultIR: 45, irRange: { min: 40, max: 50 }, samplesPerDay: 150, difficultyFactor: 0.85, notes: 'GSO: Đô thị loại 1 (HCM, HN)' },
        { id: 'gso_urban_t2', name: 'Urban T2', category: 'gso', tier: 2, defaultIR: 32, irRange: { min: 25, max: 40 }, samplesPerDay: 90, difficultyFactor: 1.1, notes: 'GSO: Đô thị loại 2,3' },
        { id: 'gso_rural', name: 'Rural', category: 'gso', tier: 3, defaultIR: 18, irRange: { min: 12, max: 25 }, samplesPerDay: 40, difficultyFactor: 1.5, notes: 'GSO: Nông thôn' },

        // ============ 3-REGION (BẮC - TRUNG - NAM) ============
        { id: 'region_north', name: 'Miền Bắc', category: 'region', tier: 2, defaultIR: 35, irRange: { min: 28, max: 42 }, samplesPerDay: 100, difficultyFactor: 1.05, notes: '3-Region: Bắc (incl. Hà Nội)' },
        { id: 'region_central', name: 'Miền Trung', category: 'region', tier: 3, defaultIR: 25, irRange: { min: 18, max: 32 }, samplesPerDay: 60, difficultyFactor: 1.3, notes: '3-Region: Trung (incl. Đà Nẵng)' },
        { id: 'region_south', name: 'Miền Nam', category: 'region', tier: 1, defaultIR: 40, irRange: { min: 32, max: 48 }, samplesPerDay: 120, difficultyFactor: 0.9, notes: '3-Region: Nam (incl. HCM)' }
    ];
}

export { getDefaultLocations };
