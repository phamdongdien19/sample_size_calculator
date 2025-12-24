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
    irValue: document.getElementById('irValue'),
    sampleSize: document.getElementById('sampleSize'),
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
    historyList: document.getElementById('historyList')
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

    let html = '';

    // Sort items within tiers by order or name?
    // Assuming locations are already sorted or irrelevant

    Object.keys(tiers).sort().forEach(tierId => {
        const group = tiers[tierId];
        if (group.items.length === 0) return;

        html += `<div class="tier-group">
            <h4>${group.name}</h4>`;

        group.items.forEach(l => {
            html += `
                <label class="location-option">
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

    elements.locationDropdownPanel.innerHTML = html;

    // Bind checkbox events
    elements.locationDropdownPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateLocationSelectionUI);
    });

    // Bind footer button
    const confirmBtn = elements.locationDropdownPanel.querySelector('#confirmLocationBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            // Check if we also have toggle function logic overlapping? 
            // The button just hides it.
            e.stopPropagation(); // prevent triggering parent listeners
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
        locations: getSelectedLocationIds()
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

    // Update UI
    elements.resDifficulty.textContent = matchedCase.difficulty;
    elements.resCaseName.textContent = `Case #${matchedCase.order} - ${matchedCase.name}`;
    elements.resDaily.textContent = `~${matchedCase.samplesPerDay}`;

    // Calculate FW days
    const fwDays = calculateFWDays(input.sampleSize, matchedCase.samplesPerDay);

    // Add travel buffer
    const buffer = currentLocationStats?.travelBuffer || 0;
    const min = Math.ceil(fwDays.min + buffer);
    const max = Math.ceil(fwDays.max + buffer);

    elements.resDays.textContent = `${min}-${max} ngày`;
    if (buffer > 0) {
        elements.resDays.textContent += ` (+${buffer} travel)`;
    }

    systemEstimate = { min: min, max: max };

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
