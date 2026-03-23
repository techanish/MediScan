import { useMemo } from 'react';
import type { User, Medicine } from '../App';
import {
  TrendingUp, Package, AlertTriangle, ShoppingCart, DollarSign,
  Activity, Clock, CheckCircle2, XCircle, BarChart3, IndianRupee, Truck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsProps {
  user: User;
  medicines?: Medicine[];
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

function StatCard({ icon, label, value, sub, color = 'emerald' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${colorMap[color] ?? colorMap.emerald}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function Analytics({ user, medicines = [] }: AnalyticsProps) {
  const stats = useMemo(() => {
    const userEmail = user.email.toLowerCase();
    const now = new Date();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // --- Compute per-user available units using same logic as backend ---
    const myMedicines = medicines.filter(m => {
      let received = 0, out = 0, sold = 0;
      (m.ownerHistory || []).forEach(h => {
        if (h.action === 'REGISTERED' && h.owner?.toLowerCase() === userEmail) received += m.totalUnits || 0;
        if (h.action === 'TRANSFERRED' && h.owner?.toLowerCase() === userEmail) received += h.unitsPurchased || 0;
        if (h.action === 'TRANSFERRED' && h.from?.toLowerCase() === userEmail) out += h.unitsPurchased || 0;
        if (h.action === 'PURCHASED' && h.from?.toLowerCase() === userEmail) sold += h.unitsPurchased || 0;
      });
      return (received - out - sold) > 0;
    });

    const totalBatches = myMedicines.length;
    const activeBatches = myMedicines.filter(m => m.status === 'ACTIVE').length;
    const lowStock = myMedicines.filter(m => m.status === 'LOW_STOCK').length;
    const expired = myMedicines.filter(m => m.status === 'EXPIRED').length;
    const totalUnits = myMedicines.reduce((s, m) => s + (m.remainingUnits || 0), 0);
    const totalValue = myMedicines.reduce((s, m) => s + ((m.remainingUnits || 0) * (m.price || 0)), 0);

    const expiringSoon = myMedicines.filter(m => {
      if (!m.expDate || m.status === 'EXPIRED') return false;
      const exp = new Date(m.expDate);
      return exp >= now && exp <= in30d;
    }).length;

    // Transfers made BY this user
    const transfersMade = medicines.reduce((count, m) => {
      return count + (m.ownerHistory || []).filter(h =>
        h.action === 'TRANSFERRED' && h.from?.toLowerCase() === userEmail
      ).length;
    }, 0);

    // Sales made BY this user
    const salesMade = medicines.reduce((count, m) => {
      return count + (m.ownerHistory || []).filter(h =>
        h.action === 'PURCHASED' && h.from?.toLowerCase() === userEmail
      ).length;
    }, 0);

    // Category breakdown
    const catMap: Record<string, number> = {};
    myMedicines.forEach(m => {
      const cat = m.category || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    // Stock status breakdown
    const statusData = [
      { name: 'Active', value: activeBatches },
      { name: 'Low Stock', value: lowStock },
      { name: 'Expired', value: expired },
      { name: 'Other', value: totalBatches - activeBatches - lowStock - expired },
    ].filter(d => d.value > 0);

    // Monthly activity from ownerHistory (last 6 months)
    const monthlyMap: Record<string, { transfers: number; sales: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short' });
      monthlyMap[key] = { transfers: 0, sales: 0 };
    }
    medicines.forEach(m => {
      (m.ownerHistory || []).forEach(h => {
        const date = new Date((h.date || h.time || '') as string);
        if (isNaN(date.getTime())) return;
        const key = date.toLocaleString('default', { month: 'short' });
        if (!monthlyMap[key]) return;
        if (h.action === 'TRANSFERRED' && h.from?.toLowerCase() === userEmail) monthlyMap[key].transfers++;
        if (h.action === 'PURCHASED' && h.from?.toLowerCase() === userEmail) monthlyMap[key].sales++;
      });
    });
    const activityData = Object.entries(monthlyMap).map(([month, v]) => ({ month, ...v }));

    return { totalBatches, activeBatches, lowStock, expired, totalUnits, totalValue, expiringSoon, transfersMade, salesMade, categoryData, statusData, activityData };
  }, [medicines, user.email]);

  const isManufacturer = user.role === 'MANUFACTURER';
  const isDistributor = user.role === 'DISTRIBUTOR';
  const isPharmacy = user.role === 'PHARMACY';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          {isManufacturer ? 'Manufacturing Analytics' : isDistributor ? 'Distribution Analytics' : isPharmacy ? 'Pharmacy Analytics' : 'Analytics'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Live stats computed from your inventory data</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Package className="w-5 h-5" />} label="Total Batches" value={stats.totalBatches} color="blue" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Active Batches" value={stats.activeBatches} color="emerald" />
        <StatCard icon={<Activity className="w-5 h-5" />} label="Total Units" value={stats.totalUnits.toLocaleString()} color="indigo" />
        <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Portfolio Value" value={`₹${stats.totalValue.toLocaleString()}`} color="emerald"
          sub={stats.totalValue === 0 ? 'Set prices when registering' : undefined} />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Low Stock" value={stats.lowStock} color="amber" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="Expired" value={stats.expired} color="red" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Expiring Soon" value={stats.expiringSoon} sub="Next 30 days" color="amber" />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Transfers Made" value={stats.transfersMade} color="purple" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Monthly Activity
          </h3>
          <p className="text-xs text-slate-400 mb-5">Transfers &amp; Sales over last 6 months</p>
          {stats.activityData.some(d => d.transfers > 0 || d.sales > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.activityData} barGap={4}>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="transfers" name="Transfers" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 dark:text-slate-500 flex-col gap-2">
              <BarChart3 className="w-10 h-10 opacity-30" />
              <p className="text-sm">No activity data yet</p>
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" /> By Category
          </h3>
          <p className="text-xs text-slate-400 mb-5">Batch distribution across categories</p>
          {stats.categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {stats.categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 flex-col gap-2">
              <Package className="w-10 h-10 opacity-30" />
              <p className="text-sm">No medicines yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Role-specific extras: Sales stat for PHARMACY */}
      {(isPharmacy || isDistributor) && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-500" /> Sales Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Total Sales" value={stats.salesMade} color="emerald" />
            <StatCard icon={<DollarSign className="w-5 h-5" />} label="Est. Revenue" value={`₹${stats.totalValue.toLocaleString()}`} color="emerald" />
            <StatCard icon={<Package className="w-5 h-5" />} label="Stock Available" value={stats.totalUnits.toLocaleString()} color="blue" />
            <StatCard icon={<Activity className="w-5 h-5" />} label="Active Batches" value={stats.activeBatches} color="indigo" />
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {stats.statusData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Inventory Health</h3>
          <div className="space-y-3">
            {stats.statusData.map((s, i) => {
              const pct = stats.totalBatches > 0 ? Math.round((s.value / stats.totalBatches) * 100) : 0;
              const barColor = ['bg-emerald-500', 'bg-amber-400', 'bg-red-500', 'bg-gray-400'][i] || 'bg-gray-300';
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-slate-600 dark:text-slate-400 shrink-0">{s.name}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">{s.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
