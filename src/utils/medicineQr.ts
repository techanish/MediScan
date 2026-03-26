import type { Medicine } from '../App';

const toSafeString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const getRegisteredEntry = (medicine: Medicine) => {
  return (medicine.ownerHistory || []).find((entry) => entry.action === 'REGISTERED');
};

export const getMedicineRegisteredHash = (medicine: Medicine): string => {
  const registered = getRegisteredEntry(medicine);
  if (!registered) return '';

  return (
    toSafeString(registered.blockchainHash) ||
    toSafeString(registered.transferPayloadHash)
  );
};

export const getMedicineRegisteredPayloadHash = (medicine: Medicine): string => {
  const registered = getRegisteredEntry(medicine);
  if (!registered) return '';
  return toSafeString(registered.transferPayloadHash);
};

export const buildMedicineQrPayload = (medicine: Medicine): string => {
  const registeredHash = getMedicineRegisteredHash(medicine);
  const registeredPayloadHash = getMedicineRegisteredPayloadHash(medicine);

  const payload = {
    type: 'MEDISCAN_MEDICINE',
    version: '2',
    batchID: medicine.batchID,
    name: medicine.name,
    manufacturer: medicine.manufacturer,
    mfgDate: medicine.mfgDate,
    expDate: medicine.expDate,
    verified: Boolean(medicine.verified),
    registeredHash: registeredHash || undefined,
    registeredPayloadHash: registeredPayloadHash || undefined,
  };

  return JSON.stringify(payload);
};
