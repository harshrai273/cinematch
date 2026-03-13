const API = window.location.origin

let token      = localStorage.getItem("token")    || null
let userId     = localStorage.getItem("userId")   || null
let username   = localStorage.getItem("username") || null
let myBehavior = []

window.onload = () => { if (token && userId) showApp() }

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById("toast")
  t.textContent = msg; t.style.display = "block"
  clearTimeout(t._t); t._t = setTimeout(() => t.style.display = "none", 2600)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("login-form").style.display  = tab === "login"  ? "block" : "none"
  document.getElementById("signup-form").style.display = tab === "signup" ? "block" : "none"
  document.querySelectorAll(".auth-tab").forEach((b,i) => b.classList.toggle("active",(i===0)===(tab==="login")))
}

async function register() {
  const u=v("su-user"),e=v("su-email"),p=v("su-pass"),c=v("su-confirm")
  const err=document.getElementById("signup-error"); err.textContent=""
  if(!u||!e||!p) return err.textContent="All fields required"
  if(p!==c) return err.textContent="Passwords don't match"
  if(p.length<4) return err.textContent="Password too short"
  const d=await post(`${API}/register`,{username:u,email:e,password:p})
  if(d.error) return err.textContent=d.error
  saveSession(d); showApp()
}

async function login() {
  const e=v("login-email"),p=v("login-password")
  const err=document.getElementById("login-error"); err.textContent=""
  if(!e||!p) return err.textContent="Fill in all fields"
  const d=await post(`${API}/login`,{email:e,password:p})
  if(d.error) return err.textContent=d.error
  saveSession(d); showApp()
}

function v(id){ return document.getElementById(id).value.trim() }

function saveSession(d) {
  token=d.token; userId=d.userId; username=d.username
  localStorage.setItem("token",token)
  localStorage.setItem("userId",userId)
  localStorage.setItem("username",username)
}

function logout() {
  localStorage.clear(); token=userId=username=null
  document.getElementById("app-screen").style.display="none"
  document.getElementById("auth-screen").style.display="flex"
}

function showApp() {
  document.getElementById("auth-screen").style.display="none"
  document.getElementById("app-screen").style.display="block"
  const initial = username[0].toUpperCase()
  document.getElementById("desk-avatar").textContent = initial
  document.getElementById("desk-username").textContent = username
  document.getElementById("mob-avatar").textContent = initial
  loadMyBehavior().then(() => loadHome())
  pollRequests()
}

// ─── Views ────────────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"))
  // Desktop nav
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"))
  const dn = document.getElementById("dnav-"+name)
  if(dn) dn.classList.add("active")
  // Mobile nav
  document.querySelectorAll(".bnav-btn").forEach(b => b.classList.remove("active"))
  const mn = document.getElementById("bnav-"+name)
  if(mn) mn.classList.add("active")

  document.getElementById("view-"+name).classList.add("active")
  if(name==="foryou")  loadForYou()
  if(name==="mylist")  renderMyList()
  if(name==="friends") loadFriends()
  if(name==="profile") loadProfile()
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
async function post(url, body) {
  const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
  return r.json()
}
async function apiFetch(url, opts={}) {
  opts.headers={...opts.headers,"Authorization":`Bearer ${token}`,"Content-Type":"application/json"}
  return (await fetch(API+url,opts)).json()
}

// ─── Behavior ─────────────────────────────────────────────────────────────────
async function loadMyBehavior() {
  const d = await apiFetch("/behavior")
  myBehavior = Array.isArray(d) ? d : []
}
function getAction(id){ return myBehavior.find(b=>b.movieId===id)?.action||null }

