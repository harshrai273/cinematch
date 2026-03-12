const express  = require("express")
require("dotenv").config()
const axios    = require("axios")
const cors     = require("cors")
const mongoose = require("mongoose")
const bcrypt   = require("bcryptjs")
const jwt      = require("jsonwebtoken")

const User     = require("./models/User")
const Behavior = require("./models/Behavior")

const app = express()
const OMDB_KEY   = process.env.OMDB_API_KEY || "dc80b109"
const JWT_SECRET = process.env.JWT_SECRET || "change_me_in_production"

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/movieApp")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ MongoDB error:", err))

function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1]
  if (!token) return res.status(401).json({ error: "Login required" })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

async function updateTaste(userId, genre, lang, action) {
  const weight = { liked: 3, watched: 2, saved: 1, skipped: -1, disliked: -2 }[action] || 0
  const inc = {}
  if (genre) {
    genre.split(",").forEach(g => {
      const key = g.trim()
      if (key && key !== "N/A") inc[`tasteProfile.genres.${key}`] = weight
    })
  }
  if (lang && lang !== "N/A") {
    lang.split(",").forEach(l => {
      const key = l.trim()
      if (key && key !== "N/A") inc[`tasteProfile.languages.${key}`] = weight
    })
  }
  if (Object.keys(inc).length) await User.updateOne({ _id: userId }, { $inc: inc })
}

// ── Streaming platform map (based on genre/type keywords) ────────────────────
function getStreamingPlatforms(movie) {
  const title  = (movie.Title  || "").toLowerCase()
  const genre  = (movie.Genre  || "").toLowerCase()
  const lang   = (movie.Language || "").toLowerCase()
  const year   = parseInt(movie.Year) || 0
  const rated  = (movie.Rated || "").toLowerCase()

  const platforms = []

  // Hindi / Indian content → JioCinema, Hotstar, Netflix, Prime
  if (lang.includes("hindi") || lang.includes("telugu") || lang.includes("tamil") || lang.includes("kannada") || lang.includes("malayalam")) {
    platforms.push("JioCinema", "Disney+ Hotstar", "Netflix", "Amazon Prime Video", "ZEE5", "SonyLIV")
    return platforms.slice(0, 3)
  }

  // Anime → Crunchyroll, Netflix
  if (lang.includes("japanese") || genre.includes("anime")) {
    platforms.push("Crunchyroll", "Netflix", "Amazon Prime Video")
    return platforms
  }

  // Korean content
  if (lang.includes("korean")) {
    platforms.push("Netflix", "Viki", "Amazon Prime Video")
    return platforms
  }

  // English content — distribute based on year + genre
  const pool = []

  if (year >= 2019) pool.push("Netflix", "Amazon Prime Video", "Disney+", "Apple TV+", "HBO Max")
  else if (year >= 2010) pool.push("Netflix", "Amazon Prime Video", "HBO Max", "Hulu", "Disney+")
  else pool.push("Amazon Prime Video", "Tubi", "Pluto TV", "Netflix", "HBO Max")

  if (genre.includes("animation") || genre.includes("family") || genre.includes("adventure")) {
    pool.unshift("Disney+")
  }
  if (genre.includes("documentary")) {
    pool.unshift("Netflix", "HBO Max")
  }
  if (genre.includes("superhero") || title.includes("marvel") || title.includes("avenger")) {
    pool.unshift("Disney+")
  }

  // pick 2-3 unique
  const unique = [...new Set(pool)].slice(0, 3)
  return unique
}

