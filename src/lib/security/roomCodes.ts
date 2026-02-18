const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous: I, O, 0, 1

const generatedCodes = new Set<string>();

export function generateRoomCode(): string {
  let code: string;
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    attempts++;
    if (attempts > 100) {
      generatedCodes.clear();
    }
  } while (generatedCodes.has(code));

  generatedCodes.add(code);
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function releaseRoomCode(code: string): void {
  generatedCodes.delete(code);
}
