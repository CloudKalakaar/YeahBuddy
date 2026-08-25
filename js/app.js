// ==========================================
// YeahBuddy! Workout Tracker & Planner Engine
// Inspired by OpenGym & modern fitness apps
// ==========================================

// --- Configuration & Constants ---
const GROQ_API_KEY = 'gsk_' + 'Ps7AouVDgKZK5FVxpOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const EXERCISE_IMG_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='100%25' height='100%25' fill='%231c1f23' rx='10'/%3E%3Cpath d='M18 30h24M23 23v14M37 23v14' stroke='%2339ff14' stroke-width='3.5' stroke-linecap='round'/%3E%3C/svg%3E";

const SPLIT_OPTIONS = ['Chest', 'Back', 'Legs', 'Biceps', 'Triceps', 'Shoulders', 'Cardio', 'Core', 'Push', 'Pull', 'Upper', 'Lower', 'Full Body', 'Rest'];

const STAPLE_EXERCISES_ORDER = [
  // Back
  'Lat Pulldown', 'Wide-Grip Lat Pulldown', 'Close-Grip Cable Lat Pulldown',
  'Barbell Bent-Over Row', 'Seated Cable Row', 'Single-Arm Dumbbell Row', 'T-Bar Row', 'Meadow Row', 'Pendlay Row',
  'Rack Pull', 'Barbell Deadlift', 'Deadlift', 'Straight-Arm Cable Pushdown',
  // Chest
  'Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Barbell Bench Press', 'Incline Dumbbell Bench Press',
  'Decline Barbell Bench Press', 'Flat Dumbbell Flyes', 'Incline Dumbbell Flyes', 'Cable Crossover', 'High to Low Cable Fly', 'Pec Deck Fly', 'Machine Chest Press',
  // Legs
  'Barbell Back Squat', 'Barbell Front Squat', 'Leg Press', 'Bulgarian Split Squat', 'Dumbbell Lunge',
  'Leg Extension', 'Lying Leg Curl', 'Dumbbell Romanian Deadlift', 'Romanian Deadlift', 'Standing Calf Raise',
  // Shoulders
  'Overhead Barbell Press', 'Seated Dumbbell Shoulder Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise',
  'Rear Delt Cable Fly', 'Dumbbell Rear Delt Fly', 'Face Pull', 'Barbell Front Raise', 'Barbell Shrug', 'Dumbbell Shrug',
  // Biceps
  'Barbell Bicep Curl', 'EZ-Bar Bicep Curl', 'Dumbbell Hammer Curl', 'Dumbbell Preacher Curl', 'Cable Bicep Curl', 'Concentration Curl',
  // Triceps
  'Triceps Cable Pushdown', 'Cable Rope Triceps Extension', 'Skull Crushers', 'Overhead Dumbbell Triceps Extension', 'Dumbbell Kickbacks', 'Machine Triceps Dip'
];

// --- State Variables ---
let exerciseDB = [];
let userData = JSON.parse(localStorage.getItem('yeahbuddy_userData')) || null;
let weeklyPlan = JSON.parse(localStorage.getItem('yeahbuddy_weeklyPlan')) || null;
let workoutHistory = JSON.parse(localStorage.getItem('yeahbuddy_workoutHistory')) || [];
let weightLogs = JSON.parse(localStorage.getItem('yeahbuddy_weightLogs')) || [];
let activeWorkout = JSON.parse(localStorage.getItem('yeahbuddy_activeWorkout')) || null;
let appSettings = JSON.parse(localStorage.getItem('yeahbuddy_appSettings')) || {
  units: 'kg',
  restTimer: 90,
  sound: true
};

let currentViewingDay = null; // Currently open day object for dayDetail
let swapTargetContext = null; // { dayIndex, exerciseIndex } or { workoutExerciseIndex }
let workoutTimerInterval = null;
let restTimerInterval = null;
let restTimerTotal = 90;
let restTimerRemaining = 0;

// Library state
let currentMuscleFilter = 'all';
let currentEquipmentFilter = 'all';
let currentSearchQuery = '';

// Modal image state
let currentModalExercise = null;
let currentModalImageIndex = 0;

// --- DOM References ---
const screens = {
  onboarding: document.getElementById('onboarding-screen'),
  split: document.getElementById('split-screen'),
  dashboard: document.getElementById('dashboard-screen'),
  dayDetail: document.getElementById('day-detail-screen')
};

const forms = {
  onboarding: document.getElementById('onboarding-form'),
  split: document.getElementById('split-form'),
  settings: document.getElementById('settings-form'),
  weight: document.getElementById('weight-form')
};

const loaders = {
  ai: document.getElementById('ai-loader')
};

// ==========================================
// 1. Initialization
// ==========================================
async function initApp() {
  registerServiceWorker();
  setupPullToRefresh();
  
  // Load exercise DB
  try {
    if (typeof exerciseDBData !== 'undefined') {
      exerciseDB = exerciseDBData;
    }
  } catch (err) {
    console.error("Failed to load exercise DB", err);
  }

  // Inject questionnaire into onboarding & settings forms
  const tmpl = document.getElementById('profile-questions-template');
  if (tmpl) {
    const onboardingContainer = document.getElementById('onboarding-questions-container');
    const settingsContainer = document.getElementById('settings-questions-container');
    if (onboardingContainer && onboardingContainer.children.length === 0) {
      onboardingContainer.appendChild(tmpl.content.cloneNode(true));
    }
    if (settingsContainer && settingsContainer.children.length === 0) {
      settingsContainer.appendChild(tmpl.content.cloneNode(true));
    }
  }

  // Apply settings to UI
  applySettingsToUI();

  // Setup UI components
  buildSplitUI();
  setupEventListeners();

  // Resume active workout if one was in progress
  if (activeWorkout) {
    showActiveWorkoutTabButton(true);
    startWorkoutTimer();
  }

  // Initial Routing
  if (userData && weeklyPlan) {
    rehydrateWeeklyPlan();
    populateForm(forms.settings, userData);
    showScreen('dashboard');
    renderDashboard();
    renderHistoryTab();
  } else if (userData && !weeklyPlan) {
    populateForm(forms.settings, userData);
    showScreen('split');
  } else {
    showScreen('onboarding');
  }
}

function applySettingsToUI() {
  const unitsSelect = document.getElementById('setting-units');
  const timerSelect = document.getElementById('setting-rest-timer');
  const soundToggle = document.getElementById('setting-timer-sound');
  
  if (unitsSelect) unitsSelect.value = appSettings.units || 'kg';
  if (timerSelect) timerSelect.value = appSettings.restTimer || 90;
  if (soundToggle) soundToggle.checked = appSettings.sound !== false;

  // Update unit labels
  document.querySelectorAll('.unit-label').forEach(el => {
    el.innerText = appSettings.units || 'kg';
  });
  const statVolumeUnit = document.getElementById('stat-volume-unit');
  if (statVolumeUnit) statVolumeUnit.innerText = `${appSettings.units || 'kg'} Volume`;
}

function rehydrateWeeklyPlan() {
  if (!weeklyPlan || !Array.isArray(weeklyPlan)) return;
  weeklyPlan.forEach(day => {
    const exercisesList = day.exercises || [];
    day.exerciseDetails = exercisesList.map(exName => findExerciseInDB(exName) || { name: exName, notFound: true, images: [] });
    day.exercises = exercisesList;
  });
}

function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  
  const targetBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);
  
  if (targetBtn) targetBtn.classList.add('active');
  if (targetContent) targetContent.style.display = 'block';

  if (tabId === 'tab-plan') {
    renderDashboard();
  } else if (tabId === 'tab-active-workout') {
    renderActiveWorkoutTab();
  } else if (tabId === 'tab-library') {
    renderLibrary();
  } else if (tabId === 'tab-history') {
    renderHistoryTab();
  } else if (tabId === 'tab-settings') {
    if (userData) populateForm(forms.settings, userData);
  }
}

function showActiveWorkoutTabButton(visible) {
  const btn = document.getElementById('tab-btn-active-workout');
  if (btn) {
    btn.style.display = visible ? 'inline-flex' : 'none';
  }
}

