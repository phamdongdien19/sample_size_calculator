/**
 * Target Audience Service
 * Manages target audience types with IR factors for accurate estimation
 */

import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedAudiences = null;

/**
 * Default Target Audiences with IR factors
 * irFactor: Multiplier for IR calculation (lower = harder to reach)
 * difficultyMultiplier: Multiplier for FW days (higher = more days needed)
 */
const DEFAULT_AUDIENCES = [
    {
        id: 'general',
        name: 'General Population',
        order: 1,
        irFactor: 1.0,
        difficultyMultiplier: 1.0,
        description: 'Dân số chung, không có điều kiện đặc biệt',
        notes: 'Baseline - dùng làm chuẩn so sánh'
    },
    {
        id: 'youth',
        name: 'Youth (15-24)',
        order: 2,
        irFactor: 0.8,
        difficultyMultiplier: 1.2,
        description: 'Đối tượng trẻ 15-24 tuổi',
        notes: 'Response rate cao hơn nhưng khó reach hơn trên panel'
    },
    {
        id: 'senior',
        name: 'Senior (55+)',
        order: 3,
        irFactor: 0.5,
        difficultyMultiplier: 1.5,
        description: 'Đối tượng lớn tuổi 55+',
        notes: 'Ít online, response chậm'
    },
    {
        id: 'high_income',
        name: 'High Income',
        order: 4,
        irFactor: 0.4,
        difficultyMultiplier: 1.8,
        description: 'Thu nhập cao (ABC1)',
        notes: 'Khó tiếp cận, thường cần incentive cao'
    },
    {
        id: 'b2b',
        name: 'B2B Decision Makers',
        order: 5,
        irFactor: 0.3,
        difficultyMultiplier: 2.0,
        description: 'Lãnh đạo doanh nghiệp, người ra quyết định',
        notes: 'IR rất thấp, cần panel chuyên biệt hoặc recruit trực tiếp'
    },
    {
        id: 'healthcare',
        name: 'Healthcare Professionals',
        order: 6,
        irFactor: 0.15,
        difficultyMultiplier: 2.5,
        description: 'Bác sĩ, dược sĩ, nhân viên y tế',
        notes: 'IR cực thấp, thường cần recruit qua hiệp hội hoặc cold call'
    }
];

/**
 * Load all target audiences from Firestore
 */
export async function loadTargetAudiences() {
    if (cachedAudiences) return cachedAudiences;

    try {
        const audiencesRef = collection(db, 'target_audiences');
        const q = query(audiencesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        const audiences = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (audiences.length === 0) {
            console.log('No audiences in Firestore, using defaults');
            cachedAudiences = DEFAULT_AUDIENCES;
        } else {
            cachedAudiences = audiences;
        }

        return cachedAudiences;
    } catch (error) {
        console.error('Error loading target audiences:', error);
        cachedAudiences = DEFAULT_AUDIENCES;
        return cachedAudiences;
    }
}

/**
 * Get a specific audience by ID
 */
export async function getAudience(audienceId) {
    const audiences = await loadTargetAudiences();
    return audiences.find(a => a.id === audienceId) || null;
}

/**
 * Clear cached audiences (call after admin updates)
 */
export function clearAudienceCache() {
    cachedAudiences = null;
}

/**
 * Get default audiences
 */
export function getDefaultAudiences() {
    return DEFAULT_AUDIENCES;
}

/**
 * Save audience to Firestore (for admin)
 */
export async function saveAudience(audience) {
    const audienceRef = doc(db, 'target_audiences', audience.id);
    await setDoc(audienceRef, audience);
    clearAudienceCache();
}

/**
 * Delete audience from Firestore (for admin)
 */
export async function deleteAudience(audienceId) {
    const audienceRef = doc(db, 'target_audiences', audienceId);
    await deleteDoc(audienceRef);
    clearAudienceCache();
}

/**
 * Seed default audiences to Firestore
 */
export async function seedDefaultAudiences() {
    for (const audience of DEFAULT_AUDIENCES) {
        await saveAudience(audience);
    }
    return DEFAULT_AUDIENCES.length;
}

/**
 * Calculate audience impact on estimation
 * @param {string} audienceId - Target audience ID
 * @param {number} baseIR - Base incidence rate (%)
 * @returns {Object} { effectiveIR, difficultyMultiplier, audience }
 */
export async function calculateAudienceImpact(audienceId) {
    if (!audienceId) {
        return {
            irFactor: 1.0,
            difficultyMultiplier: 1.0,
            audience: null
        };
    }

    const audience = await getAudience(audienceId);

    if (!audience) {
        return {
            irFactor: 1.0,
            difficultyMultiplier: 1.0,
            audience: null
        };
    }

    return {
        irFactor: audience.irFactor || 1.0,
        difficultyMultiplier: audience.difficultyMultiplier || 1.0,
        audience: audience
    };
}

export { DEFAULT_AUDIENCES };
