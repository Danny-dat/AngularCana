/**
 * Vereinheitlicht Anzeigename + Username zu einem "Handle".
 * - erlaubt Groß- & Kleinschreibung (A–Z, a–z)
 * - entfernt führendes @
 * - ersetzt Leerzeichen durch _
 * - erlaubt nur A-Z, a-z, 0-9, _
 * - max 20 Zeichen
 */
export function normalizeUnifiedUserName(input: string): string {
  return (input ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .slice(0, 20);
}

/**
 * Normalisierte, case-insensitive Key-Variante für eindeutige Checks/Queries.
 * (Damit "Max" und "max" als gleich behandelt werden.)
 */
export function normalizeUnifiedUserNameKey(input: string): string {
  return normalizeUnifiedUserName(input).toLowerCase();
}
