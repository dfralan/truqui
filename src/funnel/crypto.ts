import { getPublicKey } from '@noble/secp256k1';
import { b64Decode, b64Encode } from './util.js';

export async function randomKey(): Promise<string> {
  return b64Encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function encrypt(keyB64: string, plaintext: string): Promise<string> {
  const raw = new Uint8Array(b64Decode(keyB64));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return b64Encode(out);
}

export async function decrypt(keyB64: string, ciphertextB64: string): Promise<string> {
  const raw = new Uint8Array(b64Decode(keyB64));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const data = b64Decode(ciphertextB64);
  const iv = new Uint8Array(data.slice(0, 12));
  const ct = new Uint8Array(data.slice(12));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export interface Identity {
  nsec: string;
  npub: string;
  sk: Uint8Array;
  pk: Uint8Array;
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Encode(prefix: string, data: Uint8Array): string {
  const convertBits = (values: number[], from: number, to: number): number[] => {
    let acc = 0;
    let bits = 0;
    const ret: number[] = [];
    for (const value of values) {
      acc = (acc << from) | value;
      bits += from;
      while (bits >= to) {
        bits -= to;
        ret.push((acc >> bits) & ((1 << to) - 1));
      }
    }
    if (bits) ret.push((acc << (to - bits)) & ((1 << to) - 1));
    return ret;
  };
  const polymod = (values: number[]): number => {
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const v of values) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ v;
      for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i]!;
    }
    return chk;
  };
  const hrpExpand = (hrp: string): number[] => {
    const ret: number[] = [];
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
    ret.push(0);
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
    return ret;
  };
  const words = convertBits([...data], 8, 5);
  const chk = polymod(hrpExpand(prefix).concat(words).concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, p) => (chk >> (5 * (5 - p))) & 31);
  return prefix + '1' + [...words, ...checksum].map((i) => CHARSET[i]!).join('');
}

function npubFromPk(pk: Uint8Array): string {
  const prefixed = new Uint8Array(1 + pk.length);
  prefixed[0] = 0x01;
  prefixed.set(pk, 1);
  return bech32Encode('npub', prefixed);
}

export function identityFromSecret(nsecB64: string): Identity {
  const sk = b64Decode(nsecB64);
  const pk = getPublicKey(sk, true);
  return { nsec: nsecB64, npub: npubFromPk(pk), sk, pk };
}

export function loadIdentity(): Identity {
  const stored = localStorage.getItem('funnel-nsec');
  if (stored) return identityFromSecret(stored);
  const sk = crypto.getRandomValues(new Uint8Array(32));
  const nsec = b64Encode(sk);
  localStorage.setItem('funnel-nsec', nsec);
  return identityFromSecret(nsec);
}

export async function signEvent(id: string, sk: Uint8Array): Promise<string> {
  const secp = await import('@noble/secp256k1');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  const sig = await secp.sign(new Uint8Array(hash), sk);
  return b64Encode(sig);
}
