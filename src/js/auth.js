// Authentication Module for StudyFlow
import { getActiveUser, loginUser, registerUser, logoutUser } from './state.js';
import { switchTab } from './router.js';

let authSuccessCallback = null;
let generatedOTP = '';
let tempSignupData = { username: '', password: '', email: '' };
let resendTimerInterval = null;
let resendSecondsRemaining = 30;

export function initAuth(onAuthSuccess) {
  authSuccessCallback = onAuthSuccess;

  // Grab elements
  const tabLogin = document.getElementById('tab-login-btn');
  const tabSignup = document.getElementById('tab-signup-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (!tabLogin || !tabSignup || !loginForm || !signupForm) return;

  // Tabs Switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.style.display = 'flex';
    signupForm.style.display = 'none';
    document.getElementById('otp-panel').style.display = 'none';
    hideErrors();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.style.display = 'flex';
    loginForm.style.display = 'none';
    document.getElementById('otp-panel').style.display = 'none';
    hideErrors();
  });

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');

    try {
      const result = await loginUser(usernameInput.value, passwordInput.value);

      if (result.success) {
        handleAuthSuccess();
        usernameInput.value = '';
        passwordInput.value = '';
      } else {
        errorEl.textContent = result.message || 'Invalid credentials.';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      console.error("Login unexpected error:", err);
      errorEl.textContent = 'An unexpected error occurred during login. Please try again.';
      errorEl.style.display = 'block';
    }
  });

  // Signup Submit (Triggers OTP Step)
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideErrors();

    const usernameInput = document.getElementById('signup-username');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-confirm-password');
    const errorEl = document.getElementById('signup-error');

    try {
      if (passwordInput.value.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters long.';
        errorEl.style.display = 'block';
        return;
      }

      if (passwordInput.value !== confirmInput.value) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
      }

      // Cache temporary signup data
      tempSignupData = {
        username: usernameInput.value,
        password: passwordInput.value,
        email: emailInput.value
      };

      // Transition to OTP Screen
      signupForm.style.display = 'none';
      const otpPanel = document.getElementById('otp-panel');
      otpPanel.style.display = 'flex';
      
      // Set display text
      document.getElementById('otp-email-display').textContent = tempSignupData.email;

      // Generate & Display OTP
      triggerOTPGeneration();
    } catch (err) {
      console.error("Signup unexpected error:", err);
      errorEl.textContent = 'An unexpected error occurred. Please try again.';
      errorEl.style.display = 'block';
    }
  });

  // Setup OTP Digits Inputs Focus Shifts
  setupOTPDigitInputs();

  // Verify OTP button click
  const verifyBtn = document.getElementById('otp-verify-btn');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('otp-error');
      errorEl.style.display = 'none';

      // Gather input code
      let enteredCode = '';
      document.querySelectorAll('.otp-input-box').forEach(box => {
        enteredCode += box.value;
      });

      if (enteredCode.length < 6) {
        errorEl.textContent = 'Please enter all 6 digits.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        if (enteredCode === generatedOTP) {
          // Complete Signup Registration
          const result = await registerUser(tempSignupData.username, tempSignupData.password, tempSignupData.email);
          if (result.success) {
            // Success cleanup
            document.getElementById('otp-panel').style.display = 'none';
            document.getElementById('signup-username').value = '';
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-confirm-password').value = '';
            clearOTPDigits();
            hideSimulatedEmailToast();
            
            handleAuthSuccess();
          } else {
            errorEl.textContent = result.message || 'Registration failed.';
            errorEl.style.display = 'block';
          }
        } else {
          errorEl.textContent = 'Incorrect verification code. Please check your simulated email toast.';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        console.error("Verification unexpected error:", err);
        errorEl.textContent = 'An unexpected error occurred during registration. Please try again.';
        errorEl.style.display = 'block';
      }
    });
  }


  // Resend OTP Trigger click
  const resendBtn = document.getElementById('otp-resend-trigger');
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      if (resendSecondsRemaining === 0) {
        triggerOTPGeneration();
      }
    });
  }

  // Back to Sign Up click
  const backBtn = document.getElementById('otp-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      document.getElementById('otp-panel').style.display = 'none';
      signupForm.style.display = 'flex';
      clearOTPDigits();
      hideErrors();
      hideSimulatedEmailToast();
      clearInterval(resendTimerInterval);
    });
  }

  // Close simulated email toast
  const closeToastBtn = document.getElementById('toast-close-trigger');
  if (closeToastBtn) {
    closeToastBtn.addEventListener('click', hideSimulatedEmailToast);
  }

  // Logout Trigger
  const logoutBtn = document.getElementById('logout-trigger-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out of your workspace?')) {
        logoutUser();
        showAuthOverlay();
        switchTab('dashboard'); // go back to dashboard underlying
      }
    });
  }
}

