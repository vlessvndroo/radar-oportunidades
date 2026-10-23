// Punto de entrada único de la lógica pura del radar.
// Los Code nodes de n8n lo cargan con require('/opt/radar/lib/index.js') y las
// pruebas lo importan directo. Solo funciones puras: sin red, sin base de datos.

export const LIB_VERSION = '0.4.0';

export { normalizeOpportunity, normalizeAll, normalizeContractType } from './normalize.js';
export { fingerprint, normalizeCompany, normalizeTitle, canonicalUrl } from './fingerprint.js';
export { parseSalaryText } from './salary.js';
export { htmlToText, fixMojibake } from './text.js';
export { parseRemotive } from './sources/remotive.js';
export { parseRemoteOk } from './sources/remoteok.js';
export { parseWeWorkRemotely } from './sources/weworkremotely.js';
export { parseGetOnBoard } from './sources/getonboard.js';
export { evaluateOpportunity, evaluateAll } from './evaluate.js';
export { applyHardFilters, opportunityLanguage } from './filters.js';
export { scoreOpportunity } from './score.js';
export { detectLanguage } from './language.js';
export { hourlyUsd, requiredYears, findKeyword } from './matching.js';
