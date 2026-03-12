import { useState } from 'react';
import { QrCode, Printer, Copy } from 'lucide-react';
import QRCode from 'react-qr-code';
import type { Medicine } from '../App';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface QrCodeGeneratorProps {
  medicines: Medicine[];
}

export function QrCodeGenerator({ medicines }: QrCodeGeneratorProps) {
  const [selectedBatch, setSelectedBatch] = useState('');

  const selectedMedicine = medicines.find(m => m.batchID === selectedBatch);
  const qrData = selectedMedicine ? JSON.stringify({
    id: selectedMedicine.batchID,
    name: selectedMedicine.name,
    mfg: selectedMedicine.manufacturer
  }) : '';

  const handleCopy = () => {
    if (!qrData) return;
    navigator.clipboard.writeText(qrData);
    toast.success('QR Data copied to clipboard');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QR Code Generator</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate verification codes for packaging</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Batch to Generate</label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-full px-4 py-6 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Select a batch..." />
              </SelectTrigger>
              <SelectContent>
                {medicines.map(m => (
                  <SelectItem key={m.batchID} value={m.batchID}>
                    {m.name} ({m.batchID})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMedicine && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Batch Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Batch ID</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{selectedMedicine.batchID}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Product</span>
                  <span className="text-gray-900 dark:text-gray-100">{selectedMedicine.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Manufacturer</span>
                  <span className="text-gray-900 dark:text-gray-100">{selectedMedicine.manufacturer}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Expiry</span>
                  <span className="text-gray-900 dark:text-gray-100">{selectedMedicine.expDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
          <AnimatePresence mode="wait">
            {selectedMedicine ? (
              <motion.div
                key={selectedMedicine.batchID}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex flex-col items-center w-full"
              >
                <div className="p-4 bg-white rounded-xl shadow-inner border border-gray-100 dark:border-gray-700 mb-6">
                  <QRCode
                    value={qrData}
                    size={200}
                    level="H"
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{selectedMedicine.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-mono">{selectedMedicine.batchID}</p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-2.5 px-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" /> Copy Data
                  </button>
                  <button
                    onClick={() => toast.success('Sent to printer')}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Print Label
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-gray-400 dark:text-gray-500 py-12"
              >
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Select a batch to generate QR code</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
