/**
 * Sample Size Calculator - Main Application
 * Version 3.0
 */

// Import services
import { loadCases, determineCase, calculateQuickModeRange, getDefaultCases, calculateSampleSizeFactor } from './js/caseLogic.js';
import { calculateFWDays, compareExpertVsSystem, estimateCPI, generateSuggestions } from './js/calculator.js';
import { loadLocations, getIRSuggestion, getDefaultLocations, calculateLocationFactor } from './js/locationService.js';
import { loadTemplates, getDefaultTemplates } from './js/templateService.js';
import { saveCalculation, getRecentHistory } from './js/historyService.js';
// Phase 1: Multi-factor imports
import { loadPanelVendors, getDefaultVendors, calculateVendorFactor } from './js/panelVendorService.js';
import { getQuickTimingCheck, calculateTimingFactor } from './js/timingService.js';
import { loadQuotaSkewConfig, getQuotaSkewMultiplier, getDefaultQuotaSkew } from './js/quotaSkewService.js';
// Phase 2: Target Audience
import { loadTargetAudiences, getAudience, calculateAudienceImpact } from './js/targetAudienceService.js';
// Phase 3: Auth
import { logOut, onAuthChange } from './js/authService.js';
// Phase 4: Admin actions
import { deleteCalculation } from './js/adminService.js';

// ============ UTILS ============
function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

// ============ STATE ============
let currentMode = 'quick'; // 'quick' or 'detailed'
let currentResult = null;
let systemEstimate = { min: 0, max: 0 };
let currentLocationStats = null; // { defaultIR, range, samplesPerDay, travelBuffer }
let currentTargetAudience = 'general'; // Target Audience ID from template

// ============ DOM ELEMENTS ============
const elements = {
    // Mode
    modeButtons: document.querySelectorAll('.mode-btn'),
    modeDescription: document.getElementById('modeDescription'),
    detailedFields: document.getElementById('detailedFields'),
    quickResults: document.getElementById('quickResults'),
    detailedResults: document.getElementById('detailedResults'),

    // Template & Location
    templateSelect: document.getElementById('templateSelect'),
    // Audience Selector
    audienceSelect: document.getElementById('audienceSelect'),
    audienceHint: document.getElementById('audienceHint'),
    // Audience Indicator (for template-derived audience)
    audienceIndicator: document.getElementById('audienceIndicator'),
    audienceNameDisplay: document.getElementById('audienceNameDisplay'),
    audienceBadge: document.getElementById('audienceBadge'),
    audienceFactorDisplay: document.getElementById('audienceFactorDisplay'),
    // Location Multi-Select
    locationMultiSelect: document.getElementById('locationMultiSelect'),
    locationSelectBox: document.getElementById('locationSelectBox'),
    locationSelectedText: document.getElementById('locationSelectedText'),
    locationDropdownPanel: document.getElementById('locationDropdownPanel'),

    // Results
    irSuggestion: document.getElementById('irSuggestion'),
    sampleSize: document.getElementById('sampleSize'),
    projectName: document.getElementById('projectName'), // Added missing reference
    loi: document.getElementById('loi'),
    irInput: document.getElementById('irInput'),
    irValue: document.getElementById('irValue'),
    quotaRadios: document.getElementsByName('quota'),
    targetRadios: document.getElementsByName('target'),

    // Quick Mode Results
    bestDays: document.getElementById('bestDays'),
    bestDesc: document.getElementById('bestDesc'),
    likelyDays: document.getElementById('likelyDays'),
    likelyDesc: document.getElementById('likelyDesc'),
    worstDays: document.getElementById('worstDays'),
    worstDesc: document.getElementById('worstDesc'),

    // Detailed Mode Results
    resDifficulty: document.getElementById('resDifficulty'),
    resCaseName: document.getElementById('resCaseName'),
    resDaily: document.getElementById('resDaily'),
    resDays: document.getElementById('resDays'),
    resultDifficultyBox: document.getElementById('resultDifficultyBox'),
    resCPI: document.getElementById('resCPI'),

    // Suggestions
    suggestionList: document.getElementById('suggestionList'),

    // Expert Conclusion
    expertDays: document.getElementById('expertDays'),
    expertNote: document.getElementById('expertNote'),
    bufferButtons: document.querySelectorAll('.buffer-btn'),
    conclusionWarning: document.getElementById('conclusionWarning'),
    saveBtn: document.getElementById('saveBtn'),
    saveStatus: document.getElementById('saveStatus'),

    // History
    historyList: document.getElementById('historyList'),

    // Phase 1: Multi-factor elements
    // Panel Vendors
    panelMultiSelect: document.getElementById('panelMultiSelect'),
    panelSelectBox: document.getElementById('panelSelectBox'),
    panelSelectedText: document.getElementById('panelSelectedText'),
    panelDropdownPanel: document.getElementById('panelDropdownPanel'),
    // Quota Skew
    quotaSkewRadios: document.getElementsByName('quotaSkew'),
    // QC Buffer
    qcBuffer: document.getElementById('qcBuffer'),
    qcValue: document.getElementById('qcValue'),
    // Timing
    fwStartDate: document.getElementById('fwStartDate'),
    timingWarning: document.getElementById('timingWarning'),
    // Factor Breakdown
    factorIR: document.getElementById('factorIR'),
    factorTraffic: document.getElementById('factorTraffic'),
    factorQuota: document.getElementById('factorQuota'),
    factorQC: document.getElementById('factorQC'),
    factorTiming: document.getElementById('factorTiming'),
    factorSampleSize: document.getElementById('factorSampleSize'),
    factorLocation: document.getElementById('factorLocation'),
    factorAudience: document.getElementById('factorAudience'),
    adjustedDaily: document.getElementById('adjustedDaily'),
    factorBreakdown: document.getElementById('factorBreakdown'),
    // Factor Toggles
    toggleIR: document.getElementById('toggleIR'),
    toggleTraffic: document.getElementById('toggleTraffic'),
    toggleQuota: document.getElementById('toggleQuota'),
    toggleQC: document.getElementById('toggleQC'),
    toggleTiming: document.getElementById('toggleTiming'),
    toggleSampleSize: document.getElementById('toggleSampleSize'),
    toggleLocation: document.getElementById('toggleLocation'),
    toggleAudience: document.getElementById('toggleAudience'),
    // Factor Source labels
    factorIRSource: document.getElementById('factorIRSource'),
    factorTrafficSource: document.getElementById('factorTrafficSource'),
    factorQuotaSource: document.getElementById('factorQuotaSource'),
    factorQCSource: document.getElementById('factorQCSource'),
    factorTimingSource: document.getElementById('factorTimingSource'),
    factorSampleSizeSource: document.getElementById('factorSampleSizeSource'),
    factorLocationSource: document.getElementById('factorLocationSource'),
    factorAudienceSource: document.getElementById('factorAudienceSource')
};

// ============ INITIALIZATION ============
let currentPage = 1;
const projectsPerPage = 10;
let currentProjectId = null;

async function init() {
    console.log('Initializing Sample Size Calculator v3...');

    // Load data (with fallbacks)
    await loadDropdowns();
    await loadProjectList(1);  // Load first page of projects
    await loadHistory();

    // Setup event listeners
    setupEventListeners();

    // Set initial mode (Quick Mode by default)
    switchMode('quick');

    // Initial calculation
    updateCalculation();

    console.log('Initialization complete.');
}

async function loadDropdowns() {
    // Load templates - with guaranteed fallback
    try {
        const templates = await loadTemplates();
        if (templates && templates.length > 0) {
            populateTemplateDropdown(templates);
        } else {
            console.log('No templates from Firebase, using defaults');
            populateTemplateDropdown(getDefaultTemplates());
        }
    } catch (e) {
        console.log('Firebase error, using default templates:', e.message);
        populateTemplateDropdown(getDefaultTemplates());
    }

    // Load locations - using local defaults for proper category grouping
    // Firebase location_defaults may lack category field, so use getDefaultLocations() always
    try {
        const locations = getDefaultLocations();
        populateLocationMultiSelect(locations);
        console.log('Using local location defaults with category grouping');
    } catch (e) {
        console.error('Error loading locations:', e.message);
        populateLocationMultiSelect(getDefaultLocations());
    }

    // Phase 1: Load panel vendors
    try {
        const vendors = await loadPanelVendors();
        if (vendors && vendors.length > 0) {
            populatePanelVendorMultiSelect(vendors);
        } else {
            populatePanelVendorMultiSelect(getDefaultVendors());
        }
    } catch (e) {
        console.log('Firebase error, using default vendors:', e.message);
        populatePanelVendorMultiSelect(getDefaultVendors());
    }

    // Load Target Audiences
    try {
        const audiences = await loadTargetAudiences();
        populateAudienceDropdown(audiences);
    } catch (e) {
        console.log('Firebase error, using default audiences:', e.message);
        const { DEFAULT_AUDIENCES } = await import('./js/targetAudienceService.js');
        populateAudienceDropdown(DEFAULT_AUDIENCES);
    }

    // Set default FW start date to today
    if (elements.fwStartDate) {
        const today = new Date();
        elements.fwStartDate.value = today.toISOString().split('T')[0];
        checkTimingWarning(today);
    }
}

