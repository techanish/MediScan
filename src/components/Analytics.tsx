import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  DollarSign,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
} from 'lucide-react';
import type { User } from '../App';

interface AnalyticsProps {
  user: User;
}

interface DashboardStats {
  role?: string;
  totalMedicines?: number;
  activeBatches?: number;
  blockedBatches?: number;
  totalScans?: number;
  genuineScans?: number;
  fakeScans?: number;
  expiringSoon?: number;
  recentScans?: any[];
  // Non-admin stats
  totalBatches?: number;
  totalUnits?: number;
  totalValue?: string;
  lowStock?: number;
  transfersMade?: number;
  // Customer stats
  totalPurchases?: number;
  totalUnitsPurchased?: number;
  totalSpent?: string;
  uniqueMedicines?: number;
}

export function Analytics({ user }: AnalyticsProps) {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/analytics/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-700 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Loading Analytics...</h3>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No Analytics Data</h3>
      </div>
    );
  }

  // Admin view
  if (user.role === 'ADMIN') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            System Analytics
          </h2>
          <p className="text-slate-500 dark:text-slate-400">Complete overview of the MediScan system</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Package className="w-6 h-6" />}
            label="Total Medicines"
            value={stats.totalMedicines || 0}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            label="Active Batches"
            value={stats.activeBatches || 0}
            color="green"
          />
          <StatCard
            icon={<XCircle className="w-6 h-6" />}
            label="Blocked Batches"
            value={stats.blockedBatches || 0}
            color="red"
          />
          <StatCard
            icon={<AlertTriangle className="w-6 h-6" />}
            label="Expiring Soon"
            value={stats.expiringSoon || 0}
            color="amber"
          />
          <StatCard
            icon={<Activity className="w-6 h-6" />}
            label="Total Scans"
            value={stats.totalScans || 0}
            color="purple"
          />
          <StatCard
            icon={<CheckCircle2 className="w-6 h-6" />}
            label="Genuine Scans"
            value={stats.genuineScans || 0}
            color="emerald"
          />
          <StatCard
            icon={<XCircle className="w-6 h-6" />}
            label="Fake Detections"
            value={stats.fakeScans || 0}
            color="rose"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Success Rate"
            value={`${stats.totalScans ? Math.round(((stats.genuineScans || 0) / stats.totalScans) * 100) : 0}%`}
            color="indigo"
          />
        </div>
      </div>
    );
  }

  // Customer view
  if (user.role === 'CUSTOMER') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
            <ShoppingCart className="w-7 h-7 text-emerald-500" />
            Purchase Analytics
          </h2>
          <p className="text-slate-500 dark:text-slate-400">Your medicine purchase history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Package className="w-6 h-6" />}
            label="Total Purchases"
            value={stats.totalPurchases || 0}
            color="blue"
          />
          <StatCard
            icon={<ShoppingCart className="w-6 h-6" />}
            label="Units Purchased"
            value={stats.totalUnitsPurchased || 0}
            color="green"
          />
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            label="Total Spent"
            value={`$${stats.totalSpent || '0.00'}`}
            color="emerald"
          />
          <StatCard
            icon={<Package className="w-6 h-6" />}
            label="Unique Medicines"
            value={stats.uniqueMedicines || 0}
            color="purple"
          />
        </div>
      </div>
    );
  }

  // Manufacturer/Distributor/Pharmacy view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
          <Activity className="w-7 h-7 text-emerald-500" />
          Inventory Analytics
        </h2>
        <p className="text-slate-500 dark:text-slate-400">Your medicine inventory overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="w-6 h-6" />}
          label="Total Batches"
          value={stats.totalBatches || 0}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Active Batches"
          value={stats.activeBatches || 0}
          color="green"
        />
        <StatCard
          icon={<Package className="w-6 h-6" />}
          label="Total Units"
          value={stats.totalUnits || 0}
          color="purple"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Total Value"
          value={`$${stats.totalValue || '0.00'}`}
          color="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Low Stock"
          value={stats.lowStock || 0}
          color="amber"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Expiring Soon"
          value={stats.expiringSoon || 0}
          color="red"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Transfers Made"
          value={stats.transfersMade || 0}
          color="indigo"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Stock Health"
          value={`${stats.lowStock === 0 ? '100' : Math.max(0, 100 - ((stats.lowStock || 0) / (stats.totalBatches || 1)) * 100).toFixed(0)}%`}
          color="cyan"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'emerald' | 'rose' | 'indigo' | 'cyan';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorStyles = {
    blue: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    indigo: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{label}</p>
    </div>
  );
}
