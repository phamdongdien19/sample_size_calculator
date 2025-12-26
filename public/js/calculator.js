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

    // IR-based suggestions - Focus on risk rather than adding days (since factors already add days)
    if (ir < 25) {
        suggestions.push({
            type: 'warning',
            text: `⚠️ IR thấp (${ir}%). Hệ thống đã giảm tốc độ mẫu dự kiến. Chú ý rủi ro vendor không tìm đủ người.`
        });
    } else if (ir < 35) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ IR ở mức trung bình thấp (${ir}%). Tiến độ có thể không ổn định giữa các ngày.`
        });
    }

    // LOI-based suggestions
    if (loi > 20) {
        suggestions.push({
            type: 'warning',
            text: `⚠️ Bảng hỏi dài (${loi} phút). Nguy cơ tỷ lệ bỏ cuộc (Drop-off) cao, cần incentive đủ hấp dẫn.`
        });
    } else if (loi > 15) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ LOI ${loi} phút - Khá dài. Theo dõi kỹ Quality Check để tránh dữ liệu rác.`
        });
    }

    // Sample-based suggestions
    if (sampleSize > 800) {
        suggestions.push({
            type: 'info',
            text: `ℹ️ Sample lớn (${sampleSize}). Cần chia giai đoạn báo cáo dữ liệu định kỳ.`
        });
    }

    // Quota-based suggestions
    if (quota === 'nested') {
        suggestions.push({
            type: 'warning',
            text: '⚠️ Quota chéo (Nested). Dễ bị kẹt ở các nhóm nhỏ (niche cells) vào cuối fieldwork.'
        });
    }

    // Target-based suggestions
    if (hardTarget) {
        suggestions.push({
            type: 'critical',
            text: '🔴 Tuyệt đối PHẢI check feasibility với vendor trước khi commit timeline cho nhóm đối tượng này!'
        });
    }

    // Case-specific suggestion info
    if (matchedCase && matchedCase.suggestions) {
        matchedCase.suggestions.forEach(s => {
            suggestions.push({ type: 'case', text: `📋 ${s}` });
        });
    }

    return suggestions;
}
