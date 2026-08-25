/**
 * Flexible Stream Tokenizer for STAAD.Pro .ANL and .STD files.
 * Handles page headers, command numbers, comment banners, continuation lines,
 * semicolon delimiters, and token expansions (e.g. 53 TO 58).
 */

export interface TokenizedLine {
  originalLineNumber: number;
  commandNumber?: number;
  text: string;
  tokens: string[];
}

export class ANLTokenizer {
  /**
   * Cleans raw ANL text:
   * 1. Strips page breaks (\f / \x0c) and page header lines (STAAD SPACE ... PAGE NO. X).
   * 2. Strips STAAD banner headers.
   * 3. Merges continuation lines (lines ending with '-' or ending with an incomplete command).
   */
  public static cleanAndExtractLines(rawContent: string): TokenizedLine[] {
    const rawLines = rawContent.split(/\r?\n/);
    const result: TokenizedLine[] = [];

    let currentAccumulated = '';
    let currentLineNum = 0;
    let currentCmdNum: number | undefined = undefined;
    let isContinuation = false;

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i].replace(/[\f\x0c]/g, '').trim();

      // Skip empty lines
      if (!line) continue;

      // Skip STAAD page headers (e.g. "PAGE NO. 1", "STAAD SPACE -- PAGE NO. 2")
      if (/PAGE\s+NO\.\s+\d+/i.test(line)) continue;

      // Skip asterisk header banners
      if (/^\*+$/.test(line) || /^\*\s+STAAD\.Pro/i.test(line) || /^\*\s+Bentley/i.test(line) || /^\*\s+Licensed/i.test(line)) {
        continue;
      }

      // Check if line starts with STAAD command line number e.g. "   107. MEMBER INCIDENCES"
      const cmdMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (cmdMatch) {
        // If we are NOT continuing a hyphenated line, flush previous accumulated command
        if (!isContinuation && currentAccumulated) {
          result.push({
            originalLineNumber: currentLineNum,
            commandNumber: currentCmdNum,
            text: currentAccumulated,
            tokens: ANLTokenizer.tokenizeString(currentAccumulated),
          });
          currentAccumulated = '';
        }
        if (!isContinuation) {
          currentLineNum = i + 1;
          currentCmdNum = parseInt(cmdMatch[1], 10);
        }
        line = cmdMatch[2].trim();
      } else {
        if (!currentLineNum) currentLineNum = i + 1;
      }

      // Check for line continuation ending with '-'
      if (line.endsWith('-')) {
        const withoutDash = line.slice(0, -1).trim();
        currentAccumulated = currentAccumulated ? `${currentAccumulated} ${withoutDash}` : withoutDash;
        isContinuation = true;
      } else {
        const fullText = currentAccumulated ? `${currentAccumulated} ${line}` : line;
        currentAccumulated = '';
        isContinuation = false;

        // If the line contains semicolons (common in JOINT COORDINATES and MEMBER INCIDENCES),
        // split into separate statements
        if (fullText.includes(';')) {
          const parts = fullText.split(';');
          for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart) {
              result.push({
                originalLineNumber: currentLineNum,
                commandNumber: currentCmdNum,
                text: trimmedPart,
                tokens: ANLTokenizer.tokenizeString(trimmedPart),
              });
            }
          }
        } else {
          result.push({
            originalLineNumber: currentLineNum,
            commandNumber: currentCmdNum,
            text: fullText,
            tokens: ANLTokenizer.tokenizeString(fullText),
          });
        }
      }
    }

    if (currentAccumulated) {
      result.push({
        originalLineNumber: currentLineNum,
        commandNumber: currentCmdNum,
        text: currentAccumulated,
        tokens: ANLTokenizer.tokenizeString(currentAccumulated),
      });
    }

    return result;
  }

  /**
   * Tokenizes a single string into whitespace-separated arguments
   */
  public static tokenizeString(str: string): string[] {
    return str.trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Expands range syntax common in STAAD.
   * e.g. ["1", "TO", "4", "6", "8", "TO", "10"] -> [1, 2, 3, 4, 6, 8, 9, 10]
   */
  public static expandIdList(tokens: string[]): number[] {
    const ids: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].toUpperCase();
      if (token === 'TO') {
        const prevId = ids.pop();
        const nextToken = tokens[i + 1];
        if (prevId !== undefined && nextToken) {
          const nextId = parseInt(nextToken, 10);
          if (!isNaN(nextId) && nextId >= prevId) {
            for (let id = prevId; id <= nextId; id++) {
              ids.push(id);
            }
            i++; // skip nextToken
          }
        }
      } else {
        const num = parseInt(token, 10);
        if (!isNaN(num)) {
          ids.push(num);
        }
      }
    }
    return ids;
  }
}
