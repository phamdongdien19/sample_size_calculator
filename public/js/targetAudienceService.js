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
        name: 'Gen Z / Youth (16-24)',
        order: 2,
        irFactor: 0.8,
        difficultyMultiplier: 1.2,
        description: 'Giới trẻ, học sinh sinh viên 16-24 tuổi',
        notes: 'Tech-savvy nhưng khó đoán, IR cao trên mobile panel'
    },
    {
        id: 'moms_baby',
        name: 'Moms with Babies (0-3)',
        order: 3,
        irFactor: 0.5,
        difficultyMultiplier: 1.4,
        description: 'Mẹ có con nhỏ 0-3 tuổi (Mẹ bỉm sữa)',
        notes: 'Đối tượng classic của FMCG, thường bận rộn'
    },
    {
        id: 'kids_parents',
        name: 'Parents of Kids (4-12)',
        order: 4,
        irFactor: 0.5,
        difficultyMultiplier: 1.3,
        description: 'Bố mẹ có con 4-12 tuổi',
        notes: 'Cần tiếp cận qua bố mẹ để hỏi về trẻ'
    },
    {
        id: 'senior',
        name: 'Senior (55+)',
        order: 5,
        irFactor: 0.5,
        difficultyMultiplier: 1.6,
        description: 'Người lớn tuổi trên 55',
        notes: 'Công nghệ thấp (Low tech), response time chậm'
    },
    {
        id: 'high_income',
        name: 'High Income (Class A)',
        order: 6,
        irFactor: 0.35,
        difficultyMultiplier: 1.9,
        description: 'Thu nhập cao, tầng lớp thượng lưu',
        notes: 'Khó tiếp cận, bảo mật cao, cần incentive lớn'
    },
    {
        id: 'car_owners',
        name: 'Car Owners',
        order: 7,
        irFactor: 0.4,
        difficultyMultiplier: 1.5,
        description: 'Chủ sở hữu ô tô',
        notes: 'IR thấp (đặc biệt ở VN), cần verify kỹ'
    },
    {
        id: 'gamers',
        name: 'Gamers (Mobile/PC)',
        order: 8,
        irFactor: 0.8,
        difficultyMultiplier: 1.1,
        description: 'Người chơi game thường xuyên',
        notes: 'Dễ tiếp cận online, response nhanh'
    },
    {
        id: 'investors',
        name: 'Investors (Stock/Crypto)',
        order: 9,
        irFactor: 0.3,
        difficultyMultiplier: 1.6,
        description: 'Nhà đầu tư chứng khoán / tài chính',
        notes: 'Nhóm niche, quan tâm tài chính'
    },
    {
        id: 'smokers',
        name: 'Smokers',
        order: 10,
        irFactor: 0.6,
        difficultyMultiplier: 1.3,
        description: 'Người hút thuốc lá',
        notes: 'IR khoảng 20-30%, sẵn lòng trả lời thấp'
    },
    {
        id: 'alcohol',
        name: 'Beer/Alcohol Drinkers',
        order: 11,
        irFactor: 0.7,
        difficultyMultiplier: 1.2,
        description: 'Người uống bia / rượu',
        notes: 'Khá phổ biến ở nam giới'
    },
    {
        id: 'sme_decision',
        name: 'SME Decision Makers',
        order: 12,
        irFactor: 0.2,
        difficultyMultiplier: 2.2,
        description: 'Chủ doanh nghiệp SME / Quyết định mua sắm',
        notes: 'Cực khó (B2B), bận rộn, cần chuyên môn cao'
    },
    {
        id: 'healthcare_pro',
        name: 'HCP (Healthcare Pro)',
        order: 13,
        irFactor: 0.1,
        difficultyMultiplier: 2.5,
        description: 'Bác sĩ, Dược sĩ, Chuyên gia y tế',
        notes: 'Khó nhất, thường cần panel y tế chuyên dụng'
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
