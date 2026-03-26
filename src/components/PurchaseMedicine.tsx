import { useState } from 'react';
import { ShoppingCart, Package, User, CheckCircle2, AlertCircle, Box } from 'lucide-react';
import type { Medicine } from '../App';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const DEFAULT_CUSTOMER_EMAIL = 'CUSTOMER';

interface PurchaseMedicineProps {
  medicines: Medicine[];
  onPurchase: (batchID: string, unitsPurchased: number, customerEmail: string) => Promise<{ success: boolean; error?: string }>;
  userEmail?: string;
}

// Helper to calculate available units for a user
const getAvailableUnits = (medicine: Medicine, userEmail?: string): number => {
  if (!userEmail) return medicine.remainingUnits || 0;
  
  // Always calculate from ownerHistory for accurate tracking
  let receivedUnits = 0;
  let transferredOutUnits = 0;
  let soldUnits = 0;
  
  medicine.ownerHistory.forEach(h => {
    // Units received (either as manufacturer or via transfer)
    if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail.toLowerCase()) {
      receivedUnits += medicine.totalUnits || 0;
    }
    if (h.action === 'TRANSFERRED' && 
        h.owner.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      receivedUnits += h.unitsPurchased;
    }
    
    // Units transferred out by this user
    if (h.action === 'TRANSFERRED' && 
        (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      transferredOutUnits += h.unitsPurchased;
    }
    
    // Units sold to customers by this user
    if (h.action === 'PURCHASED' && 
        (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
        h.unitsPurchased) {
      soldUnits += h.unitsPurchased;
    }
  });
  
  return receivedUnits - transferredOutUnits - soldUnits;
};

export function PurchaseMedicine({ medicines, onPurchase, userEmail }: PurchaseMedicineProps) {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [unitsPurchased, setUnitsPurchased] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Consistent dropdown styling from Tickets page
  const selectTriggerClass = 'w-full border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-100 shadow-sm';

  const selectedMedicine = medicines.find((m) => m.batchID === selectedBatch);
  const availableStock = selectedMedicine ? getAvailableUnits(selectedMedicine, userEmail) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    // Parse units as integer, handling empty string
    const units = unitsPurchased.trim() === '' ? 0 : parseInt(unitsPurchased.trim(), 10);

    if (!selectedBatch) {
      setMessage({ type: 'error', text: 'Please select a medicine batch' });
      setIsLoading(false);
      return;
    }

    if (isNaN(units) || units <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid number of units' });
      setIsLoading(false);
      return;
    }

    if (units > availableStock) {
      setMessage({ type: 'error', text: `Only ${availableStock} units available` });
      setIsLoading(false);
      return;
    }

    const result = await onPurchase(selectedBatch, units, customerEmail.trim() || DEFAULT_CUSTOMER_EMAIL);

    if (result.success) {
      setMessage({ type: 'success', text: `Successfully sold ${units} units!` });
      setUnitsPurchased('');
      setCustomerEmail('');
      setSelectedBatch('');
    } else {
      setMessage({ type: 'error', text: result.error || 'Purchase failed' });
    }
    
    setIsLoading(false);
  };

  const getStockStatus = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (remaining === 0) {
      return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-100' };
    } else if (percentage < 20) {
      return { label: 'Low Stock', color: 'text-amber-600', bgColor: 'bg-amber-100' };
    } else {
      return { label: 'In Stock', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-emerald-500" />
          Process Sale / Reduce Stock
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Sell medicine units to customers and update inventory</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Medicine Batch</label>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className={selectTriggerClass} aria-label="Select Medicine Batch">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="-- Select a batch --" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {medicines
                .filter((m) => {
                  const available = getAvailableUnits(m, userEmail);
                  return m.status === 'ACTIVE' && available > 0;
                })
                .map((medicine) => (
                  <SelectItem key={medicine.batchID} value={medicine.batchID}>
                    {medicine.batchID} - {medicine.name} ({getAvailableUnits(medicine, userEmail)} units available)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMedicine && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">Medicine:</p>
                <p className="text-slate-900 dark:text-white">{selectedMedicine.name}</p>
              </div>
              <div>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">Manufacturer:</p>
                <p className="text-slate-900 dark:text-white">{selectedMedicine.manufacturer}</p>
              </div>
              <div>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">Available Stock:</p>
                <p className="text-slate-900 dark:text-white flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  {availableStock} / {selectedMedicine.totalUnits} units
                  <span className={`text-xs px-2 py-0.5 rounded ${getStockStatus(availableStock, selectedMedicine.totalUnits).bgColor} ${getStockStatus(availableStock, selectedMedicine.totalUnits).color}`}>
                    {getStockStatus(availableStock, selectedMedicine.totalUnits).label}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">Expiry Date:</p>
                <p className="text-slate-900 dark:text-white">{selectedMedicine.expDate}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Units to Sell</label>
          <div className="relative">
            <Box className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="number"
              value={unitsPurchased}
              onChange={(e) => setUnitsPurchased(e.target.value)}
              placeholder="Enter number of units"
              min="1"
              max={availableStock}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
              required
              disabled={!selectedBatch}
            />
          </div>
          {selectedBatch && availableStock > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Maximum: {availableStock} units</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Customer Email (Optional)</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com (optional)"
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Leave blank to record as generic CUSTOMER purchase</p>
        </div>

        <button
          type="submit"
          disabled={isLoading || !selectedBatch}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Process Sale
            </>
          )}
        </button>
      </form>
    </div>
  );
}
