import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Truck,
  ShoppingCart,
  QrCode,
  ShieldCheck,
  Settings,
  Bell,
  MessageSquare,
  X,
  Users,
  Cpu,
  BarChart3,
  HeartPulse,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../App';
import { UserButton } from '@clerk/clerk-react';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

export function Sidebar({ user, activeTab, setActiveTab, isOpen, setIsOpen, onLogout: _onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'customer', label: 'Customer Panel', icon: HeartPulse, roles: ['CUSTOMER'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ALL'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['ALL'] },
    { id: 'register', label: 'Register Medicine', icon: PlusCircle, roles: ['MANUFACTURER'] },
    { id: 'transfer', label: 'Transfer Stock', icon: Truck, roles: ['MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY'] },
    { id: 'sales', label: 'Process Sale', icon: ShoppingCart, roles: ['PHARMACY', 'DISTRIBUTOR'] },
    { id: 'qrcode', label: 'QR Generator', icon: QrCode, roles: ['ALL'] },
    { id: 'verify', label: 'Verify Medicine', icon: ShieldCheck, roles: ['ALL'] },
    { id: 'blockchain', label: 'Blockchain Explorer', icon: Cpu, roles: ['ALL'] },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['ALL'] },
    { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['ALL'] },
    { id: 'tickets', label: 'Tickets', icon: MessageSquare, roles: ['ALL'] },
    { id: 'admin', label: 'Administration', icon: Users, roles: ['ADMIN'] },
    { id: 'profile', label: 'Profile', icon: Settings, roles: ['ALL'] },
  ];

  const filteredItems = user.role === 'ADMIN'
    ? menuItems.filter((item) => item.id === 'admin' || item.id === 'tickets')
    : user.role === 'CUSTOMER'
      ? menuItems.filter((item) => ['customer', 'notifications', 'tickets', 'profile'].includes(item.id))
      : menuItems.filter(item =>
          item.roles.includes('ALL') || item.roles.includes(user.role)
        );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 shadow-xl lg:shadow-none flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">MediScan</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">VERIFICATION SYSTEM</p>
          </div>
          <button onClick={() => setIsOpen(false)} title="Close sidebar" aria-label="Close sidebar" className="ml-auto lg:hidden p-2 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2 mt-4">
            Menu
          </div>
          {filteredItems.map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25, ease: 'easeOut' }}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                activeTab === item.id
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${
                activeTab === item.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
              }`} />
              {item.label}
            </motion.button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0">
                <UserButton afterSignOutUrl="/" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
