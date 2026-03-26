import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Search, Check, AlertOctagon, MapPin, Calendar, User, Box, ScanLine, Camera, X, Upload } from 'lucide-react';
import type { Medicine } from '../App';
import { motion, AnimatePresence } from 'framer-motion';

interface VerifyMedicineProps {
  medicines: Medicine[];
  onVerify?: (batchID: string) => Promise<{ verified: boolean; medicine?: Medicine; error?: string }>;
}

function extractBatchId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const fromPayload = String(parsed.batchID || parsed.batchId || parsed.id || '').trim();
      if (fromPayload) return fromPayload;
    } catch {
      // Ignore parse errors and fallback to raw input.
    }
  }

  return trimmed;
}

export function VerifyMedicine({ medicines, onVerify }: VerifyMedicineProps) {
  const [batchId, setBatchId] = useState('');
  const [result, setResult] = useState<Medicine | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const getCameraUnavailableMessage = (reason?: string) => {
    if (reason === 'insecure-context') {
      return 'Live camera is blocked because this page is not secure (HTTPS). Open MediScan with HTTPS (or localhost) and try again. You can use Upload/Take QR photo below now.';
    }
    if (reason === 'unsupported') {
      return 'Live camera is unavailable on this browser. Use Upload/Take QR photo below to continue.';
    }
    return 'Live camera is unavailable right now. Use Upload/Take QR photo below or allow camera permission and retry.';
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const runVerification = async (rawValue: string) => {
    const normalizedBatchId = extractBatchId(rawValue);
    if (!normalizedBatchId) return;

    setBatchId(normalizedBatchId);
    setLoading(true);
    setResult(undefined);
    setErrorMsg('');

    if (onVerify) {
      const res = await onVerify(normalizedBatchId);
      if (res.verified && res.medicine) {
        setResult(res.medicine);
      } else {
        setResult(null);
        setErrorMsg(res.error || 'Medicine not found in registry');
      }
    } else {
      // fallback: local search
      const found = medicines.find(m => m.batchID.toLowerCase() === normalizedBatchId.toLowerCase());
      setResult(found || null);
      if (!found) setErrorMsg('Batch ID not found in registry');
    }
    setLoading(false);
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runVerification(batchId);
  };

  const decodeQrFromImageFile = async (file: File): Promise<string | null> => {
    const jsQrModule = await import('jsqr');
    const jsQR = jsQrModule.default;
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return null;

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
      return String(decoded?.data || '').trim() || null;
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const handleUploadQrImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScannerError('');
    setIsDecodingImage(true);

    try {
      const rawValue = await decodeQrFromImageFile(file);
      if (!rawValue) {
        setScannerError('No QR code was detected in the selected image.');
        return;
      }

      const parsed = extractBatchId(rawValue);
      if (!parsed) {
        setScannerError('The selected QR image did not contain a valid Batch ID.');
        return;
      }

      setIsScannerOpen(false);
      await runVerification(parsed);
    } catch {
      setScannerError('Unable to read the selected image. Please try another photo.');
    } finally {
      setIsDecodingImage(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (!isScannerOpen) {
      stopScanner();
      return;
    }

    let disposed = false;
    let frameId = 0;
    let didScan = false;

    const getCameraStream = async (): Promise<MediaStream | null> => {
      const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isSecure = typeof window === 'undefined' ? true : window.isSecureContext || isLocalHost;

      if (!isSecure) {
        setScannerError(getCameraUnavailableMessage('insecure-context'));
        return null;
      }

      if (navigator.mediaDevices?.getUserMedia) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: 'environment' }
            }
          });
        } catch {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' }
              }
            });
          } catch {
            return await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      }

      const legacyGetUserMedia =
        (navigator as any).getUserMedia ||
        (navigator as any).webkitGetUserMedia ||
        (navigator as any).mozGetUserMedia ||
        (navigator as any).msGetUserMedia;

      if (!legacyGetUserMedia) return null;

      return await new Promise<MediaStream>((resolve, reject) => {
        legacyGetUserMedia.call(navigator, { video: true }, resolve, reject);
      });
    };

    const startScanner = async () => {
      try {
        const stream = await getCameraStream();
        if (!stream) {
          if (!scannerError) {
            const hasMediaApi = Boolean(navigator.mediaDevices?.getUserMedia);
            const hasLegacyApi = Boolean(
              (navigator as any).getUserMedia ||
              (navigator as any).webkitGetUserMedia ||
              (navigator as any).mozGetUserMedia ||
              (navigator as any).msGetUserMedia
            );
            setScannerError(getCameraUnavailableMessage(hasMediaApi || hasLegacyApi ? undefined : 'unsupported'));
          }
          return;
        }

        if (disposed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          setScannerError('Camera opened but preview could not start. Upload a QR image below to scan.');
          return;
        }

        const hasBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined';
        const detector = hasBarcodeDetector ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;

        let decodeWithJsQr: ((targetVideo: HTMLVideoElement) => string | null) | null = null;

        if (!detector) {
          const jsQrModule = await import('jsqr');
          const jsQR = jsQrModule.default;
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { willReadFrequently: true });

          if (!context) {
            setScannerError('Unable to initialize scanner. Upload a QR image below to scan.');
            return;
          }

          decodeWithJsQr = (targetVideo: HTMLVideoElement) => {
            const width = targetVideo.videoWidth;
            const height = targetVideo.videoHeight;
            if (!width || !height) return null;

            canvas.width = width;
            canvas.height = height;
            context.drawImage(targetVideo, 0, 0, width, height);
            const imageData = context.getImageData(0, 0, width, height);
            const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
            return String(decoded?.data || '').trim() || null;
          };
        }

        const scanLoop = async () => {
          if (disposed || didScan) return;

          try {
            let rawValue = '';

            if (detector) {
              const barcodes = await detector.detect(video);
              rawValue = String(barcodes[0]?.rawValue || '').trim();
            } else if (decodeWithJsQr) {
              rawValue = decodeWithJsQr(video) || '';
            }

            if (rawValue) {
              const parsed = extractBatchId(rawValue);
              if (parsed) {
                didScan = true;
                setIsScannerOpen(false);
                await runVerification(parsed);
                return;
              }
            }
          } catch {
            // Keep scanning frame-by-frame when detection misses intermittently.
          }

          frameId = window.requestAnimationFrame(() => {
            void scanLoop();
          });
        };

        void scanLoop();
      } catch (error: any) {
        const errorName = String(error?.name || '');
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setScannerError('Camera permission is blocked. Allow camera permission in your browser settings, or use Upload/Take QR photo below.');
          return;
        }
        if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setScannerError('No camera device was found. Use Upload/Take QR photo below to scan.');
          return;
        }
        setScannerError(getCameraUnavailableMessage());
      }
    };

    setScannerError('');
    void startScanner();

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      stopScanner();
    };
  }, [isScannerOpen]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Verify Medicine Authenticity</h2>
        <p className="text-gray-500 dark:text-gray-400">Enter the Batch ID to trace the product.</p>
      </div>

      <div className="relative mb-12">
        <form onSubmit={handleVerify} className="relative">
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            placeholder="Enter Batch ID or paste QR payload"
            className="w-full pl-6 pr-48 py-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-lg shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <div className="absolute right-2 top-2 bottom-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-4 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl flex items-center justify-center gap-1.5 transition-colors font-medium"
              aria-label="Scan QR code"
            >
              <ScanLine className="w-4 h-4" />
              <span className="hidden sm:inline">Scan</span>
            </button>
            <button
              type="submit"
              disabled={loading || !batchId}
              className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-70 font-medium"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {isScannerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Scan Medicine QR
                </h3>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"
                  aria-label="Close scanner"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="relative mx-auto w-full max-w-xs bg-gray-900 rounded-xl overflow-hidden aspect-square">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Point your camera at the medicine QR code to auto-fill and verify the Batch ID.
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  On mobile, live camera may require HTTPS. If camera does not start, use Upload/Take QR photo.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isDecodingImage}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-70"
                >
                  <Upload className="w-4 h-4" />
                  {isDecodingImage ? 'Reading image...' : 'Upload/Take QR photo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Upload QR image"
                  title="Upload QR image"
                  onChange={handleUploadQrImage}
                  className="hidden"
                />
                {scannerError && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-3">
                    {scannerError}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {result !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {result === null ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-6 flex items-center gap-4 text-red-800 dark:text-red-300">
                <AlertOctagon className="w-10 h-10 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg">Verification Failed</h3>
                  <p className="text-red-600 dark:text-red-400 opacity-90">{errorMsg || 'This Batch ID was not found in the registry. Please check the ID or contact the manufacturer.'}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
                <div className="bg-emerald-600 dark:bg-emerald-700 p-6 text-white">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-bold tracking-wide uppercase text-sm">Verified Authentic</span>
                  </div>
                  <h3 className="text-2xl font-bold">{result.name}</h3>
                  <p className="opacity-90">{result.manufacturer}</p>
                </div>

                <div className="p-6 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Box className="w-3 h-3" /> Batch ID
                    </p>
                    <p className="font-mono text-gray-700 dark:text-gray-300">{result.batchID}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3" /> Current Owner
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 truncate" title={result.currentOwner}>{result.currentOwner}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Mfg Date
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">{result.mfgDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Exp Date
                    </p>
                    <p className={`font-bold ${result.status === 'EXPIRED' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {result.expDate}
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/30">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Chain of Custody
                  </h4>
                  <div className="relative pl-4 space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {result.ownerHistory.map((history, idx) => (
                      <div key={idx} className="relative flex items-start gap-4">
                        <div className={`relative z-10 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 mt-1.5 ${
                          idx === result.ownerHistory.length - 1 ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-900/30' : 'bg-gray-300 dark:bg-gray-600'
                        }`} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {history.action}
                            {history.unitsPurchased && <span className="font-normal text-gray-500 dark:text-gray-400"> ({history.unitsPurchased} units)</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{history.date || history.time}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 font-medium">{history.owner}</p>
                          {(history.ownerLocation || history.fromLocation) && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                              {history.action === 'TRANSFERRED'
                                ? `${history.fromLocation || 'Unknown'} → ${history.ownerLocation || 'Unknown'}`
                                : (history.ownerLocation || history.fromLocation)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
