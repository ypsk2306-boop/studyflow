// Application entry point for StudyFlow
import { loadState, getState } from './state.js';
import { initRouter, registerRoute, switchTab } from './router.js';
import { renderDashboard } from './dashboard.js';
import { initPlanner, renderPlanner, openTaskModal } from './planner.js';
import { initTimer, renderTimer } from './timer.js';
import { initNotes, renderNotes } from './notes.js';
import { initAnalytics, renderAnalytics } from './analytics.js';
import { initSettings, renderSettings } from './settings.js';
import { initAuth, checkAuth } from './auth.js';

window.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize State Storage
  loadState();

  // 2. Register route callbacks
  registerRoute('dashboard', renderDashboard);
  registerRoute('planner', renderPlanner);
  registerRoute('timer', renderTimer);
  registerRoute('notes', renderNotes);
  registerRoute('analytics', renderAnalytics);
  registerRoute('settings', renderSettings);

  // 3. Initialize views controllers and navigation
  initPlanner();
  initTimer();
  initNotes();
  initAnalytics();
  initSettings();
  initHeaderActions();
  initRouter();

  // 4. Initialize Authentication overlay and handlers
  initAuth(onAuthSuccess);

  // 5. Run authentication verification check
  checkAuth(onAuthSuccess, null);

  // 6. Initial icons render
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });
});

// Executed when a user successfully logs in or logs out
function onAuthSuccess() {
  // Load workspace data for active profile
  const state = loadState();

  // Set default visual theme according to user profile preferences
  const theme = state.settings.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  
  // Highlight correct theme option in sidebar
  document.querySelectorAll('.theme-opt').forEach(opt => {
    if (opt.getAttribute('data-theme') === theme) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  // Force re-render of active workspace view
  const activeTabBtn = document.querySelector('.nav-btn.active');
  const activeTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'dashboard';
  switchTab(activeTab);

  // Refresh icons
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });
}

function initHeaderActions() {
  const quickPomo = document.getElementById('quick-pomodoro-btn');
  if (quickPomo) {
    quickPomo.addEventListener('click', () => {
      switchTab('timer');
    });
  }

  const quickTask = document.getElementById('quick-task-btn');
  if (quickTask) {
    quickTask.addEventListener('click', () => {
      openTaskModal({ status: 'todo' });
    });
  }

  // Mobile Sidebar Menu Toggle
  const toggleBtn = document.getElementById('mobile-menu-toggle-btn');
  const overlay = document.getElementById('sidebar-overlay');
  const container = document.querySelector('.app-container');
  
  if (toggleBtn && container) {
    toggleBtn.addEventListener('click', () => {
      container.classList.toggle('sidebar-open');
    });
  }
  
  if (overlay && container) {
    overlay.addEventListener('click', () => {
      container.classList.remove('sidebar-open');
    });
  }
  
  // Auto-close sidebar on mobile navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (container) {
        container.classList.remove('sidebar-open');
      }
    });
  });
}
