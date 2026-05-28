// FlowAI Assistant Module for StudyFlow - Gemini-Inspired Study Buddy
import { getState, addTask, addNotePage, saveState, getTodayStats } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderPlanner } from './planner.js';
import { switchTab } from './router.js';

// Quiz Engine Global State
let quizState = {
  active: false,
  step: 0,
  score: 0
};

const quizQuestions = [
  {
    q: "What is the worst-case time complexity of searching a sorted array using Binary Search?",
    opts: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
    correct: 1, // "O(log n)"
    exp: "Binary search splits the search range in half with each iteration, resulting in O(log n) worst-case time complexity."
  },
  {
    q: "Which technique recommends dividing study time into 25-minute intervals separated by short breaks?",
    opts: ["Feynman Technique", "Spaced Repetition", "Pomodoro Technique", "Active Recall"],
    correct: 2, // "Pomodoro Technique"
    exp: "The Pomodoro Technique uses 25-minute focus blocks followed by 5-minute breaks to optimize mental stamina."
  },
  {
    q: "What is the primary cognitive benefit of Active Recall compared to passive re-reading?",
    opts: ["It increases reading speed", "It strengthens memory retrieval pathways", "It lets you study without getting tired", "It works best with background music"],
    correct: 1, // "It strengthens memory retrieval pathways"
    exp: "Active Recall challenges the brain to retrieve information from memory, which builds stronger neural connections than passive review."
  }
];

export function initAI() {
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = document.getElementById('ai-chat-input');
  const chatMessages = document.getElementById('ai-chat-messages');

  if (!chatForm || !chatInput || !chatMessages) return;

  // Bind submit event
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // Send user message
    appendMessage('user', prompt);
    chatInput.value = '';

    // If quiz is active, route any text input as an attempt to type option index/name
    if (quizState.active) {
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        const parsedIdx = parseInt(prompt) - 1;
        if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < 4) {
          handleQuizAnswer(parsedIdx);
        } else {
          // Attempt to match text options
          const quest = quizQuestions[quizState.step];
          const matchedIdx = quest.opts.findIndex(o => o.toLowerCase() === prompt.toLowerCase());
          if (matchedIdx !== -1) {
            handleQuizAnswer(matchedIdx);
          } else {
            appendMessage('ai', `
              <div>
                <p>⚠️ Quiz in progress! Please click one of the option buttons below or enter the corresponding number (1, 2, 3, or 4):</p>
                <p style="margin-top: 4px; font-style: italic;">"${quest.q}"</p>
              </div>
            `);
          }
        }
      }, 800);
      return;
    }

    // Generate response with typing indicator simulation
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      const response = generateResponse(prompt);
      appendMessage('ai', response);
      
      // Update dashboard & planner UI if plan/breakdown was queried
      const query = prompt.toLowerCase();
      if (query.includes('plan') || query.includes('breakdown') || query.includes('break down')) {
        renderDashboard();
        renderPlanner();
      }
    }, 1000);
  });

  // Bind quick action chips
  document.querySelectorAll('.ai-chip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      let promptText = '';

      if (action === 'plan') promptText = 'Plan study';
      else if (action === 'breakdown') promptText = 'Break down tasks';
      else if (action === 'tips') promptText = 'Focus tips';
      else if (action === 'audit') promptText = 'Productivity Audit';
      else if (action === 'quiz') promptText = 'Quick Quiz';
      else if (action === 'draft') promptText = 'Draft Study Note';

      if (promptText) {
        appendMessage('user', promptText);
        showTyping(true);
        setTimeout(() => {
          showTyping(false);
          const response = handleAction(action);
          appendMessage('ai', response);
          
          // Re-render dashboard or planner in case state mutated
          renderDashboard();
          renderPlanner();
        }, 1000);
      }
    });
  });

  // Interactive Quiz Option Clicks Event Delegation
  chatMessages.addEventListener('click', (e) => {
    const quizOpt = e.target.closest('.ai-quiz-opt');
    if (quizOpt) {
      e.preventDefault();
      e.stopPropagation();
      const selectedIdx = parseInt(quizOpt.getAttribute('data-idx'));
      const textVal = quizOpt.textContent;
      appendMessage('user', textVal);
      showTyping(true);
      setTimeout(() => {
        showTyping(false);
        handleQuizAnswer(selectedIdx);
      }, 800);
    }
  });
}

