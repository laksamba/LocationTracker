import { useState, useEffect } from 'react';
import { api, type Click, type LinkStats, type Link } from './services/api';
import './App.css';

type Tab = 'create' | 'clicks' | 'stats' | 'links';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [targetUrl, setTargetUrl] = useState('');
  const [createdLink, setCreatedLink] = useState<{ linkId: string; trackingUrl: string; targetUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clicks, setClicks] = useState<Click[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkStats, setLinkStats] = useState<LinkStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [links, setLinks] = useState<Link[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSort, setLinkSort] = useState<'recent' | 'clicks'>('recent');

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const health = await api.healthCheck();
      setServerStatus(health.mongodb === 'connected' ? 'up' : 'down');
    } catch {
      setServerStatus('down');
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCreatedLink(null);

    try {
      const res = await api.createLink(targetUrl);
      if (res.success) {
        setCreatedLink(res.data);
        setActiveTab('clicks');
        fetchClicks();
      } else {
        setError(res.error || 'Failed to create link');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchClicks = async (linkId?: string) => {
    try {
      const res = await api.getClicks({ linkId, limit: 100 });
      if (res.success) {
        setClicks(res.data.clicks);
        setTotalClicks(res.data.total);
      }
    } catch {
      console.error('Failed to fetch clicks');
    }
  };

  const fetchStats = async (linkId: string) => {
    try {
      const res = await api.getLinkStats(linkId);
      if (res.success) {
        setLinkStats(res.data.stats);
      }
    } catch {
      console.error('Failed to fetch stats');
    }
  };

  const fetchLinks = async () => {
    try {
      const res = await api.getLinks();
      if (res.success) {
        setLinks(res.data);
      }
    } catch {
      console.error('Failed to fetch links');
    }
  };

  const handleLinkClick = (click: Click) => {
    setSelectedLinkId(click.linkId);
    setActiveTab('stats');
    fetchStats(click.linkId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const deleteClick = async (clickId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this click record?')) return;
    setDeleting(clickId);
    try {
      await api.deleteClick(clickId);
      setClicks(clicks.filter(c => c.clickId !== clickId));
      setTotalClicks(t => t - 1);
    } catch {
      console.error('Failed to delete click');
    }
    setDeleting(null);
  };

  const deleteLink = async (linkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this link and ALL its clicks?')) return;
    setDeleting(linkId);
    try {
      await api.deleteLink(linkId);
      setLinks(links.filter(l => l.linkId !== linkId));
      if (selectedLinkId === linkId) {
        setSelectedLinkId(null);
        setActiveTab('clicks');
      }
    } catch {
      console.error('Failed to delete link');
    }
    setDeleting(null);
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">📡</div>
          <span>TrackPro</span>
        </div>

        <nav className="nav">
          <button
            onClick={() => setActiveTab('create')}
            className={`nav-item ${activeTab === 'create' ? 'active' : ''}`}
          >
            <span className="nav-icon">+</span>
            Create Link
          </button>
          <button
            onClick={() => { setActiveTab('clicks'); fetchClicks(); }}
            className={`nav-item ${activeTab === 'clicks' ? 'active' : ''}`}
          >
            <span className="nav-icon">📋</span>
            All Clicks
          </button>
          <button
            onClick={() => { setActiveTab('links'); fetchLinks(); }}
            className={`nav-item ${activeTab === 'links' ? 'active' : ''}`}
          >
            <span className="nav-icon">🔗</span>
            Links
          </button>
          {selectedLinkId && (
            <button
              onClick={() => setActiveTab('stats')}
              className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
            >
              <span className="nav-icon">📊</span>
              Statistics
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className={`status-dot ${serverStatus}`}></div>
          <span className="status-text">
            {serverStatus === 'up' ? 'Server Online' : serverStatus === 'down' ? 'Server Offline' : 'Checking...'}
          </span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Top Bar */}
        <header className="topbar">
          <div>
            <h1 className="page-title">
              {activeTab === 'create' && 'Create Tracking Link'}
              {activeTab === 'clicks' && 'Click Analytics'}
              {activeTab === 'stats' && 'Link Statistics'}
              {activeTab === 'links' && 'Manage Links'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'create' && 'Generate a new tracking link for your campaign'}
              {activeTab === 'clicks' && `${totalClicks} total clicks recorded`}
              {activeTab === 'stats' && `Analyzing link ${selectedLinkId?.slice(0, 12)}...`}
              {activeTab === 'links' && `${links.length} tracking links`}
            </p>
          </div>
          {activeTab === 'clicks' && clicks.length > 0 && (
            <button onClick={() => fetchClicks()} className="refresh-btn">
              ↻ Refresh
            </button>
          )}
        </header>

        {/* Content Area */}
        <div className="content">
          {/* Create Link Tab */}
          {activeTab === 'create' && (
            <div className="create-section">
              <div className="card create-card">
                <div className="card-header">
                  <h2>Target URL</h2>
                  <p>Enter the destination URL for your tracking link</p>
                </div>
                <form onSubmit={handleCreateLink} className="create-form">
                  <div className="input-group">
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://yoursite.com/landing-page"
                      required
                      className="url-input"
                    />
                  </div>
                  {error && <p className="error-text">{error}</p>}
                  <button type="submit" disabled={loading} className="create-btn">
                    {loading ? (
                      <span className="loading-dots">Creating<span>.</span><span>.</span><span>.</span></span>
                    ) : (
                      <>Generate Tracking Link →</>
                    )}
                  </button>
                </form>
              </div>

              {createdLink && (
                <div className="card result-card">
                  <div className="success-badge">✓ Link Created</div>
                  <div className="result-section">
                    <label>Your Tracking URL</label>
                    <div className="url-box">
                      <code>{createdLink.trackingUrl}</code>
                      <button onClick={() => copyToClipboard(createdLink.trackingUrl)} className="copy-btn">
                        {copied ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="result-section">
                    <label>Destination</label>
                    <code className="dest-url">{createdLink.targetUrl}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clicks Tab */}
          {activeTab === 'clicks' && (
            <div className="clicks-section">
              {clicks.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-icon">📊</div>
                  <h3>No Clicks Yet</h3>
                  <p>Create a tracking link and share it to start capturing click data</p>
                </div>
              ) : (
                <div className="clicks-grid">
                  {clicks.map((click) => (
                    <div key={click.clickId} className="click-card" onClick={() => handleLinkClick(click)}>
                      <div className="click-card-header">
                        <span className="click-time">{formatDate(click.clickedAt)}</span>
                        <code className="click-link-id">{click.linkId.slice(0, 12)}</code>
                      </div>
                      <div className="click-card-body">
                        <div className="click-row-data">
                          <span className="click-label">📍 IP Location</span>
                          <span className="click-value">{click.city || '?'}, {click.region || '?'}, {click.country || 'Unknown'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">🌐 IP Coords</span>
                          <span className="click-value coord">{click.ipLatitude?.toFixed(6) || 'N/A'}, {click.ipLongitude?.toFixed(6) || 'N/A'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">📍 Exact GPS</span>
                          <span className="click-value coord">{click.exactLatitude?.toFixed(6) || 'N/A'}, {click.exactLongitude?.toFixed(6) || 'N/A'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">🎯 GPS Accuracy</span>
                          <span className="click-value">{click.gpsAccuracy ? `${click.gpsAccuracy.toFixed(0)}m` : 'N/A'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">📱 Device</span>
                          <span className="click-value">{getDeviceIcon(click.deviceType)} {click.deviceType} / {click.brand || '?'} {click.model || ''}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">💻 OS</span>
                          <span className="click-value">{click.osName} {click.osVersion}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">🌐 Browser</span>
                          <span className="click-value">{click.browserName} {click.browserVersion}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">🌍 ISP</span>
                          <span className="click-value">{click.isp || 'Unknown'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">⏱️ Timezone</span>
                          <span className="click-value">{click.timezone || 'Unknown'}</span>
                        </div>
                        <div className="click-row-data">
                          <span className="click-label">🔒 Permission</span>
                          <span className={`click-value perm-${click.locationPermission}`}>{click.locationPermission}</span>
                        </div>
                      </div>
                      <div className="click-card-footer">
                        <span className="click-target" title={click.targetUrl}>→ {click.targetUrl}</span>
                        <button
                          onClick={(e) => deleteClick(click.clickId, e)}
                          className="delete-btn"
                          disabled={deleting === click.clickId}
                        >
                          {deleting === click.clickId ? '...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && linkStats && (
            <div className="stats-section">
              {/* Stat Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">👆</div>
                  <div className="stat-info">
                    <span className="stat-value">{linkStats.totalClicks}</span>
                    <span className="stat-label">Total Clicks</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green">📍</div>
                  <div className="stat-info">
                    <span className="stat-value">{linkStats.locationPermissionStats.granted}</span>
                    <span className="stat-label">GPS Granted</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon red">🚫</div>
                  <div className="stat-info">
                    <span className="stat-value">{linkStats.locationPermissionStats.denied}</span>
                    <span className="stat-label">GPS Denied</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon purple">🎯</div>
                  <div className="stat-info">
                    <span className="stat-value">{linkStats.avgGpsAccuracy ? `${Math.round(linkStats.avgGpsAccuracy)}m` : 'N/A'}</span>
                    <span className="stat-label">Avg Accuracy</span>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="charts-grid">
                <div className="card chart-card">
                  <h3>📱 Devices</h3>
                  <div className="chart-content">
                    {Object.entries(linkStats.byDevice).map(([device, count]) => (
                      <div key={device} className="chart-row">
                        <span className="chart-label">{getDeviceIcon(device)} {device}</span>
                        <div className="chart-bar">
                          <div className="bar-fill" style={{ width: `${(count / linkStats.totalClicks) * 100}%` }}></div>
                        </div>
                        <span className="chart-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>🌍 Countries</h3>
                  <div className="list-content">
                    {Object.entries(linkStats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([country, count]) => (
                      <div key={country} className="list-row">
                        <span>{getFlag(getCountryCode(country))} {country}</span>
                        <span className="list-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>🌐 Browsers</h3>
                  <div className="list-content">
                    {Object.entries(linkStats.byBrowser).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([browser, count]) => (
                      <div key={browser} className="list-row">
                        <span>{browser}</span>
                        <span className="list-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>💻 Operating Systems</h3>
                  <div className="list-content">
                    {Object.entries(linkStats.byOs).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([os, count]) => (
                      <div key={os} className="list-row">
                        <span>{os}</span>
                        <span className="list-value">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* GPS Permission Stats */}
              <div className="card gps-stats-card">
                <h3>📍 Location Permission Breakdown</h3>
                <div className="gps-grid">
                  {Object.entries(linkStats.locationPermissionStats).map(([status, count]) => (
                    <div key={status} className={`gps-item ${status}`}>
                      <span className="gps-count">{count}</span>
                      <span className="gps-label capitalize">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Links Tab */}
          {activeTab === 'links' && (
            <div className="links-section">
              {/* Search and Sort Controls */}
              <div className="links-controls">
                <div className="links-search">
                  <span className="links-search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search links..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                  />
                </div>
                <div className="links-sort">
                  <button
                    className={`sort-btn ${linkSort === 'recent' ? 'active' : ''}`}
                    onClick={() => setLinkSort('recent')}
                  >
                    🕐 Recent
                  </button>
                  <button
                    className={`sort-btn ${linkSort === 'clicks' ? 'active' : ''}`}
                    onClick={() => setLinkSort('clicks')}
                  >
                    📊 Most Clicks
                  </button>
                </div>
              </div>

              {/* Links Grid */}
              {links.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-icon">🔗</div>
                  <h3>No Links Yet</h3>
                  <p>Create a tracking link to get started</p>
                </div>
              ) : (
                <div className="links-grid">
                  {links
                    .filter(link =>
                      link.linkId.toLowerCase().includes(linkSearch.toLowerCase()) ||
                      link.targetUrl.toLowerCase().includes(linkSearch.toLowerCase())
                    )
                    .sort((a, b) => {
                      if (linkSort === 'clicks') {
                        return (b.clickCount || 0) - (a.clickCount || 0);
                      }
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((link) => (
                      <div key={link.linkId} className="link-card">
                        <div className="link-card-header">
                          <div>
                            <div className="link-id-badge">
                              <span className="link-id-icon">🔗</span>
                              <code>{link.linkId.slice(0, 16)}...</code>
                            </div>
                            <div className="link-stats-row">
                              <div className="link-stat">
                                <span className="link-stat-value">{link.clickCount || 0}</span>
                                <span className="link-stat-label">Clicks</span>
                              </div>
                              <div className="link-stat">
                                <span className="link-stat-value">{formatDate(link.createdAt).split(',')[0]}</span>
                                <span className="link-stat-label">Created</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => deleteLink(link.linkId, e)}
                            className="link-delete-btn"
                            disabled={deleting === link.linkId}
                            title="Delete link"
                          >
                            {deleting === link.linkId ? '...' : '🗑️'}
                          </button>
                        </div>
                        <div className="link-card-body">
                          <div className="link-row">
                            <span className="link-label">🌐 Target URL</span>
                            <span className="link-value target" title={link.targetUrl}>{link.targetUrl}</span>
                          </div>
                          <div className="link-tracking-url">
                            <code title={`${window.location.origin}/t/${link.linkId}`}>
                              {`${window.location.origin}/t/${link.linkId}`}
                            </code>
                          </div>
                        </div>
                        <div className="link-card-footer">
                          <button
                            onClick={() => copyToClipboard(`${window.location.origin}/t/${link.linkId}`)}
                            className="copy-link-btn"
                          >
                            📋 Copy
                          </button>
                          <button
                            onClick={() => { setSelectedLinkId(link.linkId); setActiveTab('stats'); fetchStats(link.linkId); }}
                            className="view-stats-btn"
                          >
                            📊 View Stats
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function getDeviceIcon(deviceType: string) {
  switch (deviceType) {
    case 'mobile': return '📱';
    case 'tablet': return '📲';
    case 'desktop': return '🖥️';
    default: return '❓';
  }
}

function getFlag(countryCode: string | null) {
  if (!countryCode) return '🌍';
  return countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) - 0x41 + 0x1F1E6));
}

function getCountryCode(country: string): string {
  const codes: Record<string, string> = {
    'United States': 'US', 'India': 'IN', 'China': 'CN', 'Brazil': 'BR',
    'Germany': 'DE', 'France': 'FR', 'United Kingdom': 'GB', 'Japan': 'JP',
    'Canada': 'CA', 'Australia': 'AU', 'Russia': 'RU', 'Mexico': 'MX',
    'Spain': 'ES', 'Italy': 'IT', 'Netherlands': 'NL', 'Poland': 'PL',
    'Argentina': 'AR', 'Turkey': 'TR', 'Indonesia': 'ID', 'Pakistan': 'PK'
  };
  return codes[country] || country.slice(0, 2).toUpperCase();
}

export default App;