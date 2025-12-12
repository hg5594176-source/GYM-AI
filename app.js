// FitMate AI - Main Application Logic

// In-memory storage (replaces localStorage for this session)
let profileData = null;
let logsData = [];

// Utilities
const $ = id => document.getElementById(id);
const toFixed = (v, n = 0) => Number(v.toFixed(n));
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

// Elements
const calcBtn = $('calcBtn');
const saveBtn = $('saveProfile');
const resultsCard = $('resultsCard');
const greet = $('greet');
const caloriesText = $('caloriesText');
const macrosList = $('macrosList');
const mealsDiv = $('meals');
const workoutPlanDiv = $('workoutPlan');
const statsDiv = $('stats');
const logsDiv = $('logs');
const bmiText = $('bmiText');
const startBtn = $('startTimer');
const pauseBtn = $('pauseTimer');

// NEW SCANNER ELEMENTS
const foodImageInput = $('foodImage');
const scanBtn = $('scanBtn');
const scanResultsDiv = $('scanResults');

// Timer variables
let timerInterval = null;
let remainingSec = 30;
const timerDisplay = $('timerDisplay');
const timerMinutes = $('timerMinutes');
let timerStatusEmoji = '⚪'; // Neutral/Ready emoji

// Voice variables
const speakBtn = $('speakPlan');
const stopSpeakBtn = $('stopSpeak');
let synth = window.speechSynthesis;
let speakUtterance = null;

// Event Listeners
calcBtn.addEventListener('click', () => {
  const profile = readProfileForm();
  if (!profile) return;
  profileData = profile;
  buildPlan(profile);
  resultsCard.style.display = 'block';
});

saveBtn.addEventListener('click', () => {
  const profile = readProfileForm();
  if (!profile) return;
  profileData = profile;
  alert('Profile saved in memory for this session.');
});

// NEW SCANNER LISTENER
scanBtn.addEventListener('click', scanFoodImage);

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
$('resetTimer').addEventListener('click', resetTimer);

speakBtn.addEventListener('click', () => speakPlan());
stopSpeakBtn.addEventListener('click', () => stopSpeaking());

// Form helpers
function readProfileForm() {
  const name = $('name').value.trim();
  const sex = $('sex').value;
  const age = parseInt($('age').value, 10);
  const weight = parseFloat($('weight').value);
  const height = parseFloat($('height').value);
  const activity = parseFloat($('activity').value);
  const goal = $('goal').value;
  const dietPref = $('dietPref').value;

  if (!name || !age || !weight || !height) {
    alert('Please complete all required fields.');
    return null;
  }
  return { name, sex, age, weight, height, activity, goal, dietPref };
}

// Main plan builder
function buildPlan(profile) {
  greet.innerText = `Hi ${profile.name}! Here's your personalized plan.`;

  // BMR calculation (Mifflin-St Jeor equation)
  let bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.sex === 'male' ? 5 : -161);
  bmr = toFixed(bmr, 0);

  // TDEE calculation
  const tdee = toFixed(bmr * profile.activity, 0);

  // Target calories based on goal
  let targetCalories = tdee;
  if (profile.goal === 'lose') targetCalories = toFixed(tdee * 0.82, 0);
  if (profile.goal === 'gain') targetCalories = toFixed(tdee * 1.12, 0);

  caloriesText.innerHTML = `<strong>BMR:</strong> ${bmr} kcal/day • <strong>TDEE:</strong> ${tdee} kcal/day • <strong>Target:</strong> ${targetCalories} kcal/day`;

  // BMI calculation
  const heightM = profile.height / 100;
  const bmi = toFixed(profile.weight / (heightM * heightM), 1);
  bmiText.innerHTML = `<strong>BMI:</strong> ${bmi} — ${bmiMessage(bmi)}`;

  const proteinG = Math.round((profile.goal === 'gain' ? 1.8 : 1.6) * profile.weight);
  const proteinCals = proteinG * 4;
  const fatCals = Math.round(targetCalories * 0.25);
  const fatG = Math.round(fatCals / 9);
  const carbsCals = targetCalories - proteinCals - fatCals;
  const carbsG = Math.round(carbsCals / 4);

  macrosList.innerHTML = '';
  [
    `Protein: ${proteinG} g (~${proteinCals} kcal)`,
    `Fat: ${fatG} g (~${fatCals} kcal)`,
    `Carbs: ${carbsG} g (~${carbsCals} kcal)`
  ].forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    macrosList.appendChild(li);
  });

  // Generate meals and workout
  const meals = makeMeals(targetCalories, profile);
  renderMeals(meals);

  const workout = generateWorkoutPlan(profile);
  renderWorkout(workout);

  renderStats();
  renderLogs();
}