function triggerOTPGeneration() {
  // Generate random 6 digit code
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Format code (e.g. 583 490)
  const formatted = `${generatedOTP.slice(0,3)} ${generatedOTP.slice(3)}`;

  // Show Toast
  const toast = document.getElementById('simulated-email-toast');
  const codeEl = document.getElementById('toast-otp-code');
  if (toast && codeEl) {
    codeEl.textContent = formatted;
    toast.style.display = 'flex';
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }

  // Reset resend countdown
  startResendTimer();
}

function setupOTPDigitInputs() {
  const inputs = document.querySelectorAll('.otp-input-box');
  
  inputs.forEach((input, index) => {
    // Only allow numeric input and handle backspaces
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        input.value = '';
        const prev = inputs[index - 1];
        if (prev) {
          prev.focus();
        }
        return;
      }
      
      // Navigation support
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = inputs[index - 1];
        if (prev) prev.focus();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = inputs[index + 1];
        if (next) next.focus();
        return;
      }

      if (e.key === 'Tab' || e.key === 'Enter') {
        return;
      }
      
      // Block non-numeric characters
      if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });

    input.addEventListener('input', () => {
      const val = input.value;
      if (val.length > 0) {
        // Auto-focus next
        const next = inputs[index + 1];
        if (next) {
          next.focus();
        }
      }
    });
  });
}

function startResendTimer() {
  clearInterval(resendTimerInterval);
  resendSecondsRemaining = 30;

  const btn = document.getElementById('otp-resend-trigger');
  const timerLabel = document.getElementById('otp-timer');

  if (!btn || !timerLabel) return;

  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.cursor = 'not-allowed';
  timerLabel.textContent = resendSecondsRemaining;

  resendTimerInterval = setInterval(() => {
    resendSecondsRemaining--;
    timerLabel.textContent = resendSecondsRemaining;

    if (resendSecondsRemaining <= 0) {
      clearInterval(resendTimerInterval);
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.innerHTML = 'Resend Code';
    } else {
      btn.innerHTML = `Resend in <span id="otp-timer">${resendSecondsRemaining}</span>s`;
    }
  }, 1000);
}

function clearOTPDigits() {
  document.querySelectorAll('.otp-input-box').forEach(box => {
    box.value = '';
  });
}

function hideSimulatedEmailToast() {
  const toast = document.getElementById('simulated-email-toast');
  if (toast) {
    toast.style.display = 'none';
  }
}

// Check current login state
export function checkAuth(onSuccess, onFailure) {
  const activeUser = getActiveUser();
  if (activeUser) {
    updateProfileDisplay(activeUser);
    if (onSuccess) onSuccess();
  } else {
    showAuthOverlay();
    if (onFailure) onFailure();
  }
}

function handleAuthSuccess() {
  const activeUser = getActiveUser();
  updateProfileDisplay(activeUser);
  
  // Hide overlay
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.style.opacity = 0;
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  if (authSuccessCallback) {
    authSuccessCallback();
  }
}

function showAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.style.opacity = 1;
  }
  const tabLogin = document.getElementById('tab-login-btn');
  if (tabLogin) tabLogin.click();
}

function updateProfileDisplay(username) {
  const nameDisplay = document.getElementById('user-name-display');
  const avatarDisplay = document.getElementById('user-avatar');
  
  if (nameDisplay) nameDisplay.textContent = username;
  if (avatarDisplay) {
    avatarDisplay.textContent = username.charAt(0).toUpperCase();
  }
}

function hideErrors() {
  const loginErr = document.getElementById('login-error');
  const signupErr = document.getElementById('signup-error');
  const otpErr = document.getElementById('otp-error');
  if (loginErr) loginErr.style.display = 'none';
  if (signupErr) signupErr.style.display = 'none';
  if (otpErr) otpErr.style.display = 'none';
}
