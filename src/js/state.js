// State Management for StudyFlow with Multi-User Profile Support

const STORAGE_KEY = 'studyflow_app_state_multiuser';

// Default State Templates for newly registered users
const DEFAULT_STATE = {
  tasks: [],
  sessions: [],
  notes: [],
  settings: {
    theme: 'dark',
    pomodoroTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    dailyGoalMinutes: 120,
    autoStart: false
  }
};

// Global multi-user wrapper state
let wrapperState = {
  users: [],
  activeUser: null
};

// Currently loaded single user workspace data
let appState = {
  tasks: [],
  sessions: [],
  notes: [],
  settings: { ...DEFAULT_STATE.settings }
};

// Helper to calculate dates relative to today
function getRelativeDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Load state from local storage
export function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      wrapperState = JSON.parse(data);
      wrapperState.users = wrapperState.users || [];
      
      if (wrapperState.activeUser) {
        const user = wrapperState.users.find(u => u.username === wrapperState.activeUser);
        if (user) {
          appState = user.state;
          // Fallback merges
          appState.tasks = appState.tasks || [];
          appState.sessions = appState.sessions || [];
          appState.notes = appState.notes || [];
          appState.settings = { ...DEFAULT_STATE.settings, ...appState.settings };
        } else {
          // Active user not found in list (corruption fallback)
          wrapperState.activeUser = null;
          clearAppState();
        }
      } else {
        clearAppState();
      }
    } else {
      wrapperState = { users: [], activeUser: null };
      clearAppState();
      saveState();
    }
  } catch (e) {
    console.error("Error reading localStorage, reverting to defaults", e);
    clearAppState();
  }
  return appState;
}

function clearAppState() {
  appState = {
    tasks: [],
    sessions: [],
    notes: [],
    settings: { ...DEFAULT_STATE.settings }
  };
}

// Save state back to local storage
export function saveState() {
  try {
    if (wrapperState.activeUser) {
      const user = wrapperState.users.find(u => u.username === wrapperState.activeUser);
      if (user) {
        user.state = appState;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrapperState));
  } catch (e) {
    console.error("Failed to write to localStorage", e);
  }
}

export function getState() {
  return appState;
}

export function getActiveUser() {
  return wrapperState.activeUser;
}

export function getActiveUserEmail() {
  if (!wrapperState.activeUser) return "";
  const user = wrapperState.users.find(u => u.username === wrapperState.activeUser);
  return user ? user.email : "";
}

/* MULTI-USER AUTH ACTIONS */

async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function registerUser(username, password, email) {
  const cleanName = username.trim();
  if (!cleanName) {
    return { success: false, message: 'Username cannot be blank.' };
  }
  
  // Check duplicate
  const exists = wrapperState.users.some(u => u.username.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return { success: false, message: 'Username already registered.' };
  }

  // Create a deep copy of template states for new user
  const initialUserState = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Add user
  wrapperState.users.push({
    username: cleanName,
    password: hashedPassword,
    email: email.trim(),
    state: initialUserState
  });
  
  wrapperState.activeUser = cleanName;
  appState = initialUserState;
  saveState();

  return { success: true };
}

export async function loginUser(username, password) {
  const cleanName = username.trim();
  const user = wrapperState.users.find(u => u.username.toLowerCase() === cleanName.toLowerCase());
  
  if (!user) {
    return { success: false, message: 'Invalid username or password.' };
  }

  const hashedPassword = await hashPassword(password);
  
  // Check if stored password is a SHA-256 hash (64 hex characters)
  const isHashed = /^[a-f0-9]{64}$/i.test(user.password);
  
  if (isHashed) {
    if (user.password !== hashedPassword) {
      return { success: false, message: 'Invalid username or password.' };
    }
  } else {
    // Old plaintext account fallback
    if (user.password !== password) {
      return { success: false, message: 'Invalid username or password.' };
    }
    // Auto-migrate to hashed password
    user.password = hashedPassword;
    saveState();
  }

  wrapperState.activeUser = user.username;
  appState = user.state;
  saveState();

  return { success: true };
}

