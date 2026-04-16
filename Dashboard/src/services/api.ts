const API_BASE = 'https://dashboard-ahtj.onrender.com';

export interface Click {
  timezone: string;
  isp: string;
  _id: string;
  clickId: string;
  linkId: string;
  targetUrl: string;
  clickedAt: string;
  ipAddress: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  ipLatitude: number;
  ipLongitude: number;
  exactLatitude: number;
  exactLongitude: number;
  gpsAccuracy: number;
  locationPermission: string;
  deviceType: string;
  isMobile: boolean;
  brand: string;
  model: string;
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
  userAgent: string;
  referrer: string;
  language: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
}

export interface Link {
  _id: string;
  linkId: string;
  targetUrl: string;
  clickCount: number;
  createdAt: string;
}

export interface CreateLinkResponse {
  error: string;
  success: boolean;
  data: {
    linkId: string;
    targetUrl: string;
    trackingUrl: string;
  };
}

export interface ClicksResponse {
  success: boolean;
  data: {
    clicks: Click[];
    total: number;
    limit: number;
    skip: number;
  };
}

export interface LinksResponse {
  success: boolean;
  data: Link[];
}

export interface LinkStats {
  totalClicks: number;
  byDevice: Record<string, number>;
  byBrowser: Record<string, number>;
  byCountry: Record<string, number>;
  byOs: Record<string, number>;
  locationPermissionStats: {
    granted: number;
    denied: number;
    prompt: number;
    unavailable: number;
  };
  avgGpsAccuracy: number | null;
}

export const api = {
  async createLink(targetUrl: string): Promise<CreateLinkResponse> {
    const res = await fetch(`${API_BASE}/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl }),
    });
    return res.json();
  },

  async getClicks(params?: {
    linkId?: string;
    limit?: number;
    skip?: number;
  }): Promise<ClicksResponse> {
    const searchParams = new URLSearchParams();
    if (params?.linkId) searchParams.set('linkId', params.linkId);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.skip) searchParams.set('skip', String(params.skip));

    const query = searchParams.toString();
    const res = await fetch(`${API_BASE}/dashboard/clicks${query ? `?${query}` : ''}`);
    return res.json();
  },

  async getLinks(): Promise<LinksResponse> {
    const res = await fetch(`${API_BASE}/dashboard/links`);
    return res.json();
  },

  async getLinkStats(linkId: string): Promise<{ success: boolean; data: { linkId: string; stats: LinkStats } }> {
    const res = await fetch(`${API_BASE}/dashboard/link/${linkId}/stats`);
    return res.json();
  },

  async deleteClick(clickId: string): Promise<{ success: boolean; deleted: number }> {
    const res = await fetch(`${API_BASE}/dashboard/click/${clickId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async deleteLink(linkId: string): Promise<{ success: boolean; deleted: number }> {
    const res = await fetch(`${API_BASE}/dashboard/link/${linkId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async healthCheck(): Promise<{ status: string; mongodb: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
};