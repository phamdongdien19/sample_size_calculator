/**
 * Sample Size Calculator - Main Application
 * Version 3.0
 */

// Import services
import { loadCases, determineCase, calculateQuickModeRange, getDefaultCases } from './js/caseLogic.js';
import { calculateFWDays, compareExpertVsSystem, estimateCPI, generateSuggestions } from './js/calculator.js';
import { loadLocations, getIRSuggestion, getDefaultLocations } from './js/locationService.js';
import { loadTemplates, getDefaultTemplates } from './js/templateService.js';
import { saveCalculation, getRecentHistory } from './js/historyService.js';
// Phase 1: Multi-factor imports
import { loadPanelVendors, getDefaultVendors, calculateVendorFactor } from './js/panelVendorService.js';
import { getQuickTimingCheck, calculateTimingFactor } from './js/timingService.js';
import { loadQuotaSkewConfig, getQuotaSkewMultiplier, getDefaultQuotaSkew } from './js/quotaSkewService.js';

// ============ STATE ============
let currentMode = 'quick'; // 'quick' or 'detailed'
let currentResult = null;
let systemEstimate = { min: 0, max: 0 };
let currentLocationStats = null; // { defaultIR, range, samplesPerDay, travelBuffer }

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
    factorTraffic: document.getElementById('factorTraffic'),
    factorQuota: document.getElementById('factorQuota'),
    factorQC: document.getElementById('factorQC'),
    factorTiming: document.getElementById('factorTiming'),
    adjustedDaily: document.getElementById('adjustedDaily'),
    factorBreakdown: document.getElementById('factorBreakdown')
};

