import { useState } from 'react';
import { Pill, Calendar, Building2, Hash, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import type { Medicine } from '../App';

interface RegisterMedicineProps {
  onRegister: (
    medicine: Omit<Medicine, 'currentOwner' | 'currentOwnerRole' | 'ownerHistory' | 'verified'>
  ) => Promise<{ success: boolean; error?: string }>;
}

export function RegisterMedicine({ onRegister }: RegisterMedicineProps) {
  const [formData, setFormData] = useState({
    batchID: '',
    name: '',
    manufacturer: '',
    mfgDate: '',
    expDate: '',
    totalUnits: '',
    category: 'General',
    description: '',
    dosage: '',
    composition: '',
    price: '',
    location: '',
    reorderPoint: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Trim all string fields
    const trimmedData = {
      batchID: formData.batchID.trim(),
      name: formData.name.trim(),
      manufacturer: formData.manufacturer.trim(),
      mfgDate: formData.mfgDate,
      expDate: formData.expDate,
      totalUnits: formData.totalUnits.trim(),
    };

    // Validate Batch ID format (alphanumeric and hyphens)
    if (!trimmedData.batchID) {
      errors.batchID = 'Batch ID is required';
    } else if (!/^[A-Za-z0-9-]+$/.test(trimmedData.batchID)) {
      errors.batchID = 'Batch ID can only contain letters, numbers, and hyphens';
    }

    // Validate medicine name
    if (!trimmedData.name) {
      errors.name = 'Medicine name is required';
    }

    // Validate manufacturer
    if (!trimmedData.manufacturer) {
      errors.manufacturer = 'Manufacturer is required';
    }

    // Validate dates
    if (!trimmedData.mfgDate) {
      errors.mfgDate = 'Manufacturing date is required';
    }
    if (!trimmedData.expDate) {
      errors.expDate = 'Expiry date is required';
    }
    
    // Validate that expiry date is after manufacturing date
    if (trimmedData.mfgDate && trimmedData.expDate) {
      const mfg = new Date(trimmedData.mfgDate);
      const exp = new Date(trimmedData.expDate);
      if (exp <= mfg) {
        errors.expDate = 'Expiry date must be after manufacturing date';
      }
    }

    // Validate total units
    if (!trimmedData.totalUnits) {
      errors.totalUnits = 'Total units is required';
    } else {
      const units = parseInt(trimmedData.totalUnits, 10);
      if (isNaN(units) || units <= 0) {
        errors.totalUnits = 'Total units must be a positive number';
      } else if (units > 1000000) {
        errors.totalUnits = 'Total units cannot exceed 1,000,000';
      }
    }

    return { isValid: Object.keys(errors).length === 0, errors, trimmedData };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setFieldErrors({});

    // Validate form
    const { isValid, errors, trimmedData } = validateForm();
    
    if (!isValid) {
      setFieldErrors(errors);
      setMessage({ type: 'error', text: 'Please fix the errors in the form' });
      setIsLoading(false);
      return;
    }
    const result = await onRegister({
      batchID: trimmedData.batchID,
      name: trimmedData.name,
      manufacturer: trimmedData.manufacturer,
      mfgDate: trimmedData.mfgDate,
      expDate: trimmedData.expDate,
      totalUnits: parseInt(trimmedData.totalUnits, 10),
    });

    if (result.success) {
      setMessage({ type: 'success', text: 'Medicine registered successfully!' });
      setFormData({ batchID: '', name: '', manufacturer: '', mfgDate: '', expDate: '', totalUnits: '', category: 'General', description: '', dosage: '', composition: '', price: '', location: '', reorderPoint: '' });
      setFieldErrors({});
    } else {
      setMessage({ type: 'error', text: result.error || 'Registration failed' });
    }
    setIsLoading(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 max-w-4xl mx-auto"> 
      <div className="mb-8 border-b border-slate-200 dark:border-slate-700 pb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <Pill className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          Register New Medicine
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 ml-13">Add a new medicine to the verification system</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div
            className={`flex items-center gap-2 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-100 text-green-700'
                : 'bg-red-50 border border-red-100 text-red-700'
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Batch ID</label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.batchID}
                onChange={(e) => {
                  setFormData({ ...formData, batchID: e.target.value });
                  setFieldErrors({ ...fieldErrors, batchID: '' });
                }}
                placeholder="e.g., BATCH-003"
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                  fieldErrors.batchID ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                required
              />
            </div>
            {fieldErrors.batchID && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.batchID}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Medicine Name</label>
            <div className="relative">
              <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setFieldErrors({ ...fieldErrors, name: '' });
                }}
                placeholder="e.g., Aspirin 100mg"
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                  fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                required
              />
            </div>
            {fieldErrors.name && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Manufacturer</label>
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.manufacturer}
              onChange={(e) => {
                setFormData({ ...formData, manufacturer: e.target.value });
                setFieldErrors({ ...fieldErrors, manufacturer: '' });
              }}
              placeholder="e.g., PharmaCorp Inc."
              className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                fieldErrors.manufacturer ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              required
            />
          </div>
          {fieldErrors.manufacturer && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.manufacturer}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Manufacturing Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.mfgDate}
                onChange={(e) => {
                  setFormData({ ...formData, mfgDate: e.target.value });
                  setFieldErrors({ ...fieldErrors, mfgDate: '' });
                }}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                  fieldErrors.mfgDate ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                required
              />
            </div>
            {fieldErrors.mfgDate && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.mfgDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Expiry Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={formData.expDate}
                onChange={(e) => {
                  setFormData({ ...formData, expDate: e.target.value });
                  setFieldErrors({ ...fieldErrors, expDate: '' });
                }}
                min={formData.mfgDate || undefined}
                className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                  fieldErrors.expDate ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                required
              />
            </div>
            {fieldErrors.expDate && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.expDate}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Total Units</label>
          <div className="relative">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              value={formData.totalUnits}
              onChange={(e) => {
                setFormData({ ...formData, totalUnits: e.target.value });
                setFieldErrors({ ...fieldErrors, totalUnits: '' });
              }}
              placeholder="e.g., 1000"
              min="1"
              max="1000000"
              className={`w-full pl-12 pr-4 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
                fieldErrors.totalUnits ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              required
            />
          </div>
          {fieldErrors.totalUnits && (
            <p className="text-xs text-red-600 mt-1">{fieldErrors.totalUnits}</p>
          )}
          <p className="text-xs text-gray-500">Number of units in this batch (1 - 1,000,000)</p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-xl hover:shadow-emerald-300 dark:hover:shadow-emerald-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Register Medicine
            </>
          )}
        </button>
      </form>
    </div>
  );
}
