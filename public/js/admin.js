/**
 * Admin Page Controller
 */

import { auth, googleProvider, APP_CONFIG } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getAllCases, addCase, updateCase, deleteCase, seedDefaultCases,
    getAllLocations, addLocation, updateLocation, deleteLocation, seedDefaultLocations,
    getAllTemplates, addTemplate, updateTemplate, deleteTemplate, seedDefaultTemplates, saveTemplate,
    getAllHistory, deleteHistoryItem, clearAllHistory
} from './adminService.js';
// Phase 2: Import vendor and config services
import { loadPanelVendors, saveVendor, deleteVendor, seedDefaultVendors, getDefaultVendors } from './panelVendorService.js';
import { saveQuotaSkewConfig, loadQuotaSkewConfig } from './quotaSkewService.js';
import { saveTimingConfig, loadTimingConfig } from './timingService.js';
// Phase 3: Target Audience
import { loadTargetAudiences, saveAudience, deleteAudience, seedDefaultAudiences, getDefaultAudiences } from './targetAudienceService.js';
// Phase 4: User Management
import { getAllUsers, approveUser as approveUserFn, removeUser as removeUserFn, OWNER_EMAIL } from './authService.js';

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
    holidayChristmas: document.getElementById('holidayChristmas'),
    // Phase 3: Target Audience
    audiencesTableBody: document.getElementById('audiencesTableBody'),
    addAudienceBtn: document.getElementById('addAudienceBtn'),
    seedAudiencesBtn: document.getElementById('seedAudiencesBtn')
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

    // Phase 3: Target Audience buttons
    if (elements.addAudienceBtn) elements.addAudienceBtn.addEventListener('click', () => openModal('audience', null));
    if (elements.seedAudiencesBtn) elements.seedAudiencesBtn.addEventListener('click', onSeedAudiences);
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
        loadAudiences(),
        loadQuotaSkewSettings(),
        loadTimingSettings(),
        loadUsers()
    ]);
}

