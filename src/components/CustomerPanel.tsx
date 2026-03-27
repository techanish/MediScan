import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ScanLine,
  PlusCircle,
  Bot,
  ShieldCheck,
  AlertTriangle,
  Clock3,
  Pill,
  History,
  Sparkles,
  CheckCircle2,
  Loader2,
  Link2,
  Hospital,
  CalendarClock,
  LayoutDashboard,
  PackageCheck,
  MessageCircleMore,
  RefreshCw,
  ShoppingBag,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { customerAPI } from '../utils/api';
import { VerifyMedicine } from './VerifyMedicine';
import type { Medicine, User } from '../App';

interface CustomerPanelProps {
  user: User;
  getToken: () => Promise<string | null>;
}

interface PurchasedMedicine {
  batchID: string;
  name: string;
  manufacturer: string;
  purchaseDate: string;
  unitsPurchased: number;
  ownershipStatus: 'Verified' | 'Unverified';
  status?: string;
  addedToOwned?: boolean;
  pharmacy: {
    email: string;
    role: string;
    location?: string;
  };
}

interface OwnedMedicine {
  batchID: string;
  name: string;
  manufacturer: string;
  expDate: string;
  daysUntilExpiry: number | null;
  expiryAlertLevel: 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';
  dosage: string;
  usageGuidelines: string;
  sideEffects: string;
  precautions: string;
  addSource: 'SCAN_QR' | 'MANUAL' | 'PURCHASE_SYNC';
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'SUSPICIOUS';
  verifiedAt: string;
  blockchainBacked: boolean;
  reminders: {
    expiry: string;
    dosage: string;
  };
}

interface ScanHistoryEntry {
  id: string;
  batchID: string;
  timestamp: string;
  status: 'VERIFIED' | 'SUSPICIOUS';
  result: string;
  location: string;
  deviceId: string;
}

interface ChainStep {
  step: number;
  action: string;
  actor: string;
  role: string;
  timestamp: string;
  from?: string;
  fromLocation?: string;
  toLocation?: string;
}

interface VerificationResult {
  verified: boolean;
  authenticity: boolean;
  counterfeitRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  trustScore?: number;
  anomalies: string[];
  reasons?: string[];
  chainOfCustody: ChainStep[];
  medicine?: {
    batchID: string;
    name: string;
    manufacturer: string;
    mfgDate?: string;
    expDate?: string;
    status?: string;
    dosage?: string;
    description?: string;
    composition?: string;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

type PanelView = 'home' | 'verify' | 'owned' | 'scans' | 'assistant';

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function matchesSearch(term: string, fields: Array<string | undefined>): boolean {
  if (!term.trim()) return true;
  const q = term.toLowerCase();
  return fields.some((field) => String(field || '').toLowerCase().includes(q));
}

export function CustomerPanel({ user, getToken }: CustomerPanelProps) {
  const [activeView, setActiveView] = useState<PanelView>('home');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [purchased, setPurchased] = useState<PurchasedMedicine[]>([]);
  const [owned, setOwned] = useState<OwnedMedicine[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [scanSearch, setScanSearch] = useState('');
  const [quickAddBatchID, setQuickAddBatchID] = useState<string | null>(null);

  const [globalSearch, setGlobalSearch] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [addMode, setAddMode] = useState<'SCAN_QR' | 'MANUAL'>('SCAN_QR');
  const [manualBatchID, setManualBatchID] = useState('');
  const [addingOwned, setAddingOwned] = useState(false);
  const [showAddSuccess, setShowAddSuccess] = useState(false);

  const [verifyInput, setVerifyInput] = useState('');
  const [packagingCode, setPackagingCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const [scanFilter, setScanFilter] = useState<'ALL' | 'VERIFIED' | 'SUSPICIOUS'>('ALL');

  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello. I can help with dosage, side effects, interactions, and safe usage based on your owned medicines.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);

  const globalSearchInputRef = useRef<HTMLInputElement | null>(null);

  const recentStorageKey = `mediscan:customer-recent-searches:${user.email.toLowerCase()}`;

  const loadCustomerData = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const [purchasedRes, ownedRes, scansRes] = await Promise.allSettled([
        customerAPI.getPurchased(token),
        customerAPI.getOwned(token),
        customerAPI.getScanHistory(token, scanFilter),
      ]);

      const warnings: string[] = [];

      if (purchasedRes.status === 'fulfilled') {
        setPurchased(Array.isArray(purchasedRes.value?.purchased) ? purchasedRes.value.purchased : []);
      } else {
        warnings.push('Purchased medicines unavailable');
      }

      if (ownedRes.status === 'fulfilled') {
        setOwned(Array.isArray(ownedRes.value?.ownedMedicines) ? ownedRes.value.ownedMedicines : []);
      } else {
        warnings.push('Owned medicines unavailable');
      }

      if (scansRes.status === 'fulfilled') {
        setScanHistory(Array.isArray(scansRes.value?.scanHistory) ? scansRes.value.scanHistory : []);
      } else {
        warnings.push('Scan history unavailable');
      }

      setLoadWarnings(warnings);

      if (warnings.length > 0 && !options?.silent) {
        toast.warning(`Loaded partial data: ${warnings.join(', ')}`);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load customer data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken, scanFilter]);

  useEffect(() => {
    const raw = localStorage.getItem(recentStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.map((item) => String(item)).slice(0, 6));
      }
    } catch {
      // Ignore corrupted local storage values.
    }
  }, [recentStorageKey]);

