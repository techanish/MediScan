import { useState } from 'react';
import { Building2, Save, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { authAPI } from '../utils/api';

interface ProfileProps {
  user: {
    name: string;
    email: string;
    role: string;
    companyName?: string;
  };
  onUpdate: () => void;
  getToken: () => Promise<string | null>;
}

export function Profile({ user, onUpdate, getToken }: ProfileProps) {
  const [companyName, setCompanyName] = useState(user.companyName || '');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const token = await getToken();
      if (!token) {
        setMessage({ type: 'error', text: 'Authentication failed' });
        setIsLoading(false);
        return;
      }

      const response = await authAPI.updateProfile(token, { companyName: companyName.trim() });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully! Company name can only be changed once.' });
        // Reload the user to get updated data
        setTimeout(() => {
          onUpdate();
          window.location.reload();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: response.error || 'Update failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Update failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          Profile Settings
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 ml-13">Manage your account information</p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-lg">Account Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</label>
            <p className="font-medium text-slate-900 dark:text-slate-200 text-lg">{user.name}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
            <p className="font-medium text-slate-900 dark:text-slate-200 text-lg">{user.email}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</label>
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {user.role !== 'CUSTOMER' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="pb-2">
            <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Company Information</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">This information is displayed on medicine certificates</p>
          </div>
          
          {message && (
            <div
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                  : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Company Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Pharma Industries Ltd"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                required
                disabled={!!user.companyName}
              />
            </div>
            {user.companyName ? (
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Company name can only be changed once. Contact administrator to update.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                This name will be displayed when transferring medicines. Can only be set once.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !companyName.trim() || !!user.companyName}
            className="mt-4 w-full py-3 bg-gradle-to-r bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : user.companyName ? (
              <>
                <AlertCircle className="w-5 h-5" />
                Already Set
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </form>
      )}

      {user.role === 'CUSTOMER' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-emerald-700">
            Customers don't need to set a company name
          </p>
        </div>
      )}
    </div>
  );
}
