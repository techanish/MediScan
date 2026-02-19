import { useEffect, useState } from 'react';
import { useUser, useAuth, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { Dashboard } from './components/Dashboard';
import { medicineAPI } from './utils/api';

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
  // New fields
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

export function App() {
  const { user: clerkUser, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(false);

  // Sync Clerk user with our User state
  useEffect(() => {
    if (isLoaded && clerkUser) {
      const role = (clerkUser.publicMetadata?.role as string) || 'CUSTOMER';
      const companyName = (clerkUser.publicMetadata?.companyName as string) || '';
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
      
      // Validate that user has a valid email address
      if (!primaryEmail) {
        console.error('User does not have a valid email address');
        return;
      }
      
      setUser({
        name: clerkUser.fullName || clerkUser.firstName || 'User',
        email: primaryEmail,
        role: role as User['role'],
        companyName: companyName,
        token: '', // Will be set when needed
      });
    } else if (isLoaded && !clerkUser) {
      setUser(null);
      setMedicines([]);
    }
  }, [clerkUser, isLoaded]);

  // Load medicines when user is authenticated
  useEffect(() => {
    const loadMedicines = async () => {
      if (!user) return;
      
      setIsLoadingMedicines(true);
      try {
        const token = await getToken();
        if (!token) return;

        // Load medicines based on user role
        let filters = {};
        
        if (user.role === 'CUSTOMER') {
          // Customers see their purchase history (no filters needed, backend handles it)
          filters = {};
        } else {
          // Non-customers see medicines they own
          filters = { owner: user.email };
        }
        
        const response = await medicineAPI.list(token, filters);
        
        if (response.success && response.medicines) {
          setMedicines(response.medicines);
        }
      } catch (error) {
        console.error('Failed to load medicines:', error);
      } finally {
        setIsLoadingMedicines(false);
      }
    };

    loadMedicines();
  }, [user, getToken]);

  const handleLogout = () => {
    setUser(null);
    setMedicines([]);
  };

  const handleRegisterMedicine = async (
    medicine: Omit<Medicine, 'currentOwner' | 'currentOwnerRole' | 'ownerHistory' | 'verified' >
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.role !== 'MANUFACTURER') {
      return { success: false, error: 'Only manufacturers can register medicines' };
    }

    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };

      console.log('Registering medicine:', medicine);
      console.log('Using token:', token ? 'Token present' : 'No token');

      const response = await medicineAPI.register(token, {
        batchID: medicine.batchID,
        name: medicine.name,
        manufacturer: medicine.manufacturer,
        mfgDate: medicine.mfgDate,
        expDate: medicine.expDate,
        totalUnits: medicine.totalUnits,
      });

      console.log('Register response:', response);

      if (response.success) {
        // Reload medicines to get the updated list
        // const listResponse = await medicineAPI.list(token, { owner: user.email });
        // if (listResponse.success && listResponse.medicines) {
        //   setMedicines(listResponse.medicines);
        // }
        console.log("Medicine registered successfully");
        return { success: true };
      }

      return { success: false, error: response.error || response.message || 'Registration failed from response back end.' };
    } catch (error: any) {
      console.error('Registration error:', error);
      return { success: false, error: error.message || 'Registration failed from back end' };
    }
  };
  // this did not fix that ?

  const handleTransfer = async (batchID: string, newOwnerEmail: string, newOwnerRole: string, unitsToTransfer: number) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const token = await getToken();
      if (!token) return { success: false, error: 'Failed to get authentication token' };

      const response = await medicineAPI.transfer(token, batchID, {
        newOwnerEmail,
        newOwnerRole,
        unitsToTransfer,
      });

      if (response.success) {
        // Reload medicines to get the updated list
        const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
        const listResponse = await medicineAPI.list(token, filters);
        if (listResponse.success && listResponse.medicines) {
          setMedicines(listResponse.medicines);
        }
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

      const response = await medicineAPI.purchase(token, batchID, {
        unitsPurchased,
        customerEmail,
      });

      if (response.success) {
        // Reload medicines to get the updated list
        const filters = user.role !== 'CUSTOMER' ? { owner: user.email } : {};
        const listResponse = await medicineAPI.list(token, filters);
        if (listResponse.success && listResponse.medicines) {
          setMedicines(listResponse.medicines);
        }
        return { success: true };
      }

      return { success: false, error: response.error || 'Purchase failed' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Purchase failed' };
    }
  };

  const handleVerify = async (
    batchID: string
  ): Promise<{ verified: boolean; medicine?: Medicine; error?: string }> => {
    try {
      console.log('🔍 Verifying medicine:', batchID);
      
      // Use the medicine list API with batchID parameter
      const token = await getToken();
      console.log('Token obtained:', !!token);
      
      if (!token) {
        console.error('No authentication token available');
        return { verified: false, error: 'Authentication required' };
      }

      console.log('Calling medicineAPI.list with batchID:', batchID);
      const response = await medicineAPI.list(token, { batchID });
      console.log('API response:', response);
      
      if (response.success && response.medicines && response.medicines.length > 0) {
        console.log('✅ Medicine found:', response.medicines[0]);
        return { verified: true, medicine: response.medicines[0] };
      }
      
      console.log('❌ Medicine not found in response');
      return { verified: false, error: 'Medicine not found in registry' };
    } catch (error: any) {
      console.error('❌ Verification error:', error);
      return { verified: false, error: error.message || 'Verification failed' };
    }
  };

  const getMedicineByBatch = (batchID: string) => {
    return medicines.find((m) => m.batchID === batchID);
  };

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">MediScan</h1>
              <p className="text-slate-600 dark:text-slate-400">Medicine Verification System</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Sign in to access the platform
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6">
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none",
                    main: "bg-transparent"
                  }
                }}
              />
            </div>
            <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-2">📌 Important: Setting Up User Roles</p>
              <p className="text-xs text-emerald-800 dark:text-emerald-400 mb-2">
                After signing up, you need to set your role in Clerk Dashboard:
              </p>
              <ol className="text-xs text-emerald-800 dark:text-emerald-400 space-y-1 ml-4 list-decimal">
                <li>Go to Clerk Dashboard → Users</li>
                <li>Click on your user</li>
                <li>Go to "Metadata" tab</li>
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
        {user && (
          <Dashboard
            user={user}
            medicines={medicines}
            isLoadingMedicines={isLoadingMedicines}
            onLogout={handleLogout}
            onRegisterMedicine={handleRegisterMedicine}
            onTransfer={handleTransfer}
            onPurchase={handlePurchase}
            onVerify={handleVerify}
            getMedicineByBatch={getMedicineByBatch}
          />
        )}
      </SignedIn>
    </>
  );
}
