// Punto de entrada único de la lógica pura del radar.
// Los Code nodes de n8n lo cargan con require('/opt/radar/lib/index.js') y las
// pruebas lo importan directo. Solo funciones puras: sin red, sin base de datos.
// Fase 1 agrega normalize y fingerprint; fase 2, filters y score.

export const LIB_VERSION = '0.1.0';
