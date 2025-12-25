/**
 * Timing Service
 * Handles Vietnamese holidays, day-of-week factors, and timing calculations
 */

import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Vietnamese Fixed Holidays (Solar calendar dates)
 */
const FIXED_HOLIDAYS_VN = [
    { name: 'Tết Dương lịch', month: 1, day: 1, duration: 1, factor: 1.1 },
    { name: 'Giải phóng miền Nam', month: 4, day: 30, duration: 1, factor: 1.2 },
    { name: 'Quốc tế Lao động', month: 5, day: 1, duration: 1, factor: 1.2 },
    { name: 'Quốc Khánh', month: 9, day: 2, duration: 2, factor: 1.15 },
    { name: 'Giáng Sinh', month: 12, day: 25, duration: 3, factor: 1.1 }
];

/**
 * Lunar calendar to Solar date conversion for Tết
 * Pre-calculated Tết dates (Mùng 1 Tết Nguyên Đán) for 2024-2030
 * Each entry: { year, month, day } in solar calendar
 */
const TET_DATES = {
    2024: { month: 2, day: 10 },  // Giáp Thìn
    2025: { month: 1, day: 29 },  // Ất Tỵ
    2026: { month: 2, day: 17 },  // Bính Ngọ
    2027: { month: 2, day: 6 },   // Đinh Mùi
    2028: { month: 1, day: 26 },  // Mậu Thân
    2029: { month: 2, day: 13 },  // Kỷ Dậu
    2030: { month: 2, day: 3 }    // Canh Tuất
};

/**
 * Giỗ Tổ Hùng Vương (10/3 Âm lịch) - Pre-calculated solar dates
 */
const HUNG_VUONG_DATES = {
    2024: { month: 4, day: 18 },
    2025: { month: 4, day: 7 },
    2026: { month: 4, day: 26 },
    2027: { month: 4, day: 16 },
    2028: { month: 4, day: 4 },
    2029: { month: 4, day: 23 },
    2030: { month: 4, day: 12 }
};

/**
 * Day of week factors
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const DEFAULT_DAY_FACTORS = {
    0: 1.10,  // Sunday - mobile traffic tăng
    1: 0.85,  // Monday - chậm
    2: 0.85,  // Tuesday - chậm
    3: 1.00,  // Wednesday - bình thường
    4: 1.00,  // Thursday - bình thường
    5: 0.95,  // Friday - hơi chậm
    6: 1.10   // Saturday - mobile traffic tăng
};

let cachedTimingConfig = null;

/**
 * Get all holidays for a specific year
 * @param {number} year
 * @returns {Array} Array of holiday objects with date ranges
 */
export function getHolidaysForYear(year) {
    const holidays = [];

    // Fixed holidays
    FIXED_HOLIDAYS_VN.forEach(h => {
        const startDate = new Date(year, h.month - 1, h.day);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + h.duration - 1);

        holidays.push({
            name: h.name,
            startDate,
            endDate,
            duration: h.duration,
            factor: h.factor,
            type: 'fixed'
        });
    });

    // Tết Nguyên Đán (9-14 days around Mùng 1)
    if (TET_DATES[year]) {
        const tetDate = TET_DATES[year];
        const mung1 = new Date(year, tetDate.month - 1, tetDate.day);

        // Tết period: 5 days before to 7 days after Mùng 1
        const startDate = new Date(mung1);
        startDate.setDate(startDate.getDate() - 5); // 26-27 Tết âm

        const endDate = new Date(mung1);
        endDate.setDate(endDate.getDate() + 7); // Mùng 8

        holidays.push({
            name: 'Tết Nguyên Đán',
            startDate,
            endDate,
            mung1Date: mung1,
            duration: 13,
            factor: 1.8, // Average impact
            peakFactor: 2.0, // Days around Mùng 1-3
            type: 'lunar'
        });
    }

    // Giỗ Tổ Hùng Vương
    if (HUNG_VUONG_DATES[year]) {
        const hvDate = HUNG_VUONG_DATES[year];
        const date = new Date(year, hvDate.month - 1, hvDate.day);

        holidays.push({
            name: 'Giỗ Tổ Hùng Vương',
            startDate: date,
            endDate: date,
            duration: 1,
            factor: 1.1,
            type: 'lunar'
        });
    }

    // 30/4 - 1/5 combined (usually 4-5 day holiday)
    const apr30 = holidays.find(h => h.name === 'Giải phóng miền Nam');
    const may1 = holidays.find(h => h.name === 'Quốc tế Lao động');
    if (apr30 && may1) {
        // Merge into single holiday period
        apr30.endDate = may1.endDate;
        apr30.name = '30/4 - 1/5';
        apr30.duration = 4;
        apr30.factor = 1.25;
        // Remove may1 from list
        const may1Index = holidays.indexOf(may1);
        if (may1Index > -1) {
            holidays.splice(may1Index, 1);
        }
    }

    return holidays.sort((a, b) => a.startDate - b.startDate);
}

