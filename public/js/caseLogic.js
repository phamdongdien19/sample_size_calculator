/**
 * Case Logic Service
 * Handles loading cases from Firestore and matching input to cases
 */

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedCases = null;

/**
 * Load all feasibility cases from Firestore
 */
export async function loadCases() {
    if (cachedCases) return cachedCases;

    try {
        const casesRef = collection(db, 'feasibility_cases');
        const q = query(casesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        const cases = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Use default cases if Firestore is empty
        if (cases.length === 0) {
            console.log('No cases in Firestore, using defaults');
            cachedCases = getDefaultCases();
        } else {
            cachedCases = cases;
        }

        return cachedCases;
    } catch (error) {
        console.error('Error loading cases:', error);
        // Return default cases if Firestore fails
        cachedCases = getDefaultCases();
        return cachedCases;
    }
}

/**
 * Clear cached cases (call after admin updates)
 */
export function clearCaseCache() {
    cachedCases = null;
}

/**
 * Determine which case matches the input
 * @param {Object} input - {ir, sampleSize, loi, quota, hardTarget}
 * @returns {Object} matched case or null
 */
export async function determineCase(input) {
    const cases = await loadCases();
    const { ir, sampleSize, loi, quota, hardTarget } = input;

    // Find exact match first
    for (const c of cases) {
        const cond = c.conditions;

        const irMatch = ir >= cond.ir.min && ir <= cond.ir.max;
        const sampleMatch = sampleSize >= cond.sample.min && sampleSize <= cond.sample.max;
        const loiMatch = loi >= cond.loi.min && loi <= cond.loi.max;
        const quotaMatch = cond.quota === quota;
        const targetMatch = cond.hardTarget === hardTarget;

        if (irMatch && sampleMatch && loiMatch && quotaMatch && targetMatch) {
            return c;
        }
    }

    // No exact match - find closest match
    return findClosestCase(cases, input);
}

/**
 * Find the closest matching case when no exact match exists
 */
function findClosestCase(cases, input) {
    const { ir, sampleSize, loi, quota, hardTarget } = input;

    let bestMatch = null;
    let bestScore = -1;

    for (const c of cases) {
        const cond = c.conditions;
        let score = 0;

        // Score each condition
        if (ir >= cond.ir.min && ir <= cond.ir.max) score += 3;
        if (sampleSize >= cond.sample.min && sampleSize <= cond.sample.max) score += 3;
        if (loi >= cond.loi.min && loi <= cond.loi.max) score += 2;
        if (cond.quota === quota) score += 2;
        if (cond.hardTarget === hardTarget) score += 2;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = c;
        }
    }

    return bestMatch;
}

/**
 * Calculate range for Quick Mode (Best/Likely/Worst)
 */
export async function calculateQuickModeRange(input) {
    const cases = await loadCases();

    // We reuse DetermineCase but override specific params to simulate scenarios

    // Best case: simulate High IR within current constraints
    // If input IR is already high, use it. If not, assume a 'Best' scenario IR (e.g., +20%) to see where it lands?
    // Actually, Quick mode usually means: 
    // Best: Optimistic view (Upper bound of current match or lower difficulty tier)
    // Likely: Current match
    // Worst: Pessimistic view

    // However, based on the previous implementation logic:
    // It seemed to just pick 3 specific cases? Or re-evaluate?
    // Let's implement robustly:

    const likelyCase = await determineCase(input);

    // For Best/Worst, we might just tweak the IR or Difficulty?
    // Let's grab the Likely Case, and find adjacent cases?
    // Or just simulate inputs:

    const bestInput = { ...input, ir: Math.min(100, (input.ir || 35) + 15), hardTarget: false };
    const bestCase = await determineCase(bestInput);

    const worstInput = { ...input, ir: Math.max(1, (input.ir || 35) - 15), hardTarget: true };
    const worstCase = await determineCase(worstInput);

    return {
        best: bestCase,
        likely: likelyCase,
        worst: worstCase
    };
}

/**
 * Generate suggestions based on input and matched case
 */
export function generateSuggestions(input, matchedCase) {
    const suggestions = [];

    if (!matchedCase) return suggestions;

    // 1. Difficulty based suggestions
    if (matchedCase.difficulty.includes('Khó') || matchedCase.difficulty.includes('Cực')) {
        suggestions.push({
            type: 'warning',
            text: 'Dự án thuộc nhóm KHÓ. Cần check kỹ với team Operation về khả năng đáp ứng.'
        });
    }

    // 2. IR suggestions
    if (input.ir < 10) {
        suggestions.push({
            type: 'danger',
            text: 'IR dưới 10% là rất thấp cho Online Panel. Cân nhắc tăng giá (CPI) hoặc nới lỏng tiêu chí.'
        });
    } else if (input.ir < 20) {
        suggestions.push({
            type: 'warning',
            text: 'IR thấp (10-20%). Tiến độ sẽ chậm, cần dự phòng thời gian.'
        });
    }

    // 3. LOI suggestions
    if (input.loi > 25) {
        suggestions.push({
            type: 'warning',
            text: 'LOI > 25 phút sẽ có tỷ lệ bỏ cuộc (drop-out) cao. Cân nhắc cắt ngắn bảng hỏi.'
        });
    }

    // 4. Quota suggestions
    if (input.quota === 'nested') {
        suggestions.push({
            type: 'info',
            text: 'Quota chéo (Nested) sẽ làm giảm tốc độ mẫu. Đảm bảo Feasibility cho từng cell nhỏ nhất.'
        });
    }

    // 5. Target suggestions
    if (input.hardTarget) {
        suggestions.push({
            type: 'info',
            text: 'Đối tượng khó/ngách (Niche) cần có Incentive cao hơn mức chuẩn.'
        });
    }

    // 6. Case specific suggestions
    if (matchedCase.suggestions && matchedCase.suggestions.length > 0) {
        matchedCase.suggestions.forEach(s => {
            suggestions.push({ type: 'info', text: s });
        });
    }

    return suggestions;
}

