import { NgWord } from '@/types';

/**
 * Checks if a message contains any NG words based on the provided list.
 * Matches are prioritized by severity (high -> medium -> low).
 *
 * @param message - The message text to check.
 * @param ngWords - The list of NG words to check against.
 * @returns An object indicating whether a match was found, the matched word (if any), and the severity.
 */
export function checkNgWords(
  message: string,
  ngWords: NgWord[]
): { matched: boolean; matchedWord: string | null; severity: string | null } {
  // Failsafe: Return safe defaults if the message is not a string
  if (typeof message !== 'string') {
    console.log('[NGWord] Invalid message format provided.');
    return { matched: false, matchedWord: null, severity: null };
  }

  // Failsafe: Return safe defaults if ngWords is not an array
  if (!Array.isArray(ngWords)) {
    console.log('[NGWord] Invalid ngWords list provided.');
    return { matched: false, matchedWord: null, severity: null };
  }

  try {
    // Sort ngWords by priority: high > medium > low
    const sortedNgWords = [...ngWords].sort((a, b) => {
      const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const priorityA = priorityMap[a.severity] || 0;
      const priorityB = priorityMap[b.severity] || 0;
      return priorityB - priorityA;
    });

    for (const ng of sortedNgWords) {
      // Skip if word/regex is invalid
      if (!ng || !ng.word) continue;

      let isMatch = false;

      if (ng.is_regex) {
        try {
          // Use RegExp if is_regex is true
          const regex = new RegExp(ng.word, 'i'); // Case insensitive
          if (regex.test(message)) {
            isMatch = true;
          }
        } catch {
          // If regex is invalid, log and skip this word
          console.log(`[NGWord] Invalid regex pattern: ${ng.word}`);
          continue;
        }
      } else {
        // Standard string inclusion check (case insensitive)
        if (message.toLowerCase().includes(ng.word.toLowerCase())) {
          isMatch = true;
        }
      }

      if (isMatch) {
        console.log(`[NGWord] Matched: "${ng.word}" (Severity: ${ng.severity})`);
        return {
          matched: true,
          matchedWord: ng.word,
          severity: ng.severity || 'unknown',
        };
      }
    }
  } catch (error) {
    // Catch-all for unexpected errors during iteration
    console.error('[NGWord] Error during NG word check:', error);
    return { matched: false, matchedWord: null, severity: null };
  }

  return { matched: false, matchedWord: null, severity: null };
}