// Type declarations for @noble/hashes (pure JS, no built-in types)
declare module "@noble/hashes/scrypt" {
  interface ScryptOpts {
    N?: number;
    r?: number;
    p?: number;
    dkLen?: number;
    maxmem?: number;
  }
  export function scrypt(password: Uint8Array | string, salt: Uint8Array, opts?: ScryptOpts): Uint8Array;
}
declare module "@noble/hashes/utils" {
  export function hexToBytes(hex: string): Uint8Array;
  export function bytesToHex(bytes: Uint8Array): string;
}
