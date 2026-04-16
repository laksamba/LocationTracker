const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const Click = require('../models/Click');
const Link = require('../models/Link');

// Load environment variables
require('dotenv').config();

/**
 * POST /create-link
 * Creates a new tracking link with a nanoid and stores the target URL
 * Body: { targetUrl: string }
 * Returns: { trackingUrl: string, linkId: string }
 */
router.post('/create-link', async (req, res) => {
  try {
    const { targetUrl } = req.body;

    // Validate target URL
    if (!targetUrl) {
      return res.status(400).json({
        success: false,
        error: 'targetUrl is required'
      });
    }

    // Basic URL validation
    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetUrl format'
      });
    }

    // Generate unique link ID (21 characters for uniqueness)
    const linkId = nanoid(21);

    // Save link to database
    const link = new Link({
      linkId,
      targetUrl
    });
    await link.save();

    // Construct the full tracking URL
    const trackingUrl = `${process.env.BASE_URL}/t/${linkId}`;

    console.log(`[LINK CREATED] linkId: ${linkId} -> ${targetUrl}`);

    res.status(201).json({
      success: true,
      data: {
        linkId,
        targetUrl,
        trackingUrl
      }
    });

  } catch (error) {
    console.error('[CREATE LINK ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tracking link'
    });
  }
});

/**
 * GET /t/:linkId
 * Main tracking endpoint - captures all possible user data and serves tracking HTML
 * This endpoint:
 * 1. Captures IP, user agent, referrer, UTM params from request
 * 2. Fetches IP geolocation data
 * 3. Saves initial click record
 * 4. Serves the tracking HTML page which handles GPS location
 */
router.get('/t/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    const {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content
    } = req.query;

    console.log(`[TRACKING CLICK] linkId: ${linkId}`);

    // Look up the link to get target URL
    const link = await Link.findOne({ linkId });
    if (!link) {
      return res.status(404).send('Tracking link not found');
    }

    // Update click count
    link.clickCount += 1;
    await link.save();

    // Get client IP (handle proxies)
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.connection?.remoteAddress ||
                      req.ip;

    // Parse user agent
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();

    // Prepare geolocation data
    let geoData = {
      isp: null,
      isProxy: false,
      country: null,
      countryCode: null,
      region: null,
      city: null,
      ipLatitude: null,
      ipLongitude: null,
      timezone: null
    };

    // Fetch IP geolocation if API key is configured
    if (process.env.IPGEOLOCATION_API_KEY) {
      try {
        const geoResponse = await axios.get(
          `https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IPGEOLOCATION_API_KEY}&ip=${ipAddress}`,
          { timeout: 5000 }
        );
        const geo = geoResponse.data;
        geoData = {
          isp: geo.isp || null,
          isProxy: geo.is_proxy || false,
          country: geo.country_name || null,
          countryCode: geo.country_code2 || null,
          region: geo.state || null,
          city: geo.city || null,
          ipLatitude: geo.latitude ? parseFloat(geo.latitude) : null,
          ipLongitude: geo.longitude ? parseFloat(geo.longitude) : null,
          timezone: geo.timezone || null
        };
        console.log(`[GEO DATA] ${ipAddress} -> ${geoData.city}, ${geoData.country}`);
      } catch (geoError) {
        console.warn('[GEO ERROR] Failed to fetch IP geolocation:', geoError.message);
      }
    }

    // Generate click ID
    const clickId = nanoid(21);

    // Create click record with all available data
    const click = new Click({
      clickId,
      linkId,
      targetUrl: link.targetUrl,
      clickedAt: new Date(),

      // IP info
      ipAddress,
      ...geoData,

      // Device info
      deviceType: uaResult.device.type || 'other',
      isMobile: uaResult.device.type === 'mobile',
      brand: uaResult.device.brand || null,
      model: uaResult.device.model || null,

      // OS info
      osName: uaResult.os.name || null,
      osVersion: uaResult.os.version || null,

      // Browser info
      browserName: uaResult.browser.name || null,
      browserVersion: uaResult.browser.version || null,

      // Other HTTP info
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'] || req.headers['referrer'],
      language: req.headers['accept-language']?.split(',')[0],

      // UTM params
      utmSource: utm_source,
      utmMedium: utm_medium,
      utmCampaign: utm_campaign,
      utmTerm: utm_term,
      utmContent: utm_content
    });

    await click.save();
    console.log(`[CLICK LOGGED] clickId: ${clickId} from ${ipAddress}`);

    // Store clickId in cookie for GPS update
    res.cookie('clickId', clickId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

    // Serve tracking HTML with clickId and targetUrl
    res.send(generateTrackingHTML(clickId, link.targetUrl));

  } catch (error) {
    console.error('[TRACKING ERROR]', error);
    res.status(500).send('Tracking error');
  }
});

