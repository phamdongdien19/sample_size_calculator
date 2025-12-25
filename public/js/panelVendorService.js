/**
 * Panel Vendor Service
 * Manages panel vendor data and factor calculations
 */

import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedVendors = null;

/**
 * Default Panel Vendors with factors
 * responseFactor: Multiplier for daily completion rate (higher = faster)
 * defaultQcReject: Default QC rejection rate
 */
const DEFAULT_VENDORS = [
    {
        id: 'ifm',
        name: 'Panel IFM',
        order: 1,
        responseFactor: 0.7,
        defaultQcReject: 0.05,
        isInternal: true,
        pros: ['Recontact cao', 'Chất lượng tốt'],
        cons: ['Response rate thấp'],
        description: 'Panel nội bộ công ty'
    },
    {
        id: 'purespectrum',
        name: 'Purespectrum',
        order: 2,
        responseFactor: 1.4,
        defaultQcReject: 0.45,
        isInternal: false,
        pros: ['Response rate cao', 'Setup nhanh', 'Giá rẻ (tự chọn)'],
        cons: ['Cheater nhiều', 'QC loại 40-50%'],
        description: 'Vendor - Tự setup trên hệ thống'
    },
    {
        id: 'opinionmind',
        name: 'Opinionmind',
        order: 3,
        responseFactor: 1.0,
        defaultQcReject: 0.15,
        isInternal: false,
        pros: ['Response đúng target cao', 'Số lượng khá'],
        cons: ['Phải bidding CPI', 'Giá cao', 'Update quota qua email tốn thời gian'],
        description: 'Vendor - Liên hệ trao đổi bidding'
    },
    {
        id: 'paneland',
        name: 'Paneland',
        order: 4,
        responseFactor: 1.2,
        defaultQcReject: 0.15,
        isInternal: false,
        pros: ['Response rate cao', 'Số lượng khá-cao'],
        cons: ['Phải bidding CPI', 'Giá cao', 'Không ổn định', 'Update quota qua email'],
        description: 'Vendor - Liên hệ trao đổi bidding'
    },
    {
        id: 'infosec',
        name: 'Infosec',
        order: 5,
        responseFactor: 0.9,
        defaultQcReject: 0.15,
        isInternal: false,
        pros: ['Response rate trung bình khá', 'Vendor mới'],
        cons: ['Phải bidding CPI', 'Giá cao', 'Update quota qua email'],
        description: 'Vendor mới'
    },
    {
        id: 'fulcrum',
        name: 'Fulcrum (Cint)',
        order: 6,
        responseFactor: 1.3,
        defaultQcReject: 0.20,
        isInternal: false,
        pros: ['Response rate cao', 'Số lượng khá', 'Tự setup nhanh'],
        cons: ['Giá cao (đóng trước 1 năm)', 'Rủi ro chênh lệch CPI cho phí quản lý'],
        description: 'Vendor - Tự setup, đóng phí trước'
    }
];

/**
 * Load all panel vendors from Firestore
 */
export async function loadPanelVendors() {
    if (cachedVendors) return cachedVendors;

    try {
        const vendorsRef = collection(db, 'panel_vendors');
        const q = query(vendorsRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        const vendors = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (vendors.length === 0) {
            console.log('No vendors in Firestore, using defaults');
            cachedVendors = DEFAULT_VENDORS;
        } else {
            cachedVendors = vendors;
        }

        return cachedVendors;
    } catch (error) {
        console.error('Error loading panel vendors:', error);
        cachedVendors = DEFAULT_VENDORS;
        return cachedVendors;
    }
}

/**
 * Clear cached vendors (call after admin updates)
 */
export function clearVendorCache() {
    cachedVendors = null;
}

/**
 * Get default vendors
 */
export function getDefaultVendors() {
    return DEFAULT_VENDORS;
}

/**
 * Calculate combined vendor factor from multiple selected vendors
 * When multiple vendors are used, we take weighted average
 * @param {Array} selectedVendorIds - Array of vendor IDs selected
 * @returns {Object} { factor, avgQcReject, vendors }
 */
export async function calculateVendorFactor(selectedVendorIds) {
    if (!selectedVendorIds || selectedVendorIds.length === 0) {
        return {
            factor: 1.0,
            avgQcReject: 0.1,
            vendors: []
        };
    }

    const allVendors = await loadPanelVendors();
    const selectedVendors = allVendors.filter(v => selectedVendorIds.includes(v.id));

    if (selectedVendors.length === 0) {
        return {
            factor: 1.0,
            avgQcReject: 0.1,
            vendors: []
        };
    }

    // Average the factors
    const totalFactor = selectedVendors.reduce((sum, v) => sum + (v.responseFactor || 1.0), 0);
    const totalQcReject = selectedVendors.reduce((sum, v) => sum + (v.defaultQcReject || 0.1), 0);

    return {
        factor: totalFactor / selectedVendors.length,
        avgQcReject: totalQcReject / selectedVendors.length,
        vendors: selectedVendors
    };
}

/**
 * Save vendor to Firestore (for admin)
 */
export async function saveVendor(vendor) {
    const vendorRef = doc(db, 'panel_vendors', vendor.id);
    await setDoc(vendorRef, vendor);
    clearVendorCache();
}

/**
 * Delete vendor from Firestore (for admin)
 */
export async function deleteVendor(vendorId) {
    const vendorRef = doc(db, 'panel_vendors', vendorId);
    await deleteDoc(vendorRef);
    clearVendorCache();
}

/**
 * Seed default vendors to Firestore
 */
export async function seedDefaultVendors() {
    for (const vendor of DEFAULT_VENDORS) {
        await saveVendor(vendor);
    }
    return DEFAULT_VENDORS.length;
}

export { DEFAULT_VENDORS };