function showTyping(show) {
  const indicator = document.getElementById('ai-typing-indicator');
  const messages = document.getElementById('ai-chat-messages');
  if (indicator && messages) {
    indicator.style.display = show ? 'block' : 'none';
    messages.scrollTop = messages.scrollHeight;
  }
}

function appendMessage(sender, text) {
  const messages = document.getElementById('ai-chat-messages');
  if (!messages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${sender}`;
  
  if (sender === 'ai') {
    msgDiv.innerHTML = text;
  } else {
    msgDiv.textContent = text;
  }

  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;

  // Re-initialize Lucide Icons inside the message content
  if (typeof lucide !== 'undefined') {
    lucide.createIcons({ attrs: { class: 'lucide-icon' } });
  }
}

function handleAction(action) {
  if (action === 'plan') return runPlanAction();
  if (action === 'breakdown') return runBreakdownAction();
  if (action === 'tips') return runTipsAction();
  if (action === 'audit') return runAuditAction();
  if (action === 'quiz') return runQuizAction();
  if (action === 'draft') return runDraftAction();
  return 'Unknown action requested.';
}

function runPlanAction() {
  const state = getState();
  const tasksToCreate = [
    { title: 'Review lecture notes & formulas', subject: 'Mathematics', priority: 'high', estimatedPomos: 2 },
    { title: 'Write code implementation draft', subject: 'Computer Science', priority: 'medium', estimatedPomos: 3 },
    { title: 'Proofread literature summary paper', subject: 'Literature', priority: 'low', estimatedPomos: 1 }
  ];

  tasksToCreate.forEach(t => {
    addTask({
      title: t.title,
      subject: t.subject,
      priority: t.priority,
      status: 'todo',
      estimatedPomos: t.estimatedPomos,
      dueDate: new Date().toISOString().split('T')[0]
    });
  });

  return `
    <div>
      <p>I've loaded a study plan for you today and automatically registered these tasks to your <strong>Study Planner</strong> board:</p>
      <ul style="padding-left: 18px; margin: 8px 0; display: flex; flex-direction: column; gap: 4px;">
        <li>🔴 <strong>[High]</strong> Review lecture notes & formulas (Mathematics)</li>
        <li>🟡 <strong>[Medium]</strong> Write code implementation draft (Computer Science)</li>
        <li>🟢 <strong>[Low]</strong> Proofread literature summary paper (Literature)</li>
      </ul>
      <p style="margin-top: 6px;">Head over to the <a href="#" class="ai-view-link" data-tab-link="planner" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Study Planner</a> to get started!</p>
    </div>
  `;
}

function runBreakdownAction() {
  const state = getState();
  const uncompleted = state.tasks.find(t => t.status !== 'completed');

  if (!uncompleted) {
    return `
      <div>
        <p>You don't have any uncompleted tasks in your planner right now!</p>
        <p style="margin-top: 6px;">Try creating a new task first by clicking <strong>Add Task</strong> at the top right, then ask me to break it down.</p>
      </div>
    `;
  }

  const subtasks = [
    { title: `[Breakdown] Phase 1: Review resources & prepare outline for "${uncompleted.title}"` },
    { title: `[Breakdown] Phase 2: Draft initial content & execute core steps for "${uncompleted.title}"` },
    { title: `[Breakdown] Phase 3: Final review & refine "${uncompleted.title}"` }
  ];

  subtasks.forEach(st => {
    addTask({
      title: st.title,
      subject: uncompleted.subject || 'General',
      priority: uncompleted.priority || 'medium',
      status: 'todo',
      estimatedPomos: Math.max(1, Math.round(uncompleted.estimatedPomos / 3)),
      dueDate: uncompleted.dueDate || new Date().toISOString().split('T')[0]
    });
  });

  return `
    <div>
      <p>I've analyzed your task <strong>"${uncompleted.title}"</strong> and generated 3 sub-tasks inside your Kanban board:</p>
      <ul style="padding-left: 18px; margin: 8px 0; display: flex; flex-direction: column; gap: 4px;">
        <li>📝 <strong>Phase 1:</strong> Outline & resource prep</li>
        <li>⚙️ <strong>Phase 2:</strong> Core drafting & execution</li>
        <li>✅ <strong>Phase 3:</strong> Review & refinement</li>
      </ul>
      <p style="margin-top: 6px;">They are ready for tracking in your <a href="#" class="ai-view-link" data-tab-link="planner" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Study Planner</a>.</p>
    </div>
  `;
}

function runTipsAction() {
  return `
    <div>
      <p>Here are some scientific study techniques recommended by Gemini:</p>
      <ul style="padding-left: 18px; margin: 8px 0; display: flex; flex-direction: column; gap: 6px;">
        <li>⏱️ <strong>Pomodoro Technique:</strong> Set a timer for 25 minutes, eliminate distractions, and work. Follow it with a 5-minute break to recharge.</li>
        <li>💡 <strong>Feynman Technique:</strong> Explain whatever you are studying in simple terms as if teaching a child. This immediately highlights gaps in your knowledge.</li>
        <li>🧠 <strong>Active Recall:</strong> Close your book/notes and quiz yourself directly from memory instead of passively re-reading the text.</li>
      </ul>
    </div>
  `;
}

function runAuditAction() {
  const stats = getTodayStats();
  const state = getState();

  const percentage = state.tasks.length > 0
    ? Math.round((state.tasks.filter(t => t.status === 'completed').length / state.tasks.length) * 100)
    : 0;

  let advice = '';
  if (stats.focusMinutes === 0) {
    advice = 'You haven\'t logged any focus sessions today. Try starting with a 25-minute Pomodoro timer in the Focus Room to get the momentum going!';
  } else if (stats.focusMinutes < 60) {
    advice = 'Great start on focus time! Make sure to take 5-minute short breaks to sustain your attention span for the rest of the day.';
  } else {
    advice = 'Superb dedication! You\'ve logged substantial focus hours. Keep self-testing with flashcards or active recall methods to solidify retention.';
  }

  const tasksTodo = state.tasks.filter(t => t.status !== 'completed');
  let taskAdvice = '';
  if (tasksTodo.length > 0) {
    const high = tasksTodo.filter(t => t.priority === 'high');
    if (high.length > 0) {
      taskAdvice = `You have ${high.length} pending High-Priority task(s) on your board. Target those first to alleviate cognitive pressure!`;
    } else {
      taskAdvice = `You have ${tasksTodo.length} pending task(s) to do. Try picking the shortest task to build small wins.`;
    }
  } else {
    taskAdvice = 'Amazing! You have cleared all pending tasks. Why not draft a new study note to prepare for tomorrow?';
  }

  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">🔍 Gemini Performance Diagnostics:</p>
      <ul style="padding-left: 18px; margin: 8px 0; display: flex; flex-direction: column; gap: 4px;">
        <li>⏱️ <strong>Focus Logged:</strong> ${stats.focusMinutes} minutes today</li>
        <li>🔥 <strong>Study Streak:</strong> ${stats.streak} day(s) active</li>
        <li>✅ <strong>Task Completion:</strong> ${percentage}% of tasks completed</li>
        <li>📓 <strong>Notebooks:</strong> ${state.notes.length} active study pages</li>
      </ul>
      <p style="margin-top: 6px; font-style: italic; color: var(--text-secondary); line-height: 1.3;">"${advice}"</p>
      <p style="margin-top: 4px; font-style: italic; color: var(--text-secondary); line-height: 1.3;">"${taskAdvice}"</p>
    </div>
  `;
}

function runQuizAction() {
  quizState.active = true;
  quizState.step = 0;
  quizState.score = 0;

  return `
    <div>
      <p style="color: var(--accent-secondary); font-weight: 600;">🏆 Gemini Interactive Quiz Started!</p>
      <p style="margin-top: 4px;">Test your knowledge. I will ask you 3 multiple-choice questions. Good luck!</p>
      <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
      ${askQuestion(0)}
    </div>
  `;
}

function askQuestion(step) {
  const quest = quizQuestions[step];
  let optionsHtml = `<div style="margin-top: 6px; display: flex; flex-direction: column; gap: 6px;">`;
  quest.opts.forEach((opt, idx) => {
    optionsHtml += `<button type="button" class="ai-quiz-opt" data-idx="${idx}">${idx + 1}. ${opt}</button>`;
  });
  optionsHtml += `</div>`;
  
  return `
    <div>
      <p style="font-weight: 600; color: var(--text-primary);">Question ${step + 1} of ${quizQuestions.length}:</p>
      <p style="margin-top: 4px; color: var(--text-secondary);">${quest.q}</p>
      ${optionsHtml}
    </div>
  `;
}

function handleQuizAnswer(selectedIdx) {
  if (!quizState.active) return;

  const quest = quizQuestions[quizState.step];
  const isCorrect = selectedIdx === quest.correct;

  if (isCorrect) {
    quizState.score++;
  }

  const resultTitle = isCorrect ? '🎉 Correct!' : '❌ Incorrect';
  const resultColor = isCorrect ? 'var(--priority-low)' : 'var(--priority-high)';
  
  const explanationBubble = `
    <div>
      <p style="color: ${resultColor}; font-weight: 600;">${resultTitle}</p>
      <p style="margin-top: 4px; color: var(--text-secondary); font-size: 12px; line-height: 1.3;">${quest.exp}</p>
    </div>
  `;
  appendMessage('ai', explanationBubble);

  quizState.step++;

  if (quizState.step < quizQuestions.length) {
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      appendMessage('ai', askQuestion(quizState.step));
    }, 1200);
  } else {
    quizState.active = false;
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      const summaryMsg = `
        <div style="border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 6px;">
          <p style="font-weight: 600; color: var(--accent-secondary);">🏁 Quiz Completed!</p>
          <p style="margin: 4px 0;">Final Score: <strong>${quizState.score} / ${quizQuestions.length} Correct</strong></p>
          <p style="font-size: 12px; color: var(--text-tertiary);">${quizState.score === quizQuestions.length ? '🏆 Perfect score! Your cognitive pathways are fully optimized.' : '📚 Good effort! Review focus tips to improve further.'}</p>
        </div>
      `;
      appendMessage('ai', summaryMsg);
    }, 1200);
  }
}

