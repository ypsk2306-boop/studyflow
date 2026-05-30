// Authentication Module for StudyFlow
import { getActiveUser, loginUser, registerUser, logoutUser, verifyUserCredentials, resetUserPassword, isUsernameTaken } from './state.js';
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

  // Check if localStorage is available
  if (!isLocalStorageAvailable()) {
    const warningEl = document.getElementById('auth-storage-warning');
    if (warningEl) {
      warningEl.style.display = 'block';
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  }

  // Tabs Switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.style.display = 'flex';
    signupForm.style.display = 'none';
    const otpPanel = document.getElementById('otp-panel');
    if (otpPanel) otpPanel.style.display = 'none';
    const forgotForm = document.getElementById('forgot-password-form');
    const resetPanel = document.getElementById('reset-password-panel');
    if (forgotForm) forgotForm.style.display = 'none';
    if (resetPanel) resetPanel.style.display = 'none';
    
    // Explicitly make sure the options row is visible on login tab active
    const optionsRow = document.querySelector('.login-options-row');
    if (optionsRow) optionsRow.style.display = 'flex';
    
    hideErrors();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.style.display = 'flex';
    loginForm.style.display = 'none';
    const otpPanel = document.getElementById('otp-panel');
    if (otpPanel) otpPanel.style.display = 'none';
    const forgotForm = document.getElementById('forgot-password-form');
    const resetPanel = document.getElementById('reset-password-panel');
    if (forgotForm) forgotForm.style.display = 'none';
    if (resetPanel) resetPanel.style.display = 'none';
    hideErrors();
  });

  // Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideErrors();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const staySignedInInput = document.getElementById('login-stay-signed-in');
    const errorEl = document.getElementById('login-error');

    const staySignedIn = staySignedInInput ? staySignedInInput.checked : false;

    try {
      const result = await loginUser(usernameInput.value, passwordInput.value, staySignedIn);

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

  // Signup Submit (OTP verification flow)
  signupForm.addEventListener('submit', async (e) => {
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

      if (isUsernameTaken(usernameInput.value)) {
        errorEl.textContent = 'Username already registered.';
        errorEl.style.display = 'block';
        return;
      }

      // Save credentials temporarily for registration after OTP check
      tempSignupData.username = usernameInput.value;
      tempSignupData.email = emailInput.value;
      tempSignupData.password = passwordInput.value;

      // Generate verification OTP code
      generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      const formatted = `${generatedOTP.slice(0,3)} ${generatedOTP.slice(3)}`;

      // Retrieve stored SMTP config if available
      let smtpParams = {};
      const smtpConfigStr = localStorage.getItem('studyflow_smtp_config');
      if (smtpConfigStr) {
        try {
          smtpParams = JSON.parse(smtpConfigStr);
        } catch (e) {
          console.error("Failed to parse local SMTP config", e);
        }
      }

      // Send OTP via backend email endpoint
      try {
        await fetch('http://localhost:3000/api/send-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            email: emailInput.value, 
            otp: formatted,
            smtpServer: smtpParams.smtpServer || '',
            smtpPort: smtpParams.smtpPort || '',
            smtpUser: smtpParams.smtpUser || '',
            smtpPass: smtpParams.smtpPass || ''
          })
        });
      } catch (fetchErr) {
        console.error("Failed to send OTP email:", fetchErr);
      }

      // Hide signup form and show OTP verification panel
      signupForm.style.display = 'none';
      const otpPanel = document.getElementById('otp-panel');
      if (otpPanel) {
        otpPanel.style.display = 'flex';
        const emailDisplay = document.getElementById('otp-email-display');
        if (emailDisplay) emailDisplay.textContent = emailInput.value;
        startResendTimer();
      }
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
            const otpPanel = document.getElementById('otp-panel');
            if (otpPanel) otpPanel.style.display = 'none';
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
      const otpPanel = document.getElementById('otp-panel');
      if (otpPanel) otpPanel.style.display = 'none';
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

  // --- PASSWORD RECOVERY LISTENERS ---
  const forgotLink = document.getElementById('forgot-password-link');
  const forgotForm = document.getElementById('forgot-password-form');
  const resetPanel = document.getElementById('reset-password-panel');
  const forgotBackBtn = document.getElementById('forgot-back-btn');
  const resetBackBtn = document.getElementById('reset-back-btn');
  const resetSubmitBtn = document.getElementById('reset-submit-btn');

  // Handle forgot password click
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      if (document.querySelector('.auth-tabs')) {
        document.querySelector('.auth-tabs').style.display = 'none';
      }
      if (forgotForm) {
        forgotForm.style.display = 'flex';
        document.getElementById('forgot-username').value = '';
        document.getElementById('forgot-email').value = '';
      }
      hideErrors();
    });
  }

  // Back from forgot password form to login
  if (forgotBackBtn) {
    forgotBackBtn.addEventListener('click', () => {
      if (forgotForm) forgotForm.style.display = 'none';
      if (document.querySelector('.auth-tabs')) {
        document.querySelector('.auth-tabs').style.display = 'flex';
      }
      loginForm.style.display = 'flex';
      hideErrors();
      hideSimulatedEmailToast();
    });
  }

  // Handle forgot password form submit (verify & trigger OTP)
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameVal = document.getElementById('forgot-username').value;
      const emailVal = document.getElementById('forgot-email').value;
      const errorEl = document.getElementById('forgot-error');
      
      errorEl.style.display = 'none';
      
      const verification = verifyUserCredentials(usernameVal, emailVal);
      if (verification.success) {
        // Temp save username for reset context
        tempSignupData.username = usernameVal;
        
        // Generate recovery OTP code
        generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const formatted = `${generatedOTP.slice(0,3)} ${generatedOTP.slice(3)}`;
        
        // Retrieve stored SMTP config if available
        let smtpParams = {};
        const smtpConfigStr = localStorage.getItem('studyflow_smtp_config');
        if (smtpConfigStr) {
          try {
            smtpParams = JSON.parse(smtpConfigStr);
          } catch (e) {
            console.error("Failed to parse local SMTP config", e);
          }
        }

        // Send OTP via backend email endpoint
        try {
          await fetch('http://localhost:3000/api/send-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              email: emailVal, 
              otp: formatted,
              smtpServer: smtpParams.smtpServer || '',
              smtpPort: smtpParams.smtpPort || '',
              smtpUser: smtpParams.smtpUser || '',
              smtpPass: smtpParams.smtpPass || ''
            })
          });
        } catch (fetchErr) {
          console.error("Failed to send OTP email:", fetchErr);
        }
        
        // Show Reset Password panel
        forgotForm.style.display = 'none';
        if (resetPanel) {
          resetPanel.style.display = 'flex';
          document.getElementById('reset-new-password').value = '';
          document.getElementById('reset-confirm-password').value = '';
          document.querySelectorAll('.reset-otp-input-box').forEach(box => box.value = '');
        }
      } else {
        errorEl.textContent = verification.message;
        errorEl.style.display = 'block';
      }
    });
  }

  // Setup Recovery OTP Digits Inputs Focus Shifts
  const resetOtpInputs = document.querySelectorAll('.reset-otp-input-box');
  resetOtpInputs.forEach((input, index) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        input.value = '';
        const prev = resetOtpInputs[index - 1];
        if (prev) prev.focus();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = resetOtpInputs[index - 1];
        if (prev) prev.focus();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = resetOtpInputs[index + 1];
        if (next) next.focus();
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') return;
      if (!/[0-9]/.test(e.key)) e.preventDefault();
    });

    input.addEventListener('input', () => {
      if (input.value.length > 0) {
        const next = resetOtpInputs[index + 1];
        if (next) next.focus();
      }
    });
  });

  // Cancel reset password
  if (resetBackBtn) {
    resetBackBtn.addEventListener('click', () => {
      if (resetPanel) resetPanel.style.display = 'none';
      if (document.querySelector('.auth-tabs')) {
        document.querySelector('.auth-tabs').style.display = 'flex';
      }
      loginForm.style.display = 'flex';
      hideErrors();
      hideSimulatedEmailToast();
    });
  }

  // Handle password reset submit
  if (resetSubmitBtn) {
    resetSubmitBtn.addEventListener('click', async () => {
      const errorEl = document.getElementById('reset-error');
      errorEl.style.display = 'none';

      // Gather OTP
      let enteredCode = '';
      resetOtpInputs.forEach(box => {
        enteredCode += box.value;
      });

      if (enteredCode.length < 6) {
        errorEl.textContent = 'Please enter all 6 digits.';
        errorEl.style.display = 'block';
        return;
      }

      if (enteredCode !== generatedOTP) {
        errorEl.textContent = 'Incorrect verification code. Please check your simulated email toast.';
        errorEl.style.display = 'block';
        return;
      }

      const newPasswordInput = document.getElementById('reset-new-password');
      const confirmPasswordInput = document.getElementById('reset-confirm-password');

      if (newPasswordInput.value.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters long.';
        errorEl.style.display = 'block';
        return;
      }

      if (newPasswordInput.value !== confirmPasswordInput.value) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        const result = await resetUserPassword(tempSignupData.username, newPasswordInput.value);
        if (result.success) {
          if (resetPanel) resetPanel.style.display = 'none';
          if (document.querySelector('.auth-tabs')) {
            document.querySelector('.auth-tabs').style.display = 'flex';
          }
          hideSimulatedEmailToast();
          handleAuthSuccess();
        } else {
          errorEl.textContent = result.message || 'Failed to reset password.';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        console.error("Password reset error:", err);
        errorEl.textContent = 'An unexpected error occurred. Please try again.';
        errorEl.style.display = 'block';
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
  const authTabs = document.querySelector('.auth-tabs');
  if (authTabs) {
    authTabs.style.display = 'flex';
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
  const forgotErr = document.getElementById('forgot-error');
  const resetErr = document.getElementById('reset-error');
  if (loginErr) loginErr.style.display = 'none';
  if (signupErr) signupErr.style.display = 'none';
  if (otpErr) otpErr.style.display = 'none';
  if (forgotErr) forgotErr.style.display = 'none';
  if (resetErr) resetErr.style.display = 'none';
}

function isLocalStorageAvailable() {
  try {
    const testKey = '__test_store_avail__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}
