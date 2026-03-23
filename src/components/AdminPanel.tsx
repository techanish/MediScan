import { useEffect, useMemo, useState } from 'react';
import { Search, Save, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { adminAPI, authAPI } from '../utils/api';

interface AdminPanelProps {
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
}

const ROLE_OPTIONS: PlatformUser['role'][] = ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY', 'CUSTOMER', 'ADMIN'];

export function AdminPanel({ getToken }: AdminPanelProps) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = await getToken();
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
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.companyName.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

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
      } else {
        toast.error('Failed to update user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setSavingUserId(null);
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
          <p className="text-gray-500 dark:text-gray-400 text-sm">Admin can manage all platform users, roles, and company names</p>
        </div>
        <button
          onClick={loadUsers}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name/email/company/role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[980px]">
            <thead className="bg-gray-50/70 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">User</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">First Name</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Last Name</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400">Company Name</th>
                <th className="px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUsers.map((user) => {
                const isSaving = savingUserId === user.userId;
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
                      <button
                        onClick={() => saveUser(user)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
