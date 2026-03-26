import type { Medicine } from '../App';

interface UnitSummary {
  receivedUnits: number;
  transferredOutUnits: number;
  soldUnits: number;
  availableUnits: number;
}

const toNonNegativeNumber = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

export const getMedicineUnitSummary = (medicine: Medicine, userEmail?: string): UnitSummary => {
  const fallbackAvailable = toNonNegativeNumber(medicine.remainingUnits);
  const fallbackTotal = toNonNegativeNumber(medicine.totalUnits);

  if (!userEmail) {
    return {
      receivedUnits: fallbackTotal,
      transferredOutUnits: 0,
      soldUnits: 0,
      availableUnits: fallbackAvailable,
    };
  }

  const owner = normalizeEmail(userEmail);
  if (!owner) {
    return {
      receivedUnits: fallbackTotal,
      transferredOutUnits: 0,
      soldUnits: 0,
      availableUnits: fallbackAvailable,
    };
  }

  let receivedUnits = 0;
  let transferredOutUnits = 0;
  let soldUnits = 0;

  for (const entry of medicine.ownerHistory || []) {
    const entryOwner = normalizeEmail(entry.owner);
    const entryFrom = normalizeEmail(entry.from);
    const units = toNonNegativeNumber(entry.unitsPurchased);

    if (entry.action === 'REGISTERED' && entryOwner === owner) {
      receivedUnits += fallbackTotal;
    }

    if (entry.action === 'TRANSFERRED' && entryOwner === owner) {
      receivedUnits += units;
    }

    if (entry.action === 'TRANSFERRED' && entryFrom === owner) {
      transferredOutUnits += units;
    }

    if (entry.action === 'PURCHASED' && entryFrom === owner) {
      soldUnits += units;
    }
  }

  // Fallback for older records where owner history may be incomplete.
  if (receivedUnits === 0 && normalizeEmail(medicine.currentOwner) === owner && fallbackAvailable > 0) {
    receivedUnits = Math.max(fallbackAvailable, fallbackTotal);
  }

  return {
    receivedUnits,
    transferredOutUnits,
    soldUnits,
    availableUnits: Math.max(0, receivedUnits - transferredOutUnits - soldUnits),
  };
};

export const getAvailableUnits = (medicine: Medicine, userEmail?: string): number => {
  return getMedicineUnitSummary(medicine, userEmail).availableUnits;
};