export function logoutUser() {
  saveState(); // save workspace
  wrapperState.activeUser = null;
  clearAppState();
  saveState();
}

export async function updateActiveUserProfile(email, oldPassword, newPassword) {
  const activeUser = wrapperState.activeUser;
  if (!activeUser) {
    return { success: false, message: 'No active session found.' };
  }

  const user = wrapperState.users.find(u => u.username === activeUser);
  if (!user) {
    return { success: false, message: 'User profile not found.' };
  }

  // Validate old password
  const hashedOld = await hashPassword(oldPassword);
  const isHashed = /^[a-f0-9]{64}$/i.test(user.password);
  const matches = isHashed ? (user.password === hashedOld) : (user.password === oldPassword);
  
  if (!matches) {
    return { success: false, message: 'Incorrect current password.' };
  }

  // If changing password, check complexity and hash it
  if (newPassword && newPassword.trim() !== '') {
    if (newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }
    user.password = await hashPassword(newPassword);
  }

  // Update email
  if (email && email.trim() !== '') {
    user.email = email.trim();
  }

  saveState();
  return { success: true };
}

/* TASKS ACTIONS */
export function addTask(taskData) {
  const newTask = {
    id: `task-${Date.now()}`,
    title: taskData.title || 'New Task',
    subject: taskData.subject || 'General',
    priority: taskData.priority || 'medium',
    status: taskData.status || 'todo',
    estimatedPomos: parseInt(taskData.estimatedPomos) || 2,
    completedPomos: 0,
    dueDate: taskData.dueDate || '',
    createdAt: new Date().toISOString()
  };
  appState.tasks.push(newTask);
  saveState();
  return newTask;
}

export function updateTask(taskId, updatedFields) {
  const taskIndex = appState.tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    appState.tasks[taskIndex] = { ...appState.tasks[taskIndex], ...updatedFields };
    saveState();
    return appState.tasks[taskIndex];
  }
  return null;
}

export function deleteTask(taskId) {
  appState.tasks = appState.tasks.filter(t => t.id !== taskId);
  // Also unbind any notes or sessions linked
  appState.sessions.forEach(s => {
    if (s.taskId === taskId) s.taskId = null;
  });
  saveState();
}

/* SESSION TIMER ACTIONS */
export function addSession(sessionData) {
  const newSession = {
    id: `sess-${Date.now()}`,
    taskId: sessionData.taskId || null,
    taskTitle: sessionData.taskTitle || 'General Focus',
    duration: parseInt(sessionData.duration) || 25,
    date: getRelativeDateString(0),
    timestamp: Date.now(),
    type: sessionData.type || 'pomodoro',
    score: parseInt(sessionData.score) || 100
  };
  
  appState.sessions.push(newSession);
  
  // If tied to a task, increment completed Pomos
  if (sessionData.taskId && sessionData.type === 'pomodoro') {
    const task = appState.tasks.find(t => t.id === sessionData.taskId);
    if (task) {
      task.completedPomos = (task.completedPomos || 0) + 1;
    }
  }
  
  saveState();
  return newSession;
}

export function clearHistory() {
  appState.sessions = [];
  appState.tasks.forEach(t => t.completedPomos = 0);
  saveState();
}

/* NOTE WORKSPACE ACTIONS */
export function addNotePage(title, subject = 'General') {
  const newPage = {
    id: `page-${Date.now()}`,
    title: title || 'Untitled Page',
    subject: subject || 'General',
    updatedAt: new Date().toISOString(),
    blocks: [
      { id: `b-${Date.now()}-1`, type: 'text', content: '', placeholder: 'Press / for commands...' }
    ]
  };
  appState.notes.push(newPage);
  saveState();
  return newPage;
}

