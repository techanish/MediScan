import { useCallback, useEffect, useState } from 'react';
import { useUser, useAuth, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, ScanLine, LockKeyhole } from 'lucide-react';
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
import { ThreeLoginBackground } from './components/ThreeLoginBackground';
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

  const loginHighlights = [
    {
      title: 'Chain-of-custody intelligence',
      detail: 'Trace every medicine handoff with cryptographic evidence in one timeline.',
      icon: ScanLine,
    },
    {
      title: 'Tamper-ready operations',
      detail: 'Detect anomalies early with transfer verification and inventory safeguards.',
      icon: ShieldCheck,
    },
    {
      title: 'Regulatory confidence',
      detail: 'Generate audit-grade logs and compliance artifacts without manual overhead.',
      icon: LockKeyhole,
    },
  ];

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SignedOut>
        <div className="relative min-h-screen overflow-hidden bg-[#f2fff6]">
          <ThreeLoginBackground />
          <div className="pointer-events-none absolute inset-0 z-[1]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f2fff7]/17 via-[#ecfff4]/11 to-[#f3fff8]/17" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(234,255,244,0.15)_0%,rgba(238,255,247,0.06)_40%,rgba(248,255,251,0.02)_66%,rgba(248,255,251,0)_84%)]" />
            <div className="absolute -top-28 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-200/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
            {showAppealForm ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mx-auto w-full max-w-2xl rounded-[32px] border border-emerald-200/70 bg-white/95 p-3 shadow-[0_28px_90px_-36px_rgba(16,185,129,0.55)] backdrop-blur-sm sm:p-5"
            >
              <BanAppealForm
                userEmail={clerkUser?.primaryEmailAddress?.emailAddress}
                onClose={() => setShowAppealForm(false)}
              />
            </motion.div>
            ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mx-auto grid w-full max-w-md overflow-hidden rounded-[24px] border border-emerald-200/80 bg-white shadow-[0_36px_120px_-48px_rgba(6,95,70,0.55)] sm:max-w-2xl sm:rounded-[30px] lg:max-w-6xl lg:rounded-[36px] lg:grid-cols-[1.18fr_0.82fr]"
            >
              <section className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-700 px-5 py-6 text-white sm:px-10 sm:py-10 lg:block lg:min-h-[680px]">
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-52 w-72 bg-gradient-to-r from-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-emerald-950/35 to-transparent" />
                </div>

                <div className="relative z-10 flex h-full min-w-0 flex-col">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 }}
                    className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] sm:px-4 sm:text-[11px] sm:tracking-[0.18em]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    MediScan Secure Access
                  </motion.div>

                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.16 }}
                    className="mt-6 max-w-xl text-balance font-['Fraunces','Cambria',serif] text-[2.55rem] leading-[1.03] sm:mt-7 sm:text-[3.35rem]"
                  >
                    Authentic medicine starts with trusted identity.
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.24 }}
                    className="mt-4 max-w-lg text-sm leading-relaxed text-emerald-50/95 sm:text-base"
                  >
                    Join your protected workspace to verify provenance, monitor transfers, and maintain high-confidence pharmaceutical operations.
                  </motion.p>

                  <div className="mt-7 grid gap-3">
                    {loginHighlights.map((item, index) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                          className="rounded-2xl border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm sm:p-4"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="rounded-xl border border-white/25 bg-white/20 p-2">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white break-words">{item.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-emerald-50/95">{item.detail}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.58 }}
                    className="mt-6 grid grid-cols-2 gap-3 pt-3 sm:mt-auto sm:grid-cols-3 sm:pt-7"
                  >
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center">
                      <p className="font-['Fraunces','Cambria',serif] text-xl">24/7</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-emerald-100/90">Monitoring</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center">
                      <p className="font-['Fraunces','Cambria',serif] text-xl">99.9%</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-emerald-100/90">Integrity</p>
                    </div>
                    <div className="col-span-2 rounded-2xl border border-white/20 bg-white/10 p-3 text-center sm:col-span-1">
                      <p className="font-['Fraunces','Cambria',serif] text-xl">256-bit</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-emerald-100/90">Secure Auth</p>
                    </div>
                  </motion.div>
                </div>
              </section>

              <section className="relative flex items-center bg-gradient-to-b from-[#ffffff] to-[#f1fff6] px-4 py-6 sm:px-8 sm:py-7 lg:px-10">
                <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-40 -translate-x-1/2 rounded-full bg-emerald-200/35 blur-2xl" />
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.22 }}
                  className="relative z-10 mx-auto w-full max-w-md"
                >
                  <p className="text-center font-['Space_Grotesk','Segoe_UI',sans-serif] text-2xl font-bold text-emerald-700 sm:text-3xl">
                    Welcome Back
                  </p>
                  <p className="mt-2 px-2 text-center text-sm leading-snug text-emerald-700/75 sm:px-0">
                    Sign in to continue to your verification command center
                  </p>

                  <div className="mt-5 rounded-[28px] border border-emerald-100 bg-white/95 p-4 shadow-[0_20px_60px_-30px_rgba(5,150,105,0.6)] sm:p-6">
                    <SignIn
                      appearance={{
                        variables: {
                          colorPrimary: '#047857',
                          colorText: '#065f46',
                          colorTextSecondary: '#166534',
                          colorInputText: '#064e3b',
                          colorBackground: '#ffffff',
                          colorNeutral: '#d1fae5',
                          colorDanger: '#dc2626',
                          borderRadius: '0.95rem',
                          fontFamily: 'Space Grotesk, Segoe UI, sans-serif',
                        },
                        elements: {
                          rootBox: 'w-full',
                          card: 'shadow-none border-0 bg-transparent p-0',
                          main: 'bg-transparent gap-5',
                          headerTitle: 'text-emerald-700 text-xl font-bold',
                          headerSubtitle: 'text-emerald-700/70',
                          formFieldLabel: 'text-emerald-800 font-medium',
                          formFieldInput:
                            'border border-emerald-200 bg-emerald-50/55 text-emerald-900 placeholder:text-emerald-600/65 focus:border-emerald-600 focus:ring-emerald-600',
                          formButtonPrimary:
                            'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-[0_14px_30px_-16px_rgba(4,120,87,0.8)]',
                          footerActionLink: 'text-emerald-700 hover:text-emerald-800 font-semibold',
                          dividerText: 'text-emerald-700/65',
                          dividerLine: 'bg-emerald-100',
                          socialButtonsBlockButton:
                            'border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900',
                          socialButtonsBlockButtonText: 'font-semibold !text-emerald-800',
                          socialButtonsProviderIcon: 'opacity-100',
                          socialButtonsBlockButtonArrow: 'text-emerald-700',
                        },
                      }}
                    />
                  </div>

                  <div className="mt-5 text-center">
                    <button
                      onClick={() => setShowAppealForm(true)}
                      className="text-sm font-semibold text-emerald-700 underline decoration-emerald-400 underline-offset-[3px] transition hover:text-emerald-800"
                    >
                      Account banned? Submit an appeal
                    </button>
                  </div>
                </motion.div>
              </section>
            </motion.div>
            )}
          </div>
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
