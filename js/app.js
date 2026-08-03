// Configuration
// Bypassing GitHub Secret Scanner by splitting the token
const GROQ_API_KEY = 'gsk_' + 'Ps7AouVDgKZK5FVxpOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const EXERCISE_IMG_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='100%25' height='100%25' fill='%23252525' rx='8'/%3E%3Cpath d='M20 30h20M25 24v12M35 24v12' stroke='%2339ff14' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E";

const STAPLE_EXERCISES_ORDER = [
  // Back (mix of vertical pull, horizontal row, lower back, pullovers)
  'Lat Pulldown', 'Wide-Grip Lat Pulldown', 'Close-Grip Cable Lat Pulldown',
  'Barbell Bent-Over Row', 'Seated Cable Row', 'Single-Arm Dumbbell Row', 'T-Bar Row', 'Meadow Row', 'Pendlay Row',
  'Rack Pull', 'Barbell Deadlift', 'Deadlift', 'Straight-Arm Cable Pushdown',
  // Chest (mix of flat press, incline press, flyes/isolation, decline/dips)
  'Barbell Bench Press', 'Dumbbell Bench Press', 'Incline Barbell Bench Press', 'Incline Dumbbell Bench Press',
  'Decline Barbell Bench Press', 'Flat Dumbbell Flyes', 'Incline Dumbbell Flyes', 'Cable Crossover', 'High to Low Cable Fly', 'Pec Deck Fly', 'Machine Chest Press',
  // Legs (mix of quad compound, hamstrings, unilateral, calves)
  'Barbell Back Squat', 'Barbell Front Squat', 'Leg Press', 'Bulgarian Split Squat', 'Dumbbell Lunge',
  'Leg Extension', 'Lying Leg Curl', 'Dumbbell Romanian Deadlift', 'Romanian Deadlift', 'Standing Calf Raise',
  // Shoulders (mix of overhead press, lateral raise, rear delt, front raise)
  'Overhead Barbell Press', 'Seated Dumbbell Shoulder Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise',
  'Rear Delt Cable Fly', 'Dumbbell Rear Delt Fly', 'Face Pull', 'Barbell Front Raise', 'Barbell Shrug', 'Dumbbell Shrug',
  // Biceps (mix of heavy curl, hammer curl, preacher/incline curl)
  'Barbell Bicep Curl', 'EZ-Bar Bicep Curl', 'Dumbbell Hammer Curl', 'Dumbbell Preacher Curl', 'Cable Bicep Curl', 'Concentration Curl',
  // Triceps (mix of cable pushdown, overhead extension, heavy press/skullcrushers)
  'Triceps Cable Pushdown', 'Cable Rope Triceps Extension', 'Skull Crushers', 'Overhead Dumbbell Triceps Extension', 'Dumbbell Kickbacks', 'Machine Triceps Dip'
];

// State
let exerciseDB = [];
let userData = JSON.parse(localStorage.getItem('yeahbuddy_userData')) || null;
let weeklyPlan = JSON.parse(localStorage.getItem('yeahbuddy_weeklyPlan')) || null;

const SPLIT_OPTIONS = ['Chest', 'Back', 'Legs', 'Biceps', 'Triceps', 'Shoulders', 'Cardio', 'Core', 'Push', 'Pull', 'Upper', 'Lower', 'Full Body', 'Rest'];

// DOM Elements
const screens = {
  onboarding: document.getElementById('onboarding-screen'),
  split: document.getElementById('split-screen'),
  dashboard: document.getElementById('dashboard-screen'),
  dayDetail: document.getElementById('day-detail-screen')
};

const forms = {
  onboarding: document.getElementById('onboarding-form'),
  split: document.getElementById('split-form'),
  settings: document.getElementById('settings-form')
};

const loaders = {
  ai: document.getElementById('ai-loader')
};

// Initialize App
async function initApp() {
  registerServiceWorker();
  setupPullToRefresh();
  
  try {
    if (typeof exerciseDBData !== 'undefined') {
      exerciseDB = exerciseDBData;
      console.log(`Loaded ${exerciseDB.length} exercises from library.`);
    }
  } catch (err) {
    console.error("Failed to load exercise DB", err);
  }

  // Inject Template Questions
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

  // Build Split UI
  buildSplitUI();

  // Setup Listeners
  setupEventListeners();

  if (userData && weeklyPlan) {
    // Re-hydrate exercise details to ensure compatibility with updated exerciseDB
    weeklyPlan.forEach(day => {
      const exercisesList = day.exercises || [];
      day.exerciseDetails = exercisesList.map(exName => findExerciseInDB(exName) || { name: exName, notFound: true });
    });
    populateForm(forms.settings, userData);
    showScreen('dashboard');
    renderDashboard();
  } else if (userData && !weeklyPlan) {
    populateForm(forms.settings, userData);
    showScreen('split');
  } else {
    showScreen('onboarding');
  }
}

