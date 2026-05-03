// ─── Snappy App State (localStorage) ─────────────────────────────────────────
const STORAGE_KEY = 'snappy_state_v2';

const DEFAULT_STATE = {
  currentUser: null,
  users: {
    alice: { username: 'alice', email: 'alice@snappy.com', profilePic: null, bio: 'Capturing moments, one snap at a time.', verified: true },
    bob:   { username: 'bob',   email: 'bob@snappy.com',   profilePic: null, bio: 'Digital artist & designer.', verified: true },
  },
  passwords: { alice: 'alice123', bob: 'bob123' },
  emails: { alice: 'alice@snappy.com', bob: 'bob@snappy.com' },
  pendingSignup: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

const State = loadState();

function persistState() { saveState(State); }

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getCurrentUser() { return State.currentUser; }
function getUsers() { return State.users; }
function getUserProfile(username) { return State.users[username] || null; }

function login(username, password) {
  const key = username.toLowerCase().trim();
  if (!State.users[key]) return { success: false, error: 'Account not found. Please sign up first.' };
  if (State.passwords[key] !== password) return { success: false, error: 'Incorrect password.' };
  State.currentUser = key;
  persistState();
  return { success: true };
}

function logout() {
  State.currentUser = null;
  persistState();
}

function initiateSignup(username, email, password) {
  const key = username.toLowerCase().trim();
  const emailKey = email.toLowerCase().trim();
  if (State.users[key]) return { success: false, error: 'Username already taken.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) return { success: false, error: 'Invalid email address.' };
  if (Object.values(State.emails).some(e => e.toLowerCase() === emailKey)) return { success: false, error: 'Email already registered.' };
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  State.pendingSignup = { username: key, email: emailKey, password, code };
  persistState();
  return { success: true, code };
}

function verifySignup(code) {
  const p = State.pendingSignup;
  if (!p) return { success: false, error: 'No pending signup. Please start over.' };
  if (code !== p.code) return { success: false, error: 'Invalid verification code.' };
  State.passwords[p.username] = p.password;
  State.emails[p.username] = p.email;
  State.users[p.username] = { username: p.username, email: p.email, profilePic: null, bio: 'New to Snappy!', verified: true };
  State.currentUser = p.username;
  State.pendingSignup = null;
  persistState();
  return { success: true };
}

function resendCode() {
  if (!State.pendingSignup) return { success: false };
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  State.pendingSignup.code = code;
  persistState();
  return { success: true, code };
}

function updateProfile(updates) {
  const u = State.currentUser;
  if (!u) return;
  State.users[u] = { ...State.users[u], ...updates };
  persistState();
}

// ─── Azure Blob Upload ────────────────────────────────────────────────────────
async function uploadToBlob(file) {
  const { accountName, containerName, sasToken } = SNAPPY_CONFIG.blob;
  const uniqueName = `${State.currentUser}/${Date.now()}-${file.name}`;
  const url = `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(uniqueName)}?${sasToken}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type || 'application/octet-stream', 'x-ms-version': '2020-04-08' },
    body: file,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Upload failed (${resp.status}): ${txt}`);
  }
  return `https://${accountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(uniqueName)}`;
}

// ─── Backend API ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const resp = await fetch(SNAPPY_CONFIG.backendUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return resp.json();
}