// ─── India streaming ──────────────────────────────────────────────────────────
function indiaStreaming(movie) {
  const lang  = (movie.Language||"").toLowerCase()
  const genre = (movie.Genre||"").toLowerCase()
  const title = (movie.Title||"").toLowerCase()
  const year  = parseInt(movie.Year)||0
  const country=(movie.Country||"").toLowerCase()

  if(lang.includes("japanese")||genre.includes("anime"))
    return [{name:"Crunchyroll",cls:"crunchyroll",icon:"🎌"},{name:"Netflix",cls:"netflix",icon:"🎬"},{name:"Prime Video",cls:"prime",icon:"📦"}]

  if(lang.includes("korean"))
    return [{name:"Netflix",cls:"netflix",icon:"🎬"},{name:"Prime Video",cls:"prime",icon:"📦"},{name:"Viki",cls:"ott",icon:"🎭"}]

  const isIndian = lang.includes("hindi")||lang.includes("telugu")||lang.includes("tamil")||
    lang.includes("malayalam")||lang.includes("kannada")||lang.includes("marathi")||country.includes("india")

  if(isIndian) {
    const list=[{name:"JioCinema",cls:"jio",icon:"📱"},{name:"Disney+ Hotstar",cls:"hotstar",icon:"⭐"},{name:"Prime Video",cls:"prime",icon:"📦"}]
    if(lang.includes("hindi")||lang.includes("marathi")) list.push({name:"ZEE5",cls:"zee",icon:"📺"},{name:"SonyLIV",cls:"sony",icon:"🎥"})
    if(lang.includes("malayalam")||lang.includes("telugu")||lang.includes("tamil")||lang.includes("kannada")) list.push({name:"Aha",cls:"ott",icon:"🎬"})
    return list.slice(0,4)
  }

  if(lang.includes("french")||lang.includes("german")||lang.includes("spanish")||lang.includes("italian"))
    return [{name:"Netflix",cls:"netflix",icon:"🎬"},{name:"MUBI",cls:"mubi",icon:"🎞"},{name:"Prime Video",cls:"prime",icon:"📦"}]

  const out=[]
  if(year>=2020) out.push({name:"Netflix",cls:"netflix",icon:"🎬"},{name:"Prime Video",cls:"prime",icon:"📦"})
  else if(year>=2010) out.push({name:"Prime Video",cls:"prime",icon:"📦"},{name:"Netflix",cls:"netflix",icon:"🎬"})
  else out.push({name:"Prime Video",cls:"prime",icon:"📦"},{name:"MUBI",cls:"mubi",icon:"🎞"})
  if(genre.includes("animation")||genre.includes("family")||title.includes("marvel")||title.includes("disney"))
    out.unshift({name:"Disney+ Hotstar",cls:"hotstar",icon:"⭐"})
  if(genre.includes("documentary")) out.push({name:"MUBI",cls:"mubi",icon:"🎞"})
  return [...new Map(out.map(x=>[x.name,x])).values()].slice(0,4)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function goodPoster(p){ return p && p!=="N/A" && p.startsWith("http") }
function ss(s){ return (s||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g," ").substring(0,200) }
function mc(p){ return p>=70?"h":p>=40?"m":"l" }
function dedup(arr) {
  const seen=new Set()
  return arr.filter(m=>{ const id=m.imdbID||m.movieId||""; if(!id||seen.has(id)) return false; seen.add(id); return true })
}

function noPoster(title) {
  return `<div class="card-no-poster"><div class="card-no-poster-icon">🎬</div><div class="card-no-poster-text">${title}</div></div>`
}

// ─── Movie card ───────────────────────────────────────────────────────────────
const ACTIONS = [
  {key:"loved",    label:"😍 Love"},
  {key:"liked",    label:"❤ Like"},
  {key:"watched",  label:"✓ Seen"},
  {key:"watchlist",label:"🔖 List"},
  {key:"rewatch",  label:"🔁 Again"},
  {key:"recommend",label:"📣 Share"},
  {key:"disliked", label:"✗ Nope"},
  {key:"skipped",  label:"⏭ Skip"},
]

function movieCard(movie, matchPercent) {
  const id     = movie.imdbID    || movie.movieId    || ""
  const title  = movie.Title     || movie.movieTitle  || "Unknown"
  const year   = movie.Year      || movie.movieYear   || ""
  const genre  = movie.Genre     || ""
  const lang   = movie.Language  || ""
  const type   = movie.Type      || "movie"
  const poster = movie.Poster    || ""
  const rating = movie.imdbRating && movie.imdbRating!=="N/A" ? movie.imdbRating : null
  const plot   = movie.Plot      || ""
  const dir    = movie.Director  || ""
  const actors = movie.Actors    || ""
  const streams= indiaStreaming(movie)
  const action = getAction(id)

  const btns = ACTIONS.map(a=>`
    <button class="abtn ${action===a.key?a.key:""}"
      onclick="event.stopPropagation();doAction('${id}','${ss(title)}','${year}','${ss(genre)}','${ss(lang)}','${type}','${ss(poster)}','${a.key}',this)">
      ${a.label}
    </button>`).join("")

  const bar = matchPercent!=null ? `
    <div class="match-wrap">
      <div class="match-row"><span>MATCH</span><span class="mpct ${mc(matchPercent)}">${matchPercent}%</span></div>
      <div class="mbar-bg"><div class="mbar-fill ${mc(matchPercent)}" style="width:${matchPercent}%"></div></div>
    </div>` : ""

  const streamBadges = streams.slice(0,2).map(s=>`<span class="sbadge ${s.cls}">${s.name}</span>`).join("")

  return `
    <div class="movie-card" onclick="openModal('${id}','${ss(title)}','${year}','${ss(genre)}','${ss(lang)}','${rating||""}','${ss(poster)}','${ss(plot)}','${ss(dir)}','${ss(actors)}')">
      <div class="card-poster-wrap">
        ${goodPoster(poster)
          ? `<img class="card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML=\`${noPoster(title).replace(/`/g,"'")}\`"/>`
          : noPoster(title)}
        ${rating ? `<div class="card-rating-tag">⭐ ${rating}</div>` : ""}
      </div>
      <div class="card-body">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-meta">${year}${genre?" · "+genre.split(",")[0].trim():""}</div>
        ${bar}
        <div class="action-grid" onclick="event.stopPropagation()">${btns}</div>
        ${streamBadges?`<div class="stream-row">${streamBadges}</div>`:""}
      </div>
    </div>`
}

// ─── Save behavior ────────────────────────────────────────────────────────────
async function doAction(movieId,movieTitle,movieYear,movieGenre,movieLang,movieType,posterUrl,action,btnEl) {
  const data=await apiFetch("/behavior",{method:"POST",body:JSON.stringify({movieId,movieTitle,movieYear,movieGenre,movieLang,movieType,posterUrl,action})})
  if(data.error) return toast("Error: "+data.error)
  myBehavior=myBehavior.filter(b=>b.movieId!==movieId)
  myBehavior.unshift({movieId,movieTitle,movieYear,movieGenre,movieLang,movieType,posterUrl,action})
  const msgs={loved:"😍 Loved it!",liked:"❤️ Liked!",watched:"✅ Watched!",watchlist:"🔖 Added to Watchlist",rewatch:"🔁 Want to rewatch",recommend:"📣 Shared with friends",disliked:"👎 Noted",skipped:"⏭ Skipped"}
  toast(msgs[action]||"Saved!")
  if(btnEl){
    const KEYS=ACTIONS.map(a=>a.key)
    const parent=btnEl.closest(".action-grid")||btnEl.closest(".modal-actions")
    parent?.querySelectorAll(".abtn,.mabtn").forEach((b,i)=>{
      const cls=b.classList.contains("mabtn")?"mabtn":"abtn"
      b.className=`${cls} ${KEYS[i]===action?action:""}`
    })
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
async function loadHome() {
  const el=document.getElementById("home-grid")
  el.innerHTML=`<div class="spinner">LOADING</div>`
  try {
    const data=await fetch(`${API}/discover`).then(r=>r.json())
    const movies=dedup(data.movies||[])
    if(!movies.length){el.innerHTML=`<div class="empty"><div class="empty-icon">🎬</div><div class="empty-text">Nothing to show right now</div></div>`;return}
    el.innerHTML=movies.map(m=>movieCard(m,null)).join("")
  } catch {
    el.innerHTML=`<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">Could not load movies</div></div>`
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
async function doSearch(inputId) {
  const q=document.getElementById(inputId).value.trim(); if(!q) return
  showView("search")
  document.getElementById("search-label").textContent=`Results for "${q}"`
  const el=document.getElementById("search-grid")
  el.innerHTML=`<div class="spinner">SEARCHING</div>`
  const data=await fetch(`${API}/search?q=${encodeURIComponent(q)}`).then(r=>r.json())
  if(!data.Search){el.innerHTML=`<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">No results for "${q}"</div></div>`;return}
  el.innerHTML=dedup(data.Search).map(m=>movieCard(m,null)).join("")
}

// ─── FOR YOU ──────────────────────────────────────────────────────────────────
async function loadForYou() {
  const el=document.getElementById("rec-grid"), chip=document.getElementById("rec-chip")
  el.innerHTML=`<div class="spinner">BUILDING YOUR PICKS</div>`; chip.innerHTML=""
  const data=await apiFetch("/recommend")
  if(data.newUser||data.message){
    el.innerHTML=`<div class="empty"><div class="empty-icon">🎬</div><div class="empty-text">${data.message||"Rate some movies on Home to get personalised picks!"}</div></div>`;return
  }
  if(data.basedOn) chip.innerHTML=`<div class="rec-chip">✦ ${data.basedOn}</div>`
  el.innerHTML=dedup(data.recommendations||[]).map(m=>movieCard(m,m.matchPercent)).join("")
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
async function openModal(id,title,year,genre,lang,rating,poster,plot,director,actors) {
  const heroEl=document.getElementById("mhero")
  if(goodPoster(poster)){heroEl.src=poster;heroEl.style.display="block"}
  else{heroEl.src="";heroEl.style.display="none"}

  const pwrap=document.getElementById("mposter-wrap")
  pwrap.innerHTML=goodPoster(poster)
    ? `<img class="modal-poster-img" src="${poster}" alt="${title}" onerror="this.outerHTML='<div class=\\'modal-poster-blank\\'>🎬</div>'"/>`
    : `<div class="modal-poster-blank">🎬</div>`

  document.getElementById("mtitle").textContent=title
  document.getElementById("mtagline").textContent=""

  const chips=[]
  if(year) chips.push(`<span class="mchip">${year}</span>`)
  if(rating) chips.push(`<span class="mchip amber">⭐ ${rating}/10</span>`)
  if(genre) genre.split(",").slice(0,3).forEach(g=>chips.push(`<span class="mchip">${g.trim()}</span>`))
  if(lang) chips.push(`<span class="mchip">🌐 ${lang.split(",")[0].trim()}</span>`)
  document.getElementById("mchips").innerHTML=chips.join("")

  document.getElementById("mplot").textContent=plot&&plot!=="N/A"?plot:"Loading description..."

  const details=[]
  if(director&&director!=="N/A") details.push({l:"Director",v:director.split(",").slice(0,2).join(", ")})
  if(actors&&actors!=="N/A")     details.push({l:"Cast",v:actors.split(",").slice(0,3).join(", ")})
  if(genre) details.push({l:"Genre",v:genre.split(",").slice(0,3).join(", ")})
  if(lang)  details.push({l:"Language",v:lang.split(",").slice(0,2).join(", ")})
  document.getElementById("mdetails").innerHTML=details.map(d=>`
    <div class="detail-item"><div class="detail-label">${d.l.toUpperCase()}</div><div class="detail-value">${d.v}</div></div>`).join("")

  const streams=indiaStreaming({Language:lang,Genre:genre,Title:title,Year:year})
  document.getElementById("mwatch").innerHTML=streams.map(s=>`
    <div class="watch-pill"><span>${s.icon}</span><span>${s.name}</span></div>`).join("")

  const action=getAction(id)
  document.getElementById("mactions").innerHTML=ACTIONS.map(a=>`
    <button class="mabtn ${action===a.key?a.key:""}"
      onclick="doAction('${id}','${ss(title)}','${year}','${ss(genre)}','${ss(lang)}','movie','${ss(poster)}','${a.key}',this)">
      ${a.label}
    </button>`).join("")

  document.getElementById("msimilar").innerHTML=`<div style="color:var(--muted);font-size:12px;padding:10px;font-family:'Lora',serif;font-style:italic">Loading similar films...</div>`
  document.getElementById("modal-overlay").classList.add("open")

  // Enrich with full details
  enrichModal(id,lang,genre,title,year)
}

async function enrichModal(id,lang,genre,title,year) {
  try {
    const full=await fetch(`${API}/movie/${id}`).then(r=>r.json())
    if(!full||full.Response==="False") return

    if(full.Plot&&full.Plot!=="N/A") document.getElementById("mplot").textContent=full.Plot
    if(full.Awards&&full.Awards!=="N/A") document.getElementById("mtagline").textContent="🏆 "+full.Awards

    const chips=[]
    if(full.Year) chips.push(`<span class="mchip">${full.Year}</span>`)
    if(full.imdbRating&&full.imdbRating!=="N/A") chips.push(`<span class="mchip amber">⭐ ${full.imdbRating}/10</span>`)
    if(full.imdbVotes&&full.imdbVotes!=="N/A") chips.push(`<span class="mchip">${full.imdbVotes} votes</span>`)
    if(full.Runtime&&full.Runtime!=="N/A") chips.push(`<span class="mchip">⏱ ${full.Runtime}</span>`)
    if(full.Rated&&full.Rated!=="N/A") chips.push(`<span class="mchip rust">${full.Rated}</span>`)
    if(full.Genre) full.Genre.split(",").slice(0,3).forEach(g=>chips.push(`<span class="mchip">${g.trim()}</span>`))
    if(full.Language) chips.push(`<span class="mchip">🌐 ${full.Language.split(",")[0].trim()}</span>`)
    document.getElementById("mchips").innerHTML=chips.join("")

    const details=[]
    if(full.Director&&full.Director!=="N/A") details.push({l:"Director",v:full.Director.split(",").slice(0,2).join(", ")})
    if(full.Actors&&full.Actors!=="N/A")     details.push({l:"Cast",v:full.Actors.split(",").slice(0,4).join(", ")})
    if(full.Writer&&full.Writer!=="N/A")     details.push({l:"Writer",v:full.Writer.split(",").slice(0,2).join(", ")})
    if(full.Genre)    details.push({l:"Genre",v:full.Genre.split(",").slice(0,4).join(", ")})
    if(full.Language) details.push({l:"Language",v:full.Language.split(",").slice(0,3).join(", ")})
    if(full.Country&&full.Country!=="N/A") details.push({l:"Country",v:full.Country.split(",").slice(0,2).join(", ")})
    if(full.BoxOffice&&full.BoxOffice!=="N/A") details.push({l:"Box Office",v:full.BoxOffice})
    document.getElementById("mdetails").innerHTML=details.map(d=>`
      <div class="detail-item"><div class="detail-label">${d.l.toUpperCase()}</div><div class="detail-value">${d.v}</div></div>`).join("")

    const streams=indiaStreaming(full)
    document.getElementById("mwatch").innerHTML=streams.map(s=>`
      <div class="watch-pill"><span>${s.icon}</span><span>${s.name}</span></div>`).join("")

    const keyword=full.Genre?full.Genre.split(",")[0].trim():title.split(" ")[0]
    const sim=await fetch(`${API}/search?q=${encodeURIComponent(keyword)}`).then(r=>r.json())
    const similar=dedup((sim.Search||[])).filter(m=>m.imdbID!==id).slice(0,10)
    if(similar.length) {
      document.getElementById("msimilar").innerHTML=similar.map(m=>`
        <div class="sim-card" onclick="closeModal();setTimeout(()=>openModal('${m.imdbID}','${ss(m.Title)}','${m.Year}','','','','${ss(m.Poster)}','','',''),250)">
          ${goodPoster(m.Poster)
            ? `<img src="${m.Poster}" loading="lazy" onerror="this.style.display='none'"/>`
            : `<div style="width:100%;aspect-ratio:2/3;border-radius:8px;background:var(--paper2);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:5px;border:1px solid var(--border)">🎬</div>`}
          <div class="sim-card-title">${m.Title}</div>
          <div class="sim-card-year">${m.Year}</div>
        </div>`).join("")
    } else {
      document.getElementById("msimilar").innerHTML=`<div style="color:var(--muted);font-size:12px;font-family:'Lora',serif;font-style:italic">No similar films found</div>`
    }
  } catch(e){ console.error(e) }
}

function closeModal(){ document.getElementById("modal-overlay").classList.remove("open") }
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeModal() })