// ============ MODE SWITCHING ============
function switchMode(mode) {
    currentMode = mode;

    // Update buttons
    elements.modeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update description
    if (mode === 'quick') {
        elements.modeDescription.textContent = 'Nhập nhanh với IR tự động suggest theo Location';
        elements.detailedFields.classList.add('hidden');
        elements.quickResults.classList.remove('hidden');
        elements.detailedResults.classList.add('hidden');
    } else {
        elements.modeDescription.textContent = 'Nhập đầy đủ thông tin để có kết quả chính xác nhất';
        elements.detailedFields.classList.remove('hidden');
        elements.quickResults.classList.add('hidden');
        elements.detailedResults.classList.remove('hidden');
    }

    updateCalculation();
}

// ============ EVENT LISTENERS ============
function setupEventListeners() {
    // Mode toggle
    elements.modeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Template selection
    elements.templateSelect.addEventListener('change', onTemplateSelect);

    // Location Multi-Select
    elements.locationSelectBox.addEventListener('click', toggleLocationDropdown);
    document.addEventListener('click', (e) => {
        if (!elements.locationMultiSelect.contains(e.target)) {
            elements.locationDropdownPanel.classList.add('hidden');
        }
    });

    // Form inputs
    elements.sampleSize.addEventListener('input', updateCalculation);
    elements.loi.addEventListener('input', updateCalculation);
    elements.irInput.addEventListener('input', () => {
        elements.irValue.textContent = elements.irInput.value;
        updateCalculation();
    });

    // Radio buttons
    elements.quotaRadios.forEach(r => {
        r.addEventListener('change', (e) => {
            updateRadioCardSelection('quota', e.target.value);
            updateCalculation();
        });
    });

    elements.targetRadios.forEach(r => {
        r.addEventListener('change', (e) => {
            updateRadioCardSelection('target', e.target.value);
            updateCalculation();
        });
    });

    // Expert days input
    elements.expertDays.addEventListener('input', onExpertDaysChange);

    // Buffer buttons
    elements.bufferButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const add = parseInt(btn.dataset.add);
            const current = parseInt(elements.expertDays.value) || Math.round((systemEstimate.min + systemEstimate.max) / 2);
            elements.expertDays.value = current + add;
            onExpertDaysChange();
        });
    });

    // Save button
    elements.saveBtn.addEventListener('click', onSave);

    // New Project button
    const newProjectBtn = document.getElementById('newProjectBtn');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', createNewProject);
    }

    // Phase 1: Panel Vendor Multi-Select
    if (elements.panelSelectBox) {
        elements.panelSelectBox.addEventListener('click', togglePanelDropdown);
        document.addEventListener('click', (e) => {
            if (elements.panelMultiSelect && !elements.panelMultiSelect.contains(e.target)) {
                elements.panelDropdownPanel.classList.add('hidden');
            }
        });
    }

    // Phase 1: Quota Skew Radio buttons
    if (elements.quotaSkewRadios) {
        elements.quotaSkewRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                updateRadioCardSelection('quotaSkew', e.target.value);
                updateCalculation();
            });
        });
    }

    // Phase 1: QC Buffer slider
    if (elements.qcBuffer) {
        elements.qcBuffer.addEventListener('input', () => {
            // Update label text
            if (elements.qcValue) elements.qcValue.textContent = elements.qcBuffer.value;
            updateCalculation();
        });
    }

    // Phase 1: FW Start Date (timing)
    if (elements.fwStartDate) {
        elements.fwStartDate.addEventListener('change', () => {
            const startDate = new Date(elements.fwStartDate.value);
            checkTimingWarning(startDate);
            updateCalculation();
        });
    }

    // Target Audience selector
    if (elements.audienceSelect) {
        elements.audienceSelect.addEventListener('change', () => {
            currentTargetAudience = elements.audienceSelect.value;
            updateAudienceHint();
            updateCalculation();
        });
    }

    // Factor Toggle listeners
    const toggleIds = ['toggleIR', 'toggleTraffic', 'toggleQuota', 'toggleQC', 'toggleTiming', 'toggleSampleSize', 'toggleLocation', 'toggleAudience'];
    toggleIds.forEach(id => {
        const toggle = elements[id];
        if (toggle) {
            toggle.addEventListener('change', () => {
                // Update row visual state
                const row = toggle.closest('.factor-row');
                if (row) {
                    row.classList.toggle('disabled', !toggle.checked);
                }
                updateCalculation();
            });
        }
    });
}

function updateRadioCardSelection(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
        const card = input.closest('.radio-card');
        if (input.value === value) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}


function populateLocationDropdown(locations) {
    // Deprecated - replaced by populateLocationMultiSelect but kept for interface compatibility if needed
    // Ideally we remove calls to this and use the new one below
    populateLocationMultiSelect(locations);
}

// ============ AUDIENCE DROPDOWN ============
function populateAudienceDropdown(audiences) {
    if (!audiences || audiences.length === 0) return;
    if (!elements.audienceSelect) return;

    // Keep the placeholder option
    let html = '<option value="general">-- Chọn đối tượng (General Pop) --</option>';

    audiences.forEach(a => {
        const difficultyBadge = a.difficultyMultiplier > 1.5 ? '🔴' : a.difficultyMultiplier > 1.2 ? '🟡' : '🟢';
        html += `<option value="${a.id}" data-factor="${a.difficultyMultiplier}">${difficultyBadge} ${a.name}</option>`;
    });

    elements.audienceSelect.innerHTML = html;
}

function updateAudienceHint() {
    if (!elements.audienceHint) return;

    const selectedOption = elements.audienceSelect?.selectedOptions[0];
    if (!selectedOption || selectedOption.value === 'general') {
        elements.audienceHint.classList.add('hidden');
        return;
    }

    const factor = selectedOption.dataset.factor || 1.0;
    const factorClass = factor > 1.5 ? 'negative' : factor > 1.2 ? 'warning' : 'positive';
    elements.audienceHint.innerHTML = `<span class="${factorClass}">Difficulty: ×${factor}</span>`;
    elements.audienceHint.classList.remove('hidden');
}