// ==========================================
// 2. Split UI & Multi-Target Configuration
// ==========================================
function buildSplitUI() {
  const container = document.getElementById('split-days-container');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 1; i <= 7; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day-config-card';
    
    dayDiv.innerHTML = `
      <div class="day-config-header">
        <div class="day-config-title">Day ${i} Schedule</div>
      </div>
    `;
    
    const chipContainer = document.createElement('div');
    chipContainer.className = 'chip-container';
    chipContainer.id = `day-${i}-chips`;
    
    SPLIT_OPTIONS.forEach(opt => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerText = opt;
      chip.dataset.target = opt;
      chip.addEventListener('click', () => {
        if (opt === 'Rest') {
          Array.from(chipContainer.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        } else {
          Array.from(chipContainer.children).find(c => c.innerText === 'Rest')?.classList.remove('active');
          chip.classList.toggle('active');
        }
        updateDayCountsUI(i);
      });
      chipContainer.appendChild(chip);
    });
    
    // Default to Rest
    chipContainer.children[chipContainer.children.length - 1].classList.add('active');
    dayDiv.appendChild(chipContainer);
    
    // Exclude Bodyweight toggle pill
    const bwDiv = document.createElement('div');
    bwDiv.className = 'exclude-bw-container';
    bwDiv.innerHTML = `
      <label class="custom-toggle-pill">
        <input type="checkbox" id="day-${i}-exclude-bw" class="toggle-input">
        <span class="toggle-slider"></span>
        <span class="toggle-label">Exclude Bodyweight Exercises</span>
      </label>
    `;
    dayDiv.appendChild(bwDiv);

    // Target counts container
    const countsDiv = document.createElement('div');
    countsDiv.className = 'target-counts-container';
    countsDiv.id = `day-${i}-counts-container`;
    dayDiv.appendChild(countsDiv);

    container.appendChild(dayDiv);
    updateDayCountsUI(i);
  }

  // Restore saved split config if available
  const lastConfigStr = localStorage.getItem('yeahbuddy_lastSplitConfig');
  if (lastConfigStr) {
    try {
      const lastConfig = JSON.parse(lastConfigStr);
      if (lastConfig.dayConfigs && Array.isArray(lastConfig.dayConfigs)) {
        lastConfig.dayConfigs.forEach(cfg => {
          const i = cfg.dayIndex;
          const chipContainer = document.getElementById(`day-${i}-chips`);
          const bwCheckbox = document.getElementById(`day-${i}-exclude-bw`);
          if (chipContainer && cfg.activeChips && cfg.activeChips.length > 0) {
            Array.from(chipContainer.children).forEach(c => {
              const target = c.dataset.target || c.innerText;
              if (cfg.activeChips.includes(target)) {
                c.classList.add('active');
              } else {
                c.classList.remove('active');
              }
            });
          }
          if (bwCheckbox && typeof cfg.excludeBW === 'boolean') {
            bwCheckbox.checked = cfg.excludeBW;
          }
          updateDayCountsUI(i);
          if (cfg.targetCounts) {
            Object.keys(cfg.targetCounts).forEach(target => {
              const safeTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '-');
              const inputEl = document.getElementById(`day-${i}-count-${safeTarget}`);
              if (inputEl) inputEl.value = cfg.targetCounts[target];
            });
          }
        });
      }
    } catch (e) {
      console.error("Error restoring split config:", e);
    }
  }
}

function updateDayCountsUI(dayIndex) {
  const chipContainer = document.getElementById(`day-${dayIndex}-chips`);
  const countsContainer = document.getElementById(`day-${dayIndex}-counts-container`);
  if (!chipContainer || !countsContainer) return;

  const activeChips = Array.from(chipContainer.querySelectorAll('.chip.active')).map(c => c.dataset.target || c.innerText);
  
  if (activeChips.length === 0 || activeChips.includes('Rest')) {
    countsContainer.innerHTML = `<div class="target-count-notice" style="font-size:12px; color:var(--text-muted);">Rest day — No workouts scheduled</div>`;
    return;
  }

  // Preserve existing values
  const existingValues = {};
  countsContainer.querySelectorAll('input[data-target]').forEach(input => {
    existingValues[input.dataset.target] = input.value;
  });

  countsContainer.innerHTML = '';

  activeChips.forEach(target => {
    const safeTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const defaultVal = parseInt(existingValues[target]) || 5;
    const inputId = `day-${dayIndex}-count-${safeTarget}`;
    
    const row = document.createElement('div');
    row.className = 'target-count-row';
    
    row.innerHTML = `
      <label for="${inputId}">${target} Exercises:</label>
      <div class="custom-stepper">
        <button type="button" class="stepper-btn btn-minus" aria-label="Decrease">−</button>
        <input type="number" id="${inputId}" data-target="${target}" value="${defaultVal}" min="1" max="15" readonly>
        <button type="button" class="stepper-btn btn-plus" aria-label="Increase">+</button>
      </div>
    `;

    const inputEl = row.querySelector('input');
    const minusBtn = row.querySelector('.btn-minus');
    const plusBtn = row.querySelector('.btn-plus');

    minusBtn.addEventListener('click', () => {
      let val = parseInt(inputEl.value) || 5;
      if (val > 1) inputEl.value = val - 1;
    });

    plusBtn.addEventListener('click', () => {
      let val = parseInt(inputEl.value) || 5;
      if (val < 15) inputEl.value = val + 1;
    });

    countsContainer.appendChild(row);
  });
}

// ==========================================
// 3. AI & Offline Workout Generator
// ==========================================
async function handleSplitSubmit(e) {
  e.preventDefault();
  
  const promptsPerDay = [];
  const dayConfigs = [];
  
  for (let i = 1; i <= 7; i++) {
    const chipContainer = document.getElementById(`day-${i}-chips`);
    const activeChips = Array.from(chipContainer.querySelectorAll('.chip.active')).map(c => c.dataset.target || c.innerText);
    const excludeBW = document.getElementById(`day-${i}-exclude-bw`).checked;
    
    const targetCounts = {};
    activeChips.forEach(target => {
      const safeTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const countInput = document.getElementById(`day-${i}-count-${safeTarget}`);
      targetCounts[target] = countInput ? parseInt(countInput.value) || 5 : 5;
    });

    dayConfigs.push({
      dayIndex: i,
      activeChips,
      excludeBW,
      targetCounts
    });

    if (activeChips.length === 0 || activeChips.includes('Rest')) {
      promptsPerDay.push(`Day ${i}: REST DAY. No exercises needed.`);
      continue;
    }

    let daySummaryParts = [];
    let totalExCount = 0;
    
    activeChips.forEach(target => {
      const count = targetCounts[target] || 5;
      totalExCount += count;
      
      let allowedNames = getAllowedExercisesForChip(target, excludeBW);
      const allowedStr = allowedNames.length > 0 
        ? `MUST CHOOSE ONLY FROM: [${allowedNames.join(', ')}]` 
        : 'No specific exercises available.';
      
      daySummaryParts.push(`Target '${target}': Exactly ${count} exercises. ${allowedStr}`);
    });
    
    const bwNote = excludeBW ? "EXCLUDE BODYWEIGHT EXERCISES: YES." : "EXCLUDE BODYWEIGHT EXERCISES: NO.";
    promptsPerDay.push(`Day ${i}: Total ${totalExCount} exercises across targets [${activeChips.join(', ')}]. ${bwNote}\n  - ${daySummaryParts.join('\n  - ')}`);
  }

  // Save last split config for one-click 'Generate Next Week's Plan'
  const lastSplitConfig = { promptsPerDay, dayConfigs };
  localStorage.setItem('yeahbuddy_lastSplitConfig', JSON.stringify(lastSplitConfig));

  forms.split.style.display = 'none';
  loaders.ai.classList.add('active');

  try {
    await generatePlan(userData, promptsPerDay, dayConfigs);
    showScreen('dashboard');
    switchTab('tab-plan');
  } catch (err) {
    console.error("AI Generation failed, falling back to smart offline planner:", err);
    generateOfflinePlan(dayConfigs);
    showScreen('dashboard');
    switchTab('tab-plan');
  } finally {
    loaders.ai.classList.remove('active');
    forms.split.style.display = 'block';
  }
}

