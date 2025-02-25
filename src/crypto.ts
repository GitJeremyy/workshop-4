import { createPublicKey, webcrypto } from "crypto";

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};
export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  // TODO implement this function using the crypto package to generate a public and private RSA key pair.
  //      the public key should be used for encryption and the private key for decryption. Make sure the
  //      keys are extractable.

  const keys = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const publicKey = keys.publicKey;
  const privateKey = keys.privateKey;

  return { publicKey, privateKey };
}

// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to return a base64 string version of a public key
  const exported = await webcrypto.subtle.exportKey("spki", key);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return exportedAsBase64;
}

// Export a crypto private key to a base64 string format
export async function exportPrvKey(key: webcrypto.CryptoKey | null): Promise<string | null> {
  // TODO implement this function to return a base64 string version of a private key
  if (!key) {
    return null;
  }
  const exported = await webcrypto.subtle.exportKey("pkcs8", key);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return exportedAsBase64;
}

// Import a base64 string public key to its native format
export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportPubKey function to it's native crypto key object
  const imported = await webcrypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(strKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
  return imported;
}

// Import a base64 string private key to its native format
export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportPrvKey function to it's native crypto key object
  const imported = await webcrypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(strKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
  return imported;
}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(b64Data: string,strPublicKey: string): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: use the provided base64ToArrayBuffer function
  const publicKey = await importPubKey(strPublicKey);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    Buffer.from(b64Data, "base64")
  );
  const encryptedAsBase64 = arrayBufferToBase64(encrypted);
  return encryptedAsBase64;
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(data: string,privateKey: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function
  const decrypted = await webcrypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(data)
  );
  const decryptedAsString = Buffer.from(decrypted).toString("utf-8");
  return decryptedAsString;
}

// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  // TODO implement this function using the crypto package to generate a symmetric key.
  //      the key should be used for both encryption and decryption. Make sure the
  //      keys are extractable.
  const key = await webcrypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  return key;
}

// Export a crypto symmetric key to a base64 string format
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  // TODO implement this function to return a base64 string version of a symmetric key
  const exported = await webcrypto.subtle.exportKey("raw", key);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return exportedAsBase64;
}

// Import a base64 string format to its crypto native format
export async function importSymKey(strKey: string): Promise<webcrypto.CryptoKey> {
  // TODO implement this function to go back from the result of the exportSymKey function to it's native crypto key object
  const imported = await webcrypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(strKey),
    { name: "AES-CBC" },
    true,
    ["encrypt", "decrypt"]
  );
  
  return imported;
}

// Encrypt a message using a symmetric key
export async function symEncrypt(key: webcrypto.CryptoKey,data: string): Promise<string> {
  // TODO implement this function to encrypt a base64 encoded message with a public key
  // tip: encode the data to a uin8array with TextEncoder
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    new TextEncoder().encode(data)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv,0);
  combined.set(new Uint8Array(encrypted), iv.length);
  const encryptedAsBase64 = arrayBufferToBase64(combined);
  return encryptedAsBase64;
}

// Decrypt a message using a symmetric key
export async function symDecrypt(strKey: string, encryptedData: string): Promise<string> {
  // TODO implement this function to decrypt a base64 encoded message with a private key
  // tip: use the provided base64ToArrayBuffer function and use TextDecode to go back to a string format
  const key = await importSymKey(strKey);
  const dataBuffer = base64ToArrayBuffer(encryptedData);
  const iv = dataBuffer.slice(0, 16);
  const encrypted = dataBuffer.slice(16);

  const decrypted = await webcrypto.subtle.decrypt(
    { name: "AES-CBC", iv:iv},
    key,
    encrypted
  );
  const decryptedAsString = new TextDecoder().decode(decrypted);
  return decryptedAsString;
}
