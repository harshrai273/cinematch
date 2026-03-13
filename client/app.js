const API = window.location.origin

let token      = localStorage.getItem("token")    || null
let userId     = localStorage.getItem("userId")   || null
let username   = localStorage.getItem("username") || null
let myBehavior = []
let currentView = "home"

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.onload = () => {
  if (token && userId) showApp()
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, color = "var(--red)") {
  const t = document.getElementById("toast")
  t.textContent = msg
  t.style.borderLeftColor = color
  t.style.display = "block"
  clearTimeout(t._t)
  t._t = setTimeout(() => t.style.display = "none", 2500)
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
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: u, email: e, password: p })
  })
  const data = await res.json()
  if (data.error) return err.textContent = data.error
  saveSession(data); showApp()
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login() {
  const e   = document.getElementById("login-email").value.trim()
  const p   = document.getElementById("login-password").value
  const err = document.getElementById("login-error")
  err.textContent = ""
  if (!e || !p) return err.textContent = "Fill in all fields"
  const res  = await fetch(`${API}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: e, password: p })
  })
  const data = await res.json()
  if (data.error) return err.textContent = data.error
  saveSession(data); showApp()
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
  document.getElementById("top-username").textContent  = username
  document.getElementById("top-avatar").textContent    = username[0].toUpperCase()
  loadMyBehavior().then(() => loadHome())
  pollFriendRequests()
}

// ─── View switching ───────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"))
  document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"))
  document.getElementById("view-" + name).classList.add("active")
  const btn = document.getElementById("bnav-" + name)
  if (btn) btn.classList.add("active")
  currentView = name

  if (name === "foryou")  loadForYou()
  if (name === "mylist")  renderMyList()
  if (name === "friends") loadFriends()
  if (name === "profile") loadProfile()
}

// ─── Auth fetch ───────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  options.headers = { ...options.headers, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
  const res = await fetch(API + url, options)
  return res.json()
}

// ─── Load behavior ────────────────────────────────────────────────────────────
async function loadMyBehavior() {
  const data = await apiFetch("/behavior")
  myBehavior = Array.isArray(data) ? data : []
}

function getMyAction(movieId) {
  return myBehavior.find(b => b.movieId === movieId)?.action || null
}

// ─── HOME — discover movies ───────────────────────────────────────────────────
async function loadHome() {
  const el = document.getElementById("home-results")
  el.innerHTML = `<div class="spinner">LOADING</div>`
  try {
    const data = await fetch(`${API}/discover`).then(r => r.json())
    const movies = data.movies || []
    if (!movies.length) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">🎬</div><div class="empty-text">Nothing to show right now</div></div>`
      return
    }
    el.innerHTML = movies.map(m => movieCard(m, getMyAction(m.imdbID), null)).join("")
  } catch {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Could not load movies</div></div>`
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById("search-input").value.trim()
  if (!q) return

  showView("search")
  document.getElementById("search-label").textContent = `"${q}"`
  const el = document.getElementById("search-results")
  el.innerHTML = `<div class="spinner">SEARCHING</div>`

  const data = await fetch(`${API}/search?q=${encodeURIComponent(q)}`).then(r => r.json())
  if (!data.Search) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No results for "${q}"</div></div>`
    return
  }
  el.innerHTML = data.Search.map(m => movieCard(m, getMyAction(m.imdbID), null)).join("")
}