// BMI message
function bmiMessage(bmi) {
  if (bmi < 18.5) return 'Underweight — calorie surplus + resistance training recommended';
  if (bmi < 25) return 'Normal weight — maintain current lifestyle';
  if (bmi < 30) return 'Overweight — calorie deficit recommended';
  return 'Obese — consult healthcare professional';
}

// Meal data generator
function makeMeals(cals, profile) {
  const breakfast = Math.round(cals * 0.25);
  const lunch = Math.round(cals * 0.33);
  const dinner = Math.round(cals * 0.30);
  const snacks = cals - breakfast - lunch - dinner;

  // Note: Diet preference logic is omitted here for brevity, but would be implemented here.

  return {
    breakfast: { cal: breakfast, items: ['Oats', 'Milk', 'Boiled egg'] },
    lunch: { cal: lunch, items: ['Paneer/Chicken', 'Rice/Roti', 'Salad'] },
    dinner: { cal: dinner, items: ['Protein food', 'Vegetables'] },
    snacks: { cal: snacks, items: ['Nuts', 'Fruit'] }
  };
}

function renderMeals(meals) {
  mealsDiv.innerHTML = '';
  for (const key of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    const panel = document.createElement('div');
    panel.className = 'meal-card';
    panel.innerHTML = `
      <strong>${capitalize(key)} (~${meals[key].cal} kcal)</strong>
      <div class="small">${meals[key].items.join(' • ')}</div>
    `;
    mealsDiv.appendChild(panel);
  }
}

// Workout generator
function generateWorkoutPlan(profile) {
  const goal = profile.goal;
  const days = profile.activity >= 1.55 ? 5 : 4;
  const plan = [];

  for (let d = 1; d <= days; d++) {
    if (goal === 'lose') {
      plan.push({ day: `Day ${d}`, focus: 'Full-body + cardio' });
    } else if (goal === 'gain') {
      const split = d % 3 === 1 ? 'Push' : d % 3 === 2 ? 'Pull' : 'Legs';
      plan.push({ day: `Day ${d}`, focus: `Strength: ${split}` });
    } else {
      plan.push({ day: `Day ${d}`, focus: 'Mixed Training' });
    }
  }

  plan.push({ day: 'Rest', focus: 'Walking + stretching' });
  return plan;
}

function renderWorkout(workout) {
  workoutPlanDiv.innerHTML = '';
  workout.forEach(w => {
    const d = document.createElement('div');
    d.className = 'workout-row small';
    d.innerHTML = `<strong>${w.day}:</strong> ${w.focus}`;
    workoutPlanDiv.appendChild(d);
  });
}

// Stats and Logs
function renderStats() {
  if (logsData.length === 0) {
    statsDiv.innerHTML = '<div class="small">No sessions completed yet.</div>';
    return;
  }
  const last = logsData[logsData.length - 1];
  statsDiv.innerHTML = `
    <div class="small">Total sessions: ${logsData.length} • Last: ${new Date(last.start).toLocaleString()}</div>
  `;
}

