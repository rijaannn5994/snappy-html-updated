// ─── Shared Post Modal ────────────────────────────────────────────────────────
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showPostModal(post, onClose) {
  const user = State.currentUser;
  const isOwner = user === post.author;

  // Remove any existing modal
  const existing = document.getElementById('post-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'post-modal';
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };

  function closeModal() {
    overlay.remove();
    if (onClose) onClose();
  }

  async function refreshPost() {
    const data = await api('GET', `/posts/${post.id}`);
    if (data.success) { post = data.data; renderContent(); renderComments(); }
  }

  function renderContent() {
    const likes = post.likes || [];
    const comments = post.comments || [];
    const isLiked = user && likes.includes(user);
    const isPdf = post.fileType === 'pdf';
    const isPostOwner = user === post.author;

    const mediaPanel = isPdf
      ? `<div style="display:flex;flex-direction:column;width:100%;height:100%;background:#111;">
           <iframe src="${post.fileUrl}" style="flex:1;border:none;min-height:320px;" title="${escHtml(post.title)}"></iframe>
           <div style="background:#1f2937;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
             <div style="display:flex;align-items:center;gap:8px;min-width:0;color:#fff;">
               ${iconFileText}<span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(post.fileName||'Document.pdf')}</span>
             </div>
             <a href="${post.fileUrl}" download="${escHtml(post.fileName||'document.pdf')}" onclick="event.stopPropagation()"
                style="flex-shrink:0;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.1);color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;"
             >${iconDown} Download</a>
           </div>
         </div>`
      : `<img src="${post.fileUrl}" alt="${escHtml(post.title)}" style="width:100%;height:100%;object-fit:contain;max-height:50vh;" onerror="this.src='https://placehold.co/600x400/f3f4f6/9ca3af?text=Image+not+found'">`;

    const privBadge = `<span class="badge ${post.privacy==='private'?'badge-private':'badge-public'}">${post.privacy==='private'?iconLock:iconGlobe}${post.privacy}</span>`;

    // "Your Post" badge if the current user owns this
    const ownerBadge = isPostOwner
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;border:1px solid #c7d2fe;">★ Your Post</span>`
      : '';

    overlay.innerHTML = `
      <div class="modal-box">
        <div style="flex:1;background:#111;display:flex;align-items:center;justify-content:center;position:relative;min-height:280px;" class="modal-media">
          ${mediaPanel}
          <button onclick="document.getElementById('post-modal').remove();if(typeof onClose==='function')onClose();"
            style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);color:#fff;border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;z-index:2;"
            id="media-close-btn"
          >${iconX}</button>
        </div>
        <div style="width:100%;max-width:380px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;" id="modal-side">
          <!-- Header -->
          <div style="padding:16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${avatarHtml(post.author, 38)}
              <div>
                <div style="font-weight:700;font-size:14px;">@${escHtml(post.author)}</div>
                <div style="font-size:11px;color:#9ca3af;">${new Date(post.createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              ${isPostOwner ? `
                <button onclick="startEdit()" style="padding:7px;border-radius:8px;color:#9ca3af;border:none;background:none;cursor:pointer;" title="Edit">${iconEdit}</button>
                <button onclick="deletePost('${post.id}')" style="padding:7px;border-radius:8px;color:#ef4444;border:none;background:none;cursor:pointer;" title="Delete">${iconTrash}</button>
              ` : ''}
              <div style="position:relative;">
                <button id="share-btn" onclick="toggleShare()" style="padding:7px;border-radius:8px;color:#9ca3af;border:none;background:none;cursor:pointer;" title="Share">${iconShare}</button>
                <div id="share-menu" style="display:none;position:absolute;right:0;top:100%;width:200px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);border:1px solid #f3f4f6;z-index:10;padding:4px 0;margin-top:4px;">
                  <div style="font-size:11px;font-weight:700;color:#9ca3af;padding:8px 14px;text-transform:uppercase;letter-spacing:.5px;">Share</div>
                  <button onclick="copyLink('${post.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;color:#374151;width:100%;border:none;background:none;cursor:pointer;" id="copy-btn">${iconLink} Copy link</button>
                  <button onclick="shareTwitter('${post.id}','${escHtml(post.title)}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;color:#374151;width:100%;border:none;background:none;cursor:pointer;">${iconTwitter} Share on X</button>
                  <button onclick="shareFb('${post.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;color:#374151;width:100%;border:none;background:none;cursor:pointer;">${iconFacebook} Share on Facebook</button>
                </div>
              </div>
              <button onclick="closeModal()" style="padding:7px;border-radius:8px;color:#9ca3af;border:none;background:none;cursor:pointer;">${iconX}</button>
            </div>
          </div>

          <!-- Body (scrollable) -->
          <div style="flex:1;overflow-y:auto;" id="modal-body">
            <div style="padding:16px 20px;" id="modal-post-info">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px;">
                <h2 style="font-size:18px;font-weight:800;color:#111827;line-height:1.3;">${escHtml(post.title)}</h2>
                ${privBadge}
              </div>
              ${ownerBadge ? `<div style="margin-bottom:8px;">${ownerBadge}</div>` : ''}
              <p style="font-size:14px;color:#6b7280;line-height:1.6;margin-bottom:16px;white-space:pre-wrap;">${escHtml(post.caption||'')}</p>
              <div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;">
                <button id="modal-like-btn" class="like-btn ${isLiked?'liked':''}" onclick="modalLike('${post.id}')">
                  ${iconHeart}<span class="like-count">${likes.length||''}</span>
                </button>
                <div class="comment-count">${iconComment}<span id="modal-comment-count">${comments.length||''}</span></div>
                <button onclick="toggleShare()" style="display:flex;align-items:center;gap:5px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:13px;padding:4px 8px;border-radius:6px;" title="Share">
                  ${iconShare}
                </button>
              </div>
            </div>
            <div id="modal-comments" style="padding:0 20px 16px;"></div>
          </div>

          <!-- Comment input -->
          <div style="padding:12px 16px;border-top:1px solid #f3f4f6;flex-shrink:0;" id="modal-input-area"></div>
        </div>
      </div>`;

    // Wire media close button
    document.getElementById('media-close-btn').addEventListener('click', closeModal);
  }

  function renderComments() {
    const comments = post.comments || [];
    const el = document.getElementById('modal-comments');
    if (!el) return;
    document.getElementById('modal-comment-count').textContent = comments.length || '';
    if (!comments.length) {
      el.innerHTML = `<p style="text-align:center;font-size:13px;color:#9ca3af;padding:16px 0;">No comments yet. Be the first!</p>`;
    } else {
      el.innerHTML = comments.map(c => {
        const canDel = user === c.author || user === post.author;
        return `<div style="display:flex;gap:8px;margin-bottom:12px;position:relative;" class="comment-row">
          <div style="flex-shrink:0;margin-top:2px;">${avatarHtml(c.author, 28)}</div>
          <div style="flex:1;min-width:0;">
            <div style="background:#f9fafb;border-radius:12px;padding:10px 12px;position:relative;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:700;color:#111827;">@${escHtml(c.author)}</span>
                <span style="font-size:11px;color:#9ca3af;">${timeAgo(c.timestamp||Date.now())}</span>
              </div>
              <p style="font-size:13px;color:#374151;line-height:1.5;word-break:break-word;">${escHtml(c.text)}</p>
              ${canDel ? `<button onclick="delComment('${post.id}','${c.id}')" style="position:absolute;top:8px;right:8px;color:#d1d5db;padding:3px;border:none;background:none;cursor:pointer;border-radius:4px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'">${iconXsm}</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('') + '<div id="comments-end"></div>';
    }
    renderCommentInput();
  }

  function renderCommentInput() {
    const area = document.getElementById('modal-input-area');
    if (!area) return;
    if (!user) {
      area.innerHTML = `<p style="text-align:center;font-size:13px;color:#9ca3af;"><a href="login.html" style="color:#4f46e5;font-weight:700;">Log in</a> to like or comment</p>`;
    } else {
      area.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          ${avatarHtml(user, 32)}
          <input type="text" id="comment-input" placeholder="Add a comment..." onkeydown="if(event.key==='Enter')submitComment('${post.id}')"
            style="flex:1;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:20px;padding:10px 16px;font-size:13px;outline:none;"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e5e7eb'">
          <button onclick="submitComment('${post.id}')" id="send-btn"
            style="flex-shrink:0;padding:9px;border-radius:10px;background:#4f46e5;color:#fff;border:none;cursor:pointer;transition:all .15s;"
          >${iconSend}</button>
        </div>`;
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  window.startEdit = function() {
    const info = document.getElementById('modal-post-info');
    if (!info) return;
    let editPriv = post.privacy;
    info.innerHTML = `
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:10px 14px;font-size:13px;color:#4338ca;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:16px;">${iconAlert} Editing Post</div>
      <div class="field"><label>Title</label><input id="edit-title" value="${escHtml(post.title||'')}"></div>
      <div class="field"><label>Caption</label><textarea id="edit-caption" rows="4">${escHtml(post.caption||'')}</textarea></div>
      <div class="field">
        <label>Visibility</label>
        <div style="display:flex;gap:8px;">
          <button onclick="setPriv('public')" class="privacy-btn ${post.privacy==='public'?'selected':''}" id="priv-pub" style="flex:1;padding:10px;">${iconGlobe}<span><span class="privacy-title">Public</span><span class="privacy-sub">Anyone can view</span></span></button>
          <button onclick="setPriv('private')" class="privacy-btn ${post.privacy==='private'?'selected':''}" id="priv-priv" style="flex:1;padding:10px;">${iconLock}<span><span class="privacy-title">Private</span><span class="privacy-sub">Only you</span></span></button>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #f3f4f6;">
        <button onclick="saveEdit('${post.id}')" style="flex:1;background:#4f46e5;color:#fff;padding:10px;border-radius:8px;font-weight:700;font-size:13px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">${iconSave} Save</button>
        <button onclick="renderContent();renderComments();" style="flex:1;background:#fff;border:1.5px solid #d1d5db;color:#374151;padding:10px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">Cancel</button>
      </div>`;

    window.setPriv = function(v) {
      editPriv = v;
      document.getElementById('priv-pub').className = 'privacy-btn' + (v==='public'?' selected':'');
      document.getElementById('priv-priv').className = 'privacy-btn' + (v==='private'?' selected':'');
    };
    window.saveEdit = async function(postId) {
      const title = document.getElementById('edit-title').value.trim();
      const caption = document.getElementById('edit-caption').value.trim();
      if (!title) { showToast('Title is required', 'error'); return; }
      const res = await api('PUT', `/posts/${postId}`, { ...post, title, caption, privacy: editPriv });
      if (res.success) {
        post = res.data;
        showToast('Post updated!');
        renderContent();
        renderComments();
      } else {
        showToast(res.error || 'Update failed', 'error');
      }
    };
  };

  window.deletePost = async function(postId) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    const res = await api('DELETE', `/posts/${postId}`);
    if (res.success) {
      showToast('Post deleted');
      closeModal(); // This calls onClose which refreshes the list
    } else {
      showToast(res.error || 'Delete failed', 'error');
    }
  };

  window.modalLike = async function(postId) {
    if (!user) { showToast('Log in to like posts', 'error'); return; }
    const res = await api('POST', `/posts/${postId}/like`, { username: user });
    if (res.success) {
      post = res.data;
      const likes = post.likes || [];
      const isLiked = likes.includes(user);
      const btn = document.getElementById('modal-like-btn');
      if (btn) {
        btn.className = 'like-btn' + (isLiked?' liked':'');
        btn.querySelector('.like-count').textContent = likes.length||'';
      }
    }
  };

  window.submitComment = async function(postId) {
    const inp = document.getElementById('comment-input');
    if (!inp || !inp.value.trim()) return;
    const btn = document.getElementById('send-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    const res = await api('POST', `/posts/${postId}/comments`, { username: user, text: inp.value.trim() });
    if (res.success) {
      inp.value = '';
      await refreshPost();
      setTimeout(() => { const end = document.getElementById('comments-end'); if (end) end.scrollIntoView({behavior:'smooth'}); }, 100);
    } else {
      showToast('Failed to post comment', 'error');
    }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  };

  window.delComment = async function(postId, commentId) {
    const res = await api('DELETE', `/posts/${postId}/comments/${commentId}`);
    if (res.success) { await refreshPost(); }
    else showToast('Failed to delete comment', 'error');
  };

  window.toggleShare = function() {
    const m = document.getElementById('share-menu');
    if (!m) return;
    const isHidden = m.style.display === 'none';
    m.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      setTimeout(() => {
        const hide = e => {
          if (!document.getElementById('share-btn')?.contains(e.target) && !m.contains(e.target)) {
            m.style.display = 'none';
            document.removeEventListener('click', hide);
          }
        };
        document.addEventListener('click', hide);
      }, 0);
    }
  };

  window.copyLink = function(postId) {
    const url = `${location.origin}/post/${postId}`;
    navigator.clipboard?.writeText(url).then(() => {
      showToast('Link copied!');
      const btn = document.getElementById('copy-btn');
      if (btn) btn.innerHTML = iconCheck + ' Copied!';
    }).catch(() => showToast('Could not copy link', 'error'));
    if (document.getElementById('share-menu')) document.getElementById('share-menu').style.display = 'none';
  };

  window.shareTwitter = function(postId, title) {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${title}" on Snappy!`)}&url=${encodeURIComponent(location.origin+'/post/'+postId)}`, '_blank');
    if (document.getElementById('share-menu')) document.getElementById('share-menu').style.display = 'none';
  };

  window.shareFb = function(postId) {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.origin+'/post/'+postId)}`, '_blank');
    if (document.getElementById('share-menu')) document.getElementById('share-menu').style.display = 'none';
  };

  document.body.appendChild(overlay);
  renderContent();
  renderComments();
}
