/**
 * API Service Layer for MediScan Frontend
 * Handles all backend API communications
 */

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

function getApiBase(): string {
  if (!RAW_API_BASE) return '';
  if (typeof window === 'undefined') return RAW_API_BASE;

  const runningOnLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const pointsToLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(RAW_API_BASE);

  // Safety: ignore localhost API URL in deployed environments.
  if (!runningOnLocalHost && pointsToLocalHost) {
    return '';
  }
  return RAW_API_BASE;
}

const API_BASE = getApiBase();

function resolveApiUrl(endpoint: string): string {
  if (!endpoint.startsWith('/')) {
    throw new Error(`API endpoint must start with '/': ${endpoint}`);
  }
  return API_BASE ? `${API_BASE}${endpoint}` : endpoint;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = resolveApiUrl(endpoint);
  
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    console.error(`Network error while calling API [${endpoint}]:`, error);
    const message =
      error instanceof Error
        ? `Network error: ${error.message}`
        : `Network error while calling ${endpoint}`;
    throw new Error(message);
  }

  let data: any;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Non-JSON response
      const text = await response.text();
      console.error(
        `Expected JSON response from API [${endpoint}], but received:`,
        text.substring(0, 200)
      );
      throw new Error(`Invalid (non-JSON) response from server`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Failed to parse JSON response from API [${endpoint}]:`, error);
      throw new Error(`Invalid JSON response from server`);
    }
    // Re-throw other errors (e.g., the explicit non-JSON error above)
    throw error;
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

/**
 * Get auth headers with Clerk session token
 */
function getAuthHeaders(sessionToken: string | null): HeadersInit {
  if (!sessionToken) {
    return {};
  }
  return {
    Authorization: `Bearer ${sessionToken}`,
  };
}

// ============================================
// AUTH API
// ============================================

export const authAPI = {
  /**
   * Get current user profile
   */
  getProfile: async (sessionToken: string) => {
    return fetchAPI('/auth/profile', {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Update user profile (company name)
   */
  updateProfile: async (sessionToken: string, data: { companyName: string }) => {
    return fetchAPI('/auth/profile', {
      method: 'PUT',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(data),
    });
  },

  /**
   * Update user role (Admin only)
   */
  updateRole: async (sessionToken: string, userId: string, role: string) => {
    return fetchAPI('/auth/role', {
      method: 'PUT',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify({ userId, role }),
    });
  },

  /**
   * Admin: update user role/profile fields
   */
  adminUpdateUser: async (
    sessionToken: string,
    userId: string,
    data: { role?: string; companyName?: string; firstName?: string; lastName?: string }
  ) => {
    return fetchAPI(`/admin/users/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// ADMIN API
// ============================================

export const adminAPI = {
  /**
   * Get all platform users (Admin only)
   */
  listUsers: async (sessionToken: string) => {
    return fetchAPI('/admin/users', {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Get admin overview stats
   */
  getOverview: async (sessionToken: string) => {
    return fetchAPI('/admin/overview', {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Get admin audit logs
   */
  getAudit: async (sessionToken: string, limit = 50) => {
    return fetchAPI(`/admin/audit?limit=${limit}`, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Get tracked login sessions
   */
  getSessions: async (sessionToken: string, options?: { limit?: number; email?: string; activeOnly?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.email) params.set('email', options.email);
    if (typeof options?.activeOnly === 'boolean') params.set('activeOnly', String(options.activeOnly));
    const query = params.toString();
    return fetchAPI(`/admin/sessions${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Ban/unban a user account
   */
  updateUserStatus: async (sessionToken: string, userId: string, banned: boolean) => {
    return fetchAPI(`/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify({ banned }),
    });
  },

  /**
   * Bootstrap first admin using server bootstrap key (no session required)
   */
  bootstrapAdmin: async (data: {
    bootstrapKey: string;
    email?: string;
    userId?: string;
    companyName?: string;
    allowExistingAdmin?: boolean;
  }) => {
    return fetchAPI('/admin/bootstrap', {
      method: 'POST',
      headers: {
        'x-admin-bootstrap-key': data.bootstrapKey,
      },
      body: JSON.stringify(data),
    });
  },

  /**
   * Bootstrap test admin account for QA/testing
   */
  bootstrapTestAdmin: async (data: {
    bootstrapKey: string;
    email?: string;
    companyName?: string;
    createIfMissing?: boolean;
  }) => {
    return fetchAPI('/admin/bootstrap/test', {
      method: 'POST',
      headers: {
        'x-admin-bootstrap-key': data.bootstrapKey,
      },
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// TICKET API
// ============================================

export const ticketAPI = {
  /**
   * List tickets for current user (admin sees all)
   */
  list: async (
    sessionToken: string,
    filters?: { status?: string; priority?: string; category?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.category) params.set('category', filters.category);
    const query = params.toString();

    return fetchAPI(`/tickets${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Create a new support ticket
   */
  create: async (
    sessionToken: string,
    data: {
      title: string;
      description: string;
      category?: string;
      priority?: string;
      attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
    }
  ) => {
    return fetchAPI('/tickets', {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(data),
    });
  },

  /**
   * Get ticket details
   */
  getById: async (sessionToken: string, ticketId: string) => {
    return fetchAPI(`/tickets/${ticketId}`, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Add comment to ticket
   */
  addComment: async (
    sessionToken: string,
    ticketId: string,
    data: {
      message?: string;
      attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
    }
  ) => {
    return fetchAPI(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(data),
    });
  },

  /**
   * Admin update ticket (status/priority/assignment)
   */
  update: async (
    sessionToken: string,
    ticketId: string,
    data: { status?: string; priority?: string; assignedTo?: { userId?: string; email?: string; name?: string } }
  ) => {
    return fetchAPI(`/tickets/${ticketId}`, {
      method: 'PUT',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(data),
    });
  },
};

// ============================================
// MEDICINE API
// ============================================

export const medicineAPI = {
  /**
   * Get list of medicines (with optional filters)
   */
  list: async (sessionToken: string, filters?: { status?: string; owner?: string; batchID?: string }) => {
    let endpoint = '/medicine/list';
    
    if (filters && Object.keys(filters).length > 0) {
      const params: string[] = [];
      if (filters.status) params.push(`status=${encodeURIComponent(filters.status)}`);
      if (filters.owner) params.push(`owner=${encodeURIComponent(filters.owner)}`);
      if (filters.batchID) params.push(`batchID=${encodeURIComponent(filters.batchID)}`);
      endpoint += `?${params.join('&')}`;
    }
    
    return fetchAPI(endpoint, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Register a new medicine (Manufacturer only)
   */
  register: async (sessionToken: string, medicineData: {
    batchID: string;
    name: string;
    manufacturer: string;
    manufacturerLocation?: string;
    mfgDate: string;
    expDate: string;
    totalUnits: number;
  }) => {
    return fetchAPI('/medicine/register', {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(medicineData),
    });
  },

  /**
   * Transfer medicine ownership
   */
  transfer: async (sessionToken: string, batchID: string, transferData: {
    newOwnerEmail: string;
    newOwnerRole: string;
    unitsToTransfer: number;
    fromLocation?: string;
    toLocation?: string;
  }) => {
    return fetchAPI(`/medicine/transfer/${batchID}`, {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(transferData),
    });
  },

  /**
   * Purchase/Reduce stock (Pharmacy/Distributor only)
   */
  purchase: async (sessionToken: string, batchID: string, purchaseData: {
    unitsPurchased: number;
    customerEmail?: string;
  }) => {
    return fetchAPI(`/medicine/purchase/${batchID}`, {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify(purchaseData),
    });
  },

  /**
   * Block a medicine (Admin only)
   */
  block: async (sessionToken: string, batchID: string) => {
    return fetchAPI(`/medicine/block/${batchID}`, {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Generate QR code for a medicine
   */
  generateQR: async (sessionToken: string, batchID: string) => {
    return fetchAPI(`/medicine/qrcode/${batchID}`, {
      headers: getAuthHeaders(sessionToken),
    });
  },

  /**
   * Verify a medicine (Public - no auth required)
   */
  verify: async (batchID: string, signature: string) => {
    return fetchAPI(`/medicine/verify/${batchID}?sig=${signature}`);
  },
};

// ============================================
// LOGS API
// ============================================

export const logsAPI = {
  /**
   * Get scan logs (Admin only)
   */
  getScanLogs: async (sessionToken: string) => {
    return fetchAPI('/logs', {
      headers: getAuthHeaders(sessionToken),
    });
  },
};

// ============================================
// COMPANIES API
// ============================================

export const companiesAPI = {
  /**
   * Get list of companies
   */
  list: async (sessionToken: string, role?: string) => {
    const endpoint = role ? `/companies/list?role=${role}` : '/companies/list';
    return fetchAPI(endpoint, {
      headers: getAuthHeaders(sessionToken),
    });
  },
};

// ============================================
// BLOCKCHAIN API
// ============================================

export const blockchainAPI = {
  /**
   * Add a block to the blockchain
   */
  addBlock: async (sessionToken: string, data: object) => {
    return fetchAPI('/blockchain/add', {
      method: 'POST',
      headers: getAuthHeaders(sessionToken),
      body: JSON.stringify({ data }),
    });
  },

  /**
   * Get the full blockchain
   */
  getChain: async (sessionToken: string) => {
    return fetchAPI('/blockchain/chain', {
      headers: getAuthHeaders(sessionToken),
    });
  },
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthAPI = {
  /**
   * Check API health
   */
  check: async () => {
    return fetchAPI('/health');
  },
};

export default {
  auth: authAPI,
  medicine: medicineAPI,
  logs: logsAPI,
  blockchain: blockchainAPI,
  health: healthAPI,
};