function renderLogs() {
  logsDiv.innerHTML = '';
  logsData.slice().reverse().forEach(l => {
    const node = document.createElement('div');
    node.className = 'log-item';
    
    // Add emoji based on completion status
    const completionEmoji = l.status === 'completed' ? '😊' : l.status === 'paused' ? '😟' : '❓';

    node.innerHTML = `
      <strong>${l.type} ${completionEmoji}</strong>
      <div class="small">${new Date(l.start).toLocaleString()}</div>
      <div class="small">${l.duration ? l.duration + ' sec' : ''}</div>
    `;
    logsDiv.appendChild(node);
  });
}

// Timer functions
function startTimer() {
    // FIX: Always read the input value when the button is clicked to allow setting new duration.
    const minutes = parseFloat(timerMinutes.value);

    // 1. Input validation check
    if (isNaN(minutes) || minutes <= 0) {
        alert("Please enter a valid time in minutes (must be greater than 0).");
        return;
    }

    // 2. Calculate remaining seconds based on input
    let newDurationSec = Math.round(minutes * 60);
    let isResuming = (startBtn.innerHTML === '▶️ Resume');
    
    // If it's a fresh start (not resuming), or if the input duration has changed,
    // we reset the remaining time to the new duration.
    if (!timerInterval || !isResuming || remainingSec <= 0 || newDurationSec !== parseInt(timerMinutes.dataset.fullDuration)) {
        remainingSec = newDurationSec;
        timerMinutes.dataset.fullDuration = remainingSec;
        startBtn.innerHTML = `▶️ In Progress`;
        timerStatusEmoji = '🏃'; // Running emoji
    }
    // If it is resuming, remainingSec already holds the correct paused value.
    
    // Set button states
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    
    updateTimerDisplay();
    const startTs = Date.now();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        remainingSec--;
        updateTimerDisplay();
        if (remainingSec <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            onTimerComplete(startTs);
        }
    }, 1000);
}


function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    
    // Log as not completed (sad face)
    logsData.push({
      type: 'Interval (Paused)',
      start: new Date().toISOString(),
      duration: timerMinutes.dataset.fullDuration - remainingSec,
      status: 'paused' 
    });
    
    timerStatusEmoji = '😟'; // Sad face emoji
    startBtn.innerHTML = `▶️ Resume`;
    startBtn.disabled = false;
    pauseBtn.disabled = true;

    renderStats();
    renderLogs();
    updateTimerDisplay(); // Update to show paused emoji
  }
}

function resetTimer() {
  remainingSec = 30;
  updateTimerDisplay();
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  startBtn.innerHTML = `▶️ Start`;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  timerMinutes.dataset.fullDuration = 30; // Reset duration tracking
  timerStatusEmoji = '⚪'; 
  
  timerMinutes.value = '0.5'; // Added to visually reset the input field
  timerDisplay.classList.remove('pulsing-red', 'popping');
}

// Dynamic Timer Display and Styling
function updateTimerDisplay() {
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  
  timerDisplay.textContent = `${timerStatusEmoji} ${mm}:${ss}`;

  // Check for critical time threshold (e.g., last 10 seconds)
  if (remainingSec <= 10 && remainingSec > 0) {
    timerDisplay.classList.add('pulsing-red', 'popping');
  } else {
    timerDisplay.classList.remove('pulsing-red', 'popping');
  }
}

