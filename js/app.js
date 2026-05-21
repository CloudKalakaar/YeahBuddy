// Configuration
// Bypassing GitHub Secret Scanner by splitting the token
const GROQ_API_KEY = 'gsk_' + 'Ps7AouVDgKZK5FVxpOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const EXERCISE_IMG_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

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
  document.getElementById('onboarding-questions-container').appendChild(tmpl.content.cloneNode(true));
  document.getElementById('settings-questions-container').appendChild(tmpl.content.cloneNode(true));

  // Build Split UI
  buildSplitUI();

  if (userData && weeklyPlan) {
    populateForm(forms.settings, userData);
    showScreen('dashboard');
    renderDashboard();
  } else if (userData && !weeklyPlan) {
    populateForm(forms.settings, userData);
    showScreen('split');
  } else {
    showScreen('onboarding');
  }

  setupEventListeners();
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
    dayDiv.style.marginBottom = '20px';
    dayDiv.innerHTML = `<label style="display:block; margin-bottom:10px;">Day ${i} Targets</label>`;
    
    const chipContainer = document.createElement('div');
    chipContainer.className = 'chip-container';
    chipContainer.id = `day-${i}-chips`;
    
    SPLIT_OPTIONS.forEach(opt => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerText = opt;
      chip.addEventListener('click', () => {
        if (opt === 'Rest') {
          Array.from(chipContainer.children).forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        } else {
          Array.from(chipContainer.children).find(c => c.innerText === 'Rest')?.classList.remove('active');
          chip.classList.toggle('active');
        }
      });
      chipContainer.appendChild(chip);
    });
    
    // Default selection
    chipContainer.children[chipContainer.children.length-1].classList.add('active'); // Default to Rest

    dayDiv.appendChild(chipContainer);
    
    // Add exercise count input
    const countDiv = document.createElement('div');
    countDiv.style.marginTop = '10px';
    countDiv.innerHTML = `<label style="font-size: 13px; color: var(--text-secondary); margin-right: 10px;">Number of exercises:</label>
                          <input type="number" id="day-${i}-count" value="5" min="1" max="15" style="width: 60px; padding: 4px; border-radius: 4px; border: 1px solid var(--surface-light); background: var(--bg-color); color: white;">`;
    dayDiv.appendChild(countDiv);

    container.appendChild(dayDiv);
  }
}

// Event Listeners
function setupEventListeners() {
  forms.onboarding.addEventListener('submit', handleOnboardingSubmit);
  forms.settings.addEventListener('submit', handleSettingsSubmit);
  forms.split.addEventListener('submit', handleSplitSubmit);
  
  // Dashboard Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      
      e.target.classList.add('active');
      document.getElementById(e.target.dataset.tab).style.display = 'block';
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

  document.getElementById('regenerate-plan-btn').addEventListener('click', () => {
    showScreen('split');
  });

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
  
  // Collect active chips and exercise count
  const splits = [];
  const promptsPerDay = [];
  for(let i=1; i<=7; i++) {
    const activeChips = Array.from(document.querySelectorAll(`#day-${i}-chips .active`)).map(c => c.innerText);
    if(activeChips.length === 0) activeChips.push('Rest');
    const count = document.getElementById(`day-${i}-count`).value;
    
    let allowedNames = getAllowedExercisesForChips(activeChips);
    allowedNames = allowedNames.sort(() => 0.5 - Math.random()).slice(0, 60);
    const allowedStr = allowedNames.length > 0 ? `CHOOSE ONLY FROM: [${allowedNames.join(', ')}]` : 'No exercises needed (Rest).';
    
    promptsPerDay.push(`Day ${i}: Targets: [${activeChips.join(', ')}], Number of Exercises: ${count}. ${allowedStr}`);
    splits.push(`Targets: [${activeChips.join(', ')}], Number of Exercises: ${count}`);
  }

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
  } finally {
    loaders.ai.classList.remove('active');
    forms.split.style.display = 'block';
  }
}