function runDraftAction() {
  const page = addNotePage('CS 101 - Algorithms & Big O', 'Computer Science');
  
  // Overwrite empty default blocks with gorgeous pre-formatted study notes templates
  page.blocks = [
    { id: `b-${Date.now()}-1`, type: 'h1', content: 'Computer Science: Time & Space Complexity' },
    { id: `b-${Date.now()}-2`, type: 'callout', content: '💡 <strong>Big O Notation</strong> is used in computer science to describe the performance or complexity of an algorithm based on the input size <em>n</em>.' },
    { id: `b-${Date.now()}-3`, type: 'h2', content: 'Standard Time Classifications' },
    { id: `b-${Date.now()}-4`, type: 'bullet', content: '<strong>O(1) - Constant Time:</strong> Speed remains identical regardless of size (e.g., array index lookup).' },
    { id: `b-${Date.now()}-5`, type: 'bullet', content: '<strong>O(log n) - Logarithmic Time:</strong> Size is halved with each iteration. Example: Binary Search.' },
    { id: `b-${Date.now()}-6`, type: 'bullet', content: '<strong>O(n) - Linear Time:</strong> Directly proportional to size. Example: traversing a single array loop.' },
    { id: `b-${Date.now()}-7`, type: 'bullet', content: '<strong>O(n log n) - Linearithmic Time:</strong> Efficient sorting procedures. Examples: Merge Sort, Quick Sort.' },
    { id: `b-${Date.now()}-8`, type: 'h2', content: 'Complexity Analysis Checklist' },
    { id: `b-${Date.now()}-9`, type: 'todo', content: 'Understand differences between Best-case, Average-case, and Worst-case bounds', checked: false },
    { id: `b-${Date.now()}-10`, type: 'todo', content: 'Solve 3 LeetCode search problems to check complexity', checked: false },
    { id: `b-${Date.now()}-11`, type: 'divider', content: '' },
    { id: `b-${Date.now()}-12`, type: 'h2', content: 'Code Sample (O(n) Linear Search)' },
    { id: `b-${Date.now()}-13`, type: 'code', content: 'def linear_search(arr, target):<br>&nbsp;&nbsp;&nbsp;&nbsp;for item in arr:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;if item == target:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return True<br>&nbsp;&nbsp;&nbsp;&nbsp;return False # Linear check' }
  ];

  saveState();
  
  // Set target page activePageId to open note tab directly
  window.activePageId = page.id;

  return `
    <div>
      <p>📝 I've drafted a comprehensive study notebook page for you: <strong>"CS 101 - Algorithms & Big O"</strong>!</p>
      <p style="margin: 4px 0 6px; font-size: 12px; color: var(--text-secondary);">It contains pre-formatted layout blocks, checklists, and code templates.</p>
      <p>
        <a href="#" class="ai-view-link" data-tab-link="notes" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">
          Open Notes tab to view it
        </a>
      </p>
    </div>
  `;
}

function runAboutExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-primary);">📘 About StudyFlow Workspace:</p>
      <p style="margin-top: 4px; line-height: 1.4; color: var(--text-secondary); font-size: 12px;">
        StudyFlow is a premium study companion designed to empower students to build disciplined habits, organize coursework, and maximize focus. Combining task planning, deep work timers, ambient soundtracks, and beautiful analytics, StudyFlow provides a cohesive local workstation for your academic success.
      </p>
      <p style="margin-top: 6px; line-height: 1.4; color: var(--text-secondary); font-size: 12px;">
        <strong>Technology Stack & Architecture:</strong> It runs fully client-side on HTML5, CSS variables themes (Dark, Light, Cozy Sepia), and ESM JavaScript Modules, storing data securely in your browser's local storage with SHA-256 password hashing.
      </p>
    </div>
  `;
}

function runFeaturesExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-primary);">🌟 Core Workspace Features:</p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>🎛️ <strong>Dashboard Overview:</strong> Live productivity stats, weekly study bar charts, daily goal rings, today's tasks list, and recent notes.</li>
        <li>📋 <strong>Study Planner & Kanban:</strong> Drag-and-drop task boards, filter by subjects, search, and due dates with priority tags.</li>
        <li>⏱️ <strong>Focus Room & Pomodoro:</strong> Timer presets with breathing rings, active task binding, and session tally dots.</li>
        <li>🎵 <strong>Ambient Sound Mixer:</strong> Adjust channels to blend Rain, Cafe, Binaural Waves, and Forest soundtracks.</li>
        <li>📝 <strong>Block Notes Workspace:</strong> Notion-like rich notebook supporting slash commands block elements.</li>
        <li>📊 <strong>Productivity Analytics:</strong> Streaks, weekly distributions, and subject breakdown pie charts.</li>
        <li>⚙️ <strong>Profile Settings:</strong> Timer intervals, SHA-256 hashed password updates, and visual themes.</li>
        <li>🔒 <strong>Offline Security:</strong> Full privacy with localized storage.</li>
      </ul>
      <p style="margin-top: 6px; font-size: 11px; color: var(--text-tertiary);">Ask me about any specific feature to learn how it works!</p>
    </div>
  `;
}

function runDashboardExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">🎛️ Dashboard Overview:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Dashboard is your main productivity command center, offering a snapshot of your daily achievements and study logs:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>📊 <strong>Overview Stat Cards:</strong> Tracks study stats in real time: Focus Time, Tasks Completed ratio, active Study Streak day count, and a Focus Score based on session completions.</li>
        <li>📈 <strong>Weekly Study Distribution:</strong> A native SVG bar chart illustrating your study hours over the last 7 days.</li>
        <li>🎯 <strong>Daily Study Goal Ring:</strong> A circular progress bar tracking how close you are to completing your daily target.</li>
        <li>📋 <strong>Today's Focus Tasks:</strong> Displays tasks due today with a direct link to the planner.</li>
        <li>📝 <strong>Recent Notes:</strong> Displays your most recently edited notebook pages.</li>
        <li>✨ <strong>FlowAI Assistant:</strong> Chat assistant, action chips, and interactive quiz.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="dashboard" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Dashboard</a>
      </p>
    </div>
  `;
}

function runPlannerExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">📋 Study Planner & Kanban Board:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Planner features a visual Kanban board to organize, prioritize, and track your study workflow:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>📂 <strong>Workflow Columns:</strong> Manage tasks across "To Do", "In Progress", and "Completed" stages. Drag and drop cards to update status.</li>
        <li>🏷️ <strong>Task Customization:</strong> Assign subject tags, priority levels (Low, Medium, High), and estimated Pomodoros.</li>
        <li>📅 <strong>Due Dates:</strong> Specify task deadlines with visual overdue indicators.</li>
        <li>🔍 <strong>Search & Filters:</strong> Filter tasks by subject or search by name and tags.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="planner" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Study Planner</a>
      </p>
    </div>
  `;
}

function runFocusExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">⏱️ Focus Room & Pomodoro Timer:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Focus Room is engineered for deep work sessions, designed to minimize distraction:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>⌛ <strong>Timer Presets:</strong> Toggle between "Pomodoro" (25m focus), "Short Break" (5m), and "Long Break" (15m).</li>
        <li>🌀 <strong>Breathing Animation Ring:</strong> A dynamic visual breathing circle synced to the countdown timer.</li>
        <li>🔗 <strong>Active Task Binding:</strong> Bind your focus session directly to a planner task to log time correctly.</li>
        <li>🎯 <strong>Session Tally:</strong> Tracks daily Pomodoro sessions visually with indicator dots.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="timer" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Focus Room</a>
      </p>
    </div>
  `;
}

function runAmbientMixerExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">🎵 Ambient Sound Mixer:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        Located in the Focus Room, the Ambient Mixer allows blending four high-quality soundtracks:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>🌧️ <strong>Cosy Rain:</strong> Gentle rainfall sound.</li>
        <li>☕ <strong>Parisian Cafe:</strong> Soft chatter and clinking dishes.</li>
        <li>Waves <strong>Binaural Waves:</strong> Focus-boosting low-frequency frequencies.</li>
        <li>🌲 <strong>Forest Canopy:</strong> Birds and rustling leaves.</li>
        <li>🎛️ <strong>Controls:</strong> Adjust volume sliders independently, or click icons to mute/unmute. Runs fully client-side on Web Audio API.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="timer" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Configure Sound Mixer</a>
      </p>
    </div>
  `;
}

function runNotesExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">📝 Block Notes Workspace:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Notes workspace is a flexible block-based text editor, similar to Notion, designed for rich academic writing:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>⌨️ <strong>Slash Commands:</strong> Type <kbd>/</kbd> on a new line to access the quick block insertion menu.</li>
        <li>🧱 <strong>Block Variety:</strong> Insert different elements: Heading 1, Heading 2, Bullet Lists, Checkbox Todo lists, callout info cards, code syntax boxes, and horizontal dividers.</li>
        <li>📂 <strong>Notebook Management:</strong> Add, rename, delete pages, and assign subject tags.</li>
        <li>💾 <strong>Autosave:</strong> Notes are automatically saved in local state as you type.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="notes" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Notes Workspace</a>
      </p>
    </div>
  `;
}

function runAnalyticsExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">📊 Productivity Analytics:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Analytics dashboard offers clear, visual insights into your study habits:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>📊 <strong>Weekly Study Distribution:</strong> A bar graph plotting study hours over the past 7 days.</li>
        <li>🍰 <strong>Subject Pie Chart:</strong> A breakdown showing the proportion of study time allocated to each subject.</li>
        <li>🎯 <strong>Daily Goal Progress:</strong> A progress ring tracking daily focus durations relative to daily targets.</li>
        <li>🔥 <strong>Study Streak Counter:</strong> Counts consecutive active days of focus to keep your motivation high.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="analytics" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Analytics</a>
      </p>
    </div>
  `;
}

function runSettingsExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">⚙️ Profile Settings & Customization:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        The Settings page lets you customize StudyFlow to align with your personal study habits:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>👤 <strong>Account Info:</strong> Modify email address.</li>
        <li>🔒 <strong>Cryptographic Passwords:</strong> Update passwords client-side using SHA-256 hashes.</li>
        <li>⏱️ <strong>Timer Durations:</strong> Customize Pomodoro focus, short break, and long break intervals.</li>
        <li>🎯 <strong>Daily Target Goal:</strong> Configure daily study goal in hours.</li>
        <li>📘 <strong>About App:</strong> Read app description, technology stack, architecture details, and licenses.</li>
      </ul>
      <p style="margin-top: 6px;">
        <a href="#" class="ai-view-link" data-tab-link="settings" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Open Settings</a>
      </p>
    </div>
  `;
}

function runThemesExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">🎨 Visual Themes & Aesthetics:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        StudyFlow is built with a premium glassmorphic UI, supporting three customized color themes:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>🌙 <strong>Dark Glass Mode:</strong> Futuristic dark background with frosted translucent panels, glow gradients, and neon blue highlights.</li>
        <li>☀️ <strong>Light Glass Mode:</strong> Clean, high-contrast light theme with frosted white glass plates and vivid accents.</li>
        <li>🍂 <strong>Cozy Sepia Mode:</strong> Warm, amber-toned reader theme that reduces eye strain during late-night study sessions.</li>
      </ul>
      <p style="margin-top: 4px; font-size: 12px; color: var(--text-secondary);">
        Switch themes instantly using the toggle buttons at the bottom of the sidebar!
      </p>
    </div>
  `;
}

function runSecurityExplanation() {
  return `
    <div>
      <p style="font-weight: 600; color: var(--accent-secondary);">🔒 Local Data & Cryptographic Security:</p>
      <p style="margin-top: 4px; line-height: 1.3; font-size: 12px; color: var(--text-secondary);">
        StudyFlow is designed with local privacy and data ownership in mind:
      </p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
        <li>💾 <strong>Offline-First Storage:</strong> All profile credentials, tasks, Pomodoro logs, streaks, and note blocks are saved strictly in your browser's private <code>localStorage</code> database. No data is transmitted to third-party servers.</li>
        <li>🔐 <strong>SHA-256 Hashing:</strong> Passwords are cryptographically hashed using the SHA-256 algorithm before writing to the database, ensuring plaintexts are never exposed.</li>
        <li>👥 <strong>Multi-Profile Support:</strong> Supports separate login profiles on the same browser sandbox.</li>
      </ul>
    </div>
  `;
}

