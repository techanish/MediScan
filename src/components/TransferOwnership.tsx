import React, { useState, useEffect } from 'react';
import { Truck, AlertCircle, CheckCircle } from 'lucide-react';
import type { Medicine } from '../App';
import { companiesAPI } from '../utils/api';
import { getAvailableUnits } from '../utils/units';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface TransferOwnershipProps {
  medicines: Medicine[];
  getToken: () => Promise<string | null>;
  onTransfer: (
    batchID: string,
    newOwnerEmail: string,
    newOwnerRole: string,
    unitsToTransfer: number,
    fromLocation?: string,
    toLocation?: string
  ) => Promise<{ success: boolean; error?: string }>;
  userEmail?: string;
}

interface Company {
  email: string;
  companyName: string;
  role: string;
}

export function TransferOwnership({ medicines, getToken, onTransfer, userEmail }: TransferOwnershipProps) {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedCompanyEmail, setSelectedCompanyEmail] = useState('');
  const [quantity, setQuantity] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const selectedMedicine = medicines.find(m => m.batchID === selectedBatch);
  const selectedCompany = companies.find(c => c.email === selectedCompanyEmail);

  // Consistent dropdown styling from Tickets page
  const selectTriggerClass = 'w-full border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-100 shadow-sm';

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await companiesAPI.list(token);
        if (response.success && response.companies) {
          setCompanies(response.companies);
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
    if (!selectedMedicine || !selectedCompany) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const available = getAvailableUnits(selectedMedicine, userEmail);
    if (qty > available) {
      toast.error(`Only ${available} units available`);
      return;
    }

    if (!toLocation.trim()) {
      toast.error('Please enter destination location');
      return;
    }

    setIsLoading(true);
    const result = await onTransfer(
      selectedBatch,
      selectedCompany.email,
      selectedCompany.role,
      qty,
      fromLocation.trim() || selectedMedicine.location || '',
      toLocation.trim()
    );
    setIsLoading(false);

    if (result.success) {
      toast.success(`Transferred ${qty} units to ${selectedCompany.companyName}`);
      setSelectedBatch('');
      setSelectedCompanyEmail('');
      setQuantity('');
      setFromLocation('');
      setToLocation('');
    } else {
      toast.error(result.error || 'Transfer failed');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transfer Stock</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Move inventory to distributors or pharmacies</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Batch</label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select a batch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines.length > 0 ? (
                      medicines.map((m) => {
                        const available = getAvailableUnits(m, userEmail);
                        return (
                          <SelectItem key={m.batchID} value={m.batchID} disabled={available <= 0}>
                            {m.name} ({m.batchID}) — {available} units available
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>No medicines available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transfer To Company</label>
                <Select value={selectedCompanyEmail} onValueChange={setSelectedCompanyEmail} disabled={isLoadingCompanies}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={isLoadingCompanies ? 'Loading companies...' : 'Select a company...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.length > 0 ? (
                      companies.map((c) => (
                        <SelectItem key={c.email} value={c.email}>
                          {c.companyName} ({c.role})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        {isLoadingCompanies ? 'Loading...' : 'No companies found'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {companies.length === 0 && !isLoadingCompanies && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No companies found. Ask other users to set their company name in profile.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity to Transfer</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  min="1"
                  max={selectedMedicine ? getAvailableUnits(selectedMedicine, userEmail) : undefined}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  required
                />
                {selectedMedicine && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    Max available: {getAvailableUnits(selectedMedicine, userEmail)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Location</label>
                <input
                  type="text"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  placeholder={selectedMedicine?.location || 'e.g. Hyderabad Warehouse'}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Destination Location</label>
                <input
                  type="text"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="e.g. Bengaluru DC-1"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !selectedBatch || !selectedCompanyEmail || !quantity}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Truck className="w-5 h-5" />
                    Initiate Transfer
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="md:col-span-1 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Transfer Policy
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400 opacity-90 leading-relaxed">
              Ownership transfers are recorded on the blockchain and cannot be undone. Ensure the recipient is correct before proceeding.
            </p>
          </div>

          <AnimatePresence>
            {selectedMedicine && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Batch Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Name</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedMedicine.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Expiry</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{selectedMedicine.expDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Manufacturer</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate ml-2">{selectedMedicine.manufacturer}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400">Status</span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