async function loadCases() {
    elements.casesTableBody.innerHTML = '<tr><td colspan="11">Đang tải...</td></tr>';

    const cases = await getAllCases();

    if (cases.length === 0) {
        elements.casesTableBody.innerHTML = '<tr><td colspan="11">Chưa có cases. Nhấn "Tạo 18 Cases mặc định" bên dưới.</td></tr>';
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
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>ID (không dấu)</label>
                    <input type="text" id="formTemplateId" placeholder="brand_health" ${editingId ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>Order</label>
                    <input type="number" id="formTemplateOrder" value="1" min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Icon (emoji)</label>
                    <input type="text" id="formTemplateIcon" placeholder="📊" maxlength="4">
                </div>
                <div class="form-group">
                    <label>Tên Template</label>
                    <input type="text" id="formTemplateName" placeholder="Brand Health Check">
                </div>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <input type="text" id="formTemplateDesc" placeholder="Đo lường sức khỏe thương hiệu">
            </div>
            <hr style="margin: 16px 0; border-color: #e0e0e0;">
            <h4 style="margin-bottom: 12px;">📋 Giá trị mặc định</h4>
            <div class="form-row">
                <div class="form-group">
                    <label>Sample Size</label>
                    <input type="number" id="formTemplateSample" placeholder="300">
                </div>
                <div class="form-group">
                    <label>IR (%)</label>
                    <input type="number" id="formTemplateIR" placeholder="30" min="1" max="100">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>LOI (phút)</label>
                    <input type="number" id="formTemplateLOI" placeholder="15">
                </div>
                <div class="form-group">
                    <label>Quota</label>
                    <select id="formTemplateQuota">
                        <option value="simple">Simple</option>
                        <option value="nested">Nested</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hard Target</label>
                    <select id="formTemplateHardTarget">
                        <option value="false">Thường</option>
                        <option value="true">Khó</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Location mặc định</label>
                    <select id="formTemplateLocation">
                        <option value="hcm">TP. Hồ Chí Minh</option>
                        <option value="hanoi">Hà Nội</option>
                        <option value="danang">Đà Nẵng</option>
                        <option value="nationwide">Toàn quốc</option>
                        <option value="urban_t2">Urban Tier 2</option>
                        <option value="rural">Rural</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>🎯 Target Audience</label>
                <select id="formTemplateAudience">
                    <option value="general">General Population</option>
                    <option value="youth">Youth (15-24)</option>
                    <option value="senior">Senior (55+)</option>
                    <option value="high_income">High Income</option>
                    <option value="b2b">B2B Decision Makers</option>
                    <option value="healthcare">Healthcare Professionals</option>
                </select>
                <small style="color: #666;">Ảnh hưởng đến IR Factor và độ khó estimate</small>
            </div>
        `;
    }

    if (type === 'vendor') {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>ID (không dấu)</label>
                    <input type="text" id="formVendorId" placeholder="purespectrum" ${editingId ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>Order</label>
                    <input type="number" id="formVendorOrder" value="1" min="1">
                </div>
            </div>
            <div class="form-group">
                <label>Tên Vendor</label>
                <input type="text" id="formVendorName" placeholder="Purespectrum">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Response Factor (×)</label>
                    <input type="number" id="formVendorResponseFactor" step="0.1" min="0.1" max="3" value="1.0" placeholder="1.0">
                    <small style="color: #666;">Cao hơn = nhanh hơn</small>
                </div>
                <div class="form-group">
                    <label>QC Reject Default (%)</label>
                    <input type="number" id="formVendorQcReject" step="1" min="0" max="100" value="10" placeholder="10">
                </div>
            </div>
            <div class="form-group">
                <label>Loại</label>
                <select id="formVendorIsInternal">
                    <option value="false">Vendor (bên ngoài)</option>
                    <option value="true">Nội bộ (Internal)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <input type="text" id="formVendorDesc" placeholder="Mô tả ngắn về vendor">
            </div>
            <div class="form-group">
                <label>Ưu điểm (cách nhau bằng dấu phẩy)</label>
                <input type="text" id="formVendorPros" placeholder="Response cao, Setup nhanh">
            </div>
            <div class="form-group">
                <label>Nhược điểm (cách nhau bằng dấu phẩy)</label>
                <input type="text" id="formVendorCons" placeholder="Giá cao, QC loại nhiều">
            </div>
        `;
    }

    if (type === 'audience') {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>ID (không dấu)</label>
                    <input type="text" id="formAudienceId" placeholder="b2b, healthcare..." ${editingId ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label>Order</label>
                    <input type="number" id="formAudienceOrder" value="1" min="1">
                </div>
            </div>
            <div class="form-group">
                <label>Tên Audience</label>
                <input type="text" id="formAudienceName" placeholder="B2B Decision Makers">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>IR Factor (×)</label>
                    <input type="number" id="formAudienceIrFactor" step="0.05" min="0.05" max="1" value="1.0">
                    <small style="color: #666;">Thấp hơn = khó reach hơn (0.05 - 1.0)</small>
                </div>
                <div class="form-group">
                    <label>Difficulty Multiplier (×)</label>
                    <input type="number" id="formAudienceDifficulty" step="0.1" min="1" max="3" value="1.0">
                    <small style="color: #666;">Cao hơn = cần nhiều ngày hơn (1.0 - 3.0)</small>
                </div>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <input type="text" id="formAudienceDesc" placeholder="Lãnh đạo doanh nghiệp, người ra quyết định">
            </div>
            <div class="form-group">
                <label>Ghi chú</label>
                <input type="text" id="formAudienceNotes" placeholder="IR rất thấp, cần panel chuyên biệt">
            </div>
        `;
    }

    return '<p>Form not implemented yet.</p>';
}

async function onModalSave() {
    const saveBtn = elements.modalSave;
    const originalText = saveBtn.textContent;

    // Show loading state
    saveBtn.textContent = '⏳ Đang lưu...';
    saveBtn.disabled = true;

    try {
        if (editingType === 'case') {
            // Validation
            const name = document.getElementById('formName').value.trim();
            const difficulty = document.getElementById('formDifficulty').value.trim();
            const irMin = parseInt(document.getElementById('formIrMin').value);
            const irMax = parseInt(document.getElementById('formIrMax').value);

            if (!name) {
                throw new Error('Vui lòng nhập tên case');
            }
            if (!difficulty) {
                throw new Error('Vui lòng nhập độ khó');
            }
            if (irMin > irMax) {
                throw new Error('IR Min không thể lớn hơn IR Max');
            }

            const data = {
                order: parseInt(document.getElementById('formOrder').value) || 1,
                name: name,
                difficulty: difficulty,
                conditions: {
                    ir: {
                        min: irMin || 0,
                        max: irMax || 100
                    },
                    sample: {
                        min: parseInt(document.getElementById('formSampleMin').value) || 0,
                        max: parseInt(document.getElementById('formSampleMax').value) || 9999
                    },
                    loi: {
                        min: parseInt(document.getElementById('formLoiMin').value) || 0,
                        max: parseInt(document.getElementById('formLoiMax').value) || 60
                    },
                    quota: document.getElementById('formQuota').value,
                    hardTarget: document.getElementById('formHardTarget').value === 'true'
                },
                samplesPerDay: parseInt(document.getElementById('formSamplesPerDay').value) || 20,
                fwDaysMin: parseInt(document.getElementById('formFwMin').value) || 5,
                fwDaysMax: parseInt(document.getElementById('formFwMax').value) || 10,
                suggestions: []
            };

            if (editingId) {
                await updateCase(editingId, data);
            } else {
                await addCase(data);
            }
            closeModal();
            await loadCases();
            alert('Đã lưu thành công!');
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
        } else if (editingType === 'vendor') {
            const id = editingId || document.getElementById('formVendorId').value;
            const data = {
                id: id,
                name: document.getElementById('formVendorName').value,
                order: parseInt(document.getElementById('formVendorOrder').value) || 1,
                responseFactor: parseFloat(document.getElementById('formVendorResponseFactor').value) || 1.0,
                defaultQcReject: (parseFloat(document.getElementById('formVendorQcReject').value) || 10) / 100,
                isInternal: document.getElementById('formVendorIsInternal').value === 'true',
                description: document.getElementById('formVendorDesc').value,
                pros: document.getElementById('formVendorPros').value.split(',').map(s => s.trim()).filter(s => s),
                cons: document.getElementById('formVendorCons').value.split(',').map(s => s.trim()).filter(s => s)
            };

            try {
                if (!id) throw new Error('Vui lòng nhập ID');
                await saveVendor(data);
                closeModal();
                await loadVendors();
                alert('Đã lưu vendor thành công!');
            } catch (error) {
                alert('Lỗi: ' + error.message);
            }
        } else if (editingType === 'template') {
            const id = editingId || document.getElementById('formTemplateId').value;
            const data = {
                id: id,
                name: document.getElementById('formTemplateName').value,
                order: parseInt(document.getElementById('formTemplateOrder').value) || 1,
                icon: document.getElementById('formTemplateIcon').value || '📋',
                description: document.getElementById('formTemplateDesc').value,
                defaults: {
                    sampleSize: parseInt(document.getElementById('formTemplateSample').value) || 300,
                    ir: parseInt(document.getElementById('formTemplateIR').value) || 30,
                    loi: parseInt(document.getElementById('formTemplateLOI').value) || 15,
                    quota: document.getElementById('formTemplateQuota').value,
                    hardTarget: document.getElementById('formTemplateHardTarget').value === 'true',
                    location: document.getElementById('formTemplateLocation').value || 'hcm',
                    targetAudience: document.getElementById('formTemplateAudience').value || 'general'
                }
            };

            try {
                if (!id) throw new Error('Vui lòng nhập ID');
                await saveTemplate(data);
                closeModal();
                await loadTemplates();
                alert('Đã lưu template thành công!');
            } catch (error) {
                alert('Lỗi: ' + error.message);
            }
        } else if (editingType === 'audience') {
            const id = editingId || document.getElementById('formAudienceId').value.trim();
            const name = document.getElementById('formAudienceName').value.trim();

            if (!id) throw new Error('Vui lòng nhập ID');
            if (!name) throw new Error('Vui lòng nhập tên audience');

            const data = {
                id: id,
                name: name,
                order: parseInt(document.getElementById('formAudienceOrder').value) || 1,
                irFactor: parseFloat(document.getElementById('formAudienceIrFactor').value) || 1.0,
                difficultyMultiplier: parseFloat(document.getElementById('formAudienceDifficulty').value) || 1.0,
                description: document.getElementById('formAudienceDesc').value || '',
                notes: document.getElementById('formAudienceNotes').value || ''
            };

            await saveAudience(data);
            closeModal();
            await loadAudiences();
            alert('Đã lưu audience thành công!');
        }
    } catch (error) {
        alert('Lỗi: ' + error.message);
    } finally {
        // Restore save button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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
    // Pre-fill form with existing data
    const cases = await getAllCases();
    const caseData = cases.find(c => c.id === id);
    if (caseData) {
        setTimeout(() => {
            const orderField = document.getElementById('formOrder');
            if (orderField) orderField.value = caseData.order || 1;
            const nameField = document.getElementById('formName');
            if (nameField) nameField.value = caseData.name || '';
            const diffField = document.getElementById('formDifficulty');
            if (diffField) diffField.value = caseData.difficulty || '';
            const irMinField = document.getElementById('formIrMin');
            if (irMinField) irMinField.value = caseData.conditions?.ir?.min || '';
            const irMaxField = document.getElementById('formIrMax');
            if (irMaxField) irMaxField.value = caseData.conditions?.ir?.max || '';
            const sampleMinField = document.getElementById('formSampleMin');
            if (sampleMinField) sampleMinField.value = caseData.conditions?.sample?.min || '';
            const sampleMaxField = document.getElementById('formSampleMax');
            if (sampleMaxField) sampleMaxField.value = caseData.conditions?.sample?.max || '';
            const loiMinField = document.getElementById('formLoiMin');
            if (loiMinField) loiMinField.value = caseData.conditions?.loi?.min || '';
            const loiMaxField = document.getElementById('formLoiMax');
            if (loiMaxField) loiMaxField.value = caseData.conditions?.loi?.max || '';
            const quotaField = document.getElementById('formQuota');
            if (quotaField) quotaField.value = caseData.conditions?.quota || 'simple';
            const hardTargetField = document.getElementById('formHardTarget');
            if (hardTargetField) hardTargetField.value = caseData.conditions?.hardTarget ? 'true' : 'false';
            const spdField = document.getElementById('formSamplesPerDay');
            if (spdField) spdField.value = caseData.samplesPerDay || '';
            const fwMinField = document.getElementById('formFwMin');
            if (fwMinField) fwMinField.value = caseData.fwDaysMin || '';
            const fwMaxField = document.getElementById('formFwMax');
            if (fwMaxField) fwMaxField.value = caseData.fwDaysMax || '';
        }, 50);
    }
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
    // Pre-fill form with existing data
    const locations = await getAllLocations();
    const location = locations.find(l => l.id === id);
    if (location) {
        setTimeout(() => {
            const idField = document.getElementById('formLocId');
            if (idField) idField.value = location.id || '';
            const nameField = document.getElementById('formLocName');
            if (nameField) nameField.value = location.name || '';
            const tierField = document.getElementById('formLocTier');
            if (tierField) tierField.value = location.tier || 1;
            const irField = document.getElementById('formLocDefaultIR');
            if (irField) irField.value = location.defaultIR || 30;
            const irMinField = document.getElementById('formLocIrMin');
            if (irMinField) irMinField.value = location.irRange?.min || '';
            const irMaxField = document.getElementById('formLocIrMax');
            if (irMaxField) irMaxField.value = location.irRange?.max || '';
            const spdField = document.getElementById('formLocSamplesPerDay');
            if (spdField) spdField.value = location.samplesPerDay || '';
            const notesField = document.getElementById('formLocNotes');
            if (notesField) notesField.value = location.notes || '';
        }, 50);
    }
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
    // Pre-fill form with existing data
    const templates = await getAllTemplates();
    const template = templates.find(t => t.id === id);
    if (template) {
        setTimeout(() => {
            const idField = document.getElementById('formTemplateId');
            if (idField) idField.value = template.id;
            const nameField = document.getElementById('formTemplateName');
            if (nameField) nameField.value = template.name || '';
            const orderField = document.getElementById('formTemplateOrder');
            if (orderField) orderField.value = template.order || 1;
            const iconField = document.getElementById('formTemplateIcon');
            if (iconField) iconField.value = template.icon || '📋';
            const descField = document.getElementById('formTemplateDesc');
            if (descField) descField.value = template.description || '';
            const sampleField = document.getElementById('formTemplateSample');
            if (sampleField) sampleField.value = template.defaults?.sampleSize || 300;
            const irField = document.getElementById('formTemplateIR');
            if (irField) irField.value = template.defaults?.ir || 30;
            const loiField = document.getElementById('formTemplateLOI');
            if (loiField) loiField.value = template.defaults?.loi || 15;
            const quotaField = document.getElementById('formTemplateQuota');
            if (quotaField) quotaField.value = template.defaults?.quota || 'simple';
            const hardTargetField = document.getElementById('formTemplateHardTarget');
            if (hardTargetField) hardTargetField.value = template.defaults?.hardTarget ? 'true' : 'false';
            const locationField = document.getElementById('formTemplateLocation');
            if (locationField) locationField.value = template.defaults?.location || 'hcm';
            const audienceField = document.getElementById('formTemplateAudience');
            if (audienceField) audienceField.value = template.defaults?.targetAudience || 'general';
        }, 50);
    }
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
    // Pre-fill form with existing data
    const vendors = await loadPanelVendors();
    const vendor = vendors.find(v => v.id === id);
    if (vendor) {
        setTimeout(() => {
            const idField = document.getElementById('formVendorId');
            if (idField) idField.value = vendor.id;
            const nameField = document.getElementById('formVendorName');
            if (nameField) nameField.value = vendor.name || '';
            const orderField = document.getElementById('formVendorOrder');
            if (orderField) orderField.value = vendor.order || 1;
            const rfField = document.getElementById('formVendorResponseFactor');
            if (rfField) rfField.value = vendor.responseFactor || 1.0;
            const qcField = document.getElementById('formVendorQcReject');
            if (qcField) qcField.value = Math.round((vendor.defaultQcReject || 0.1) * 100);
            const internalField = document.getElementById('formVendorIsInternal');
            if (internalField) internalField.value = vendor.isInternal ? 'true' : 'false';
            const descField = document.getElementById('formVendorDesc');
            if (descField) descField.value = vendor.description || '';
            const prosField = document.getElementById('formVendorPros');
            if (prosField) prosField.value = (vendor.pros || []).join(', ');
            const consField = document.getElementById('formVendorCons');
            if (consField) consField.value = (vendor.cons || []).join(', ');
        }, 50);
    }
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

// ============ PHASE 3: TARGET AUDIENCE ============
async function loadAudiences() {
    if (!elements.audiencesTableBody) return;

    elements.audiencesTableBody.innerHTML = '<tr><td colspan="6">Đang tải...</td></tr>';

    const audiences = await loadTargetAudiences();

    if (audiences.length === 0) {
        elements.audiencesTableBody.innerHTML = '<tr><td colspan="6">Chưa có audiences. Nhấn "Tạo 6 Audiences mặc định" bên dưới.</td></tr>';
        return;
    }

    elements.audiencesTableBody.innerHTML = audiences.map(a => `
        <tr>
            <td>${a.order || 0}</td>
            <td><strong>${a.name}</strong></td>
            <td><strong>×${a.irFactor?.toFixed(2)}</strong></td>
            <td><span class="badge ${a.difficultyMultiplier > 1.5 ? 'hard' : a.difficultyMultiplier > 1 ? 'medium' : 'easy'}">×${a.difficultyMultiplier?.toFixed(1)}</span></td>
            <td>${a.description || '-'}</td>
            <td class="actions">
                <button class="btn-edit" onclick="editAudience('${a.id}')">Sửa</button>
                <button class="btn-delete" onclick="deleteAudienceItem('${a.id}')">Xóa</button>
            </td>
        </tr>
    `).join('');
}

async function onSeedAudiences() {
    if (!confirm('Tạo 6 audiences mặc định (General, Youth, Senior, High Income, B2B, Healthcare)?')) return;

    try {
        const count = await seedDefaultAudiences();
        alert(`Đã tạo ${count} audiences thành công!`);
        await loadAudiences();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

window.editAudience = async (id) => {
    openModal('audience', id);
    // Pre-fill form with existing data
    const audiences = await loadTargetAudiences();
    const audience = audiences.find(a => a.id === id);
    if (audience) {
        setTimeout(() => {
            const idField = document.getElementById('formAudienceId');
            if (idField) idField.value = audience.id;
            const nameField = document.getElementById('formAudienceName');
            if (nameField) nameField.value = audience.name || '';
            const orderField = document.getElementById('formAudienceOrder');
            if (orderField) orderField.value = audience.order || 1;
            const irField = document.getElementById('formAudienceIrFactor');
            if (irField) irField.value = audience.irFactor || 1.0;
            const diffField = document.getElementById('formAudienceDifficulty');
            if (diffField) diffField.value = audience.difficultyMultiplier || 1.0;
            const descField = document.getElementById('formAudienceDesc');
            if (descField) descField.value = audience.description || '';
            const notesField = document.getElementById('formAudienceNotes');
            if (notesField) notesField.value = audience.notes || '';
        }, 50);
    }
};

window.deleteAudienceItem = async (id) => {
    if (!confirm('Xóa audience này?')) return;
    try {
        await deleteAudience(id);
        await loadAudiences();
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

// ============ USER MANAGEMENT ============
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7">Đang tải...</td></tr>';

    try {
        const users = await getAllUsers();
        renderUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="7">Lỗi tải danh sách users</td></tr>';
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Chưa có user nào</td></tr>';
        return;
    }

    // Sort: pending first, then by date
    users.sort((a, b) => {
        if (a.approved !== b.approved) return a.approved ? 1 : -1;
        return (b.requestedAt?.toDate() || 0) - (a.requestedAt?.toDate() || 0);
    });

    tbody.innerHTML = users.map(user => {
        const requestDate = user.requestedAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'N/A';
        const isOwner = user.email === OWNER_EMAIL;
        const status = user.approved
            ? '<span style="color: #10b981; font-weight: 600;">✅ Đã duyệt</span>'
            : '<span style="color: #f59e0b; font-weight: 600;">⏳ Chờ duyệt</span>';

        const actions = isOwner
            ? '<span style="color: #6b7280; font-style: italic;">Owner</span>'
            : user.approved
                ? `<button class="action-btn danger" onclick="rejectUserAction('${user.email}')">❌ Xoá</button>`
                : `<button class="action-btn success" onclick="approveUserAction('${user.email}')">✅ Duyệt</button>
                   <button class="action-btn danger" onclick="rejectUserAction('${user.email}')">❌ Từ chối</button>`;

        return `
            <tr>
                <td><img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="Avatar" style="width:40px;height:40px;border-radius:50%"></td>
                <td>${user.email}</td>
                <td>${user.displayName || 'N/A'}</td>
                <td>${user.role || 'user'}</td>
                <td>${status}</td>
                <td>${requestDate}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

window.approveUserAction = async function (email) {
    if (!confirm(`Duyệt truy cập cho ${email}?`)) return;

    try {
        const result = await approveUserFn(email);
        if (result.success) {
            alert('Đã duyệt user thành công!');
            loadUsers();
        } else {
            alert('Lỗi: ' + result.error);
        }
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

window.rejectUserAction = async function (email) {
    if (!confirm(`Xoá/Từ chối truy cập của ${email}?`)) return;

    try {
        const result = await removeUserFn(email);
        if (result.success) {
            alert('Đã xoá user!');
            loadUsers();
        } else {
            alert('Lỗi: ' + result.error);
        }
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// Setup refresh users button
document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);

// ============ START ============
init();

