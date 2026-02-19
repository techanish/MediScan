import { Package, Calendar, Building2, User, CheckCircle2, AlertTriangle, Box } from 'lucide-react';
import type { Medicine } from '../App';

interface MedicineListProps {
  medicines: Medicine[];
  userRole: string;
  userEmail?: string;
  isLoading?: boolean;
}

const roleBadgeStyles: Record<string, string> = {
  MANUFACTURER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  DISTRIBUTOR: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  PHARMACY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  CUSTOMER: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function MedicineList({ medicines, userRole, userEmail, isLoading = false }: MedicineListProps) {

  const isExpired = (expDate: string) => {
    return new Date(expDate) < new Date();
  };

  const isExpiringSoon = (expDate: string) => {
    const exp = new Date(expDate);
    const now = new Date();
    const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return exp > now && exp < threeMonths;
  };

  const getStockStatus = (totalUnits: number, remainingUnits: number = 0) => {
    const percentage = (remainingUnits / totalUnits) * 100;
    if (remainingUnits === 0) {
      return { label: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-100' };
    } else if (percentage < 20) {
      return { label: 'Low Stock', color: 'text-amber-600', bgColor: 'bg-amber-100' };
    } else {
      return { label: 'In Stock', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          {userRole === 'CUSTOMER' ? 'My Purchase History' : 'Your Medicines'}

        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 ml-13">
          {userRole === 'CUSTOMER'
            ? 'Medicines you have purchased'
            : 'Medicines currently under your ownership'}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Loading...</h3>
          <p className="text-slate-500 dark:text-slate-400">Please wait</p>
        </div>
      ) : medicines.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {userRole === 'CUSTOMER' ? 'No purchases yet' : 'No medicines found'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {userRole === 'MANUFACTURER'
              ? 'Register your first medicine to get started'
              : userRole === 'CUSTOMER'
              ? 'Your purchase history will appear here'
              : 'No medicines are currently assigned to you'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {medicines.map((medicine) => {
            // For customers, calculate total units purchased from all their purchase entries
            let totalPurchasedUnits = 0;
            let totalTransferredUnits = 0;
            let purchaseDates: string[] = [];
            let transferDates: string[] = [];
            
            if (userRole === 'CUSTOMER' && userEmail) {
              medicine.ownerHistory.forEach(h => {
                if (h.action === 'PURCHASED' && 
                    h.owner.toLowerCase() === userEmail.toLowerCase() &&
                    h.unitsPurchased) {
                  totalPurchasedUnits += h.unitsPurchased;
                  if (h.time) {
                    purchaseDates.push(new Date(h.time).toLocaleDateString());
                  }
                }
              });
            } else if (userEmail) {
              // For non-customers, calculate units received via transfer minus transferred out and sold
              let transferredOutUnits = 0;
              let soldUnits = 0;
              
              medicine.ownerHistory.forEach(h => {
                // Units received (either as manufacturer or via transfer)
                if (h.action === 'REGISTERED' && h.owner.toLowerCase() === userEmail.toLowerCase()) {
                  totalTransferredUnits += medicine.totalUnits || 0;
                }
                if (h.action === 'TRANSFERRED' && 
                    h.owner.toLowerCase() === userEmail.toLowerCase() &&
                    h.unitsPurchased) {
                  totalTransferredUnits += h.unitsPurchased;
                  if (h.time) {
                    transferDates.push(new Date(h.time).toLocaleDateString());
                  }
                }
                
                // Units transferred out by this user
                if (h.action === 'TRANSFERRED' && 
                    (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
                    h.unitsPurchased) {
                  transferredOutUnits += h.unitsPurchased;
                }
                
                // Units sold to customers by this user
                if (h.action === 'PURCHASED' && 
                    (h as any).from?.toLowerCase() === userEmail.toLowerCase() &&
                    h.unitsPurchased) {
                  soldUnits += h.unitsPurchased;
                }
              });
              
              // Available = received - transferred out - sold
              totalTransferredUnits = totalTransferredUnits - transferredOutUnits - soldUnits;
            }

            return (
              <div
                key={medicine.batchID}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                      <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{medicine.name}</h3>
                      <p className="text-xs text-slate-500 font-mono truncate">{medicine.batchID}</p>
                    </div>
                  </div>
                  {medicine.verified && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{medicine.manufacturer}</span>
                  </div>

                  {userRole === 'CUSTOMER' && totalPurchasedUnits > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 space-y-1">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Purchased: {totalPurchasedUnits} units</span>
                        </div>
                        {purchaseDates.length > 0 && (
                            <div className="flex items-center gap-2 text-emerald-600/80 dark:text-emerald-400/80 text-xs pl-6">
                                <Calendar className="w-3 h-3" />
                                <span>{purchaseDates.join(', ')}</span>
                            </div>
                        )}
                    </div>
                  )}

                  {userRole !== 'CUSTOMER' && totalTransferredUnits > 0 && (
                     <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 space-y-1">
                        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-medium text-sm">
                            <Package className="w-4 h-4" />
                            <span>Received: {totalTransferredUnits} units</span>
                        </div>
                        {transferDates.length > 0 && (
                            <div className="flex items-center gap-2 text-purple-600/80 dark:text-purple-400/80 text-xs pl-6">
                                <Calendar className="w-3 h-3" />
                                <span>{transferDates.join(', ')}</span>
                            </div>
                        )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                     <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>MFG: {medicine.mfgDate}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span className={`${
                            isExpired(medicine.expDate)
                          ? 'text-red-600 font-medium'
                          : isExpiringSoon(medicine.expDate)
                          ? 'text-amber-600 font-medium'
                          : 'text-slate-500'
                        }`}>EXP: {medicine.expDate}</span>
                     </div>
                  </div>
                  
                  {userRole !== 'CUSTOMER' && medicine.totalUnits !== undefined && (
                    <div className="flex items-center justify-between pt-2">
                         <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                             <Box className="w-4 h-4 text-slate-400" />
                             <span>
                                {totalTransferredUnits > 0 
                                  ? `${totalTransferredUnits}/${totalTransferredUnits}`
                                  : `${medicine.remainingUnits ?? medicine.totalUnits}/${medicine.totalUnits}`
                                } units
                             </span>
                         </div>
                         
                         {(totalTransferredUnits > 0 || medicine.currentOwner.toLowerCase() === userEmail?.toLowerCase()) && (
                             <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                totalTransferredUnits > 0 
                                   ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                   : medicine.remainingUnits === 0
                                   ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                   : (medicine.remainingUnits || 0) / medicine.totalUnits < 0.2
                                   ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                   : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                             }`}>
                                {totalTransferredUnits > 0 ? 'In Stock' : getStockStatus(medicine.totalUnits, medicine.remainingUnits || 0).label}
                             </span>
                         )}
                    </div>
                  )}
                  
                  {userRole !== 'CUSTOMER' && (
                     <div className="flex items-center gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-700">
                        <User className="w-4 h-4 text-slate-400" />
                         <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeStyles[medicine.currentOwnerRole] || 'bg-slate-100 text-slate-600'}`}>
                           {medicine.currentOwnerRole}
                         </span>
                     </div>
                  )}

                </div>
                
                 <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500">
                      {userRole === 'CUSTOMER' 
                        ? `Purchased from ${medicine.currentOwner}`
                        : `${medicine.ownerHistory.length} owner${medicine.ownerHistory.length !== 1 ? 's' : ''} in chain`
                      }
                    </p>
                  </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
