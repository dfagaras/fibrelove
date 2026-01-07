// ==========================================
// FibreLove - Main Application Logic
// With Supabase Integration
// ==========================================

// Global State
const state = {
  user: null,
  profile: null,
  fiberGoal: 35,
  currentWeek: null,
  shoppingList: null,
  dailyLogs: {},
  selectedFoods: [],
  isLoading: true,
  peopleCount: 2
};

// DOM Elements
const elements = {};

// Temp storage
let tempWeeklyPlan = null;
let tempShoppingList = null;
let editingFoods = [];

// ==========================================
// Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initAuthForms();
  initElements();
  
  // Check if auth is available
  if (typeof auth === 'undefined' || !auth) {
    console.error('Auth not available. Supabase may not have loaded correctly.');
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
      authContainer.innerHTML = `
        <div class="auth-card" style="text-align: center; padding: 40px;">
          <h2>⚠️ Loading Error</h2>
          <p>Could not connect to the server.</p>
          <p>Please check your internet connection and refresh the page.</p>
          <button onclick="location.reload()" class="auth-btn primary" style="margin-top: 20px;">
            🔄 Refresh Page
          </button>
        </div>
      `;
    }
    return;
  }
  
  // Listen for auth state changes
  auth.onAuthStateChange(async (event, session) => {
    console.log('Auth event:', event);
    
    if (session?.user) {
      // User is logged in
      state.user = session.user;
      await loadUserData();
      showApp();
    } else {
      // User is logged out
      state.user = null;
      state.profile = null;
      showAuth();
    }
  });
});

// ==========================================
// Auth UI Functions
// ==========================================

function initAuthForms() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }
}

window.showLogin = function() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('signup-form').classList.add('hidden');
  document.getElementById('login-error').classList.remove('show');
};

window.showSignup = function() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('signup-form').classList.remove('hidden');
  document.getElementById('signup-error').classList.remove('show');
  document.getElementById('signup-success').classList.add('hidden');
};

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn = e.target.querySelector('button');
  const errorEl = document.getElementById('login-error');
  
  btn.classList.add('loading');
  errorEl.classList.remove('show');
  
  try {
    await auth.signIn(email, password);
    // Auth state change listener will handle the rest
  } catch (error) {
    errorEl.textContent = error.message || 'Login failed. Please try again.';
    errorEl.classList.add('show');
  } finally {
    btn.classList.remove('loading');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const btn = e.target.querySelector('button');
  const errorEl = document.getElementById('signup-error');
  const successEl = document.getElementById('signup-success');
  
  btn.classList.add('loading');
  errorEl.classList.remove('show');
  successEl.classList.add('hidden');
  
  try {
    await auth.signUp(email, password, name);
    successEl.classList.remove('hidden');
    // Clear form
    e.target.reset();
  } catch (error) {
    errorEl.textContent = error.message || 'Signup failed. Please try again.';
    errorEl.classList.add('show');
  } finally {
    btn.classList.remove('loading');
  }
}

function showAuth() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  
  // Initialize the app UI
  initNavigation();
  initSettings();
  initPlanning();
  initQuickAdd();
  initNumberInputs();
  initModals();
  updateDashboard();
  updateWeeklyView();
}

// ==========================================
// Data Loading
// ==========================================

