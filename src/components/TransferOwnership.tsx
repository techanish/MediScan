import { useState, useEffect } from 'react';
import { ArrowRightLeft, Package, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import type { Medicine } from '../App';
import { companiesAPI } from '../utils/api';

interface TransferOwnershipProps {

  medicines: Medicine[];
  getToken: () => Promise<string | null>;
  onTransfer: (batchID: string, newOwnerEmail: string, newOwnerRole: string, unitsToTransfer: number) => Promise<{ success: boolean; error?: string }>;
  userEmail?: string;
}

interface Company {
  email: string;
  companyName: string;
  role: string;
}

// Helper to calculate available units for a user
const getAvailableUnits = (medicine: Medicine, userEmail?: string): number => {
  console.log('getAvailableUnits called:', {
    batchID: medicine.batchID,
    userEmail,
    currentOwner: medicine.currentOwner,
    remainingUnits: medicine.remainingUnits,
    ownerHistory: medicine.ownerHistory
  });
  
  if (!userEmail) {
    console.log('No userEmail, returning remainingUnits:', medicine.remainingUnits);
    return medicine.remainingUnits || 0;
  }
  
  // Always calculate from ownerHistory for accurate tracking
  let receivedUnits = 0;
  let transferredOutUnits = 0;
  let soldUnits = 0;
  
  medicine.ownerHistory.forEach(h => {
    console.log('Checking ownerHistory entry:', h);
    
    // Units received (either as manufacturer or via transfer)
    if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail.toLowerCase()) {
      receivedUnits += medicine.totalUnits || 0;
      console.log('Original owner, totalUnits:', medicine.totalUnits);
    }
    if (h.action === 'TRANSFERRED' && 
        h.owner.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      console.log('Received units:', h.unitsPurchased);
      receivedUnits += h.unitsPurchased;
    }
    
    // Units transferred out by this user
    if (h.action === 'TRANSFERRED' && 
        (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      console.log('Transferred out units:', h.unitsPurchased);
      transferredOutUnits += h.unitsPurchased;
    }
    
    // Units sold to customers by this user
    if (h.action === 'PURCHASED' && 
        (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      console.log('Sold units:', h.unitsPurchased);
      soldUnits += h.unitsPurchased;
    }
  });
  
  const available = receivedUnits - transferredOutUnits - soldUnits;
  console.log(`Total received: ${receivedUnits}, transferred out: ${transferredOutUnits}, sold: ${soldUnits}, available: ${available}`);
  return available;
};

export function TransferOwnership({ medicines, getToken, onTransfer, userEmail }: TransferOwnershipProps) {
  const [formData, setFormData] = useState({
    batchID: '',
    selectedCompany: '',
    unitsToTransfer: '',
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const token = await getToken();
        if (!token) {
          console.error('No token available for companies list');
          return;
        }

        console.log('Fetching companies list...');
        const response = await companiesAPI.list(token);
        console.log('Companies response:', response);
        
        if (response.success && response.companies) {
          console.log(`Loaded ${response.companies.length} companies:`, response.companies);
          setCompanies(response.companies);
        } else {
          console.error('Failed to load companies:', response);
        }
      } catch (error) {
        console.error('Failed to load companies:', error);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    loadCompanies();
  }, [getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (!formData.selectedCompany) {
      setMessage({ type: 'error', text: 'Please select a company' });
      setIsLoading(false);
      return;
    }

    const units = parseInt(formData.unitsToTransfer);
    if (isNaN(units) || units <= 0) {
      setMessage({ type: 'error', text: 'Please enter valid units' });
      setIsLoading(false);
      return;
    }

    if (selectedMedicine) {
      const availableUnits = getAvailableUnits(selectedMedicine, userEmail);
      if (units > availableUnits) {
        setMessage({ type: 'error', text: `Only ${availableUnits} units available` });
        setIsLoading(false);
        return;
      }
    }

    const selectedCompany = companies.find(c => c.email === formData.selectedCompany);
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'Invalid company selected' });
      setIsLoading(false);
      return;
    }

    const result = await onTransfer(
      formData.batchID,
      selectedCompany.email,
      selectedCompany.role,
      units
    );

    if (result.success) {
      setMessage({ type: 'success', text: `${units} units transferred successfully!` });
      setFormData({ batchID: '', selectedCompany: '', unitsToTransfer: '' });
      setSelectedMedicine(null);
    } else {
      setMessage({ type: 'error', text: result.error || 'Transfer failed' });
    }
    setIsLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
          Transfer Ownership
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Transfer medicine ownership to another party</p>
      </div>

      {medicines.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">You don't own any medicines to transfer</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
          {message && (
            <div
              className={`flex items-center gap-2 p-4 rounded-xl ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-900/50 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Medicine</label>
            <div className="relative">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={formData.batchID}
                onChange={(e) => {
                  const selected = medicines.find(m => m.batchID === e.target.value);
                  setSelectedMedicine(selected || null);
                  setFormData({ ...formData, batchID: e.target.value, unitsToTransfer: '' });
                }}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none text-slate-900 dark:text-white"
                required
              >
                <option value="">Select a medicine batch</option>
                {medicines.map((med) => {
                  const availableUnits = getAvailableUnits(med, userEmail);
                  return (
                    <option key={med.batchID} value={med.batchID}>
                      {med.batchID} - {med.name} ({availableUnits} units available)
                    </option>
                  );
                })}
              </select>
            </div>
            {selectedMedicine && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Available: {getAvailableUnits(selectedMedicine, userEmail)} units
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Transfer To Company</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <select
                value={formData.selectedCompany}
                onChange={(e) => setFormData({ ...formData, selectedCompany: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none text-slate-900 dark:text-white"
                required
                disabled={isLoadingCompanies}
              >
                <option value="">
                  {isLoadingCompanies ? 'Loading companies...' : 'Select a company'}
                </option>
                {companies.map((company) => (
                  <option key={company.email} value={company.email}>
                    {company.companyName} ({company.role})
                  </option>
                ))}
              </select>
            </div>
            {companies.length === 0 && !isLoadingCompanies && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No companies found. Ask other users to set their company name in their profile.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Number of Units to Transfer</label>
            <div className="relative">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                value={formData.unitsToTransfer}
                onChange={(e) => setFormData({ ...formData, unitsToTransfer: e.target.value })}
                max={selectedMedicine ? getAvailableUnits(selectedMedicine, userEmail) : undefined}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
                required
                disabled={!formData.batchID}
              />
            </div>
            {selectedMedicine && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Max: {getAvailableUnits(selectedMedicine, userEmail)} units
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Transfer Ownership
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
