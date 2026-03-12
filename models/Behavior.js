const mongoose = require("mongoose")

const BehaviorSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  movieId:    { type: String, required: true },   // imdbID e.g. "tt1234567"
  movieTitle: { type: String, required: true },
  movieYear:  { type: String, default: "" },
  movieGenre: { type: String, default: "" },      // "Action, Drama"
  movieLang:  { type: String, default: "" },      // "Hindi"
  movieType:  { type: String, default: "movie" }, // "movie" or "series"
  posterUrl:  { type: String, default: "" },

  // What the user did
  action: {
    type: String,
    enum: ["liked", "disliked", "watched", "skipped", "saved"],
    required: true
  },

  rating: { type: Number, min: 1, max: 5, default: null },  
  note:   { type: String, default: "" },                     

  timestamp: { type: Date, default: Date.now }
})

// One action per user per movie (upsert on save)
BehaviorSchema.index({ userId: 1, movieId: 1 }, { unique: true })

module.exports = mongoose.model("Behavior", BehaviorSchema)