const API = window.location.origin

// ─── State ────────────────────────────────────────────────────────────────────
let token      = localStorage.getItem("token")    || null
let userId     = localStorage.getItem("userId")   || null
let username   = localStorage.getItem("username") || null
let myBehavior = []
let currentModalMovie = null

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.onload = () => {
  if (token && userId) showApp()
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, color = "var(--accent)") {
  const t = document.getElementById("toast")
  t.textContent = msg
  t.style.borderLeftColor = color
  t.style.display = "block"
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.style.display = "none", 2800)
}

// ─── Auth tabs ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("login-form").style.display  = tab === "login"  ? "block" : "none"
  document.getElementById("signup-form").style.display = tab === "signup" ? "block" : "none"
  document.querySelectorAll(".auth-tab").forEach((b, i) => {
    b.classList.toggle("active", (i === 0) === (tab === "login"))
  })
}

// ─── Register ─────────────────────────────────────────────────────────────────
async function register() {
  const u   = document.getElementById("signup-username").value.trim()
  const e   = document.getElementById("signup-email").value.trim()
  const p   = document.getElementById("signup-password").value
  const c   = document.getElementById("signup-confirm").value
  const err = document.getElementById("signup-error")
  err.textContent = ""

  if (!u || !e || !p) return err.textContent = "All fields required"
  if (p !== c)        return err.textContent = "Passwords don't match"
  if (p.length < 4)   return err.textContent = "Password too short"

  const res  = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, email: e, password: p })
  })
  const data = await res.json()
  if (data.error) return err.textContent = data.error
  saveSession(data)
  showApp()
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login() {
  const e   = document.getElementById("login-email").value.trim()
  const p   = document.getElementById("login-password").value
  const err = document.getElementById("login-error")
  err.textContent = ""
  if (!e || !p) return err.textContent = "Fill in all fields"

  const res  = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  })
  const data = await res.json()
  if (data.error) return err.textContent = data.error
  saveSession(data)
  showApp()
}

function saveSession(data) {
  token    = data.token
  userId   = data.userId
  username = data.username
  localStorage.setItem("token",    token)
  localStorage.setItem("userId",   userId)
  localStorage.setItem("username", username)
}

function logout() {
  localStorage.clear()
  token = userId = username = null
  document.getElementById("app-screen").style.display  = "none"
  document.getElementById("auth-screen").style.display = "flex"
}

function showApp() {
  document.getElementById("auth-screen").style.display = "none"
  document.getElementById("app-screen").style.display  = "block"
  document.getElementById("sidebar-username").textContent = username
  document.getElementById("sidebar-avatar").textContent   = username[0].toUpperCase()
  loadMyBehavior()
  pollFriendRequests()
}

// ─── View switching ───────────────────────────────────────────────────────────
function showView(name, btn) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"))
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"))
  document.getElementById("view-" + name).classList.add("active")
  if (btn) btn.classList.add("active")

  if (name === "recommendations") loadRecommendations()
  if (name === "mylist")          renderMyList()
  if (name === "friends")         loadFriends()
  if (name === "profile")         loadProfile()
}

// ─── Auth fetch ───────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  options.headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
  const res = await fetch(API + url, options)
  return res.json()
}

// ─── Load behavior ────────────────────────────────────────────────────────────
async function loadMyBehavior() {
  myBehavior = await apiFetch("/behavior")
  if (!Array.isArray(myBehavior)) myBehavior = []
}

function getMyAction(movieId) {
  return myBehavior.find(b => b.movieId === movieId)?.action || null
}

// ─── Match color ──────────────────────────────────────────────────────────────
function matchClass(pct) {
  return pct >= 70 ? "high" : pct >= 40 ? "med" : "low"
}

