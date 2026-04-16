const mongoose = require('mongoose');

/**
 * Link Schema - Stores tracking links and their target URLs
 */
const linkSchema = new mongoose.Schema({
  linkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  targetUrl: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  clickCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Link = mongoose.model('Link', linkSchema);

module.exports = Link;