// ─── FOR YOU — ML recommendations ────────────────────────────────────────────
async function loadForYou() {
  const el   = document.getElementById("rec-results")
  const chip = document.getElementById("rec-chip")
  el.innerHTML = `<div class="spinner">BUILDING YOUR PICKS</div>`
  chip.innerHTML = ""

  const data = await apiFetch("/recommend")

  if (data.newUser || data.message) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎬</div><div class="empty-text">${data.message || "Rate some movies on Home to get personalised picks!"}</div></div>`
    return
  }

  if (data.basedOn) chip.innerHTML = `<div class="rec-chip">✦ ${data.basedOn}</div>`
  el.innerHTML = (data.recommendations || []).map(m => movieCard(m, getMyAction(m.imdbID), m.matchPercent)).join("")
}

// ─── Movie card ───────────────────────────────────────────────────────────────
function movieCard(movie, currentAction, matchPercent) {
  const poster   = getPoster(movie.Poster, movie.Title)
  const id       = movie.imdbID    || movie.movieId    || ""
  const title    = movie.Title     || movie.movieTitle  || "Unknown"
  const year     = movie.Year      || movie.movieYear   || ""
  const genre    = movie.Genre     || ""
  const lang     = movie.Language  || ""
  const type     = movie.Type      || "movie"
  const rating   = movie.imdbRating && movie.imdbRating !== "N/A" ? movie.imdbRating : null
  const plot     = movie.Plot      || ""
  const director = movie.Director  || ""
  const actors   = movie.Actors    || ""
  const streams  = movie.streamingOn || []

  const st = safeStr(title)
  const sp = safeStr(plot)
  const sd = safeStr(director)
  const sa = safeStr(actors)
  const sp2 = safeStr(poster)

  const actions = ["liked","watched","disliked","skipped"]
  const labels  = ["❤ Like","✓ Seen","✗ Nope","⏭ Skip"]

  const btns = actions.map((a, i) => `
    <button class="action-btn ${currentAction === a ? a : ""}"
      onclick="event.stopPropagation();saveBehavior('${id}','${st}','${year}','${genre}','${lang}','${type}','${sp2}','${a}',this)">
      ${labels[i]}
    </button>
  `).join("")

  const cls = matchPercent >= 70 ? "h" : matchPercent >= 40 ? "m" : "l"
  const bar = matchPercent != null ? `
    <div class="match-wrap">
      <div class="match-top"><span>MATCH</span><span class="match-pct ${cls}">${matchPercent}%</span></div>
      <div class="match-bg"><div class="match-fill ${cls}" style="width:${matchPercent}%"></div></div>
    </div>` : ""

  const streamBadges = streams.slice(0,2).map(s => `<span class="stream-badge">${s}</span>`).join("")

  return `
    <div class="movie-card" onclick="openModal('${id}','${st}','${year}','${genre}','${lang}','${rating||""}','${sp2}','${sp}','${sd}','${sa}')">
      <img class="card-poster" src="${poster}" alt="${title}" loading="lazy"
        onerror="this.src='https://placehold.co/130x195/1c1c1c/444?text=?'"/>
      <div class="card-body">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-year">${year}${rating ? ` · <span class="card-rating">⭐${rating}</span>` : ""}</div>
        ${bar}
        <div class="action-btns" onclick="event.stopPropagation()">${btns}</div>
        ${streamBadges ? `<div class="stream-row">${streamBadges}</div>` : ""}
      </div>
    </div>`
}

// ─── Save behavior ────────────────────────────────────────────────────────────
async function saveBehavior(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, btnEl) {
  const data = await apiFetch("/behavior", {
    method: "POST",
    body: JSON.stringify({ movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action })
  })
  if (data.error) return toast("Error: " + data.error)

  myBehavior = myBehavior.filter(b => b.movieId !== movieId)
  myBehavior.unshift({ movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action })

  const labels = { liked:"❤️ Liked!", watched:"✅ Watched!", disliked:"👎 Noted", skipped:"⏭ Skipped" }
  const colors = { liked:"#ef4444", watched:"var(--green)", disliked:"var(--muted)", skipped:"var(--gold)" }
  toast(labels[action], colors[action])

  if (btnEl) {
    const actions = ["liked","watched","disliked","skipped"]
    btnEl.closest(".action-btns")?.querySelectorAll(".action-btn").forEach((b, i) => {
      b.className = `action-btn ${actions[i] === action ? action : ""}`
    })
    // update modal buttons too if open
    btnEl.closest(".modal-actions")?.querySelectorAll(".modal-action-btn").forEach((b, i) => {
      b.className = `modal-action-btn ${actions[i] === action ? action : ""}`
    })
  }
}

// ─── Movie detail modal ───────────────────────────────────────────────────────
async function openModal(id, title, year, genre, lang, rating, poster, plot, director, actors) {
  document.getElementById("modal-img").src   = poster && poster !== "N/A" ? poster : `https://placehold.co/680x220/1c1c1c/444?text=${encodeURIComponent(title)}`
  document.getElementById("modal-title").textContent = title

  document.getElementById("modal-meta").innerHTML = [
    year   ? `<span>📅 ${year}</span>`   : "",
    rating ? `<span>⭐ ${rating}</span>` : "",
    genre  ? `<span>🎭 ${genre.split(",")[0]}</span>` : "",
    lang   ? `<span>🌐 ${lang.split(",")[0]}</span>`  : "",
  ].filter(Boolean).join("")

  document.getElementById("modal-plot").textContent = plot && plot !== "N/A" ? plot : "No description available."
  document.getElementById("modal-cast").innerHTML   = director && director !== "N/A"
    ? `<strong>Director:</strong> ${director} ${actors && actors !== "N/A" ? `· <strong>Cast:</strong> ${actors.split(",").slice(0,3).join(",")}` : ""}`
    : actors && actors !== "N/A" ? `<strong>Cast:</strong> ${actors.split(",").slice(0,3).join(",")}` : ""

  // Action buttons
  const action  = getMyAction(id)
  const actions = ["liked","watched","disliked","skipped"]
  const labels  = ["❤ Like","✓ Seen","✗ Nope","⏭ Skip"]
  document.getElementById("modal-actions").innerHTML = actions.map((a, i) => `
    <button class="modal-action-btn ${action === a ? a : ""}"
      onclick="saveBehavior('${id}','${safeStr(title)}','${year}','${genre}','${lang}','movie','${safeStr(poster)}','${a}',this)">
      ${labels[i]}
    </button>
  `).join("")

  // Open modal
  document.getElementById("modal-overlay").classList.add("open")

  // Load similar movies
  const simEl = document.getElementById("similar-section")
  simEl.innerHTML = `<div class="modal-section-title" style="margin-top:4px">SIMILAR MOVIES</div><div class="spinner">LOADING</div>`

  try {
    // Search by genre keyword for similar movies
    const keyword = genre ? genre.split(",")[0].trim() : title.split(" ")[0]
    const res = await fetch(`${API}/search?q=${encodeURIComponent(keyword)}`).then(r => r.json())
    const similar = (res.Search || []).filter(m => m.imdbID !== id).slice(0, 8)

    if (!similar.length) { simEl.innerHTML = ""; return }

    simEl.innerHTML = `
      <div class="modal-section-title" style="margin-top:4px">SIMILAR MOVIES</div>
      <div class="scroll-row">
        ${similar.map(m => `
          <div class="scroll-card" onclick="closeModal();setTimeout(()=>openModal('${m.imdbID}','${safeStr(m.Title)}','${m.Year}','','','','${safeStr(m.Poster)}','','',''),200)">
            <img src="${getPoster(m.Poster, m.Title)}" loading="lazy"
              onerror="this.src='https://placehold.co/110x165/1c1c1c/444?text=?'"/>
            <div class="scroll-card-title">${m.Title}</div>
            <div class="scroll-card-year">${m.Year}</div>
          </div>
        `).join("")}
      </div>
    `
  } catch { simEl.innerHTML = "" }
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open")
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal() })

