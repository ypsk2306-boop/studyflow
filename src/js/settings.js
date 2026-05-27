// Settings Module for StudyFlow
import { getActiveUser, getActiveUserEmail, updateActiveUserProfile, getState, updateActiveUserSettings } from './state.js';

export function initSettings() {
  const btnProfile = document.getElementById('btn-settings-profile');
  const btnHelp = document.getElementById('btn-settings-help');
  const profileContent = document.getElementById('settings-profile-content');
  const helpContent = document.getElementById('settings-help-content');

  if (!btnProfile || !btnHelp || !profileContent || !helpContent) return;

  // Settings view Sub-tabs switching
  btnProfile.addEventListener('click', () => {
    btnProfile.classList.add('active');
    btnHelp.classList.remove('active');
    profileContent.style.display = 'block';
    helpContent.style.display = 'none';
  });

  btnHelp.addEventListener('click', () => {
    btnHelp.classList.add('active');
    btnProfile.classList.remove('active');
    helpContent.style.display = 'block';
    profileContent.style.display = 'none';
  });

  // Interactive FAQs Accordion Clicks
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      const isActive = question.classList.contains('active');

      // Close all other answers for a clean accordion effect
      document.querySelectorAll('.faq-question').forEach(q => {
        if (q !== question) {
          q.classList.remove('active');
          q.nextElementSibling.classList.remove('show');
        }
      });

      // Toggle current
      if (isActive) {
        question.classList.remove('active');
        answer.classList.remove('show');
      } else {
        question.classList.add('active');
        answer.classList.add('show');
      }
    });
  });

  // Profile Form update listener
  const form = document.getElementById('settings-profile-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const successEl = document.getElementById('settings-success-msg');
      const errorEl = document.getElementById('settings-error-msg');
      
      successEl.style.display = 'none';
      errorEl.style.display = 'none';

      const emailVal = document.getElementById('settings-email-input').value;

      // Determine what is being updated
      const currentEmail = getActiveUserEmail();
      const isEmailChanged = (emailVal.trim() !== currentEmail.trim());

      if (isEmailChanged) {
        // Update Profile state
        const result = await updateActiveUserProfile(emailVal);
        if (!result.success) {
          errorEl.textContent = result.message || 'Failed to update profile details.';
          errorEl.style.display = 'block';
          return;
        }
      }

      // Save Preferences settings (this runs either after successful profile update or when only settings changed)
      const autoStartVal = document.getElementById('settings-auto-start').checked;
      const ambientEnabledVal = document.getElementById('settings-ambient-enabled').checked;
      const pomoTimeVal = parseInt(document.getElementById('settings-pomo-time').value) || 25;
      const shortTimeVal = parseInt(document.getElementById('settings-short-time').value) || 5;
      const longTimeVal = parseInt(document.getElementById('settings-long-time').value) || 15;
      const dailyGoalVal = parseInt(document.getElementById('settings-daily-goal').value) || 120;

      updateActiveUserSettings({
        autoStart: autoStartVal,
        ambientSoundEnabled: ambientEnabledVal,
        pomodoroTime: pomoTimeVal,
        shortBreakTime: shortTimeVal,
        longBreakTime: longTimeVal,
        dailyGoalMinutes: dailyGoalVal
      });

      successEl.style.display = 'block';
      
      // Auto-hide success banner
      setTimeout(() => {
        successEl.style.display = 'none';
      }, 4000);
    });
  }
}

export function renderSettings() {
  const username = getActiveUser();
  const email = getActiveUserEmail();
  const state = getState();
  const settings = state.settings || {};

  const userDisplay = document.getElementById('settings-username-display');
  const emailInput = document.getElementById('settings-email-input');

  if (userDisplay) userDisplay.value = username || 'Guest User';
  if (emailInput) emailInput.value = email || '';

  // Load preferences inputs
  const autoStartInput = document.getElementById('settings-auto-start');
  const ambientEnabledInput = document.getElementById('settings-ambient-enabled');
  const pomoInput = document.getElementById('settings-pomo-time');
  const shortInput = document.getElementById('settings-short-time');
  const longInput = document.getElementById('settings-long-time');
  const goalInput = document.getElementById('settings-daily-goal');

  if (autoStartInput) autoStartInput.checked = !!settings.autoStart;
  if (ambientEnabledInput) ambientEnabledInput.checked = settings.ambientSoundEnabled !== false;
  if (pomoInput) pomoInput.value = settings.pomodoroTime || 25;
  if (shortInput) shortInput.value = settings.shortBreakTime || 5;
  if (longInput) longInput.value = settings.longBreakTime || 15;
  if (goalInput) goalInput.value = settings.dailyGoalMinutes || 120;

  // Reset display banners
  const successEl = document.getElementById('settings-success-msg');
  const errorEl = document.getElementById('settings-error-msg');
  if (successEl) successEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  // Make sure profile tab is default open on view load
  const btnProfile = document.getElementById('btn-settings-profile');
  if (btnProfile) btnProfile.click();
}