// ─── UI Utilities ─────────────────────────────────────────────────────────────
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function avatarHtml(username, size = 36, profilePic = null) {
  if (!username) username = 'user';
  const user = getUserProfile(username);
  const pic = profilePic || user?.profilePic;
  const px = size + 'px';
  if (pic) {
    return `<img src="${pic}" style="width:${px};height:${px};border-radius:50%;object-fit:cover;border:2px solid #e0e7ff;" alt="${username}">`;
  }
  return `<div style="width:${px};height:${px};border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${Math.round(size*0.4)}px;text-transform:uppercase;flex-shrink:0;">${username.charAt(0)}</div>`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function showToast(msg, type = 'success') {
  let t = document.getElementById('snappy-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'snappy-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type === 'error' ? '#fef2f2' : '#f0fdf4';
  t.style.color = type === 'error' ? '#b91c1c' : '#15803d';
  t.style.border = type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

// ─── Shared Header/Sidebar render ─────────────────────────────────────────────
function renderLayout(pageId, contentHtml) {
  const user = State.currentUser;
  const profile = user ? getUserProfile(user) : null;

  const navItems = [
    { id: 'home',    href: 'index.html',   icon: iconHome,    label: 'Home' },
    { id: 'upload',  href: 'upload.html',  icon: iconUpload,  label: 'Upload' },
    { id: 'profile', href: 'profile.html', icon: iconUser,    label: 'Profile' },
    { id: 'about',   href: 'about.html',   icon: iconInfo,    label: 'About' },
    { id: 'privacy', href: 'privacy.html', icon: iconShield,  label: 'Privacy' },
    { id: 'contact', href: 'contact.html', icon: iconMail,    label: 'Contact' },
  ];

  const navLinks = navItems.map(n => `
    <a href="${n.href}" class="nav-link ${pageId === n.id ? 'active' : ''}">
      ${n.icon} <span>${n.label}</span>
    </a>`).join('');

  const authArea = user && profile
    ? `<a href="profile.html" class="user-chip">
        <div style="text-align:right;display:none;" class="user-name-block">
          <div style="font-size:13px;font-weight:600;color:#111827;">${user}</div>
          <div style="font-size:11px;color:#6b7280;">View Profile</div>
        </div>
        ${avatarHtml(user, 36, profile.profilePic)}
      </a>`
    : `<a href="login.html" class="btn-ghost">Log in</a>
       <a href="signup.html" class="btn-primary">Sign up</a>`;

  document.body.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <div class="header-left">
          <button class="mobile-menu-btn" onclick="toggleMobileMenu()" aria-label="Menu">
            ${iconMenu}
          </button>
          <a href="index.html" class="logo">
            ${iconLightning} <span>Snappy</span>
          </a>
        </div>
        <div class="header-right">${authArea}</div>
      </div>
    </header>

    <div class="mobile-backdrop" id="mobile-backdrop" onclick="toggleMobileMenu()"></div>
    <aside class="mobile-drawer" id="mobile-drawer">
      <div class="drawer-header">
        <div class="logo">${iconLightning} <span>Snappy</span></div>
        <button onclick="toggleMobileMenu()" class="btn-icon">${iconX}</button>
      </div>
      ${user && profile ? `
        <a href="profile.html" class="drawer-user" onclick="toggleMobileMenu()">
          ${avatarHtml(user, 40, profile.profilePic)}
          <div>
            <div style="font-weight:700;font-size:14px;">@${user}</div>
            <div style="font-size:12px;color:#6b7280;">${profile.email}</div>
          </div>
        </a>` : ''}
      <nav class="drawer-nav">${navLinks}</nav>
      <div class="drawer-footer">
        ${user
          ? `<button onclick="handleLogout()" class="signout-btn">${iconLogout} Sign out</button>`
          : `<a href="login.html" class="btn-outline w100">Log in</a>
             <a href="signup.html" class="btn-primary w100" style="margin-top:8px;">Sign up</a>`
        }
      </div>
    </aside>

    <div class="app-body">
      <aside class="desktop-sidebar">
        <div class="sidebar-nav">
          <div class="nav-label">Main Menu</div>
          <nav>${navLinks}</nav>
        </div>
        <div class="sidebar-footer">
          ${user
            ? `<button onclick="handleLogout()" class="signout-btn">${iconLogout} Sign out</button>`
            : `<a href="login.html" class="signin-link">${iconLogoutFlip} Sign in</a>`
          }
        </div>
      </aside>
      <main class="main-content">
        <div class="page-inner">${contentHtml}</div>
      </main>
    </div>
  `;
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('mobile-backdrop');
  const open = drawer.classList.toggle('open');
  backdrop.classList.toggle('open', open);
}

function handleLogout() {
  logout();
  window.location.href = 'index.html';
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const iconHome     = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const iconUpload   = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>`;
const iconUser     = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const iconInfo     = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
const iconShield   = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const iconMail     = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const iconLightning= `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
const iconMenu     = `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
const iconX        = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const iconLogout   = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const iconLogoutFlip=`<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="transform:scaleX(-1)"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
const iconHeart    = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const iconComment  = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const iconGlobe    = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const iconLock     = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const iconSend     = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
const iconShare    = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const iconEdit     = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const iconTrash    = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const iconSave     = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const iconCamera   = `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const iconDown     = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const iconEye      = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const iconEyeOff   = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const iconSpinner  = `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" class="spin"><circle style="opacity:.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path style="opacity:.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>`;
const iconPlus     = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const iconSettings = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const iconSearch   = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const iconXsm      = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const iconCheck    = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
const iconTwitter  = `<svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.257 5.626L18.244 2.25z"/></svg>`;
const iconFacebook = `<svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`;
const iconLink     = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const iconAlert    = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const iconRefresh  = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
const iconShieldOk = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;
const iconArrowLeft=`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const iconFileText =`<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
