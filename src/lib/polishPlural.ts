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

/**
 * Polish plural rule for "zestaw" (set/worksheet):
 *   1        -> zestaw
 *   2-4      -> zestawy   (except 12-14, which follow the 5+ rule)
 *   5+ / 0   -> zestawów
 */
export function zestawForm(n: number): string {
    if (n === 1) return 'zestaw';
    const lastDigit = n % 10;
    const lastTwo = n % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'zestawy';
    return 'zestawów';
}

/**
 * Object pronoun agreement for referring back to "zestaw(y)" earlier in a
 * sentence, e.g. "będzie można go przywrócić" (1 zestaw) vs "będzie można
 * je przywrócić" (2+ zestawów).
 */
export function goJeForm(n: number): string {
    return n === 1 ? 'go' : 'je';
}