async function loadUserData() {
  if (!state.user) return;
  
  try {
    // Load profile
    state.profile = await db.getProfile(state.user.id);
    state.fiberGoal = state.profile?.fiber_goal || 35;
    
    // Set current week
    state.currentWeek = getWeekStart();
    
    // Load shopping list for current week
    const shoppingListData = await db.getShoppingList(state.user.id, state.currentWeek);
    if (shoppingListData?.items) {
      // Handle new format with peopleCount
      if (shoppingListData.items.items) {
        state.shoppingList = shoppingListData.items.items;
        state.peopleCount = shoppingListData.items.peopleCount || 2;
      } else {
        // Old format - just an array
        state.shoppingList = shoppingListData.items;
        state.peopleCount = 2;
      }
    } else {
      state.shoppingList = null;
      state.peopleCount = 2;
    }
    
    // Load daily logs for current week
    const logs = await db.getWeeklyLogs(state.user.id, state.currentWeek);
    state.dailyLogs = {};
    logs.forEach(log => {
      state.dailyLogs[log.log_date] = {
        foods: log.foods || [],
        totalFiber: log.total_fiber || 0
      };
    });
    
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// ==========================================
// Save Functions
// ==========================================

async function saveProfile() {
  if (!state.user) return;
  
  try {
    await db.updateProfile(state.user.id, {
      name: state.profile.name,
      fiber_goal: state.fiberGoal
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    showToast('Error saving profile');
  }
}

async function saveShoppingList() {
  if (!state.user || !state.shoppingList) return;
  
  try {
    // Include people count in the saved data
    const dataToSave = {
      items: state.shoppingList,
      peopleCount: state.peopleCount
    };
    await db.saveShoppingList(state.user.id, state.currentWeek, dataToSave);
  } catch (error) {
    console.error('Error saving shopping list:', error);
    showToast('Error saving shopping list');
  }
}

async function saveDailyLog() {
  if (!state.user) return;
  
  const todayKey = getTodayKey();
  const log = state.dailyLogs[todayKey];
  
  if (!log) return;
  
  try {
    await db.saveDailyLog(state.user.id, todayKey, log.foods, log.totalFiber);
  } catch (error) {
    console.error('Error saving daily log:', error);
    showToast('Error saving log');
  }
}

// ==========================================
// Element Initialization
// ==========================================

function initElements() {
  elements.navBtns = document.querySelectorAll('.nav-btn');
  elements.views = document.querySelectorAll('.view');
  
  elements.userSwitcher = document.getElementById('user-switcher');
  elements.currentUserName = document.getElementById('current-user-name');
  elements.logoutBtn = document.getElementById('logout-btn');
  
  elements.todayDate = document.getElementById('today-date');
  elements.currentFiber = document.getElementById('current-fiber');
  elements.goalFiber = document.getElementById('goal-fiber');
  elements.progressCircle = document.getElementById('progress-circle');
  elements.progressEmoji = document.getElementById('progress-emoji');
  elements.encouragementText = document.getElementById('encouragement-text');
  elements.todayFoodsList = document.getElementById('today-foods-list');
  elements.addFoodBtn = document.getElementById('add-food-btn');
  
  elements.weekRange = document.getElementById('week-range');
  elements.weekOverview = document.getElementById('week-overview');
  elements.weeklyAvg = document.getElementById('weekly-avg');
  elements.weeklyBest = document.getElementById('weekly-best');
  elements.weeklyStreak = document.getElementById('weekly-streak');
  
  elements.shoppingListSection = document.getElementById('shopping-list-section');
  elements.shoppingListContent = document.getElementById('shopping-list-content');
  
  elements.itemsCount = document.getElementById('items-count');
  elements.generatePlanBtn = document.getElementById('generate-plan-btn');
  elements.categoryTabs = document.querySelectorAll('.cat-tab');
  elements.foodGrid = document.getElementById('food-grid');
  elements.selectedCount = document.getElementById('selected-count');
  elements.targetCount = document.getElementById('target-count');
  elements.createPlanBtn = document.getElementById('create-plan-btn');
  elements.selectionSummary = document.getElementById('selection-summary');
  
  elements.fiberGoalInput = document.getElementById('fiber-goal');
  elements.name1Input = document.getElementById('name1');
  elements.saveSettingsBtn = document.getElementById('save-settings-btn');
  elements.resetWeekBtn = document.getElementById('reset-week-btn');
  elements.logoutSettingsBtn = document.getElementById('logout-settings-btn');
  
  elements.quickAddModal = document.getElementById('quick-add-modal');
  elements.quantityEditorModal = document.getElementById('quantity-editor-modal');
  elements.planResultModal = document.getElementById('plan-result-modal');
  
  elements.foodSearch = document.getElementById('food-search');
  elements.quickAddList = document.getElementById('quick-add-list');
  elements.portionInput = document.getElementById('portion-input');
  elements.selectedFoodDisplay = document.getElementById('selected-food-display');
  elements.portionAmount = document.getElementById('portion-amount');
  elements.fiberPreviewValue = document.getElementById('fiber-preview-value');
  elements.confirmAddBtn = document.getElementById('confirm-add-btn');
  
  elements.quantityEditorList = document.getElementById('quantity-editor-list');
  elements.calcDailyFiber = document.getElementById('calc-daily-fiber');
  elements.calcGoal = document.getElementById('calc-goal');
  elements.generateShoppingBtn = document.getElementById('generate-shopping-btn');
  
  elements.planResultList = document.getElementById('plan-result-list');
  elements.planGoalDisplay = document.getElementById('plan-goal-display');
  elements.planTotalFiber = document.getElementById('plan-total-fiber');
  elements.acceptPlanBtn = document.getElementById('accept-plan-btn');
}

function initModals() {
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
  
  if (elements.acceptPlanBtn) {
    elements.acceptPlanBtn.addEventListener('click', acceptPlan);
  }
  
  if (elements.generateShoppingBtn) {
    elements.generateShoppingBtn.addEventListener('click', generateFromQuantities);
  }
}

async function acceptPlan() {
  if (tempWeeklyPlan && tempShoppingList) {
    state.shoppingList = tempShoppingList;
    state.selectedFoods = [];
    
    await saveShoppingList();
    
    closeAllModals();
    switchView('dashboard');
    showToast('Plan saved! 🛒💕');
    
    const activeTab = document.querySelector('.cat-tab.active');
    if (activeTab) initFoodGrid(activeTab.dataset.category);
    updateSelectionSummary();
    updateDashboard();
  }
}

// ==========================================
// Helper Functions
// ==========================================

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getTodayLog() {
  const todayKey = getTodayKey();
  if (!state.dailyLogs[todayKey]) {
    state.dailyLogs[todayKey] = { foods: [], totalFiber: 0 };
  }
  return state.dailyLogs[todayKey];
}

function formatWeight(grams) {
  if (grams >= 1000) {
    return (grams / 1000).toFixed(1) + 'kg';
  }
  return grams + 'g';
}

// ==========================================
// Navigation
// ==========================================

function initNavigation() {
  elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(viewName) {
  elements.navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  
  elements.views.forEach(view => {
    view.classList.toggle('active', view.id === `${viewName}-view`);
  });
  
  if (elements.selectionSummary) {
    elements.selectionSummary.style.display = viewName === 'plan' ? 'flex' : 'none';
  }
  
  if (viewName === 'dashboard') updateDashboard();
  if (viewName === 'weekly') updateWeeklyView();
  if (viewName === 'plan') initFoodGrid('vegetables');
  if (viewName === 'settings') loadSettingsUI();
}

// ==========================================
// Dashboard
// ==========================================

function updateDashboard() {
  const today = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  if (elements.todayDate) {
    elements.todayDate.textContent = today.toLocaleDateString('ro-RO', options);
  }
  
  const todayLog = getTodayLog();
  const currentFiber = todayLog.totalFiber || 0;
  
  if (elements.currentFiber) elements.currentFiber.textContent = Math.round(currentFiber * 10) / 10;
  if (elements.goalFiber) elements.goalFiber.textContent = state.fiberGoal;
  
  const progress = Math.min(currentFiber / state.fiberGoal, 1);
  const circumference = 2 * Math.PI * 85;
  const offset = circumference * (1 - progress);
  
  if (elements.progressCircle) {
    elements.progressCircle.style.strokeDasharray = circumference;
    elements.progressCircle.style.strokeDashoffset = offset;
    const hue = 0 + progress * 120;
    elements.progressCircle.style.stroke = `hsl(${hue}, 65%, 55%)`;
  }
  
  updateEncouragement(progress);
  updateTodayFoodsList();
  updateShoppingListDisplay();
  updateUserDisplay();
}

function updateEncouragement(progress) {
  const messages = [
    { min: 0, max: 0.1, emoji: '🌱', text: "Let's start eating healthy! 💪" },
    { min: 0.1, max: 0.3, emoji: '🌿', text: "Great start! Keep going! 🚀" },
    { min: 0.3, max: 0.5, emoji: '🥗', text: "You're doing amazing! 💕" },
    { min: 0.5, max: 0.7, emoji: '🌟', text: "Halfway there, superstar! ⭐" },
    { min: 0.7, max: 0.9, emoji: '🔥', text: "Almost there! So proud! 🎉" },
    { min: 0.9, max: 1.0, emoji: '🏆', text: "You did it! Champion! 👑" },
    { min: 1.0, max: Infinity, emoji: '🎊', text: "Incredible! Above and beyond! 🌈" }
  ];
  
  const msg = messages.find(m => progress >= m.min && progress < m.max) || messages[messages.length - 1];
  if (elements.progressEmoji) elements.progressEmoji.textContent = msg.emoji;
  if (elements.encouragementText) elements.encouragementText.textContent = msg.text;
}

function updateUserDisplay() {
  if (elements.currentUserName && state.profile) {
    elements.currentUserName.textContent = state.profile.name || state.user?.email || 'User';
  }
}

function updateTodayFoodsList() {
  const todayLog = getTodayLog();
  
  if (!todayLog.foods || todayLog.foods.length === 0) {
    if (elements.todayFoodsList) {
      elements.todayFoodsList.innerHTML = `
        <p class="empty-state">No foods logged yet today.<br>Tap the button below to add what you ate! 🍽️</p>
      `;
    }
    return;
  }
  
  const html = todayLog.foods.map((food, index) => `
    <div class="eaten-food-item">
      <span class="food-emoji">${food.emoji}</span>
      <div class="food-info">
        <div class="food-name">${food.name}</div>
        <div class="food-details">${food.portion}g → ${food.fiber.toFixed(1)}g fibre</div>
      </div>
      <button class="remove-food-btn" onclick="removeFood(${index})">✕</button>
    </div>
  `).join('');
  
  if (elements.todayFoodsList) elements.todayFoodsList.innerHTML = html;
}

window.removeFood = async function(index) {
  const todayLog = getTodayLog();
  if (todayLog.foods && todayLog.foods[index]) {
    const food = todayLog.foods[index];
    todayLog.totalFiber -= food.fiber;
    todayLog.foods.splice(index, 1);
    await saveDailyLog();
    updateDashboard();
    showToast(`Removed ${food.name}`);
  }
};

function updateShoppingListDisplay() {
  if (!elements.shoppingListSection || !elements.shoppingListContent) return;
  
  if (state.shoppingList && state.shoppingList.length > 0) {
    elements.shoppingListSection.style.display = 'block';
    
    // Update people count label
    const peopleLabel = document.getElementById('shopping-people-label');
    if (peopleLabel) {
      const peopleText = state.peopleCount === 1 ? '1 persoană' : `${state.peopleCount} persoane`;
      peopleLabel.textContent = `(for ${peopleText})`;
    }
    
    const html = state.shoppingList.map(item => `
      <div class="shopping-item">
        <span class="shopping-emoji">${item.emoji}</span>
        <span class="shopping-name">${item.name}</span>
        <span class="shopping-amount">${formatWeight(item.totalGrams)}</span>
      </div>
    `).join('');
    
    elements.shoppingListContent.innerHTML = html;
  } else {
    elements.shoppingListSection.style.display = 'none';
  }
}

// ==========================================
// Weekly View
// ==========================================

function updateWeeklyView() {
  const weekStart = new Date(state.currentWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  const options = { day: 'numeric', month: 'short' };
  if (elements.weekRange) {
    elements.weekRange.textContent = `${weekStart.toLocaleDateString('ro-RO', options)} - ${weekEnd.toLocaleDateString('ro-RO', options)}`;
  }
  
  const days = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
  const today = getTodayKey();
  
  let totalFiber = 0;
  let bestDay = 0;
  let daysHitGoal = 0;
  
  const daysHtml = days.map((dayName, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    const log = state.dailyLogs[dateKey] || { totalFiber: 0 };
    const fiber = log.totalFiber || 0;
    
    totalFiber += fiber;
    if (fiber > bestDay) bestDay = fiber;
    if (fiber >= state.fiberGoal) daysHitGoal++;
    
    const isToday = dateKey === today;
    const isCompleted = fiber >= state.fiberGoal;
    const isPast = date < new Date(today);
    
    let emoji = '';
    if (isCompleted) emoji = '🏆';
    else if (isPast && fiber > 0) emoji = '🌿';
    else if (isPast) emoji = '😴';
    else if (isToday) emoji = '💪';
    
    return `
      <div class="day-card ${isToday ? 'today' : ''} ${isCompleted ? 'completed' : ''}">
        <div class="day-name">${dayName}</div>
        <div class="day-date">${date.getDate()}</div>
        <div class="day-fiber">${Math.round(fiber * 10) / 10}g</div>
        <div class="day-emoji">${emoji}</div>
      </div>
    `;
  }).join('');
  
  if (elements.weekOverview) elements.weekOverview.innerHTML = daysHtml;
  
  const daysElapsed = Math.min(
    Math.floor((new Date() - weekStart) / (1000 * 60 * 60 * 24)) + 1,
    7
  );
  const avgFiber = daysElapsed > 0 ? totalFiber / daysElapsed : 0;
  
  if (elements.weeklyAvg) elements.weeklyAvg.textContent = `${Math.round(avgFiber * 10) / 10}g`;
  if (elements.weeklyBest) elements.weeklyBest.textContent = `${Math.round(bestDay * 10) / 10}g`;
  if (elements.weeklyStreak) elements.weeklyStreak.textContent = daysHitGoal;
}

// ==========================================
// Planning
// ==========================================

function initPlanning() {
  elements.categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      initFoodGrid(tab.dataset.category);
    });
  });
  
  if (elements.generatePlanBtn) {
    elements.generatePlanBtn.addEventListener('click', generateRandomSelection);
  }
  
  const clearBtn = document.getElementById('clear-selection-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllSelections);
  }
  
  if (elements.createPlanBtn) {
    elements.createPlanBtn.addEventListener('click', openQuantityEditor);
  }
  
  if (elements.itemsCount) {
    elements.itemsCount.addEventListener('change', () => {
      if (elements.targetCount) elements.targetCount.textContent = elements.itemsCount.value;
      updateSelectionSummary();
    });
    if (elements.targetCount) elements.targetCount.textContent = elements.itemsCount.value;
  }
  
  initFoodGrid('vegetables');
}

function clearAllSelections() {
  state.selectedFoods = [];
  const activeCategory = document.querySelector('.cat-tab.active')?.dataset.category || 'vegetables';
  initFoodGrid(activeCategory);
  updateSelectionSummary();
  showToast('All selections cleared! 🗑️');
}

function initFoodGrid(category) {
  const foods = FOODS[category] || [];
  
  const html = foods.map(food => {
    const isSelected = state.selectedFoods.some(f => f.name === food.name);
    return `
      <div class="food-item ${isSelected ? 'selected' : ''}" 
           data-name="${food.name}" 
           data-fiber="${food.fiber}"
           data-emoji="${food.emoji}"
           data-min="${food.min || 50}"
           data-max="${food.max || 2000}"
           data-default="${food.default || 500}"
           onclick="toggleFoodSelection(this)">
        <span class="emoji">${food.emoji}</span>
        <div class="name">${food.name}</div>
        <div class="fiber">${food.fiber}g/100g</div>
      </div>
    `;
  }).join('');
  
  if (elements.foodGrid) elements.foodGrid.innerHTML = html;
}

window.toggleFoodSelection = function(element) {
  const name = element.dataset.name;
  const fiber = parseFloat(element.dataset.fiber);
  const emoji = element.dataset.emoji;
  const min = parseInt(element.dataset.min);
  const max = parseInt(element.dataset.max);
  const defaultVal = parseInt(element.dataset.default);
  
  const existingIndex = state.selectedFoods.findIndex(f => f.name === name);
  
  if (existingIndex === -1) {
    state.selectedFoods.push({ name, fiber, emoji, min, max, default: defaultVal });
    element.classList.add('selected');
  } else {
    state.selectedFoods.splice(existingIndex, 1);
    element.classList.remove('selected');
  }
  
  updateSelectionSummary();
};

function updateSelectionSummary() {
  const count = state.selectedFoods.length;
  const target = elements.itemsCount ? parseInt(elements.itemsCount.value) : 15;
  
  if (elements.selectedCount) elements.selectedCount.textContent = count;
  if (elements.targetCount) elements.targetCount.textContent = target;
  if (elements.createPlanBtn) elements.createPlanBtn.disabled = count < 3;
}

function generateRandomSelection() {
  const targetCount = elements.itemsCount ? parseInt(elements.itemsCount.value) : 15;
  state.selectedFoods = [];
  
  const allFoods = [
    ...FOODS.vegetables,
    ...FOODS.fruits,
    ...FOODS.legumes,
    ...(FOODS.nuts || []),
    ...FOODS.wholeGrains
  ];
  
  const shuffled = [...allFoods].sort(() => Math.random() - 0.5);
  state.selectedFoods = shuffled.slice(0, targetCount).map(f => ({
    ...f,
    min: f.min || 50,
    max: f.max || 2000,
    default: f.default || 500
  }));
  
  const activeCategory = document.querySelector('.cat-tab.active')?.dataset.category || 'vegetables';
  initFoodGrid(activeCategory);
  updateSelectionSummary();
  
  showToast(`Selected ${targetCount} random foods! 🎲`);
}

// ==========================================
// Quantity Editor
// ==========================================

function openQuantityEditor() {
  if (state.selectedFoods.length < 3) {
    showToast('Please select at least 3 foods!');
    return;
  }
  
  // Get people count from input
  const peopleInput = document.getElementById('people-count');
  state.peopleCount = peopleInput ? parseInt(peopleInput.value) || 2 : 2;
  
  // Update the editor header to show people count
  const editorPeopleEl = document.getElementById('editor-people-count');
  if (editorPeopleEl) editorPeopleEl.textContent = state.peopleCount;
  
  editingFoods = state.selectedFoods.map(food => ({
    ...food,
    weeklyAmount: food.default || 500,
    minAmount: food.min || 50,
    maxAmount: food.max || 2000
  }));
  
  renderQuantityEditor();
  if (elements.calcGoal) elements.calcGoal.textContent = state.fiberGoal + 'g';
  updateFiberCalculation();
  openModal('quantity-editor-modal');
}

function renderQuantityEditor() {
  const html = editingFoods.map((food, index) => {
    const dailyGrams = food.weeklyAmount / 7;
    const fiberPerDay = (dailyGrams / 100) * food.fiber;
    const minAmount = food.minAmount || 50;
    const maxAmount = food.maxAmount || 2000;
    
    return `
      <div class="quantity-edit-item">
        <span class="food-emoji">${food.emoji}</span>
        <div class="food-details">
          <div class="food-name">${food.name}</div>
          <div class="food-fiber-info">${food.fiber}g/100g · ${Math.round(dailyGrams)}g/zi</div>
          <div class="food-range">Recomandat: ${formatWeight(minAmount)} - ${formatWeight(maxAmount)}</div>
        </div>
        <div class="quantity-input-wrap">
          <input type="number" 
                 value="${food.weeklyAmount}" 
                 min="${minAmount}" 
                 max="${maxAmount}" 
                 step="50"
                 onchange="updateQuantity(${index}, this.value)"
                 oninput="updateQuantity(${index}, this.value)">
          <span class="unit">g</span>
        </div>
        <span class="item-fiber" id="fiber-${index}">${fiberPerDay.toFixed(1)}g</span>
      </div>
    `;
  }).join('');
  
  if (elements.quantityEditorList) {
    elements.quantityEditorList.innerHTML = html;
  }
}

window.updateQuantity = function(index, value) {
  let weeklyQty = parseInt(value) || 0;
  const food = editingFoods[index];
  
  const minAmount = food.minAmount || 50;
  const maxAmount = food.maxAmount || 2000;
  weeklyQty = Math.max(0, Math.min(maxAmount, weeklyQty));
  
  food.weeklyAmount = weeklyQty;
  
  const dailyGrams = weeklyQty / 7;
  const fiberPerDay = (dailyGrams / 100) * food.fiber;
  
  const fiberEl = document.getElementById(`fiber-${index}`);
  if (fiberEl) fiberEl.textContent = fiberPerDay.toFixed(1) + 'g';
  
  updateFiberCalculation();
};

function updateFiberCalculation() {
  const totalFiberPerDay = editingFoods.reduce((sum, food) => {
    const dailyGrams = food.weeklyAmount / 7;
    return sum + (dailyGrams / 100) * food.fiber;
  }, 0);
  
  if (elements.calcDailyFiber) {
    elements.calcDailyFiber.textContent = totalFiberPerDay.toFixed(1) + 'g';
    
    if (totalFiberPerDay >= state.fiberGoal) {
      elements.calcDailyFiber.style.color = '#5a8f73';
    } else if (totalFiberPerDay >= state.fiberGoal * 0.8) {
      elements.calcDailyFiber.style.color = '#f2cc8f';
    } else {
      elements.calcDailyFiber.style.color = '#e07a5f';
    }
  }
}

function generateFromQuantities() {
  const planItems = editingFoods
    .filter(food => food.weeklyAmount > 0)
    .map(food => {
      const dailyGrams = food.weeklyAmount / 7;
      const dailyFiber = (dailyGrams / 100) * food.fiber;
      
      return {
        name: food.name,
        emoji: food.emoji,
        fiberPer100g: food.fiber,
        weeklyPerPerson: food.weeklyAmount,
        dailyGrams: Math.round(dailyGrams),
        dailyFiber: dailyFiber
      };
    });
  
  if (planItems.length === 0) {
    showToast('Please set quantities for at least one food!');
    return;
  }
  
  // Shopping list multiplied by number of people
  const shoppingList = planItems.map(item => ({
    name: item.name,
    emoji: item.emoji,
    dailyGrams: item.dailyGrams,
    totalGrams: item.weeklyPerPerson * state.peopleCount  // Multiply by people!
  }));
  
  closeAllModals();
  displayPlanResult(planItems, shoppingList);
}

function displayPlanResult(planItems, shoppingList) {
  const totalDailyFiber = planItems.reduce((sum, p) => sum + p.dailyFiber, 0);
  const peopleText = state.peopleCount === 1 ? '1 persoană' : `${state.peopleCount} persoane`;
  
  if (elements.planGoalDisplay) {
    elements.planGoalDisplay.textContent = `${state.fiberGoal}g`;
  }
  if (elements.planTotalFiber) {
    elements.planTotalFiber.textContent = `${totalDailyFiber.toFixed(1)}g`;
  }
  
  const planHtml = `
    <div class="plan-section">
      <h4>👤 Daily Portions (per person)</h4>
      <div class="plan-items-grid">
        ${planItems.map(item => `
          <div class="plan-result-item">
            <span class="emoji">${item.emoji}</span>
            <div class="details">
              <div class="name">${item.name}</div>
              <div class="portion">${item.dailyGrams}g/day</div>
            </div>
            <div class="fiber-amount">${item.dailyFiber.toFixed(1)}g</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const totalWeeklyGrams = shoppingList.reduce((sum, item) => sum + item.totalGrams, 0);
  const shoppingHtml = `
    <div class="plan-section shopping">
      <h4>🛒 Shopping List (for ${peopleText})</h4>
      <div class="shopping-grid">
        ${shoppingList.map(item => `
          <div class="shopping-result-item">
            <span class="emoji">${item.emoji}</span>
            <span class="name">${item.name}</span>
            <span class="amount">${formatWeight(item.totalGrams)}</span>
          </div>
        `).join('')}
      </div>
      <div class="shopping-note">
        🛒 Total: ${formatWeight(totalWeeklyGrams)} for ${peopleText} × 7 days<br>
        👤 Each person gets ~${totalDailyFiber.toFixed(1)}g fibre/day
      </div>
    </div>
  `;
  
  if (elements.planResultList) {
    elements.planResultList.innerHTML = planHtml + shoppingHtml;
  }
  
  tempWeeklyPlan = planItems;
  tempShoppingList = shoppingList;
  
  openModal('plan-result-modal');
}

// ==========================================
// Quick Add Modal
// ==========================================

function initQuickAdd() {
  if (elements.addFoodBtn) {
    elements.addFoodBtn.addEventListener('click', openQuickAddModal);
  }
  
  if (elements.foodSearch) {
    elements.foodSearch.addEventListener('input', (e) => {
      filterQuickAddList(e.target.value);
    });
  }
  
  if (elements.portionAmount) {
    elements.portionAmount.addEventListener('input', updateFiberPreview);
  }
  
  if (elements.confirmAddBtn) {
    elements.confirmAddBtn.addEventListener('click', confirmQuickAdd);
  }
}

function openQuickAddModal() {
  if (elements.foodSearch) elements.foodSearch.value = '';
  if (elements.portionInput) elements.portionInput.style.display = 'none';
  if (elements.quickAddList) elements.quickAddList.style.display = 'flex';
  window.selectedQuickFood = null;
  populateQuickAddList();
  openModal('quick-add-modal');
}

function populateQuickAddList() {
  const allFoods = [
    ...FOODS.vegetables,
    ...FOODS.fruits,
    ...FOODS.legumes,
    ...(FOODS.nuts || []),
    ...FOODS.wholeGrains
  ].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  
  renderQuickAddList(allFoods);
}

function filterQuickAddList(query) {
  const allFoods = [
    ...FOODS.vegetables,
    ...FOODS.fruits,
    ...FOODS.legumes,
    ...(FOODS.nuts || []),
    ...FOODS.wholeGrains
  ];
  
  const filtered = query 
    ? allFoods.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : allFoods.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  
  renderQuickAddList(filtered);
}

function renderQuickAddList(foods) {
  const html = foods.map(food => `
    <div class="quick-food-item" onclick="selectQuickFood('${food.name.replace(/'/g, "\\'")}', ${food.fiber}, '${food.emoji}')">
      <span class="emoji">${food.emoji}</span>
      <span class="name">${food.name}</span>
      <span class="fiber">${food.fiber}g/100g</span>
    </div>
  `).join('');
  
  if (elements.quickAddList) {
    elements.quickAddList.innerHTML = html || '<p style="text-align:center;padding:1rem;">No foods found</p>';
  }
}

window.selectQuickFood = function(name, fiber, emoji) {
  window.selectedQuickFood = { name, fiber, emoji };
  if (elements.selectedFoodDisplay) {
    elements.selectedFoodDisplay.innerHTML = `${emoji} ${name}`;
  }
  if (elements.portionAmount) elements.portionAmount.value = 100;
  updateFiberPreview();
  if (elements.quickAddList) elements.quickAddList.style.display = 'none';
  if (elements.portionInput) elements.portionInput.style.display = 'block';
};

function updateFiberPreview() {
  if (!window.selectedQuickFood) return;
  const portion = parseFloat(elements.portionAmount?.value) || 0;
  const fiber = (portion / 100) * window.selectedQuickFood.fiber;
  if (elements.fiberPreviewValue) {
    elements.fiberPreviewValue.textContent = fiber.toFixed(1);
  }
}

async function confirmQuickAdd() {
  if (!window.selectedQuickFood) return;
  
  const portion = parseFloat(elements.portionAmount?.value) || 0;
  const fiber = (portion / 100) * window.selectedQuickFood.fiber;
  
  const todayLog = getTodayLog();
  todayLog.foods.push({
    name: window.selectedQuickFood.name,
    emoji: window.selectedQuickFood.emoji,
    portion,
    fiber
  });
  todayLog.totalFiber += fiber;
  
  await saveDailyLog();
  closeAllModals();
  updateDashboard();
  showToast(`Added ${window.selectedQuickFood.name}! +${fiber.toFixed(1)}g fibre 🌿`);
}

// ==========================================
// Settings
// ==========================================

function initSettings() {
  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', saveSettingsHandler);
  }
  if (elements.resetWeekBtn) {
    elements.resetWeekBtn.addEventListener('click', resetWeek);
  }
  
  const logoutBtn = document.getElementById('logout-settings-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

function loadSettingsUI() {
  if (elements.fiberGoalInput) {
    elements.fiberGoalInput.value = state.fiberGoal;
  }
  if (elements.name1Input && state.profile) {
    elements.name1Input.value = state.profile.name || '';
  }
}

async function saveSettingsHandler() {
  state.fiberGoal = parseInt(elements.fiberGoalInput?.value) || 35;
  if (state.profile) {
    state.profile.name = elements.name1Input?.value.trim() || state.profile.name;
    state.profile.fiber_goal = state.fiberGoal;
  }
  
  await saveProfile();
  showToast('Settings saved! 💾');
  updateDashboard();
}

async function resetWeek() {
  if (confirm('Reset this week\'s logs?')) {
    state.dailyLogs = {};
    // Note: We'd need to delete from database too
    showToast('Week reset! Fresh start! 🌟');
    updateDashboard();
    updateWeeklyView();
  }
}

async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    await auth.signOut();
  }
}

// ==========================================
// Helpers
// ==========================================

function initNumberInputs() {
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      
      const step = parseFloat(input.step) || 1;
      const min = parseFloat(input.min) || 0;
      const max = parseFloat(input.max) || Infinity;
      let value = parseFloat(input.value) || 0;
      
      if (btn.classList.contains('minus')) {
        value = Math.max(min, value - step);
      } else {
        value = Math.min(max, value + step);
      }
      
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.classList.remove('active');
  });
  if (elements.quickAddList) elements.quickAddList.style.display = 'flex';
  if (elements.portionInput) elements.portionInput.style.display = 'none';
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==========================================
// Email Shopping List
// ==========================================

