import type { Medicine } from '../App';
import { X, Calendar, MapPin, Package, ShieldCheck, Activity, FileText, Clock, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface MedicineDetailsModalProps {
  medicine: Medicine | null;
  onClose: () => void;
}

export function MedicineDetailsModal({ medicine, onClose }: MedicineDetailsModalProps) {
  if (!medicine) return null;

  const handlePrint = () => {
    toast.success(`Printing label for ${medicine.batchID}...`);
  };

  const handleDownloadReport = () => {
    toast.success(`Downloading report for ${medicine.name}...`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-emerald-600 p-6 text-white flex justify-between items-start shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-emerald-500/30 px-2 py-1 rounded text-xs font-medium border border-emerald-400/30">
                  {medicine.category || 'Medicine'}
                </span>
                {medicine.verified && (
                  <span className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs font-medium">
                    <ShieldCheck className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-bold">{medicine.name}</h2>
              <p className="text-emerald-100 opacity-90 font-mono text-sm mt-1">{medicine.batchID}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* Main Details */}
              <div className="md:col-span-2 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                      medicine.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      medicine.status === 'LOW_STOCK' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {medicine.status?.replace('_', ' ') || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Manufacturer</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{medicine.manufacturer}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    Product Description
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-xl shadow-sm">
                    {medicine.description || 'No description available for this product.'}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-gray-400" />
                    Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Dosage</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{medicine.dosage || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Composition</p>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{medicine.composition || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Price per Unit</p>
                        <p className="font-semibold text-gray-900 dark:text-white">₹{medicine.price?.toFixed(2) || '0.00'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{medicine.location || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Important Dates
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Manufactured</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{medicine.mfgDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Expires</span>
                      <span className={`text-sm font-medium ${medicine.status === 'EXPIRED' ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {medicine.expDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    Timeline
                  </h4>
                  <div className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-6">
                    {medicine.ownerHistory.map((h, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800 ring-1 ring-gray-100 dark:ring-gray-700" />
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase">{h.action}</p>
                        <p className="text-xs text-gray-500">{h.date || h.time}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate w-full" title={h.owner}>
                          {h.owner}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePrint}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Printer className="w-5 h-5 mb-1 text-gray-400" />
                    Print Label
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="flex flex-col items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Download className="w-5 h-5 mb-1 text-gray-400" />
                    Report
                  </button>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
