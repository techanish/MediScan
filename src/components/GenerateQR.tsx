import { useState, useEffect } from 'react';
import { QrCode, Search, Package, Download, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import type { Medicine } from '../App';

interface GenerateQRProps {
  getMedicineByBatch: (batchID: string) => Medicine | undefined;
}

export function GenerateQR({ getMedicineByBatch }: GenerateQRProps) {
  const [batchID, setBatchID] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setQrDataUrl(null);
    setMedicine(null);
    setError(null);
  }, [batchID]);

  const handleGenerate = async () => {
    if (!batchID.trim()) {
      setError('Please enter a batch ID');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const med = getMedicineByBatch(batchID);
    if (!med) {
      setError('Medicine not found');
      setIsGenerating(false);
      return;
    }

    setMedicine(med);

    const qrData = JSON.stringify({
      batchID: med.batchID,
      name: med.name,
      manufacturer: med.manufacturer,
      mfgDate: med.mfgDate,
      expDate: med.expDate,
      verified: med.verified,
    });

    try {
      const url = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#059669',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch {
      setError('Failed to generate QR code');
    }

    setIsGenerating(false);
  };

  const handleDownload = () => {
    if (!qrDataUrl || !medicine) return;
    const link = document.createElement('a');
    link.download = `qr-${medicine.batchID}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <QrCode className="w-6 h-6 text-emerald-500" />
          Generate QR Code
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Generate a QR code for medicine verification</p>
      </div>

      <div className="max-w-xl space-y-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={batchID}
              onChange={(e) => setBatchID(e.target.value)}
              placeholder="Enter Batch ID (e.g., BATCH-001)"
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-5 h-5" />
                Generate
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {qrDataUrl && medicine && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <div className="bg-white p-4 rounded-xl shadow-md">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{medicine.name}</h3>
                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="font-medium">Batch:</span> {medicine.batchID}
                  </p>
                  <p>
                    <span className="font-medium">Manufacturer:</span> {medicine.manufacturer}
                  </p>
                  <p>
                    <span className="font-medium">MFG Date:</span> {medicine.mfgDate}
                  </p>
                  <p>
                    <span className="font-medium">EXP Date:</span> {medicine.expDate}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="mt-4 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2 mx-auto sm:mx-0"
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