// ============ LOCATION MULTI-SELECT ============
function populateLocationMultiSelect(locations) {
    if (!locations || locations.length === 0) return;

    // Group by Category instead of Tier
    const categories = {
        city: { name: '🏙️ Thành phố (Cities)', items: [], order: 1 },
        cci: { name: '📊 CCI Type', items: [], order: 2 },
        gso: { name: '📈 GSO Type', items: [], order: 3 },
        region: { name: '🗺️ 3-Region (Bắc/Trung/Nam)', items: [], order: 4 }
    };

    locations.forEach(l => {
        const category = l.category || 'city';
        if (categories[category]) {
            categories[category].items.push(l);
        } else {
            categories.city.items.push(l);
        }
    });

    let html = `
        <div class="dropdown-search">
            <input type="text" id="locationSearchInput" placeholder="🔍 Tìm kiếm (vd: ha noi, ho chi minh...)" autocomplete="off">
            <div class="dropdown-search-actions">
                <button type="button" id="selectAllSearchBtn" class="search-action-btn">Chọn tất cả</button>
                <button type="button" id="clearAllSearchBtn" class="search-action-btn">Bỏ chọn</button>
            </div>
        </div>
        <div class="dropdown-content">
    `;

    // Sort by order and render
    Object.entries(categories)
        .sort((a, b) => a[1].order - b[1].order)
        .forEach(([catId, group]) => {
            if (group.items.length === 0) return;

            html += `<div class="tier-group" data-category="${catId}">
                <h4>${group.name}</h4>`;

            group.items.forEach(l => {
                const searchData = removeAccents(l.name.toLowerCase());
                const diffFactor = l.difficultyFactor || 1.0;
                const factorBadge = diffFactor < 1 ? '🟢' : diffFactor > 1.3 ? '🔴' : '🟡';
                html += `
                    <label class="location-option" data-search="${searchData}" data-real-name="${l.name.toLowerCase()}">
                        <input type="checkbox" value="${l.id}" data-name="${l.name}" data-tier="${l.tier}" data-factor="${diffFactor}">
                        <span class="location-name">${l.name}</span>
                        <span class="location-meta">
                            <span class="tier-badge tier-${l.tier}">${l.defaultIR}% ${factorBadge}</span>
                        </span>
                    </label>
                `;
            });

            html += `</div>`;
        });

    html += `</div>`; // End dropdown-content

    html += `
        <div class="dropdown-footer">
            <button id="confirmLocationBtn" type="button">Xác nhận & Đóng</button>
        </div>
    `;

    elements.locationDropdownPanel.innerHTML = html;

    // Bind Search Event
    const searchInput = elements.locationDropdownPanel.querySelector('#locationSearchInput');
    searchInput.addEventListener('input', (e) => {
        const rawTerm = e.target.value.toLowerCase();
        const terms = rawTerm.split(',').map(t => removeAccents(t.trim())).filter(t => t !== '');

        const options = elements.locationDropdownPanel.querySelectorAll('.location-option');

        options.forEach(opt => {
            if (terms.length === 0) {
                opt.classList.remove('hidden');
            } else {
                const searchStr = opt.dataset.search;
                const match = terms.some(t => searchStr.includes(t));
                opt.classList.toggle('hidden', !match);
            }
        });

        // Hide empty groups
        elements.locationDropdownPanel.querySelectorAll('.tier-group').forEach(group => {
            const hasVisibleOptions = group.querySelectorAll('.location-option:not(.hidden)').length > 0;
            group.classList.toggle('hidden', !hasVisibleOptions);
        });
    });

    // Select All Filtered Results
    const selectAllBtn = elements.locationDropdownPanel.querySelector('#selectAllSearchBtn');
    selectAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const visibleCheckboxes = elements.locationDropdownPanel.querySelectorAll('.location-option:not(.hidden) input[type="checkbox"]');
        visibleCheckboxes.forEach(cb => cb.checked = true);
        updateLocationSelectionUI();
    });

    // Clear All Filtered Results
    const clearAllBtn = elements.locationDropdownPanel.querySelector('#clearAllSearchBtn');
    clearAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const visibleCheckboxes = elements.locationDropdownPanel.querySelectorAll('.location-option:not(.hidden) input[type="checkbox"]');
        visibleCheckboxes.forEach(cb => cb.checked = false);
        updateLocationSelectionUI();
    });

    // Prevent closing when clicking search area
    elements.locationDropdownPanel.querySelector('.dropdown-search').addEventListener('click', (e) => e.stopPropagation());

    // Bind checkbox events
    elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateLocationSelectionUI);
    });

    // Bind footer button
    const confirmBtn = elements.locationDropdownPanel.querySelector('#confirmLocationBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.locationDropdownPanel.classList.add('hidden');
        });
    }

    // Initial UI update
    updateLocationSelectionUI();
}

function populateTemplateDropdown(templates) {
    elements.templateSelect.innerHTML = '<option value="">-- Chọn loại dự án --</option>';

    if (!templates || templates.length === 0) return;

    templates.forEach(t => {
        const option = document.createElement('option');
        option.value = t.id;
        option.textContent = t.name;
        elements.templateSelect.appendChild(option);
    });
}

// ============ PANEL VENDOR MULTI-SELECT ============
function populatePanelVendorMultiSelect(vendors) {
    if (!vendors || vendors.length === 0 || !elements.panelDropdownPanel) return;

    let html = `
        <div class="dropdown-actions">
            <button type="button" class="select-all-btn" id="selectAllPanelBtn">✅ Chọn tất cả</button>
            <button type="button" class="deselect-all-btn" id="deselectAllPanelBtn">❌ Bỏ chọn</button>
        </div>
        <div class="dropdown-content">
    `;

    vendors.forEach(v => {
        const badgeClass = v.isInternal ? 'internal' : 'external';
        const badgeText = v.isInternal ? 'Nội bộ' : 'Vendor';

        html += `
            <label class="vendor-option" data-search="${v.name.toLowerCase()}">
                <input type="checkbox" value="${v.id}" data-name="${v.name}" data-factor="${v.responseFactor}" data-qc="${v.defaultQcReject}">
                <div class="vendor-info">
                    <div class="vendor-name">${v.name}</div>
                    <div class="vendor-desc">${v.description || ''}</div>
                    <div class="vendor-meta">
                        <span class="vendor-badge ${badgeClass}">${badgeText}</span>
                        <span class="vendor-factor">Factor: ×${v.responseFactor.toFixed(2)}</span>
                    </div>
                </div>
            </label>
        `;
    });

    html += `</div>`;
    html += `
        <div class="dropdown-footer">
            <button id="confirmPanelBtn" type="button">Xác nhận & Đóng</button>
        </div>
    `;

    elements.panelDropdownPanel.innerHTML = html;

    // Bind checkbox events
    elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updatePanelSelectionUI);
    });

    // Select All button
    const selectAllBtn = elements.panelDropdownPanel.querySelector('#selectAllPanelBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
            updatePanelSelectionUI();
        });
    }

    // Deselect All button
    const deselectAllBtn = elements.panelDropdownPanel.querySelector('#deselectAllPanelBtn');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            updatePanelSelectionUI();
        });
    }

    // Bind footer button
    const confirmBtn = elements.panelDropdownPanel.querySelector('#confirmPanelBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.panelDropdownPanel.classList.add('hidden');
        });
    }
}

function togglePanelDropdown(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    elements.panelDropdownPanel.classList.toggle('hidden');
}

function updatePanelSelectionUI() {
    const checkboxes = elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCount = checkboxes.length;

    if (selectedCount === 0) {
        elements.panelSelectedText.textContent = '-- Chọn panel vendors --';
    } else {
        const names = Array.from(checkboxes).map(cb => cb.dataset.name);
        if (selectedCount <= 2) {
            elements.panelSelectedText.textContent = names.join(', ');
        } else {
            elements.panelSelectedText.textContent = `${names[0]}, ${names[1]} +${selectedCount - 2}`;
        }
    }

    // Trigger calculation
    updateCalculation();
}

function getSelectedPanelVendorIds() {
    if (!elements.panelDropdownPanel) return [];
    const checkboxes = elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ============ TIMING CHECK ============
function checkTimingWarning(startDate) {
    if (!startDate || !elements.timingWarning) return;

    const check = getQuickTimingCheck(startDate);

    if (check.isHoliday) {
        elements.timingWarning.innerHTML = check.message;
        elements.timingWarning.className = 'timing-warning warning';
        elements.timingWarning.classList.remove('hidden');
    } else {
        elements.timingWarning.innerHTML = check.message;
        elements.timingWarning.className = 'timing-warning ok';
        elements.timingWarning.classList.remove('hidden');
    }
}

// ============ TEMPLATE SELECTION ============
async function onTemplateSelect() {
    const templateId = elements.templateSelect.value;
    if (!templateId) return;

    let templates;
    try {
        templates = await loadTemplates();
    } catch (e) {
        templates = getDefaultTemplates();
    }

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Fill form with template defaults
    const d = template.defaults;
    elements.sampleSize.value = d.sampleSize;
    elements.loi.value = d.loi;
    elements.irInput.value = d.ir;
    elements.irValue.textContent = d.ir;

    // Set quota
    document.querySelector(`input[name="quota"][value="${d.quota}"]`).checked = true;
    updateRadioCardSelection('quota', d.quota);

    // Set target
    const targetValue = d.hardTarget ? 'hard' : 'normal';
    document.querySelector(`input[name="target"][value="${targetValue}"]`).checked = true;
    updateRadioCardSelection('target', targetValue);

    // Set location if available (Single or Array)
    const checkboxes = elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false); // Clear all first

    if (d.location) {
        // d.location can be string (old) or array (new)
        const idsToSelect = Array.isArray(d.location) ? d.location : [d.location];

        let hasSelection = false;
        checkboxes.forEach(cb => {
            if (idsToSelect.includes(cb.value)) {
                cb.checked = true;
                hasSelection = true;
            }
        });

        if (hasSelection) {
            updateLocationSelectionUI(); // Updates text and triggers onLocationSelect
        }
    }

    // Set target audience from template and update indicator
    currentTargetAudience = d.targetAudience || 'general';
    await updateAudienceIndicator(currentTargetAudience);

    updateCalculation();
}

