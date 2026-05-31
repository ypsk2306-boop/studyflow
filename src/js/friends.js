import { registerRoute } from './router.js';
import { getActiveUser, getFriendsState, addFriendState, getApiUrl, getRegisteredUsersLocal } from './state.js';

let activeFriend = null;
let pollingInterval = null;
let cachedMessages = [];

export function initFriends() {
  // Register tab callback
  registerRoute('friends', () => {
    // Make sure we fetch initially
    fetchMessages().then(() => {
      renderContacts();
      renderActiveChat();
    });
    startPolling();
  });

  // Add Friend Modal Hooks
  const openBtn = document.getElementById('open-add-friend-btn');
  const closeBtn = document.getElementById('close-add-friend-modal');
  const cancelBtn = document.getElementById('cancel-add-friend-btn');
  const modal = document.getElementById('add-friend-modal');
  const form = document.getElementById('add-friend-form');
  const errDiv = document.getElementById('add-friend-error');
  const successDiv = document.getElementById('add-friend-success');
  const usernameInput = document.getElementById('add-friend-username');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      if (errDiv) errDiv.style.display = 'none';
      if (successDiv) successDiv.style.display = 'none';
      if (usernameInput) {
        usernameInput.value = '';
        usernameInput.focus();
      }
    });
  }

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errDiv) errDiv.style.display = 'none';
      if (successDiv) successDiv.style.display = 'none';

      const friendUsername = usernameInput ? usernameInput.value.trim() : '';
      const currentUser = getActiveUser();

      if (!friendUsername) return;

      if (currentUser && friendUsername.toLowerCase() === currentUser.toLowerCase()) {
        if (errDiv) {
          errDiv.textContent = "You cannot add yourself as a friend.";
          errDiv.style.display = 'block';
        }
        return;
      }

      try {
        let registeredUsers = [];
        try {
          const localUsers = getRegisteredUsersLocal();
          let serverUsers = [];
          try {
            const response = await fetch(getApiUrl('/api/chat/users'));
            if (response.ok) {
              serverUsers = await response.json();
            }
          } catch (e) {
            // Ignore server fetch error, fallback will use local only
          }
          
          // Merge both lists, case-insensitively keeping unique usernames
          const mergedSet = new Set();
          localUsers.forEach(u => { if (u) mergedSet.add(u.trim()); });
          serverUsers.forEach(u => {
            if (u) {
              const uTrim = u.trim();
              const exists = Array.from(mergedSet).some(existing => existing.toLowerCase() === uTrim.toLowerCase());
              if (!exists) {
                mergedSet.add(uTrim);
              }
            }
          });
          registeredUsers = Array.from(mergedSet);
        } catch (fetchErr) {
          registeredUsers = getRegisteredUsersLocal();
        }

        const exists = registeredUsers.some(u => u && u.toLowerCase() === friendUsername.toLowerCase());
        if (!exists) {
          if (errDiv) {
            errDiv.textContent = `User "${friendUsername}" does not exist in the database.`;
            errDiv.style.display = 'block';
          }
          return;
        }

        const exactUsername = registeredUsers.find(u => u && u.toLowerCase() === friendUsername.toLowerCase());
        const added = addFriendState(exactUsername);
        if (added) {
          if (successDiv) {
            successDiv.textContent = `Successfully added ${exactUsername}!`;
            successDiv.style.display = 'block';
          }
          setTimeout(() => {
            closeModal();
            renderContacts();
          }, 1000);
        } else {
          if (errDiv) {
            errDiv.textContent = `${exactUsername} is already in your contacts.`;
            errDiv.style.display = 'block';
          }
        }
      } catch (err) {
        if (errDiv) {
          errDiv.textContent = "Server error while adding friend. Please try again.";
          errDiv.style.display = 'block';
        }
      }
    });
  }

  // Chat Form Send Hook
  const chatForm = document.getElementById('friends-chat-form');
  const chatInput = document.getElementById('friends-chat-input');
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      const currentUser = getActiveUser();
      if (!text || !currentUser || !activeFriend) return;

      chatInput.value = '';

      const payload = {
        sender: currentUser,
        receiver: activeFriend,
        text: text,
        timestamp: Date.now()
      };

      try {
        const response = await fetch(getApiUrl('/api/chat/send'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          await fetchMessages();
          renderActiveChat();
          renderContacts();
        }
      } catch (err) {
        console.error("Error sending message", err);
      }
    });
  }

  // Search Filter Hook
  const searchInput = document.getElementById('friends-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderContacts();
    });
  }

  // Mobile Navigation Back Button
  const backBtn = document.getElementById('chat-mobile-back-btn');
  const container = document.getElementById('friends-chat-container');
  if (backBtn && container) {
    backBtn.addEventListener('click', () => {
      container.classList.remove('show-active-chat');
      activeFriend = null;
      renderContacts();
    });
  }
}