  useEffect(() => {
    localStorage.setItem(recentStorageKey, JSON.stringify(recentSearches.slice(0, 6)));
  }, [recentSearches, recentStorageKey]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadCustomerData({ silent: true });
      }
    }, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadCustomerData]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void loadCustomerData({ silent: true });
    };
    
    const handleGlobalSync = () => {
      void loadCustomerData({ silent: true });
    };

    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      if (isTypingTarget) return;

      if (event.key === '/') {
        event.preventDefault();
        globalSearchInputRef.current?.focus();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('mediscan:global-sync', handleGlobalSync);
    window.addEventListener('keydown', handleShortcut);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('mediscan:global-sync', handleGlobalSync);
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [loadCustomerData]);

  const saveRecentSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 6));
  };

  const searchableOptions = useMemo(() => {
    const options = [
      ...purchased.map((item) => ({
        label: `${item.name} (${item.batchID})`,
        value: item.batchID,
      })),
      ...owned.map((item) => ({
        label: `${item.name} (${item.batchID})`,
        value: item.batchID,
      })),
      ...purchased.map((item) => ({
        label: `${item.manufacturer} manufacturer`,
        value: item.manufacturer,
      })),
    ];

    const dedup = new Map<string, { label: string; value: string }>();
    options.forEach((opt) => {
      if (!dedup.has(opt.label.toLowerCase())) {
        dedup.set(opt.label.toLowerCase(), opt);
      }
    });

    return [...dedup.values()].slice(0, 20);
  }, [purchased, owned]);

  const suggestions = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) {
      return recentSearches.map((item) => ({ label: item, value: item }));
    }
    return searchableOptions
      .filter((item) => item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query))
      .slice(0, 6);
  }, [globalSearch, recentSearches, searchableOptions]);

  const filteredPurchased = useMemo(() => {
    return purchased.filter((item) =>
      matchesSearch(globalSearch, [
        item.name,
        item.batchID,
        item.manufacturer,
        item.pharmacy.email,
      ])
    );
  }, [globalSearch, purchased]);

  const filteredOwned = useMemo(() => {
    return owned.filter((item) =>
      matchesSearch(globalSearch, [item.name, item.batchID, item.manufacturer])
    );
  }, [globalSearch, owned]);

  const expiringSoonCount = useMemo(
    () => owned.filter((item) => item.expiryAlertLevel === 'critical' || item.expiryAlertLevel === 'expired').length,
    [owned]
  );

  const suspiciousScansCount = useMemo(
    () => scanHistory.filter((entry) => entry.status === 'SUSPICIOUS').length,
    [scanHistory]
  );

  const filteredScanHistory = useMemo(() => {
    return scanHistory.filter((entry) =>
      matchesSearch(scanSearch, [entry.batchID, entry.result, entry.location, entry.deviceId])
    );
  }, [scanHistory, scanSearch]);

  const todayInsights = useMemo(() => {
    const insights: string[] = [];

    if (expiringSoonCount > 0) {
      insights.push(`${expiringSoonCount} medicine(s) need expiry attention soon.`);
    }

    if (suspiciousScansCount > 0) {
      insights.push(`${suspiciousScansCount} suspicious scan(s) detected. Re-verify before usage.`);
    }

    const suspiciousOwned = owned.filter((item) => item.verificationStatus === 'SUSPICIOUS').length;
    if (suspiciousOwned > 0) {
      insights.push(`${suspiciousOwned} owned medicine(s) are marked suspicious.`);
    }

    if (insights.length === 0) {
      insights.push('All tracked indicators look stable today. Continue verification before each use.');
    }

    return insights;
  }, [expiringSoonCount, suspiciousScansCount, owned]);

  const assistantQuickPrompts = [
    'Can I take these medicines together?',
    'Explain side effects for my owned medicines',
    'I missed a dose. What should I do?',
    'Any expiry risks in my medicines?',
  ];

  const navItems: Array<{ id: PanelView; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'verify', label: 'Verify', icon: ScanLine },
    { id: 'owned', label: 'Owned', icon: PackageCheck },
    { id: 'scans', label: 'Scans', icon: History },
    { id: 'assistant', label: 'AI', icon: MessageCircleMore },
  ];

  const runVerification = useCallback(
    async (inputValue: string) => {
      const input = inputValue.trim();
      if (!input) {
        toast.error('Enter a batch ID or QR payload');
        return null;
      }

      setVerifying(true);
      try {
        const token = await getToken();
        if (!token) {
          toast.error('Authentication required');
          return null;
        }

        const response = await customerAPI.verify(token, {
          input,
          packagingCode: packagingCode.trim() || undefined,
        });

        const result: VerificationResult = {
          verified: Boolean(response?.verified),
          authenticity: Boolean(response?.authenticity),
          counterfeitRisk: (response?.counterfeitRisk || 'HIGH') as VerificationResult['counterfeitRisk'],
          trustScore: typeof response?.trustScore === 'number' ? response.trustScore : undefined,
          anomalies: Array.isArray(response?.anomalies) ? response.anomalies : [],
          reasons: Array.isArray(response?.reasons) ? response.reasons : [],
          chainOfCustody: Array.isArray(response?.chainOfCustody) ? response.chainOfCustody : [],
          medicine: response?.medicine,
        };

        setVerificationResult(result);
        setVerifyInput(input);
        await loadCustomerData();
        return result;
      } catch (error: any) {
        toast.error(error?.message || 'Verification failed');
        return null;
      } finally {
        setVerifying(false);
      }
    },
    [getToken, loadCustomerData, packagingCode]
  );

  const handleManualVerification = async () => {
    saveRecentSearch(verifyInput);
    await runVerification(verifyInput);
  };

  const handleScannerVerify = useCallback(
    async (input: string): Promise<{ verified: boolean; medicine?: Medicine; error?: string }> => {
      const result = await runVerification(input);
      if (result?.verified && result.medicine) {
        return {
          verified: true,
          medicine: {
            batchID: result.medicine.batchID,
            name: result.medicine.name,
            manufacturer: result.medicine.manufacturer,
            mfgDate: result.medicine.mfgDate || '',
            expDate: result.medicine.expDate || '',
            totalUnits: 0,
            currentOwner: '',
            ownerHistory: [],
            status: result.medicine.status,
            dosage: result.medicine.dosage,
            description: result.medicine.description,
            composition: result.medicine.composition,
          },
        };
      }

      return {
        verified: false,
        error: result?.anomalies?.[0] || 'Medicine verification failed',
      };
    },
    [runVerification]
  );

  const addOwnedBatch = async (batchID: string, addedVia: 'SCAN_QR' | 'MANUAL' | 'PURCHASE_SYNC', options?: { quick?: boolean }) => {
    if (!batchID.trim()) {
      toast.error('Provide a batch ID or scan a QR code first');
      return;
    }

    if (options?.quick) {
      setQuickAddBatchID(batchID);
    } else {
      setAddingOwned(true);
    }

    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await customerAPI.addOwned(token, {
        batchID,
        addedVia,
      });

      if (response?.success) {
        setShowAddSuccess(true);
        setManualBatchID('');
        setTimeout(() => setShowAddSuccess(false), 2200);
        toast.success(options?.quick ? 'Added from purchased list' : 'Medicine added successfully');
        await loadCustomerData();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Unable to add owned medicine');
    } finally {
      setAddingOwned(false);
      setQuickAddBatchID(null);
    }
  };

  const handleAddOwnedMedicine = async () => {
    const batchID = addMode === 'MANUAL'
      ? manualBatchID.trim()
      : verificationResult?.medicine?.batchID || verifyInput.trim();

    await addOwnedBatch(batchID, addMode);
  };

  const handleQuickAddFromPurchased = async (batchID: string) => {
    await addOwnedBatch(batchID, 'PURCHASE_SYNC', { quick: true });
  };

  const sendAssistantMessage = async (overrideMessage?: string) => {
    const message = (overrideMessage || assistantInput).trim();
    if (!message || assistantBusy) return;

    if (!overrideMessage) {
      setAssistantInput('');
    }
    setAssistantMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      },
    ]);

    setAssistantBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await customerAPI.askAssistant(token, message);
      const content = String(response?.answer || 'I could not generate a response.');
      const emergency = Boolean(response?.emergency);
      const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];

      const finalResponse = emergency
        ? `${content}\n\nEmergency suggestion: Consult doctor immediately.`
        : `${content}${suggestions.length ? `\n\nNext steps: ${suggestions.join(' | ')}` : ''}`;

      setAssistantMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: finalResponse,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error: any) {
      setAssistantMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `I could not process that right now: ${error?.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="font-medium text-sm">Preparing your health dashboard...</p>
        </div>
      </div>
    );
  }

  const sectionCardClass =
    'rounded-[28px] border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28 sm:pb-12 pt-2 sm:pt-6">
      
      {/* Header & Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Customer Safety Hub
            </p>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hello, {user.name.split(' ')[0]}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-md text-sm sm:text-base">
            Manage your medicines, verify authenticity, and get AI-powered health insights.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-3xl mx-auto w-full z-20 mt-4 mb-2">
        <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-[28px] shadow-sm border border-slate-200 dark:border-slate-800 focus-within:shadow-md focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 transition-all duration-300">
          <Search className="absolute left-6 w-6 h-6 text-slate-400" />
          <input
            ref={globalSearchInputRef}
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                saveRecentSearch(globalSearch);
              }
            }}
            placeholder="Search medicine, batch, or manufacturer..."
            className="w-full bg-transparent border-none pl-16 pr-14 py-4 sm:py-5 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-0 rounded-[28px]"
          />
          {globalSearch && (
            <button 
              onClick={() => setGlobalSearch('')}
              className="absolute right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1"
            >
              <PlusCircle className="w-6 h-6 rotate-45" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-4 w-full overflow-hidden rounded-[24px] border border-slate-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-200 shadow-2xl backdrop-blur-xl z-30"
            >
              <div className="p-3">
                <p className="px-4 pb-2 pt-2 text-xs font-bold uppercase tracking-widest text-slate-400">Suggestions</p>
                {suggestions.map((option) => (
                  <button
                    key={`${option.label}-${option.value}`}
                    onClick={() => {
                      setGlobalSearch(option.value);
                      saveRecentSearch(option.value);
                    }}
                    className="w-full rounded-2xl px-4 py-3.5 text-left text-base font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-4 text-slate-700 dark:text-slate-200"
                  >
                    <Search className="w-5 h-5 text-emerald-500/70" />
                    {option.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loadWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">Partial data synced</p>
            <p className="mt-0.5 opacity-90">{loadWarnings.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Desktop Navigation */}
      <div className="hidden sm:flex overflow-hidden rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold transition-all ${
                active
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-emerald-500' : ''}`} /> {item.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-6"
        >
          {activeView === 'home' && (
            <div className="flex flex-col gap-4">
              {/* Quick Summary Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className={`${sectionCardClass} p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Purchased</p>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">{purchased.length}</p>
                  </div>
                </div>
                
                <div className={`${sectionCardClass} p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Owned</p>
                  </div>
                  <div className="mt-4">
                    <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">{owned.length}</p>
                  </div>
                </div>

                <div className={`col-span-2 md:col-span-1 ${sectionCardClass} p-5 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${suspiciousScansCount > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alerts</p>
                  </div>
                  <div className="mt-4">
                    <p className={`text-3xl sm:text-4xl font-black ${suspiciousScansCount > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{suspiciousScansCount}</p>
                  </div>
                </div>
              </div>

              {/* Insights */}
              <section className={`${sectionCardClass} p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daily Safety Brief</h3>
                    <p className="text-sm text-slate-500">Important notices for your medicines</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {todayInsights.map((insight) => (
                    <div key={insight} className="flex items-start gap-3 rounded-[16px] bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-700 dark:text-slate-300">
                      <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Purchased Auto-sync */}
              <section className={`${sectionCardClass} p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
                    <Hospital className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Purchases</h3>
                    <p className="text-sm text-slate-500">Automatically synced from trusted pharmacies</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredPurchased.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-12 text-center text-slate-500">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p>No recent purchases found.</p>
                    </div>
                  )}
                  {filteredPurchased.map((item) => (
                    <div key={`${item.batchID}-${item.purchaseDate}`} className="group rounded-[20px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${item.ownershipStatus === 'Verified' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                              {item.ownershipStatus}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Batch: {item.batchID}</span>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">{item.name}</h4>
                          <p className="text-sm text-slate-500">{item.manufacturer}</p>
                        </div>
                        <button
                          onClick={() => void handleQuickAddFromPurchased(item.batchID)}
                          disabled={Boolean(item.addedToOwned) || quickAddBatchID === item.batchID}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        >
                          {item.addedToOwned ? (
                            <><CheckCircle2 className="w-4 h-4" /> Added to Owned</>
                          ) : quickAddBatchID === item.batchID ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                          ) : (
                            <><PlusCircle className="w-4 h-4" /> Add to Tracker</>
                          )}
                        </button>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-xs font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-slate-400" /> {formatDateTime(item.purchaseDate)}</span>
                        <span className="inline-flex items-center gap-1.5"><Hospital className="w-4 h-4 text-slate-400" /> {item.pharmacy.email}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Add Manual/QR */}
              <section className={`${sectionCardClass} p-6 sm:p-8`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Track Other Medicines</h3>
                    <p className="text-sm text-slate-500">Add medicines manually or via QR scan</p>
                  </div>
                </div>

                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/50 p-1 mb-5 max-w-sm">
                  <button
                    onClick={() => setAddMode('SCAN_QR')}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${addMode === 'SCAN_QR' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Scan QR
                  </button>
                  <button
                    onClick={() => setAddMode('MANUAL')}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${addMode === 'MANUAL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Manual Entry
                  </button>
                </div>

                <div className="rounded-[20px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
                  {addMode === 'MANUAL' && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        value={manualBatchID}
                        onChange={(event) => setManualBatchID(event.target.value)}
                        placeholder="Enter Batch ID..."
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAddOwnedMedicine}
                        disabled={addingOwned}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold transition-colors disabled:opacity-50"
                      >
                        {addingOwned ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add to Tracker'}
                      </button>
                    </div>
                  )}

                  {addMode === 'SCAN_QR' && (
                    <div className="flex flex-col items-center py-6 text-center">
                      <ScanLine className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm">Use the Verify tab to scan your medicine first, then add the most recently verified batch to your list.</p>
                      <button
                        onClick={handleAddOwnedMedicine}
                        disabled={addingOwned}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-semibold transition-colors disabled:opacity-50"
                      >
                        {addingOwned ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Last Verified'}
                      </button>
                    </div>
                  )}
                  
                  <AnimatePresence>
                    {showAddSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="mt-4 overflow-hidden"
                      >
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 py-3 text-sm font-bold">
                          <CheckCircle2 className="w-5 h-5" /> Medicine securely added to your tracker!
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            </div>
          )}

          {activeView === 'verify' && (
            <section className={`${sectionCardClass} p-6 sm:p-10 min-h-[60vh] flex flex-col`}>
              <div className="text-center max-w-xl mx-auto mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">QR Scan & Verification</h3>
                <p className="text-slate-500 dark:text-slate-400">Instantly verify the authenticity, counterfeit risk, and complete chain of custody for your medicine.</p>
              </div>

              <div className="max-w-2xl mx-auto w-full space-y-4">
                <details className="group rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden" open>
                  <summary className="cursor-pointer flex items-center justify-between p-5 font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                    <span className="flex items-center gap-3"><ScanLine className="w-5 h-5 text-emerald-500" /> Use Camera Scanner</span>
                    <PlusCircle className="w-5 h-5 opacity-50 group-open:rotate-45 transition-transform" />
                  </summary>
                  <div className="p-5">
                    <VerifyMedicine medicines={[]} onVerify={handleScannerVerify} />
                  </div>
                </details>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">OR ENTER MANUALLY</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                </div>

                <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-sm">
                  <input
                    value={verifyInput}
                    onChange={(event) => setVerifyInput(event.target.value)}
                    placeholder="Paste QR payload, batch ID, or verification URL"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    value={packagingCode}
                    onChange={(event) => setPackagingCode(event.target.value)}
                    placeholder="Optional tamper code (e.g. SAFE-...)"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleManualVerification}
                    disabled={verifying || !verifyInput.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 font-bold transition-all disabled:opacity-50"
                  >
                    {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Run Verification Analysis'}
                  </button>
                </div>
              </div>

              {verificationResult && (
                <div className="mt-8 max-w-3xl mx-auto w-full">
                  <div className="rounded-[28px] border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {verificationResult.verified ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" /> VERIFIED GENUINE
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                              <AlertTriangle className="w-4 h-4" /> VERIFICATION FAILED
                            </span>
                          )}
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${verificationResult.counterfeitRisk === 'LOW' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                            Risk: {verificationResult.counterfeitRisk}
                          </span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-900 dark:text-white">
                          {verificationResult.medicine?.name || 'Unknown Product'}
                        </h4>
                        <p className="text-slate-500 mt-1">Batch: <span className="font-mono text-slate-700 dark:text-slate-300">{verificationResult.medicine?.batchID || verifyInput}</span></p>
                      </div>
                      
                      <div className="text-center p-4 rounded-[20px] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 min-w-[120px]">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Trust Score</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{verificationResult.trustScore ?? 'N/A'}<span className="text-sm font-medium text-slate-400">/100</span></p>
                      </div>
                    </div>

                    {verificationResult.anomalies.length > 0 && (
                      <div className="mb-8 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-5">
                        <p className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5" /> Detected Security Anomalies
                        </p>
                        <ul className="space-y-2">
                          {verificationResult.anomalies.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-200">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white mb-4">Chain of Custody</h5>
                      <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                        {verificationResult.chainOfCustody.map((step, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[23px] flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{step.action}</p>
                                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{step.actor} <span className="text-slate-400">({step.role})</span></p>
                              </div>
                              <span className="text-xs text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                {formatDateTime(step.timestamp)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeView === 'scans' && (
            <section className={`${sectionCardClass} p-6 sm:p-10 min-h-[60vh]`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Scan History</h3>
                  <p className="text-slate-500">Record of all your verification attempts</p>
                </div>
                <div className="inline-flex rounded-[14px] bg-slate-100 dark:bg-slate-800 p-1">
                  {(['ALL', 'VERIFIED', 'SUSPICIOUS'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setScanFilter(status)}
                      className={`px-4 py-2 text-xs font-bold tracking-wider rounded-[10px] transition-all ${scanFilter === status ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  value={scanSearch}
                  onChange={(event) => setScanSearch(event.target.value)}
                  placeholder="Filter history by batch or result..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-12 pr-4 py-3 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-3">
                {filteredScanHistory.map((entry) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row justify-between gap-4 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${entry.status === 'VERIFIED' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{entry.batchID}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.result}</p>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> {formatDateTime(entry.timestamp)}</p>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 sm:text-right hidden sm:block">
                      <p>{entry.location}</p>
                      <p className="text-xs">{entry.deviceId}</p>
                    </div>
                  </div>
                ))}
                {filteredScanHistory.length === 0 && (
                  <div className="py-20 text-center text-slate-500">
                    <History className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p>No scan history found for the current filters.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === 'owned' && (
            <section className={`${sectionCardClass} p-6 sm:p-10 min-h-[60vh]`}>
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                    <PackageCheck className="w-7 h-7 text-indigo-500" /> My Medicine Cabinet
                  </h3>
                  <p className="text-slate-500 mt-1">Track dosage, usage guidelines, and expiry dates safely.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-4 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-500/5 p-5">
                  <div className="p-4 rounded-2xl bg-white dark:bg-rose-500/20 shadow-sm text-rose-500">
                    <Clock3 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-500/80">Expiry Warnings</p>
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-400">{expiringSoonCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-500/5 p-5">
                  <div className="p-4 rounded-2xl bg-white dark:bg-indigo-500/20 shadow-sm text-indigo-500">
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500/80">Active Prescriptions</p>
                    <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{owned.length}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {filteredOwned.map((medicine) => (
                  <div key={medicine.batchID} className="group rounded-[28px] border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all">
                    
                    <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                      <div>
                        <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{medicine.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{medicine.batchID}</span>
                          <span>•</span>
                          <span>{medicine.manufacturer}</span>
                        </div>
                      </div>
                      
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Expiration</p>
                        <p className={`text-lg font-bold ${medicine.expiryAlertLevel === 'critical' || medicine.expiryAlertLevel === 'expired' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {medicine.expDate}
                        </p>
                        {medicine.daysUntilExpiry !== null && (
                          <p className="text-xs font-medium text-slate-500">{medicine.daysUntilExpiry} days left</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Dosage</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{medicine.dosage}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Usage</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{medicine.usageGuidelines}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Precautions</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{medicine.precautions}</p>
                      </div>
                    </div>

                    {(medicine.reminders.expiry || medicine.reminders.dosage) && (
                      <div className="mt-4 flex flex-col rounded-2xl border-2 border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-500 font-bold text-sm">
                          <Clock3 className="w-4 h-4" /> Active Reminders
                        </div>
                        <ul className="space-y-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                          {medicine.reminders.expiry && <li>• {medicine.reminders.expiry}</li>}
                          {medicine.reminders.dosage && <li>• {medicine.reminders.dosage}</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                {filteredOwned.length === 0 && (
                  <div className="py-20 text-center text-slate-500">
                    <Pill className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p>No owned medicines match your search.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeView === 'assistant' && (
            <section className={`${sectionCardClass} p-0 overflow-hidden flex flex-col h-[70vh] max-h-[800px] border-none shadow-[0_8px_40px_rgb(0,0,0,0.08)]`}>
              <div className="bg-slate-900 dark:bg-slate-950 p-6 flex items-center gap-4 text-white">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Bot className="w-6 h-6 text-fuchsia-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Health AI Assistant</h3>
                  <p className="text-sm text-slate-400">Ask about interactions, side effects, or dosages</p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-x-auto hide-scrollbar whitespace-nowrap space-x-2 flex">
                {assistantQuickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendAssistantMessage(prompt)}
                    disabled={assistantBusy}
                    className="inline-block rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-fuchsia-300 hover:text-fuchsia-600 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-slate-900">
                {assistantMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 flex items-center justify-center shrink-0 mr-3 mt-1">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-[24px] px-5 py-4 ${
                      message.role === 'user' 
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-tr-sm' 
                        : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-tl-sm text-slate-800 dark:text-slate-200'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{message.content}</p>
                      <p className={`text-[10px] mt-2 font-medium ${message.role === 'user' ? 'text-white/50 dark:text-slate-900/50' : 'text-slate-400'}`}>
                        {formatDateTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {assistantBusy && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 flex items-center justify-center shrink-0 mr-3">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="rounded-[24px] rounded-tl-sm bg-slate-50 dark:bg-slate-800/80 px-5 py-4 border border-slate-100 dark:border-slate-800">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                <div className="relative flex items-center">
                  <input
                    value={assistantInput}
                    onChange={(event) => setAssistantInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendAssistantMessage();
                      }
                    }}
                    placeholder="Type your health or medicine question here..."
                    className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-5 pr-14 py-4 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  />
                  <button
                    onClick={() => void sendAssistantMessage()}
                    disabled={assistantBusy || !assistantInput.trim()}
                    className="absolute right-2 p-2.5 rounded-full bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-6 left-4 right-4 z-40">
        <div className="flex items-center justify-between gap-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 p-2 backdrop-blur-xl shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex flex-col items-center justify-center w-full py-2 px-1 rounded-full transition-all ${
                  active
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${active ? 'fill-emerald-100 dark:fill-emerald-900/50' : ''}`} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
