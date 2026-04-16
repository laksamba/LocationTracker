/**
 * Click Tracking Server
 * Production-ready User Click Tracking System with exact location tracking
 *
 * Features:
 * - IP Geolocation using ipgeolocation.io API
 * - Device/Browser detection using ua-parser-js
 * - Browser Geolocation API for exact GPS
 * - UTM parameter tracking
 * - MongoDB storage with Mongoose
 */

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const trackingRoutes = require('./routes/tracking');

// Initialize Express app
const app = express();

// ============================================
// SECURITY & MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS - Allow cross-origin requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Morgan - HTTP request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// DATABASE CONNECTION
// ============================================

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/click_tracker';

    console.log('[DB] Connecting to MongoDB...');
    console.log('[DB] URI:', mongoURI.replace(/\/\/.*@/, '//<credentials>@')); // Hide credentials in log

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    console.log('[DB] Successfully connected to MongoDB');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('[DB] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected');
    });

  } catch (error) {
    console.error('[DB] Failed to connect to MongoDB:', error.message);
    console.log('[DB] Server will continue without database connection');
  }
};

// ============================================
// API ROUTES
// ============================================

// Mount tracking routes
app.use('/', trackingRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// ============================================
// ROOT ROUTE
// ============================================

app.get('/', (req, res) => {
  res.json({
    name: 'Click Tracker API',
    version: '1.0.0',
    description: 'Production-ready User Click Tracking System',
    endpoints: {
      createLink: 'POST /create-link',
      trackClick: 'GET /t/:linkId',
      logLocation: 'POST /log-location',
      logLocationDenied: 'POST /log-location-denied',
      dashboardClicks: 'GET /dashboard/clicks',
      dashboardStats: 'GET /dashboard/link/:linkId/stats',
      deleteLink: 'DELETE /dashboard/link/:linkId',
      health: 'GET /health'
    },
    documentation: 'See README.md for usage instructions'
  });
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Connect to database first
  await connectDB();

  app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('[SERVER] Click Tracking Server Started');
    console.log('═'.repeat(50));
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═'.repeat(50));
    console.log('\nAvailable endpoints:');
    console.log('  POST   /create-link        → Create tracking link');
    console.log('  GET    /t/:linkId           → Track click');
    console.log('  POST   /log-location       → Save GPS data');
    console.log('  POST   /log-location-denied → Log denied location');
    console.log('  GET    /dashboard/clicks   → View all clicks');
    console.log('  GET    /dashboard/link/:id/stats → Link statistics');
    console.log('  DELETE /dashboard/link/:id → Delete link data');
    console.log('  GET    /health             → Health check');
    console.log('');
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] SIGINT received. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;