// ─── MY LIST ──────────────────────────────────────────────────────────────────
function renderMyList() {
  const el=document.getElementById("mylist-content")
  if(!myBehavior.length){
    el.innerHTML=`<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Your film journal is empty. Start rating movies!</div></div>`;return
  }
  const groups={loved:[],liked:[],watched:[],watchlist:[],rewatch:[],recommend:[],disliked:[],skipped:[]}
  const labels={loved:"😍 Loved",liked:"❤️ Liked",watched:"✅ Watched",watchlist:"🔖 Watchlist",rewatch:"🔁 Rewatch",recommend:"📣 Recommended",disliked:"👎 Disliked",skipped:"⏭ Skipped"}
  const colors={loved:"#e11d48",liked:"var(--rust)",watched:"var(--sage)",watchlist:"var(--slate)",rewatch:"var(--amber)",recommend:"#7c3aed",disliked:"var(--muted)",skipped:"var(--muted)"}
  myBehavior.forEach(b=>{ if(groups[b.action]) groups[b.action].push(b) })
  el.innerHTML=Object.entries(groups).filter(([,items])=>items.length>0).map(([action,items])=>`
    <div class="list-group">
      <div class="list-group-head">
        <div class="list-group-title" style="color:${colors[action]}">${labels[action]}</div>
        <div class="list-count">${items.length}</div>
      </div>
      <div class="movie-grid">
        ${items.map(b=>`
          <div class="movie-card" onclick="openModal('${b.movieId}','${ss(b.movieTitle)}','${b.movieYear||""}','${ss(b.movieGenre||"")}','${ss(b.movieLang||"")}','','${ss(b.posterUrl||"")}','','','')">
            <div class="card-poster-wrap">
              ${goodPoster(b.posterUrl)
                ? `<img class="card-poster" src="${b.posterUrl}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-no-poster\\'><div class=\\'card-no-poster-icon\\'>🎬</div><div class=\\'card-no-poster-text\\'>${ss(b.movieTitle)}</div></div>'"/>`
                : noPoster(b.movieTitle)}
            </div>
            <div class="card-body">
              <div class="card-title">${b.movieTitle}</div>
              <div class="card-meta">${b.movieYear||""}</div>
              <button class="abtn" style="width:100%;margin-top:6px" onclick="event.stopPropagation();removeItem('${b.movieId}')">✕ Remove</button>
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("")
}
function removeItem(id){ myBehavior=myBehavior.filter(b=>b.movieId!==id); renderMyList(); toast("Removed from list") }

// ─── PROFILE ──────────────────────────────────────────────────────────────────
async function loadProfile() {
  const profile=await apiFetch("/profile")
  const counts={loved:0,liked:0,watched:0,watchlist:0,rewatch:0,recommend:0,disliked:0,skipped:0}
  myBehavior.forEach(b=>{ if(counts[b.action]!==undefined) counts[b.action]++ })
  const genres=profile.tasteProfile?.genres?Object.fromEntries(profile.tasteProfile.genres):{}
  const langs=profile.tasteProfile?.languages?Object.fromEntries(profile.tasteProfile.languages):{}
  const topG=Object.entries(genres).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const topL=Object.entries(langs).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const mG=topG[0]?.[1]||1, mL=topL[0]?.[1]||1

  document.getElementById("profile-content").innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;background:white;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:18px;box-shadow:0 2px 8px var(--shadow)">
      <div style="width:52px;height:52px;border-radius:50%;background:var(--ink);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:var(--amber);flex-shrink:0">${(profile.username||"?")[0].toUpperCase()}</div>
      <div><div style="font-size:17px;font-weight:800">@${profile.username}</div><div style="font-size:11px;color:var(--muted);font-family:'Lora',serif;font-style:italic">${profile.email}</div></div>
    </div>
    <div class="stats-grid">
      ${[["😍",counts.loved,"LOVED","#e11d48"],["❤️",counts.liked,"LIKED","var(--rust)"],["✅",counts.watched,"WATCHED","var(--sage)"],["🔖",counts.watchlist,"WATCHLIST","var(--slate)"],["🔁",counts.rewatch,"REWATCH","var(--amber)"],["📣",counts.recommend,"SHARED","#7c3aed"],["👎",counts.disliked,"DISLIKED","var(--muted)"],["👥",profile.friends?.length||0,"FRIENDS","var(--ink)"]]
        .map(([icon,n,label,color])=>`<div class="stat-card"><div style="font-size:20px;margin-bottom:5px">${icon}</div><div class="stat-num" style="color:${color}">${n}</div><div class="stat-label">${label}</div></div>`).join("")}
    </div>
    ${topG.length?`
      <div style="font-size:9px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:10px">GENRE TASTE</div>
      <div class="taste-grid">${topG.map(([g,s])=>`
        <div class="taste-item"><div class="taste-label">${g}</div>
        <div class="taste-bg"><div class="taste-fill" style="width:${(s/mG)*100}%;background:var(--amber)"></div></div>
        <div class="taste-pts">${s} pts</div></div>`).join("")}</div>`:""}
    ${topL.length?`
      <div style="font-size:9px;letter-spacing:2px;color:var(--muted);font-weight:700;margin:14px 0 10px">LANGUAGE TASTE</div>
      <div class="taste-grid">${topL.map(([l,s])=>`
        <div class="taste-item"><div class="taste-label">${l}</div>
        <div class="taste-bg"><div class="taste-fill" style="width:${(s/mL)*100}%;background:var(--sage)"></div></div>
        <div class="taste-pts" style="color:var(--sage)">${s} pts</div></div>`).join("")}</div>`:""}
  `
}

// ─── FRIENDS ──────────────────────────────────────────────────────────────────
async function loadFriends() {
  const data=await apiFetch("/friends")
  const reqEl=document.getElementById("friend-reqs")
  if(data.friendRequests?.length>0) {
    reqEl.innerHTML=`
      <div style="font-size:9px;letter-spacing:2px;color:var(--amber);font-weight:700;margin-bottom:8px">PENDING REQUESTS (${data.friendRequests.length})</div>
      <div class="user-list" style="margin-bottom:14px">
        ${data.friendRequests.map(r=>`
          <div class="user-row">
            <div class="u-av">${r.fromUsername[0].toUpperCase()}</div>
            <div class="u-name">${r.fromUsername}</div>
            <button class="btn-sm g" onclick="acceptFriend('${r.fromUserId}','${r.fromUsername}')">Accept</button>
            <button class="btn-sm" onclick="declineFriend('${r.fromUserId}')">Decline</button>
          </div>`).join("")}
      </div>`
    setBadge(data.friendRequests.length)
  } else { reqEl.innerHTML=""; setBadge(0) }

  const listEl=document.getElementById("friends-list")
  if(!data.friends?.length){
    listEl.innerHTML=`<div class="empty" style="padding:40px 20px"><div class="empty-icon">👥</div><div class="empty-text">No friends yet — search above to connect</div></div>`;return
  }
  listEl.innerHTML=data.friends.map(f=>`
    <div class="user-row">
      <div class="u-av">${f.username[0].toUpperCase()}</div>
      <div class="u-name">${f.username}</div>
      <button class="btn-sm b" onclick="viewFriendLikes('${f.userId}','${f.username}')">Likes</button>
      <button class="btn-sm p" onclick="viewFriendRecs('${f.userId}','${f.username}')">Picks</button>
      <button class="btn-sm r" onclick="removeFriend('${f.userId}')">✕</button>
    </div>`).join("")
}

function setBadge(n) {
  ["desk-friend-badge","mob-friend-badge"].forEach(id=>{
    const b=document.getElementById(id)
    if(!b) return
    if(n>0){b.textContent=n;b.style.display="block"}else b.style.display="none"
  })
}

async function pollRequests() {
  try{ const d=await apiFetch("/friends"); setBadge(d.friendRequests?.length||0) }catch{}
  setTimeout(pollRequests,30000)
}

async function searchUsers() {
  const q=document.getElementById("user-search-input").value.trim(); if(!q) return
  const users=await apiFetch(`/users/search?q=${encodeURIComponent(q)}`)
  const el=document.getElementById("user-search-results")
  if(!users.length){el.innerHTML=`<div style="color:var(--muted);font-size:13px;padding:8px;font-family:'Lora',serif;font-style:italic">No users found</div>`;return}
  el.innerHTML=users.map(u=>`
    <div class="user-row">
      <div class="u-av">${u.username[0].toUpperCase()}</div>
      <div class="u-name">${u.username}</div>
      <button class="btn-sm r" onclick="sendRequest('${u._id}')">+ Add</button>
    </div>`).join("")
}

async function sendRequest(id){ const d=await apiFetch("/friends/request",{method:"POST",body:JSON.stringify({toUserId:id})}); toast(d.error||d.message) }
async function acceptFriend(fid,fn){ const d=await apiFetch("/friends/accept",{method:"POST",body:JSON.stringify({fromUserId:fid,fromUsername:fn})}); toast(d.message); loadFriends() }
async function declineFriend(fid){ await apiFetch("/friends/decline",{method:"POST",body:JSON.stringify({fromUserId:fid})}); loadFriends() }
async function removeFriend(fid){ await apiFetch(`/friends/${fid}`,{method:"DELETE"}); toast("Friend removed"); loadFriends() }

async function viewFriendLikes(friendId,friendName) {
  const activity=await apiFetch(`/friends/${friendId}/activity`)
  const el=document.getElementById("friends-list")
  if(!activity.length){toast(`${friendName} hasn't liked anything yet`);return}
  el.innerHTML=`
    <div style="font-size:9px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:12px">${friendName.toUpperCase()}'S LIKES</div>
    <div class="movie-grid">
      ${activity.map(b=>`
        <div class="movie-card" onclick="openModal('${b.movieId}','${ss(b.movieTitle)}','${b.movieYear||""}','${ss(b.movieGenre||"")}','${ss(b.movieLang||"")}','','${ss(b.posterUrl||"")}','','','')">
          <div class="card-poster-wrap">
            ${goodPoster(b.posterUrl)
              ? `<img class="card-poster" src="${b.posterUrl}" loading="lazy"/>`
              : noPoster(b.movieTitle)}
          </div>
          <div class="card-body"><div class="card-title">${b.movieTitle}</div><div class="card-meta">${b.movieYear||""}</div></div>
        </div>`).join("")}
    </div>
    <button class="btn-sm" style="margin-top:14px;width:100%" onclick="loadFriends()">← Back to friends</button>`
}

async function viewFriendRecs(friendId,friendName) {
  const el=document.getElementById("friends-list")
  el.innerHTML=`<div class="spinner">LOADING ${friendName.toUpperCase()}'S PICKS</div>`
  const data=await apiFetch(`/friends/${friendId}/recommend`)
  const recs=data.recommendations||[]
  if(!recs.length){toast(`No picks for ${friendName} yet`);loadFriends();return}
  el.innerHTML=`
    <div style="font-size:9px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:12px">${friendName.toUpperCase()}'S PICKS</div>
    <div class="movie-grid">${dedup(recs).map(m=>movieCard(m,m.matchPercent)).join("")}</div>
    <button class="btn-sm" style="margin-top:14px;width:100%" onclick="loadFriends()">← Back to friends</button>`
}