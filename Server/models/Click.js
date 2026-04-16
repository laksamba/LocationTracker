const mongoose = require('mongoose');

/**
 * Click Schema - Stores all tracking data when a user clicks a tracking link
 * Captures: IP geolocation, device info, browser details, GPS coordinates, and UTM params
 */
const clickSchema = new mongoose.Schema({
  // Primary identifiers
  clickId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  linkId: {
    type: String,
    required: true,
    index: true
  },
  targetUrl: {
    type: String,
    required: true
  },

  // Timestamp
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // IP Geolocation data
  ipAddress: {
    type: String,
    required: true
  },
  isp: {
    type: String,
    default: null
  },
  isProxy: {
    type: Boolean,
    default: false
  },
  country: {
    type: String,
    default: null
  },
  countryCode: {
    type: String,
    default: null
  },
  region: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  ipLatitude: {
    type: Number,
    default: null
  },
  ipLongitude: {
    type: Number,
    default: null
  },
  timezone: {
    type: String,
    default: null
  },

  // Exact GPS coordinates from browser Geolocation API
  exactLatitude: {
    type: Number,
    default: null
  },
  exactLongitude: {
    type: Number,
    default: null
  },
  gpsAccuracy: {
    type: Number,
    default: null
  },
  locationPermission: {
    type: String,
    enum: ['granted', 'denied', 'prompt', 'unavailable'],
    default: 'unavailable'
  },

  // Device information
  deviceType: {
    type: String,
    enum: ['desktop', 'tablet', 'mobile', 'other'],
    default: 'other'
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  brand: {
    type: String,
    default: null
  },
  model: {
    type: String,
    default: null
  },

  // Operating System
  osName: {
    type: String,
    default: null
  },
  osVersion: {
    type: String,
    default: null
  },

  // Browser information
  browserName: {
    type: String,
    default: null
  },
  browserVersion: {
    type: String,
    default: null
  },

  // Other HTTP details
  userAgent: {
    type: String,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },
  language: {
    type: String,
    default: null
  },

  // UTM Parameters
  utmSource: {
    type: String,
    default: null
  },
  utmMedium: {
    type: String,
    default: null
  },
  utmCampaign: {
    type: String,
    default: null
  },
  utmTerm: {
    type: String,
    default: null
  },
  utmContent: {
    type: String,
    default: null
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
clickSchema.index({ createdAt: -1 });
clickSchema.index({ linkId: 1, createdAt: -1 });

const Click = mongoose.model('Click', clickSchema);

module.exports = Click;