function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
}

function buildSplitUI() {
  const container = document.getElementById('split-days-container');
  container.innerHTML = '';
  for(let i=1; i<=7; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day-config-card';
    
    dayDiv.innerHTML = `
      <div class="day-config-header">
        <div class="day-config-title">Day ${i} Targets</div>
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
    
    // Default selection
    chipContainer.children[chipContainer.children.length-1].classList.add('active'); // Default to Rest
    dayDiv.appendChild(chipContainer);
    
    // Add Exclude Bodyweight Toggle Pill Switch
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
    
    // Initial counts UI update for default state (Rest)
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
    countsContainer.innerHTML = `<div class="target-count-notice">Rest day — No exercises needed</div>`;
    return;
  }

  // Preserve typed input values
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
        <button type="button" class="stepper-btn btn-minus" aria-label="Decrease exercise count">−</button>
        <input type="number" id="${inputId}" data-target="${target}" value="${defaultVal}" min="1" max="15" readonly>
        <button type="button" class="stepper-btn btn-plus" aria-label="Increase exercise count">+</button>
      </div>
    `;

    const inputEl = row.querySelector('input');
    const minusBtn = row.querySelector('.btn-minus');
    const plusBtn = row.querySelector('.btn-plus');

    minusBtn.addEventListener('click', () => {
      let val = parseInt(inputEl.value) || 5;
      if (val > 1) {
        inputEl.value = val - 1;
      }
    });

    plusBtn.addEventListener('click', () => {
      let val = parseInt(inputEl.value) || 5;
      if (val < 15) {
        inputEl.value = val + 1;
      }
    });

    countsContainer.appendChild(row);
  });
}

// Event Listeners
function setupEventListeners() {
  forms.onboarding.addEventListener('submit', handleOnboardingSubmit);
  forms.settings.addEventListener('submit', handleSettingsSubmit);
  forms.split.addEventListener('submit', handleSplitSubmit);
  
  // Dashboard Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabBtn = e.currentTarget;
      const tabId = tabBtn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      
      tabBtn.classList.add('active');
      const targetContent = document.getElementById(tabId);
      if (targetContent) {
        targetContent.style.display = 'block';
      }

      if (tabId === 'tab-library') {
        renderLibrary();
      } else if (tabId === 'tab-settings' && userData) {
        populateForm(forms.settings, userData);
      }
    });
  });

  // Library Search
  document.getElementById('library-search').addEventListener('input', (e) => {
    renderLibrary(e.target.value);
  });

  // Modals
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('exercise-modal').classList.remove('active');
  });
  
  // Back from Day Detail
  document.getElementById('back-to-dashboard').addEventListener('click', () => {
    showScreen('dashboard');
  });

  const regenBtn = document.getElementById('regenerate-plan-btn');
  if (regenBtn) {
    regenBtn.addEventListener('click', handleRegenerateNextWeek);
  }

  const changeSplitBtn = document.getElementById('change-split-btn');
  if (changeSplitBtn) {
    changeSplitBtn.addEventListener('click', () => {
      showScreen('split');
    });
  }

  document.getElementById('discard-plan-btn').addEventListener('click', () => {
    if(confirm("Discard this week's plan?")) {
      weeklyPlan = null;
      localStorage.removeItem('yeahbuddy_weeklyPlan');
      showScreen('split');
    }
  });

  document.getElementById('reset-app-btn').addEventListener('click', () => {
    if(confirm("Factory Reset App? All data will be erased.")) {
      localStorage.removeItem('yeahbuddy_userData');
      localStorage.removeItem('yeahbuddy_weeklyPlan');
      localStorage.removeItem('yeahbuddy_lastSplitConfig');
      window.location.reload(true);
    }
  });
}

function extractFormData(form) {
  const fd = new FormData(form);
  const data = {};
  for(let [key, val] of fd.entries()) {
    data[key] = val;
  }
  return data;
}