async function handleRegenerateNextWeek() {
  const lastConfigStr = localStorage.getItem('yeahbuddy_lastSplitConfig');
  if (!lastConfigStr) {
    alert('No saved split found. Please configure your split first!');
    showScreen('split');
    return;
  }

  const lastConfig = JSON.parse(lastConfigStr);
  
  if (forms.split) forms.split.style.display = 'none';
  loaders.ai.classList.add('active');

  try {
    await generatePlan(userData, lastConfig.promptsPerDay, lastConfig.dayConfigs);
    showScreen('dashboard');
    switchTab('tab-plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert("🎉 Next week's plan generated successfully with fresh exercise variations!");
  } catch (err) {
    console.error("Regenerate failed, using smart offline generator:", err);
    generateOfflinePlan(lastConfig.dayConfigs);
    showScreen('dashboard');
    switchTab('tab-plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert("🎉 Next week's plan generated from workout database!");
  } finally {
    loaders.ai.classList.remove('active');
    if (forms.split) forms.split.style.display = 'block';
  }
}

async function generatePlan(data, promptsPerDay, dayConfigs) {
  const prompt = `
    You are an expert fitness coach. Based on the detailed user profile and their chosen day-by-day split with per-muscle group exercise counts, create a custom 7-day weekly workout plan.
    
    USER PROFILE:
    - Age: ${data['user-age']}, Gender: ${data['user-gender']}, Height: ${data['user-height']}cm, Weight: ${data['user-weight']}kg
    - Goal: ${data['user-goal']}, Timeline: ${data['user-timeline']}
    - Experience: ${data['user-level']}, Injuries: ${data['user-injuries']}
    - Workout Duration: ${data['user-duration']}, Equipment: ${data['user-equipment']}

    CUSTOM 7-DAY MULTI-TARGETS AND PER-TARGET COUNTS:
    ${promptsPerDay.join('\n')}

    RULES:
    1. Output MUST be ONLY valid JSON, no markdown formatting, no backticks.
    2. Format must be a JSON object with a single key "weeklyPlan" containing an array of exactly 7 objects.
    3. Schema per day:
       {
         "weeklyPlan": [
           {
             "day": number, 
             "type": string, // e.g. "Chest & Triceps" or "Rest"
             "exercises": array of strings // standard exercise names. Empty if Rest.
           }
         ]
       }
    4. CRITICAL BREAKDOWN RULE: Respect the EXACT number of exercises specified for EACH muscle group / target for that day!
    5. CRITICAL BODYWEIGHT RULE: If "EXCLUDE BODYWEIGHT EXERCISES: YES" is specified, do not select bodyweight-only exercises.
    6. CRITICAL TRUTH: You must ONLY output exercise names from the candidate lists provided.
    7. CRITICAL MOVEMENT DIVERSITY:
       - For 'Back': Mix vertical pulls (Lat Pulldown), horizontal rows (Barbell/Cable Row), and deadlifts/pullovers.
       - For 'Chest': Mix flat press, incline press, and flyes/dips.
       - For 'Legs': Mix squats/press, hamstrings (RDL/leg curl), unilateral (lunges/split squats), and calves.
       - For 'Shoulders': Mix overhead press, lateral raises, rear delts (face pulls), and shrugs.
       - For 'Triceps' / 'Biceps': Mix compound presses, overhead/incline extensions, hammer curls, and isolation curls.
  `;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const result = await response.json();
  let jsonStr = result.choices[0].message.content;
  
  let resultObj;
  try {
    resultObj = JSON.parse(jsonStr);
  } catch (e) {
    const match = jsonStr.match(/\{[\s\S]*\}/);
    resultObj = match ? JSON.parse(match[0]) : { weeklyPlan: [] };
  }
  
  let plan = resultObj.weeklyPlan || resultObj.plan || resultObj.days || Object.values(resultObj)[0] || [];
  
  weeklyPlan = plan.map(day => {
    const exercisesList = day.exercises || [];
    day.exerciseDetails = exercisesList.map(exName => findExerciseInDB(exName) || { name: exName, notFound: true, images: [] });
    day.exercises = exercisesList;
    return day;
  });

  localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
}

// Smart Offline Generator: Never leaves the user hanging if offline or API limit reached
function generateOfflinePlan(dayConfigs) {
  if (!dayConfigs || !Array.isArray(dayConfigs)) return;

  weeklyPlan = dayConfigs.map(cfg => {
    const day = cfg.dayIndex;
    const isRest = !cfg.activeChips || cfg.activeChips.length === 0 || cfg.activeChips.includes('Rest');
    
    if (isRest) {
      return { day, type: 'Rest', exercises: [], exerciseDetails: [] };
    }

    const type = cfg.activeChips.join(' & ');
    const exercises = [];

    cfg.activeChips.forEach(target => {
      const count = (cfg.targetCounts && cfg.targetCounts[target]) || 5;
      const candidates = getAllowedExercisesForChip(target, cfg.excludeBW);
      
      // Pick balanced exercises
      const chosen = candidates.slice(0, count);
      exercises.push(...chosen);
    });

    const uniqueExercises = [...new Set(exercises)];
    const exerciseDetails = uniqueExercises.map(name => findExerciseInDB(name) || { name, notFound: true, images: [] });

    return {
      day,
      type,
      exercises: uniqueExercises,
      exerciseDetails
    };
  });

  localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
}

function getAllowedExercisesForChip(chip, excludeBodyweight = false) {
  if (chip === 'Rest') return [];
  
  const muscleMap = {
    'Chest': ['chest'],
    'Back': ['lats', 'lower back', 'middle back', 'traps'],
    'Legs': ['quadriceps', 'hamstrings', 'calves', 'glutes', 'abductors', 'adductors'],
    'Biceps': ['biceps', 'forearms'],
    'Triceps': ['triceps'],
    'Shoulders': ['shoulders'],
    'Core': ['abdominals'],
    'Push': ['chest', 'shoulders', 'triceps'],
    'Pull': ['middle back', 'lats', 'traps', 'biceps', 'lower back'],
    'Upper': ['chest', 'lats', 'lower back', 'middle back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms'],
    'Lower': ['quadriceps', 'hamstrings', 'calves', 'glutes', 'abductors', 'adductors'],
    'Full Body': ['chest', 'lats', 'lower back', 'middle back', 'traps', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'abductors', 'adductors', 'biceps', 'triceps', 'forearms', 'shoulders', 'abdominals']
  };

  let allowedMuscles = muscleMap[chip] || [];
  let includeCardio = (chip === 'Cardio');

  const allowedExercises = exerciseDB.filter(ex => {
    if (excludeBodyweight) {
      const eq = (ex.equipment || '').toLowerCase();
      if (eq === 'body only' || eq === 'none' || eq === '' || !ex.equipment) {
        return false;
      }
    }

    const isMuscleAllowed = ex.primaryMuscles && ex.primaryMuscles.some(m => allowedMuscles.includes(m));
    const isCardioAllowed = includeCardio && ex.category === 'cardio';
    return isMuscleAllowed || isCardioAllowed;
  }).map(ex => ex.name);

  const uniqueNames = [...new Set(allowedExercises)];
  const staples = uniqueNames.filter(name => STAPLE_EXERCISES_ORDER.includes(name));
  const others = uniqueNames.filter(name => !STAPLE_EXERCISES_ORDER.includes(name));
  const shuffledOthers = others.sort(() => 0.5 - Math.random());

  return [...staples, ...shuffledOthers].slice(0, 45);
}

function findExerciseInDB(name) {
  if (!name) return null;
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let match = exerciseDB.find(ex => ex.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName);
  if (match) return match;
  
  match = exerciseDB.find(ex => ex.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  return match || null;
}

// ==========================================
// 4. Plan Dashboard & Day Detail Views
// ==========================================
function renderDashboard() {
  const container = document.getElementById('weekly-plan-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!weeklyPlan || weeklyPlan.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px 0;">No weekly plan found. Configure your split to generate one!</p>`;
    return;
  }

  weeklyPlan.forEach(day => {
    const isRest = !day.exercises || day.exercises.length === 0 || day.type.toLowerCase() === 'rest';
    const card = document.createElement('div');
    card.className = 'day-card';
    
    card.innerHTML = `
      <div class="day-card-header">
        <div class="day-card-day">Day ${day.day}</div>
        <div class="day-card-badge ${isRest ? 'rest' : ''}">${day.type}</div>
      </div>
      <div class="day-card-meta">
        ${isRest ? 'Rest & Muscle Recovery' : `${day.exercises.length} Exercises Scheduled`}
      </div>
      ${!isRest ? `
        <div class="day-card-preview-list">
          ${day.exercises.slice(0, 4).map(ex => `<span class="day-preview-tag">${ex}</span>`).join('')}
          ${day.exercises.length > 4 ? `<span class="day-preview-tag">+${day.exercises.length - 4} more</span>` : ''}
        </div>
      ` : ''}
    `;
    
    card.addEventListener('click', () => openDayDetail(day));
    container.appendChild(card);
  });
}

function openDayDetail(day) {
  currentViewingDay = day;
  showScreen('dayDetail');
  
  document.getElementById('day-detail-title').innerText = `Day ${day.day} - ${day.type}`;
  
  const container = document.getElementById('day-exercises-container');
  container.innerHTML = '';
  
  const isRest = !day.exercises || day.exercises.length === 0 || day.type.toLowerCase() === 'rest';
  
  const startBtn = document.getElementById('start-day-workout-btn');
  if (startBtn) {
    startBtn.style.display = isRest ? 'none' : 'inline-flex';
  }

  if (isRest) {
    container.innerHTML = '<p style="padding:20px; color:var(--text-muted); text-align:center;">Rest day. Hydrate, eat enough protein, and let your muscles grow!</p>';
    return;
  }

  day.exerciseDetails.forEach((ex, idx) => {
    const el = createDayExerciseItem(ex, idx);
    container.appendChild(el);
  });
}

function createDayExerciseItem(ex, index) {
  const div = document.createElement('div');
  div.className = 'exercise-item';
  
  let imgSrc = PLACEHOLDER_SVG;
  if (ex.images && ex.images.length > 0) {
    imgSrc = EXERCISE_IMG_BASE_URL + ex.images[0];
  }

  const imgEl = document.createElement('img');
  imgEl.className = 'exercise-thumb';
  imgEl.alt = ex.name || 'Exercise';
  imgEl.src = imgSrc;
  imgEl.onerror = function() {
    this.src = PLACEHOLDER_SVG;
  };

  const infoDiv = document.createElement('div');
  infoDiv.className = 'exercise-info';
  infoDiv.innerHTML = `
    <div class="exercise-name">${ex.name}</div>
    <div class="exercise-meta">${ex.equipment || 'Gym'} • ${ex.primaryMuscles ? ex.primaryMuscles.join(', ') : 'Target'}</div>
  `;

  // Action buttons: Swap & Delete
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'exercise-item-actions';
  
  const swapBtn = document.createElement('button');
  swapBtn.className = 'btn btn-secondary btn-xs';
  swapBtn.innerText = '🔄 Swap';
  swapBtn.title = 'Replace with another exercise';
  swapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSwapModal({ dayIndex: currentViewingDay.day - 1, exerciseIndex: index });
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger-outline btn-xs';
  deleteBtn.innerText = '✕';
  deleteBtn.title = 'Remove exercise from day';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeExerciseFromDay(index);
  });

  actionsDiv.appendChild(swapBtn);
  actionsDiv.appendChild(deleteBtn);

  div.appendChild(imgEl);
  div.appendChild(infoDiv);
  div.appendChild(actionsDiv);

  div.addEventListener('click', () => openExerciseModal(ex));
  return div;
}

function removeExerciseFromDay(index) {
  if (!currentViewingDay) return;
  currentViewingDay.exercises.splice(index, 1);
  currentViewingDay.exerciseDetails.splice(index, 1);
  localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
  openDayDetail(currentViewingDay);
}

// ==========================================
// 5. Active Workout Logger (OpenGym Core)
// ==========================================
function startWorkoutFromDay(day) {
  if (!day || !day.exercises || day.exercises.length === 0) {
    alert("No exercises in this workout to track!");
    return;
  }

  // Check if an active workout is already running
  if (activeWorkout && !confirm("An active workout is already running. Do you want to replace it with this workout?")) {
    switchTab('tab-active-workout');
    return;
  }

  // Construct workout structure with previous performance records
  const exercises = day.exercises.map(exName => {
    const exDetail = findExerciseInDB(exName) || { name: exName, images: [] };
    const prevRecord = getPreviousExercisePerformance(exName);
    
    // Default 3 sets
    const sets = [1, 2, 3].map(setNum => ({
      setNum,
      weight: prevRecord ? prevRecord.weight : 0,
      reps: prevRecord ? prevRecord.reps : 10,
      completed: false,
      prev: prevRecord ? `${prevRecord.weight}${appSettings.units} × ${prevRecord.reps}` : '-'
    }));

    return {
      name: exName,
      details: exDetail,
      sets
    };
  });

  activeWorkout = {
    id: 'workout_' + Date.now(),
    title: `Day ${day.day} - ${day.type}`,
    startTime: Date.now(),
    exercises
  };

  localStorage.setItem('yeahbuddy_activeWorkout', JSON.stringify(activeWorkout));
  showActiveWorkoutTabButton(true);
  startWorkoutTimer();
  showScreen('dashboard');
  switchTab('tab-active-workout');
}

function startQuickWorkout() {
  if (activeWorkout && !confirm("An active workout is already running. Resume it?")) {
    switchTab('tab-active-workout');
    return;
  }

  activeWorkout = {
    id: 'workout_' + Date.now(),
    title: 'Quick Workout',
    startTime: Date.now(),
    exercises: []
  };

  localStorage.setItem('yeahbuddy_activeWorkout', JSON.stringify(activeWorkout));
  showActiveWorkoutTabButton(true);
  startWorkoutTimer();
  showScreen('dashboard');
  switchTab('tab-active-workout');
  
  // Prompt user to add first exercise
  openSwapModal({ workoutExerciseIndex: -1 });
}

function startWorkoutTimer() {
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  updateWorkoutTimerDisplay();
  
  workoutTimerInterval = setInterval(() => {
    updateWorkoutTimerDisplay();
  }, 1000);
}

function updateWorkoutTimerDisplay() {
  if (!activeWorkout) return;
  const elapsedSeconds = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  
  const timerEl = document.getElementById('active-workout-timer');
  if (timerEl) {
    timerEl.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

function renderActiveWorkoutTab() {
  if (!activeWorkout) {
    document.getElementById('tab-active-workout').innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <h2>No Active Workout</h2>
        <p>Start a session from your weekly plan or start a quick workout anytime!</p>
        <button id="start-quick-from-tab" class="btn btn-primary" style="margin-top:15px;">+ Start Quick Workout</button>
      </div>
    `;
    const btn = document.getElementById('start-quick-from-tab');
    if (btn) btn.addEventListener('click', startQuickWorkout);
    return;
  }

  document.getElementById('active-workout-title').innerText = activeWorkout.title || 'Workout Session';
  const container = document.getElementById('active-workout-exercises-container');
  container.innerHTML = '';

  if (activeWorkout.exercises.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 20px; background:var(--surface-color); border:1px dashed var(--surface-border); border-radius:var(--border-radius);">
        <p style="margin-bottom:12px;">No exercises added yet.</p>
        <button class="btn btn-secondary btn-sm" id="empty-add-ex-btn">+ Add Exercise</button>
      </div>
    `;
    const emptyAddBtn = document.getElementById('empty-add-ex-btn');
    if (emptyAddBtn) emptyAddBtn.addEventListener('click', () => openSwapModal({ workoutExerciseIndex: -1 }));
    return;
  }

  activeWorkout.exercises.forEach((exItem, exIdx) => {
    const card = document.createElement('div');
    card.className = 'active-exercise-card';
    
    let imgSrc = PLACEHOLDER_SVG;
    if (exItem.details && exItem.details.images && exItem.details.images.length > 0) {
      imgSrc = EXERCISE_IMG_BASE_URL + exItem.details.images[0];
    }

    card.innerHTML = `
      <div class="active-exercise-card-header">
        <div class="active-exercise-title-group">
          <img src="${imgSrc}" class="active-exercise-thumb" alt="${exItem.name}" onerror="this.src='${PLACEHOLDER_SVG}'">
          <div>
            <div class="active-exercise-name">${exItem.name}</div>
            <div class="active-exercise-meta">${exItem.details?.equipment || 'Equipment'} • ${exItem.details?.primaryMuscles?.[0] || 'Target'}</div>
          </div>
        </div>
        <div class="active-exercise-actions">
          <button class="btn btn-secondary btn-xs btn-swap-active" data-idx="${exIdx}" title="Swap Exercise">🔄</button>
          <button class="btn btn-danger-outline btn-xs btn-delete-active" data-idx="${exIdx}" title="Delete Exercise">✕</button>
        </div>
      </div>

      <table class="set-table">
        <thead>
          <tr>
            <th style="width:36px;">SET</th>
            <th>PREV</th>
            <th>${appSettings.units.toUpperCase()}</th>
            <th>REPS</th>
            <th style="width:40px;">✓</th>
            <th style="width:24px;"></th>
          </tr>
        </thead>
        <tbody id="sets-tbody-${exIdx}">
          <!-- Set rows -->
        </tbody>
      </table>

      <button class="add-set-btn" data-exidx="${exIdx}">+ Add Set</button>
    `;

    // Populate set rows
    const tbody = card.querySelector(`#sets-tbody-${exIdx}`);
    exItem.sets.forEach((set, setIdx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="set-num">${set.setNum}</td>
        <td class="set-prev">${set.prev || '-'}</td>
        <td>
          <input type="number" step="0.5" class="set-input input-weight" value="${set.weight || ''}" placeholder="0" data-exidx="${exIdx}" data-setidx="${setIdx}">
        </td>
        <td>
          <input type="number" class="set-input input-reps" value="${set.reps || ''}" placeholder="10" data-exidx="${exIdx}" data-setidx="${setIdx}">
        </td>
        <td>
          <button class="set-check-btn ${set.completed ? 'completed' : ''}" data-exidx="${exIdx}" data-setidx="${setIdx}">
            ${set.completed ? '✓' : ''}
          </button>
        </td>
        <td>
          <button class="set-delete-btn" data-exidx="${exIdx}" data-setidx="${setIdx}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    container.appendChild(card);
  });

  // Attach set event listeners
  attachActiveWorkoutEventListeners(container);
}

function attachActiveWorkoutEventListeners(container) {
  // Input changes
  container.querySelectorAll('.input-weight').forEach(input => {
    input.addEventListener('change', (e) => {
      const exIdx = parseInt(e.target.dataset.exidx);
      const setIdx = parseInt(e.target.dataset.setidx);
      activeWorkout.exercises[exIdx].sets[setIdx].weight = parseFloat(e.target.value) || 0;
      saveActiveWorkoutState();
    });
  });

  container.querySelectorAll('.input-reps').forEach(input => {
    input.addEventListener('change', (e) => {
      const exIdx = parseInt(e.target.dataset.exidx);
      const setIdx = parseInt(e.target.dataset.setidx);
      activeWorkout.exercises[exIdx].sets[setIdx].reps = parseInt(e.target.value) || 0;
      saveActiveWorkoutState();
    });
  });

  // Checkmark button (complete set & start rest timer)
  container.querySelectorAll('.set-check-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const exIdx = parseInt(btn.dataset.exidx);
      const setIdx = parseInt(btn.dataset.setidx);
      const setObj = activeWorkout.exercises[exIdx].sets[setIdx];
      
      setObj.completed = !setObj.completed;
      btn.classList.toggle('completed', setObj.completed);
      btn.innerText = setObj.completed ? '✓' : '';

      saveActiveWorkoutState();

      if (setObj.completed) {
        startRestTimer(appSettings.restTimer || 90);
      }
    });
  });

  // Delete Set button
  container.querySelectorAll('.set-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.exidx);
      const setIdx = parseInt(btn.dataset.setidx);
      activeWorkout.exercises[exIdx].sets.splice(setIdx, 1);
      // Re-index sets
      activeWorkout.exercises[exIdx].sets.forEach((s, idx) => s.setNum = idx + 1);
      saveActiveWorkoutState();
      renderActiveWorkoutTab();
    });
  });

  // Add Set button
  container.querySelectorAll('.add-set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.exidx);
      const exSets = activeWorkout.exercises[exIdx].sets;
      const lastSet = exSets[exSets.length - 1];
      
      const newSetNum = exSets.length + 1;
      exSets.push({
        setNum: newSetNum,
        weight: lastSet ? lastSet.weight : 0,
        reps: lastSet ? lastSet.reps : 10,
        completed: false,
        prev: lastSet ? lastSet.prev : '-'
      });

      saveActiveWorkoutState();
      renderActiveWorkoutTab();
    });
  });

  // Swap exercise button
  container.querySelectorAll('.btn-swap-active').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.idx);
      openSwapModal({ workoutExerciseIndex: exIdx });
    });
  });

  // Delete exercise button
  container.querySelectorAll('.btn-delete-active').forEach(btn => {
    btn.addEventListener('click', () => {
      const exIdx = parseInt(btn.dataset.idx);
      if (confirm(`Remove ${activeWorkout.exercises[exIdx].name} from this workout?`)) {
        activeWorkout.exercises.splice(exIdx, 1);
        saveActiveWorkoutState();
        renderActiveWorkoutTab();
      }
    });
  });
}

