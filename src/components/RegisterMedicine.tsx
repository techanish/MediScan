import React, { useState } from 'react';
import { PlusCircle, Sparkles } from 'lucide-react';
import type { Medicine } from '../App';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface RegisterMedicineProps {
  onRegister: (data: Partial<Medicine>) => Promise<{ success: boolean; error?: string } | void>;
}

export function RegisterMedicine({ onRegister }: RegisterMedicineProps) {
  const [form, setForm] = useState<Partial<Medicine>>({
    batchID: '',
    name: '',
    manufacturer: '',
    location: '',
    mfgDate: '',
    expDate: '',
    totalUnits: 0,
    category: 'Other',
    price: 0,
    dosage: '',
    composition: '',
    description: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Consistent dropdown styling from Tickets page
  const selectTriggerClass = 'w-full border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-100 shadow-sm';

  const generateAiDescription = () => {
    if (!form.name || !form.category) {
      toast.error('Please enter Medicine Name and Category first');
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      const templates = [
        `Premium quality ${form.name} (${form.category}) manufactured by ${form.manufacturer || 'our trusted facility'}. Each unit contains ${form.dosage || 'standard dosage'} of active ${form.composition || 'ingredients'}. Designed for optimal therapeutic efficacy and safety.`,
        `${form.name} is a high-grade ${form.category} medication. Produced under strict quality control standards${form.manufacturer ? ' by ' + form.manufacturer : ''}. Features ${form.composition ? 'pure ' + form.composition : 'advanced formulation'} with a dosage strength of ${form.dosage || 'clinical standard'}.`,
        `Advanced ${form.category} formulation: ${form.name}. This pharmaceutical product${form.manufacturer ? ' from ' + form.manufacturer : ''} ensures reliable results. Contains ${form.composition || 'active compounds'} at ${form.dosage || 'precise'} concentration. Verified for authenticity and purity.`
      ];
      setForm(prev => ({ ...prev, description: templates[Math.floor(Math.random() * templates.length)] }));
      setIsGenerating(false);
      toast.success('Description generated with AI');
    }, 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Date validation
    if (form.mfgDate && form.expDate && new Date(form.mfgDate) >= new Date(form.expDate)) {
      toast.error('Manufacturing date must be before expiry date');
      return;
    }
    setIsLoading(true);
    const result = await onRegister({
      ...form,
      totalUnits: Number(form.totalUnits),
      remainingUnits: Number(form.totalUnits),
      price: Number(form.price),
      status: 'ACTIVE',
      ownerHistory: [],
      verified: true
    });
    setIsLoading(false);

    if (!result || result.success) {
      toast.success('Medicine registered successfully');
      setForm({
        batchID: '', name: '', manufacturer: '', mfgDate: '', expDate: '', totalUnits: 0,
        category: 'Other', price: 0, dosage: '', composition: '', description: '', location: ''
      });
    } else if (result && !result.success) {
      toast.error(result.error || 'Registration failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Register New Medicine</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Create a new batch record in the blockchain</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Batch ID</label>
            <input required type="text" value={form.batchID} onChange={e => setForm({ ...form, batchID: e.target.value })}
              placeholder="e.g. BATCH-2024-001"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Medicine Name</label>
            <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Amoxicillin 500mg"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Category</label>
            <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
              <SelectTrigger className={selectTriggerClass} aria-label="Medicine Category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Antibiotic">Antibiotic</SelectItem>
                <SelectItem value="Painkiller">Painkiller</SelectItem>
                <SelectItem value="Vitamin">Vitamin</SelectItem>
                <SelectItem value="Cardiovascular">Cardiovascular</SelectItem>
                <SelectItem value="Antidiabetic">Antidiabetic</SelectItem>
                <SelectItem value="Antiviral">Antiviral</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Manufacturer</label>
            <input required type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="Company Name"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Factory Location</label>
            <input
              required
              type="text"
              value={form.location || ''}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Hyderabad Plant 2"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Price per Unit (₹)</label>
            <input type="number" step="0.01" value={form.price || ''} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) })}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Total Units</label>
            <input required type="number" value={form.totalUnits || ''} onChange={e => setForm({ ...form, totalUnits: parseInt(e.target.value) })}
              placeholder="Quantity"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Dosage</label>
            <input type="text" value={form.dosage} onChange={e => setForm({ ...form, dosage: e.target.value })}
              placeholder="e.g. 500mg"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Composition</label>
            <input type="text" value={form.composition} onChange={e => setForm({ ...form, composition: e.target.value })}
              placeholder="e.g. Amoxicillin Trihydrate"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Manufacturing Date</label>
            <input required type="date" title="Manufacturing Date" value={form.mfgDate} onChange={e => setForm({ ...form, mfgDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Expiry Date</label>
            <input required type="date" title="Expiry Date" value={form.expDate} onChange={e => setForm({ ...form, expDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-gray-900 dark:text-gray-100" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Description</label>
              <button type="button" onClick={generateAiDescription} disabled={isGenerating}
                className="text-xs flex items-center gap-1 text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50">
                {isGenerating ? 'Generating...' : <><Sparkles className="w-3 h-3" /> AI Auto-Fill</>}
              </button>
            </div>
            <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Product details and medical information..."
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border-transparent focus:bg-white dark:focus:bg-gray-600 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-4">
          <button type="button" onClick={() => setForm({ batchID: '', name: '', manufacturer: '', location: '', mfgDate: '', expDate: '', totalUnits: 0, category: 'Other', price: 0, dosage: '', composition: '', description: '' })}
            className="px-6 py-3 rounded-xl text-gray-500 dark:text-gray-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Clear Form
          </button>
          <button type="submit" disabled={isLoading}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><PlusCircle className="w-5 h-5" /> Register Batch</>}
          </button>
        </div>
      </form>
    </div>
  );
}