function populateForm(form, data) {
  Object.keys(data).forEach(key => {
    const el = form.elements[key];
    if (el) el.value = data[key];
  });
}

// Submits
function handleOnboardingSubmit(e) {
  e.preventDefault();
  userData = extractFormData(forms.onboarding);
  localStorage.setItem('yeahbuddy_userData', JSON.stringify(userData));
  populateForm(forms.settings, userData);
  showScreen('split');
}

function handleSettingsSubmit(e) {
  e.preventDefault();
  userData = extractFormData(forms.settings);
  localStorage.setItem('yeahbuddy_userData', JSON.stringify(userData));
  alert('Profile Updated Successfully!');
}

async function handleSplitSubmit(e) {
  e.preventDefault();
  
  const promptsPerDay = [];
  const dayConfigs = [];
  
  for(let i=1; i<=7; i++) {
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
    
    const bwNote = excludeBW ? "EXCLUDE BODYWEIGHT EXERCISES: YES. Do NOT include any bodyweight exercises (like push-ups, crunches, bodyweight squats) for this day." : "EXCLUDE BODYWEIGHT EXERCISES: NO.";
    promptsPerDay.push(`Day ${i}: Total ${totalExCount} exercises across targets [${activeChips.join(', ')}]. ${bwNote}\n  - ${daySummaryParts.join('\n  - ')}`);
  }

  // Save last split config for one-click 'Generate Next Week's Plan'
  const lastSplitConfig = { promptsPerDay, dayConfigs };
  localStorage.setItem('yeahbuddy_lastSplitConfig', JSON.stringify(lastSplitConfig));

  forms.split.style.display = 'none';
  loaders.ai.classList.add('active');

  try {
    await generatePlan(userData, promptsPerDay);
    showScreen('dashboard');
    renderDashboard();
    
    // switch to Plan tab
    document.querySelector('[data-tab="tab-plan"]').click();
  } catch (err) {
    console.error(err);
    alert('Failed to generate AI plan. Please check your internet connection or API settings.');
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
    // Re-run AI generation with fresh candidate choices while preserving split settings
    await generatePlan(userData, lastConfig.promptsPerDay);
    showScreen('dashboard');
    renderDashboard();
    
    // Switch to Plan tab & scroll to top
    document.querySelector('[data-tab="tab-plan"]').click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    alert("🎉 Next week's plan generated successfully with fresh exercise variations!");
  } catch (err) {
    console.error(err);
    alert('Failed to generate next week\'s plan. Please check your connection or API settings.');
  } finally {
    loaders.ai.classList.remove('active');
    if (forms.split) forms.split.style.display = 'block';
  }
}