// Update audience indicator display
async function updateAudienceIndicator(audienceId) {
    if (!elements.audienceIndicator) return;

    if (!audienceId || audienceId === '') {
        elements.audienceIndicator.classList.add('hidden');
        return;
    }

    try {
        const audience = await getAudience(audienceId);

        if (audience) {
            elements.audienceIndicator.classList.remove('hidden');
            elements.audienceNameDisplay.textContent = audience.name || audienceId;

            // Determine difficulty badge
            const diff = audience.difficultyMultiplier || 1.0;
            let badgeText, badgeClass;
            if (diff <= 1.2) {
                badgeText = '🟢 Dễ';
                badgeClass = 'easy';
            } else if (diff <= 1.8) {
                badgeText = '🟡 Trung bình';
                badgeClass = 'medium';
            } else {
                badgeText = '🔴 Khó';
                badgeClass = 'hard';
            }

            elements.audienceBadge.textContent = badgeText;
            elements.audienceBadge.className = 'audience-badge ' + badgeClass;

            elements.audienceFactorDisplay.textContent =
                `IR Factor: ×${(audience.irFactor || 1.0).toFixed(2)} | Difficulty: ×${diff.toFixed(1)}`;
        } else {
            // Show default for unknown audience
            elements.audienceIndicator.classList.remove('hidden');
            elements.audienceNameDisplay.textContent = audienceId;
            elements.audienceBadge.textContent = '🟢 Dễ';
            elements.audienceBadge.className = 'audience-badge easy';
            elements.audienceFactorDisplay.textContent = 'IR Factor: ×1.00 | Difficulty: ×1.0';
        }
    } catch (e) {
        console.log('Error fetching audience:', e);
        elements.audienceIndicator.classList.add('hidden');
    }
}

function updateLocationSelectionUI() {
    const checkboxes = elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCount = checkboxes.length;

    if (selectedCount === 0) {
        elements.locationSelectedText.textContent = '-- Chọn locations --';
    } else {
        const names = Array.from(checkboxes).map(cb => cb.dataset.name);
        if (selectedCount <= 2) {
            elements.locationSelectedText.textContent = names.join(', ');
        } else {
            elements.locationSelectedText.textContent = `${names[0]}, ${names[1]} +${selectedCount - 2}`;
        }
    }

    // Trigger calculation
    onLocationSelect();
}

function toggleLocationDropdown(e) {
    // Prevent bubbling if triggered by child
    if (e && e.stopPropagation) e.stopPropagation();
    elements.locationDropdownPanel.classList.toggle('hidden');
}

// ============ LOCATION SELECTION ============
async function onLocationSelect() {
    const selectedIds = getSelectedLocationIds();

    if (selectedIds.length === 0) {
        elements.irSuggestion.classList.remove('visible');
        currentLocationStats = null;
        return;
    }

    let suggestion;
    try {
        suggestion = await getIRSuggestion(selectedIds);
    } catch (e) {
        // Fallback for offline/error
        suggestion = {
            defaultIR: 30,
            range: { min: 20, max: 40 },
            samplesPerDay: 50,
            travelBuffer: 0,
            difficultyFactor: 1.0,
            notes: 'Fallback data'
        };
    }

    if (suggestion) {
        currentLocationStats = suggestion; // Store for calculation

        // Determine difficulty badge
        const diff = suggestion.difficultyFactor || 1.0;
        let diffBadge, diffClass;
        if (diff <= 0.9) {
            diffBadge = '🟢 Dễ';
            diffClass = 'easy';
        } else if (diff <= 1.3) {
            diffBadge = '🟡 TB';
            diffClass = 'medium';
        } else {
            diffBadge = '🔴 Khó';
            diffClass = 'hard';
        }

        elements.irSuggestion.innerHTML = `
            <div class="ir-main">
                💡 IR suggest: <strong>${suggestion.defaultIR}%</strong>
                (range: ${suggestion.range.min}-${suggestion.range.max}%)
            </div>
            <div class="ir-location-info">
                📍 ${suggestion.notes || 'Selected locations'}
                <span class="difficulty-badge ${diffClass}">Difficulty: ×${diff.toFixed(2)} ${diffBadge}</span>
            </div>
            <div class="ir-tooltip-inline">
                <span class="tooltip-icon">?</span>
                <div class="tooltip-content ir-tooltip">
                    <div class="tooltip-header">📌 IR và Difficulty dựa vào đâu?</div>
                    <div class="tooltip-body">
                        <ul>
                            <li><strong>IR (Incidence Rate):</strong> Tỷ lệ qualify trung bình theo vùng, dựa trên historical data của các dự án tương tự.</li>
                            <li><strong>Difficulty Factor:</strong> Độ khó recruit online - Thành phố lớn (×0.8 = nhanh), nông thôn/miền núi (×2.0 = chậm).</li>
                        </ul>
                        <div class="tooltip-footer">Factor < 1.0 = nhanh hơn baseline | Factor > 1.0 = chậm hơn baseline</div>
                    </div>
                </div>
            </div>
        `;
        elements.irSuggestion.classList.add('visible');

        // Auto-set IR in quick mode
        if (currentMode === 'quick') {
            elements.irInput.value = suggestion.defaultIR;
            elements.irValue.textContent = suggestion.defaultIR;
        }

        updateCalculation();
    }
}

