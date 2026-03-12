import { useState } from 'react';
import { Shield, Search, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Medicine } from '../App';

interface AdminPanelProps {
  medicines: Medicine[];
}

const MOCK_USERS = [
  { name: "Alex Pharma", email: "alex@pharmacorp.com", role: "MANUFACTURER", companyName: "PharmaCorp Inc." },
  { name: "City Distributors", email: "supply@citydist.com", role: "DISTRIBUTOR", companyName: "City Supply Co." },
  { name: "MediCare Pharmacy", email: "pharmacy@medicare.com", role: "PHARMACY", companyName: "MediCare Ltd." },
  { name: "John Doe", email: "john@example.com", role: "CUSTOMER", companyName: '' },
  { name: "System Admin", email: "admin@mediscan.com", role: "ADMIN", companyName: '' },
];

const MOCK_LOGS = [
  { id: 1, action: "LOGIN", user: "alex@pharmacorp.com", ip: "192.168.1.1", time: "2 mins ago", status: "SUCCESS" },
  { id: 2, action: "TRANSFER", user: "alex@pharmacorp.com", ip: "192.168.1.1", time: "15 mins ago", status: "SUCCESS" },
  { id: 3, action: "LOGIN_FAILED", user: "unknown@hacker.com", ip: "10.0.0.55", time: "1 hour ago", status: "FAILED" },
  { id: 4, action: "VERIFY_BATCH", user: "john@example.com", ip: "172.16.0.1", time: "2 hours ago", status: "SUCCESS" },
  { id: 5, action: "REGISTER_BATCH", user: "alex@pharmacorp.com", ip: "192.168.1.1", time: "5 hours ago", status: "SUCCESS" },
];

export function AdminPanel({ medicines: _medicines }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'USERS' | 'LOGS' | 'SETTINGS'>('USERS');
  const [users] = useState(MOCK_USERS);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBlockUser = (email: string) => {
    toast.success(`User ${email} has been blocked.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Administration</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">System oversight and user management</p>
        </div>
        <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
          {(['USERS', 'LOGS', 'SETTINGS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'USERS' ? 'Users' : tab === 'LOGS' ? 'Audit Logs' : 'Settings'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'USERS' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">User</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredUsers.map((user, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {user.companyName || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleBlockUser(user.email)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'LOGS' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white">System Activity Log</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Action</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">User</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">IP Address</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Time</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {MOCK_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-gray-600 dark:text-gray-300">{log.action}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{log.user}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{log.ip}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{log.time}</td>
                  <td className="px-6 py-4">
                    {log.status === 'SUCCESS' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-xs font-bold">
                        <CheckCircle className="w-3 h-3" /> Success
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs font-bold">
                        <Ban className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 text-center text-gray-400 dark:text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Global system settings would go here.</p>
        </div>
      )}
    </div>
  );
}
