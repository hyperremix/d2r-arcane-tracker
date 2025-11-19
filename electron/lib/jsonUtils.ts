/**
 * Utility functions for working with JSON that may contain comments.
 */

/**
 * Internal stateful parser that strips JSON comments while keeping string content intact.
 */
class JsonCommentStripper {
  private readonly length: number;
  private index = 0;
  private mode: 'default' | 'string' | 'line-comment' | 'block-comment' = 'default';
  private stringDelimiter: '"' | "'" | null = null;
  private result = '';

  constructor(private readonly input: string) {
    this.length = input.length;
  }

  strip(): string {
    while (this.index < this.length) {
      const char = this.input[this.index];
      const nextChar = this.peek();

      if (this.mode === 'line-comment') {
        this.consumeLineComment(char);
        continue;
      }

      if (this.mode === 'block-comment') {
        this.consumeBlockComment(char, nextChar);
        continue;
      }

      if (this.mode === 'string') {
        this.consumeString(char);
        continue;
      }

      if (this.tryStartComment(char, nextChar)) {
        continue;
      }

      if (this.tryStartString(char)) {
        continue;
      }

      this.append(char);
      this.index++;
    }

    return this.removeDanglingCommas(this.result);
  }

  private consumeLineComment(char: string): void {
    if (char === '\n' || char === '\r') {
      this.mode = 'default';
      this.append(char);
    }
    this.index++;
  }

  private consumeBlockComment(char: string, nextChar: string | null): void {
    if (char === '*' && nextChar === '/') {
      this.mode = 'default';
      this.index += 2;
      this.removeTrailingCommaIfNeeded();
      return;
    }
    this.index++;
  }

  private consumeString(char: string): void {
    this.append(char);
    const isStringBoundary = char === this.stringDelimiter;
    if (isStringBoundary && !this.precededByEscape()) {
      this.mode = 'default';
      this.stringDelimiter = null;
    }
    this.index++;
  }

  private tryStartComment(char: string, nextChar: string | null): boolean {
    if (char === '/' && nextChar === '/') {
      this.mode = 'line-comment';
      this.index += 2;
      return true;
    }

    if (char === '/' && nextChar === '*') {
      this.mode = 'block-comment';
      this.index += 2;
      return true;
    }

    return false;
  }

  private tryStartString(char: string): boolean {
    if (char !== '"' && char !== "'") {
      return false;
    }

    this.mode = 'string';
    this.stringDelimiter = char;
    this.append(char);
    this.index++;
    return true;
  }

  private removeTrailingCommaIfNeeded(): void {
    let lookahead = this.index;
    while (lookahead < this.length) {
      const lookaheadChar = this.input[lookahead];
      if (lookaheadChar === '}' || lookaheadChar === ']') {
        this.result = this.result.replace(/,\s*$/, '');
        return;
      }
      if (!this.isWhitespace(lookaheadChar)) {
        return;
      }
      lookahead++;
    }
  }

  private precededByEscape(): boolean {
    let backslashCount = 0;
    let cursor = this.index - 1;
    while (cursor >= 0 && this.input[cursor] === '\\') {
      backslashCount++;
      cursor--;
    }
    return backslashCount % 2 === 1;
  }

  private append(char: string): void {
    this.result += char;
  }

  private peek(): string | null {
    return this.index + 1 < this.length ? this.input[this.index + 1] : null;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private removeDanglingCommas(value: string): string {
    return value.replace(/,(\s*[}\]])/g, '$1');
  }
}

/**
 * Strips comments from a JSON string, preserving the content of strings
 * while removing both line (`//`) and block (`/* ... *\/`) comments.
 *
 * @param jsonString - JSON string that may contain comments
 * @returns JSON string with comments removed and trailing commas cleaned up
 */
export function stripJsonComments(jsonString: string): string {
  return new JsonCommentStripper(jsonString).strip();
}
