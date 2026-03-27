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
import { AdminManagementPanel } from './components/AdminManagementPanel';
import { Profile } from './components/Profile';
import { Notifications } from './components/Notifications';
import type { Notification } from './components/Notifications';
import { Analytics } from './components/Analytics';
import { BlockchainExplorer } from './components/BlockchainExplorer';
import { Tickets } from './components/Tickets';
import { BannedModal } from './components/BannedModal';
import { BanAppealForm } from './components/BanAppealForm';
import { BanGuard } from './components/BanGuard';
import { medicineAPI, blockchainAPI, authAPI } from './utils/api';

export interface User {
  name: string;
  email: string;
  role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'PHARMACY' | 'CUSTOMER' | 'ADMIN';
  companyName?: string;
  hasCompanyNameSet?: boolean;
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
  ownerHistory: {
    owner: string;
    role: string;
    ownerLocation?: string;
    date?: string;
    time?: string;
    action?: string;
    unitsPurchased?: number;
    from?: string;
    fromLocation?: string;
    notes?: string;
    transferId?: string;
    transferNonce?: string;
    transferPayloadHash?: string;
    transferSignature?: string;
    blockchainStatus?: string;
    blockchainIndex?: number;
    blockchainHash?: string;
    blockchainPreviousHash?: string;
    blockchainTimestamp?: string;
  }[];
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

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const APP_SYNC_FALLBACK_INTERVAL_MS = 30000;

function getApiBase(): string {
  if (!RAW_API_BASE) return '';
  if (typeof window === 'undefined') return RAW_API_BASE;

  const runningOnLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const pointsToLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(RAW_API_BASE);

  // Safety: ignore localhost API URL in deployed environments.
  if (!runningOnLocalHost && pointsToLocalHost) {
    return '';
  }
  return RAW_API_BASE;
}

const API_BASE = getApiBase();

function buildApiUrl(endpoint: string): string {
  return API_BASE ? `${API_BASE}${endpoint}` : endpoint;
}

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

function parseVerificationInput(rawInput: string): { batchID?: string; txId?: string; blockHash?: string } {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const batchFromJson = String(parsed.batchID || parsed.batchId || parsed.id || '').trim();
      const txFromJson = String(parsed.transactionId || parsed.tx || '').trim();
      const hashFromJson = String(
        parsed.registeredHash || parsed.registrationHash || parsed.blockHash || parsed.hash || parsed.registeredPayloadHash || ''
      ).trim();

      if (batchFromJson || txFromJson || hashFromJson) {
        return {
          batchID: batchFromJson || undefined,
          txId: txFromJson || undefined,
          blockHash: hashFromJson || undefined,
        };
      }
    } catch {
      // Ignore JSON parse errors and continue with URL/raw parsing.
    }
  }

  try {
    const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const batchFromQuery =
      String(url.searchParams.get('batchID') || url.searchParams.get('batchId') || url.searchParams.get('id') || '').trim();
    if (batchFromQuery) return { batchID: batchFromQuery };

    const txFromQuery = String(url.searchParams.get('tx') || url.searchParams.get('transactionId') || '').trim();
    const hashFromQuery = String(
      url.searchParams.get('hash') || url.searchParams.get('blockHash') || url.searchParams.get('registeredHash') || ''
    ).trim();

    if (batchFromQuery || txFromQuery || hashFromQuery) {
      return {
        batchID: batchFromQuery || undefined,
        txId: txFromQuery || undefined,
        blockHash: hashFromQuery || undefined,
      };
    }

    const verifyPathMatch = url.pathname.match(/\/medicine\/verify\/([^/?#]+)/i);
    if (verifyPathMatch?.[1]) {
      return { batchID: decodeURIComponent(verifyPathMatch[1]).trim() };
    }
  } catch {
    // Non-URL input, handled below.
  }

  const txMatch = trimmed.match(/\bTXN-[A-Z0-9-]+\b/i);
  if (txMatch?.[0]) {
    return { txId: txMatch[0].trim() };
  }

  const hashMatch = trimmed.match(/\b([A-Fa-f0-9]{64})\b/);
  if (hashMatch?.[1]) {
    return { blockHash: hashMatch[1] };
  }

  return { batchID: trimmed };
}

function MediScanApp() {
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [initialBlockchainTxId, setInitialBlockchainTxId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [headerSearch, setHeaderSearch] = useState('');
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [banMessage, setBanMessage] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const tx = params.get('tx');

    if (tab) {
      setActiveTab(tab);
    }
    if (tx) {
      setInitialBlockchainTxId(tx);
      if (!tab) {
        setActiveTab('blockchain');
      }
    }
  }, []);

  useEffect(() => {
    if (isLoaded && clerkUser) {
      const role = (clerkUser.publicMetadata?.role as string) || 'CUSTOMER';
      const companyName = (clerkUser.publicMetadata?.companyName as string) || '';
      const hasCompanyNameSet = Boolean(
        clerkUser.publicMetadata?.hasCompanyNameSet || companyName.trim() !== ''
      );
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
      if (!primaryEmail) return;
      setUser({
        name: clerkUser.fullName || clerkUser.firstName || 'User',
        email: primaryEmail,
        role: role as User['role'],
        companyName,
        hasCompanyNameSet,
        token: '',
      });
    } else if (isLoaded && !clerkUser) {
      setUser(null);
      setMedicines([]);
    }
  }, [clerkUser, isLoaded]);

  const loadMedicines = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    if (!options?.silent) {
      setIsLoadingMedicines(true);
    }
    try {
      const token = await getToken();
      if (!token) return;
      const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
      const response = await medicineAPI.list(token, filters);
      if (response.success && response.medicines) {
        setMedicines(response.medicines);
      }
    } catch (error: any) {
      console.error('Failed to load medicines:', error);
      // Check if banned
      if (error.message?.includes('banned') || error.message?.includes('Account is banned')) {
        setBanMessage(error.message || 'Your account has been suspended');
        setShowBannedModal(true);
        setTimeout(async () => {
          try {
            await signOut();
            setUser(null);
            setMedicines([]);
          } catch (err) {
            console.error('Sign out error:', err);
          }
        }, 2000);
      }
    } finally {
      if (!options?.silent) {
        setIsLoadingMedicines(false);
      }
    }
  }, [user, getToken, signOut]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && activeTab === 'dashboard') {
      setActiveTab('admin');
    }
  }, [user, activeTab]);

  const loadNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(buildApiUrl('/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Check if banned
        if (response.status === 403) {
          const data = await response.json();
          if (data.error?.includes('banned') || data.message?.includes('banned')) {
            setBanMessage(data.message || data.error || 'Your account has been suspended');
            setShowBannedModal(true);
            setTimeout(async () => {
              try {
                await signOut();
                setUser(null);
                setMedicines([]);
              } catch (err) {
                console.error('Sign out error:', err);
              }
            }, 2000);
            return;
          }
        }
        return;
      }

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
  }, [getToken, signOut]);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user, loadNotifications]);

  useEffect(() => {
    if (!user) return;

    let syncInFlight = false;

    const runSync = async () => {
      if (syncInFlight) return;
      syncInFlight = true;
      try {
        await Promise.all([
          loadMedicines({ silent: true }),
          loadNotifications(),
        ]);
      } finally {
        syncInFlight = false;
      }
    };

    const intervalId = window.setInterval(runSync, APP_SYNC_FALLBACK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync();
      }
    };

    const handleWindowFocus = () => {
      runSync();
    };

    const handleRealtimeUpdate = () => {
      runSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('mediscan:realtime-update', handleRealtimeUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('mediscan:realtime-update', handleRealtimeUpdate);
    };
  }, [user, loadMedicines, loadNotifications]);

  useEffect(() => {
    if (!user) return;

    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    const connect = async () => {
      try {
        const token = await getToken();
        if (!token || stopped) return;

        source = new EventSource(`${buildApiUrl('/events/stream')}?token=${encodeURIComponent(token)}`);

        source.addEventListener('app-update', () => {
          window.dispatchEvent(new Event('mediscan:realtime-update'));
        });

        source.onerror = () => {
          source?.close();
          if (!stopped && reconnectTimer === null) {
            reconnectTimer = window.setTimeout(() => {
              reconnectTimer = null;
              connect();
            }, 3000);
          }
        };
      } catch {
        if (!stopped && reconnectTimer === null) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 3000);
        }
      }
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [user, getToken]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
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
        manufacturerLocation: medicine.location,
        mfgDate: medicine.mfgDate!,
        expDate: medicine.expDate!,
        totalUnits: medicine.totalUnits!,
        category: medicine.category,
        price: medicine.price,
        dosage: medicine.dosage,
        composition: medicine.composition,
        description: medicine.description,
        location: medicine.location,
      } as any);
      if (response.success) {
        const listResponse = await medicineAPI.list(token, { owner: user.email });
        if (listResponse.success && listResponse.medicines) setMedicines(listResponse.medicines);
        return { success: true };
      }
      return { success: false, error: response.error || response.message || 'Registration failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const handleTransfer = async (
    batchID: string,
    newOwnerEmail: string,
    newOwnerRole: string,
    unitsToTransfer: number,
    fromLocation?: string,
    toLocation?: string
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };
      const response = await medicineAPI.transfer(token, batchID, {
        newOwnerEmail,
        newOwnerRole,
        unitsToTransfer,
        fromLocation,
        toLocation,
      });
      if (response.success) {
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

  const handlePurchase = async (batchID: string, unitsPurchased: number, customerEmail: string, transactionId?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };
      const response = await medicineAPI.purchase(token, batchID, { unitsPurchased, customerEmail });
      if (response.success) {
        blockchainAPI.addBlock(token, {
          action: 'PURCHASE', batchID, soldBy: user.email, soldTo: customerEmail,
          unitsSold: unitsPurchased, timestamp: new Date().toISOString(),
          transactionId: transactionId || '',
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

  const handleRecordInvoice = async (payload: {
    transactionId: string;
    items: Array<{ batchID: string; medicineName: string; quantity: number; unitPrice: number }>;
    totalUnits: number;
    totalPrice: number;
    dateTime: string;
    customerEmail: string;
    blockchainExplorerUrl: string;
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };

      const response = await blockchainAPI.addBlock(token, {
        action: 'INVOICE_ISSUED',
        transactionId: payload.transactionId,
        soldBy: user.email,
        soldTo: payload.customerEmail,
        timestamp: new Date().toISOString(),
        invoice: {
          transactionId: payload.transactionId,
          items: payload.items,
          totalUnits: payload.totalUnits,
          totalPrice: payload.totalPrice,
          dateTime: payload.dateTime,
          customerEmail: payload.customerEmail,
          blockchainExplorerUrl: payload.blockchainExplorerUrl,
        },
      });

      if (response?.success) {
        return { success: true };
      }

      return { success: false, error: response?.error || 'Failed to write invoice block to blockchain' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to write invoice block to blockchain' };
    }
  };

  const handleVerify = async (input: string): Promise<{ verified: boolean; medicine?: Medicine; error?: string }> => {
    try {
      const token = await getToken();
      if (!token) return { verified: false, error: 'Authentication required' };

      const parsed = parseVerificationInput(input);
      let resolvedBatchId = parsed.batchID;

      if (!resolvedBatchId && (parsed.txId || parsed.blockHash)) {
        const txId = parsed.txId?.toUpperCase();
        const hash = parsed.blockHash?.toLowerCase();
        const chainResponse = await blockchainAPI.getChain(token);
        const chain = Array.isArray(chainResponse?.chain) ? chainResponse.chain : [];

        let targetBlock = null as any;

        if (txId) {
          targetBlock = chain.find((block: any) => String(block?.data?.transactionId || '').trim().toUpperCase() === txId);
        }

        if (!targetBlock && hash) {
          targetBlock = chain.find((block: any) => {
            const blockHash = String(block?.hash || '').trim().toLowerCase();
            const payloadHash = String(block?.data?.transferPayloadHash || '').trim().toLowerCase();
            return blockHash === hash || payloadHash === hash;
          });
        }

        if (!targetBlock) {
          if (parsed.blockHash) {
            return { verified: false, error: `Hash ${parsed.blockHash} was not found on blockchain.` };
          }
          return { verified: false, error: `Transaction ${parsed.txId} was not found on blockchain.` };
        }

        const directBatchId = String(targetBlock?.data?.batchID || targetBlock?.data?.batchId || '').trim();
        if (directBatchId) {
          resolvedBatchId = directBatchId;
        } else {
          const invoiceItems = Array.isArray(targetBlock?.data?.invoice?.items) ? targetBlock.data.invoice.items : [];
          const invoiceBatchIds = invoiceItems
            .map((item: any) => String(item?.batchID || item?.batchId || '').trim())
            .filter(Boolean);

          if (invoiceBatchIds.length === 1) {
            resolvedBatchId = invoiceBatchIds[0];
          } else if (invoiceBatchIds.length > 1) {
            return {
              verified: false,
              error: `Invoice has multiple batches: ${invoiceBatchIds.join(', ')}. Please scan product QR or enter a specific Batch ID.`,
            };
          }
        }
      }

      if (!resolvedBatchId) {
        return { verified: false, error: 'Could not resolve Batch ID from scanned QR. Please scan product QR or enter Batch ID.' };
      }

      const response = await medicineAPI.list(token, { batchID: resolvedBatchId });
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
      if (!token) throw new Error('Authentication required');
      if (data.companyName !== undefined) {
        const response = await authAPI.updateProfile(token, { companyName: data.companyName });
        setUser(prev => prev ? {
          ...prev,
          ...data,
          companyName: response.companyName ?? data.companyName,
          hasCompanyNameSet: true,
        } : prev);
        return;
      }
      setUser(prev => prev ? { ...prev, ...data } : prev);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      throw new Error(error?.message || 'Failed to update profile');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(buildApiUrl('/notifications/read-all'), {
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
      await fetch(buildApiUrl(`/notifications/${id}/read`), {
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

    if (user.role === 'ADMIN' && activeTab === 'admin') {
      return <AdminManagementPanel getToken={getToken} />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard medicines={medicines} user={user} />;
      case 'inventory':
        return <MedicineList medicines={medicines} onNavigate={setActiveTab} isLoading={isLoadingMedicines} userEmail={user.email} />;
      case 'register':
        return <RegisterMedicine onRegister={handleRegisterMedicine} />;
      case 'verify':
        return <VerifyMedicine medicines={medicines} onVerify={handleVerify} />;
      case 'transfer':
        return <TransferOwnership medicines={medicines} getToken={getToken} onTransfer={handleTransfer} userEmail={user.email} />;
      case 'sales':
        return <ProcessSale medicines={medicines} user={user} onSale={handlePurchase} onRecordInvoice={handleRecordInvoice} />;
      case 'qrcode':
        return <QrCodeGenerator medicines={medicines} />;
      case 'admin':
        return <Dashboard medicines={medicines} user={user} />;
      case 'profile':
        return <Profile user={user} onUpdate={handleUpdateProfile} />;
      case 'notifications':
        return <Notifications notifications={notifications} onMarkAllRead={handleMarkAllRead} onRead={handleReadNotification} />;
      case 'blockchain':
        return <BlockchainExplorer medicines={medicines} initialTransactionId={initialBlockchainTxId} />;
      case 'analytics':
        return <Analytics user={user} medicines={medicines} />;
      case 'tickets':
        return <Tickets user={user} getToken={getToken} />;
      default:
        return <Dashboard medicines={medicines} user={user} />;
    }
  };

  const getTitle = () => {
    if (user?.role === 'ADMIN') {
      return 'System Administration';
    }

    if (activeTab === 'admin') {
      return 'Dashboard';
    }

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
      blockchain: 'Blockchain Explorer',
      analytics: 'Analytics',
      tickets: 'Support Tickets',
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

      <BannedModal
        isOpen={showBannedModal}
        onClose={() => setShowBannedModal(false)}
        message={banMessage}
      />

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
          searchValue={headerSearch}
          onSearchChange={setHeaderSearch}
          onSearchSubmit={() => { if (headerSearch.trim()) { setActiveTab('inventory'); } }}
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
  const { user: clerkUser } = useUser();
  const [showAppealForm, setShowAppealForm] = useState(false);

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SignedOut>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          {showAppealForm ? (
            <BanAppealForm
              userEmail={clerkUser?.primaryEmailAddress?.emailAddress}
              onClose={() => setShowAppealForm(false)}
            />
          ) : (
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
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAppealForm(true)}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium underline"
                >
                  Account Banned? Submit an Appeal
                </button>
              </div>
            </div>
          )}
        </div>
      </SignedOut>
      <SignedIn>
        <BanGuard>
          <MediScanApp />
        </BanGuard>
      </SignedIn>
    </ThemeProvider>
  );
}