// ============ INITIALIZATION ============
async function init() {
    console.log('Initializing Sample Size Calculator v3...');

    // Load data (with fallbacks)
    await loadDropdowns();
    await loadHistory();

    // Setup event listeners
    setupEventListeners();

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

    // Load locations - with guaranteed fallback
    try {
        const locations = await loadLocations();
        if (locations && locations.length > 0) {
            populateLocationMultiSelect(locations);
        } else {
            console.log('No locations from Firebase, using defaults');
            populateLocationMultiSelect(getDefaultLocations());
        }
    } catch (e) {
        console.log('Firebase error, using default locations:', e.message);
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
            elements.qcValue.textContent = elements.qcBuffer.value;
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

function populateLocationMultiSelect(locations) {
    if (!locations || locations.length === 0) return;

    // Group by Tier
    const tiers = {
        1: { name: 'Tier 1: DỄ (Easy)', items: [] },
        2: { name: 'Tier 2: TRUNG BÌNH (Medium)', items: [] },
        3: { name: 'Tier 3: KHÓ (Hard)', items: [] },
        4: { name: 'Tier 4: RẤT KHÓ (Very Hard)', items: [] },
        5: { name: 'Special', items: [] }
    };

    locations.forEach(l => {
        const tier = l.tier || 5;
        if (tiers[tier]) {
            tiers[tier].items.push(l);
        } else {
            tiers[5].items.push(l);
        }
    });

    let html = `
        <div class="dropdown-search">
            <input type="text" id="locationSearchInput" placeholder="🔍 Tìm kiếm location..." autocomplete="off">
        </div>
        <div class="dropdown-content">
    `;

    Object.keys(tiers).sort().forEach(tierId => {
        const group = tiers[tierId];
        if (group.items.length === 0) return;

        html += `<div class="tier-group" data-tier="${tierId}">
            <h4>${group.name}</h4>`;

        group.items.forEach(l => {
            html += `
                <label class="location-option" data-search="${l.name.toLowerCase()}">
                    <input type="checkbox" value="${l.id}" data-name="${l.name}" data-tier="${l.tier}">
                    <span class="location-name">${l.name}</span>
                    <span class="location-meta">
                        <span class="tier-badge tier-${l.tier}">${l.defaultIR}%</span>
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
        const term = e.target.value.toLowerCase();
        const options = elements.locationDropdownPanel.querySelectorAll('.location-option');

        options.forEach(opt => {
            const match = opt.dataset.search.includes(term);
            opt.classList.toggle('hidden', !match);
        });

        // Hide empty groups
        elements.locationDropdownPanel.querySelectorAll('.tier-group').forEach(group => {
            const hasVisibleOptions = group.querySelectorAll('.location-option:not(.hidden)').length > 0;
            group.classList.toggle('hidden', !hasVisibleOptions);
        });
    });

    // Prevent closing when clicking search input
    searchInput.addEventListener('click', (e) => e.stopPropagation());

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

    updateCalculation();
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
            notes: 'Fallback data'
        };
    }

    if (suggestion) {
        currentLocationStats = suggestion; // Store for calculation

        elements.irSuggestion.innerHTML = `
            💡 IR suggest: <strong>${suggestion.defaultIR}%</strong>
            (range: ${suggestion.range.min}-${suggestion.range.max}%)
            ${suggestion.notes ? `<br><em>${suggestion.notes}</em>` : ''}
            ${suggestion.travelBuffer > 0 ? `<br><small>+${suggestion.travelBuffer} travel days</small>` : ''}
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
        fwStartDate: elements.fwStartDate?.value ? new Date(elements.fwStartDate.value) : null
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
        traffic: 1.0,
        quotaSkew: 1.0,
        qcBuffer: input.qcBuffer / 100,
        timing: 1.0
    };

    // 1. Panel Vendor Factor
    if (input.panelVendors && input.panelVendors.length > 0) {
        try {
            const vendorResult = await calculateVendorFactor(input.panelVendors);
            factors.traffic = vendorResult.factor;
            // Also adjust QC buffer if vendor has high default QC reject
            if (vendorResult.avgQcReject > input.qcBuffer / 100) {
                factors.qcBuffer = vendorResult.avgQcReject;
                elements.qcValue.textContent = Math.round(vendorResult.avgQcReject * 100);
            }
        } catch (e) {
            console.log('Vendor factor error, using default:', e.message);
        }
    }

    // 2. Quota Skew Factor (inverse - higher skew = slower = lower daily rate)
    const skewMultipliers = { balanced: 1.0, light_skew: 0.87, heavy_skew: 0.71 };
    factors.quotaSkew = skewMultipliers[input.quotaSkew] || 1.0;

    // 3. Timing Factor
    if (input.fwStartDate) {
        const timingResult = calculateTimingFactor(input.fwStartDate, 14); // Assume 14 days estimate
        factors.timing = timingResult.factor;
    }

    // Calculate adjusted daily rate
    const baseDaily = matchedCase.samplesPerDay;
    const adjustedDaily = baseDaily * factors.traffic * factors.quotaSkew * factors.timing;

    // Calculate required samples with QC buffer
    const requiredWithQC = Math.ceil(input.sampleSize * (1 + factors.qcBuffer));

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
    if (elements.factorTraffic) {
        elements.factorTraffic.textContent = `×${factors.traffic.toFixed(2)}`;
        elements.factorTraffic.className = factors.traffic >= 1 ? 'factor-value positive' : 'factor-value negative';
    }
    if (elements.factorQuota) {
        elements.factorQuota.textContent = `×${factors.quotaSkew.toFixed(2)}`;
        elements.factorQuota.className = factors.quotaSkew >= 1 ? 'factor-value' : 'factor-value negative';
    }
    if (elements.factorQC) {
        elements.factorQC.textContent = `+${Math.round(factors.qcBuffer * 100)}%`;
    }
    if (elements.factorTiming) {
        elements.factorTiming.textContent = `×${factors.timing.toFixed(2)}`;
        elements.factorTiming.className = factors.timing >= 0.95 ? 'factor-value' : 'factor-value negative';
    }
    if (elements.adjustedDaily) {
        elements.adjustedDaily.textContent = `~${Math.round(adjustedDaily)} samples/day`;
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

    const data = {
        projectName: input.projectName,
        mode: currentMode,
        input: {
            sampleSize: input.sampleSize,
            ir: input.ir,
            loi: input.loi,
            quota: input.quota,
            hardTarget: input.hardTarget,
            location: input.location
        },
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

        // Reload history
        await loadHistory();

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

    elements.historyList.innerHTML = history.map(item => {
        const date = item.createdAt instanceof Date
            ? item.createdAt.toLocaleDateString('vi-VN')
            : 'N/A';

        return `
            <div class="history-item">
                <div>
                    <div class="project-name">${item.projectName}</div>
                    <div class="date">${date}</div>
                </div>
                <div class="fw-days">${item.expertConclusion?.fwDays || '--'} ngày</div>
            </div>
        `;
    }).join('');
}

// ============ START ============
init();