function getSelectedLocationIds() {
    const checkboxes = elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ============ CALCULATION ============
async function updateCalculation() {
    const input = getFormInput();

    // Validate minimum input
    if (!input.sampleSize || input.sampleSize <= 0 || !input.loi || input.loi <= 0) {
        clearResults();
        return;
    }

    if (currentMode === 'quick') {
        await updateQuickModeResults(input);
    } else {
        await updateDetailedModeResults(input);
    }

    // Update suggestions
    updateSuggestions(input, currentResult);
}

function getFormInput() {
    return {
        projectName: elements.projectName.value || 'Untitled Project',
        sampleSize: parseInt(elements.sampleSize.value) || 0,
        loi: parseInt(elements.loi.value) || 0,
        ir: parseInt(elements.irInput.value) || 35,
        quota: getRadioValue(elements.quotaRadios),
        hardTarget: getRadioValue(elements.targetRadios) === 'hard',
        locations: getSelectedLocationIds(),
        // Phase 1: Multi-factor inputs
        panelVendors: getSelectedPanelVendorIds(),
        quotaSkew: getRadioValue(elements.quotaSkewRadios) || 'balanced',
        qcBuffer: parseInt(elements.qcBuffer?.value) || 10,
        fwStartDate: elements.fwStartDate?.value ? new Date(elements.fwStartDate.value) : null,
        // Phase 2: Target Audience
        targetAudience: currentTargetAudience
    };
}

function getRadioValue(radios) {
    for (const r of radios) {
        if (r.checked) return r.value;
    }
    return null;
}

async function updateQuickModeResults(input) {
    let range;
    try {
        range = await calculateQuickModeRange(input);
    } catch (e) {
        // Fallback calculation
        const cases = getDefaultCases();
        range = {
            best: cases[0],
            likely: cases[4],
            worst: cases[11]
        };
    }

    // Add travel buffer if any
    const buffer = currentLocationStats?.travelBuffer || 0;

    // Best case
    if (range.best) {
        const bestFW = calculateFWDays(input.sampleSize, range.best.samplesPerDay);
        const min = Math.ceil(bestFW.min + buffer);
        const max = Math.ceil(bestFW.max + buffer);
        elements.bestDays.textContent = `${min}-${max} ngày`;
        elements.bestDesc.textContent = range.best.name;
    }

    // Likely case
    if (range.likely) {
        const likelyFW = calculateFWDays(input.sampleSize, range.likely.samplesPerDay);
        const min = Math.ceil(likelyFW.min + buffer);
        const max = Math.ceil(likelyFW.max + buffer);
        elements.likelyDays.textContent = `${min}-${max} ngày`;
        elements.likelyDesc.textContent = range.likely.name;

        // Set system estimate for expert comparison
        systemEstimate = { min: min, max: max };
        currentResult = range.likely;
    }

    // Worst case
    if (range.worst) {
        const worstFW = calculateFWDays(input.sampleSize, range.worst.samplesPerDay);
        const min = Math.ceil(worstFW.min + buffer);
        const max = Math.ceil(worstFW.max + buffer);
        elements.worstDays.textContent = `${min}-${max} ngày`;
        elements.worstDesc.textContent = range.worst.name;
    }
}

async function updateDetailedModeResults(input) {
    let matchedCase;
    try {
        matchedCase = await determineCase(input);
    } catch (e) {
        console.error('Error determining case:', e);
        return;
    }

    if (!matchedCase) {
        clearResults();
        return;
    }

    currentResult = matchedCase;

    // Update UI - Difficulty and Case
    elements.resDifficulty.textContent = matchedCase.difficulty;
    elements.resCaseName.textContent = `Case #${matchedCase.order} - ${matchedCase.name}`;
    elements.resDaily.textContent = `~${matchedCase.samplesPerDay}`;

    // ============ PHASE 1: MULTI-FACTOR CALCULATION ============
    let factors = {
        ir: 1.0, // Direct IR impact factor
        traffic: 1.0,
        quotaSkew: 1.0,
        qcBuffer: input.qcBuffer / 100,
        timing: 1.0,
        location: 1.0, // NEW: Location difficulty factor
        audience: 1.0 // Target Audience difficulty factor
    };

    // 1. Panel Vendor Factor
    if (input.panelVendors && input.panelVendors.length > 0) {
        try {
            const vendorResult = await calculateVendorFactor(input.panelVendors);
            factors.traffic = vendorResult.factor;

            // Also adjust QC buffer if vendor has high default QC reject
            const vendorQc = vendorResult.avgQcReject;
            const userQc = input.qcBuffer / 100;

            if (vendorQc > userQc) {
                factors.qcBuffer = vendorQc;
                // Update UI to show the system-enforced QC level from vendor
                if (elements.qcValue) elements.qcValue.textContent = Math.round(vendorQc * 100) + ' (Vendor default)';
            }
        } catch (e) {
            console.log('Vendor factor error, using default:', e.message);
        }
    }

    // 2. Quota Skew Factor (inverse - higher skew = slower = lower daily rate)
    const skewMultipliers = { balanced: 1.0, light_skew: 0.87, heavy_skew: 0.71 };
    factors.quotaSkew = skewMultipliers[input.quotaSkew] || 1.0;

    // 3. IR Impact Factor - IR directly affects daily sampling rate
    // Formula: IR 50% = baseline (×1.0), IR 100% = ×1.15, IR 10% = ×0.55
    const irValue = input.ir || 35;
    if (irValue >= 50) {
        factors.ir = 1.0 + ((irValue - 50) / 50) * 0.15;
    } else {
        factors.ir = 0.4 + (irValue / 50) * 0.58;
    }

    // 4. Timing Factor
    if (input.fwStartDate) {
        const timingResult = calculateTimingFactor(input.fwStartDate, 14);
        factors.timing = timingResult.factor;
    }

    // 5. Location Factor - based on selected locations' difficulty
    if (input.locations && input.locations.length > 0) {
        try {
            const locationResult = await calculateLocationFactor(input.locations);
            // difficultyFactor > 1 = harder = slower, so we invert
            factors.location = 1 / locationResult.factor;
        } catch (e) {
            console.log('Location factor error, using default:', e.message);
        }
    }

    // 6. Target Audience Factor
    if (input.targetAudience && input.targetAudience !== 'general') {
        try {
            const audienceImpact = await calculateAudienceImpact(input.targetAudience);
            // difficultyMultiplier > 1 means harder, so we divide to slow down daily rate
            factors.audience = 1 / audienceImpact.difficultyMultiplier;
        } catch (e) {
            console.log('Audience factor error, using default:', e.message);
        }
    }

    // 7. Sample Size Factor (Diminishing Returns for large projects)
    const sampleFactor = calculateSampleSizeFactor(input.sampleSize);
    factors.sampleSize = sampleFactor.factor;

    // Check toggle states - if toggled off, use neutral value (1.0)
    const isIREnabled = elements.toggleIR?.checked !== false;
    const isTrafficEnabled = elements.toggleTraffic?.checked !== false;
    const isQuotaEnabled = elements.toggleQuota?.checked !== false;
    const isQCEnabled = elements.toggleQC?.checked !== false;
    const isTimingEnabled = elements.toggleTiming?.checked !== false;
    const isSampleSizeEnabled = elements.toggleSampleSize?.checked !== false;
    const isLocationEnabled = elements.toggleLocation?.checked !== false;
    const isAudienceEnabled = elements.toggleAudience?.checked !== false;

    // Calculate adjusted daily rate with toggle support
    const baseDaily = matchedCase.samplesPerDay;
    const adjustedDaily = baseDaily
        * (isIREnabled ? factors.ir : 1.0)
        * (isTrafficEnabled ? factors.traffic : 1.0)
        * (isQuotaEnabled ? factors.quotaSkew : 1.0)
        * (isTimingEnabled ? factors.timing : 1.0)
        * (isSampleSizeEnabled ? factors.sampleSize : 1.0)
        * (isLocationEnabled ? factors.location : 1.0)
        * (isAudienceEnabled ? factors.audience : 1.0);

    // Calculate required samples with QC buffer (only if QC is enabled)
    const effectiveQCBuffer = isQCEnabled ? factors.qcBuffer : 0;
    const requiredWithQC = Math.ceil(input.sampleSize * (1 + effectiveQCBuffer));

    // Calculate FW days from adjusted rate
    const travelBuffer = currentLocationStats?.travelBuffer || 0;
    const fwDaysMin = Math.ceil((requiredWithQC / adjustedDaily) * 0.85 + travelBuffer);
    const fwDaysMax = Math.ceil((requiredWithQC / adjustedDaily) * 1.15 + travelBuffer);

    // Update results display
    elements.resDays.textContent = `${fwDaysMin}-${fwDaysMax} ngày`;
    if (travelBuffer > 0) {
        elements.resDays.textContent += ` (+${travelBuffer} travel)`;
    }

    systemEstimate = { min: fwDaysMin, max: fwDaysMax };

    // Update Factor Breakdown display
    // NEW: IR Factor display
    if (elements.factorIR) {
        elements.factorIR.textContent = `×${factors.ir.toFixed(2)}`;
        if (factors.ir >= 1.0) {
            elements.factorIR.className = 'factor-value positive';
        } else if (factors.ir >= 0.8) {
            elements.factorIR.className = 'factor-value';
        } else {
            elements.factorIR.className = 'factor-value negative';
        }
    }
    if (elements.factorTraffic) {
        elements.factorTraffic.textContent = `×${factors.traffic.toFixed(2)}`;
        if (factors.traffic >= 1.0) {
            elements.factorTraffic.className = 'factor-value positive';
        } else if (factors.traffic >= 0.8) {
            elements.factorTraffic.className = 'factor-value';
        } else {
            elements.factorTraffic.className = 'factor-value negative';
        }
    }
    if (elements.factorQuota) {
        elements.factorQuota.textContent = `×${factors.quotaSkew.toFixed(2)}`;
        if (factors.quotaSkew >= 1.0) {
            elements.factorQuota.className = 'factor-value positive';
        } else if (factors.quotaSkew >= 0.8) {
            elements.factorQuota.className = 'factor-value';
        } else {
            elements.factorQuota.className = 'factor-value negative';
        }
    }
    if (elements.factorQC) {
        elements.factorQC.textContent = `+${Math.round(factors.qcBuffer * 100)}%`;
    }
    if (elements.factorTiming) {
        elements.factorTiming.textContent = `×${factors.timing.toFixed(2)}`;
        if (factors.timing >= 1.0) {
            elements.factorTiming.className = 'factor-value positive';
        } else if (factors.timing >= 0.9) {
            elements.factorTiming.className = 'factor-value';
        } else {
            elements.factorTiming.className = 'factor-value negative';
        }
    }
    // Sample Size factor display
    if (elements.factorSampleSize) {
        elements.factorSampleSize.textContent = `×${factors.sampleSize.toFixed(2)}`;
        if (factors.sampleSize >= 1.0) {
            elements.factorSampleSize.className = 'factor-value positive';
        } else if (factors.sampleSize >= 0.85) {
            elements.factorSampleSize.className = 'factor-value';
        } else {
            elements.factorSampleSize.className = 'factor-value negative';
        }
    }
    // Location factor display
    if (elements.factorLocation) {
        elements.factorLocation.textContent = `×${factors.location.toFixed(2)}`;
        if (factors.location >= 1.0) {
            elements.factorLocation.className = 'factor-value positive';
        } else if (factors.location >= 0.8) {
            elements.factorLocation.className = 'factor-value';
        } else {
            elements.factorLocation.className = 'factor-value negative';
        }
    }
    // Audience factor display
    if (elements.factorAudience) {
        elements.factorAudience.textContent = `×${factors.audience.toFixed(2)}`;
        if (factors.audience >= 1.0) {
            elements.factorAudience.className = 'factor-value positive';
        } else if (factors.audience >= 0.7) {
            elements.factorAudience.className = 'factor-value';
        } else {
            elements.factorAudience.className = 'factor-value negative';
        }
    }
    if (elements.adjustedDaily) {
        elements.adjustedDaily.textContent = `~${Math.round(adjustedDaily)} samples/day`;
    }

    // ============ UPDATE SOURCE LABELS ============
    // IR Source
    if (elements.factorIRSource) {
        elements.factorIRSource.textContent = `IR ${input.ir}%`;
    }

    // Panel Source
    if (elements.factorTrafficSource) {
        if (input.panelVendors && input.panelVendors.length > 0) {
            const vendorNames = input.panelVendors.slice(0, 2).join(', ');
            elements.factorTrafficSource.textContent = input.panelVendors.length > 2
                ? `${vendorNames} +${input.panelVendors.length - 2}`
                : vendorNames;
        } else {
            elements.factorTrafficSource.textContent = 'Không chọn';
        }
    }

    // Quota Skew Source
    if (elements.factorQuotaSource) {
        const skewLabels = { balanced: 'Balanced', light_skew: 'Skew nhẹ', heavy_skew: 'Skew nặng' };
        elements.factorQuotaSource.textContent = skewLabels[input.quotaSkew] || 'Balanced';
    }

    // QC Source
    if (elements.factorQCSource) {
        elements.factorQCSource.textContent = `Buffer ${input.qcBuffer}%`;
    }

    // Timing Source
    if (elements.factorTimingSource) {
        if (input.fwStartDate) {
            const dateStr = input.fwStartDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            elements.factorTimingSource.textContent = `Start ${dateStr}`;
        } else {
            elements.factorTimingSource.textContent = 'Chưa chọn ngày';
        }
    }

    // Sample Size Source
    if (elements.factorSampleSizeSource) {
        elements.factorSampleSizeSource.textContent = `N = ${input.sampleSize}`;
    }

    // Location Source
    if (elements.factorLocationSource) {
        if (currentLocationStats && currentLocationStats.notes) {
            const locNames = currentLocationStats.notes.split(', ').slice(0, 2).join(', ');
            const rawFactor = currentLocationStats.difficultyFactor?.toFixed(2) || '1.00';
            elements.factorLocationSource.textContent = input.locations.length > 2
                ? `${locNames}.. (×${rawFactor})`
                : `${locNames} (×${rawFactor})`;
        } else {
            elements.factorLocationSource.textContent = 'Không chọn';
        }
    }

    // Audience Source
    if (elements.factorAudienceSource) {
        if (input.targetAudience && input.targetAudience !== 'general') {
            const audienceName = elements.audienceNameDisplay?.textContent || input.targetAudience;
            elements.factorAudienceSource.textContent = audienceName;
        } else {
            elements.factorAudienceSource.textContent = 'General Pop';
        }
    }

    // CPI Estimate
    const cpi = estimateCPI(input);
    elements.resCPI.textContent = `$${cpi.amount}`;

    // Update color theme
    updateDifficultyColor(matchedCase.difficulty);
}

function updateDifficultyColor(difficulty) {
    const box = elements.resultDifficultyBox;

    if (difficulty.includes('Dễ')) {
        box.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
        elements.resDifficulty.style.color = '#059669';
    } else if (difficulty.includes('Trung bình')) {
        box.style.background = 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)';
        elements.resDifficulty.style.color = '#4f46e5';
    } else if (difficulty.includes('Khó') || difficulty.includes('Cực')) {
        box.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
        elements.resDifficulty.style.color = '#dc2626';
    }
}