/**
 * POST /log-location
 * Saves exact GPS coordinates after user grants location permission
 * Body: { clickId: string, latitude: number, longitude: number, accuracy: number }
 */
router.post('/log-location', async (req, res) => {
  try {
    const { clickId, latitude, longitude, accuracy } = req.body;

    if (!clickId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'clickId, latitude, and longitude are required'
      });
    }

    const updateData = {
      exactLatitude: latitude,
      exactLongitude: longitude,
      gpsAccuracy: accuracy || null,
      locationPermission: 'granted'
    };

    const click = await Click.findOneAndUpdate(
      { clickId },
      { $set: updateData },
      { new: true }
    );

    if (!click) {
      return res.status(404).json({
        success: false,
        error: 'Click record not found'
      });
    }

    console.log(`[GPS LOGGED] clickId: ${clickId} -> ${latitude}, ${longitude}`);

    res.json({
      success: true,
      message: 'Location saved successfully'
    });

  } catch (error) {
    console.error('[LOG LOCATION ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save location'
    });
  }
});

/**
 * POST /log-location-denied
 * Records when user denies location permission
 */
router.post('/log-location-denied', async (req, res) => {
  try {
    const { clickId } = req.body;

    if (!clickId) {
      return res.status(400).json({
        success: false,
        error: 'clickId is required'
      });
    }

    await Click.findOneAndUpdate(
      { clickId },
      { $set: { locationPermission: 'denied' } }
    );

    console.log(`[GPS DENIED] clickId: ${clickId}`);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('[LOG LOCATION DENIED ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log location denial'
    });
  }
});

/**
 * GET /dashboard/clicks
 * Returns all clicks sorted by latest, with optional filtering
 */
router.get('/dashboard/clicks', async (req, res) => {
  try {
    const {
      linkId,
      limit = 100,
      skip = 0,
      startDate,
      endDate
    } = req.query;

    // Build query filter
    const filter = {};
    if (linkId) filter.linkId = linkId;
    if (startDate || endDate) {
      filter.clickedAt = {};
      if (startDate) filter.clickedAt.$gte = new Date(startDate);
      if (endDate) filter.clickedAt.$lte = new Date(endDate);
    }

    const clicks = await Click.find(filter)
      .sort({ clickedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Click.countDocuments(filter);

    console.log(`[DASHBOARD] Retrieved ${clicks.length} clicks (total: ${total})`);

    res.json({
      success: true,
      data: {
        clicks,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });

  } catch (error) {
    console.error('[DASHBOARD ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clicks'
    });
  }
});

/**
 * GET /dashboard/links
 * Returns all links
 */
router.get('/dashboard/links', async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    console.error('[LINKS ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch links'
    });
  }
});

/**
 * GET /dashboard/link/:linkId/stats
 * Returns statistics for a specific link
 */
router.get('/dashboard/link/:linkId/stats', async (req, res) => {
  try {
    const { linkId } = req.params;

    const clicks = await Click.find({ linkId });
    const link = await Link.findOne({ linkId });

    const stats = {
      totalClicks: clicks.length,
      linkClickCount: link?.clickCount || 0,
      byDevice: {},
      byBrowser: {},
      byCountry: {},
      byOs: {},
      locationPermissionStats: {
        granted: 0,
        denied: 0,
        prompt: 0,
        unavailable: 0
      },
      avgGpsAccuracy: null
    };

    clicks.forEach(click => {
      // Device breakdown
      stats.byDevice[click.deviceType] = (stats.byDevice[click.deviceType] || 0) + 1;
      // Browser breakdown
      if (click.browserName) {
        stats.byBrowser[click.browserName] = (stats.byBrowser[click.browserName] || 0) + 1;
      }
      // Country breakdown
      if (click.country) {
        stats.byCountry[click.country] = (stats.byCountry[click.country] || 0) + 1;
      }
      // OS breakdown
      if (click.osName) {
        stats.byOs[click.osName] = (stats.byOs[click.osName] || 0) + 1;
      }
      // Location permission stats
      if (click.locationPermission) {
        stats.locationPermissionStats[click.locationPermission]++;
      }
    });

    // Calculate average GPS accuracy
    const gpsClicks = clicks.filter(c => c.gpsAccuracy);
    if (gpsClicks.length > 0) {
      const totalAccuracy = gpsClicks.reduce((sum, c) => sum + c.gpsAccuracy, 0);
      stats.avgGpsAccuracy = totalAccuracy / gpsClicks.length;
    }

    res.json({
      success: true,
      data: {
        linkId,
        targetUrl: link?.targetUrl,
        stats
      }
    });

  } catch (error) {
    console.error('[STATS ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats'
    });
  }
});