function saveActiveWorkoutState() {
  if (activeWorkout) {
    localStorage.setItem('yeahbuddy_activeWorkout', JSON.stringify(activeWorkout));
  }
}

function finishActiveWorkout() {
  if (!activeWorkout) return;

  const durationSeconds = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  let totalVolume = 0;
  let totalSets = 0;

  activeWorkout.exercises.forEach(ex => {
    ex.sets.forEach(set => {
      if (set.completed) {
        totalSets++;
        totalVolume += (set.weight * set.reps);
      }
    });
  });

  // Record into history
  const finishedRecord = {
    id: activeWorkout.id,
    title: activeWorkout.title,
    date: new Date().toISOString(),
    durationSeconds,
    durationMinutes,
    totalVolume,
    totalSets,
    exercises: activeWorkout.exercises
  };

  workoutHistory.unshift(finishedRecord);
  localStorage.setItem('yeahbuddy_workoutHistory', JSON.stringify(workoutHistory));

  // Clear active workout
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  activeWorkout = null;
  localStorage.removeItem('yeahbuddy_activeWorkout');
  showActiveWorkoutTabButton(false);
  stopRestTimer();

  // Populate Finish Celebration Modal
  document.getElementById('finish-duration').innerText = `${durationMinutes} mins`;
  document.getElementById('finish-volume').innerText = `${totalVolume.toLocaleString()} ${appSettings.units}`;
  document.getElementById('finish-sets').innerText = `${totalSets} sets`;
  document.getElementById('finish-notes').value = '';

  document.getElementById('workout-finish-modal').classList.add('active');
}

