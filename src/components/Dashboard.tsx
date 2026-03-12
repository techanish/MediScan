import { useState } from 'react';
import { useClerk, useAuth } from '@clerk/clerk-react';
import {
  Shield,
  LogOut,
  Package,
  QrCode,
  ArrowRightLeft,
  CheckCircle2,
  User,
  Menu,
  X,
  Pill,
  ShoppingCart,
  BarChart3,
  Bell,
  Moon,
  Sun,
  Link2,
  RefreshCw,
} from 'lucide-react';
import type { User as UserType, Medicine } from '../App';
import { RegisterMedicine } from './RegisterMedicine';
import { TransferOwnership } from './TransferOwnership';
import { GenerateQR } from './GenerateQR';
import { VerifyMedicine } from './VerifyMedicine';
import { MedicineList } from './MedicineList';
import { PurchaseMedicine } from './PurchaseMedicine';
import { Profile } from './Profile';
import { Analytics } from './Analytics';
import { Notifications } from './Notifications';
import { BlockchainViewer } from './BlockchainViewer';
import { useTheme } from '../utils/ThemeContext';

interface DashboardProps {
  user: UserType;
  medicines: Medicine[];
  isLoadingMedicines?: boolean;
  onLogout: () => void;
  onRegisterMedicine: (
    medicine: Omit<Medicine, 'currentOwner' | 'currentOwnerRole' | 'ownerHistory' | 'verified'>
  ) => Promise<{ success: boolean; error?: string }>;
  onTransfer: (batchID: string, newOwnerEmail: string, newOwnerRole: string, unitsToTransfer: number) => Promise<{ success: boolean; error?: string }>;
  onPurchase: (batchID: string, unitsPurchased: number, customerEmail: string) => Promise<{ success: boolean; error?: string }>;
  onVerify: (batchID: string) => Promise<{ verified: boolean; medicine?: Medicine; error?: string }>;
  getMedicineByBatch: (batchID: string) => Medicine | undefined;
  onRefreshMedicines: () => Promise<void>;
}

type Tab = 'overview' | 'analytics' | 'register' | 'transfer' | 'purchase' | 'qrcode' | 'verify' | 'notifications' | 'profile' | 'blockchain';

const roleBadgeStyles: Record<string, string> = {
  MANUFACTURER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  DISTRIBUTOR: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  PHARMACY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CUSTOMER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function Dashboard({
  user,
  medicines,
  isLoadingMedicines,
  onLogout,
  onRegisterMedicine,
  onTransfer,
  onPurchase,
  onVerify,
  getMedicineByBatch,
  onRefreshMedicines,
}: DashboardProps) {
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshMedicines();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: Package, show: true },
    { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3, show: true },
    { id: 'register' as Tab, label: 'Register Medicine', icon: Pill, show: user.role === 'MANUFACTURER' },
    { id: 'transfer' as Tab, label: 'Transfer', icon: ArrowRightLeft, show: user.role !== 'CUSTOMER' },
    { id: 'purchase' as Tab, label: 'Process Sale', icon: ShoppingCart, show: user.role === 'PHARMACY' || user.role === 'DISTRIBUTOR' },
    { id: 'qrcode' as Tab, label: 'QR Code', icon: QrCode, show: true },
    { id: 'verify' as Tab, label: 'Verify', icon: CheckCircle2, show: true },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell, show: true },
    { id: 'blockchain' as Tab, label: 'Blockchain', icon: Link2, show: true },
    { id: 'profile' as Tab, label: 'Profile', icon: User, show: true },
  ].filter((tab) => tab.show);

  const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-800 dark:text-white">MediScan</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSidebarOpen(false);
                if (tab.id === 'overview') handleRefresh();
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}
              `}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${roleBadgeStyles[user.role]}`}>
                {user.role}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-white capitalize">
              {activeTabLabel}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {activeTab === 'overview' && (
               <button
                 onClick={handleRefresh}
                 disabled={isRefreshing}
                 className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                 title="Refresh medicines"
               >
                 <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
               </button>
             )}
             <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Welcome Banner (Only on Overview) */}
            {activeTab === 'overview' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Welcome back, {user.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                      Here's what's happening with your medicines today.
                    </p>
                  </div>
                  <div className="flex gap-4">
                     <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <span className="block text-2xl font-bold text-emerald-600 dark:text-emerald-400">{medicines.length}</span>
                        <span className="text-sm text-emerald-600/80 dark:text-emerald-400/80 font-medium">Total Medicines</span>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Render */}
            <div className="animate-fade-in">
              {activeTab === 'overview' && (
                <MedicineList medicines={medicines} userRole={user.role} userEmail={user.email} isLoading={isLoadingMedicines} />
              )}
              {activeTab === 'analytics' && (
                <Analytics user={user} />
              )}
              {activeTab === 'register' && user.role === 'MANUFACTURER' && (
                <RegisterMedicine onRegister={onRegisterMedicine} />
              )}
              {activeTab === 'transfer' && (
                <TransferOwnership
                  medicines={medicines}
                  getToken={getToken}
                  onTransfer={onTransfer}
                  userEmail={user.email}
                />
              )}
              {activeTab === 'purchase' && (user.role === 'PHARMACY' || user.role === 'DISTRIBUTOR') && (
                <PurchaseMedicine
                  medicines={medicines}
                  onPurchase={onPurchase}
                  userEmail={user.email}
                />
              )}
              {activeTab === 'qrcode' && (
                <GenerateQR getMedicineByBatch={getMedicineByBatch} />
              )}
              {activeTab === 'verify' && <VerifyMedicine onVerify={onVerify} />}
              {activeTab === 'notifications' && <Notifications />}
              {activeTab === 'blockchain' && <BlockchainViewer />}
              {activeTab === 'profile' && (
                <Profile user={user} getToken={getToken} onUpdate={() => {}} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