/**
 * DELETE /dashboard/link/:linkId
 * Deletes all clicks for a specific link
 */
router.delete('/dashboard/link/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    // Delete clicks
    const clickResult = await Click.deleteMany({ linkId });
    // Delete link
    const linkResult = await Link.deleteOne({ linkId });

    console.log(`[LINK DELETED] linkId: ${linkId}, clicks: ${clickResult.deletedCount}`);

    res.json({
      success: true,
      deleted: clickResult.deletedCount
    });

  } catch (error) {
    console.error('[DELETE ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete link'
    });
  }
});

/**
 * DELETE /dashboard/click/:clickId
 * Deletes a single click
 */
router.delete('/dashboard/click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const result = await Click.deleteOne({ clickId });

    console.log(`[CLICK DELETED] clickId: ${clickId}`);

    res.json({
      success: true,
      deleted: result.deletedCount
    });

  } catch (error) {
    console.error('[DELETE CLICK ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete click'
    });
  }
});

/**
 * GET /dashboard/links
 * Returns all links with click counts
 */
router.get('/dashboard/links', async (req, res) => {
  try {
    const links = await Link.find().sort({ createdAt: -1 });

    // Get click counts for each link
    const linksWithCounts = await Promise.all(links.map(async (link) => {
      const clickCount = await Click.countDocuments({ linkId: link.linkId });
      return {
        ...link.toObject(),
        clickCount
      };
    }));

    res.json({
      success: true,
      data: linksWithCounts
    });
  } catch (error) {
    console.error('[LINKS ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch links'
    });
  }
});

/**
 * Generate the tracking HTML page
 * This page:
 * 1. Shows a "Redirecting..." message
 * 2. Requests GPS location permission
 * 3. Sends GPS data to /log-location
 * 4. Redirects to target URL after location capture
 */
function generateTrackingHTML(clickId, targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Redirecting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 420px;
      width: 90%;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 12px;
    }
    p {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
    }
    .hidden { display: none; }
    .success-icon {
      width: 48px;
      height: 48px;
      background: #28a745;
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .success-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="loadingSpinner"></div>
    <div class="success-icon hidden" id="successIcon">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1 id="statusTitle">Requesting location...</h1>
    <p id="statusText">Please allow location access when prompted</p>
  </div>

  <script>
    const clickId = '${clickId}';
    const targetUrl = ${JSON.stringify(targetUrl)};

    // Track if location was captured
    let locationCaptured = false;

    // Request browser's native location dialog immediately
    function requestLocation() {
      if (!navigator.geolocation) {
        logLocationDenied('unavailable');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          logLocation(latitude, longitude, accuracy);
        },
        (error) => {
          let reason = 'denied';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              reason = 'denied';
              break;
            case error.POSITION_UNAVAILABLE:
              reason = 'unavailable';
              break;
            case error.TIMEOUT:
              reason = 'prompt';
              break;
          }
          logLocationDenied(reason);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    }

    // Log location to server
    async function logLocation(latitude, longitude, accuracy) {
      try {
        locationCaptured = true;
        await fetch('/log-location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clickId,
            latitude,
            longitude,
            accuracy
          })
        });
      } catch (error) {
        console.error('Failed to log location:', error);
      }
      redirectToTarget();
    }

    // Log location denial to server
    async function logLocationDenied(reason) {
      try {
        await fetch('/log-location-denied', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clickId,
            reason
          })
        });
      } catch (error) {
        console.error('Failed to log location denial:', error);
      }
      redirectToTarget();
    }

    // Redirect to target URL
    function redirectToTarget() {
      document.getElementById('loadingSpinner').classList.add('hidden');
      document.getElementById('successIcon').classList.remove('hidden');
      document.getElementById('statusTitle').textContent = 'Done!';
      document.getElementById('statusText').textContent = 'Redirecting...';
      setTimeout(() => {
        window.location.href = targetUrl;
      }, 300);
    }

    // Start immediately - browser will show native GPS permission dialog
    requestLocation();

    // Fallback redirect after 8 seconds regardless
    setTimeout(() => {
      if (!locationCaptured) {
        redirectToTarget();
      }
    }, 20000);
  </script>
</body>
</html>`;
}

module.exports = router;