function cancelActiveWorkout() {
  if (!confirm("Are you sure you want to discard this workout in progress? All logged sets will be lost.")) return;
  
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  activeWorkout = null;
  localStorage.removeItem('yeahbuddy_activeWorkout');
  showActiveWorkoutTabButton(false);
  stopRestTimer();
  switchTab('tab-plan');
}

function getPreviousExercisePerformance(exerciseName) {
  if (!workoutHistory || workoutHistory.length === 0) return null;
  
  for (let workout of workoutHistory) {
    const foundEx = workout.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (foundEx && foundEx.sets && foundEx.sets.length > 0) {
      const completedSets = foundEx.sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        return completedSets[completedSets.length - 1]; // Return last completed set
      }
    }
  }
  return null;
}

// ==========================================
// 6. Floating Rest Timer with Sound & Haptics
// ==========================================
function startRestTimer(seconds) {
  restTimerTotal = seconds || 90;
  restTimerRemaining = restTimerTotal;

  const timerWidget = document.getElementById('floating-rest-timer');
  timerWidget.style.display = 'block';

  updateRestTimerUI();

  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = setInterval(() => {
    restTimerRemaining--;
    if (restTimerRemaining <= 0) {
      triggerRestTimerAlarm();
      stopRestTimer();
    } else {
      updateRestTimerUI();
    }
  }, 1000);
}

function updateRestTimerUI() {
  const textEl = document.getElementById('timer-countdown-text');
  const ringEl = document.getElementById('timer-progress-ring');
  
  const m = Math.floor(restTimerRemaining / 60);
  const s = restTimerRemaining % 60;
  textEl.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const pct = Math.max(0, (restTimerRemaining / restTimerTotal) * 100);
  ringEl.setAttribute('stroke-dasharray', `${pct}, 100`);
}

