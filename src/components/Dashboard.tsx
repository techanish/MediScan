import React from 'react';
import type { Medicine, User } from '../App';
import { StatDetailsModal } from './StatDetailsModal';
import { Package, Truck, AlertTriangle, TrendingUp, Activity, CheckCircle, ShieldCheck, IndianRupee, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface DashboardProps {
  medicines: Medicine[];
  user: User;
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: 'easeOut' as const },
});

export function Dashboard({ medicines, user }: DashboardProps) {
  const [selectedStat, setSelectedStat] = React.useState<'value' | 'units' | 'alerts' | 'batches' | null>(null);

  const activeBatches = medicines.filter(m => m.status === 'ACTIVE' || m.status === 'LOW_STOCK').length;
  const totalUnits = medicines.reduce((acc, m) => acc + (m.remainingUnits || 0), 0);
  const totalValue = medicines.reduce((acc, m) => acc + ((m.remainingUnits || 0) * (m.price || 0)), 0);
  const expiredCount = medicines.filter(m => m.status === 'EXPIRED').length;
  const lowStockCount = medicines.filter(m => m.status === 'LOW_STOCK').length;

  const recentActivity = medicines
    .flatMap(m => m.ownerHistory.map(h => ({ ...h, medicineName: m.name, batchID: m.batchID })))
    .sort((a, b) => new Date(b.date || b.time || '').getTime() - new Date(a.date || a.time || '').getTime())
    .slice(0, 5);

  const categoryData = medicines.reduce((acc: any[], curr) => {
    const cat = curr.category || 'Other';
    const existing = acc.find(i => i.name === cat);
    if (existing) { existing.value += 1; }
    else { acc.push({ name: cat, value: 1 }); }
    return acc;
  }, []);

  const stockData = medicines
    .filter(m => m.status === 'ACTIVE' || m.status === 'LOW_STOCK')
    .slice(0, 5)
    .map(m => ({
      name: m.name.split(' ')[0],
      remaining: m.remainingUnits || 0,
      total: m.totalUnits
    }));

  const stats = [
    { id: 'value', label: 'Total Value', value: `₹${totalValue.toLocaleString()}`, sub: 'Estimated Asset Value', icon: IndianRupee, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
    { id: 'units', label: 'Total Units', value: totalUnits.toLocaleString(), sub: 'Available Stock', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
    { id: 'alerts', label: 'Alerts', value: expiredCount + lowStockCount, sub: `${lowStockCount} Low, ${expiredCount} Expired`, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20' },
    { id: 'batches', label: 'Active Batches', value: activeBatches, sub: 'In Circulation', icon: Package, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/20' },
  ];

  const healthItems = [
    { icon: CheckCircle, label: 'System Operational', sub: 'All services running normally', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-900/30', iconColor: 'text-green-600 dark:text-green-400', textColor: 'text-green-900 dark:text-green-300', subColor: 'text-green-700 dark:text-green-400', show: true },
    { icon: AlertTriangle, label: 'Low Stock Warning', sub: `${lowStockCount} batches below threshold`, bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', textColor: 'text-amber-900 dark:text-amber-300', subColor: 'text-amber-700 dark:text-amber-400', show: lowStockCount > 0 },
    { icon: ShieldCheck, label: 'Verification Active', sub: 'Real-time tracking enabled', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', textColor: 'text-blue-900 dark:text-blue-300', subColor: 'text-blue-700 dark:text-blue-400', show: true },
  ].filter(h => h.show);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div {...fadeUp(0)} className="bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-800 dark:to-teal-900 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200/50 dark:shadow-emerald-900/50">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold mb-2">Welcome back, {user.name}!</h2>
          <p className="text-emerald-100 text-lg opacity-90">
            Overview of your pharmaceutical inventory. You have {activeBatches} active batches and value of ₹{totalValue.toLocaleString()}.
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.97 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.35, ease: 'easeOut' }}
            onClick={() => setSelectedStat(stat.id as any)}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              {/* Icon with spring bounce + hover */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                whileHover={{ scale: 1.15, rotate: 8, transition: { type: 'spring', stiffness: 400, damping: 12 } }}
                transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 400, damping: 15 }}
                className={`p-3 rounded-xl ${stat.bg} cursor-pointer`}
              >
                {stat.id === 'alerts' && (expiredCount + lowStockCount) > 0 ? (
                  <motion.span
                    animate={{ rotate: [-5, 5, -5, 5, 0] }}
                    transition={{ delay: 1.2, duration: 0.45, repeat: Infinity, repeatDelay: 3 }}
                    className="inline-block"
                  >
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </motion.span>
                ) : stat.id === 'value' ? (
                  <motion.span
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ delay: 1.5, duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-block"
                  >
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </motion.span>
                ) : (
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                )}
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full"
              >
                <TrendingUp className="w-3 h-3" /> +2.5%
              </motion.span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <StatDetailsModal
        isOpen={!!selectedStat}
        onClose={() => setSelectedStat(null)}
        type={selectedStat}
        medicines={medicines}
      />

      {/* Analytics Charts Row */}
      <motion.div {...fadeUp(0.45)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 350, damping: 14 }}
              className="inline-flex"
            >
              <PieChartIcon className="w-5 h-5 text-emerald-500" />
            </motion.span>
            Inventory by Category
          </h3>
          <div className="h-64 w-full min-w-0 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {categoryData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6', outline: 'none' }} itemStyle={{ color: '#f3f4f6' }} cursor={{ fill: 'transparent' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <motion.span
              initial={{ scale: 0, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.55, type: 'spring', stiffness: 350, damping: 14 }}
              className="inline-flex"
            >
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </motion.span>
            Stock Utilization (Top Batches)
          </h3>
          <div className="h-64 w-full min-w-0 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: '#374151', opacity: 0.1 }} wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6', outline: 'none' }} itemStyle={{ color: '#f3f4f6' }} />
                <Legend />
                <Bar dataKey="remaining" name="Remaining" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total Capacity" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeUp(0.55)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <motion.span
              initial={{ scale: 0, rotate: 90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 350, damping: 14 }}
              className="inline-flex"
            >
              <Activity className="w-5 h-5 text-purple-500" />
            </motion.span>
            Recent Activity
          </h3>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((activity, idx) => (
                <motion.div
                  key={`${activity.batchID}-${idx}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + idx * 0.07, duration: 0.3, ease: 'easeOut' }}
                  className="flex items-start gap-4"
                >
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.65 + idx * 0.07, type: 'spring', stiffness: 350, damping: 18 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-sm z-10 relative ${
                        activity.action === 'REGISTERED' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                        activity.action === 'TRANSFERRED' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {activity.action === 'TRANSFERRED' ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    </motion.div>
                    {idx !== recentActivity.length - 1 && (
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-full bg-gray-100 dark:bg-gray-700 -z-0" />
                    )}
                  </div>
                  <div className="flex-1 py-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{activity.medicineName}</p>
                      <span className="text-xs text-gray-400">{activity.date || activity.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{activity.action}</span> • {activity.batchID}
                      {activity.unitsPurchased ? ` • ${activity.unitsPurchased} units` : ''}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">By: {activity.owner} ({activity.role})</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">System Health</h3>
          <div className="space-y-4">
            {healthItems.map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65 + idx * 0.1, duration: 0.3, ease: 'easeOut' }}
                className={`p-4 rounded-xl ${item.bg} border ${item.border} flex items-center gap-3`}
              >
                <motion.div
                  initial={{ scale: 0, rotate: 15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.72 + idx * 0.1, type: 'spring', stiffness: 400, damping: 14 }}
                >
                  <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                </motion.div>
                <div>
                  <p className={`text-sm font-bold ${item.textColor}`}>{item.label}</p>
                  <p className={`text-xs ${item.subColor}`}>{item.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
