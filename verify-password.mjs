import { verifyPassword } from 'better-auth/crypto';

const storedHash = 'b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000';
const password = 'TestPass123!';

const isValid = await verifyPassword({ hash: storedHash, password });
console.log('Password verification result:', isValid);
