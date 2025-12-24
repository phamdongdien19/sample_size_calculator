/**
 * Calculator Service
 * Handles FW days calculation and CPI estimation
 */

/**
 * Calculate FW days based on sample size and rate
 * @param {number} sampleSize - Total sample needed
 * @param {number} samplesPerDay - Average samples per day for this case
 * @returns {Object} { min, max, exact }
 */
export function calculateFWDays(sampleSize, samplesPerDay) {
    if (!samplesPerDay || samplesPerDay <= 0) {
        return { min: 0, max: 0, exact: 0 };
    }

    const exactDays = sampleSize / samplesPerDay;

    // Add buffer for real-world variance
    const minDays = Math.ceil(exactDays);
    const maxDays = Math.ceil(exactDays * 1.25); // 25% buffer

    return {
        min: Math.max(1, minDays),
        max: Math.max(minDays + 1, maxDays),
        exact: Math.round(exactDays * 10) / 10
    };
}

/**
 * Calculate custom FW days when expert overrides
 * @param {number} expertDays - Days entered by expert
 * @param {Object} systemEstimate - System calculated { min, max }
 * @returns {Object} Comparison result
 */
export function compareExpertVsSystem(expertDays, systemEstimate) {
    const systemMid = (systemEstimate.min + systemEstimate.max) / 2;
    const diff = expertDays - systemMid;
    const diffPercent = Math.round((diff / systemMid) * 100);

    let status = 'normal';
    let warning = null;

    if (diffPercent < -30) {
        status = 'too_low';
        warning = `⚠️ Số ngày bạn nhập thấp hơn ước tính ${Math.abs(diffPercent)}%. Có thể gây rủi ro thiếu thời gian.`;
    } else if (diffPercent > 50) {
        status = 'too_high';
        warning = `ℹ️ Số ngày bạn nhập cao hơn ước tính ${diffPercent}%. Đảm bảo PM hiểu lý do.`;
    } else if (diffPercent < 0) {
        status = 'slightly_low';
        warning = `Số ngày thấp hơn ước tính một chút. Đảm bảo đã cân nhắc kỹ.`;
    }

    return { status, warning, diffPercent };
}

/**
 * Estimate CPI based on project parameters
 * @param {Object} params - { loi, ir, hardTarget, quota }
 * @returns {Object} { amount, currency, breakdown }
 */
export function estimateCPI(params) {
    const { loi, ir, hardTarget, quota } = params;

    // Base CPI for Vietnam (in USD)
    let base = 1.50;
    const breakdown = ['Base: $1.50'];

    // LOI adjustment
    if (loi > 10) {
        const loiExtra = (loi - 10) * 0.08;
        base += loiExtra;
        breakdown.push(`LOI ${loi}m: +$${loiExtra.toFixed(2)}`);
    }

    // IR adjustment
    if (ir < 30) {
        const irExtra = ir < 15 ? 1.00 : 0.50;
        base += irExtra;
        breakdown.push(`IR ${ir}%: +$${irExtra.toFixed(2)}`);
    }

    // Quota adjustment
    if (quota === 'nested') {
        base += 0.30;
        breakdown.push('Nested quota: +$0.30');
    }

    // Hard target adjustment
    if (hardTarget) {
        const targetMultiplier = 1.5;
        const targetExtra = base * (targetMultiplier - 1);
        base *= targetMultiplier;
        breakdown.push(`Hard target: x1.5 (+$${targetExtra.toFixed(2)})`);
    }

    return {
        amount: Math.round(base * 100) / 100,
        currency: 'USD',
        breakdown
    };
}

/**
 * Generate smart suggestions based on input
 * @param {Object} input - Project parameters
 * @param {Object} matchedCase - The matched case
 * @returns {Array} List of suggestions
 */
export function generateSuggestions(input, matchedCase) {
    const suggestions = [];
    const { ir, sampleSize, loi, quota, hardTarget } = input;

    // IR-based suggestions
    if (ir < 25) {
        suggestions.push({
            type: 'warning',
            text: `⚠️ IR thấp (${ir}%), nên thêm 2-3 ngày buffer cho trường hợp response rate thấp hơn dự kiến.`
        });
    } else if (ir < 35) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ IR ở mức trung bình thấp (${ir}%), cân nhắc thêm 1 ngày buffer.`
        });
    }

    // LOI-based suggestions
    if (loi > 20) {
        suggestions.push({
            type: 'warning',
            text: `⚠️ Bảng hỏi dài (${loi} phút), drop-off rate có thể cao. Nên thêm 1-2 ngày.`
        });
    } else if (loi > 15) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ LOI ${loi} phút - khá dài, theo dõi quality check kỹ.`
        });
    }

    // Sample-based suggestions
    if (sampleSize > 800) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ Sample lớn (${sampleSize}), pace có thể chậm dần về cuối fieldwork.`
        });
    }

    // Quota-based suggestions
    if (quota === 'nested') {
        suggestions.push({
            type: 'warning',
            text: '⚠️ Nested quota có thể gặp khó ở các cells cuối cùng. Theo dõi sát từ ngày 3-4.'
        });
    }

    // Target-based suggestions
    if (hardTarget) {
        suggestions.push({
            type: 'critical',
            text: '🔴 Target khó - PHẢI check feasibility với vendor trước khi commit timeline!'
        });
    }

    // Add case-specific suggestions
    if (matchedCase && matchedCase.suggestions) {
        matchedCase.suggestions.forEach(s => {
            suggestions.push({ type: 'case', text: `📋 ${s}` });
        });
    }

    // Final recommendation
    if (suggestions.filter(s => s.type === 'warning' || s.type === 'critical').length >= 2) {
        suggestions.push({
            type: 'recommend',
            text: '💡 Nhiều yếu tố rủi ro - Suggest thêm 20-30% buffer vào timeline.'
        });
    }

    return suggestions;
}
