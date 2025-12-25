/**
 * Admin Page Controller
 */

import { auth, googleProvider, APP_CONFIG } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getAllCases, addCase, updateCase, deleteCase, seedDefaultCases,
    getAllLocations, addLocation, updateLocation, deleteLocation, seedDefaultLocations,
    getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedDefaultTemplates,
    getAllHistory, deleteHistoryItem, clearAllHistory
} from './adminService.js';
// Phase 2: Import vendor and config services
import { loadPanelVendors, saveVendor, deleteVendor, seedDefaultVendors, getDefaultVendors } from './panelVendorService.js';
import { saveQuotaSkewConfig, loadQuotaSkewConfig } from './quotaSkewService.js';
import { saveTimingConfig, loadTimingConfig } from './timingService.js';

// ============ STATE ============
let currentUser = null;
let currentTab = 'cases';
let editingId = null;
let editingType = null;

// ============ DOM ELEMENTS ============
const elements = {
    // Auth
    loginRequired: document.getElementById('loginRequired'),
    adminContent: document.getElementById('adminContent'),
    userEmail: document.getElementById('userEmail'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Tables
    casesTableBody: document.getElementById('casesTableBody'),
    locationsTableBody: document.getElementById('locationsTableBody'),
    templatesTableBody: document.getElementById('templatesTableBody'),
    historyTableBody: document.getElementById('historyTableBody'),

    // Buttons
    addCaseBtn: document.getElementById('addCaseBtn'),
    addLocationBtn: document.getElementById('addLocationBtn'),
    addTemplateBtn: document.getElementById('addTemplateBtn'),
    seedCasesBtn: document.getElementById('seedCasesBtn'),
    seedLocationsBtn: document.getElementById('seedLocationsBtn'),
    seedTemplatesBtn: document.getElementById('seedTemplatesBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    // Modal
    modalOverlay: document.getElementById('modalOverlay'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    modalCancel: document.getElementById('modalCancel'),
    modalSave: document.getElementById('modalSave'),

    // Phase 2: Vendors, Quota Skew, Timing
    vendorsTableBody: document.getElementById('vendorsTableBody'),
    addVendorBtn: document.getElementById('addVendorBtn'),
    seedVendorsBtn: document.getElementById('seedVendorsBtn'),
    saveQuotaSkewBtn: document.getElementById('saveQuotaSkewBtn'),
    saveTimingBtn: document.getElementById('saveTimingBtn'),
    // Quota Skew inputs
    skewBalanced: document.getElementById('skewBalanced'),
    skewLight: document.getElementById('skewLight'),
    skewHeavy: document.getElementById('skewHeavy'),
    // Timing inputs
    dayMon: document.getElementById('dayMon'),
    dayTue: document.getElementById('dayTue'),
    dayWed: document.getElementById('dayWed'),
    dayThu: document.getElementById('dayThu'),
    dayFri: document.getElementById('dayFri'),
    daySat: document.getElementById('daySat'),
    daySun: document.getElementById('daySun'),
    holidayTet: document.getElementById('holidayTet'),
    holiday30Apr: document.getElementById('holiday30Apr'),
    holidayHungVuong: document.getElementById('holidayHungVuong'),
    holidayNational: document.getElementById('holidayNational'),
    holidayChristmas: document.getElementById('holidayChristmas')
};

// ============ INITIALIZATION ============
function init() {
    console.log('Initializing Admin Panel...');

    // Auth state listener
    onAuthStateChanged(auth, handleAuthStateChange);

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Auth
    elements.loginBtn.addEventListener('click', login);
    elements.logoutBtn.addEventListener('click', logout);
    elements.googleLoginBtn.addEventListener('click', login);

    // Tabs
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Add buttons
    elements.addCaseBtn.addEventListener('click', () => openModal('case', null));
    elements.addLocationBtn.addEventListener('click', () => openModal('location', null));
    elements.addTemplateBtn.addEventListener('click', () => openModal('template', null));

    // Seed buttons
    elements.seedCasesBtn.addEventListener('click', onSeedCases);
    elements.seedLocationsBtn.addEventListener('click', onSeedLocations);
    elements.seedTemplatesBtn.addEventListener('click', onSeedTemplates);
    elements.clearHistoryBtn.addEventListener('click', onClearHistory);

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalCancel.addEventListener('click', closeModal);
    elements.modalSave.addEventListener('click', onModalSave);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });

    // Phase 2: Vendor, Quota Skew, Timing buttons
    if (elements.addVendorBtn) elements.addVendorBtn.addEventListener('click', () => openModal('vendor', null));
    if (elements.seedVendorsBtn) elements.seedVendorsBtn.addEventListener('click', onSeedVendors);
    if (elements.saveQuotaSkewBtn) elements.saveQuotaSkewBtn.addEventListener('click', onSaveQuotaSkew);
    if (elements.saveTimingBtn) elements.saveTimingBtn.addEventListener('click', onSaveTimingConfig);
}

// ============ AUTH ============
function handleAuthStateChange(user) {
    currentUser = user;

    if (user) {
        elements.userEmail.textContent = user.email;
        elements.loginBtn.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        elements.loginRequired.classList.add('hidden');
        elements.adminContent.classList.remove('hidden');

        // Load data
        loadAllData();
    } else {
        elements.userEmail.textContent = 'Chưa đăng nhập';
        elements.loginBtn.classList.remove('hidden');
        elements.logoutBtn.classList.add('hidden');
        elements.loginRequired.classList.remove('hidden');
        elements.adminContent.classList.add('hidden');
    }
}

async function login() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error('Login error:', error);
        alert('Đăng nhập thất bại: ' + error.message);
    }
}

