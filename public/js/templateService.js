/**
 * Template Service
 * Handles project templates for quick input
 */

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let cachedTemplates = null;

/**
 * Load all project templates from Firestore
 */
export async function loadTemplates() {
    if (cachedTemplates) return cachedTemplates;

    try {
        const templatesRef = collection(db, 'project_templates');
        const q = query(templatesRef, orderBy('order', 'asc'));
        const snapshot = await getDocs(q);

        cachedTemplates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return cachedTemplates;
    } catch (error) {
        console.error('Error loading templates:', error);
        return getDefaultTemplates();
    }
}

/**
 * Get a specific template by ID
 */
export async function getTemplate(templateId) {
    const templates = await loadTemplates();
    return templates.find(t => t.id === templateId) || null;
}

/**
 * Clear cached templates
 */
export function clearTemplateCache() {
    cachedTemplates = null;
}

/**
 * Default templates (fallback)
 */
function getDefaultTemplates() {
    return [
        {
            id: 'brand_health',
            order: 1,
            name: 'Brand Health Check',
            icon: '📊',
            description: 'Đo lường sức khỏe thương hiệu định kỳ',
            defaults: {
                sampleSize: 500,
                ir: 40,
                loi: 15,
                quota: 'nested',
                hardTarget: false,
                location: 'nationwide',
                targetAudience: 'general'
            }
        },
        {
            id: 'product_test',
            order: 2,
            name: 'Product Concept Test',
            icon: '🧪',
            description: 'Test ý tưởng sản phẩm mới',
            defaults: {
                sampleSize: 300,
                ir: 50,
                loi: 10,
                quota: 'simple',
                hardTarget: false,
                location: 'hcm',
                targetAudience: 'general'
            }
        },
        {
            id: 'ad_testing',
            order: 3,
            name: 'Ad Testing',
            icon: '📺',
            description: 'Test quảng cáo, TVC',
            defaults: {
                sampleSize: 200,
                ir: 60,
                loi: 8,
                quota: 'simple',
                hardTarget: false,
                location: 'hcm',
                targetAudience: 'general'
            }
        },
        {
            id: 'ua_study',
            order: 4,
            name: 'U&A Study',
            icon: '🔍',
            description: 'Nghiên cứu Usage & Attitude',
            defaults: {
                sampleSize: 600,
                ir: 35,
                loi: 20,
                quota: 'nested',
                hardTarget: false,
                location: 'nationwide',
                targetAudience: 'general'
            }
        },
        {
            id: 'customer_satisfaction',
            order: 5,
            name: 'Customer Satisfaction',
            icon: '⭐',
            description: 'Khảo sát hài lòng khách hàng',
            defaults: {
                sampleSize: 400,
                ir: 45,
                loi: 12,
                quota: 'simple',
                hardTarget: false,
                location: 'nationwide',
                targetAudience: 'general'
            }
        },
        {
            id: 'b2b_decision_makers',
            order: 6,
            name: 'B2B Decision Makers',
            icon: '👔',
            description: 'Khảo sát lãnh đạo doanh nghiệp',
            defaults: {
                sampleSize: 100,
                ir: 10,
                loi: 20,
                quota: 'simple',
                hardTarget: true,
                location: 'nationwide',
                targetAudience: 'b2b'
            }
        },
        {
            id: 'healthcare_hcp',
            order: 7,
            name: 'Healthcare Professionals',
            icon: '🏥',
            description: 'Khảo sát bác sĩ, dược sĩ',
            defaults: {
                sampleSize: 50,
                ir: 5,
                loi: 25,
                quota: 'simple',
                hardTarget: true,
                location: 'nationwide',
                targetAudience: 'healthcare'
            }
        },
        {
            id: 'custom',
            order: 99,
            name: 'Custom / Khác',
            icon: '✏️',
            description: 'Tự nhập thông số',
            defaults: {
                sampleSize: 300,
                ir: 30,
                loi: 15,
                quota: 'simple',
                hardTarget: false,
                location: 'hcm',
                targetAudience: 'general'
            }
        }
    ];
}

export { getDefaultTemplates };