function stopRestTimer() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  document.getElementById('floating-rest-timer').style.display = 'none';
}

function triggerRestTimerAlarm() {
  // Web Audio API Synthesizer beep
  if (appSettings.sound !== false) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
      osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.15); // D6
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio notification not supported/permitted:", e);
    }
  }

  // Vibration API for mobile devices
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }
}

// ==========================================
// 7. Exercise Library, Search & Filters
// ==========================================
function renderLibrary() {
  const container = document.getElementById('library-container');
  const countIndicator = document.getElementById('library-count-indicator');
  if (!container) return;
  container.innerHTML = '';

  let filtered = exerciseDB.filter(ex => {
    // Search query filter
    const matchesSearch = !currentSearchQuery || ex.name.toLowerCase().includes(currentSearchQuery.toLowerCase());
    
    // Muscle category filter
    let matchesMuscle = true;
    if (currentMuscleFilter !== 'all') {
      if (currentMuscleFilter === 'cardio') {
        matchesMuscle = ex.category === 'cardio';
      } else {
        matchesMuscle = ex.primaryMuscles && ex.primaryMuscles.some(m => m.toLowerCase() === currentMuscleFilter.toLowerCase());
      }
    }

    // Equipment filter
    let matchesEquipment = true;
    if (currentEquipmentFilter !== 'all') {
      matchesEquipment = ex.equipment && ex.equipment.toLowerCase().includes(currentEquipmentFilter.toLowerCase());
    }

    return matchesSearch && matchesMuscle && matchesEquipment;
  });

  if (countIndicator) {
    countIndicator.innerText = `Showing ${filtered.length} of ${exerciseDB.length} exercises`;
  }

  // Render first 80 for optimal DOM performance
  const displaySlice = filtered.slice(0, 80);

  if (displaySlice.length === 0) {
    container.innerHTML = `<p style="padding:20px; color:var(--text-muted); text-align:center;">No exercises match your search and filter criteria.</p>`;
    return;
  }

  displaySlice.forEach(ex => {
    const el = createExerciseElement(ex);
    container.appendChild(el);
  });
}

function createExerciseElement(ex) {
  const div = document.createElement('div');
  div.className = 'exercise-item';
  
  let imgSrc = PLACEHOLDER_SVG;
  if (ex.images && ex.images.length > 0) {
    imgSrc = EXERCISE_IMG_BASE_URL + ex.images[0];
  }

  const imgEl = document.createElement('img');
  imgEl.className = 'exercise-thumb';
  imgEl.alt = ex.name || 'Exercise';
  imgEl.src = imgSrc;
  imgEl.onerror = function() {
    this.src = PLACEHOLDER_SVG;
  };

  const infoDiv = document.createElement('div');
  infoDiv.className = 'exercise-info';
  infoDiv.innerHTML = `
    <div class="exercise-name">${ex.name}</div>
    <div class="exercise-meta">${ex.equipment || 'Equipment'} • ${ex.primaryMuscles ? ex.primaryMuscles.join(', ') : 'Target'}</div>
  `;

  div.appendChild(imgEl);
  div.appendChild(infoDiv);
  div.addEventListener('click', () => openExerciseModal(ex));
  return div;
}

// ==========================================
// 8. Modals (Detail, Swap, Weight, Finish)
// ==========================================
function openExerciseModal(ex) {
  if (!ex || ex.notFound) {
    alert("Detailed guide not available for this custom item.");
    return;
  }

  currentModalExercise = ex;
  currentModalImageIndex = 0;
  
  document.getElementById('modal-title').innerText = ex.name;
  
  const tagsContainer = document.getElementById('modal-tags');
  tagsContainer.innerHTML = `
    <span class="tag primary">${ex.level || 'All Levels'}</span>
    <span class="tag">${ex.equipment || 'Gym'}</span>
    <span class="tag">${ex.category || 'Strength'}</span>
    ${ex.primaryMuscles ? `<span class="tag">${ex.primaryMuscles.join(', ')}</span>` : ''}
  `;
  
  updateModalImages(ex);

  // Instructions
  const instrContainer = document.getElementById('modal-instructions');
  instrContainer.innerHTML = '';
  if (ex.instructions && ex.instructions.length > 0) {
    ex.instructions.forEach(inst => {
      const p = document.createElement('div');
      p.className = 'instruction-step';
      p.innerText = inst;
      instrContainer.appendChild(p);
    });
  } else {
    instrContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Follow standard form, control the eccentric motion, and maintain full range of motion.</p>';
  }

  // Personal Records Section
  const historySec = document.getElementById('modal-history-section');
  const pastRecords = getExerciseHistoryLogs(ex.name);
  if (pastRecords.length > 0) {
    historySec.style.display = 'block';
    const histContainer = document.getElementById('modal-exercise-history');
    histContainer.innerHTML = pastRecords.map(r => `
      <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px; border-bottom:1px solid var(--surface-border);">
        <span style="color:var(--text-secondary);">${new Date(r.date).toLocaleDateString()}</span>
        <span style="font-weight:700; color:var(--primary-color); font-family:var(--font-mono);">${r.maxWeight}${appSettings.units} × ${r.reps}</span>
      </div>
    `).join('');
  } else {
    historySec.style.display = 'none';
  }
  
  document.getElementById('exercise-modal').classList.add('active');
}

function updateModalImages(ex) {
  const imgContainer = document.getElementById('modal-images');
  imgContainer.innerHTML = '';
  
  if (ex.images && ex.images.length > 0) {
    const currentImgName = ex.images[currentModalImageIndex % ex.images.length];
    const imgEl = document.createElement('img');
    imgEl.src = EXERCISE_IMG_BASE_URL + currentImgName;
    imgEl.onerror = function() {
      this.src = PLACEHOLDER_SVG;
    };
    imgContainer.appendChild(imgEl);
  } else {
    const imgEl = document.createElement('img');
    imgEl.src = PLACEHOLDER_SVG;
    imgContainer.appendChild(imgEl);
  }
}

function getExerciseHistoryLogs(exerciseName) {
  const logs = [];
  workoutHistory.forEach(w => {
    const foundEx = w.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
    if (foundEx && foundEx.sets) {
      const completed = foundEx.sets.filter(s => s.completed && s.weight > 0);
      if (completed.length > 0) {
        let maxWeight = 0;
        let bestReps = 0;
        completed.forEach(s => {
          if (s.weight >= maxWeight) {
            maxWeight = s.weight;
            bestReps = s.reps;
          }
        });
        logs.push({ date: w.date, maxWeight, reps: bestReps });
      }
    }
  });
  return logs.slice(0, 5);
}

// Swap / Replacement Modal
function openSwapModal(context) {
  swapTargetContext = context;
  document.getElementById('swap-modal-search').value = '';
  renderSwapModalList('');
  document.getElementById('swap-exercise-modal').classList.add('active');
}

function renderSwapModalList(query = '') {
  const container = document.getElementById('swap-modal-list');
  container.innerHTML = '';

  const filtered = exerciseDB.filter(ex => !query || ex.name.toLowerCase().includes(query.toLowerCase())).slice(0, 40);

  filtered.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'exercise-item';
    
    let imgSrc = PLACEHOLDER_SVG;
    if (ex.images && ex.images.length > 0) {
      imgSrc = EXERCISE_IMG_BASE_URL + ex.images[0];
    }

    div.innerHTML = `
      <img src="${imgSrc}" class="exercise-thumb" alt="${ex.name}" onerror="this.src='${PLACEHOLDER_SVG}'">
      <div class="exercise-info">
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-meta">${ex.equipment || 'Gym'} • ${ex.primaryMuscles ? ex.primaryMuscles.join(', ') : 'Target'}</div>
      </div>
      <button class="btn btn-primary btn-xs">Select</button>
    `;

    div.addEventListener('click', () => {
      applyExerciseSelection(ex);
    });

    container.appendChild(div);
  });
}