async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// ============ TABS ============
function switchTab(tabName) {
    currentTab = tabName;

    elements.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
}

// ============ DATA LOADING ============
async function loadAllData() {
    await Promise.all([
        loadCases(),
        loadLocations(),
        loadTemplates(),
        loadHistory(),
        loadVendors(),
        loadQuotaSkewSettings(),
        loadTimingSettings()
    ]);
}

async function loadCases() {
    elements.casesTableBody.innerHTML = '<tr><td colspan="11">Đang tải...</td></tr>';

    const cases = await getAllCases();

    if (cases.length === 0) {
        elements.casesTableBody.innerHTML = '<tr><td colspan="11">Chưa có cases. Nhấn "Tạo 12 Cases mặc định" bên dưới.</td></tr>';
        return;
    }

    elements.casesTableBody.innerHTML = cases.map(c => `
        <tr>
            <td>${c.order}</td>
            <td>${c.name}</td>
            <td>${c.difficulty}</td>
            <td>${c.conditions?.ir?.min}-${c.conditions?.ir?.max}%</td>
            <td>${c.conditions?.sample?.min}-${c.conditions?.sample?.max}</td>
            <td>${c.conditions?.loi?.min}-${c.conditions?.loi?.max}m</td>
            <td>${c.conditions?.quota}</td>
            <td>${c.conditions?.hardTarget ? 'Khó' : 'Thường'}</td>
            <td>${c.samplesPerDay}</td>
            <td>${c.fwDaysMin}-${c.fwDaysMax}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editCase('${c.id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteCase('${c.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function loadLocations() {
    elements.locationsTableBody.innerHTML = '<tr><td colspan="7">Đang tải...</td></tr>';

    const locations = await getAllLocations();

    if (locations.length === 0) {
        elements.locationsTableBody.innerHTML = '<tr><td colspan="7">Chưa có locations.</td></tr>';
        return;
    }

    elements.locationsTableBody.innerHTML = locations.map(l => `
        <tr>
            <td>${l.id}</td>
            <td>${l.name}</td>
            <td>${l.tier}</td>
            <td>${l.defaultIR}%</td>
            <td>${l.irRange?.min}-${l.irRange?.max}%</td>
            <td>${l.notes || '-'}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editLocation('${l.id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteLocation('${l.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function loadTemplates() {
    elements.templatesTableBody.innerHTML = '<tr><td colspan="8">Đang tải...</td></tr>';

    const templates = await getAllTemplates();

    if (templates.length === 0) {
        elements.templatesTableBody.innerHTML = '<tr><td colspan="8">Chưa có templates.</td></tr>';
        return;
    }

    elements.templatesTableBody.innerHTML = templates.map(t => `
        <tr>
            <td>${t.icon || '📋'}</td>
            <td>${t.name}</td>
            <td>${t.defaults?.sampleSize}</td>
            <td>${t.defaults?.ir}%</td>
            <td>${t.defaults?.loi}m</td>
            <td>${t.defaults?.quota}</td>
            <td>${t.defaults?.hardTarget ? 'Khó' : 'Thường'}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editTemplate('${t.id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteTemplate('${t.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function loadHistory() {
    elements.historyTableBody.innerHTML = '<tr><td colspan="7">Đang tải...</td></tr>';

    const history = await getAllHistory();

    if (history.length === 0) {
        elements.historyTableBody.innerHTML = '<tr><td colspan="7">Chưa có lịch sử.</td></tr>';
        return;
    }

    elements.historyTableBody.innerHTML = history.map(h => `
        <tr>
            <td>${h.createdAt?.toLocaleDateString('vi-VN') || 'N/A'}</td>
            <td>${h.projectName}</td>
            <td>${h.input?.sampleSize}</td>
            <td>${h.systemResult?.fwDaysMin}-${h.systemResult?.fwDaysMax}</td>
            <td><strong>${h.expertConclusion?.fwDays || '-'}</strong></td>
            <td>${h.expertConclusion?.note || '-'}</td>
            <td class="actions">
                <button class="btn-delete" onclick="deleteHistory('${h.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

// ============ MODAL ============
function openModal(type, id) {
    editingType = type;
    editingId = id;

    elements.modalTitle.textContent = id ? `Sửa ${type}` : `Thêm ${type} mới`;
    elements.modalBody.innerHTML = getModalForm(type);
    elements.modalOverlay.classList.remove('hidden');
}

function closeModal() {
    elements.modalOverlay.classList.add('hidden');
    editingId = null;
    editingType = null;
}

function getModalForm(type) {
    if (type === 'case') {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Order</label>
                    <input type="number" id="formOrder" value="1">
                </div>
                <div class="form-group">
                    <label>Tên</label>
                    <input type="text" id="formName" placeholder="Dễ (Simple)">
                </div>
            </div>
            <div class="form-group">
                <label>Độ khó</label>
                <input type="text" id="formDifficulty" placeholder="Dễ / Trung bình / Khó">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>IR Min (%)</label>
                    <input type="number" id="formIrMin">
                </div>
                <div class="form-group">
                    <label>IR Max (%)</label>
                    <input type="number" id="formIrMax">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Sample Min</label>
                    <input type="number" id="formSampleMin">
                </div>
                <div class="form-group">
                    <label>Sample Max</label>
                    <input type="number" id="formSampleMax">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>LOI Min (phút)</label>
                    <input type="number" id="formLoiMin">
                </div>
                <div class="form-group">
                    <label>LOI Max (phút)</label>
                    <input type="number" id="formLoiMax">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Quota</label>
                    <select id="formQuota">
                        <option value="simple">Simple</option>
                        <option value="nested">Nested</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Target</label>
                    <select id="formHardTarget">
                        <option value="false">Thường</option>
                        <option value="true">Khó</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Samples/Day</label>
                    <input type="number" id="formSamplesPerDay">
                </div>
                <div class="form-group">
                    <label>FW Days (Min-Max)</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="number" id="formFwMin" placeholder="Min">
                        <input type="number" id="formFwMax" placeholder="Max">
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'location') {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>ID (Mã vùng - không dấu)</label>
                    <input type="text" id="formLocId" placeholder="hcm, hanoi..." ${editingId ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>Tên hiển thị</label>
                    <input type="text" id="formLocName" placeholder="TP. Hồ Chí Minh">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Tier (1-4)</label>
                    <input type="number" id="formLocTier" min="1" max="5">
                </div>
                <div class="form-group">
                    <label>Default IR (%)</label>
                    <input type="number" id="formLocDefaultIR">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>IR Min (%)</label>
                    <input type="number" id="formLocIrMin">
                </div>
                <div class="form-group">
                    <label>IR Max (%)</label>
                    <input type="number" id="formLocIrMax">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Samples / Day</label>
                    <input type="number" id="formLocSamplesPerDay">
                </div>
                 <div class="form-group">
                    <label>Ghi chú</label>
                    <input type="text" id="formLocNotes">
                </div>
            </div>
        `;
    }

    if (type === 'template') {
        return '<p>Template edit form coming soon...</p>';
    }

    return '<p>Form not implemented yet.</p>';
}

async function onModalSave() {
    if (editingType === 'case') {
        const data = {
            order: parseInt(document.getElementById('formOrder').value),
            name: document.getElementById('formName').value,
            difficulty: document.getElementById('formDifficulty').value,
            conditions: {
                ir: {
                    min: parseInt(document.getElementById('formIrMin').value),
                    max: parseInt(document.getElementById('formIrMax').value)
                },
                sample: {
                    min: parseInt(document.getElementById('formSampleMin').value),
                    max: parseInt(document.getElementById('formSampleMax').value)
                },
                loi: {
                    min: parseInt(document.getElementById('formLoiMin').value),
                    max: parseInt(document.getElementById('formLoiMax').value)
                },
                quota: document.getElementById('formQuota').value,
                hardTarget: document.getElementById('formHardTarget').value === 'true'
            },
            samplesPerDay: parseInt(document.getElementById('formSamplesPerDay').value),
            fwDaysMin: parseInt(document.getElementById('formFwMin').value),
            fwDaysMax: parseInt(document.getElementById('formFwMax').value),
            suggestions: []
        };

        try {
            if (editingId) {
                await updateCase(editingId, data);
            } else {
                await addCase(data);
            }
            closeModal();
            await loadCases();
            alert('Đã lưu thành công!');
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    } else if (editingType === 'location') {
        const id = document.getElementById('formLocId').value;
        const data = {
            name: document.getElementById('formLocName').value,
            tier: parseInt(document.getElementById('formLocTier').value),
            defaultIR: parseInt(document.getElementById('formLocDefaultIR').value),
            irRange: {
                min: parseInt(document.getElementById('formLocIrMin').value),
                max: parseInt(document.getElementById('formLocIrMax').value)
            },
            samplesPerDay: parseInt(document.getElementById('formLocSamplesPerDay').value),
            notes: document.getElementById('formLocNotes').value
        };

        try {
            if (editingId) {
                await updateLocation(editingId, data);
            } else {
                if (!id) throw new Error('Vui lòng nhập ID');
                await addLocation(id, data);
            }
            closeModal();
            await loadLocations();
            alert('Đã lưu location thành công!');
        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    }
}

// ============ SEED FUNCTIONS ============
async function onSeedCases() {
    if (!confirm('Tạo 12 cases mặc định? Các cases cùng ID sẽ bị ghi đè.')) return;

    try {
        const count = await seedDefaultCases();
        alert(`Đã tạo ${count} cases thành công!`);
        await loadCases();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function onSeedLocations() {
    if (!confirm('Tạo locations mặc định?')) return;

    try {
        const count = await seedDefaultLocations();
        alert(`Đã tạo ${count} locations thành công!`);
        await loadLocations();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function onSeedTemplates() {
    if (!confirm('Tạo templates mặc định?')) return;

    try {
        const count = await seedDefaultTemplates();
        alert(`Đã tạo ${count} templates thành công!`);
        await loadTemplates();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function onClearHistory() {
    if (!confirm('XÓA TẤT CẢ lịch sử? Hành động này không thể hoàn tác!')) return;

    try {
        await clearAllHistory();
        alert('Đã xóa tất cả lịch sử!');
        await loadHistory();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ============ GLOBAL FUNCTIONS (for inline onclick) ============
window.editCase = async (id) => {
    openModal('case', id);
    // TODO: Pre-fill form with existing data
};

window.deleteCase = async (id) => {
    if (!confirm('Xóa case này?')) return;
    try {
        await deleteCase(id);
        await loadCases();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
};

window.editLocation = async (id) => {
    openModal('location', id);
};

window.deleteLocation = async (id) => {
    if (!confirm('Xóa location này?')) return;
    try {
        await deleteLocation(id);
        await loadLocations();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
};

window.editTemplate = async (id) => {
    openModal('template', id);
};

window.deleteTemplate = async (id) => {
    if (!confirm('Xóa template này?')) return;
    try {
        await deleteTemplate(id);
        await loadTemplates();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
};

window.deleteHistory = async (id) => {
    if (!confirm('Xóa bản ghi này?')) return;
    try {
        await deleteHistoryItem(id);
        await loadHistory();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
};

// ============ PHASE 2: VENDORS ============
async function loadVendors() {
    if (!elements.vendorsTableBody) return;

    elements.vendorsTableBody.innerHTML = '<tr><td colspan="7">Đang tải...</td></tr>';

    const vendors = await loadPanelVendors();

    if (vendors.length === 0) {
        elements.vendorsTableBody.innerHTML = '<tr><td colspan="7">Chưa có vendors. Nhấn "Tạo 6 Vendors mặc định" bên dưới.</td></tr>';
        return;
    }

    elements.vendorsTableBody.innerHTML = vendors.map(v => `
        <tr>
            <td>${v.order || 0}</td>
            <td><strong>${v.name}</strong></td>
            <td><span class="badge ${v.isInternal ? 'internal' : 'external'}">${v.isInternal ? 'Nội bộ' : 'Vendor'}</span></td>
            <td><strong>×${v.responseFactor?.toFixed(2)}</strong></td>
            <td>${Math.round((v.defaultQcReject || 0) * 100)}%</td>
            <td>${v.description || '-'}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editVendor('${v.id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteVendorItem('${v.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function onSeedVendors() {
    if (!confirm('Tạo 6 vendors mặc định (IFM, Purespectrum, Opinionmind, Paneland, Infosec, Fulcrum)?')) return;

    try {
        const count = await seedDefaultVendors();
        alert(`Đã tạo ${count} vendors thành công!`);
        await loadVendors();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

window.editVendor = async (id) => {
    openModal('vendor', id);
};

window.deleteVendorItem = async (id) => {
    if (!confirm('Xóa vendor này?')) return;
    try {
        await deleteVendor(id);
        await loadVendors();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
};

// ============ PHASE 2: QUOTA SKEW CONFIG ============
async function loadQuotaSkewSettings() {
    try {
        const config = await loadQuotaSkewConfig();
        if (config && Array.isArray(config)) {
            const balanced = config.find(c => c.id === 'balanced');
            const light = config.find(c => c.id === 'light_skew');
            const heavy = config.find(c => c.id === 'heavy_skew');

            if (elements.skewBalanced && balanced) elements.skewBalanced.value = balanced.multiplier;
            if (elements.skewLight && light) elements.skewLight.value = light.multiplier;
            if (elements.skewHeavy && heavy) elements.skewHeavy.value = heavy.multiplier;
        }
    } catch (error) {
        console.error('Error loading quota skew settings:', error);
    }
}

async function onSaveQuotaSkew() {
    try {
        const options = [
            {
                id: 'balanced',
                name: 'Balanced',
                description: 'Phân bổ đều (50/50), Age trải đều',
                multiplier: parseFloat(elements.skewBalanced?.value) || 1.0,
                order: 1
            },
            {
                id: 'light_skew',
                name: 'Skew nhẹ',
                description: '70/30 hoặc chênh lệch nhẹ',
                multiplier: parseFloat(elements.skewLight?.value) || 1.15,
                order: 2
            },
            {
                id: 'heavy_skew',
                name: 'Skew nặng',
                description: 'Target rất hẹp, khó fill',
                multiplier: parseFloat(elements.skewHeavy?.value) || 1.4,
                order: 3
            }
        ];

        await saveQuotaSkewConfig(options);
        alert('Đã lưu cấu hình Quota Skew thành công!');
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ============ PHASE 2: TIMING CONFIG ============
async function loadTimingSettings() {
    try {
        const config = await loadTimingConfig();
        if (!config) return;

        // Day factors
        if (config.dayFactors) {
            if (elements.daySun) elements.daySun.value = config.dayFactors[0] || 1.1;
            if (elements.dayMon) elements.dayMon.value = config.dayFactors[1] || 0.85;
            if (elements.dayTue) elements.dayTue.value = config.dayFactors[2] || 0.85;
            if (elements.dayWed) elements.dayWed.value = config.dayFactors[3] || 1.0;
            if (elements.dayThu) elements.dayThu.value = config.dayFactors[4] || 1.0;
            if (elements.dayFri) elements.dayFri.value = config.dayFactors[5] || 0.95;
            if (elements.daySat) elements.daySat.value = config.dayFactors[6] || 1.1;
        }

        // Holiday factors
        if (config.holidayFactors) {
            if (elements.holidayTet) elements.holidayTet.value = config.holidayFactors.tet || 1.8;
            if (elements.holiday30Apr) elements.holiday30Apr.value = config.holidayFactors.apr30 || 1.25;
            if (elements.holidayHungVuong) elements.holidayHungVuong.value = config.holidayFactors.hungVuong || 1.1;
            if (elements.holidayNational) elements.holidayNational.value = config.holidayFactors.national || 1.15;
            if (elements.holidayChristmas) elements.holidayChristmas.value = config.holidayFactors.christmas || 1.1;
        }
    } catch (error) {
        console.error('Error loading timing settings:', error);
    }
}

async function onSaveTimingConfig() {
    try {
        const config = {
            dayFactors: {
                0: parseFloat(elements.daySun?.value) || 1.1,
                1: parseFloat(elements.dayMon?.value) || 0.85,
                2: parseFloat(elements.dayTue?.value) || 0.85,
                3: parseFloat(elements.dayWed?.value) || 1.0,
                4: parseFloat(elements.dayThu?.value) || 1.0,
                5: parseFloat(elements.dayFri?.value) || 0.95,
                6: parseFloat(elements.daySat?.value) || 1.1
            },
            holidayFactors: {
                tet: parseFloat(elements.holidayTet?.value) || 1.8,
                apr30: parseFloat(elements.holiday30Apr?.value) || 1.25,
                hungVuong: parseFloat(elements.holidayHungVuong?.value) || 1.1,
                national: parseFloat(elements.holidayNational?.value) || 1.15,
                christmas: parseFloat(elements.holidayChristmas?.value) || 1.1
            }
        };

        await saveTimingConfig(config);
        alert('Đã lưu cấu hình Timing thành công!');
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ============ START ============
init();
