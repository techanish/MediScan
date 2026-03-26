import React, { useState } from 'react';
import { ShoppingCart, Search, Receipt } from 'lucide-react';
import type { Medicine, User } from '../App';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ProcessSaleProps {
  medicines: Medicine[];
  user: User;
  onSale: (batchID: string, quantity: number, customerEmail: string) => Promise<{ success: boolean; error?: string }>;
}

const getAvailableUnits = (medicine: Medicine, userEmail: string): number => {
  const owner = userEmail.toLowerCase();
  let received = 0;
  let transferredOut = 0;
  let sold = 0;

  (medicine.ownerHistory || []).forEach((h) => {
    if (h.action === 'REGISTERED' && h.owner?.toLowerCase() === owner) {
      received += medicine.totalUnits || 0;
    }
    if (h.action === 'TRANSFERRED' && h.owner?.toLowerCase() === owner) {
      received += h.unitsPurchased || 0;
    }
    if (h.action === 'TRANSFERRED' && h.from?.toLowerCase() === owner) {
      transferredOut += h.unitsPurchased || 0;
    }
    if (h.action === 'PURCHASED' && h.from?.toLowerCase() === owner) {
      sold += h.unitsPurchased || 0;
    }
  });

  return Math.max(0, Number(received) - Number(transferredOut) - Number(sold));
};

export function ProcessSale({ medicines, user, onSale }: ProcessSaleProps) {
  const [selectedBatch, setSelectedBatch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Consistent dropdown styling from Tickets page
  const selectTriggerClass = 'w-full border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-100 shadow-sm';

  // Mirror the backend logic: show medicines where user has available units
  const myMedicines = medicines.filter(m => {
    const userEmail = user.email.toLowerCase();
    let received = 0, out = 0, sold = 0;
    (m.ownerHistory || []).forEach(h => {
      if (h.action === 'REGISTERED' && h.owner?.toLowerCase() === userEmail) received += m.totalUnits || 0;
      if (h.action === 'TRANSFERRED' && h.owner?.toLowerCase() === userEmail) received += h.unitsPurchased || 0;
      if (h.action === 'TRANSFERRED' && h.from?.toLowerCase() === userEmail) out += h.unitsPurchased || 0;
      if (h.action === 'PURCHASED' && h.from?.toLowerCase() === userEmail) sold += h.unitsPurchased || 0;
    });
    return (received - out - sold) > 0;
  });
  const selectedMedicine = myMedicines.find(m => m.batchID === selectedBatch);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setIsLoading(true);
    const result = await onSale(selectedBatch, qty, customerEmail);
    setIsLoading(false);

    if (result.success) {
      toast.success(`Sold ${qty} units successfully`);
      setQuantity('');
      setCustomerEmail('');
      setSelectedBatch('');
    } else {
      toast.error(result.error || 'Sale failed');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-400">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Process Sale</h2>
        <p className="text-gray-500 dark:text-gray-400">Record a sale to a customer or patient</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Product</label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className={selectTriggerClass}>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <SelectValue placeholder="Search inventory..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                {myMedicines.length > 0 ? (
                  myMedicines.map(m => (
                    <SelectItem key={m.batchID} value={m.batchID}>
                      {m.name} ({m.batchID}) - ₹{(m.price || 0).toFixed(2)}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No inventory available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="sale-quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
              <input
                id="sale-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-gray-900 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Total Price</label>
              <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 font-medium">
                {selectedMedicine && quantity
                  ? `₹${(parseInt(quantity) * (selectedMedicine.price || 0)).toFixed(2)}`
                  : '₹0.00'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Email <span className="text-gray-400 font-normal">(Required)</span>
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={!selectedBatch || !quantity || !customerEmail || isLoading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Complete Sale
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
