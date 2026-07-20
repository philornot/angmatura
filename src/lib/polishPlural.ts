/**
 * Polish plural rule for "pytanie" (question):
 *   1        -> pytanie
 *   2-4      -> pytania   (except 12-14, which follow the 5+ rule)
 *   5+ / 0   -> pytań
 */
export function pytanieForm(n: number): string {
    if (n === 1) return 'pytanie';
    const lastDigit = n % 10;
    const lastTwo = n % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'pytania';
    return 'pytań';
}

/**
 * Matching verb agreement for "zostać" (to remain) with a pytanie count,
 * e.g. "Zostało 1 pytanie", "Zostały 2 pytania", "Zostało 5 pytań".
 */
export function zostaloForm(n: number): string {
    return pytanieForm(n) === 'pytania' ? 'Zostały' : 'Zostało';
}

/**
 * Matching verb agreement for "czekać" (to be waiting) with a pytanie count,
 * e.g. "Czeka 1 pytanie", "Czekają 2 pytania", "Czekają 5 pytań".
 */
export function czekaForm(n: number): string {
    return pytanieForm(n) === 'pytanie' ? 'Czeka' : 'Czekają';
}