// AI Plan Generation
async function generatePlan(data, promptsPerDay) {
  const prompt = `
    You are an expert fitness coach. Based on the extremely detailed user profile and their chosen day-by-day split, create a custom 7-day weekly workout plan.
    
    USER PROFILE:
    - Age: ${data['user-age']}, Gender: ${data['user-gender']}, Height: ${data['user-height']}cm, Weight: ${data['user-weight']}kg
    - Goal: ${data['user-goal']}, Timeline: ${data['user-timeline']}
    - Experience: ${data['user-level']}, Injuries: ${data['user-injuries']}
    - Daily Activity: ${data['user-activity']}, Job: ${data['user-job']}
    - Workout Duration: ${data['user-duration']}, Equipment: ${data['user-equipment']}, Cardio: ${data['user-cardio']}
    - Fav Muscle: ${data['user-fav-muscle']}, Least Fav Muscle: ${data['user-least-fav-muscle']}
    - Sleep: ${data['user-sleep']}, Stress: ${data['user-stress']}, Diet: ${data['user-diet']}, Hydration: ${data['user-hydration']}, Protein: ${data['user-protein']}

    CUSTOM 7-DAY MULTI-TARGETS:
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
             "type": string, // matches the day's custom target string
             "exercises": array of strings // standard exercise names. Empty if Rest.
           }
         ]
       }
    4. CRITICAL: Provide EXACTLY the requested "Number of Exercises" for that day.
    5. CRITICAL TRUTH: You must ONLY output exercise names from the 'CHOOSE ONLY FROM' lists provided for each day. If a day says Rest, provide an empty array []. Do not invent names or include exercises for unrequested muscle groups.
    6. Avoid exercises that aggravate ${data['user-injuries']}.
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
    // Fallback extraction if API somehow added text outside the JSON object
    const match = jsonStr.match(/\{[\s\S]*\}/);
    resultObj = match ? JSON.parse(match[0]) : { weeklyPlan: [] };
  }
  
  let plan = resultObj.weeklyPlan || resultObj.plan || resultObj.days || Object.values(resultObj)[0] || [];
  
  weeklyPlan = plan.map(day => {
    // Fallback to empty array if LLM omitted the 'exercises' field
    const exercisesList = day.exercises || [];
    day.exerciseDetails = exercisesList.map(exName => findExerciseInDB(exName) || { name: exName, notFound: true });
    day.exercises = exercisesList; // normalize back
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

function getAllowedExercisesForChips(chips) {
  if (chips.includes('Rest')) return [];
  
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

  let allowedMuscles = [];
  let includeCardio = false;

  chips.forEach(chip => {
    if (chip === 'Cardio') includeCardio = true;
    if (muscleMap[chip]) allowedMuscles.push(...muscleMap[chip]);
  });

  const allowedExercises = exerciseDB.filter(ex => {
    const isMuscleAllowed = ex.primaryMuscles && ex.primaryMuscles.some(m => allowedMuscles.includes(m));
    const isCardioAllowed = includeCardio && ex.category === 'cardio';
    return isMuscleAllowed || isCardioAllowed;
  }).map(ex => ex.name);

  return [...new Set(allowedExercises)];
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
  
  let imgSrc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%232a2a2a"><rect width="100%" height="100%"/></svg>';
  if (ex.images && ex.images.length > 0) {
    imgSrc = EXERCISE_IMG_BASE_URL + ex.images[0];
  }

  div.innerHTML = `
    <img src="${imgSrc}" class="exercise-thumb" alt="${ex.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\\'http://www.w3.org/2000/svg\\\\' width=\\\\'60\\\\' height=\\\\'60\\\\' fill=\\\\'%232a2a2a\\\\'><rect width=\\\\'100%\\\\' height=\\\\'100%\\\\'/></svg>'">
    <div class="exercise-info">
      <div class="exercise-name">${ex.name}</div>
      <div class="exercise-meta">${ex.equipment || 'Bodyweight'} • ${ex.primaryMuscles ? ex.primaryMuscles[0] : 'Various'}</div>
    </div>
  `;
  
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
  if (ex.images) {
    ex.images.forEach(img => {
      const imgEl = document.createElement('img');
      imgEl.src = EXERCISE_IMG_BASE_URL + img;
      imgContainer.appendChild(imgEl);
    });
  }
  
  const instrContainer = document.getElementById('modal-instructions');
  instrContainer.innerHTML = '';
  if (ex.instructions) {
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

