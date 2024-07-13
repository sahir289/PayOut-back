import { customAlphabet } from 'nanoid';

// Define a custom alphabet consisting of digits only, and a length of 10
const generateNumericID = customAlphabet('0123456789', 10);

export function generateNumericUUID() {
  return generateNumericID();
}