function updateSuggestions(input, matchedCase) {
    const suggestions = generateSuggestions(input, matchedCase);

    if (suggestions.length === 0) {
        elements.suggestionList.innerHTML = '<li class="placeholder">Không có gợi ý đặc biệt. Dự án có vẻ khả thi.</li>';
        return;
    }

    elements.suggestionList.innerHTML = suggestions.map(s =>
        `<li class="${s.type}">${s.text}</li>`
    ).join('');
}

function clearResults() {
    // Quick mode
    elements.bestDays.textContent = '--';
    elements.likelyDays.textContent = '--';
    elements.worstDays.textContent = '--';

    // Detailed mode
    elements.resDifficulty.textContent = '---';
    elements.resCaseName.textContent = 'Case #--';
    elements.resDaily.textContent = '--';
    elements.resDays.textContent = '-- ngày';
    elements.resCPI.textContent = '$ --';

    // Suggestions
    elements.suggestionList.innerHTML = '<li class="placeholder">Nhập thông tin để xem gợi ý...</li>';

    currentResult = null;
    systemEstimate = { min: 0, max: 0 };
}

// ============ EXPERT CONCLUSION ============
function onExpertDaysChange() {
    const expertDays = parseInt(elements.expertDays.value);

    if (!expertDays || systemEstimate.max === 0) {
        elements.conclusionWarning.classList.add('hidden');
        return;
    }

    const comparison = compareExpertVsSystem(expertDays, systemEstimate);

    if (comparison.warning) {
        elements.conclusionWarning.textContent = comparison.warning;
        elements.conclusionWarning.className = `conclusion-warning ${comparison.status}`;
        elements.conclusionWarning.classList.remove('hidden');
    } else {
        elements.conclusionWarning.classList.add('hidden');
    }
}

// ============ SAVE ============
async function onSave() {
    const input = getFormInput();
    const expertDays = parseInt(elements.expertDays.value);

    if (!expertDays) {
        elements.saveStatus.textContent = '⚠️ Vui lòng nhập số ngày FW chính thức';
        elements.saveStatus.style.color = '#f59e0b';
        return;
    }

    // Serialize Date object
    const savedInput = {
        ...input,
        fwStartDate: input.fwStartDate ? input.fwStartDate.toISOString() : null
    };

    const data = {
        projectName: input.projectName,
        mode: currentMode,
        input: savedInput,
        systemResult: {
            caseId: currentResult?.id,
            difficulty: currentResult?.difficulty,
            samplesPerDay: currentResult?.samplesPerDay,
            fwDaysMin: systemEstimate.min,
            fwDaysMax: systemEstimate.max
        },
        expertConclusion: {
            fwDays: expertDays,
            note: elements.expertNote.value
        }
    };

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = '⏳ Đang lưu...';

    try {
        await saveCalculation(data);
        elements.saveStatus.textContent = '✅ Đã lưu thành công!';
        elements.saveStatus.style.color = '#10b981';

        // Show and populate summary table
        populateSummaryTable(input, expertDays);

        // Reload history and project list
        await loadHistory();
        await loadProjectList(1);

        // Clear form for next calculation
        setTimeout(() => {
            elements.expertDays.value = '';
            elements.expertNote.value = '';
            elements.conclusionWarning.classList.add('hidden');
            elements.saveStatus.textContent = '';
        }, 2000);
    } catch (error) {
        console.error('Save error:', error);
        elements.saveStatus.textContent = '❌ Lỗi khi lưu. Thử lại sau.';
        elements.saveStatus.style.color = '#ef4444';
    }

    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = '💾 Lưu kết luận';
}

// ============ HISTORY ============
async function loadHistory() {
    try {
        const history = await getRecentHistory(5);
        renderHistory(history);
    } catch (error) {
        console.error('Error loading history:', error);
        elements.historyList.innerHTML = '<p class="placeholder">Không thể tải lịch sử.</p>';
    }
}

function renderHistory(history) {
    if (!history || history.length === 0) {
        elements.historyList.innerHTML = '<p class="placeholder">Chưa có lịch sử...</p>';
        return;
    }

    elements.historyList.innerHTML = history.map((item, idx) => {
        const date = item.createdAt instanceof Date
            ? item.createdAt.toLocaleDateString('vi-VN')
            : 'N/A';

        // Store item data in a global array for click handler
        if (!window.historyData) window.historyData = [];
        window.historyData[idx] = item;

        return `
            <div class="history-item" onclick="loadHistoryItem(${idx})" style="cursor: pointer;" title="Click để xem chi tiết">
                <div>
                    <div class="project-name">${item.projectName}</div>
                    <div class="date">${date}</div>
                </div>
                <div class="fw-days">${item.expertConclusion?.fwDays || '--'} ngày</div>
            </div>
        `;
    }).join('');
}

// Load history item into form
window.loadHistoryItem = function (idx) {
    const item = window.historyData?.[idx];
    if (!item) return;

    // Switch to detailed mode to show all fields
    switchMode('detailed');

    // Populate form fields
    if (elements.projectName) elements.projectName.value = item.projectName || '';
    if (elements.sampleSize) elements.sampleSize.value = item.input?.sampleSize || '';
    if (elements.loi) elements.loi.value = item.input?.loi || '';
    if (elements.irInput) {
        elements.irInput.value = item.input?.ir || 35;
        elements.irValue.textContent = item.input?.ir || 35;
    }
    if (elements.expertDays) elements.expertDays.value = item.expertConclusion?.fwDays || '';
    if (elements.expertNote) elements.expertNote.value = item.expertConclusion?.note || '';

    // Set quota radio
    const quotaValue = item.input?.quota || 'simple';
    const quotaRadio = document.querySelector(`input[name="quota"][value="${quotaValue}"]`);
    if (quotaRadio) {
        quotaRadio.checked = true;
        quotaRadio.closest('.radio-card')?.classList.add('selected');
    }

    // Set target radio
    const targetValue = item.input?.hardTarget ? 'hard' : 'normal';
    const targetRadio = document.querySelector(`input[name="target"][value="${targetValue}"]`);
    if (targetRadio) {
        targetRadio.checked = true;
        targetRadio.closest('.radio-card')?.classList.add('selected');
    }

    // Trigger calculation
    updateCalculation();

    // Show notification
    const status = document.getElementById('saveStatus');
    if (status) {
        status.textContent = '📜 Đã load dự án: ' + item.projectName;
        status.style.color = '#3b82f6';
        setTimeout(() => { status.textContent = ''; }, 3000);
    }
}