// ─── Movie card ───────────────────────────────────────────────────────────────
function movieCard(movie, currentAction, matchPercent) {
  const poster = movie.Poster && movie.Poster !== "N/A"
    ? movie.Poster
    : `https://placehold.co/180x270/111/444?text=${encodeURIComponent(movie.Title||"?")}`

  const id       = movie.imdbID    || movie.movieId    || ""
  const title    = movie.Title     || movie.movieTitle  || "Unknown"
  const year     = movie.Year      || movie.movieYear   || ""
  const genre    = movie.Genre     || ""
  const lang     = movie.Language  || ""
  const type     = movie.Type      || "movie"
  const rating   = movie.imdbRating && movie.imdbRating !== "N/A" ? movie.imdbRating : null
  const streams  = movie.streamingOn || []

  const safeTitle = title.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"')

  const actions = ["liked","watched","disliked","skipped"]
  const labels  = ["❤ Like","✓ Seen","✗ Nope","⏭ Skip"]

  const btns = actions.map((a, i) => `
    <button class="action-btn ${currentAction === a ? a : ""}"
      onclick="event.stopPropagation();saveBehavior('${id}','${safeTitle}','${year}','${genre}','${lang}','${type}','${poster}','${a}',this)">
      ${labels[i]}
    </button>
  `).join("")

  const matchBar = matchPercent != null ? `
    <div class="match-bar-wrap">
      <div class="match-bar-top">
        <span>MATCH</span>
        <span class="match-pct ${matchClass(matchPercent)}">${matchPercent}%</span>
      </div>
      <div class="match-bar-bg">
        <div class="match-bar-fill ${matchClass(matchPercent)}" style="width:${matchPercent}%"></div>
      </div>
    </div>
  ` : ""

  const streamBadges = streams.slice(0,2).map(s =>
    `<span class="stream-badge">${s}</span>`
  ).join("")

  return `
    <div class="movie-card" onclick="openModal('${id}','${safeTitle}','${year}','${genre}','${lang}','${rating||""}','${poster}','${(movie.Plot||"").replace(/'/g,"\\'")}','${(movie.Director||"").replace(/'/g,"\\'")}','${(movie.Actors||"").replace(/'/g,"\\'")}')">
      <img class="card-poster" src="${poster}" alt="${title}" loading="lazy"
        onerror="this.src='https://placehold.co/180x270/111/444?text=No+Image'"/>
      <div class="card-body">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-meta">
          <span>${year}</span>
          ${rating ? `<span>·</span><span class="card-rating">⭐ ${rating}</span>` : ""}
        </div>
        ${matchBar}
        <div class="action-btns" onclick="event.stopPropagation()">${btns}</div>
        ${streamBadges ? `<div class="streaming-row">${streamBadges}</div>` : ""}
      </div>
    </div>
  `
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function searchMovies() {
  const q  = document.getElementById("search-input").value.trim()
  if (!q) return
  const el = document.getElementById("search-results")
  el.innerHTML = `<div class="spinner">SEARCHING</div>`

  const data = await fetch(`${API}/search?q=${encodeURIComponent(q)}`).then(r => r.json())

  if (!data.Search) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎬</div><div class="empty-text">No results for "${q}"</div></div>`
    return
  }

  el.innerHTML = data.Search.map(m => movieCard(m, getMyAction(m.imdbID), null)).join("")
}

// ─── Save behavior ────────────────────────────────────────────────────────────
async function saveBehavior(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, btnEl) {
  const data = await apiFetch("/behavior", {
    method: "POST",
    body: JSON.stringify({ movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action })
  })
  if (data.error) return toast("Error: " + data.error)

  // Update cache
  myBehavior = myBehavior.filter(b => b.movieId !== movieId)
  myBehavior.unshift({ movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action })

  const labels = { liked:"❤️ Liked!", watched:"✅ Watched!", disliked:"👎 Noted", skipped:"⏭ Skipped" }
  const colors = { liked:"#ef4444", watched:"var(--green)", disliked:"var(--muted2)", skipped:"var(--gold)" }
  toast(labels[action], colors[action])

  // Update button highlight in same card
  if (btnEl) {
    const actions = ["liked","watched","disliked","skipped"]
    const parent = btnEl.closest(".action-btns") || btnEl.parentElement
    parent.querySelectorAll(".action-btn").forEach((b, i) => {
      b.className = `action-btn ${actions[i] === action ? action : ""}`
    })
  }
}

// ─── Recommendations ──────────────────────────────────────────────────────────
async function loadRecommendations() {
  const el  = document.getElementById("rec-results")
  const basis = document.getElementById("rec-basis")
  el.innerHTML = `<div class="spinner">BUILDING YOUR PICKS</div>`
  basis.innerHTML = ""

  const data = await apiFetch("/recommend")

  if (data.message || data.newUser) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎬</div><div class="empty-text">${data.message || "Rate some movies in Search to get personalised picks!"}</div></div>`
    return
  }

  if (data.basedOn) {
    basis.innerHTML = `<div class="rec-basis">✦ ${data.basedOn}</div>`
  }

  el.innerHTML = (data.recommendations || []).map(m =>
    movieCard(m, getMyAction(m.imdbID), m.matchPercent)
  ).join("")
}

