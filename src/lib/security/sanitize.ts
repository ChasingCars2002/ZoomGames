import DOMPurify from 'dompurify';

const MAX_NICKNAME_LENGTH = 20;
const MAX_MESSAGE_LENGTH = 200;
const MAX_STATEMENT_LENGTH = 300;

export function sanitizeNickname(input: string): string {
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  return cleaned.trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function sanitizeMessage(input: string): string {
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  return cleaned.trim().slice(0, MAX_MESSAGE_LENGTH);
}

export function sanitizeStatement(input: string): string {
  const cleaned = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  return cleaned.trim().slice(0, MAX_STATEMENT_LENGTH);
}

export function sanitizeRoomCode(input: string): string {
  return input.replace(/[^A-Z0-9]/g, '').slice(0, 6).toUpperCase();
}
