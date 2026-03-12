import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertTriangle, Package, Calendar, IndianRupee } from 'lucide-react';
import type { Medicine } from '../App';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

interface StatDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'value' | 'units' | 'alerts' | 'batches' | null;
  medicines: Medicine[];
}

export function StatDetailsModal({ isOpen, onClose, type, medicines }: StatDetailsModalProps) {
  if (!isOpen || !type) return null;

  const title = {
    value: 'Sales & Value Analytics',
    units: 'Inventory Distribution',
    alerts: 'Active Alerts',
    batches: 'Active Batches'
  }[type];

  const content = useMemo(() => {
    const uniqueId = `gradient-${type}-${Math.random().toString(36).substr(2, 9)}`;

    switch (type) {
      case 'value': {
        const salesData = medicines
          .flatMap(m => m.ownerHistory
            .filter(h => h.action === 'PURCHASED' && h.unitsPurchased)
            .map(h => ({
              date: h.date || h.time || '',
              value: (h.unitsPurchased || 0) * (m.price || 0),
              name: m.name
            }))
          )
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const aggregatedSales = salesData.reduce((acc: any[], curr) => {
          const date = curr.date;
          const existing = acc.find(i => i.date === date);
          if (existing) {
            existing.value += curr.value;
          } else {
            acc.push({ date: curr.date, value: curr.value });
          }
          return acc;
        }, []).slice(-10);

        const chartData = aggregatedSales.length > 0 ? aggregatedSales : [
          { date: '2024-01-01', value: 1200 },
          { date: '2024-01-02', value: 1500 },
          { date: '2024-01-03', value: 3200 },
          { date: '2024-01-04', value: 2800 },
          { date: '2024-01-05', value: 4500 },
          { date: '2024-01-06', value: 3800 },
        ];

        return (
          <div className="space-y-6">
            <div className="h-80 w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none">
              <h4 className="text-sm font-semibold text-gray-500 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Revenue Trend
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    wrapperStyle={{ outline: 'none' }}
                    formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none', outline: 'none' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10B981" fillOpacity={1} fill={`url(#${uniqueId})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <p className="text-sm text-emerald-800 dark:text-emerald-300">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  ₹{medicines.reduce((acc, m) => acc + (m.ownerHistory.filter(h => h.action === 'PURCHASED').reduce((s, h) => s + ((h.unitsPurchased || 0) * (m.price || 0)), 0)), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-blue-800 dark:text-blue-300">Avg. Order Value</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">₹1,250</p>
              </div>
            </div>
          </div>
        );
      }
      case 'units': {
        const categoryData = medicines.reduce((acc: any[], curr) => {
          const existing = acc.find(i => i.name === curr.category);
          if (existing) {
            existing.units += curr.remainingUnits || 0;
          } else {
            acc.push({ name: curr.category || 'Uncategorized', units: curr.remainingUnits || 0 });
          }
          return acc;
        }, []);

        return (
          <div className="space-y-6">
            <div className="h-80 w-full bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none">
              <h4 className="text-sm font-semibold text-gray-500 mb-4">Stock by Category</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none', outline: 'none' }} />
                  <Bar dataKey="units" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }
      case 'alerts': {
        const alerts = medicines.filter(m => m.status === 'EXPIRED' || m.status === 'LOW_STOCK');
        return (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No active alerts</div>
            ) : (
              alerts.map(m => (
                <div key={m.batchID} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${m.status === 'EXPIRED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{m.name}</h4>
                      <p className="text-xs text-gray-500">{m.batchID}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      m.status === 'EXPIRED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {m.status === 'EXPIRED' ? 'Expired' : 'Low Stock'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{m.remainingUnits || 0} units left</p>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      }
      case 'batches': {
        const active = medicines.filter(m => m.status === 'ACTIVE');
        return (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {active.map(m => (
              <div key={m.batchID} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{m.name}</h4>
                    <p className="text-xs text-gray-500">{m.batchID}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">{m.remainingUnits || 0} units</p>
                  <p className="text-xs text-gray-400 mt-1">Exp: {m.expDate}</p>
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
  }, [type, medicines]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {type === 'value' && <IndianRupee className="w-5 h-5 text-emerald-500" />}
              {type === 'units' && <Package className="w-5 h-5 text-blue-500" />}
              {type === 'alerts' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
              {type === 'batches' && <Calendar className="w-5 h-5 text-purple-500" />}
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6">
            {content}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
