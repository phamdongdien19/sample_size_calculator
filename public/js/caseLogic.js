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
 * Uses interpolation for smoother results when no exact match
 * @param {Object} input - {ir, sampleSize, loi, quota, hardTarget}
 * @returns {Object} matched case or interpolated case
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

    // No exact match - use interpolation for smoother results
    // This creates a synthetic case with interpolated samplesPerDay
    const interpolatedCase = getInterpolatedCase(input);

    // Find closest case for suggestions and difficulty context
    const closestCase = findClosestCase(cases, input);

    // Merge closest case suggestions into interpolated case
    if (closestCase && closestCase.suggestions) {
        interpolatedCase.suggestions = [...closestCase.suggestions];
    }

    return interpolatedCase;
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
 * Expanded to 18 cases with granular IR tiers for Online Panel Vietnam
 */
function getDefaultCases() {
    return [
        // ============ SIMPLE QUOTA - NORMAL TARGET ============
        // T1: Mass Market (IR 70-100%)
        {
            id: 'case_1', order: 1, name: 'Mass Market (Simple)', difficulty: 'Rất dễ',
            conditions: { ir: { min: 70, max: 100 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 15 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 120, fwDaysMin: 2, fwDaysMax: 4, suggestions: []
        },

        // T2: Standard (IR 50-69%)
        {
            id: 'case_2', order: 2, name: 'Standard (Simple)', difficulty: 'Dễ',
            conditions: { ir: { min: 50, max: 69 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 20 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 90, fwDaysMin: 4, fwDaysMax: 6, suggestions: []
        },

        // T3: Moderate (IR 30-49%)
        {
            id: 'case_3', order: 3, name: 'Moderate (Simple)', difficulty: 'Trung bình',
            conditions: { ir: { min: 30, max: 49 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 25 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 65, fwDaysMin: 5, fwDaysMax: 8, suggestions: []
        },

        // T4: Niche (IR 15-29%)
        {
            id: 'case_4', order: 4, name: 'Niche (Simple)', difficulty: 'Khó',
            conditions: { ir: { min: 15, max: 29 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 30 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 40, fwDaysMin: 7, fwDaysMax: 10, suggestions: ['IR thấp, cân nhắc tăng incentive']
        },

        // T5: Hard-to-Reach (IR 5-14%)
        {
            id: 'case_5', order: 5, name: 'Hard-to-Reach (Simple)', difficulty: 'Rất khó',
            conditions: { ir: { min: 5, max: 14 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 40 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 20, fwDaysMin: 10, fwDaysMax: 14, suggestions: ['Cần check feasibility với vendor']
        },

        // T6: Extreme (IR 1-4%)
        {
            id: 'case_6', order: 6, name: 'Extreme (Simple)', difficulty: 'Cực khó',
            conditions: { ir: { min: 1, max: 4 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 60 }, quota: 'simple', hardTarget: false },
            samplesPerDay: 8, fwDaysMin: 15, fwDaysMax: 25, suggestions: ['IR cực thấp, cân nhắc scope lại target', 'Có thể cần multi-vendor']
        },

        // ============ NESTED QUOTA - NORMAL TARGET ============
        // T1: Mass Market (IR 70-100%) + Nested
        {
            id: 'case_7', order: 7, name: 'Mass Market (Nested)', difficulty: 'Dễ',
            conditions: { ir: { min: 70, max: 100 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 15 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 100, fwDaysMin: 3, fwDaysMax: 5, suggestions: []
        },

        // T2: Standard (IR 50-69%) + Nested
        {
            id: 'case_8', order: 8, name: 'Standard (Nested)', difficulty: 'Trung bình',
            conditions: { ir: { min: 50, max: 69 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 20 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 75, fwDaysMin: 5, fwDaysMax: 7, suggestions: ['Nested quota, theo dõi cells nhỏ']
        },

        // T3: Moderate (IR 30-49%) + Nested
        {
            id: 'case_9', order: 9, name: 'Moderate (Nested)', difficulty: 'Khó',
            conditions: { ir: { min: 30, max: 49 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 25 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 50, fwDaysMin: 6, fwDaysMax: 9, suggestions: ['Cần check quota cells trước khi bắt đầu']
        },

        // T4: Niche (IR 15-29%) + Nested
        {
            id: 'case_10', order: 10, name: 'Niche (Nested)', difficulty: 'Rất khó',
            conditions: { ir: { min: 15, max: 29 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 30 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 30, fwDaysMin: 9, fwDaysMax: 12, suggestions: ['IR thấp + Nested = rủi ro cao', 'Cân nhắc relax quota']
        },

        // T5: Hard-to-Reach (IR 5-14%) + Nested
        {
            id: 'case_11', order: 11, name: 'Hard-to-Reach (Nested)', difficulty: 'Cực khó',
            conditions: { ir: { min: 5, max: 14 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 40 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 15, fwDaysMin: 12, fwDaysMax: 18, suggestions: ['Cực khó, cần đàm phán timeline kỹ']
        },

        // T6: Extreme (IR 1-4%) + Nested
        {
            id: 'case_12', order: 12, name: 'Extreme (Nested)', difficulty: 'Không khuyến khích',
            conditions: { ir: { min: 1, max: 4 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 60 }, quota: 'nested', hardTarget: false },
            samplesPerDay: 5, fwDaysMin: 20, fwDaysMax: 35, suggestions: ['Không khuyến khích', 'Cần relax quota hoặc tăng IR']
        },

        // ============ HARD TARGET CASES ============
        // Hard Target + Simple Quota
        {
            id: 'case_13', order: 13, name: 'Hard Target - Standard', difficulty: 'Khó (Target)',
            conditions: { ir: { min: 50, max: 100 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 20 }, quota: 'simple', hardTarget: true },
            samplesPerDay: 55, fwDaysMin: 6, fwDaysMax: 9, suggestions: ['Hard target, check với vendor trước']
        },

        {
            id: 'case_14', order: 14, name: 'Hard Target - Niche', difficulty: 'Rất khó (Target)',
            conditions: { ir: { min: 15, max: 49 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 30 }, quota: 'simple', hardTarget: true },
            samplesPerDay: 25, fwDaysMin: 10, fwDaysMax: 15, suggestions: ['Hard target + IR thấp = rủi ro rất cao']
        },

        {
            id: 'case_15', order: 15, name: 'Hard Target - Extreme', difficulty: 'Cực khó (Target)',
            conditions: { ir: { min: 1, max: 14 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 60 }, quota: 'simple', hardTarget: true },
            samplesPerDay: 10, fwDaysMin: 15, fwDaysMax: 25, suggestions: ['Cực khó, cần pre-recruit hoặc database riêng']
        },

        // Hard Target + Nested Quota
        {
            id: 'case_16', order: 16, name: 'Hard Target + Nested (Standard)', difficulty: 'Rất khó',
            conditions: { ir: { min: 50, max: 100 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 20 }, quota: 'nested', hardTarget: true },
            samplesPerDay: 40, fwDaysMin: 8, fwDaysMax: 12, suggestions: ['Hard target + Nested, cần plan kỹ']
        },

        {
            id: 'case_17', order: 17, name: 'Hard Target + Nested (Niche)', difficulty: 'Cực khó',
            conditions: { ir: { min: 15, max: 49 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 30 }, quota: 'nested', hardTarget: true },
            samplesPerDay: 18, fwDaysMin: 12, fwDaysMax: 20, suggestions: ['Rủi ro cực cao', 'Cân nhắc chia giai đoạn']
        },

        {
            id: 'case_18', order: 18, name: 'Hard Target + Nested (Extreme)', difficulty: 'Không khuyến khích',
            conditions: { ir: { min: 1, max: 14 }, sample: { min: 1, max: 10000 }, loi: { min: 1, max: 60 }, quota: 'nested', hardTarget: true },
            samplesPerDay: 6, fwDaysMin: 25, fwDaysMax: 40, suggestions: ['Không khuyến khích project type này', 'Cần database đặc biệt']
        }
    ];
}

/**
 * IR Anchor Points for Interpolation
 * Maps IR percentage to baseline Samples/Day for Simple Quota + Normal Target
 */
const IR_ANCHORS = [
    { ir: 100, base: 130 },
    { ir: 85, base: 115 },
    { ir: 70, base: 100 },
    { ir: 55, base: 80 },
    { ir: 40, base: 55 },
    { ir: 25, base: 35 },
    { ir: 15, base: 22 },
    { ir: 8, base: 12 },
    { ir: 3, base: 6 },
    { ir: 1, base: 4 }
];

/**
 * Interpolate Samples/Day based on IR value between anchor points
 * @param {number} ir - Incidence Rate (1-100)
 * @param {string} quota - 'simple' or 'nested'
 * @param {boolean} hardTarget - true/false
 * @returns {number} Interpolated samples per day
 */
export function interpolateSamplesPerDay(ir, quota = 'simple', hardTarget = false) {
    // Clamp IR to valid range
    ir = Math.max(1, Math.min(100, ir));

    // Find surrounding anchors
    let lower = IR_ANCHORS[IR_ANCHORS.length - 1];
    let upper = IR_ANCHORS[0];

    for (let i = 0; i < IR_ANCHORS.length - 1; i++) {
        if (ir <= IR_ANCHORS[i].ir && ir >= IR_ANCHORS[i + 1].ir) {
            upper = IR_ANCHORS[i];
            lower = IR_ANCHORS[i + 1];
            break;
        }
    }

    // Linear interpolation
    let baseSamplesPerDay;
    if (upper.ir === lower.ir) {
        baseSamplesPerDay = upper.base;
    } else {
        const ratio = (ir - lower.ir) / (upper.ir - lower.ir);
        baseSamplesPerDay = lower.base + ratio * (upper.base - lower.base);
    }

    // Apply Quota multiplier (Nested reduces by ~18%)
    if (quota === 'nested') {
        baseSamplesPerDay *= 0.82;
    }

    // Apply Hard Target multiplier (reduces by ~35%)
    if (hardTarget) {
        baseSamplesPerDay *= 0.65;
    }

    return Math.round(baseSamplesPerDay);
}

/**
 * Get interpolated case when no exact match is found
 * Creates a synthetic case with interpolated samples/day
 */
export function getInterpolatedCase(input) {
    const { ir, quota, hardTarget } = input;

    const samplesPerDay = interpolateSamplesPerDay(ir, quota, hardTarget);

    // Determine difficulty label based on samples/day
    let difficulty;
    if (samplesPerDay >= 100) difficulty = 'Rất dễ';
    else if (samplesPerDay >= 70) difficulty = 'Dễ';
    else if (samplesPerDay >= 45) difficulty = 'Trung bình';
    else if (samplesPerDay >= 25) difficulty = 'Khó';
    else if (samplesPerDay >= 12) difficulty = 'Rất khó';
    else difficulty = 'Cực khó';

    // Generate name
    const quotaLabel = quota === 'nested' ? 'Nested' : 'Simple';
    const targetLabel = hardTarget ? '+ Hard Target' : '';

    return {
        id: 'interpolated',
        order: 0,
        name: `IR ${ir}% (${quotaLabel}) ${targetLabel}`.trim(),
        difficulty: difficulty,
        conditions: {
            ir: { min: ir, max: ir },
            sample: { min: 1, max: 10000 },
            loi: { min: 1, max: 60 },
            quota: quota,
            hardTarget: hardTarget
        },
        samplesPerDay: samplesPerDay,
        fwDaysMin: null, // Will be calculated by calculator.js
        fwDaysMax: null,
        suggestions: [],
        isInterpolated: true // Flag to indicate this is a synthetic case
    };
}

/**
 * Calculate Diminishing Returns factor for large Sample Size
 * Reflects real-world behavior where:
 * - Small projects (N<500): Full speed, factor = 1.0
 * - Medium projects (500-1000): Slight slowdown, factor = 0.90-0.95
 * - Large projects (1000-2000): Moderate slowdown, factor = 0.80-0.90
 * - Very large projects (>2000): Significant slowdown, factor = 0.65-0.80
 * 
 * @param {number} sampleSize - Total sample size
 * @returns {object} { factor: number, tier: string, description: string }
 */
export function calculateSampleSizeFactor(sampleSize) {
    // Define thresholds and corresponding factors
    const tiers = [
        { max: 300, factor: 1.0, tier: 'Small', desc: 'Dự án nhỏ, tốc độ tối ưu' },
        { max: 500, factor: 0.97, tier: 'Standard', desc: 'Dự án tiêu chuẩn' },
        { max: 800, factor: 0.93, tier: 'Medium', desc: 'Dự án trung bình' },
        { max: 1200, factor: 0.88, tier: 'Large', desc: 'Dự án lớn, quota cuối có thể chậm' },
        { max: 2000, factor: 0.82, tier: 'Very Large', desc: 'Dự án rất lớn, cần chia phase' },
        { max: 3500, factor: 0.75, tier: 'Massive', desc: 'Dự án khổng lồ, multi-vendor khuyến khích' },
        { max: Infinity, factor: 0.68, tier: 'Mega', desc: 'Mega project, cần strategy đặc biệt' }
    ];

    for (const t of tiers) {
        if (sampleSize <= t.max) {
            return {
                factor: t.factor,
                tier: t.tier,
                description: t.desc
            };
        }
    }

    // Fallback (should not reach here)
    return { factor: 0.68, tier: 'Mega', description: 'Mega project' };
}

export { getDefaultCases };