// ============ SUMMARY TABLE ============
function populateSummaryTable(input, expertDays) {
    const container = document.getElementById('summaryTableContainer');
    const tbody = document.getElementById('summaryTableBody');
    if (!container || !tbody) return;

    // Show the table
    container.classList.remove('hidden');

    // Get location names
    const locationCheckboxes = elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]:checked');
    const locationNames = Array.from(locationCheckboxes).map(cb => cb.dataset.name).join(', ') || '--';

    // Get audience name
    const audienceName = elements.audienceNameDisplay?.textContent || currentTargetAudience;

    // Get factor values from display
    const panelFactor = elements.factorTraffic?.textContent || '×1.00';
    const quotaSkew = elements.factorQuota?.textContent || '×1.00';
    const qcBuffer = elements.factorQC?.textContent || '+10%';
    const timingFactor = elements.factorTiming?.textContent || '×1.00';
    const adjustedDaily = elements.adjustedDaily?.textContent || '-- samples/day';
    const audienceFactor = elements.audienceFactorDisplay?.textContent?.split('|')[1]?.trim() || '×1.0';

    // Define table rows data
    const tableData = [
        { section: '📌 Thông tin dự án' },
        { label: 'Tên dự án', value: input.projectName || '--' },
        { label: 'Sample Size (N)', value: input.sampleSize || '--' },
        { label: 'LOI', value: (input.loi || '--') + ' phút' },
        { label: 'IR', value: (input.ir || '--') + '%' },

        { section: '🎯 Target & Quota' },
        { label: 'Location', value: locationNames },
        { label: 'Target Audience', value: audienceName },
        { label: 'Quota Structure', value: input.quota === 'nested' ? 'Nested (Interlocking)' : 'Simple' },
        { label: 'Hard Target', value: input.hardTarget ? 'Có' : 'Không' },

        { section: '📊 Factors Applied' },
        { label: 'Panel Source Factor', value: panelFactor },
        { label: 'Quota Skew Factor', value: quotaSkew },
        { label: 'QC Buffer', value: qcBuffer },
        { label: 'Timing Factor', value: timingFactor },
        { label: 'Audience Difficulty', value: audienceFactor },

        { section: '✅ Kết quả', isResult: true },
        { label: 'Case / Độ khó', value: currentResult?.difficulty || '--', isResult: true },
        { label: 'Adjusted Daily Rate', value: adjustedDaily, isResult: true },
        { label: 'FW Days (Estimate)', value: `${systemEstimate.min}-${systemEstimate.max} ngày`, isResult: true, isHighlight: true },
        { label: 'FW Days (Expert)', value: `${expertDays} ngày`, isResult: true, isHighlight: true },
        { label: 'CPI Estimate', value: elements.resCPI?.textContent || '$ --', isResult: true },
        { label: 'Ghi chú', value: elements.expertNote?.value || '--', isResult: true }
    ];

    // Generate HTML
    let html = '';
    tableData.forEach((row, idx) => {
        if (row.section) {
            // Section header row (no delete button)
            const resultClass = row.isResult ? 'result-section' : '';
            html += `<tr class="section-header ${resultClass}" data-section="true">
                <td colspan="3">${row.section}</td>
            </tr>`;
        } else {
            // Data row with editable value and delete button
            const rowClass = row.isResult ? 'result-row' : '';
            const highlightClass = row.isHighlight ? 'highlight' : '';
            const valueStyle = row.isHighlight ? 'font-weight: bold;' : '';

            html += `<tr class="${rowClass} ${highlightClass}" data-row-idx="${idx}">
                <td>${row.label}</td>
                <td contenteditable="true" style="${valueStyle}">${row.value}</td>
                <td class="delete-cell">
                    <button type="button" class="delete-row-btn" onclick="this.closest('tr').remove()" title="Xoá dòng này">🗑️</button>
                </td>
            </tr>`;
        }
    });

    tbody.innerHTML = html;

    // Scroll to summary table
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Copy summary table as HTML for Gmail
function copySummaryToClipboard() {
    const table = document.getElementById('summaryTable');
    if (!table) return;

    // Create a clean HTML table for Gmail compatibility
    const rows = table.querySelectorAll('tr');
    let html = '<table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 14px;">';

    rows.forEach(row => {
        html += '<tr>';
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, idx) => {
            // Skip delete column (index 2)
            if (idx >= 2) return;

            let colspan = cell.getAttribute('colspan') || 1;
            // Adjust colspan for section headers (was 3, now 2)
            if (colspan > 2) colspan = 2;

            const isHeader = row.classList.contains('section-header');
            const isResult = row.classList.contains('result-row');
            const isHighlight = row.classList.contains('highlight');

            let bgColor = '#ffffff';
            let fontWeight = 'normal';
            let color = '#333333';

            if (isHeader) {
                bgColor = '#e0e7ff';
                fontWeight = 'bold';
                color = '#4338ca';
            } else if (isHighlight) {
                bgColor = '#dcfce7';
                fontWeight = 'bold';
                color = '#059669';
            } else if (isResult) {
                bgColor = '#f0fdf4';
            } else if (idx === 0) {
                bgColor = '#f9fafb';
                color = '#6b7280';
            }

            html += `<td style="border: 1px solid #e5e7eb; padding: 10px 16px; background: ${bgColor}; font-weight: ${fontWeight}; color: ${color};"${colspan > 1 ? ` colspan="${colspan}"` : ''}>${cell.textContent}</td>`;
        });
        html += '</tr>';
    });

    html += '</table>';

    // Copy as both HTML and plain text
    const blob = new Blob([html], { type: 'text/html' });
    const item = new ClipboardItem({ 'text/html': blob });

    navigator.clipboard.write([item]).then(() => {
        const btn = document.getElementById('copySummaryBtn');
        btn.textContent = '✅ Đã copy!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        // Fallback to plain text
        navigator.clipboard.writeText(table.innerText);
        alert('Đã copy dạng text. Để copy HTML, hãy dùng Chrome.');
    });
}

// NEW: Quick Send Email
function sendEmailSummary() {
    // 1. Prompt for recipient
    const recipient = prompt("Nhập email người nhận (để trống để tự điền):", "");
    if (recipient === null) return; // User Cancelled

    // 2. Generate content (Plain Text)
    const table = document.getElementById('summaryTable');
    if (!table) return;

    const rows = table.querySelectorAll('tr');
    let body = `QUICK SUMMARY\n==============================\n\n`;

    rows.forEach(row => {
        // Check section header
        if (row.classList.contains('section-header')) {
            const section = row.querySelector('td');
            if (section) body += `\n[ ${section.innerText.trim().toUpperCase()} ]\n`;
        } else {
            // Check data row
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const label = cells[0].innerText.trim();
                const value = cells[1].innerText.trim();
                // Padding for alignment
                const padLabel = label.padEnd(25, ' ');
                body += `${padLabel} : ${value}\n`;
            }
        }
    });

    body += `\n==============================\nGenerated by Sample Size Calculator`;

    // 3. Subject
    const projectName = elements.projectName.value || 'Project Summary';
    const subject = `Quick Estimation: ${projectName}`;

    // 4. Open mailto
    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

// Setup copy & email button listener
document.getElementById('copySummaryBtn')?.addEventListener('click', copySummaryToClipboard);
document.getElementById('emailSummaryBtn')?.addEventListener('click', sendEmailSummary);

// ============ PROJECT LIST (SIDEBAR) ============
window.loadProjectList = async function (page = 1) {
    currentPage = page;
    const projectList = document.getElementById('projectList');
    if (!projectList) return;

    projectList.innerHTML = '<p class="placeholder">Đang tải...</p>';

    try {
        const history = await getRecentHistory(50); // Get up to 50 projects
        const totalProjects = history.length;
        const totalPages = Math.ceil(totalProjects / projectsPerPage);

        // Calculate pagination
        const startIdx = (page - 1) * projectsPerPage;
        const endIdx = startIdx + projectsPerPage;
        const pageProjects = history.slice(startIdx, endIdx);

        if (pageProjects.length === 0) {
            projectList.innerHTML = '<p class="placeholder">Chưa có dự án nào</p>';
        } else {
            renderProjectCards(pageProjects, startIdx);
        }

        renderPagination(page, totalPages);

    } catch (e) {
        console.error('Error loading projects:', e);
        projectList.innerHTML = '<p class="placeholder">Lỗi tải dự án</p>';
    }
}