// ─── My List ─────────────────────────────────────────────────────────────────
function renderMyList() {
  const el = document.getElementById("mylist-content")
  if (!myBehavior.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Nothing here yet — rate some movies!</div></div>`
    return
  }
  const groups  = { liked:[], watched:[], saved:[], skipped:[], disliked:[] }
  const gLabels = { liked:"❤️ Liked", watched:"✅ Watched", saved:"🔖 Saved", skipped:"⏭ Skipped", disliked:"👎 Disliked" }
  const gColors = { liked:"#ef4444", watched:"var(--green)", saved:"var(--blue)", skipped:"var(--gold)", disliked:"var(--muted)" }
  myBehavior.forEach(b => { if (groups[b.action]) groups[b.action].push(b) })

  el.innerHTML = Object.entries(groups).filter(([,items])=>items.length>0).map(([action,items])=>`
    <div class="list-group">
      <div class="list-group-head">
        <div class="list-group-title" style="color:${gColors[action]}">${gLabels[action]}</div>
        <div class="list-group-count">${items.length}</div>
      </div>
      <div class="movie-grid">
        ${items.map(b=>`
          <div class="movie-card" onclick="openModal('${b.movieId}','${safeStr(b.movieTitle)}','${b.movieYear||""}','${b.movieGenre||""}','${b.movieLang||""}','','${safeStr(b.posterUrl||"")}','','','')">
            <img class="card-poster" src="${b.posterUrl||`https://placehold.co/130x195/1c1c1c/444?text=?`}" loading="lazy"
              onerror="this.src='https://placehold.co/130x195/1c1c1c/444?text=?'"/>
            <div class="card-body">
              <div class="card-title">${b.movieTitle}</div>
              <div class="card-year">${b.movieYear||""}</div>
              <button class="action-btn" style="width:100%;margin-top:6px"
                onclick="event.stopPropagation();removeBehavior('${b.movieId}')">✕ Remove</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("")
}

function removeBehavior(movieId) {
  myBehavior = myBehavior.filter(b => b.movieId !== movieId)
  renderMyList()
  toast("Removed", "var(--muted)")
}

// ─── Profile ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  const profile = await apiFetch("/profile")
  const liked   = myBehavior.filter(b=>b.action==="liked").length
  const watched = myBehavior.filter(b=>b.action==="watched").length
  const disliked= myBehavior.filter(b=>b.action==="disliked").length
  const genres  = profile.tasteProfile?.genres    ? Object.fromEntries(profile.tasteProfile.genres)    : {}
  const langs   = profile.tasteProfile?.languages ? Object.fromEntries(profile.tasteProfile.languages) : {}
  const topG = Object.entries(genres).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const topL = Object.entries(langs).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const mG = topG[0]?.[1]||1, mL = topL[0]?.[1]||1

  document.getElementById("profile-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--red),var(--orange));display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0">${(profile.username||"?")[0].toUpperCase()}</div>
      <div>
        <div style="font-size:16px;font-weight:700">@${profile.username}</div>
        <div style="font-size:11px;color:var(--muted)">${profile.email}</div>
      </div>
    </div>
    <div class="stats-row">
      ${[["❤️",liked,"LIKED","#ef4444"],["✅",watched,"WATCHED","var(--green)"],["👎",disliked,"DISLIKED","var(--muted)"],["👥",profile.friends?.length||0,"FRIENDS","var(--blue)"]]
        .map(([icon,n,label,color])=>`
          <div class="stat-card">
            <div class="stat-icon">${icon}</div>
            <div class="stat-num" style="color:${color}">${n}</div>
            <div class="stat-label">${label}</div>
          </div>`).join("")}
    </div>
    ${topG.length ? `
      <div style="font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:10px">GENRE TASTE</div>
      <div class="taste-grid">
        ${topG.map(([g,s])=>`
          <div class="taste-item">
            <div class="taste-label">${g}</div>
            <div class="taste-bg"><div class="taste-fill" style="width:${(s/mG)*100}%;background:var(--red)"></div></div>
            <div class="taste-pts">${s} pts</div>
          </div>`).join("")}
      </div>` : ""}
    ${topL.length ? `
      <div style="font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:700;margin:16px 0 10px">LANGUAGE TASTE</div>
      <div class="taste-grid">
        ${topL.map(([l,s])=>`
          <div class="taste-item">
            <div class="taste-label">${l}</div>
            <div class="taste-bg"><div class="taste-fill" style="width:${(s/mL)*100}%;background:var(--orange)"></div></div>
            <div class="taste-pts" style="color:var(--orange)">${s} pts</div>
          </div>`).join("")}
      </div>` : ""}
  `
}

// ─── Friends ──────────────────────────────────────────────────────────────────
async function loadFriends() {
  const data = await apiFetch("/friends")

  const reqEl = document.getElementById("friend-requests-section")
  if (data.friendRequests?.length > 0) {
    reqEl.innerHTML = `
      <div style="font-size:10px;letter-spacing:2px;color:var(--gold);font-weight:700;margin-bottom:10px">PENDING (${data.friendRequests.length})</div>
      <div class="user-list" style="margin-bottom:16px">
        ${data.friendRequests.map(r=>`
          <div class="user-row">
            <div class="u-avatar">${r.fromUsername[0].toUpperCase()}</div>
            <div class="u-name">${r.fromUsername}</div>
            <button class="btn-sm g" onclick="acceptFriend('${r.fromUserId}','${r.fromUsername}')">Accept</button>
            <button class="btn-sm" onclick="declineFriend('${r.fromUserId}')">Decline</button>
          </div>`).join("")}
      </div>`
    updateBadge(data.friendRequests.length)
  } else {
    reqEl.innerHTML = ""
    updateBadge(0)
  }

  const listEl = document.getElementById("friends-list")
  if (!data.friends?.length) {
    listEl.innerHTML = `<div class="empty" style="padding:40px 20px"><div class="empty-icon">👥</div><div class="empty-text">No friends yet</div></div>`
    return
  }

  listEl.innerHTML = data.friends.map(f=>`
    <div class="user-row">
      <div class="u-avatar">${f.username[0].toUpperCase()}</div>
      <div class="u-name">${f.username}</div>
      <button class="btn-sm b" onclick="viewFriendLikes('${f.userId}','${f.username}')">Likes</button>
      <button class="btn-sm b" onclick="viewFriendRecs('${f.userId}','${f.username}')">Picks</button>
      <button class="btn-sm r" onclick="removeFriend('${f.userId}')">✕</button>
    </div>`).join("")
}

function updateBadge(count) {
  const b = document.getElementById("friend-badge")
  if (count > 0) { b.textContent = count; b.style.display = "block"; }
  else b.style.display = "none"
}

async function pollFriendRequests() {
  try {
    const data = await apiFetch("/friends")
    updateBadge(data.friendRequests?.length || 0)
  } catch {}
  setTimeout(pollFriendRequests, 30000)
}

async function searchUsers() {
  const q  = document.getElementById("user-search-input").value.trim()
  if (!q) return
  const users = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`)
  const el    = document.getElementById("user-search-results")
  if (!users.length) { el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px">No users found</div>`; return }
  el.innerHTML = users.map(u=>`
    <div class="user-row">
      <div class="u-avatar">${u.username[0].toUpperCase()}</div>
      <div class="u-name">${u.username}</div>
      <button class="btn-sm r" onclick="sendFriendRequest('${u._id}')">+ Add</button>
    </div>`).join("")
}

async function sendFriendRequest(toUserId) {
  const data = await apiFetch("/friends/request", { method:"POST", body:JSON.stringify({toUserId}) })
  toast(data.error || data.message, data.error ? "var(--red)" : "var(--green)")
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

// ── See friend's liked movies ─────────────────────────────────────────────────
async function viewFriendLikes(friendId, friendName) {
  const activity = await apiFetch(`/friends/${friendId}/activity`)
  const el = document.getElementById("friends-list")
  if (!activity.length) { toast(`${friendName} hasn't liked anything yet`); return }
  el.innerHTML = `
    <div style="font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:12px">${friendName.toUpperCase()}'S LIKES</div>
    <div class="movie-grid">
      ${activity.map(b=>`
        <div class="movie-card" onclick="openModal('${b.movieId}','${safeStr(b.movieTitle)}','${b.movieYear||""}','${b.movieGenre||""}','${b.movieLang||""}','','${safeStr(b.posterUrl||"")}','','','')">
          <img class="card-poster" src="${b.posterUrl||`https://placehold.co/130x195/1c1c1c/444?text=?`}" loading="lazy"
            onerror="this.src='https://placehold.co/130x195/1c1c1c/444?text=?'"/>
          <div class="card-body">
            <div class="card-title">${b.movieTitle}</div>
            <div class="card-year">${b.movieYear||""}</div>
          </div>
        </div>`).join("")}
    </div>
    <button class="btn-sm" style="margin-top:14px;width:100%" onclick="loadFriends()">← Back</button>
  `
}

// ── See friend's recommendations ──────────────────────────────────────────────
async function viewFriendRecs(friendId, friendName) {
  const el = document.getElementById("friends-list")
  el.innerHTML = `<div class="spinner">LOADING ${friendName.toUpperCase()}'S PICKS</div>`
  const data = await apiFetch(`/friends/${friendId}/recommend`)
  const recs = data.recommendations || []
  if (!recs.length) { toast(`No picks for ${friendName} yet`); loadFriends(); return }
  el.innerHTML = `
    <div style="font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:12px">${friendName.toUpperCase()}'S PICKS · ${data.basedOn||""}</div>
    <div class="movie-grid">
      ${recs.map(m => movieCard(m, getMyAction(m.imdbID), m.matchPercent)).join("")}
    </div>
    <button class="btn-sm" style="margin-top:14px;width:100%" onclick="loadFriends()">← Back</button>
  `
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPoster(poster, title) {
  return poster && poster !== "N/A"
    ? poster
    : `https://placehold.co/130x195/1c1c1c/444?text=${encodeURIComponent((title||"?").substring(0,8))}`
}

function safeStr(s) {
  return (s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g," ")
}