/**
 * Default cases (fallback if Firestore fails)
 */
function getDefaultCases() {
    return [
        { id: 'case_1', order: 1, name: 'Dễ (Simple)', difficulty: 'Dễ', conditions: { ir: { min: 51, max: 100 }, sample: { min: 1, max: 300 }, loi: { min: 1, max: 9 }, quota: 'simple', hardTarget: false }, samplesPerDay: 100, fwDaysMin: 3, fwDaysMax: 4, suggestions: [] },
        { id: 'case_2', order: 2, name: 'Trung bình (Simple)', difficulty: 'Trung bình', conditions: { ir: { min: 20, max: 50 }, sample: { min: 301, max: 800 }, loi: { min: 10, max: 15 }, quota: 'simple', hardTarget: false }, samplesPerDay: 70, fwDaysMin: 5, fwDaysMax: 7, suggestions: [] },
        { id: 'case_3', order: 3, name: 'Khó (Simple)', difficulty: 'Khó', conditions: { ir: { min: 1, max: 19 }, sample: { min: 801, max: 10000 }, loi: { min: 16, max: 60 }, quota: 'simple', hardTarget: false }, samplesPerDay: 50, fwDaysMin: 8, fwDaysMax: 10, suggestions: [] },
        { id: 'case_4', order: 4, name: 'Dễ (Nested)', difficulty: 'Dễ', conditions: { ir: { min: 51, max: 100 }, sample: { min: 1, max: 300 }, loi: { min: 1, max: 9 }, quota: 'nested', hardTarget: false }, samplesPerDay: 80, fwDaysMin: 4, fwDaysMax: 5, suggestions: [] },
        { id: 'case_5', order: 5, name: 'Trung bình (Nested)', difficulty: 'Trung bình', conditions: { ir: { min: 20, max: 50 }, sample: { min: 301, max: 800 }, loi: { min: 10, max: 15 }, quota: 'nested', hardTarget: false }, samplesPerDay: 60, fwDaysMin: 6, fwDaysMax: 8, suggestions: ['Nested quota có thể gặp khó ở cells cuối'] },
        { id: 'case_6', order: 6, name: 'Khó (Nested)', difficulty: 'Khó', conditions: { ir: { min: 1, max: 19 }, sample: { min: 801, max: 10000 }, loi: { min: 16, max: 60 }, quota: 'nested', hardTarget: false }, samplesPerDay: 40, fwDaysMin: 10, fwDaysMax: 12, suggestions: [] },
        { id: 'case_7', order: 7, name: 'Dễ + LOI trung bình', difficulty: 'Dễ (+)', conditions: { ir: { min: 51, max: 100 }, sample: { min: 1, max: 300 }, loi: { min: 10, max: 15 }, quota: 'simple', hardTarget: false }, samplesPerDay: 90, fwDaysMin: 4, fwDaysMax: 5, suggestions: [] },
        { id: 'case_8', order: 8, name: 'Trung bình + LOI dài', difficulty: 'Trung bình (+)', conditions: { ir: { min: 20, max: 50 }, sample: { min: 301, max: 800 }, loi: { min: 16, max: 60 }, quota: 'simple', hardTarget: false }, samplesPerDay: 60, fwDaysMin: 7, fwDaysMax: 9, suggestions: ['LOI dài, drop-off rate có thể cao'] },
        { id: 'case_9', order: 9, name: 'Khó + LOI dài + Nested', difficulty: 'Rất Khó', conditions: { ir: { min: 1, max: 19 }, sample: { min: 801, max: 10000 }, loi: { min: 16, max: 60 }, quota: 'nested', hardTarget: false }, samplesPerDay: 35, fwDaysMin: 12, fwDaysMax: 14, suggestions: ['Cân nhắc chia giai đoạn'] },
        { id: 'case_10', order: 10, name: 'Dễ + Target khó', difficulty: 'Khó (Target)', conditions: { ir: { min: 51, max: 100 }, sample: { min: 1, max: 300 }, loi: { min: 1, max: 9 }, quota: 'simple', hardTarget: true }, samplesPerDay: 70, fwDaysMin: 5, fwDaysMax: 6, suggestions: ['Target khó, cần check feasibility với vendor'] },
        { id: 'case_11', order: 11, name: 'TB + Target khó (Nested)', difficulty: 'Rất Khó (Target)', conditions: { ir: { min: 20, max: 50 }, sample: { min: 301, max: 800 }, loi: { min: 10, max: 15 }, quota: 'nested', hardTarget: true }, samplesPerDay: 45, fwDaysMin: 8, fwDaysMax: 10, suggestions: ['Target khó + Nested, rủi ro cao'] },
        { id: 'case_12', order: 12, name: 'Khó + Target khó (Nested)', difficulty: 'Cực Khó', conditions: { ir: { min: 1, max: 19 }, sample: { min: 801, max: 10000 }, loi: { min: 16, max: 60 }, quota: 'nested', hardTarget: true }, samplesPerDay: 25, fwDaysMin: 15, fwDaysMax: 18, suggestions: ['Cực kỳ khó, cần đàm phán timeline kỹ với PM'] }
    ];
}

export { getDefaultCases };