export function updateNotePage(pageId, updatedFields) {
  const page = appState.notes.find(n => n.id === pageId);
  if (page) {
    if (updatedFields.title !== undefined) page.title = updatedFields.title;
    if (updatedFields.subject !== undefined) page.subject = updatedFields.subject;
    if (updatedFields.blocks !== undefined) page.blocks = updatedFields.blocks;
    page.updatedAt = new Date().toISOString();
    saveState();
    return page;
  }
  return null;
}

export function deleteNotePage(pageId) {
  appState.notes = appState.notes.filter(n => n.id !== pageId);
  saveState();
}

/* STATISTICAL AGGREGATIONS */

export function getStreak() {
  const sessions = appState.sessions.filter(s => s.type === 'pomodoro');
  if (sessions.length === 0) return 0;
  
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort();
  const today = getRelativeDateString(0);
  const yesterday = getRelativeDateString(-1);
  
  if (!uniqueDates.includes(today) && !uniqueDates.includes(yesterday)) {
    return 0;
  }
  
  let streak = 0;
  let checkDate = new Date();
  
  if (!uniqueDates.includes(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const formatted = checkDate.toISOString().split('T')[0];
    if (uniqueDates.includes(formatted)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

export function getTodayStats() {
  const todayStr = getRelativeDateString(0);
  const todaySessions = appState.sessions.filter(s => s.date === todayStr);
  
  const focusTimeMinutes = todaySessions
    .filter(s => s.type === 'pomodoro')
    .reduce((sum, s) => sum + s.duration, 0);
    
  const completedTodayTasksCount = appState.tasks
    .filter(t => t.status === 'completed' && t.dueDate === todayStr).length;
  
  const activeTodayTasksCount = appState.tasks
    .filter(t => t.dueDate === todayStr).length;
    
  const pomodoroSessions = todaySessions.filter(s => s.type === 'pomodoro');
  const scoreAverage = pomodoroSessions.length > 0
    ? Math.round(pomodoroSessions.reduce((sum, s) => sum + s.score, 0) / pomodoroSessions.length)
    : 0;

  return {
    focusMinutes: focusTimeMinutes,
    completedTasks: appState.tasks.filter(t => t.status === 'completed').length,
    totalTasks: appState.tasks.length,
    activeTasksToday: activeTodayTasksCount,
    completedTasksToday: completedTodayTasksCount,
    streak: getStreak(),
    focusScore: scoreAverage || 100
  };
}

export function getAllSubjects() {
  const subjects = new Set();
  appState.tasks.forEach(t => { if (t.subject) subjects.add(t.subject); });
  appState.notes.forEach(n => { if (n.subject) subjects.add(n.subject); });
  return Array.from(subjects).filter(s => s.trim() !== "");
}

export function getSubjectDistribution() {
  const dist = {};
  appState.sessions.forEach(s => {
    if (s.type !== 'pomodoro') return;
    
    let subject = 'General';
    if (s.taskId) {
      const task = appState.tasks.find(t => t.id === s.taskId);
      if (task && task.subject) subject = task.subject;
    }
    
    dist[subject] = (dist[subject] || 0) + s.duration;
  });
  
  const total = Object.values(dist).reduce((sum, v) => sum + v, 0);
  return Object.keys(dist).map(subject => ({
    subject,
    minutes: dist[subject],
    percentage: total > 0 ? Math.round((dist[subject] / total) * 100) : 0
  }));
}

export function getWeeklyStudyData() {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyFocus = Array(7).fill(0).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return {
      dateStr: d.toISOString().split('T')[0],
      dayName: weekdays[d.getDay()],
      minutes: 0
    };
  });
  
  appState.sessions.forEach(s => {
    if (s.type !== 'pomodoro') return;
    const match = dailyFocus.find(f => f.dateStr === s.date);
    if (match) {
      match.minutes += s.duration;
    }
  });
  
  return dailyFocus.map(df => ({
    label: df.dayName,
    hours: parseFloat((df.minutes / 60).toFixed(1)),
    minutes: df.minutes
  }));
}

export function updateActiveUserSettings(settingsFields) {
  appState.settings = { ...appState.settings, ...settingsFields };
  saveState();
  return { success: true };
}
