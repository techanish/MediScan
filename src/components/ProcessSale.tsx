import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, IndianRupee, Mail, Package2, Plus, Receipt, Search, ShoppingCart, Trash2 } from 'lucide-react';
import type { Medicine, User } from '../App';
import { downloadInvoicePdf } from './Invoice';
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
  onSale: (batchID: string, quantity: number, customerEmail: string, transactionId?: string) => Promise<{ success: boolean; error?: string }>;
}

interface SaleInventoryItem {
  medicine: Medicine;
  availableUnits: number;
}

interface SaleLineItem {
  batchID: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
}

interface CompletedSale {
  transactionId: string;
  items: SaleLineItem[];
  totalUnits: number;
  totalPrice: number;
  dateTime: string;
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
  const [selectionError, setSelectionError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [apiError, setApiError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleLineItem[]>([]);
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
  const quantityAlreadyAdded = saleItems.find((item) => item.batchID === selectedBatch)?.quantity ?? 0;
  const remainingUnits = Math.max(0, availableUnits - quantityAlreadyAdded);
  const quantityNumber = Number.parseInt(quantity, 10);
  const isQuantityValid = Number.isInteger(quantityNumber) && quantityNumber > 0 && quantityNumber <= remainingUnits;
  const lineTotal = selectedMedicine && isQuantityValid
    ? quantityNumber * (selectedMedicine.price || 0)
    : 0;
  const saleGrandTotal = saleItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalUnitsInCart = saleItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!isSelectOpen) return;

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isSelectOpen]);

  const createTransactionId = () => {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `TXN-${Date.now()}-${rand}`;
  };

  const downloadInvoice = async () => {
    if (!completedSale) return;

    setIsDownloadingInvoice(true);
    setApiError('');
    try {
      const explorerUrl = new URL(window.location.href);
      explorerUrl.searchParams.set('tab', 'blockchain');
      explorerUrl.searchParams.set('tx', completedSale.transactionId);

      await downloadInvoicePdf({
        transactionId: completedSale.transactionId,
        items: completedSale.items,
        totalUnits: completedSale.totalUnits,
        totalPrice: completedSale.totalPrice,
        dateTime: completedSale.dateTime,
        customerEmail,
        blockchainExplorerUrl: explorerUrl.toString(),
      });
    } catch {
      setApiError('Failed to generate invoice PDF. Please try again.');
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleAddMedicine = () => {
    setSelectionError('');
    setQuantityError('');
    setApiError('');

    if (!selectedMedicine) {
      setSelectionError('Please select a medicine from inventory.');
      return;
    }

    if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
      setQuantityError('Quantity must be greater than 0.');
      return;
    }

    if (quantityNumber > remainingUnits) {
      setQuantityError(`Out of stock. Only ${remainingUnits} units available for this batch.`);
      return;
    }

    setSaleItems((prev) => {
      const index = prev.findIndex((item) => item.batchID === selectedBatch);
      if (index === -1) {
        return [
          ...prev,
          {
            batchID: selectedBatch,
            medicineName: selectedMedicine.name,
            quantity: quantityNumber,
            unitPrice: selectedMedicine.price || 0,
          },
        ];
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        quantity: next[index].quantity + quantityNumber,
      };
      return next;
    });

    setQuantity('');
  };

  const handleRemoveMedicine = (batchID: string) => {
    setSaleItems((prev) => prev.filter((item) => item.batchID !== batchID));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setSelectionError('');
    setQuantityError('');
    setEmailError('');
    setApiError('');

    if (!saleItems.length) {
      setApiError('Please add at least one medicine to the sale.');
      return;
    }

    const email = customerEmail.trim().toLowerCase();
    if (!email) {
      setEmailError('Customer email is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid customer email.');
      return;
    }

    try {
      setIsLoading(true);
      const transactionId = createTransactionId();
      for (const item of saleItems) {
        const result = await onSale(item.batchID, item.quantity, email, transactionId);
        if (!result.success) {
          setApiError(result.error || `Sale failed for ${item.medicineName} (${item.batchID}).`);
          return;
        }
      }

      {
        const totalPrice = saleItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const totalUnits = saleItems.reduce((sum, item) => sum + item.quantity, 0);
        const dateTime = new Date().toLocaleString();

        setCompletedSale({
          transactionId,
          items: saleItems,
          totalUnits,
          totalPrice,
          dateTime,
        });

        toast.success('Process sale completed');
        setShowSuccessModal(true);
        setSaleItems([]);
        setQuantity('');
        setCustomerEmail('');
        setSelectedBatch('');
        setSearchQuery('');
      }
    } catch {
      setApiError('API failure while processing the sale. Please retry.');
    } finally {
      setIsLoading(false);
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
              <p className="text-xs text-gray-500 dark:text-gray-400">Units Remaining</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{remainingUnits}</p>
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
                  setSelectionError('');
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
            {!!selectionError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{selectionError}</p>
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
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setQuantityError('');
                }}
                min="1"
                max={availableUnits || undefined}
                placeholder="Enter units"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Max available now: <span className="font-semibold text-gray-700 dark:text-gray-200">{remainingUnits}</span>
              </p>
              {!!quantityError && (
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{quantityError}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Fill</label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 5, availableUnits].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setQuantity(String(preset));
                      setQuantityError('');
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                  >
                    {preset === availableUnits ? 'MAX' : preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-900/10 p-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Add Selected Medicine</p>
              <p className="text-xs text-emerald-700/90 dark:text-emerald-400">Build a multi-item sale before processing.</p>
            </div>
            <button
              type="button"
              onClick={handleAddMedicine}
              disabled={!selectedBatch || !quantity || !isQuantityValid || isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Medicine
            </button>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Added Medicines</h4>
            {saleItems.length ? (
              <div className="space-y-2">
                {saleItems.map((item) => (
                  <div key={item.batchID} className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.medicineName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Batch {item.batchID} • Qty {item.quantity} • INR {(item.quantity * item.unitPrice).toFixed(2)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(item.batchID)}
                      className="ml-2 rounded-lg p-1.5 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/20"
                      aria-label={`Remove ${item.medicineName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                No medicines added yet.
              </p>
            )}
          </div>

          {selectedMedicine && !quantityError && !isQuantityValid && quantity && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Quantity must be between 1 and {remainingUnits} for this batch.
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">Customer Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value);
                  setEmailError('');
                }}
                placeholder="customer@example.com"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
              />
            </div>
            {!!emailError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{emailError}</p>
            )}
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg shadow-gray-200/40 dark:shadow-none">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Sale Summary</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Added Medicines</span>
              <span className="font-semibold text-gray-900 dark:text-white">{saleItems.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total Units</span>
              <span className="font-semibold text-gray-900 dark:text-white">{totalUnitsInCart}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
              <span className="text-sm text-gray-600 dark:text-gray-300">Current Selection</span>
              <span className="max-w-40 truncate font-semibold text-gray-900 dark:text-white">{selectedMedicine?.name || '--'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total Amount</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
              <IndianRupee className="h-5 w-5" />
              {(saleItems.length ? saleGrandTotal : lineTotal).toFixed(2)}
            </p>
          </div>

          <button
            type="submit"
            disabled={!saleItems.length || !customerEmail || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
          >
            {isLoading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processing...
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5" />
                Process Sale
              </>
            )}
          </button>

          {!!apiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300">
              {apiError}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Package2 className="h-4 w-4" />
            Sale will be recorded with stock history and notifications.
          </div>
        </aside>
      </form>

      {showSuccessModal && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-gray-800 p-6 shadow-2xl animate-[fadeScaleIn_0.4s_ease-out]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 animate-[popCheck_0.45s_ease-out]" />
            </div>

            <h3 className="text-center text-xl font-bold text-gray-900 dark:text-white">Process Sale Completed</h3>
            <p className="mt-1 text-center text-sm text-gray-600 dark:text-gray-300">Transaction ID: {completedSale.transactionId}</p>

            <div className="mt-4 space-y-2 rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm">
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-200">
                <span>Items</span>
                <span className="font-semibold">{completedSale.items.length}</span>
              </div>
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-200">
                <span>Total Units</span>
                <span className="font-semibold">{completedSale.totalUnits}</span>
              </div>
              <div className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                <span>Total</span>
                <span className="font-bold">INR {completedSale.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-3 max-h-28 space-y-1 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 p-2 text-xs text-gray-700 dark:text-gray-200">
              {completedSale.items.map((item) => (
                <div key={item.batchID} className="flex items-center justify-between">
                  <span className="truncate pr-2">{item.medicineName} ({item.batchID})</span>
                  <span className="font-semibold">x{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={downloadInvoice}
                disabled={isDownloadingInvoice}
                className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloadingInvoice ? (
                  'Generating PDF...'
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Invoice (PDF)
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeScaleIn {
          0% { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes popCheck {
          0% { opacity: 0; transform: scale(0.5); }
          70% { opacity: 1; transform: scale(1.12); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