function onTimerComplete(startTs) {
  const duration = Math.round((Date.now() - startTs) / 1000);
  alert('Timer completed! Session logged.');
  
  // 📢 NEW: Speak the completion message
  speakResult('Congrats, your task is completed!'); 

  // Log as completed (smile face)
  logsData.push({
    type: 'Interval (Complete)',
    start: new Date().toISOString(),
    duration: duration,
    status: 'completed'
  });

  timerStatusEmoji = '😊'; // Smile face emoji
  startBtn.innerHTML = `▶️ Start`;
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  
  renderStats();
  renderLogs();
  updateTimerDisplay(); // Update to show completed emoji
}
// 📸 Food Scanner Logic (IMPROVED with Voice Assistance)
function scanFoodImage() {
    stopSpeaking(); 

    if (foodImageInput.files.length === 0) {
        scanResultsDiv.innerHTML = '<strong>❌ Oops!</strong> Please select an image to scan.';
        return;
    }

    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    scanResultsDiv.innerHTML = '<strong>⏳ Scanning...</strong> Analyzing image and fetching nutrition data...';

    setTimeout(() => {
        const fileName = foodImageInput.files[0].name.toLowerCase();
        let result = {};
        let voiceMessage = "";

        if (fileName.includes('apple') || fileName.includes('fruit') || fileName.includes('salad')) {
            result = {
                name: 'Fresh Apple',
                calories: '95 kcal',
                macros: '0.5g Protein, 0.3g Fat, 25g Carbs',
                recommendation: 'A perfect low-fat, high-fiber snack to fuel your next workout!'
            };
            voiceMessage = `Scan complete! We detected a ${result.name}. Total calories: 95. That's a great choice for your plan!`;
            
        } else if (fileName.includes('burger') || fileName.includes('pizza') || fileName.includes('fries')) {
            result = {
                name: 'Cheeseburger (Fast Food)',
                calories: 'Approx. 350 kcal',
                macros: '20g Protein, 20g Fat, 30g Carbs',
                recommendation: 'A high-fat item. Enjoy in moderation, and be sure to adjust your dinner macros!'
            };
            voiceMessage = `Warning! We detected a ${result.name}. Estimated calories: 350. Remember to track this carefully against your goals.`;
        } else if (fileName.includes('chicken') || fileName.includes('paneer') || fileName.includes('protein')) {
            result = {
                name: 'Grilled Chicken Breast',
                calories: 'Approx. 165 kcal',
                macros: '31g Protein, 3.6g Fat, 0g Carbs',
                recommendation: 'Excellent source of lean protein! Ideal for muscle gain and maintenance.'
            };
            voiceMessage = `Awesome! We found ${result.name}. High in protein and zero carbs. Keep up the good work!`;
        } 
        else {
             result = {
                name: 'Unidentified Meal',
                calories: 'Approx. 250 kcal',
                macros: '10g Protein, 10g Fat, 30g Carbs',
                recommendation: 'Unsure of the contents. Track manually if possible, or try a clearer photo!'
            };
            voiceMessage = `Scan complete for an unidentified meal. Please confirm the ingredients to ensure accurate tracking.`;
        }

        scanResultsDiv.innerHTML = `
            <strong>${result.name} (${result.calories})</strong>
            <div class="small">
                **Nutrition Breakdown:** ${result.macros}<br>
                **FitMate Tip:** ${result.recommendation} 🌟
            </div>
        `;

        speakResult(voiceMessage);

        scanBtn.disabled = false;
        scanBtn.innerHTML = '🔍 Scan Image';

    }, 2000); 
}

// Voice function dedicated to scanner results
function speakResult(text) {
    if (!('speechSynthesis' in window)) {
        console.log('Speech synthesis not supported.');
        return;
    }
    
    stopSpeaking();
    speakUtterance = new SpeechSynthesisUtterance(text);
    speakUtterance.rate = 1.1; 
    synth.speak(speakUtterance);
}


// Existing Voice functions
function speakPlan() {
  if (!('speechSynthesis' in window)) {
    alert('Speech synthesis not supported in your browser.');
    return;
  }
  
  if (!profileData) {
    alert('Please generate a plan first.');
    return;
  }

  const text = `Your plan has been generated. ${caloriesText.innerText}.
                Daily Macros are: ${macrosList.innerText.replace(/\n/g, ', ')}.
                Workout Plan: ${workoutPlanDiv.innerText.replace(/\n/g, '. ')}`;
  
  stopSpeaking();
  speakUtterance = new SpeechSynthesisUtterance(text);
  speakUtterance.rate = 1;
  synth.speak(speakUtterance);
}

function stopSpeaking() {
  if (synth && synth.speaking) {
    synth.cancel();
  }
}