// ── Fetch full OMDB details for a movie ID ───────────────────────────────────
async function fetchFullDetails(imdbID) {
  try {
    const r = await axios.get("http://www.omdbapi.com/", {
      params: { apikey: OMDB_KEY, i: imdbID, plot: "short" },
      timeout: 4000
    })
    return r.data?.Response === "True" ? r.data : null
  } catch { return null }
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════════
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields required" })
    const exists = await User.findOne({ $or: [{ email }, { username: username.toLowerCase() }] })
    if (exists) return res.status(400).json({ error: "Username or email already taken" })
    const hashed = await bcrypt.hash(password, 10)
    const user = new User({ username: username.toLowerCase(), email, password: hashed })
    await user.save()
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "30d" })
    res.json({ token, userId: user._id, username: user.username, email: user.email })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(400).json({ error: "User not found" })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: "Wrong password" })
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "30d" })
    res.json({ token, userId: user._id, username: user.username, email: user.email })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password")
    res.json(user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// MOVIE SEARCH
// ═════════════════════════════════════════════════════════════════════════════
app.get("/search", async (req, res) => {
  try {
    const response = await axios.get("http://www.omdbapi.com/", {
      params: { apikey: OMDB_KEY, s: req.query.q }
    })
    res.json(response.data)
  } catch { res.status(500).json({ error: "Error fetching movies" }) }
})

app.get("/movie/:id", async (req, res) => {
  try {
    const response = await axios.get("http://www.omdbapi.com/", {
      params: { apikey: OMDB_KEY, i: req.params.id, plot: "full" }
    })
    res.json(response.data)
  } catch { res.status(500).json({ error: "Error fetching movie" }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// BEHAVIOR
// ═════════════════════════════════════════════════════════════════════════════
app.post("/behavior", auth, async (req, res) => {
  try {
    const { movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, rating, note } = req.body
    if (!movieId || !movieTitle || !action)
      return res.status(400).json({ error: "movieId, movieTitle, action required" })
    await Behavior.findOneAndUpdate(
      { userId: req.user.userId, movieId },
      { userId: req.user.userId, movieId, movieTitle, movieYear, movieGenre, movieLang, movieType, posterUrl, action, rating, note, timestamp: new Date() },
      { upsert: true, new: true }
    )
    await updateTaste(req.user.userId, movieGenre, movieLang, action)
    res.json({ message: "Saved!" })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/behavior", auth, async (req, res) => {
  try {
    const history = await Behavior.find({ userId: req.user.userId }).sort({ timestamp: -1 })
    res.json(history)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═════════════════════════════════════════════════════════════════════════════
// DISCOVER — trending/popular movies WITHOUT needing any user history
// Called when user has no behavior yet (new users)
// ═════════════════════════════════════════════════════════════════════════════
app.get("/discover", async (req, res) => {
  try {
    const queries = [
      // Hollywood
      "action 2023", "thriller 2023", "drama 2023", "comedy 2023",
      // Bollywood / Indian
      "Bollywood 2023", "Hindi film 2023", "Tamil movie 2023", "Telugu movie 2023",
      // Korean / Asian
      "Korean movie 2023", "Korean thriller 2022", "Japanese anime film",
      // Other popular
      "crime thriller 2023", "adventure 2023", "mystery thriller 2022", "sci-fi 2023"
    ]

    const results = await Promise.allSettled(
      queries.map(q => axios.get("http://www.omdbapi.com/", {
        params: { apikey: OMDB_KEY, s: q, type: "movie" }, timeout: 4000
      }))
    )

    const seen = new Set()
    const movies = []
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value.data.Search) {
        r.value.data.Search.forEach(m => {
          if (!seen.has(m.imdbID)) { seen.add(m.imdbID); movies.push(m) }
        })
      }
    })

    // Enrich top 16 with full details (plot, rating, genre)
    const top = movies.slice(0, 16)
    const enriched = await Promise.allSettled(top.map(m => fetchFullDetails(m.imdbID)))

    const final = enriched.map((r, i) => {
      const full = r.status === "fulfilled" && r.value ? r.value : top[i]
      return { ...full, streamingOn: getStreamingPlatforms(full) }
    })

    res.json({ movies: final })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// RECOMMEND — language-aware, auto, no search needed
// ═════════════════════════════════════════════════════════════════════════════

// Language → OMDB search terms that actually return results in that language
const LANG_QUERIES = {
  Hindi:    ["Bollywood 2023","Hindi film 2023","Bollywood 2022","Hindi movie 2022","Bollywood action","Bollywood drama","Bollywood comedy","Hindi thriller"],
  Tamil:    ["Tamil movie 2023","Tamil film 2022","Kollywood 2023","Tamil action","Tamil drama","Tamil thriller","Tamil comedy","Tamil 2021"],
  Telugu:   ["Telugu movie 2023","Telugu film 2022","Tollywood 2023","Telugu action","Telugu drama","Telugu thriller","Telugu 2022","Telugu 2021"],
  Malayalam:["Malayalam movie 2023","Malayalam film 2022","Malayalam thriller","Malayalam drama","Malayalam 2022","Kerala film","Malayalam action","Malayalam 2021"],
  Kannada:  ["Kannada movie 2023","Kannada film 2022","Sandalwood 2023","Kannada action","Kannada drama","Kannada 2022"],
  Korean:   ["Korean movie 2023","Korean film 2022","Korean thriller","Korean drama film","Korean action 2022","K-drama film","Korean horror","Korean romance"],
  Japanese: ["Japanese anime film","Japanese movie 2022","Japanese thriller","Japanese drama film","Studio Ghibli","anime movie 2023","Japanese horror","Japanese action"],
  Chinese:  ["Chinese movie 2023","Chinese film 2022","Chinese action","Chinese drama","Chinese thriller","Mandarin film","Hong Kong film","Chinese 2022"],
  Spanish:  ["Spanish film 2023","Spanish movie 2022","Spanish thriller","Spanish drama","Latin American film","Spanish comedy","Spanish horror","Spanish 2022"],
  French:   ["French film 2023","French movie 2022","French thriller","French drama","French comedy","French cinema","French romance","French 2022"],
  Turkish:  ["Turkish movie 2022","Turkish film 2021","Turkish drama","Turkish thriller","Turkish action","Turkish 2022"],
  Arabic:   ["Arabic movie 2022","Arabic film","Egyptian film","Arabic drama","Arab cinema","Middle East film"],
}

// Genre → OMDB keyword searches
const GENRE_QUERIES = {
  "Action":    ["action adventure 2023","action hero 2022","action thriller 2023","action film 2022"],
  "Drama":     ["drama film 2023","family drama 2022","emotional drama 2023","drama movie 2022"],
  "Comedy":    ["comedy film 2023","romantic comedy 2022","comedy movie 2023","funny film 2022"],
  "Thriller":  ["psychological thriller 2023","thriller film 2022","suspense thriller 2023","thriller movie 2022"],
  "Horror":    ["horror film 2023","horror movie 2022","scary film 2023","horror thriller 2022"],
  "Romance":   ["romance film 2023","love story 2022","romantic movie 2023","romantic drama 2022"],
  "Sci-Fi":    ["science fiction 2023","sci-fi film 2022","space adventure 2023","sci fi movie 2022"],
  "Animation": ["animated film 2023","animation movie 2022","animated adventure 2023","cartoon film 2022"],
  "Crime":     ["crime thriller 2023","heist film 2022","crime drama 2023","gangster film 2022"],
  "Adventure": ["adventure film 2023","adventure movie 2022","action adventure 2023","explorer film"],
  "Mystery":   ["mystery thriller 2023","detective film 2022","mystery movie 2023","whodunit film"],
  "Biography": ["biography film 2023","biopic 2022","true story film 2023","based true story 2022"],
  "Fantasy":   ["fantasy film 2023","fantasy adventure 2022","magic film 2023","fantasy movie 2022"],
  "History":   ["historical drama 2023","period drama 2022","history film 2023","war history 2022"],
  "Family":    ["family film 2023","family movie 2022","kids adventure 2023","family adventure 2022"],
  "War":       ["war film 2023","war drama 2022","military film 2023","war movie 2022"],
}

app.get("/recommend", auth, async (req, res) => {
  try {
    const userId  = req.user.userId
    const history = await Behavior.find({ userId })

    if (history.length === 0) {
      return res.json({ recommendations: [], basedOn: null, newUser: true })
    }

    const seenIds = new Set(history.map(h => h.movieId))
    const W = { liked: 3, watched: 2, saved: 1, skipped: -1, disliked: -2 }

    // ── Build genre map ───────────────────────────────────────────────────────
    const genreMap = {}
    history.forEach(h => {
      const w = W[h.action] || 0
      ;(h.movieGenre || "").split(",").forEach(g => {
        const k = g.trim()
        if (k && k !== "N/A") genreMap[k] = (genreMap[k] || 0) + w
      })
    })
    const topGenres = Object.entries(genreMap).filter(([,s])=>s>0).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([g])=>g)

    // ── Build LANGUAGE map from history ──────────────────────────────────────
    // Count how many liked/watched movies per language
    const langScore = {}
    history.forEach(h => {
      const w = W[h.action] || 0
      if (w <= 0) return  // only count positive interactions
      ;(h.movieLang || "").split(",").forEach(l => {
        const k = l.trim()
        if (k && k !== "N/A" && k !== "English") {  // English is the default fallback
          langScore[k] = (langScore[k] || 0) + w
        }
      })
    })

    // Top non-English languages the user actually watches
    const topLangs = Object.entries(langScore)
      .filter(([,s]) => s > 0)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 4)
      .map(([l]) => l)

    const hasNonEnglish = topLangs.length > 0
    console.log("🌍 User languages detected:", topLangs)
    console.log("🎬 User top genres:", topGenres)

    // ── Build final query set ─────────────────────────────────────────────────
    const queries = new Set()

    // 1. Language-specific queries (PRIORITY — fills ~60% of slots if non-English user)
    if (hasNonEnglish) {
      for (const lang of topLangs.slice(0, 3)) {
        const lqs = LANG_QUERIES[lang] || [`${lang} movie 2023`, `${lang} film 2022`, `${lang} movie 2022`]
        lqs.slice(0, 4).forEach(q => queries.add(q))  // 4 queries per top language
      }
    }

    // 2. Genre queries for remaining slots
    for (const genre of topGenres.slice(0, 4)) {
      const gqs = GENRE_QUERIES[genre] || [`${genre.toLowerCase()} film 2023`, `${genre.toLowerCase()} movie 2022`]
      gqs.slice(0, 2).forEach(q => queries.add(q))
    }

    // 3. Title keywords from liked movies (personalised)
    const likedHistory = history.filter(h => h.action === "liked" || h.action === "watched")
    likedHistory.slice(0, 6).forEach(h => {
      const words = h.movieTitle.split(/\s+/)
        .filter(w => w.length > 3 && !/^(the|and|of|in|a|an|is|to|was|for|are|pyaar|teri|mera|nahi)$/i.test(w))
      if (words[0]) queries.add(words[0])
    })

    const uniqueQ = [...queries].slice(0, 18)
    console.log("🔍 Final queries:", uniqueQ)

    // ── Fire all searches in parallel ─────────────────────────────────────────
    const searchResults = await Promise.allSettled(
      uniqueQ.map(q => axios.get("http://www.omdbapi.com/", {
        params: { apikey: OMDB_KEY, s: q, type: "movie" }, timeout: 5000
      }))
    )

    const candidateMap = new Map()
    searchResults.forEach(r => {
      if (r.status === "fulfilled" && r.value.data.Search) {
        r.value.data.Search.forEach(m => {
          if (!seenIds.has(m.imdbID)) candidateMap.set(m.imdbID, m)
        })
      }
    })

    // ── Collaborative filtering ───────────────────────────────────────────────
    const likedIds = history.filter(h => h.action === "liked").map(h => h.movieId)
    if (likedIds.length > 0) {
      const similarUsers = await Behavior.find({
        movieId: { $in: likedIds }, action: "liked", userId: { $ne: userId }
      }).distinct("userId")

      if (similarUsers.length > 0) {
        const collabMovies = await Behavior.find({
          userId: { $in: similarUsers }, action: "liked",
          movieId: { $nin: [...seenIds] }
        }).limit(30)

        collabMovies.forEach(m => {
          if (!candidateMap.has(m.movieId)) {
            candidateMap.set(m.movieId, {
              imdbID: m.movieId, Title: m.movieTitle, Year: m.movieYear,
              Poster: m.posterUrl, Genre: m.movieGenre, Language: m.movieLang, _collab: true
            })
          }
        })
      }
    }

    // ── Score candidates (genre + language match + quality) ───────────────────
    const maxPossible = Math.max(...Object.values(genreMap).filter(v=>v>0), 1) * topGenres.length + 15

    const scored = [...candidateMap.values()].map(movie => {
      let score = 0

      // Genre match score
      ;(movie.Genre || "").split(",").forEach(g => {
        const k = g.trim()
        if (genreMap[k] > 0) score += genreMap[k]
      })

      // ✅ Language match bonus — big boost for movies in languages user likes
      const movieLang = (movie.Language || "").toLowerCase()
      for (const lang of topLangs) {
        if (movieLang.includes(lang.toLowerCase())) {
          score += langScore[lang] * 2  // double weight for language match
          break
        }
      }

      if (movie._collab) score += 10
      if (movie.imdbRating && movie.imdbRating !== "N/A") score += parseFloat(movie.imdbRating) * 0.3
      const raw = Math.round((score / maxPossible) * 100)
      const matchPercent = raw > 0 ? Math.min(raw, 99) : (40 + Math.floor(Math.random() * 30))
      return { ...movie, score, matchPercent }
    })

    // Top 20 sorted by score
    const top20 = scored.sort((a, b) => b.score - a.score).slice(0, 20)

    // ── Enrich with FULL details ──────────────────────────────────────────────
    console.log(`📦 Enriching top ${top20.length} recommendations...`)
    const enriched = await Promise.allSettled(
      top20.map(async movie => {
        if (movie.Plot && movie.Plot !== "N/A") {
          return { ...movie, streamingOn: getStreamingPlatforms(movie) }
        }
        const full = await fetchFullDetails(movie.imdbID)
        if (full) {
          return { ...full, score: movie.score, matchPercent: movie.matchPercent, _collab: movie._collab, streamingOn: getStreamingPlatforms(full) }
        }
        return { ...movie, streamingOn: getStreamingPlatforms(movie) }
      })
    )

    const recommendations = enriched.filter(r => r.status === "fulfilled").map(r => r.value)
    console.log(`✅ Returning ${recommendations.length} recommendations`)

    const langLabel = topLangs.length > 0 ? ` · ${topLangs.slice(0,2).join(", ")}` : ""
    res.json({
      recommendations,
      basedOn: topGenres.length > 0
        ? `Based on your taste: ${topGenres.slice(0,3).join(", ")}${langLabel}`
        : "Based on your history"
    })

  } catch (err) {
    console.error("❌ Recommend error:", err.message)
    res.status(500).json({ error: "Recommendation error: " + err.message })
  }
})

// ═════════════════════════════════════════════════════════════════════════════
// FRIENDS
// ═════════════════════════════════════════════════════════════════════════════
app.get("/users/search", auth, async (req, res) => {
  try {
    const users = await User.find({
      username: { $regex: req.query.q, $options: "i" },
      _id: { $ne: req.user.userId }
    }).select("username _id").limit(10)
    res.json(users)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post("/friends/request", auth, async (req, res) => {
  try {
    const target = await User.findById(req.body.toUserId)
    if (!target) return res.status(404).json({ error: "User not found" })
    const alreadySent = target.friendRequests.some(r => r.fromUserId.toString() === req.user.userId)
    if (alreadySent) return res.status(400).json({ error: "Request already sent" })
    await User.findByIdAndUpdate(req.body.toUserId, {
      $push: { friendRequests: { fromUserId: req.user.userId, fromUsername: req.user.username } }
    })
    res.json({ message: `Friend request sent to ${target.username}` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post("/friends/accept", auth, async (req, res) => {
  try {
    const { fromUserId, fromUsername } = req.body
    await User.findByIdAndUpdate(req.user.userId, {
      $pull: { friendRequests: { fromUserId } },
      $push: { friends: { userId: fromUserId, username: fromUsername } }
    })
    await User.findByIdAndUpdate(fromUserId, {
      $push: { friends: { userId: req.user.userId, username: req.user.username } }
    })
    res.json({ message: `You are now friends with ${fromUsername}!` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post("/friends/decline", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      $pull: { friendRequests: { fromUserId: req.body.fromUserId } }
    })
    res.json({ message: "Request declined" })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/friends", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("friends friendRequests")
    res.json(user)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get("/friends/:friendId/activity", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId).select("friends")
    const isFriend = me.friends.some(f => f.userId.toString() === req.params.friendId)
    if (!isFriend) return res.status(403).json({ error: "Not your friend" })
    const activity = await Behavior.find({
      userId: req.params.friendId,
      action: { $in: ["liked", "watched"] }
    }).sort({ timestamp: -1 }).limit(20)
    res.json(activity)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete("/friends/:friendId", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { $pull: { friends: { userId: req.params.friendId } } })
    await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: { userId: req.user.userId } } })
    res.json({ message: "Friend removed" })
  } catch (err) { res.status(500).json({ error: err.message }) }
})


// ── Friend public profile (taste + liked movies) ─────────────────────────────
app.get("/friends/:friendId/profile", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId).select("friends")
    const isFriend = me.friends.some(f => f.userId.toString() === req.params.friendId)
    if (!isFriend) return res.status(403).json({ error: "Not your friend" })

    const [friendUser, activity] = await Promise.all([
      User.findById(req.params.friendId).select("username tasteProfile friends createdAt"),
      Behavior.find({ userId: req.params.friendId }).sort({ timestamp: -1 })
    ])

    if (!friendUser) return res.status(404).json({ error: "User not found" })
    res.json({ user: friendUser, activity })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Friend recommendations (based on THEIR taste profile) ────────────────────
app.get("/friends/:friendId/recommend", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId).select("friends")
    const isFriend = me.friends.some(f => f.userId.toString() === req.params.friendId)
    if (!isFriend) return res.status(403).json({ error: "Not your friend" })

    const friendHistory = await Behavior.find({ userId: req.params.friendId })
    if (!friendHistory.length) return res.json({ recommendations: [], empty: true })

    const seenIds = new Set(friendHistory.map(h => h.movieId))
    const genreMap = {}
    const W = { liked: 3, watched: 2, saved: 1, skipped: -1, disliked: -2 }
    friendHistory.forEach(h => {
      const w = W[h.action] || 0
      ;(h.movieGenre || "").split(",").forEach(g => {
        const k = g.trim()
        if (k && k !== "N/A") genreMap[k] = (genreMap[k] || 0) + w
      })
    })

    const topGenres = Object.entries(genreMap).filter(([,s])=>s>0).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([g])=>g)
    const genreKeywords = {
      "Action":["action 2023","action adventure"],"Drama":["drama 2023","emotional drama"],
      "Comedy":["comedy 2023","romantic comedy"],"Thriller":["thriller 2023","suspense thriller"],
      "Horror":["horror 2023","horror movie"],"Romance":["romance 2023","love story"],
      "Sci-Fi":["science fiction","sci-fi 2022"],"Animation":["animated film","animation 2023"],
      "Crime":["crime thriller","heist movie"],"Adventure":["adventure 2023","adventure film"],
      "Mystery":["mystery thriller","detective movie"],"Fantasy":["fantasy film","fantasy adventure"],
    }

    const queries = new Set()
    topGenres.slice(0,4).forEach(genre => {
      const kws = genreKeywords[genre] || [`${genre.toLowerCase()} movie`]
      kws.slice(0,2).forEach(k => queries.add(k))
    })

    const results = await Promise.allSettled(
      [...queries].slice(0,10).map(q => axios.get("http://www.omdbapi.com/", {
        params: { apikey: OMDB_KEY, s: q, type: "movie" }, timeout: 5000
      }))
    )

    const candidateMap = new Map()
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value.data.Search) {
        r.value.data.Search.forEach(m => {
          if (!seenIds.has(m.imdbID)) candidateMap.set(m.imdbID, m)
        })
      }
    })

    const maxPossible = Math.max(...Object.values(genreMap).filter(v=>v>0), 1) * topGenres.length + 5
    const top12 = [...candidateMap.values()].map(movie => {
      let score = 0
      ;(movie.Genre||"").split(",").forEach(g=>{const k=g.trim();if(genreMap[k]>0)score+=genreMap[k]})
      const raw = Math.round((score/maxPossible)*100)
      return { ...movie, score, matchPercent: raw>0?Math.min(raw,99):(40+Math.floor(Math.random()*30)) }
    }).sort((a,b)=>b.score-a.score).slice(0,12)

    const enriched = await Promise.allSettled(top12.map(async m => {
      const full = await fetchFullDetails(m.imdbID)
      return full ? { ...full, score: m.score, matchPercent: m.matchPercent, streamingOn: getStreamingPlatforms(full) } : { ...m, streamingOn: getStreamingPlatforms(m) }
    }))

    res.json({
      recommendations: enriched.filter(r=>r.status==="fulfilled").map(r=>r.value),
      basedOn: topGenres.slice(0,3).join(", ")
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.listen(process.env.PORT || 3000, () => console.log('🚀 Server running on http://localhost:3000'))