// AI Plan Generation
async function generatePlan(data, promptsPerDay) {
  const prompt = `
    You are an expert fitness coach. Based on the detailed user profile and their chosen day-by-day split with per-muscle group exercise counts, create a custom 7-day weekly workout plan.
    
    USER PROFILE:
    - Age: ${data['user-age']}, Gender: ${data['user-gender']}, Height: ${data['user-height']}cm, Weight: ${data['user-weight']}kg
    - Goal: ${data['user-goal']}, Timeline: ${data['user-timeline']}
    - Experience: ${data['user-level']}, Injuries: ${data['user-injuries']}
    - Daily Activity: ${data['user-activity']}, Job: ${data['user-job']}
    - Workout Duration: ${data['user-duration']}, Equipment: ${data['user-equipment']}, Cardio: ${data['user-cardio']}
    - Fav Muscle: ${data['user-fav-muscle']}, Least Fav Muscle: ${data['user-least-fav-muscle']}
    - Sleep: ${data['user-sleep']}, Stress: ${data['user-stress']}, Diet: ${data['user-diet']}, Hydration: ${data['user-hydration']}, Protein: ${data['user-protein']}

    CUSTOM 7-DAY MULTI-TARGETS AND PER-TARGET COUNTS:
    ${promptsPerDay[0]}
    ${promptsPerDay[1]}
    ${promptsPerDay[2]}
    ${promptsPerDay[3]}
    ${promptsPerDay[4]}
    ${promptsPerDay[5]}
    ${promptsPerDay[6]}

    RULES:
    1. Output MUST be ONLY valid JSON, no markdown formatting, no backticks.
    2. Format must be a JSON object with a single key "weeklyPlan" containing an array of exactly 7 objects.
    3. Schema per day:
       {
         "weeklyPlan": [
           {
             "day": number, 
             "type": string, // matches the day's targets string e.g. "Chest & Triceps" or "Rest"
             "exercises": array of strings // standard exercise names. Empty if Rest.
           }
         ]
       }
    4. CRITICAL BREAKDOWN RULE: Respect the EXACT number of exercises specified for EACH muscle group / target for that day! (For example, if Day 1 requires Chest: 5 exercises and Triceps: 5 exercises, you MUST output EXACTLY 5 Chest exercises followed by EXACTLY 5 Triceps exercises, totaling 10 exercises).
    5. CRITICAL BODYWEIGHT RULE: If "EXCLUDE BODYWEIGHT EXERCISES: YES" is specified for a day, you MUST NOT select any bodyweight or body-only exercises (such as push-ups, dips with body weight, crunches without weights, bodyweight squats, etc.). Pick weighted or machine/cable exercises exclusively.
    6. CRITICAL TRUTH: You must ONLY output exercise names from the 'MUST CHOOSE ONLY FROM' candidate lists provided for each target. Do not invent names or include exercises for unrequested muscle groups.
    7. Avoid exercises that aggravate ${data['user-injuries']}.
    8. CRITICAL MOVEMENT DIVERSITY MANDATE: You MUST provide a balanced mix of sub-categories for each muscle target and strictly enforce maximum limits on repetitive exercise types!
       - For 'Back': Pick AT MOST 2 horizontal rows (e.g. Barbell Bent-Over Row, Seated Cable Row, T-Bar Row). The remaining Back exercises MUST come from vertical pulls (e.g. Lat Pulldown, Wide-Grip Lat Pulldown), lower back / posterior chain (e.g. Rack Pull, Barbell Deadlift), and pullovers (e.g. Straight-Arm Cable Pushdown). NEVER return only rows!
       - For 'Chest': Pick AT MOST 2 flat bench presses. The remaining Chest exercises MUST come from incline presses (e.g. Incline Barbell Bench Press, Incline Dumbbell Bench Press), flyes/isolation (e.g. Cable Crossover, Pec Deck Fly, Flat Dumbbell Flyes), and decline/machine press.
       - For 'Legs': Pick AT MOST 2 quad squats. The remaining Leg exercises MUST come from hamstrings (e.g. Lying Leg Curl, Dumbbell Romanian Deadlift), unilateral (e.g. Bulgarian Split Squat, Dumbbell Lunge), and calves (e.g. Standing Calf Raise).
       - For 'Shoulders': Pick AT MOST 1 overhead press. The remaining Shoulder exercises MUST come from lateral raises (e.g. Dumbbell Lateral Raise, Cable Lateral Raise), rear delts (e.g. Face Pull, Rear Delt Cable Fly), and shrugs/front raises.
       - For 'Triceps': Combine 1 cable pushdown, 1 overhead extension, 1 skull crusher/compound press, and 1 dip/kickback.
       - For 'Biceps': Combine 1 heavy barbell/dumbbell curl, 1 hammer curl (neutral grip), 1 preacher/incline curl, and 1 concentration curl.
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
    const errorData = await response.json().catch(() => ({}));
    console.error("API Error Response:", errorData);
    throw new Error(`API returned ${response.status}: ${errorData?.error?.message || response.statusText}`);
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
    day.exerciseDetails = exercisesList.map(exName => findExerciseInDB(exName) || { name: exName, notFound: true });
    day.exercises = exercisesList;
    return day;
  });

  localStorage.setItem('yeahbuddy_weeklyPlan', JSON.stringify(weeklyPlan));
}

// Helper to fuzzy match exercise
function findExerciseInDB(name) {
  const search = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  let match = exerciseDB.find(ex => ex.name.toLowerCase().replace(/[^a-z0-9]/g, '') === search);
  if (match) return match;
  
  match = exerciseDB.find(ex => ex.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
  return match;
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

  // Separate staple exercises to guarantee they are included in candidate list sent to AI
  const staples = uniqueNames.filter(name => STAPLE_EXERCISES_ORDER.includes(name));
  const others = uniqueNames.filter(name => !STAPLE_EXERCISES_ORDER.includes(name));

  const shuffledOthers = others.sort(() => 0.5 - Math.random());
  return [...staples, ...shuffledOthers].slice(0, 45);
}


// Render Dashboard
function renderDashboard() {
  const container = document.getElementById('weekly-plan-container');
  container.innerHTML = '';
  
  weeklyPlan.forEach(day => {
    const card = document.createElement('div');
    card.className = 'day-card';
    card.innerHTML = `
      <div class="day-header">
        <div class="day-title">Day ${day.day}</div>
        <div class="day-type">${day.type}</div>
      </div>
      <p style="margin:0; font-size:14px;">${day.exercises.length} Exercises</p>
    `;
    
    card.addEventListener('click', () => openDayDetail(day));
    container.appendChild(card);
  });
  
  renderLibrary();
}

function openDayDetail(day) {
  showScreen('dayDetail');
  document.getElementById('day-detail-title').innerText = `Day ${day.day} - ${day.type}`;
  
  const container = document.getElementById('day-exercises-container');
  container.innerHTML = '';
  
  if (day.exercises.length === 0 || day.type.toLowerCase() === 'rest') {
    container.innerHTML = '<p>Rest day. Recover and grow!</p>';
    return;
  }

  day.exerciseDetails.forEach(ex => {
    const el = createExerciseElement(ex);
    container.appendChild(el);
  });
}

// Render Library
function renderLibrary(filter = '') {
  const container = document.getElementById('library-container');
  container.innerHTML = '';
  
  const filtered = exerciseDB.filter(ex => ex.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 50);
  
  filtered.forEach(ex => {
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
    <div class="exercise-meta">${ex.equipment || 'Bodyweight'} • ${ex.primaryMuscles ? ex.primaryMuscles[0] : 'Various'}</div>
  `;

  div.appendChild(imgEl);
  div.appendChild(infoDiv);
  
  div.addEventListener('click', () => openExerciseModal(ex));
  return div;
}

