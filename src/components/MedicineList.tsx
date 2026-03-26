import React, { useState } from 'react';
import type { Medicine } from '../App';
import { Search, AlertCircle, CheckCircle, Package, Download, Trash2, AlertTriangle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { MedicineDetailsModal } from './MedicineDetailsModal';
import { formatDate } from './Dashboard';
import { getAvailableUnits } from '../utils/units';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface MedicineListProps {
  medicines: Medicine[];
  onNavigate?: (tab: string) => void;
  isLoading?: boolean;
  userEmail?: string;
}

const PAGE_SIZE = 10;

export function MedicineList({ medicines, onNavigate, isLoading, userEmail }: MedicineListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewingMedicine, setViewingMedicine] = useState<Medicine | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const categories = Array.from(new Set(medicines.map(m => m.category).filter(Boolean))) as string[];

  const filteredMedicines = medicines.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchID.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMedicines.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMedicines = filteredMedicines.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filters change
  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, categoryFilter]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedItems(e.target.checked ? paginatedMedicines.map(m => m.batchID) : []);
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleExport = () => {
    if (filteredMedicines.length === 0) return;
    const dataToExport = filteredMedicines.map((item) => ({
      batchID: item.batchID,
      name: item.name,
      manufacturer: item.manufacturer,
      totalUnits: item.totalUnits,
      availableUnits: getAvailableUnits(item, userEmail),
      status: item.status,
      category: item.category,
      price: item.price,
      mfgDate: formatDate(item.mfgDate),
      expDate: formatDate(item.expDate),
    }));
    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${v ?? ''}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'inventory_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredMedicines.length} records successfully`);
  };

  const handleBulkDelete = () => {
    if (selectedItems.length === 0) return;
    toast.error(`${selectedItems.length} item(s) marked for removal. This action requires admin approval.`, {
      action: {
        label: 'Confirm',
        onClick: () => {
          toast.success(`${selectedItems.length} item(s) flagged for deletion.`);
          setSelectedItems([]);
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Manage stock, track batches, and monitor status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => onNavigate?.('register')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Package className="w-4 h-4" /> Add New Batch
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or Batch ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full transition-all text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[140px] text-gray-900 dark:text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[140px] text-gray-900 dark:text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="RECALLED">Recalled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300 ml-2">{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={() => setSelectedItems([])} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-12">
                  <input type="checkbox" onChange={handleSelectAll} checked={paginatedMedicines.length > 0 && selectedItems.length === paginatedMedicines.length}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600" />
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Medicine Info</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Category</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Stock & Price</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Expiry</th>
                <th className="px-6 py-4 font-semibold text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {paginatedMedicines.map((item) => {
                const availableUnits = getAvailableUnits(item, userEmail);
                return (
                  <tr key={item.batchID} onClick={() => setViewingMedicine(item)}
                    className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${selectedItems.includes(item.batchID) ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedItems.includes(item.batchID)} onChange={() => handleSelectItem(item.batchID)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{item.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{item.batchID}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-medium">
                        {item.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{availableUnits} units</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">₹{item.price?.toFixed(2) ?? '0.00'}/unit</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm">
                      {formatDate(item.expDate)}
                    </td>
                    <td className="px-6 py-4">
                      {item.status === 'ACTIVE' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"><CheckCircle className="w-3 h-3" /> Active</span>}
                      {item.status === 'LOW_STOCK' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"><AlertTriangle className="w-3 h-3" /> Low Stock</span>}
                      {item.status === 'EXPIRED' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"><AlertCircle className="w-3 h-3" /> Expired</span>}
                      {item.status === 'RECALLED' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"><AlertCircle className="w-3 h-3" /> Recalled</span>}
                      {!item.status && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"><Eye className="w-3 h-3" /> Unknown</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredMedicines.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No medicines found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search terms.</p>
          </div>
        )}
        <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredMedicines.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredMedicines.length)} of {filteredMedicines.length} results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <MedicineDetailsModal medicine={viewingMedicine} onClose={() => setViewingMedicine(null)} />
    </div>
  );
}
