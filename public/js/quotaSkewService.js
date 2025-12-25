/**
 * Quota Skew Service
 * Manages quota distribution factors
 */

import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Default Quota Skew configurations
 */
const DEFAULT_QUOTA_SKEW = [
    {
        id: 'balanced',
        name: 'Balanced',
        description: '50/50 phân bổ đều, Age trải đều',
        multiplier: 1.0,
        icon: '⚖️',
        examples: ['Nam/Nữ 50/50', 'Age 18-55 đều'],
        order: 1
    },
    {
        id: 'light_skew',
        name: 'Skew nhẹ',
        description: '70/30 hoặc chênh lệch nhẹ',
        multiplier: 1.15,
        icon: '📊',
        examples: ['Nữ 70%', 'Age 25-35 chiếm 60%'],
        order: 2
    },
    {
        id: 'heavy_skew',
        name: 'Skew nặng',
        description: 'Target rất hẹp, khó fill',
        multiplier: 1.4,
        icon: '🎯',
        examples: ['Nữ 45-50 thu nhập cao', 'B2B decision makers'],
        order: 3
    }
];

let cachedQuotaSkew = null;

/**
 * Load quota skew configurations
 */
export async function loadQuotaSkewConfig() {
    if (cachedQuotaSkew) return cachedQuotaSkew;

    try {
        const configRef = doc(db, 'app_config', 'quota_skew');
        const docSnap = await getDoc(configRef);

        if (docSnap.exists()) {
            cachedQuotaSkew = docSnap.data().options || DEFAULT_QUOTA_SKEW;
        } else {
            cachedQuotaSkew = DEFAULT_QUOTA_SKEW;
        }

        return cachedQuotaSkew;
    } catch (error) {
        console.error('Error loading quota skew config:', error);
        cachedQuotaSkew = DEFAULT_QUOTA_SKEW;
        return cachedQuotaSkew;
    }
}

/**
 * Get quota skew multiplier by ID
 */
export async function getQuotaSkewMultiplier(skewId) {
    const configs = await loadQuotaSkewConfig();
    const config = configs.find(c => c.id === skewId);
    return config ? config.multiplier : 1.0;
}

/**
 * Get default quota skew options
 */
export function getDefaultQuotaSkew() {
    return DEFAULT_QUOTA_SKEW;
}

/**
 * Save quota skew config to Firestore (for admin)
 */
export async function saveQuotaSkewConfig(options) {
    const configRef = doc(db, 'app_config', 'quota_skew');
    await setDoc(configRef, { options, updatedAt: new Date() });
    cachedQuotaSkew = options;
}

/**
 * Clear cached config
 */
export function clearQuotaSkewCache() {
    cachedQuotaSkew = null;
}

export { DEFAULT_QUOTA_SKEW };
