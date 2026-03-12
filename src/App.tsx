import { useCallback, useEffect, useState } from 'react';
import { useUser, useAuth, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { MedicineList } from './components/MedicineList';
import { RegisterMedicine } from './components/RegisterMedicine';
import { VerifyMedicine } from './components/VerifyMedicine';
import { TransferOwnership } from './components/TransferOwnership';
import { ProcessSale } from './components/ProcessSale';
import { QrCodeGenerator } from './components/QrCodeGenerator';
import { AdminPanel } from './components/AdminPanel';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import type { Notification } from './components/Notifications';
import { medicineAPI, blockchainAPI, authAPI } from './utils/api';

export interface User {
  name: string;
  email: string;
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'CUSTOMER' | 'ADMIN';
  companyName?: string;
  token: string;
}

export interface Medicine {
  batchID: string;
  name: string;
  manufacturer: string;
  mfgDate: string;
  expDate: string;
  totalUnits: number;
  remainingUnits?: number;
  currentOwner: string;
  currentOwnerRole?: string;
  ownerHistory: { owner: string; role: string; date?: string; time?: string; action?: string; unitsPurchased?: number; from?: string; notes?: string }[];
  verified?: boolean;
  status?: string;
  category?: string;
  description?: string;
  dosage?: string;
  composition?: string;
  price?: number;
  location?: string;
  reorderPoint?: number;
  blockReason?: string;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function mapNotificationType(type: string, priority: string): 'ALERT' | 'INFO' | 'SUCCESS' | 'WARNING' {
  if (type === 'EXPIRY_ALERT' || type === 'LOW_STOCK') return 'WARNING';
  if (type === 'MEDICINE_BLOCKED') return 'ALERT';
  if (type === 'TRANSFER_RECEIVED' || type === 'SALE_COMPLETED') return 'SUCCESS';
  if (priority === 'urgent' || priority === 'high') return 'ALERT';
  return 'INFO';
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function MediScanApp() {
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      const role = (clerkUser.publicMetadata?.role as string) || 'CUSTOMER';
      const companyName = (clerkUser.publicMetadata?.companyName as string) || '';
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
      if (!primaryEmail) return;
      setUser({
        name: clerkUser.fullName || clerkUser.firstName || 'User',
        email: primaryEmail,
        role: role as User['role'],
        companyName,
        token: '',
      });
    } else if (isLoaded && !clerkUser) {
      setUser(null);
      setMedicines([]);
    }
  }, [clerkUser, isLoaded]);

  const loadMedicines = useCallback(async () => {
    if (!user) return;
    setIsLoadingMedicines(true);
    try {
      const token = await getToken();
      if (!token) return;
      const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
      const response = await medicineAPI.list(token, filters);
      if (response.success && response.medicines) {
        setMedicines(response.medicines);
      }
    } catch (error) {
      console.error('Failed to load medicines:', error);
    } finally {
      setIsLoadingMedicines(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const loadNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.notifications) {
        setNotifications(
          data.notifications.map((n: any): Notification => ({
            id: n._id,
            type: mapNotificationType(n.type, n.priority),
            title: n.title,
            message: n.message,
            time: formatRelativeTime(n.createdAt),
            read: n.read,
          }))
        );
      }
    } catch {
      // Notifications are non-critical
    }
  }, [getToken]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  const handleLogout = () => {
    setUser(null);
    setMedicines([]);
  };

  const handleRegisterMedicine = async (medicine: Partial<Medicine>) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.role !== 'MANUFACTURER') return { success: false, error: 'Only manufacturers can register medicines' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };
      const response = await medicineAPI.register(token, {
        batchID: medicine.batchID!,
        name: medicine.name!,
        manufacturer: medicine.manufacturer!,
        mfgDate: medicine.mfgDate!,
        expDate: medicine.expDate!,
        totalUnits: medicine.totalUnits!,
      });
      if (response.success) {
        blockchainAPI.addBlock(token, {
          action: 'REGISTER', batchID: medicine.batchID, name: medicine.name,
          manufacturer: medicine.manufacturer, totalUnits: medicine.totalUnits,
          registeredBy: user.email, timestamp: new Date().toISOString(),
        }).catch(() => {});
        const listResponse = await medicineAPI.list(token, { owner: user.email });
        if (listResponse.success && listResponse.medicines) setMedicines(listResponse.medicines);
        return { success: true };
      }
      return { success: false, error: response.error || response.message || 'Registration failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const handleTransfer = async (batchID: string, newOwnerEmail: string, newOwnerRole: string, unitsToTransfer: number) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };
      const response = await medicineAPI.transfer(token, batchID, { newOwnerEmail, newOwnerRole, unitsToTransfer });
      if (response.success) {
        blockchainAPI.addBlock(token, {
          action: 'TRANSFER', batchID, from: user.email, to: newOwnerEmail,
          toRole: newOwnerRole, unitsTransferred: unitsToTransfer, timestamp: new Date().toISOString(),
        }).catch(() => {});
        const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
        const listResponse = await medicineAPI.list(token, filters);
        if (listResponse.success && listResponse.medicines) setMedicines(listResponse.medicines);
        return { success: true };
      }
      return { success: false, error: response.error || 'Transfer failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Transfer failed' };
    }
  };

  const handlePurchase = async (batchID: string, unitsPurchased: number, customerEmail: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };
      const response = await medicineAPI.purchase(token, batchID, { unitsPurchased, customerEmail });
      if (response.success) {
        blockchainAPI.addBlock(token, {
          action: 'PURCHASE', batchID, soldBy: user.email, soldTo: customerEmail,
          unitsSold: unitsPurchased, timestamp: new Date().toISOString(),
        }).catch(() => {});
        const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
        const listResponse = await medicineAPI.list(token, filters);
        if (listResponse.success && listResponse.medicines) setMedicines(listResponse.medicines);
        return { success: true };
      }
      return { success: false, error: response.error || 'Purchase failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Purchase failed' };
    }
  };

  const handleVerify = async (batchID: string): Promise<{ verified: boolean; medicine?: Medicine; error?: string }> => {
    try {
      const token = await getToken();
      if (!token) return { verified: false, error: 'Authentication required' };
      const response = await medicineAPI.list(token, { batchID });
      if (response.success && response.medicines && response.medicines.length > 0) {
        return { verified: true, medicine: response.medicines[0] };
      }
      return { verified: false, error: 'Medicine not found in registry' };
    } catch (error: any) {
      return { verified: false, error: error.message || 'Verification failed' };
    }
  };

  const handleUpdateProfile = async (data: Partial<User>) => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      if (data.companyName !== undefined) {
        await authAPI.updateProfile(token, { companyName: data.companyName });
      }
      setUser(prev => prev ? { ...prev, ...data } : prev);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleReadNotification = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const renderContent = () => {
    if (!user) return null;
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard medicines={medicines} user={user} />;
      case 'inventory':
        return <MedicineList medicines={medicines} onNavigate={setActiveTab} isLoading={isLoadingMedicines} />;
      case 'register':
        return <RegisterMedicine onRegister={handleRegisterMedicine} />;
      case 'verify':
        return <VerifyMedicine medicines={medicines} onVerify={handleVerify} />;
      case 'transfer':
        return <TransferOwnership medicines={medicines} getToken={getToken} onTransfer={handleTransfer} userEmail={user.email} />;
      case 'sales':
        return <ProcessSale medicines={medicines} user={user} onSale={handlePurchase} />;
      case 'qrcode':
        return <QrCodeGenerator medicines={medicines} />;
      case 'admin':
        return <AdminPanel medicines={medicines} />;
      case 'profile':
        return <Profile user={user} onUpdate={handleUpdateProfile} />;
      case 'notifications':
        return <Notifications notifications={notifications} onMarkAllRead={handleMarkAllRead} onRead={handleReadNotification} />;
      default:
        return <Dashboard medicines={medicines} user={user} />;
    }
  };

  const getTitle = () => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      inventory: 'Inventory Management',
      register: 'Register Medicine',
      transfer: 'Transfer Stock',
      sales: 'Process Sale',
      qrcode: 'QR Code Generator',
      verify: 'Verify Authenticity',
      notifications: 'Notifications',
      admin: 'System Administration',
      profile: 'Account Settings',
    };
    return titles[activeTab] || 'Dashboard';
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-800 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans text-slate-900 dark:text-gray-100 transition-colors duration-300">
      <Toaster position="top-right" richColors />

      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={getTitle()}
          onMenuClick={() => setIsSidebarOpen(true)}
          notificationCount={notifications.filter(n => !n.read).length}
          onNotificationClick={() => setActiveTab('notifications')}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SignedOut>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-emerald-600 mb-2">MediScan</h1>
              <p className="text-gray-500 dark:text-gray-400">Medicine Verification System</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none',
                    main: 'bg-transparent',
                  },
                }}
              />
            </div>
            <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-2">Setting Up User Roles</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-400 mb-2">
                After signing up, set your role in Clerk Dashboard:
              </p>
              <ol className="text-xs text-emerald-800 dark:text-emerald-400 space-y-1 ml-4 list-decimal">
                <li>Go to Clerk Dashboard → Users</li>
                <li>Click on your user → Metadata tab</li>
                <li>Add to Public Metadata: <code className="bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">{"{ \"role\": \"MANUFACTURER\" }"}</code></li>
              </ol>
              <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-2">
                Available roles: MANUFACTURER, DISTRIBUTOR, PHARMACY, CUSTOMER, ADMIN
              </p>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <MediScanApp />
      </SignedIn>
    </ThemeProvider>
  );
}