async function fetchMessages() {
  const currentUser = getActiveUser();
  if (!currentUser) return;
  try {
    const response = await fetch(getApiUrl(`/api/chat/messages?user=${encodeURIComponent(currentUser)}`));
    if (response.ok) {
      cachedMessages = await response.json();
    }
  } catch (err) {
    // Silent fail if server offline
  }
}

function startPolling() {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    const viewFriends = document.getElementById('view-friends');
    if (!viewFriends || !viewFriends.classList.contains('active')) {
      stopPolling();
      return;
    }

    const oldJson = JSON.stringify(cachedMessages);
    await fetchMessages();
    const newJson = JSON.stringify(cachedMessages);

    if (oldJson !== newJson) {
      renderContacts();
      renderActiveChat();
    }
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function renderContacts() {
  const container = document.getElementById('contacts-list-container');
  if (!container) return;

  const currentUser = getActiveUser();
  if (!currentUser) {
    container.innerHTML = '<div class="contacts-empty">Please log in to chat.</div>';
    return;
  }

  const friends = getFriendsState();
  if (friends.length === 0) {
    container.innerHTML = '<div class="contacts-empty">No contacts added yet. Click "Add Friend" to add classmate.</div>';
    return;
  }

  const searchInput = document.getElementById('friends-search');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = friends.filter(f => f && f.toLowerCase().includes(query));
  if (filtered.length === 0) {
    container.innerHTML = '<div class="contacts-empty">No matching contacts found.</div>';
    return;
  }

  container.innerHTML = '';

  filtered.forEach(friend => {
    const friendMessages = cachedMessages.filter(m =>
      (m.sender === currentUser && m.receiver === friend) ||
      (m.sender === friend && m.receiver === currentUser)
    );

    friendMessages.sort((a, b) => a.timestamp - b.timestamp);

    const lastMsg = friendMessages.length > 0 ? friendMessages[friendMessages.length - 1] : null;
    const lastText = lastMsg ? lastMsg.text : 'No messages yet';
    const lastTimeText = lastMsg ? formatTime(lastMsg.timestamp) : '';

    const isActive = activeFriend && activeFriend.toLowerCase() === friend.toLowerCase();
    const color = getAvatarColor(friend);
    const initial = friend.charAt(0).toUpperCase();

    const item = document.createElement('button');
    item.type = 'button';
    item.className = `contact-item ${isActive ? 'active' : ''}`;
    item.innerHTML = `
      <div class="contact-avatar" style="background-color: ${color};">${initial}</div>
      <div class="contact-info">
        <div class="contact-meta">
          <span class="contact-name">${friend}</span>
          <span class="contact-time">${lastTimeText}</span>
        </div>
        <div class="contact-last-msg">${lastText}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      activeFriend = friend;
      const chatContainer = document.getElementById('friends-chat-container');
      if (chatContainer) {
        chatContainer.classList.add('show-active-chat');
      }
      renderContacts();
      renderActiveChat();
    });

    container.appendChild(item);
  });
}

function renderActiveChat() {
  const emptyView = document.getElementById('chat-empty-state-view');
  const activeView = document.getElementById('chat-active-panel-view');
  if (!emptyView || !activeView) return;

  if (!activeFriend) {
    emptyView.style.display = 'flex';
    activeView.style.display = 'none';
    return;
  }

  emptyView.style.display = 'none';
  activeView.style.display = 'flex';

  const avatar = document.getElementById('active-chat-avatar');
  const username = document.getElementById('active-chat-username');
  if (avatar) {
    avatar.style.backgroundColor = getAvatarColor(activeFriend);
    avatar.textContent = activeFriend.charAt(0).toUpperCase();
  }
  if (username) {
    username.textContent = activeFriend;
  }

  const feed = document.getElementById('chat-messages-feed-container');
  if (feed) {
    feed.innerHTML = '';
    const currentUser = getActiveUser();

    const conversation = cachedMessages.filter(m =>
      (m.sender === currentUser && m.receiver === activeFriend) ||
      (m.sender === activeFriend && m.receiver === currentUser)
    );

    conversation.sort((a, b) => a.timestamp - b.timestamp);

    if (conversation.length === 0) {
      const info = document.createElement('div');
      info.className = 'contacts-empty';
      info.style.marginTop = '40px';
      info.textContent = 'This is the beginning of your chat history. Say hello!';
      feed.appendChild(info);
    } else {
      conversation.forEach(msg => {
        const isSent = msg.sender === currentUser;
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        bubble.innerHTML = `
          <div class="message-text">${escapeHtml(msg.text)}</div>
          <div class="message-meta">
            <span class="message-time">${formatTime(msg.timestamp)}</span>
          </div>
        `;
        feed.appendChild(bubble);
      });
    }

    feed.scrollTop = feed.scrollHeight;
  }
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#ff9800',
    '#ff5722', '#795548', '#607d8b'
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
