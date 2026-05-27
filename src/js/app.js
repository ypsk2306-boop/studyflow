// Application entry point for StudyFlow
import { loadState, getState, syncPullAndMerge, getActiveUser } from './state.js';
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
  initBackups();

  // 4. Initialize Authentication overlay and handlers
  initAuth(onAuthSuccess);

  // 5. Run authentication verification check
  checkAuth(onAuthSuccess, null);

  // 6. Run cross-origin automatic sync pull in the background
  syncPullAndMerge().then((result) => {
    if (result && result.changed) {
      if (result.activeUserChanged) {
        checkAuth(onAuthSuccess, null);
      } else if (getActiveUser()) {
        onAuthSuccess();
      }
    }
  });

  // 7. Initial icons render
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

function initBackups() {
  const exportBtnAuth = document.getElementById('auth-backup-export');
  const importTriggerAuth = document.getElementById('auth-backup-import-trigger');
  const fileInputAuth = document.getElementById('auth-backup-file-input');

  const exportBtnSettings = document.getElementById('settings-backup-export');
  const importTriggerSettings = document.getElementById('settings-backup-import-trigger');
  const fileInputSettings = document.getElementById('settings-backup-file-input');

  const handleExport = () => {
    try {
      const data = localStorage.getItem('studyflow_app_state_multiuser');
      const backupData = data ? JSON.parse(data) : { users: [], activeUser: null };
      
      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `studyflow_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export backup: " + e.message);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const backupData = JSON.parse(text);
        
        if (backupData && (backupData.users !== undefined || backupData.activeUser !== undefined)) {
          localStorage.setItem('studyflow_app_state_multiuser', JSON.stringify(backupData));
          alert("Database restored successfully! The page will now reload.");
          window.location.reload();
        } else {
          alert("Invalid backup file format. Please upload a valid StudyFlow backup JSON file.");
        }
      } catch (err) {
        alert("Failed to parse backup file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (exportBtnAuth) exportBtnAuth.addEventListener('click', handleExport);
  if (exportBtnSettings) exportBtnSettings.addEventListener('click', handleExport);

  if (importTriggerAuth && fileInputAuth) {
    importTriggerAuth.addEventListener('click', () => fileInputAuth.click());
    fileInputAuth.addEventListener('change', handleImport);
  }

  if (importTriggerSettings && fileInputSettings) {
    importTriggerSettings.addEventListener('click', () => fileInputSettings.click());
    fileInputSettings.addEventListener('change', handleImport);
  }
}