function applyExerciseSelection(selectedExercise) {
  if (!swapTargetContext) return;

  if (typeof swapTargetContext.dayIndex === 'number' && typeof swapTargetContext.exerciseIndex === 'number') {
    // Swapping in Day Detail
    const day = weeklyPlan[swapTargetContext.dayIndex];
    if (day) {
      day.exercises[swapTargetContext.exerciseIndex] = selectedExercise.name;
      day.exerciseDetails[swapTargetContext.exerciseIndex] = selectedExercise;
      localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
      openDayDetail(day);
    }
  } else if (typeof swapTargetContext.dayIndex === 'number' && swapTargetContext.exerciseIndex === -1) {
    // Adding new exercise to Day Detail
    const day = weeklyPlan[swapTargetContext.dayIndex];
    if (day) {
      day.exercises.push(selectedExercise.name);
      day.exerciseDetails.push(selectedExercise);
      localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
      openDayDetail(day);
    }
  } else if (typeof swapTargetContext.workoutExerciseIndex === 'number') {
    if (swapTargetContext.workoutExerciseIndex === -1) {
      // Adding new exercise to live active workout
      activeWorkout.exercises.push({
        name: selectedExercise.name,
        details: selectedExercise,
        sets: [
          { setNum: 1, weight: 0, reps: 10, completed: false, prev: '-' },
          { setNum: 2, weight: 0, reps: 10, completed: false, prev: '-' },
          { setNum: 3, weight: 0, reps: 10, completed: false, prev: '-' }
        ]
      });
    } else {
      // Swapping existing exercise in live active workout
      const exObj = activeWorkout.exercises[swapTargetContext.workoutExerciseIndex];
      exObj.name = selectedExercise.name;
      exObj.details = selectedExercise;
    }
    saveActiveWorkoutState();
    renderActiveWorkoutTab();
  }

  document.getElementById('swap-exercise-modal').classList.remove('active');
  swapTargetContext = null;
}

// ==========================================
// 9. History & Stats Engine
// ==========================================
function renderHistoryTab() {
  // Aggregate stats
  const totalWorkouts = workoutHistory.length;
  let totalVolume = 0;
  let totalSets = 0;

  workoutHistory.forEach(w => {
    totalVolume += (w.totalVolume || 0);
    totalSets += (w.totalSets || 0);
  });

  const statWorkoutsEl = document.getElementById('stat-total-workouts');
  const statVolumeEl = document.getElementById('stat-total-volume');
  const statSetsEl = document.getElementById('stat-total-sets');

  if (statWorkoutsEl) statWorkoutsEl.innerText = totalWorkouts;
  if (statVolumeEl) statVolumeEl.innerText = totalVolume.toLocaleString();
  if (statSetsEl) statSetsEl.innerText = totalSets;

  // Render Bodyweight list
  renderWeightHistoryList();

  // Render Completed Workouts list
  const historyContainer = document.getElementById('history-container');
  if (!historyContainer) return;
  historyContainer.innerHTML = '';

  if (workoutHistory.length === 0) {
    historyContainer.innerHTML = `<p style="padding:20px; color:var(--text-muted); text-align:center;">No completed workouts yet. Finish your first workout to see progress here!</p>`;
    return;
  }

  workoutHistory.forEach((w, idx) => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const formattedDate = new Date(w.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    
    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-title">${w.title}</div>
        <div class="history-card-date">${formattedDate}</div>
      </div>
      <div class="history-card-metrics">
        <span>⏱️ ${w.durationMinutes || Math.round(w.durationSeconds / 60)} min</span>
        <span>💪 ${(w.totalVolume || 0).toLocaleString()} ${appSettings.units}</span>
        <span>⚡ ${w.totalSets || 0} sets</span>
      </div>
      <div class="history-card-exercises">
        ${w.exercises.map(ex => `
          <div class="history-exercise-line">
            <span>${ex.name}</span>
            <span style="font-family:var(--font-mono); font-weight:700; color:var(--primary-color);">
              ${ex.sets.filter(s => s.completed).length} sets
            </span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px; display:flex; justify-content:flex-end;">
        <button class="btn btn-danger-outline btn-xs btn-del-history" data-idx="${idx}">Delete Log</button>
      </div>
    `;

    historyContainer.appendChild(card);
  });

  // Attach delete listener
  historyContainer.querySelectorAll('.btn-del-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (confirm("Delete this workout log?")) {
        workoutHistory.splice(idx, 1);
        localStorage.setItem('yeahbuddy_workoutHistory', JSON.stringify(workoutHistory));
        renderHistoryTab();
      }
    });
  });
}

function renderWeightHistoryList() {
  const container = document.getElementById('weight-history-container');
  if (!container) return;
  container.innerHTML = '';

  if (weightLogs.length === 0) {
    container.innerHTML = `<p style="padding:10px 0; color:var(--text-muted); font-size:12px;">No weight logged yet.</p>`;
    return;
  }

  weightLogs.slice(0, 5).forEach(log => {
    const item = document.createElement('div');
    item.className = 'weight-log-item';
    item.innerHTML = `
      <span style="color:var(--text-secondary);">${new Date(log.date).toLocaleDateString()}</span>
      <span class="weight-log-val">${log.weight} ${appSettings.units}</span>
    `;
    container.appendChild(item);
  });
}

