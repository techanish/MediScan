import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Save, Users, RefreshCw, Shield, Ban, CheckCircle2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI, authAPI } from '../utils/api';

interface AdminManagementPanelProps {
  getToken: () => Promise<string | null>;
}

interface PlatformUser {
  userId: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'CUSTOMER' | 'ADMIN';
  companyName: string;
  createdAt?: number;
  banned?: boolean;
}

interface AdminOverview {
  totalUsers: number;
  bannedUsers: number;
  usersByRole: Record<string, number>;
  totalMedicines: number;
  activeMedicines: number;
  blockedMedicines: number;
  soldOutMedicines: number;
  totalScans: number;
  suspiciousScans: number;
  recentAuditEvents: number;
}

interface AuditEntry {
  _id: string;
  action: string;
  user: string;
  timestamp: string;
  batchID?: string;
  details?: any;
}

interface SessionEntry {
  _id: string;
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  tokenId: string;
  ipAddress: string;
  userAgent: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPath: string;
  isActive: boolean;
}

const ROLE_OPTIONS: PlatformUser['role'][] = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'CUSTOMER', 'ADMIN'];
const ADMIN_SYNC_FALLBACK_INTERVAL_MS = 30000;

export function AdminManagementPanel({ getToken }: AdminManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'AUDIT' | 'SESSIONS'>('OVERVIEW');
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewWarning, setOverviewWarning] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | PlatformUser['role']>('ALL');
  const [sessionEmailFilter, setSessionEmailFilter] = useState('');
  const [sessionActiveOnly, setSessionActiveOnly] = useState(false);

  const loadUsers = async (sessionToken?: string) => {
    const token = sessionToken || (await getToken());
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const response = await adminAPI.listUsers(token);
    if (response?.success && Array.isArray(response.users)) {
      setUsers(response.users);
    } else {
      toast.error('Failed to load users');
    }
  };

  const loadOverview = async (sessionToken?: string) => {
    try {
      const token = sessionToken || (await getToken());
      if (!token) return;
      const response = await adminAPI.getOverview(token);
      if (response?.success && response.overview) {
        setOverview(response.overview);
        setOverviewWarning(null);
      } else {
        setOverviewWarning('Overview API returned no data. Showing fallback stats.');
      }
    } catch {
      setOverviewWarning('Overview API unavailable. Showing fallback stats from loaded users.');
    }
  };

  const loadAudit = async (sessionToken?: string) => {
    const token = sessionToken || (await getToken());
    if (!token) return;
    const response = await adminAPI.getAudit(token, 50);
    if (response?.success && Array.isArray(response.audit)) {
      setAudit(response.audit);
    }
  };

  const loadSessions = async (sessionToken?: string) => {
    const token = sessionToken || (await getToken());
    if (!token) return;
    const response = await adminAPI.getSessions(token, {
      limit: 100,
      email: sessionEmailFilter || undefined,
      activeOnly: sessionActiveOnly,
    });
    if (response?.success && Array.isArray(response.sessions)) {
      setSessions(response.sessions);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      await Promise.all([loadUsers(token), loadOverview(token), loadAudit(token), loadSessions(token)]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [getToken, sessionEmailFilter, sessionActiveOnly]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    let syncInFlight = false;

    const runSync = async () => {
      if (syncInFlight) return;
      syncInFlight = true;
      try {
        await loadAll();
      } finally {
        syncInFlight = false;
      }
    };

    const intervalId = window.setInterval(runSync, ADMIN_SYNC_FALLBACK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync();
      }
    };

    const handleWindowFocus = () => {
      runSync();
    };

    const handleRealtimeUpdate = () => {
      runSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('mediscan:realtime-update', handleRealtimeUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('mediscan:realtime-update', handleRealtimeUpdate);
    };
  }, [loadAll]);

  useEffect(() => {
    if (activeTab === 'SESSIONS') {
      loadSessions();
    }
  }, [activeTab, sessionEmailFilter, sessionActiveOnly]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users
      .filter((u) => roleFilter === 'ALL' || u.role === roleFilter)
      .filter((u) => {
        if (!term) return true;
        return (
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.companyName.toLowerCase().includes(term) ||
          u.role.toLowerCase().includes(term)
        );
      });
  }, [users, searchTerm, roleFilter]);

  const activeUsers = useMemo(() => filteredUsers.filter((u) => !u.banned), [filteredUsers]);
  const bannedUsers = useMemo(() => filteredUsers.filter((u) => Boolean(u.banned)), [filteredUsers]);

  const derivedOverview = useMemo<AdminOverview>(() => {
    const usersByRole = users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    return {
      totalUsers: users.length,
      bannedUsers: users.filter((u) => Boolean(u.banned)).length,
      usersByRole,
      totalMedicines: overview?.totalMedicines || 0,
      activeMedicines: overview?.activeMedicines || 0,
      blockedMedicines: overview?.blockedMedicines || 0,
      soldOutMedicines: overview?.soldOutMedicines || 0,
      totalScans: overview?.totalScans || 0,
      suspiciousScans: overview?.suspiciousScans || 0,
      recentAuditEvents: overview?.recentAuditEvents || 0,
    };
  }, [users, overview]);

  const lastBannedAtByEmail = useMemo(() => {
    const map: Record<string, string> = {};
    audit.forEach((event) => {
      if (event.action !== 'ADMIN_USER_BANNED') return;
      const targetEmail = String(event.details?.targetEmail || '').toLowerCase();
      if (!targetEmail) return;
      if (!map[targetEmail]) {
        map[targetEmail] = event.timestamp;
      }
    });
    return map;
  }, [audit]);

  const updateUserField = (userId: string, field: keyof PlatformUser, value: string) => {
    setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, [field]: value } : u)));
  };

  const saveUser = async (user: PlatformUser) => {
    setSavingUserId(user.userId);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await authAPI.adminUpdateUser(token, user.userId, {
        role: user.role,
        companyName: user.companyName,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      if (response?.success) {
        toast.success(`Updated ${user.email}`);
        await Promise.all([loadUsers(token), loadOverview(token)]);
      } else {
        toast.error('Failed to update user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setSavingUserId(null);
    }
  };

  const toggleUserStatus = async (user: PlatformUser) => {
    setStatusUpdatingUserId(user.userId);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const nextBanned = !Boolean(user.banned);
      const response = await adminAPI.updateUserStatus(token, user.userId, nextBanned);
      if (response?.success) {
        toast.success(nextBanned ? `Banned ${user.email}` : `Unbanned ${user.email}`);
        await Promise.all([loadUsers(token), loadOverview(token), loadAudit(token)]);
      } else {
        toast.error('Failed to update user status');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user status');
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Administration</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Admin can manage users, platform metrics, and audit activity</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
            {(['OVERVIEW', 'USERS', 'AUDIT', 'SESSIONS'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {overviewWarning && (
            <div className="sm:col-span-2 xl:col-span-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              {overviewWarning}
            </div>
          )}
          {[
            { label: 'Total Users', value: derivedOverview.totalUsers, icon: Users },
            { label: 'Banned Users', value: derivedOverview.bannedUsers, icon: Ban },
            { label: 'Total Medicines', value: derivedOverview.totalMedicines, icon: Shield },
            { label: 'Recent Audit Events (24h)', value: derivedOverview.recentAuditEvents, icon: Activity },
            { label: 'Active Medicines', value: derivedOverview.activeMedicines, icon: CheckCircle2 },
            { label: 'Blocked Medicines', value: derivedOverview.blockedMedicines, icon: Ban },
            { label: 'Total Scans', value: derivedOverview.totalScans, icon: Activity },
            { label: 'Suspicious Scans', value: derivedOverview.suspiciousScans, icon: Shield },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                  <card.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{card.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}

          <div className="sm:col-span-2 xl:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Users by Role</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(derivedOverview.usersByRole || {}).map(([role, count]) => (
                <div key={role} className="bg-gray-50 dark:bg-gray-900/40 rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{role}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name/email/company/role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'ALL' | PlatformUser['role'])}
              title="Filter by role"
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Active Users ({activeUsers.length})</h3>
          </div>

          <div className="overflow-x-auto border-b border-gray-100 dark:border-gray-700">
            <table className="w-full text-left text-sm min-w-[1160px]">
              <thead className="bg-gray-50/70 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">First Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Last Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Company Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {activeUsers.map((user) => {
                  const isSaving = savingUserId === user.userId;
                  const isStatusUpdating = statusUpdatingUserId === user.userId;
                  return (
                    <tr key={user.userId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{user.name || user.email}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          ACTIVE
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={user.firstName || ''}
                          onChange={(e) => updateUserField(user.userId, 'firstName', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="First name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={user.lastName || ''}
                          onChange={(e) => updateUserField(user.userId, 'lastName', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Last name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserField(user.userId, 'role', e.target.value)}
                          title="User role"
                          aria-label={`Role for ${user.email}`}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={user.companyName || ''}
                          onChange={(e) => updateUserField(user.userId, 'companyName', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Company name"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => toggleUserStatus(user)}
                            disabled={isStatusUpdating}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60 bg-rose-600 hover:bg-rose-700 text-white"
                          >
                            <Ban className="w-4 h-4" />
                            {isStatusUpdating ? 'Updating...' : 'Ban'}
                          </button>
                          <button
                            onClick={() => saveUser(user)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
                          >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {activeUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No active users match current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-rose-50/60 dark:bg-rose-900/10">
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Banned Users ({bannedUsers.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[1160px]">
              <thead className="bg-gray-50/70 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Recently Banned</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Company Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {bannedUsers.map((user) => {
                  const isStatusUpdating = statusUpdatingUserId === user.userId;
                  return (
                    <tr key={user.userId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{user.name || user.email}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">BANNED</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {lastBannedAtByEmail[user.email.toLowerCase()]
                          ? new Date(lastBannedAtByEmail[user.email.toLowerCase()]).toLocaleString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.role}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.companyName || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleUserStatus(user)}
                          disabled={isStatusUpdating}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isStatusUpdating ? 'Updating...' : 'Unban'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {bannedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No banned users.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'AUDIT' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Latest audit events</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[880px]">
              <thead className="bg-gray-50/70 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Time</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Action</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Actor</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Batch</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {audit.map((event) => (
                  <tr key={event._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(event.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {event.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{event.user || 'SYSTEM'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{event.batchID || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[360px] truncate" title={JSON.stringify(event.details || {})}>
                      {JSON.stringify(event.details || {})}
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">No audit events found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'SESSIONS' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
            <input
              type="text"
              value={sessionEmailFilter}
              onChange={(e) => setSessionEmailFilter(e.target.value)}
              placeholder="Filter by email"
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={sessionActiveOnly}
                onChange={(e) => setSessionActiveOnly(e.target.checked)}
                className="accent-emerald-600 dark:accent-emerald-500 dark:[color-scheme:dark]"
              />
              Active only
            </label>
            <button
              onClick={() => loadSessions()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Sessions
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[1100px]">
              <thead className="bg-gray-50/70 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">User</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">IP</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">First Seen</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Last Seen</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Last Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.map((session) => (
                  <tr key={session._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{session.email}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{session.sessionId || session.tokenId || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{session.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${session.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {session.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{session.ipAddress || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(session.firstSeenAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(session.lastSeenAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[280px] truncate" title={session.lastPath || ''}>{session.lastPath || '-'}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">No login sessions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
