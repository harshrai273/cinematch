const API = window.location.origin

let token      = localStorage.getItem("token")    || null
let userId     = localStorage.getItem("userId")   || null
let username   = localStorage.getItem("username") || null
let myBehavior = []

window.onload = () => { if (token && userId) showApp() }

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, color = "#e50914") {
  const t = document.getElementById("toast")
  t.textContent = msg; t.style.borderLeftColor = color; t.style.display = "block"
  setTimeout(() => t.style.display = "none", 2800)
}

// ─── Auth tabs ────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("login-form").style.display  = tab === "login"  ? "block" : "none"
  document.getElementById("signup-form").style.display = tab === "signup" ? "block" : "none"
  document.querySelectorAll(".auth-tab").forEach((b, i) =>
    b.classList.toggle("active", (i === 0) === (tab === "login")))
  const sw = document.querySelector(".auth-switch")
  sw.innerHTML = tab === "login"
    ? `No account? <span onclick="switchTab('signup')">Sign Up</span>`
    : `Have an account? <span onclick="switchTab('login')">Sign In</span>`
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function register() {
  const u=document.getElementById("signup-username").value.trim()
  const e=document.getElementById("signup-email").value.trim()
  const p=document.getElementById("signup-password").value
  const c=document.getElementById("signup-confirm").value
  const err=document.getElementById("signup-error"); err.textContent=""
  if(!u||!e||!p) return err.textContent="All fields required"
  if(p!==c)      return err.textContent="Passwords don't match"
  if(p.length<4) return err.textContent="Password too short"
  const res=await fetch(`${API}/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,email:e,password:p})})
  const data=await res.json()
  if(data.error) return err.textContent=data.error
  saveSession(data); showApp()
}

async function login() {
  const e=document.getElementById("login-email").value.trim()
  const p=document.getElementById("login-password").value
  const err=document.getElementById("login-error"); err.textContent=""
  if(!e||!p) return err.textContent="Fill in all fields"
  const res=await fetch(`${API}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,password:p})})
  const data=await res.json()
  if(data.error) return err.textContent=data.error
  saveSession(data); showApp()
}

function saveSession(data) {
  token=data.token; userId=data.userId; username=data.username
  localStorage.setItem("token",token)
  localStorage.setItem("userId",userId)
  localStorage.setItem("username",username)
}

function logout() {
  localStorage.clear(); token=userId=username=null
  document.getElementById("app-screen").style.display="none"
  document.getElementById("auth-screen").style.display="flex"
}

// ─── View switching ───────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"))
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.remove("active"))
  document.getElementById("view-"+name).classList.add("active")
  event.target.classList.add("active")
  if(name==="recommendations") loadRecommendations()
  if(name==="mylist")          renderMyList()
  if(name==="friends")         loadFriends()
  if(name==="profile")         loadProfile()
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(url, options={}) {
  options.headers={...options.headers,"Authorization":`Bearer ${token}`,"Content-Type":"application/json"}
  const res=await fetch(API+url,options)
  return res.json()
}

async function loadMyBehavior() { myBehavior=await apiFetch("/behavior") }
function getMyAction(movieId) { return myBehavior.find(b=>b.movieId===movieId)?.action||null }

// ─── Streaming ────────────────────────────────────────────────────────────────
const PLATFORM_COLORS={
  "Netflix":"#e50914","Amazon Prime Video":"#00a8e0","Disney+":"#113ccf",
  "Disney+ Hotstar":"#1f80e0","Apple TV+":"#555","HBO Max":"#5822b4",
  "Hulu":"#1ce783","JioCinema":"#8b2be2","ZEE5":"#7b2ff7","SonyLIV":"#e4002b",
  "Crunchyroll":"#f47521","Viki":"#1aacff","Tubi":"#fa5a00"
}

function guessStreaming(movie) {
  const lang =(movie.Language||"").toLowerCase()
  const genre=(movie.Genre   ||"").toLowerCase()
  const year =parseInt(movie.Year)||0
  if(lang.includes("hindi")||lang.includes("telugu")||lang.includes("tamil")||lang.includes("kannada")||lang.includes("malayalam"))
    return ["JioCinema","Disney+ Hotstar","Netflix"]
  if(lang.includes("japanese")) return ["Crunchyroll","Netflix"]
  if(lang.includes("korean"))   return ["Netflix","Viki"]
  if(genre.includes("animation")||genre.includes("family")) return ["Disney+","Netflix"]
  if(year>=2022) return ["Netflix","Amazon Prime Video","Apple TV+"]
  if(year>=2015) return ["Netflix","Amazon Prime Video","Disney+"]
  return ["Amazon Prime Video","Netflix","Tubi"]
}