function renderProjectCards(projects, startIdx) {
    const projectList = document.getElementById('projectList');
    if (!projectList) return;

    projectList.innerHTML = projects.map((item, idx) => {
        const date = item.createdAt instanceof Date
            ? item.createdAt.toLocaleDateString('vi-VN')
            : 'N/A';

        const fwDays = item.expertConclusion?.fwDays || item.systemResult?.fwDaysMin || '--';
        const difficulty = item.systemResult?.difficulty || 'Trung bình';

        // Determine difficulty class
        let diffClass = 'medium';
        if (difficulty.includes('Dễ') || difficulty.includes('Easy')) diffClass = 'easy';
        else if (difficulty.includes('Khó') || difficulty.includes('Hard')) diffClass = 'hard';

        const isActive = currentProjectId === item.id;

        // Store in global for click handler
        if (!window.projectData) window.projectData = {};
        window.projectData[startIdx + idx] = item;

        return `
            <div class="project-card ${isActive ? 'active' : ''}" title="${item.projectName}">
                <div class="project-main" onclick="selectProject(${startIdx + idx})">
                    <div class="project-name">${item.projectName || 'Untitled'}</div>
                    <div class="project-meta">
                        <span class="project-date">${date}</span>
                        <span class="project-days">${fwDays} ngày</span>
                    </div>
                </div>
                <button class="project-delete-btn" onclick="event.stopPropagation(); deleteProject('${item.id}', '${(item.projectName || 'Untitled').replace(/'/g, "\\'")}')" title="Xóa dự án">🗑️</button>
            </div>
        `;
    }).join('');
}

// ============ DELETE PROJECT ============
window.deleteProject = async function (projectId, projectName) {
    if (!confirm(`Xóa dự án "${projectName}"?\n\nHành động này không thể hoàn tác!`)) {
        return;
    }

    try {
        await deleteCalculation(projectId);

        // Clear form if deleting current project
        if (currentProjectId === projectId) {
            currentProjectId = null;
            if (elements.projectName) elements.projectName.value = '';
            clearResults();
        }

        // Reload project list
        loadProjectList(currentPage);

        alert('Đã xóa dự án thành công!');
    } catch (error) {
        console.error('Delete project error:', error);
        alert('Lỗi khi xóa dự án: ' + error.message);
    }
};


function renderPagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination || totalPages <= 1) {
        if (pagination) pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = `
        <button onclick="loadProjectList(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>&lt;</button>
        <span class="page-info">${currentPage}/${totalPages}</span>
        <button onclick="loadProjectList(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>&gt;</button>
    `;
}

window.selectProject = function (idx) {
    const item = window.projectData?.[idx];
    if (!item) return;

    currentProjectId = item.id;

    // Update active state in UI
    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('active'));
    event?.target?.closest('.project-card')?.classList.add('active');

    // Switch to detailed mode
    switchMode('detailed');

    // Populate form basic inputs
    if (elements.projectName) elements.projectName.value = item.projectName || '';
    if (elements.sampleSize) elements.sampleSize.value = item.input?.sampleSize || 0;
    if (elements.loi) elements.loi.value = item.input?.loi || 15;
    if (elements.irInput) {
        elements.irInput.value = item.input?.ir || 35;
        elements.irValue.textContent = item.input?.ir || 35;
    }
    if (elements.expertDays) elements.expertDays.value = item.expertConclusion?.fwDays || '';
    if (elements.expertNote) elements.expertNote.value = item.expertConclusion?.note || '';

    // Restore Date
    if (elements.fwStartDate && item.input?.fwStartDate) {
        // Handle both ISO string and Firestore Timestamp
        let dateVal = item.input.fwStartDate;
        if (dateVal.toDate) dateVal = dateVal.toDate().toISOString(); // Firestore Timestamp
        elements.fwStartDate.value = dateVal.split('T')[0];
    }

    // Set quota radio
    const quotaValue = item.input?.quota || 'simple';
    document.querySelectorAll('input[name="quota"]').forEach(r => {
        r.checked = r.value === quotaValue;
        // Trigger generic change if needed, but manual UI update is safer
        r.closest('.radio-card')?.classList.toggle('selected', r.value === quotaValue);
    });

    // Set target radio
    const targetValue = item.input?.hardTarget ? 'hard' : 'normal';
    document.querySelectorAll('input[name="target"]').forEach(r => {
        r.checked = r.value === targetValue;
        r.closest('.radio-card')?.classList.toggle('selected', r.value === targetValue);
    });

    // Restore Locations (Multi-select)
    const savedLocs = item.input?.locations || [];
    if (elements.locationDropdownPanel) {
        elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = savedLocs.includes(cb.value);
        });
        updateLocationSelectionUI();
    }

    // Restore Phase 1 & 2 inputs
    // Panel Vendors
    const savedVendors = item.input?.panelVendors || [];
    if (elements.panelDropdownPanel) {
        elements.panelDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = savedVendors.includes(cb.value);
        });
        updatePanelSelectionUI();
    }

    // Target Audience
    if (elements.audienceSelect && item.input?.targetAudience) {
        elements.audienceSelect.value = item.input.targetAudience;
        // Trigger change to update info
        const event = new Event('change');
        elements.audienceSelect.dispatchEvent(event);
    }

    // Quota Skew
    const skewVal = item.input?.quotaSkew || 'balanced';
    document.querySelectorAll('input[name="quotaSkew"]').forEach(r => {
        r.checked = r.value === skewVal;
        r.closest('.skew-option')?.classList.toggle('selected', r.value === skewVal);
    });

    // QC Buffer - handle numeric value to radio
    const qcVal = item.input?.qcBuffer || 10;
    document.querySelectorAll('input[name="qcBuffer"]').forEach(r => {
        // Value in radio is string "10", input data might be 10 (int)
        r.checked = parseInt(r.value) === qcVal;
        r.closest('.buffer-option')?.classList.toggle('selected', parseInt(r.value) === qcVal);
    });

    // Template (Visual only, doesn't affect logic much)
    // if (elements.templateSelect && item.input?.projectTemplate) { ... }

    // Trigger calculation
    updateCalculation();

    // Show notification
    const status = document.getElementById('saveStatus');
    if (status) {
        status.textContent = '📂 Đã load: ' + item.projectName;
        status.style.color = '#3b82f6';
        setTimeout(() => { status.textContent = ''; }, 3000);
    }
}

function createNewProject() {
    currentProjectId = null;

    // Clear active state
    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('active'));

    // Switch to quick mode
    switchMode('quick');

    // Reset form
    if (elements.projectName) elements.projectName.value = '';
    if (elements.sampleSize) elements.sampleSize.value = '';
    if (elements.loi) elements.loi.value = '';
    if (elements.irInput) {
        elements.irInput.value = 35;
        elements.irValue.textContent = 35;
    }
    if (elements.expertDays) elements.expertDays.value = '';
    if (elements.expertNote) elements.expertNote.value = '';

    // Reset radios
    document.querySelectorAll('input[name="quota"]').forEach(r => {
        r.checked = r.value === 'simple';
        r.closest('.radio-card')?.classList.toggle('selected', r.value === 'simple');
    });
    document.querySelectorAll('input[name="target"]').forEach(r => {
        r.checked = r.value === 'normal';
        r.closest('.radio-card')?.classList.toggle('selected', r.value === 'normal');
    });

    // Hide summary table
    const summaryContainer = document.getElementById('summaryTableContainer');
    if (summaryContainer) summaryContainer.classList.add('hidden');

    // Show notification
    const status = document.getElementById('saveStatus');
    if (status) {
        status.textContent = '✨ Bắt đầu estimate mới';
        status.style.color = '#10b981';
        setTimeout(() => { status.textContent = ''; }, 2000);
    }

    updateCalculation();
}



// ============ AUTH UI ============
function setupAuthUI() {
    const authStatus = document.getElementById('authStatus');
    const userEmail = document.getElementById('userEmail');
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Bạn có chắc muốn đăng xuất?')) {
                await logOut();
                window.location.reload();
            }
        });
    }

    // Subscribe to auth changes
    onAuthChange((user) => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (user && authStatus && userEmail) {
            authStatus.classList.remove('hidden');
            userEmail.textContent = user.email;
            if (logoutBtn) logoutBtn.classList.remove('hidden');
        } else if (authStatus) {
            authStatus.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    });
}

// ============ START ============
init();
setupAuthUI();