function generateResponse(prompt) {
  const query = prompt.toLowerCase();

  // 1. Core Interactive Action Triggers
  if (query.includes('plan study') || query.includes('suggest plan') || (query.includes('plan') && query.includes('study') && !query.includes('how') && !query.includes('explain') && !query.includes('what'))) {
    return runPlanAction();
  }
  if (query.includes('break down') || query.includes('breakdown') || query.includes('subtask') || query.includes('sub-task')) {
    return runBreakdownAction();
  }
  if (query.includes('audit') || query.includes('diagnose') || query.includes('review') || query.includes('analyse') || query.includes('performance')) {
    return runAuditAction();
  }
  if (query.includes('start quiz') || (query.includes('quiz') && !query.includes('how') && !query.includes('explain') && !query.includes('what')) || query.includes('test') || query.includes('question')) {
    return runQuizAction();
  }
  if (query.includes('draft') || (query.includes('note') && query.includes('draft')) || (query.includes('write') && query.includes('note'))) {
    return runDraftAction();
  }
  if (query.includes('tip') || query.includes('method') || query.includes('active recall') || query.includes('feynman') || (query.includes('pomodoro') && query.includes('tip'))) {
    return runTipsAction();
  }

  // 2. Feature-specific Explanations & Knowledge Base
  if (query.includes('about the app') || query.includes('app description') || query.includes('about studyflow') || query.includes('description of the app') || query.includes('describe the app') || query.includes('what is studyflow') || query.includes('tell me about studyflow') || query.includes('about') || query.includes('description')) {
    return runAboutExplanation();
  }
  if (query.includes('all features') || query.includes('list features') || query.includes('what features') || query.includes('what can you do') || query.includes('what does this app do') || query.includes('explain features') || query.includes('workspace features') || query.includes('core features') || query.includes('app features')) {
    return runFeaturesExplanation();
  }
  if (query.includes('dashboard') || query.includes('overview card') || query.includes('today\'s tasks') || query.includes('recent notes')) {
    return runDashboardExplanation();
  }
  if (query.includes('planner') || query.includes('kanban') || query.includes('board') || query.includes('task board') || query.includes('todo') || query.includes('to do') || query.includes('in progress') || query.includes('drag and drop')) {
    return runPlannerExplanation();
  }
  if (query.includes('focus room') || query.includes('timer') || query.includes('pomodoro') || query.includes('breathing') || query.includes('session')) {
    return runFocusExplanation();
  }
  if (query.includes('sound') || query.includes('mixer') || query.includes('ambient') || query.includes('rain') || query.includes('cafe') || query.includes('binaural') || query.includes('forest') || query.includes('music') || query.includes('soundtrack')) {
    return runAmbientMixerExplanation();
  }
  if (query.includes('note') || query.includes('editor') || query.includes('block') || query.includes('slash command') || query.includes('notebook')) {
    return runNotesExplanation();
  }
  if (query.includes('analytics') || query.includes('chart') || query.includes('streak') || query.includes('stats') || query.includes('distribution') || query.includes('pie chart') || query.includes('bar chart') || query.includes('goal ring')) {
    return runAnalyticsExplanation();
  }
  if (query.includes('settings') || query.includes('profile') || query.includes('password') || query.includes('email') || query.includes('duration') || query.includes('interval')) {
    return runSettingsExplanation();
  }
  if (query.includes('theme') || query.includes('dark mode') || query.includes('light mode') || query.includes('sepia') || query.includes('style') || query.includes('look') || query.includes('cozy')) {
    return runThemesExplanation();
  }
  if (query.includes('security') || query.includes('hash') || query.includes('sha-256') || query.includes('localstorage') || query.includes('privacy') || query.includes('offline') || query.includes('private') || query.includes('encrypt') || query.includes('auth') || query.includes('login') || query.includes('signup') || query.includes('sign up')) {
    return runSecurityExplanation();
  }

  // 3. Conversational Response Fallbacks
  if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('welcome')) {
    return `
      <div>
        Hello! I'm <strong>FlowAI</strong>, your study assistant. 
        I can help you **plan your day**, **diagnose performance**, **draft notebook study notes**, **test you with quizzes**, or explain **focus tips**.
        How can I help you excel today?
      </div>
    `;
  }

  // Feynman Explainers
  if (query.includes('explain') || query.includes('what is') || query.includes('how does')) {
    let concept = prompt.replace(/explain/i, '').replace(/what is/i, '').replace(/how does/i, '').replace(/\?/g, '').trim();
    if (!concept) concept = "Active Learning";

    return `
      <div>
        <p style="font-weight: 600; color: var(--accent-secondary);">💡 Feynman Explanation: "${concept}"</p>
        <p style="margin-top: 4px; line-height: 1.3;">Let's explain this concept as simple as possible:</p>
        <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px;">
          <li>👶 <strong>Simple Analogy:</strong> Think of "${concept}" like a team puzzle where each pieces connect to form a cohesive picture.</li>
          <li>🎯 <strong>Key Insight:</strong> The core mechanism involves processing inputs efficiently and building structural layers to output solutions.</li>
          <li>📝 <strong>Takeaway:</strong> Don't just memorize it. Try to write down its definition in your own words inside your <a href="#" class="ai-view-link" data-tab-link="notes" style="color: var(--accent-secondary); text-decoration: underline; font-weight: 500;">Notes</a> tab.</li>
        </ul>
      </div>
    `;
  }

  return `
    <div>
      <p>I'm here to support you! For a highly productive study session:</p>
      <ul style="padding-left: 18px; margin: 6px 0; display: flex; flex-direction: column; gap: 4px;">
        <li>Bind a planner task in the Focus Room.</li>
        <li>Mix ambient sound blocks to block out distractions.</li>
        <li>Ask me to run a **productivity audit** or **start a quick quiz**.</li>
      </ul>
      <p style="margin-top: 6px;">What topic are you studying right now?</p>
    </div>
  `;
}

// Delegate view click link navigation
document.addEventListener('click', (e) => {
  const viewLink = e.target.closest('.ai-view-link');
  if (viewLink) {
    e.preventDefault();
    const tab = viewLink.getAttribute('data-tab-link');
    if (tab) switchTab(tab);
  }
});