// ─── My List ─────────────────────────────────────────────────────────────────
function renderMyList() {
  const el = document.getElementById("mylist-content")
  if (!myBehavior.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Nothing here yet — search and rate some movies!</div></div>`
    return
  }

  const groups   = { liked:[], watched:[], saved:[], skipped:[], disliked:[] }
  const gLabels  = { liked:"❤️ Liked", watched:"✅ Watched", saved:"🔖 Saved", skipped:"⏭ Skipped", disliked:"👎 Disliked" }
  const gColors  = { liked:"#ef4444", watched:"var(--green)", saved:"var(--blue)", skipped:"var(--gold)", disliked:"var(--muted)" }

  myBehavior.forEach(b => { if (groups[b.action]) groups[b.action].push(b) })

  el.innerHTML = Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([action, items]) => `
      <div class="list-group">
        <div class="list-group-header">
          <div class="list-group-title" style="color:${gColors[action]}">${gLabels[action]}</div>
          <div class="list-group-count">${items.length} titles</div>
        </div>
        <div class="movie-grid">
          ${items.map(b => `
            <div class="movie-card">
              <img class="card-poster" src="${b.posterUrl||`https://placehold.co/180x270/111/444?text=No+Image`}" loading="lazy"
                onerror="this.src='https://placehold.co/180x270/111/444?text=No+Image'"/>
              <div class="card-body">
                <div class="card-title">${b.movieTitle}</div>
                <div class="card-meta">${b.movieYear||""} ${b.movieGenre ? "· "+b.movieGenre.split(",")[0] : ""}</div>
                <button class="action-btn" style="width:100%;margin-top:6px"
                  onclick="removeFromList('${b.movieId}')">✕ Remove</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("")
}

function removeFromList(movieId) {
  myBehavior = myBehavior.filter(b => b.movieId !== movieId)
  renderMyList()
  toast("Removed", "var(--muted)")
}

// ─── Profile ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  const profile = await apiFetch("/profile")
  const liked   = myBehavior.filter(b => b.action === "liked").length
  const watched = myBehavior.filter(b => b.action === "watched").length
  const disliked= myBehavior.filter(b => b.action === "disliked").length

  const genres    = profile.tasteProfile?.genres ? Object.fromEntries(profile.tasteProfile.genres) : {}
  const languages = profile.tasteProfile?.languages ? Object.fromEntries(profile.tasteProfile.languages) : {}

  const topGenres = Object.entries(genres).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const topLangs  = Object.entries(languages).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const maxG = topGenres[0]?.[1] || 1
  const maxL = topLangs[0]?.[1]  || 1

  document.getElementById("profile-content").innerHTML = `
    <!-- Stats -->
    <div class="stats-grid">
      ${[["❤️",liked,"LIKED","#ef4444"],["✅",watched,"WATCHED","var(--green)"],["👎",disliked,"DISLIKED","var(--muted)"],["👥",profile.friends?.length||0,"FRIENDS","var(--blue)"]]
        .map(([icon,n,label,color])=>`
          <div class="stat-card">
            <div class="stat-icon">${icon}</div>
            <div class="stat-num" style="color:${color}">${n}</div>
            <div class="stat-label">${label}</div>
          </div>
        `).join("")}
    </div>

    <!-- Genre taste -->
    <div class="section-title">GENRE TASTE</div>
    <div class="taste-grid" style="margin-bottom:28px">
      ${topGenres.length ? topGenres.map(([g,s])=>`
        <div class="taste-item">
          <div class="taste-label">${g}</div>
          <div class="taste-bg"><div class="taste-fill" style="width:${(s/maxG)*100}%"></div></div>
          <div class="taste-pts">${s} pts</div>
        </div>
      `).join("") : `<p style="color:var(--muted);font-size:13px">Rate movies to build your taste profile</p>`}
    </div>

    <!-- Language taste -->
    ${topLangs.length ? `
      <div class="section-title">LANGUAGE PREFERENCES</div>
      <div class="taste-grid" style="margin-bottom:28px">
        ${topLangs.map(([l,s])=>`
          <div class="taste-item">
            <div class="taste-label">${l}</div>
            <div class="taste-bg"><div class="taste-fill" style="width:${(s/maxL)*100}%;background:var(--accent2)"></div></div>
            <div class="taste-pts" style="color:var(--accent2)">${s} pts</div>
          </div>
        `).join("")}
      </div>
    ` : ""}

    <!-- Recently liked -->
    <div class="section-title">RECENTLY LIKED</div>
    <div class="movie-grid">
      ${myBehavior.filter(b=>b.action==="liked").slice(0,6).map(b=>`
        <div class="movie-card">
          <img class="card-poster" src="${b.posterUrl||`https://placehold.co/180x270/111/444?text=No+Image`}" loading="lazy"
            onerror="this.src='https://placehold.co/180x270/111/444?text=No+Image'"/>
          <div class="card-body">
            <div class="card-title">${b.movieTitle}</div>
            <div class="card-meta">${b.movieYear||""}</div>
          </div>
        </div>
      `).join("") || `<p style="color:var(--muted);font-size:13px;padding:10px">Nothing liked yet</p>`}
    </div>
  `
}

// ─── Friends ──────────────────────────────────────────────────────────────────
async function loadFriends() {
  const data = await apiFetch("/friends")

  // Pending requests
  const reqEl = document.getElementById("friend-requests-section")
  if (data.friendRequests?.length > 0) {
    reqEl.innerHTML = `
      <div class="section-title" style="color:var(--gold)">PENDING REQUESTS (${data.friendRequests.length})</div>
      <div class="user-list" style="margin-bottom:20px">
        ${data.friendRequests.map(r=>`
          <div class="user-row">
            <div class="user-avatar" style="width:36px;height:36px;font-size:14px">${r.fromUsername[0].toUpperCase()}</div>
            <div>
              <div class="user-row-name">${r.fromUsername}</div>
              <div class="user-row-sub">Wants to connect</div>
            </div>
            <button class="btn-sm green" onclick="acceptFriend('${r.fromUserId}','${r.fromUsername}')">Accept</button>
            <button class="btn-sm" onclick="declineFriend('${r.fromUserId}')">Decline</button>
          </div>
        `).join("")}
      </div>
    `
    updateBadge(data.friendRequests.length)
  } else {
    reqEl.innerHTML = ""
    updateBadge(0)
  }

  const listEl = document.getElementById("friends-list")
  if (!data.friends?.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No friends yet — search for users above!</div></div>`
    return
  }

  listEl.innerHTML = data.friends.map(f=>`
    <div class="user-row">
      <div class="user-avatar" style="width:36px;height:36px;font-size:14px">${f.username[0].toUpperCase()}</div>
      <div>
        <div class="user-row-name">${f.username}</div>
        <div class="user-row-sub">Friend</div>
      </div>
      <button class="btn-sm blue" onclick="viewFriendActivity('${f.userId}','${f.username}')">See Likes</button>
      <button class="btn-sm red" onclick="removeFriend('${f.userId}')">Remove</button>
    </div>
  `).join("")
}

function updateBadge(count) {
  const badge = document.getElementById("friend-req-badge")
  if (count > 0) { badge.textContent = count; badge.style.display = "inline-block"; }
  else badge.style.display = "none"
}

async function pollFriendRequests() {
  try {
    const data = await apiFetch("/friends")
    updateBadge(data.friendRequests?.length || 0)
  } catch {}
  setTimeout(pollFriendRequests, 30000) // check every 30s
}

async function searchUsers() {
  const q  = document.getElementById("user-search-input").value.trim()
  if (!q) return
  const users = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`)
  const el    = document.getElementById("user-search-results")

  if (!users.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:10px">No users found</div>`
    return
  }

  el.innerHTML = users.map(u=>`
    <div class="user-row">
      <div class="user-avatar" style="width:36px;height:36px;font-size:14px">${u.username[0].toUpperCase()}</div>
      <div class="user-row-name">${u.username}</div>
      <button class="btn-sm red" onclick="sendFriendRequest('${u._id}')">+ Add Friend</button>
    </div>
  `).join("")
}

async function sendFriendRequest(toUserId) {
  const data = await apiFetch("/friends/request", { method:"POST", body:JSON.stringify({toUserId}) })
  toast(data.error || data.message, data.error ? "var(--accent)" : "var(--green)")
}

async function acceptFriend(fromUserId, fromUsername) {
  const data = await apiFetch("/friends/accept", { method:"POST", body:JSON.stringify({fromUserId,fromUsername}) })
  toast(data.message, "var(--green)")
  loadFriends()
}

async function declineFriend(fromUserId) {
  await apiFetch("/friends/decline", { method:"POST", body:JSON.stringify({fromUserId}) })
  loadFriends()
}

async function removeFriend(friendId) {
  await apiFetch(`/friends/${friendId}`, { method:"DELETE" })
  toast("Friend removed")
  loadFriends()
}

async function viewFriendActivity(friendId, friendName) {
  const activity = await apiFetch(`/friends/${friendId}/activity`)
  const el = document.getElementById("friends-list")

  if (!activity.length) {
    toast(`${friendName} hasn't liked anything yet`)
    return
  }

  el.innerHTML = `
    <div class="section-title" style="margin-bottom:16px">${friendName.toUpperCase()}'S LIKED MOVIES</div>
    <div class="movie-grid">
      ${activity.map(b=>`
        <div class="movie-card">
          <img class="card-poster" src="${b.posterUrl||`https://placehold.co/180x270/111/444?text=No+Image`}" loading="lazy"
            onerror="this.src='https://placehold.co/180x270/111/444?text=No+Image'"/>
          <div class="card-body">
            <div class="card-title">${b.movieTitle}</div>
            <div class="card-meta">${b.movieYear||""}</div>
          </div>
        </div>
      `).join("")}
    </div>
    <button class="btn-sm" style="margin-top:16px" onclick="loadFriends()">← Back to friends</button>
  `
}

// ─── Movie detail modal ───────────────────────────────────────────────────────
function openModal(id, title, year, genre, lang, rating, poster, plot, director, actors) {
  currentModalMovie = { id, title, year, genre, lang, poster }

  document.getElementById("modal-poster").src = poster && poster !== "N/A"
    ? poster
    : `https://placehold.co/680x280/111/444?text=${encodeURIComponent(title)}`

  document.getElementById("modal-title").textContent = title

  document.getElementById("modal-meta").innerHTML = [
    year     ? `<span>📅 ${year}</span>` : "",
    rating   ? `<span>⭐ ${rating}</span>` : "",
    genre    ? `<span>🎭 ${genre.split(",")[0].trim()}</span>` : "",
    lang     ? `<span>🌐 ${lang.split(",")[0].trim()}</span>` : "",
    director && director !== "N/A" ? `<span>🎬 ${director.split(",")[0].trim()}</span>` : "",
  ].filter(Boolean).join("")

  document.getElementById("modal-plot").textContent = plot && plot !== "N/A"
    ? plot
    : "No description available."

  const action = getMyAction(id)
  const actions = ["liked","watched","disliked","skipped"]
  const labels  = ["❤ Like","✓ Seen","✗ Nope","⏭ Skip"]

  document.getElementById("modal-actions").innerHTML = actions.map((a,i) => `
    <button class="action-btn ${action===a?a:""}" style="padding:8px 16px;font-size:12px"
      onclick="saveBehaviorModal('${id}','${title.replace(/'/g,"\\'")}','${year}','${genre}','${lang}','movie','${poster}','${a}',this)">
      ${labels[i]}
    </button>
  `).join("")

  document.getElementById("modal-overlay").classList.add("open")
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open")
}

async function saveBehaviorModal(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, btnEl) {
  await saveBehavior(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, null)
  // Update modal buttons
  const actions = ["liked","watched","disliked","skipped"]
  btnEl.closest(".modal-actions").querySelectorAll(".action-btn").forEach((b,i) => {
    b.className = `action-btn ${actions[i]===action?action:""}` + " " + "action-btn"
    b.style.padding = "8px 16px"
    b.style.fontSize = "12px"
  })
}

// Keyboard close
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal() })