function streamingBadges(platforms=[]) {
  if(!platforms?.length) return ""
  return `<div class="streaming-row"><span class="streaming-label">Watch on</span>
    ${platforms.map(p=>`<span class="platform-badge" style="background:${PLATFORM_COLORS[p]||"#444"}">${p}</span>`).join("")}
  </div>`
}

// ─── MOVIE CARD ───────────────────────────────────────────────────────────────
function movieCard(movie, currentAction, opts={}) {
  const poster  = movie.Poster&&movie.Poster!=="N/A" ? movie.Poster : "https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image"
  const id      = movie.imdbID    || movie.movieId
  const title   = movie.Title     || movie.movieTitle   || "Unknown"
  const year    = movie.Year      || movie.movieYear    || ""
  const genre   = movie.Genre     || movie.movieGenre   || ""
  const lang    = movie.Language  || movie.movieLang    || ""
  const type    = movie.Type      || movie.movieType    || "movie"
  const plot    = movie.Plot&&movie.Plot!=="N/A"       ? movie.Plot    : ""
  const rating  = movie.imdbRating&&movie.imdbRating!=="N/A" ? movie.imdbRating : ""
  const runtime = movie.Runtime&&movie.Runtime!=="N/A" ? movie.Runtime : ""
  const streaming = movie.streamingOn || guessStreaming(movie)

  const safe = s => (s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"')

  const actions=["liked","watched","disliked","skipped","saved"]
  const labels =["❤ Like","✓ Seen","✗ Nope","⏭ Skip","🔖 Save"]
  const btns=actions.map((a,i)=>`
    <button class="action-btn ${currentAction===a?a:""}"
      onclick="event.stopPropagation();saveBehavior('${safe(id)}','${safe(title)}','${safe(year)}','${safe(genre)}','${safe(lang)}','${safe(type)}','${safe(poster)}','${a}')">
      ${labels[i]}
    </button>`).join("")

  const matchBar = opts.matchPercent ? `
    <div class="match-bar-wrap">
      <div class="match-bar-labels">
        <span>MATCH</span>
        <span style="color:${opts.matchPercent>=70?"#22c55e":opts.matchPercent>=45?"#eab308":"#ef4444"};font-weight:700">${opts.matchPercent}%</span>
      </div>
      <div class="match-bar-bg"><div class="match-bar-fill" style="width:${opts.matchPercent}%;background:${opts.matchPercent>=70?"#22c55e":opts.matchPercent>=45?"#eab308":"#ef4444"}"></div></div>
    </div>` : ""

  return `
    <div class="movie-card" onclick="openMovieModal('${safe(id)}')">
      <div class="movie-poster-wrap">
        <img src="${poster}" alt="${safe(title)}" loading="lazy"
          onerror="this.src='https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'"/>
        ${rating?`<div class="imdb-badge">⭐ ${rating}</div>`:""}
        ${type==="series"?`<div class="type-badge">SERIES</div>`:""}
        <div class="poster-overlay">🔍</div>
      </div>
      <div class="movie-card-info">
        <div class="movie-card-title">${title}</div>
        <div class="movie-card-meta">
          ${year?`<span>${year}</span>`:""}
          ${runtime?`<span>${runtime}</span>`:""}
          ${genre?`<span class="genre-tag">${genre.split(",")[0].trim()}</span>`:""}
        </div>
        ${plot?`<div class="movie-plot">${plot.length>110?plot.slice(0,110)+"…":plot}</div>`:""}
        ${matchBar}
        ${streamingBadges(streaming)}
        <div class="action-btns">${btns}</div>
      </div>
    </div>`
}

// ─── MOVIE DETAIL MODAL ───────────────────────────────────────────────────────
function openMovieModal(imdbID) {
  if(!imdbID||imdbID==="undefined") return
  const modal=document.getElementById("movie-modal")
  const content=document.getElementById("modal-content")
  modal.style.display="flex"
  document.body.style.overflow="hidden"
  content.innerHTML=`<div class="spinner" style="min-height:320px"><div class="spin-ring"></div> Loading details…</div>`

  apiFetch(`/movie/${imdbID}`).then(movie => {
    if(!movie||movie.Error||movie.Response==="False") {
      content.innerHTML=`<div class="empty-state" style="min-height:280px"><div class="icon">⚠️</div><p>Could not load movie details.</p></div>`
      return
    }
    movie.streamingOn = guessStreaming(movie)
    renderModal(movie)
  }).catch(()=>{
    content.innerHTML=`<div class="empty-state" style="min-height:280px"><div class="icon">⚠️</div><p>Failed to connect to server.</p></div>`
  })
}

function closeMovieModal() {
  document.getElementById("movie-modal").style.display="none"
  document.body.style.overflow=""
}

function renderModal(m) {
  const content = document.getElementById("modal-content")
  const poster  = m.Poster&&m.Poster!=="N/A" ? m.Poster : null
  const id      = m.imdbID||""
  const title   = m.Title||"Unknown"
  const year    = m.Year||""
  const rated   = m.Rated&&m.Rated!=="N/A"     ? m.Rated   : ""
  const runtime = m.Runtime&&m.Runtime!=="N/A" ? m.Runtime : ""
  const genre   = m.Genre||""
  const plot    = m.Plot&&m.Plot!=="N/A"       ? m.Plot    : "No description available."
  const director= m.Director&&m.Director!=="N/A" ? m.Director : ""
  const writer  = m.Writer&&m.Writer!=="N/A"   ? m.Writer  : ""
  const actors  = m.Actors&&m.Actors!=="N/A"   ? m.Actors  : ""
  const lang    = m.Language&&m.Language!=="N/A"? m.Language: ""
  const country = m.Country&&m.Country!=="N/A" ? m.Country : ""
  const awards  = m.Awards&&m.Awards!=="N/A"   ? m.Awards  : ""
  const boxoff  = m.BoxOffice&&m.BoxOffice!=="N/A" ? m.BoxOffice : ""
  const type    = m.Type||"movie"
  const imdbRating = m.imdbRating&&m.imdbRating!=="N/A" ? m.imdbRating : ""
  const imdbVotes  = m.imdbVotes&&m.imdbVotes!=="N/A"   ? m.imdbVotes  : ""
  const streaming  = m.streamingOn||[]
  const currentAction = getMyAction(id)

  // Ratings from Rotten Tomatoes, Metacritic etc
  const otherRatings = (m.Ratings||[]).filter(r=>r.Source!=="Internet Movie Database")

  const safe = s=>(s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"')

  const actions=["liked","watched","disliked","skipped","saved"]
  const labels =["❤️ Like","✓ Watched","✗ Dislike","⏭ Skip","🔖 Save"]
  const actionBtns=actions.map((a,i)=>`
    <button class="modal-action-btn ${currentAction===a?a:""}"
      onclick="saveBehaviorFromModal('${safe(id)}','${safe(title)}','${safe(year)}','${safe(genre)}','${safe(lang)}','${safe(type)}','${safe(poster||"")}','${a}')">
      ${labels[i]}
    </button>`).join("")

  content.innerHTML=`
    <!-- Hero banner -->
    <div class="modal-hero">
      ${poster?`<div class="modal-hero-bg" style="background-image:url('${poster}')"></div>`
               :`<div class="modal-hero-bg" style="background:#1a1a1a"></div>`}
      ${poster?`<img class="modal-hero-poster" src="${poster}" alt="${safe(title)}"
          onerror="this.style.display='none'"/>`:""}
      <div class="modal-hero-titles">
        <div class="modal-hero-title">${title}</div>
        <div class="modal-hero-meta">
          ${year?`<span class="modal-badge">${year}</span>`:""}
          ${runtime?`<span class="modal-badge">${runtime}</span>`:""}
          ${rated?`<span class="modal-badge rated">${rated}</span>`:""}
          ${type==="series"?`<span class="modal-badge type">SERIES</span>`:""}
          ${imdbRating?`<span class="modal-badge imdb">⭐ ${imdbRating}/10</span>`:""}
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="modal-body">

      <!-- Genres -->
      ${genre?`<div class="modal-genres">
        ${genre.split(",").map(g=>`<span class="modal-genre-tag">${g.trim()}</span>`).join("")}
      </div>`:""}

      <!-- Plot -->
      <p class="modal-plot">${plot}</p>

      <!-- Ratings row -->
      ${imdbRating||otherRatings.length?`
        <div class="modal-ratings-row">
          ${imdbRating?`
            <div class="modal-rating-box">
              <div class="modal-rating-val">${imdbRating}</div>
              <div class="modal-rating-src">IMDb${imdbVotes?`<br><span style="font-size:9px">${imdbVotes} votes</span>`:""}</div>
            </div>`:""}
          ${otherRatings.map(r=>`
            <div class="modal-rating-box">
              <div class="modal-rating-val" style="font-size:15px">${r.Value}</div>
              <div class="modal-rating-src">${r.Source.replace("Rotten Tomatoes","Rotten Tom.").replace("Metacritic","Metacritic")}</div>
            </div>`).join("")}
        </div>`:""}

      <!-- Details grid -->
      <div class="modal-row">
        ${director?`<div class="modal-col">
          <div class="modal-label">Director</div>
          <div class="modal-value">${director}</div>
        </div>`:""}
        ${actors?`<div class="modal-col">
          <div class="modal-label">Cast</div>
          <div class="modal-value">${actors}</div>
        </div>`:""}
      </div>

      ${writer||lang||country?`<div class="modal-row">
        ${writer?`<div class="modal-col">
          <div class="modal-label">Writer</div>
          <div class="modal-value">${writer}</div>
        </div>`:""}
        ${lang?`<div class="modal-col">
          <div class="modal-label">Language</div>
          <div class="modal-value">${lang}</div>
        </div>`:""}
        ${country?`<div class="modal-col">
          <div class="modal-label">Country</div>
          <div class="modal-value">${country}</div>
        </div>`:""}
      </div>`:""}

      ${awards||boxoff?`<div class="modal-row">
        ${awards?`<div class="modal-col">
          <div class="modal-label">Awards</div>
          <div class="modal-value">${awards}</div>
        </div>`:""}
        ${boxoff?`<div class="modal-col">
          <div class="modal-label">Box Office</div>
          <div class="modal-value">${boxoff}</div>
        </div>`:""}
      </div>`:""}

      <!-- Streaming -->
      ${streaming.length?`
        <div class="modal-streaming">
          <div class="modal-streaming-title">Where to Watch</div>
          <div class="modal-platforms">
            ${streaming.map(p=>`<span class="modal-platform" style="background:${PLATFORM_COLORS[p]||"#333"}">${p}</span>`).join("")}
          </div>
        </div>`:""}

      <!-- Action buttons -->
      <div class="modal-actions">${actionBtns}</div>

      <!-- More Like This -->
      <div id="modal-similar" style="margin-top:20px">
        <div class="section-title" style="margin-bottom:10px">MORE LIKE THIS</div>
        <div style="color:#555;font-size:13px">Loading…</div>
      </div>
    </div>
  `

  // Load similar movies smartly after render
  const simLang = lang ? lang.split(",")[0].trim() : ""
  const simGenre = genre ? genre.split(",")[0].trim() : ""
  const simYear = year ? parseInt(year) : 2020
  // Build smart query: language + genre for non-English, just genre for English
  let simQuery = simGenre
  if(simLang && simLang!=="English" && simLang!=="N/A") {
    simQuery = `${simLang} ${simGenre} ${simYear}`
  } else if(simGenre) {
    simQuery = `${simGenre} ${simYear}`
  }
  fetch(`${API}/search?q=${encodeURIComponent(simQuery)}`).then(r=>r.json()).then(data=>{
    const simEl = document.getElementById("modal-similar")
    if(!simEl) return
    const results = (data.Search||[]).filter(m=>m.imdbID!==id).slice(0,8)
    if(!results.length){simEl.innerHTML="";return}
    simEl.innerHTML=`
      <div class="section-title" style="margin-bottom:10px">MORE LIKE THIS</div>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px">
        ${results.map(m=>`
          <div onclick="closeMovieModal();setTimeout(()=>openMovieModal('${m.imdbID}'),200)"
            style="flex-shrink:0;width:90px;cursor:pointer">
            ${m.Poster&&m.Poster!=="N/A"
              ? `<img src="${m.Poster}" style="width:90px;height:135px;object-fit:cover;border-radius:8px;border:1px solid #2a2a2a" loading="lazy" onerror="this.style.display='none'"/>`
              : `<div style="width:90px;height:135px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid #2a2a2a">🎬</div>`}
            <div style="font-size:10px;color:#ccc;margin-top:5px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${m.Title}</div>
            <div style="font-size:10px;color:#666">${m.Year||""}</div>
          </div>`).join("")}
      </div>`
  }).catch(()=>{})
}

// Save from modal and update button states inside modal
async function saveBehaviorFromModal(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action) {
  await saveBehavior(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action)
  // Update modal buttons
  const btns = document.querySelectorAll(".modal-action-btn")
  const actions = ["liked","watched","disliked","skipped","saved"]
  btns.forEach((btn,i) => {
    btn.className = `modal-action-btn ${actions[i]===action ? action : ""}`
  })
}

// ─── Search ───────────────────────────────────────────────────────────────────
async function searchMovies() {
  const q=document.getElementById("search-input").value.trim()
  if(!q) return
  const el=document.getElementById("search-results")
  el.innerHTML=`<div class="spinner"><div class="spin-ring"></div> Searching…</div>`
  const data=await fetch(`${API}/search?q=${encodeURIComponent(q)}`).then(r=>r.json())
  if(!data.Search) {
    el.innerHTML=`<div class="empty-state"><div class="icon">🎬</div><p>No results for "${q}"</p></div>`
    return
  }
  const top=data.Search.slice(0,10)
  const enriched=await Promise.allSettled(top.map(m=>apiFetch(`/movie/${m.imdbID}`)))
  const movies=enriched.map((r,i)=>{
    const full=r.status==="fulfilled"&&r.value?.imdbID ? r.value : top[i]
    full.streamingOn=guessStreaming(full)
    return full
  })
  el.innerHTML=`<div class="movie-grid">${movies.map(m=>movieCard(m,getMyAction(m.imdbID))).join("")}</div>`
}

// ─── Save behavior ────────────────────────────────────────────────────────────
async function saveBehavior(movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action) {
  const data=await apiFetch("/behavior",{method:"POST",body:JSON.stringify({movieId,movieTitle,movieYear,movieGenre,movieLang,movieType,posterUrl,action})})
  if(data.error) return toast("Error: "+data.error)
  myBehavior=myBehavior.filter(b=>b.movieId!==movieId)
  myBehavior.unshift({movieId,movieTitle,movieYear,movieGenre,movieLang,movieType,posterUrl,action})
  const labels={loved:"😍 Loved it!",liked:"❤️ Liked!",watched:"✅ Watched!",rewatch:"🔁 Want to rewatch!",recommend:"📣 Recommended!",watchlist:"🔖 Added to Watchlist!",disliked:"👎 Noted",skipped:"⏭ Skipped",saved:"🔖 Saved!"}
  const colors={loved:"#f43f5e",liked:"#ef4444",watched:"#22c55e",rewatch:"#f59e0b",recommend:"#a855f7",watchlist:"#3b82f6",disliked:"#64748b",skipped:"#eab308",saved:"#3b82f6"}
  toast(labels[action],colors[action])
  // Update card buttons in background grid
  document.querySelectorAll(".movie-card").forEach(card=>{
    const t=card.querySelector(".movie-card-title")
    if(t&&t.textContent.trim()===movieTitle){
      const acts=["liked","watched","disliked","skipped","saved"]
      card.querySelectorAll(".action-btn").forEach((btn,i)=>{
        btn.className=`action-btn ${acts[i]===action?action:""}`
      })
    }
  })
}

// ─── Recommendations ──────────────────────────────────────────────────────────
async function loadRecommendations() {
  const el=document.getElementById("rec-results")
  const msg=document.getElementById("rec-basis")
  el.innerHTML=`<div class="spinner"><div class="spin-ring"></div> Building your personalised recommendations…</div>`
  msg.textContent=""
  const data=await apiFetch("/recommend")
  if(data.error){el.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><p>${data.error}</p></div>`;return}
  if(data.newUser||!data.recommendations?.length){
    msg.textContent="🎬 Trending picks — rate movies to get personalised recommendations!"
    await loadDiscover(); return
  }
  msg.textContent=data.basedOn?`📊 ${data.basedOn}`:""
  el.innerHTML=`<div class="movie-grid">${data.recommendations.map(m=>movieCard(m,getMyAction(m.imdbID),{matchPercent:m.matchPercent})).join("")}</div>`
}

async function loadDiscover() {
  const el=document.getElementById("rec-results")
  el.innerHTML=`<div class="spinner"><div class="spin-ring"></div> Loading trending movies…</div>`
  try {
    const data=await fetch(`${API}/discover`).then(r=>r.json())
    if(!data.movies?.length){el.innerHTML=`<div class="empty-state"><div class="icon">🎬</div><p>Could not load movies.</p></div>`;return}
    el.innerHTML=`<div class="movie-grid">${data.movies.map(m=>movieCard(m,getMyAction(m.imdbID))).join("")}</div>`
  } catch {
    el.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><p>Could not connect to server.</p></div>`
  }
}

// ─── My List ──────────────────────────────────────────────────────────────────
function renderMyList() {
  const el=document.getElementById("mylist-content")
  if(!myBehavior.length){el.innerHTML=`<div class="empty-state"><div class="icon">📋</div><p>Nothing here yet.</p></div>`;return}
  const groups={liked:[],watched:[],saved:[],skipped:[],disliked:[]}
  myBehavior.forEach(b=>{if(groups[b.action])groups[b.action].push(b)})
  const labels={liked:"❤️ Liked",watched:"✅ Watched",saved:"🔖 Saved",skipped:"⏭ Skipped",disliked:"👎 Disliked"}
  const colors={liked:"#ef4444",watched:"#22c55e",saved:"#3b82f6",skipped:"#eab308",disliked:"#64748b"}
  el.innerHTML=Object.entries(groups).filter(([,items])=>items.length>0).map(([action,items])=>`
    <div style="margin-bottom:32px">
      <div class="section-title" style="color:${colors[action]}">${labels[action]} (${items.length})</div>
      <div class="movie-grid">
        ${items.map(b=>`
          <div class="movie-card" onclick="openMovieModal('${b.movieId}')">
            <div class="movie-poster-wrap">
              <img src="${b.posterUrl||'https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'}" loading="lazy"
                onerror="this.src='https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'"/>
              <div class="poster-overlay">🔍</div>
            </div>
            <div class="movie-card-info">
              <div class="movie-card-title">${b.movieTitle}</div>
              <div class="movie-card-meta">
                ${b.movieYear?`<span>${b.movieYear}</span>`:""}
                ${b.movieGenre?`<span class="genre-tag">${b.movieGenre.split(",")[0].trim()}</span>`:""}
              </div>
              <button class="action-btn" style="width:100%;margin-top:6px"
                onclick="event.stopPropagation();removeBehavior('${b.movieId}')">✕ Remove</button>
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("")
}

function removeBehavior(movieId) {
  myBehavior=myBehavior.filter(b=>b.movieId!==movieId)
  renderMyList(); toast("Removed","#64748b")
}

// ─── Friends ──────────────────────────────────────────────────────────────────
async function loadFriends() {
  const data=await apiFetch("/friends")
  const reqEl=document.getElementById("friend-requests-section")
  const listEl=document.getElementById("friends-list")
  if(data.friendRequests?.length>0){
    reqEl.innerHTML=`
      <div class="section-title" style="color:#eab308;margin-bottom:10px">PENDING (${data.friendRequests.length})</div>
      ${data.friendRequests.map(r=>`
        <div class="user-row">
          <div class="user-avatar">${r.fromUsername[0].toUpperCase()}</div>
          <div class="user-name">${r.fromUsername}</div>
          <button class="btn-sm" style="background:#22c55e22;border-color:#22c55e;color:#22c55e"
            onclick="acceptFriend('${r.fromUserId}','${r.fromUsername}')">Accept</button>
          <button class="btn-sm" onclick="declineFriend('${r.fromUserId}')">Decline</button>
        </div>`).join("")}`
  } else reqEl.innerHTML=""
  if(!data.friends?.length){listEl.innerHTML=`<div class="empty-state"><div class="icon">👥</div><p>No friends yet.</p></div>`;return}
  listEl.innerHTML=data.friends.map(f=>`
    <div class="user-row">
      <div class="user-avatar">${f.username[0].toUpperCase()}</div>
      <div class="user-name">${f.username}</div>
      <button class="btn-sm" onclick="viewFriendActivity('${f.userId}','${f.username}')">See Likes</button>
      <button class="btn-sm" style="color:#ef4444;border-color:#ef4444" onclick="removeFriend('${f.userId}')">Remove</button>
    </div>`).join("")
}

async function searchUsers() {
  const q=document.getElementById("user-search-input").value.trim()
  if(!q) return
  const users=await apiFetch(`/users/search?q=${encodeURIComponent(q)}`)
  const el=document.getElementById("user-search-results")
  if(!users.length){el.innerHTML=`<div style="color:#888;font-size:13px;padding:8px">No users found</div>`;return}
  el.innerHTML=users.map(u=>`
    <div class="user-row">
      <div class="user-avatar">${u.username[0].toUpperCase()}</div>
      <div class="user-name">${u.username}</div>
      <button class="btn-sm" style="background:#e5091422;border-color:#e50914;color:#e50914"
        onclick="sendFriendRequest('${u._id}')">Add Friend</button>
    </div>`).join("")
}

async function sendFriendRequest(toUserId){const data=await apiFetch("/friends/request",{method:"POST",body:JSON.stringify({toUserId})});toast(data.error||data.message,data.error?"#ef4444":"#22c55e")}
async function acceptFriend(fromUserId,fromUsername){const data=await apiFetch("/friends/accept",{method:"POST",body:JSON.stringify({fromUserId,fromUsername})});toast(data.message,"#22c55e");loadFriends()}
async function declineFriend(fromUserId){await apiFetch("/friends/decline",{method:"POST",body:JSON.stringify({fromUserId})});loadFriends()}
async function removeFriend(friendId){await apiFetch(`/friends/${friendId}`,{method:"DELETE"});toast("Friend removed");loadFriends()}

async function viewFriendActivity(friendId,friendName){
  const activity=await apiFetch(`/friends/${friendId}/activity`)
  const el=document.getElementById("friends-list")
  if(!activity.length){toast(`${friendName} hasn't liked anything yet`);return}
  el.innerHTML=`
    <div class="section-title" style="margin-bottom:14px">${friendName}'s liked movies</div>
    <div class="movie-grid">
      ${activity.map(b=>`
        <div class="movie-card" onclick="openMovieModal('${b.movieId}')">
          <div class="movie-poster-wrap">
            <img src="${b.posterUrl||'https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'}" loading="lazy"
              onerror="this.src='https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'"/>
            <div class="poster-overlay">🔍</div>
          </div>
          <div class="movie-card-info">
            <div class="movie-card-title">${b.movieTitle}</div>
            <div class="movie-card-meta">${b.movieYear||""}</div>
          </div>
        </div>`).join("")}
    </div>
    <button class="btn-sm" style="margin-top:16px" onclick="loadFriends()">← Back</button>`
}

// ─── Profile ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  const el=document.getElementById("profile-content")
  el.innerHTML=`<div class="spinner"><div class="spin-ring"></div> Loading profile…</div>`
  try {
    const profile=await apiFetch("/profile")
    if(profile.error){el.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><p>${profile.error}</p></div>`;return}

    const loved    = myBehavior.filter(b=>b.action==="loved").length
    const liked    = myBehavior.filter(b=>b.action==="liked").length
    const watched  = myBehavior.filter(b=>b.action==="watched").length
    const disliked = myBehavior.filter(b=>b.action==="disliked").length
    const watchlist= myBehavior.filter(b=>b.action==="watchlist").length
    const rewatch  = myBehavior.filter(b=>b.action==="rewatch").length
    const totalRated = myBehavior.length

    let genres={}
    const raw=profile.tasteProfile?.genres
    if(raw){genres=typeof raw.entries==="function"?Object.fromEntries(raw.entries()):typeof raw==="object"?raw:{}}
    const topGenres=Object.entries(genres).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8)
    const maxScore=topGenres[0]?.[1]||1

    let langs={}
    const rawL=profile.tasteProfile?.languages
    if(rawL){langs=typeof rawL.entries==="function"?Object.fromEntries(rawL.entries()):typeof rawL==="object"?rawL:{}}
    const topLangs=Object.entries(langs).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6)
    const maxLang=topLangs[0]?.[1]||1

    const joinDate=profile.createdAt?new Date(profile.createdAt).toLocaleDateString("en-IN",{year:"numeric",month:"long"}):"—"

    // Recently interacted movies
    const recentLoved   = myBehavior.filter(b=>b.action==="loved").slice(0,6)
    const recentLiked   = myBehavior.filter(b=>b.action==="liked").slice(0,6)
    const recentWatched = myBehavior.filter(b=>b.action==="watched").slice(0,6)
    const recentWatchlist = myBehavior.filter(b=>b.action==="watchlist").slice(0,6)
    const recentRewatch = myBehavior.filter(b=>b.action==="rewatch").slice(0,6)

    function miniCard(b) {
      const poster = b.posterUrl && b.posterUrl !== "N/A" ? b.posterUrl : ""
      return `<div class="movie-card" onclick="openMovieModal('${b.movieId}')" style="cursor:pointer">
        <div class="movie-poster-wrap">
          ${poster
            ? `<img src="${poster}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=\'width:100%;aspect-ratio:2/3;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:28px;border-radius:8px\'>🎬</div>'"/>`
            : `<div style="width:100%;aspect-ratio:2/3;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:28px;border-radius:8px">🎬</div>`}
          <div class="poster-overlay">🔍</div>
        </div>
        <div class="movie-card-info">
          <div class="movie-card-title">${b.movieTitle}</div>
          <div class="movie-card-meta">${b.movieYear||""}</div>
        </div>
      </div>`
    }

    function movieSection(title, items, color) {
      if(!items.length) return ""
      return `
        <div style="margin-bottom:28px">
          <div class="section-title" style="color:${color}">${title} (${items.length})</div>
          <div class="movie-grid">${items.map(miniCard).join("")}</div>
        </div>`
    }

    el.innerHTML=`
      <!-- User card -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;background:#1a1a1a;padding:20px;border-radius:14px;border:1px solid #2a2a2a">
        <div class="user-avatar" style="width:60px;height:60px;font-size:26px;flex-shrink:0;background:linear-gradient(135deg,#e50914,#b91c1c)">${(profile.username||"?")[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-size:20px;font-weight:800">@${profile.username||"—"}</div>
          <div style="font-size:13px;color:#888;margin-top:2px">${profile.email||""}</div>
          <div style="font-size:11px;color:#555;margin-top:4px">🗓 Member since ${joinDate} · 🎬 ${totalRated} movies rated</div>
        </div>
      </div>

      <!-- Stats grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:24px">
        ${[["😍",loved,"Loved","#f43f5e"],["❤️",liked,"Liked","#ef4444"],["✅",watched,"Watched","#22c55e"],
           ["🔁",rewatch,"Rewatch","#f59e0b"],["🔖",watchlist,"Watchlist","#3b82f6"],
           ["👎",disliked,"Disliked","#64748b"],["👥",profile.friends?.length||0,"Friends","#a855f7"],
           ["🎬",totalRated,"Total","#e50914"]]
          .map(([icon,n,label,color])=>`
            <div style="background:#1a1a1a;border-radius:10px;padding:12px 8px;text-align:center;border:1px solid #222">
              <div style="font-size:20px;margin-bottom:4px">${icon}</div>
              <div style="font-size:24px;font-weight:800;color:${color}">${n}</div>
              <div style="font-size:9px;color:#666;letter-spacing:1px;margin-top:2px">${label}</div>
            </div>`).join("")}
      </div>

      <!-- Genre taste -->
      ${topGenres.length?`
        <div class="section-title">🎭 GENRE TASTE</div>
        <div class="taste-grid" style="margin-bottom:24px">
          ${topGenres.map(([g,s])=>`
            <div class="taste-item">
              <div class="taste-label">${g}</div>
              <div class="taste-bar-bg"><div class="taste-bar" style="width:${Math.round((s/maxScore)*100)}%;background:linear-gradient(90deg,#e50914,#f97316)"></div></div>
              <div style="font-size:11px;color:#e50914;margin-top:3px;font-weight:700">${s}pts</div>
            </div>`).join("")}
        </div>`
      :`<div style="background:#1a1a1a;border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;color:#555;font-size:13px;border:1px dashed #2a2a2a">
          Rate movies to build your taste profile! 🎬
        </div>`}

      <!-- Language taste -->
      ${topLangs.length?`
        <div class="section-title">🌐 LANGUAGES YOU WATCH</div>
        <div class="taste-grid" style="margin-bottom:24px">
          ${topLangs.map(([l,s])=>`
            <div class="taste-item">
              <div class="taste-label">${l}</div>
              <div class="taste-bar-bg"><div class="taste-bar" style="width:${Math.round((s/maxLang)*100)}%;background:linear-gradient(90deg,#3b82f6,#6366f1)"></div></div>
              <div style="font-size:11px;color:#3b82f6;margin-top:3px;font-weight:700">${s}pts</div>
            </div>`).join("")}
        </div>`:""}

      <!-- Movie sections -->
      ${movieSection("😍 LOVED", recentLoved, "#f43f5e")}
      ${movieSection("❤️ LIKED", recentLiked, "#ef4444")}
      ${movieSection("✅ WATCHED", recentWatched, "#22c55e")}
      ${movieSection("🔁 WANT TO REWATCH", recentRewatch, "#f59e0b")}
      ${movieSection("🔖 WATCHLIST", recentWatchlist, "#3b82f6")}

      ${totalRated===0?`<div style="text-align:center;padding:30px;color:#555">
        <div style="font-size:40px;margin-bottom:12px">🎬</div>
        <div style="font-size:14px">Start rating movies to see your journal here!</div>
      </div>`:""}
    `
  } catch(err) {
    el.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><p>Could not load profile: ${err.message}</p></div>`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FRIEND PROFILE — replaces the simple "See Likes" with a full profile view
// ═══════════════════════════════════════════════════════════════════════════

async function viewFriendProfile(friendId, friendName) {
  const el = document.getElementById("friends-list")
  el.innerHTML = `<div class="spinner"><div class="spin-ring"></div> Loading ${friendName}'s profile…</div>`

  const [profileData, recData] = await Promise.allSettled([
    apiFetch(`/friends/${friendId}/profile`),
    apiFetch(`/friends/${friendId}/recommend`)
  ])

  const pd = profileData.status === "fulfilled" ? profileData.value : null
  const rd = recData.status    === "fulfilled" ? recData.value    : null

  if (!pd || pd.error) {
    el.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${pd?.error||"Could not load profile"}</p></div>
      <button class="btn-sm" style="margin-top:12px" onclick="loadFriends()">← Back</button>`
    return
  }

  const { user, activity } = pd
  const liked    = activity.filter(b => b.action === "liked")
  const watched  = activity.filter(b => b.action === "watched")
  const saved    = activity.filter(b => b.action === "saved")

  // Build taste bars from tasteProfile
  let genres = {}
  const raw = user.tasteProfile?.genres
  if (raw) genres = typeof raw.entries === "function" ? Object.fromEntries(raw.entries()) : (typeof raw === "object" ? raw : {})
  const topGenres = Object.entries(genres).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const maxScore  = topGenres[0]?.[1] || 1

  const tasteBars = topGenres.length
    ? topGenres.map(([g,s]) => `
        <div class="taste-item">
          <div class="taste-label">${g}</div>
          <div class="taste-bar-bg"><div class="taste-bar" style="width:${Math.round((s/maxScore)*100)}%"></div></div>
          <div style="font-size:11px;color:#e50914;margin-top:3px;font-weight:700">${s} pts</div>
        </div>`).join("")
    : `<p style="color:#555;font-size:13px">No taste data yet</p>`

  // Recommendations HTML
  let recsHtml = ""
  if (!rd || rd.error || rd.empty || !rd.recommendations?.length) {
    recsHtml = `<div class="empty-state" style="padding:32px"><div class="icon" style="font-size:32px">🎬</div><p>${friendName} hasn't rated enough movies yet</p></div>`
  } else {
    recsHtml = `
      <p style="font-size:13px;color:#666;margin-bottom:16px">Movies ${friendName} would probably enjoy, based on their taste</p>
      <div class="movie-grid">
        ${rd.recommendations.map(m => movieCard(m, getMyAction(m.imdbID), { matchPercent: m.matchPercent })).join("")}
      </div>`
  }

  // Recent liked cards
  const recentCards = liked.slice(0, 8).map(b => `
    <div class="movie-card" onclick="openMovieModal('${b.movieId}')">
      <div class="movie-poster-wrap">
        <img src="${b.posterUrl||'https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'}" loading="lazy"
          onerror="this.src='https://via.placeholder.com/160x240/1a1a1a/555?text=No+Image'"/>
        <div class="poster-overlay">🔍</div>
      </div>
      <div class="movie-card-info">
        <div class="movie-card-title">${b.movieTitle}</div>
        <div class="movie-card-meta">${b.movieYear||""} ${b.movieGenre?`<span class="genre-tag">${b.movieGenre.split(",")[0].trim()}</span>`:""}</div>
      </div>
    </div>`).join("") || `<p style="color:#555;font-size:13px">Nothing liked yet</p>`

  el.innerHTML = `
    <!-- Back button -->
    <button class="btn-sm" style="margin-bottom:18px" onclick="loadFriends()">← Back to Friends</button>

    <!-- Friend profile header -->
    <div style="display:flex;align-items:center;gap:14px;background:#1a1a1a;padding:18px;border-radius:12px;border:1px solid #222;margin-bottom:20px">
      <div class="user-avatar" style="width:52px;height:52px;font-size:22px;flex-shrink:0">${friendName[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">@${friendName}</div>
        <div style="font-size:12px;color:#555;margin-top:3px">
          ${user.friends?.length||0} friends · joined ${user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN",{year:"numeric",month:"short"}) : "—"}
        </div>
      </div>
    </div>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;margin-bottom:24px">
      ${[["❤️", liked.length, "Liked", "#ef4444"],["✅", watched.length, "Watched", "#22c55e"],
         ["🔖", saved.length, "Saved", "#3b82f6"],["🎬", activity.length, "Rated", "#f59e0b"]]
        .map(([icon,n,label,color])=>`
          <div style="background:#1a1a1a;border-radius:10px;padding:12px 8px;text-align:center;border:1px solid #222">
            <div style="font-size:20px;margin-bottom:4px">${icon}</div>
            <div style="font-size:22px;font-weight:800;color:${color}">${n}</div>
            <div style="font-size:10px;color:#666;letter-spacing:1px">${label}</div>
          </div>`).join("")}
    </div>

    <!-- Tabs -->
    <div style="display:flex;background:#1a1a1a;border-radius:10px;padding:3px;gap:3px;margin-bottom:20px" id="friend-tabs">
      <button class="auth-tab active" style="flex:1" onclick="switchFriendTab('recs','${friendId}')">✦ Recommendations</button>
      <button class="auth-tab"        style="flex:1" onclick="switchFriendTab('liked','${friendId}')">❤️ Liked</button>
      <button class="auth-tab"        style="flex:1" onclick="switchFriendTab('taste','${friendId}')">📊 Taste</button>
    </div>

    <!-- Tab content -->
    <div id="friend-tab-recs">${recsHtml}</div>
    <div id="friend-tab-liked"  style="display:none"><div class="movie-grid">${recentCards}</div></div>
    <div id="friend-tab-taste"  style="display:none">
      <div class="taste-grid">${tasteBars}</div>
    </div>
  `
}

function switchFriendTab(tab, friendId) {
  ["recs","liked","taste"].forEach(t => {
    document.getElementById(`friend-tab-${t}`).style.display = t === tab ? "block" : "none"
  })
  document.querySelectorAll("#friend-tabs .auth-tab").forEach((btn, i) => {
    btn.classList.toggle("active", ["recs","liked","taste"][i] === tab)
  })
}

// Override old viewFriendActivity to use the new full profile
async function viewFriendActivity(friendId, friendName) {
  viewFriendProfile(friendId, friendName)
}