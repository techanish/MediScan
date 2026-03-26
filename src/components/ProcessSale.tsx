import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, IndianRupee, Mail, Package2, Receipt, Search, ShoppingCart } from 'lucide-react';
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

interface SaleInventoryItem {
  medicine: Medicine;
  availableUnits: number;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const saleInventory = useMemo<SaleInventoryItem[]>(() => {
    return medicines
      .map((medicine) => ({
        medicine,
        availableUnits: getAvailableUnits(medicine, user.email),
      }))
      .filter((item) => item.availableUnits > 0)
      .sort((a, b) => a.medicine.name.localeCompare(b.medicine.name));
  }, [medicines, user.email]);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return saleInventory;
    return saleInventory.filter(({ medicine }) => {
      const name = medicine.name?.toLowerCase() || '';
      const batch = medicine.batchID?.toLowerCase() || '';
      const manufacturer = medicine.manufacturer?.toLowerCase() || '';
      return name.includes(q) || batch.includes(q) || manufacturer.includes(q);
    });
  }, [saleInventory, searchQuery]);

  const selectedInventoryItem = saleInventory.find((item) => item.medicine.batchID === selectedBatch);
  const selectedMedicine = selectedInventoryItem?.medicine;
  const availableUnits = selectedInventoryItem?.availableUnits ?? 0;
  const quantityNumber = Number.parseInt(quantity, 10);
  const isQuantityValid = Number.isInteger(quantityNumber) && quantityNumber > 0 && quantityNumber <= availableUnits;
  const lineTotal = selectedMedicine && isQuantityValid
    ? quantityNumber * (selectedMedicine.price || 0)
    : 0;

  useEffect(() => {
    if (!isSelectOpen) return;

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isSelectOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) {
      toast.error('Please select a medicine from inventory');
      return;
    }

    if (!isQuantityValid) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const email = customerEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Customer email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid customer email');
      return;
    }

    setIsLoading(true);
    const result = await onSale(selectedBatch, quantityNumber, email);
    setIsLoading(false);

    if (result.success) {
      toast.success(`Sold ${quantityNumber} units successfully`);
      setQuantity('');
      setCustomerEmail('');
      setSelectedBatch('');
      setSearchQuery('');
    } else {
      toast.error(result.error || 'Sale failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-50 via-white to-teal-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 p-6 lg:p-8 shadow-lg shadow-emerald-100/40 dark:shadow-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
              <ShoppingCart className="h-3.5 w-3.5" />
              Sales Console
            </div>
            <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">Process Sale</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Select inventory, set quantity, and issue a completed sale record.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Batches Available</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{saleInventory.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Units in Selection</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{availableUnits}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg shadow-gray-200/50 dark:shadow-none">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Search & Choose Product</label>
            <div className="relative">
              <Select
                value={selectedBatch}
                onOpenChange={(open) => {
                  setIsSelectOpen(open);
                  if (open) {
                    setSearchQuery('');
                  }
                }}
                onValueChange={(value) => {
                  setSelectedBatch(value);
                  setSearchQuery('');
                }}
              >
                <SelectTrigger className="w-full bg-white dark:bg-gray-700">
                  <SelectValue placeholder="Choose a batch and search inside dropdown" />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Search medicine or batch"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                      />
                    </div>
                  </div>

                  {filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                      <SelectItem
                        key={item.medicine.batchID}
                        value={item.medicine.batchID}
                        className="mx-1 my-0.5 rounded-lg border border-transparent px-2.5 py-1.5 pr-8 data-[state=checked]:border-emerald-200 data-[state=checked]:bg-emerald-50 dark:data-[state=checked]:border-emerald-900/60 dark:data-[state=checked]:bg-emerald-900/20"
                      >
                        <p className="w-full truncate text-sm text-gray-700 dark:text-gray-200">
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{item.medicine.name}</span>
                          <span className="mx-1.5 text-gray-400">•</span>
                          <span>Batch {item.medicine.batchID}</span>
                          <span className="mx-1.5 text-gray-400">•</span>
                          <span>{item.availableUnits}u</span>
                          <span className="mx-1.5 text-gray-400">•</span>
                          <span className="font-medium text-emerald-700 dark:text-emerald-300">INR {(item.medicine.price || 0).toFixed(2)}</span>
                        </p>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-match" disabled>No matching inventory</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {!saleInventory.length && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                No saleable inventory is available for your account.
              </div>
            )}
            {saleInventory.length > 0 && !selectedBatch && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Select one item from the search results to continue.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sale-quantity" className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Quantity</label>
              <input
                id="sale-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                max={availableUnits || undefined}
                placeholder="Enter units"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Max available: <span className="font-semibold text-gray-700 dark:text-gray-200">{availableUnits}</span>
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Fill</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 5, availableUnits].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(String(preset))}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                  >
                    {preset === availableUnits ? 'MAX' : preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedMedicine && !isQuantityValid && quantity && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Quantity must be between 1 and {availableUnits} for this batch.
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Customer Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg shadow-gray-200/40 dark:shadow-none">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sale Summary</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Batch</span>
              <span className="font-semibold text-gray-900 dark:text-white">{selectedMedicine?.batchID || '--'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Product</span>
              <span className="max-w-40 truncate font-semibold text-gray-900 dark:text-white">{selectedMedicine?.name || '--'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Unit Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">₹{(selectedMedicine?.price || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Quantity</span>
              <span className="font-semibold text-gray-900 dark:text-white">{isQuantityValid ? quantityNumber : 0}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total Amount</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
              <IndianRupee className="h-5 w-5" />
              {lineTotal.toFixed(2)}
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedBatch || !quantity || !customerEmail || !isQuantityValid || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
          >
            {isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Receipt className="h-5 w-5" />
                Complete Sale
              </>
            )}
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Package2 className="h-4 w-4" />
            Sale will be recorded with stock history and notifications.
          </div>
        </aside>
      </form>
    </div>
  );
}