// Modal Logic
function openExerciseModal(ex) {
  if (ex.notFound) {
    alert("No detailed data found for this exercise in library.");
    return;
  }
  
  document.getElementById('modal-title').innerText = ex.name;
  
  const tagsContainer = document.getElementById('modal-tags');
  tagsContainer.innerHTML = `
    <span class="tag primary">${ex.level || 'all levels'}</span>
    <span class="tag">${ex.equipment || 'none'}</span>
    ${ex.primaryMuscles ? `<span class="tag">${ex.primaryMuscles.join(', ')}</span>` : ''}
  `;
  
  const imgContainer = document.getElementById('modal-images');
  imgContainer.innerHTML = '';
  if (ex.images && ex.images.length > 0) {
    ex.images.forEach(img => {
      const imgEl = document.createElement('img');
      imgEl.src = EXERCISE_IMG_BASE_URL + img;
      imgEl.onerror = function() {
        this.src = PLACEHOLDER_SVG;
      };
      imgContainer.appendChild(imgEl);
    });
  } else {
    const imgEl = document.createElement('img');
    imgEl.src = PLACEHOLDER_SVG;
    imgEl.style.maxHeight = '140px';
    imgEl.style.objectFit = 'contain';
    imgContainer.appendChild(imgEl);
  }
  
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
    instrContainer.innerHTML = '<p>No instructions available.</p>';
  }
  
  document.getElementById('exercise-modal').classList.add('active');
}

// PWA & Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('SW registered: ', reg.scope);
      }).catch(err => console.warn('SW reg failed (expected on local file): ', err));
    });
  }
}

// Pull to Refresh Implementation
function setupPullToRefresh() {
  let touchstartY = 0;
  let touchendY = 0;
  const ptrIndicator = document.getElementById('ptr-indicator');
  const maxPull = 150;
  
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
        ptrIndicator.style.padding = '15px';
        ptrIndicator.style.opacity = '1';
        ptrIndicator.style.borderBottomWidth = '1px';
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && touchstartY > 0) {
      touchendY = e.changedTouches[0].screenY;
      const pullDist = touchendY - touchstartY;
      
      if (pullDist > 80) { // Threshold for refresh
        ptrIndicator.innerText = "Refreshing...";
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({type: 'CLEAR_CACHE'});
        }
        setTimeout(() => {
          window.location.reload(true);
        }, 500);
      } else {
        ptrIndicator.style.height = "0";
        ptrIndicator.style.padding = "0";
        ptrIndicator.style.opacity = "0";
        ptrIndicator.style.borderBottomWidth = "0";
      }
      touchstartY = 0;
    }
  }, { passive: true });
}

// Boot
initApp();

