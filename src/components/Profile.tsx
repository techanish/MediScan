import React, { useState } from 'react';
import type { User } from '../App';
import { User as UserIcon, Building, Mail, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileProps {
  user: User;
  onUpdate: (data: Partial<User>) => Promise<void> | void;
}

export function Profile({ user, onUpdate }: ProfileProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    companyName: user.companyName || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const isCompanyNameLocked = user.role !== 'ADMIN' && !!user.hasCompanyNameSet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompanyNameLocked) {
      toast.info('Company name is locked. Please contact an admin for changes.');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(formData);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile and company details</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-emerald-600 to-teal-600 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg">
              <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <UserIcon className="w-10 h-10" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-16 pb-8 px-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="profile-name" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input id="profile-name" type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100" />
                </div>
              </div>

              <div>
                <label htmlFor="profile-company-name" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Company Name</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    id="profile-company-name"
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    disabled={isCompanyNameLocked}
                    className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-gray-900 dark:text-gray-100 ${
                      isCompanyNameLocked
                        ? 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                </div>
                {isCompanyNameLocked && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Company name can only be set once. Only admins can update it now.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="profile-email" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input id="profile-email" type="email" value={user.email} disabled
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                </div>
              </div>

              <div>
                <label htmlFor="profile-role" className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input id="profile-role" type="text" value={user.role} disabled
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button type="submit" disabled={isSaving || isCompanyNameLocked}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