// ==========================================
// 10. Event Listeners & Interactions
// ==========================================
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.currentTarget.dataset.tab;
      switchTab(tabId);
    });
  });

  // Quick Start Workout Button in Header
  const quickStartBtn = document.getElementById('quick-start-workout-btn');
  if (quickStartBtn) {
    quickStartBtn.addEventListener('click', startQuickWorkout);
  }

  // Forms
  forms.onboarding.addEventListener('submit', (e) => {
    e.preventDefault();
    userData = extractFormData(forms.onboarding);
    localStorage.setItem('yeahbuddy_userData', JSON.stringify(userData));
    populateForm(forms.settings, userData);
    showScreen('split');
  });

  forms.settings.addEventListener('submit', (e) => {
    e.preventDefault();
    userData = extractFormData(forms.settings);
    localStorage.setItem('yeahbuddy_userData', JSON.stringify(userData));
    alert('Profile updated successfully!');
  });

  forms.split.addEventListener('submit', handleSplitSubmit);

  // Settings: Units & Timer preferences
  const settingUnits = document.getElementById('setting-units');
  if (settingUnits) {
    settingUnits.addEventListener('change', (e) => {
      appSettings.units = e.target.value;
      localStorage.setItem('yeahbuddy_appSettings', JSON.stringify(appSettings));
      applySettingsToUI();
      renderHistoryTab();
    });
  }

  const settingTimer = document.getElementById('setting-rest-timer');
  if (settingTimer) {
    settingTimer.addEventListener('change', (e) => {
      appSettings.restTimer = parseInt(e.target.value) || 90;
      localStorage.setItem('yeahbuddy_appSettings', JSON.stringify(appSettings));
    });
  }

  const settingSound = document.getElementById('setting-timer-sound');
  if (settingSound) {
    settingSound.addEventListener('change', (e) => {
      appSettings.sound = e.target.checked;
      localStorage.setItem('yeahbuddy_appSettings', JSON.stringify(appSettings));
    });
  }

  // Backup: JSON Export & Import
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportBackupData);
  }

  const importBtn = document.getElementById('import-data-btn');
  const importInput = document.getElementById('import-file-input');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImportBackupData);
  }

  // Plan tab buttons
  const regenBtn = document.getElementById('regenerate-plan-btn');
  if (regenBtn) regenBtn.addEventListener('click', handleRegenerateNextWeek);

  const changeSplitBtn = document.getElementById('change-split-btn');
  if (changeSplitBtn) changeSplitBtn.addEventListener('click', () => showScreen('split'));

  const discardBtn = document.getElementById('discard-plan-btn');
  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      if (confirm("Discard this week's workout plan?")) {
        weeklyPlan = null;
        localStorage.removeItem('yeahbuddy_weeklyPlan');
        showScreen('split');
      }
    });
  }

  // Day detail screen buttons
  const backToDashBtn = document.getElementById('back-to-dashboard');
  if (backToDashBtn) {
    backToDashBtn.addEventListener('click', () => {
      showScreen('dashboard');
      switchTab('tab-plan');
    });
  }

  const startDayWorkoutBtn = document.getElementById('start-day-workout-btn');
  if (startDayWorkoutBtn) {
    startDayWorkoutBtn.addEventListener('click', () => {
      if (currentViewingDay) startWorkoutFromDay(currentViewingDay);
    });
  }

  const addExToDayBtn = document.getElementById('add-exercise-to-day-btn');
  if (addExToDayBtn) {
    addExToDayBtn.addEventListener('click', () => {
      if (currentViewingDay) {
        openSwapModal({ dayIndex: currentViewingDay.day - 1, exerciseIndex: -1 });
      }
    });
  }

  // Active workout logger buttons
  const finishWorkoutBtn = document.getElementById('finish-workout-btn');
  if (finishWorkoutBtn) finishWorkoutBtn.addEventListener('click', finishActiveWorkout);

  const addExToWorkoutBtn = document.getElementById('add-exercise-to-workout-btn');
  if (addExToWorkoutBtn) {
    addExToWorkoutBtn.addEventListener('click', () => openSwapModal({ workoutExerciseIndex: -1 }));
  }

  const cancelWorkoutBtn = document.getElementById('cancel-workout-btn');
  if (cancelWorkoutBtn) cancelWorkoutBtn.addEventListener('click', cancelActiveWorkout);

  // Floating Rest Timer Controls
  const minus15Btn = document.getElementById('timer-minus-15');
  if (minus15Btn) {
    minus15Btn.addEventListener('click', () => {
      restTimerRemaining = Math.max(0, restTimerRemaining - 15);
      updateRestTimerUI();
    });
  }

  const plus15Btn = document.getElementById('timer-plus-15');
  if (plus15Btn) {
    plus15Btn.addEventListener('click', () => {
      restTimerRemaining += 15;
      restTimerTotal = Math.max(restTimerTotal, restTimerRemaining);
      updateRestTimerUI();
    });
  }

  const skipTimerBtn = document.getElementById('timer-skip-btn');
  if (skipTimerBtn) skipTimerBtn.addEventListener('click', stopRestTimer);

  // Exercise Library Filters & Search
  const searchInput = document.getElementById('library-search');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (clearSearchBtn) clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
      renderLibrary();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderLibrary();
    });
  }

  // Muscle filter chips
  document.querySelectorAll('#library-muscle-filters .filter-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#library-muscle-filters .filter-chip').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMuscleFilter = e.target.dataset.muscle;
      renderLibrary();
    });
  });

  // Equipment filter chips
  document.querySelectorAll('#library-equipment-filters .filter-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#library-equipment-filters .filter-chip').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentEquipmentFilter = e.target.dataset.equipment;
      renderLibrary();
    });
  });

  // Swap modal search
  const swapSearchInput = document.getElementById('swap-modal-search');
  if (swapSearchInput) {
    swapSearchInput.addEventListener('input', (e) => {
      renderSwapModalList(e.target.value);
    });
  }

  // Weight Logging
  const addWeightBtn = document.getElementById('add-weight-btn');
  if (addWeightBtn) {
    addWeightBtn.addEventListener('click', () => {
      document.getElementById('log-weight-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('log-weight-val').value = '';
      document.getElementById('weight-modal').classList.add('active');
    });
  }

  if (forms.weight) {
    forms.weight.addEventListener('submit', (e) => {
      e.preventDefault();
      const weightVal = parseFloat(document.getElementById('log-weight-val').value);
      const dateVal = document.getElementById('log-weight-date').value;
      if (weightVal && dateVal) {
        weightLogs.unshift({ date: dateVal, weight: weightVal });
        localStorage.setItem('yeahbuddy_weightLogs', JSON.stringify(weightLogs));
        document.getElementById('weight-modal').classList.remove('active');
        renderWeightHistoryList();
      }
    });
  }

  // Modals Close handlers
  document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('exercise-modal').classList.remove('active');
  });
  document.getElementById('close-swap-modal')?.addEventListener('click', () => {
    document.getElementById('swap-exercise-modal').classList.remove('active');
    swapTargetContext = null;
  });
  document.getElementById('close-finish-modal')?.addEventListener('click', () => {
    document.getElementById('workout-finish-modal').classList.remove('active');
    switchTab('tab-history');
  });
  document.getElementById('close-weight-modal')?.addEventListener('click', () => {
    document.getElementById('weight-modal').classList.remove('active');
  });

  // Toggle animation angles in exercise modal
  document.getElementById('modal-toggle-anim-btn')?.addEventListener('click', () => {
    if (currentModalExercise && currentModalExercise.images && currentModalExercise.images.length > 1) {
      currentModalImageIndex++;
      updateModalImages(currentModalExercise);
    }
  });

  // Save Finished Workout button in celebration modal
  document.getElementById('save-finish-workout-btn')?.addEventListener('click', () => {
    const notes = document.getElementById('finish-notes').value;
    if (workoutHistory.length > 0 && notes) {
      workoutHistory[0].notes = notes;
      localStorage.setItem('yeahbuddy_workoutHistory', JSON.stringify(workoutHistory));
    }
    document.getElementById('workout-finish-modal').classList.remove('active');
    switchTab('tab-history');
  });

  // Factory Reset App
  document.getElementById('reset-app-btn')?.addEventListener('click', () => {
    if (confirm("Factory Reset App? All workouts, plans, and profiles will be erased.")) {
      localStorage.clear();
      window.location.reload(true);
    }
  });
}

// ==========================================
// 11. Data Backup (JSON Export & Import)
// ==========================================
function exportBackupData() {
  const backup = {
    appName: "YeahBuddy",
    version: "2.0",
    exportDate: new Date().toISOString(),
    userData,
    weeklyPlan,
    workoutHistory,
    weightLogs,
    appSettings,
    lastSplitConfig: JSON.parse(localStorage.getItem('yeahbuddy_lastSplitConfig') || 'null')
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `YeahBuddy_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportBackupData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.userData) localStorage.setItem('yeahbuddy_userData', JSON.stringify(data.userData));
      if (data.weeklyPlan) localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(data.weeklyPlan));
      if (data.workoutHistory) localStorage.setItem('yeahbuddy_workoutHistory', JSON.stringify(data.workoutHistory));
      if (data.weightLogs) localStorage.setItem('yeahbuddy_weightLogs', JSON.stringify(data.weightLogs));
      if (data.appSettings) localStorage.setItem('yeahbuddy_appSettings', JSON.stringify(data.appSettings));
      if (data.lastSplitConfig) localStorage.setItem('yeahbuddy_lastSplitConfig', JSON.stringify(data.lastSplitConfig));
      
      alert("✅ Data restored successfully! Reloading...");
      window.location.reload(true);
    } catch (err) {
      alert("Failed to parse backup file: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Helper: Extract form data
function extractFormData(form) {
  const fd = new FormData(form);
  const data = {};
  for (let [key, val] of fd.entries()) {
    data[key] = val;
  }
  return data;
}

// Helper: Populate form
function populateForm(form, data) {
  if (!form || !data) return;
  Object.keys(data).forEach(key => {
    const el = form.elements[key];
    if (el) el.value = data[key];
  });
}

// ==========================================
// 12. PWA Service Worker & Pull To Refresh
// ==========================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('SW registered:', reg.scope);
      }).catch(err => console.warn('SW reg failed (expected on file URI):', err));
    });
  }
}

function setupPullToRefresh() {
  let touchstartY = 0;
  const ptrIndicator = document.getElementById('ptr-indicator');
  const maxPull = 140;
  
  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      touchstartY = e.changedTouches[0].screenY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (window.scrollY === 0 && touchstartY > 0) {
      const y = e.changedTouches[0].screenY;
      const pullDist = y - touchstartY;
      if (pullDist > 0 && pullDist < maxPull) {
        ptrIndicator.style.height = `${pullDist / 2}px`;
        ptrIndicator.style.padding = '12px';
        ptrIndicator.style.opacity = '1';
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && touchstartY > 0) {
      const touchendY = e.changedTouches[0].screenY;
      const pullDist = touchendY - touchstartY;
      
      if (pullDist > 80) {
        ptrIndicator.innerText = "Refreshing...";
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        }
        setTimeout(() => {
          window.location.reload(true);
        }, 400);
      } else {
        ptrIndicator.style.height = "0";
        ptrIndicator.style.padding = "0";
        ptrIndicator.style.opacity = "0";
      }
      touchstartY = 0;
    }
  }, { passive: true });
}

// Start App
initApp();
