export declare function randomKey(): Promise<string>;
export declare function encrypt(keyB64: string, plaintext: string): Promise<string>;
export declare function decrypt(keyB64: string, ciphertextB64: string): Promise<string>;
export interface Identity {
    nsec: string;
    npub: string;
    sk: Uint8Array;
    pk: Uint8Array;
}
export declare function identityFromSecret(nsecB64: string): Identity;
export declare function loadIdentity(): Identity;
export declare function signEvent(id: string, sk: Uint8Array): Promise<string>;