window.emailShoppingList = function() {
  openModal('email-modal');
  
  const sendBtn = document.getElementById('send-email-btn');
  const copyBtn = document.getElementById('copy-list-btn');
  
  sendBtn.onclick = sendEmailWithList;
  copyBtn.onclick = copyListToClipboard;
};

function getShoppingListText() {
  if (!state.shoppingList || state.shoppingList.length === 0) {
    return 'No shopping list available.';
  }
  
  let text = '🛒 SHOPPING LIST - FibreLove\n';
  text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  state.shoppingList.forEach(item => {
    const amount = formatWeight(item.totalGrams);
    text += `${item.emoji} ${item.name}: ${amount}\n`;
  });
  
  const totalGrams = state.shoppingList.reduce((sum, item) => sum + item.totalGrams, 0);
  const peopleText = state.peopleCount === 1 ? '1 persoană' : `${state.peopleCount} persoane`;
  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📦 Total: ${formatWeight(totalGrams)}\n`;
  text += `👥 For ${peopleText} × 7 days\n`;
  text += `🎯 Goal: ${state.fiberGoal}g fibre/person/day\n`;
  text += `\n💕 Sent from FibreLove`;
  
  return text;
}

function sendEmailWithList() {
  const emailInput = document.getElementById('email-address');
  const email = emailInput.value.trim();
  
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address!');
    return;
  }
  
  const subject = encodeURIComponent('🛒 Shopping List - FibreLove');
  const body = encodeURIComponent(getShoppingListText());
  
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  
  closeAllModals();
  showToast('Opening your email app... 📧');
}

function copyListToClipboard() {
  const text = getShoppingListText();
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Shopping list copied! 📋');
    closeAllModals();
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Shopping list copied! 📋');
    closeAllModals();
  });
}
