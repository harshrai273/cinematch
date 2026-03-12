const mongoose = require("mongoose")

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email:    { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },  // hashed with bcryptjs

  // Friends
  friends: [{
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: String,
    addedAt:  { type: Date, default: Date.now }
  }],
  friendRequests: [{
    fromUserId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fromUsername: String,
    sentAt:       { type: Date, default: Date.now }
  }],

  // Auto-updated taste profile
  tasteProfile: {
    genres:    { type: Map, of: Number, default: {} },  // { "Action": 10, "Drama": 6 }
    languages: { type: Map, of: Number, default: {} },  // { "Hindi": 8 }
  },

  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model("User", UserSchema)