/**
 * Check if a date is within a holiday period
 * @param {Date} date
 * @returns {Object|null} Holiday info if in holiday period, null otherwise
 */
export function isHolidayPeriod(date) {
    const year = date.getFullYear();
    const holidays = getHolidaysForYear(year);

    for (const holiday of holidays) {
        if (date >= holiday.startDate && date <= holiday.endDate) {
            return holiday;
        }
    }

    // Check early next year (for dates near year end)
    if (date.getMonth() >= 10) { // November or December
        const nextYearHolidays = getHolidaysForYear(year + 1);
        for (const holiday of nextYearHolidays) {
            if (date >= holiday.startDate && date <= holiday.endDate) {
                return holiday;
            }
        }
    }

    return null;
}

/**
 * Calculate timing factor for a fieldwork period
 * @param {Date} startDate - FW start date
 * @param {number} estimatedDays - Estimated FW duration
 * @returns {Object} { factor, warnings, holidays }
 */
export function calculateTimingFactor(startDate, estimatedDays) {
    if (!startDate || !estimatedDays || estimatedDays <= 0) {
        return { factor: 1.0, warnings: [], holidays: [] };
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + estimatedDays);

    const warnings = [];
    const affectedHolidays = [];
    let totalFactor = 0;
    let dayCount = 0;

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        let dayFactor = DEFAULT_DAY_FACTORS[currentDate.getDay()] || 1.0;

        // Check for holiday
        const holiday = isHolidayPeriod(currentDate);
        if (holiday) {
            // Apply holiday factor (inverse - higher factor means slower)
            // Convert to daily rate multiplier
            dayFactor = dayFactor / holiday.factor;

            // Track unique holidays
            if (!affectedHolidays.find(h => h.name === holiday.name)) {
                affectedHolidays.push(holiday);
            }
        }

        totalFactor += dayFactor;
        dayCount++;
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Average factor across all days
    const avgFactor = dayCount > 0 ? totalFactor / dayCount : 1.0;

    // Generate warnings
    affectedHolidays.forEach(h => {
        if (h.name === 'Tết Nguyên Đán') {
            warnings.push({
                type: 'critical',
                message: `⚠️ FW trùng với Tết Nguyên Đán! Dự kiến chậm ${Math.round((h.factor - 1) * 100)}% so với bình thường.`
            });
        } else {
            warnings.push({
                type: 'warning',
                message: `📅 FW trùng với ${h.name}. Có thể chậm ${Math.round((h.factor - 1) * 100)}%.`
            });
        }
    });

    return {
        factor: avgFactor,
        warnings,
        holidays: affectedHolidays,
        startDate,
        endDate
    };
}

/**
 * Get suggested timing factor based on just the start date
 * Quick check for upcoming holidays
 */
export function getQuickTimingCheck(startDate) {
    if (!startDate) return { isHoliday: false, factor: 1.0, message: '' };

    // Check next 14 days for major holidays
    const checkEnd = new Date(startDate);
    checkEnd.setDate(checkEnd.getDate() + 14);

    const currentDate = new Date(startDate);
    const foundHolidays = [];

    while (currentDate <= checkEnd) {
        const holiday = isHolidayPeriod(currentDate);
        if (holiday && !foundHolidays.find(h => h.name === holiday.name)) {
            foundHolidays.push(holiday);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (foundHolidays.length === 0) {
        return {
            isHoliday: false,
            factor: 1.0,
            message: '✅ Không có lễ/tết trong 14 ngày tới'
        };
    }

    const holidays = foundHolidays.map(h => h.name).join(', ');
    const maxFactor = Math.max(...foundHolidays.map(h => h.factor));

    return {
        isHoliday: true,
        factor: maxFactor,
        holidays: foundHolidays,
        message: `⚠️ Sắp có: ${holidays}`
    };
}

/**
 * Load timing config from Firestore (for admin customization)
 */
export async function loadTimingConfig() {
    if (cachedTimingConfig) return cachedTimingConfig;

    try {
        const configRef = doc(db, 'app_config', 'timing');
        const docSnap = await getDoc(configRef);

        if (docSnap.exists()) {
            cachedTimingConfig = docSnap.data();
        } else {
            cachedTimingConfig = {
                dayFactors: DEFAULT_DAY_FACTORS,
                tetFactor: 1.8,
                holidayFactorMultiplier: 1.0
            };
        }

        return cachedTimingConfig;
    } catch (error) {
        console.error('Error loading timing config:', error);
        return {
            dayFactors: DEFAULT_DAY_FACTORS,
            tetFactor: 1.8,
            holidayFactorMultiplier: 1.0
        };
    }
}

/**
 * Save timing config to Firestore (for admin)
 */
export async function saveTimingConfig(config) {
    const configRef = doc(db, 'app_config', 'timing');
    await setDoc(configRef, config);
    cachedTimingConfig = config;
}

/**
 * Clear cached config
 */
export function clearTimingCache() {
    cachedTimingConfig = null;
}

export { DEFAULT_DAY_FACTORS, FIXED_HOLIDAYS_VN, TET_DATES };
