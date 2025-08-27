import { PublicKey } from "@solana/web3.js";
import CryptoJS from "crypto-js";
import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { Hono } from "hono";
import { metadataEnv } from "../env.js";

const salt = metadataEnv.JWT_SALT || "SolportSalt";
const jwtRouter = new Hono();

if (!metadataEnv.JWT_SALT) {
  console.warn(
    "[JWT] ⚠️ No cryptographic salt was provided, the default one will be used which may be insecure."
  );
}

/**
 * Generates a salted SHA256 nonce from any given public key
 * @param {PublicKey | string} publicKey
 * @returns {string} nonce
 */
function getNonceForPublicKey(publicKey: PublicKey | string) {
  publicKey =
    publicKey instanceof PublicKey
      ? publicKey.toBase58()
      : publicKey.toString();
  const algo = CryptoJS.algo.SHA256.create();
  algo.update(publicKey);
  algo.update(CryptoJS.SHA256(salt));
  const hash = algo.finalize().toString(CryptoJS.enc.Base64);
  console.log("[JWT] Nonce for '%s' is '%s'", publicKey, hash);
  return hash;
}

/**
 * Verifies the nonce corresponding to this public key
 * against the signature provided
 * @param {PublicKey | string} publicKey
 * @param {string} signature
 * @returns {Boolean} verified
 */
function verifyWalletSignature(
  publicKey: PublicKey | string,
  signature: string
) {
  publicKey =
    publicKey instanceof PublicKey ? publicKey : new PublicKey(publicKey);
  const publicKeyBuf = (publicKey as PublicKey).toBuffer();
  const sig = Buffer.from(signature);
  const nonce = Buffer.from(getNonceForPublicKey(publicKey));
  return nacl.sign.detached.verify(nonce, sig, publicKeyBuf);
}

// Generate the nonce for a given public key
jwtRouter.get("/challenge/:publicKey", async (c) => {
  const publicKeyStr = c.req.param("publicKey");
  if (!publicKeyStr) {
    return c.text("Expected public key, but none was provided", 400);
  }
  // If we cannot cast it into a PublicKey, it's invalid
  try {
    new PublicKey(publicKeyStr);
  } catch (e) {
    return c.text("An invalid public key was provided", 400);
  }
  // Finally, we provide the nonce
  try {
    return c.json({ response: getNonceForPublicKey(publicKeyStr) });
  } catch (e) {
    console.error(e);
    return c.text("Something went wrong while generating the nonce", 400);
  }
});

// Get the JWT for a public key and signature, encoded as a GET param
jwtRouter.get("/get", async (c) => {
  const stateStr = c.req.query("state");
  if (!stateStr) {
    return c.text("Expected state object, but none was provided", 400);
  }
  let state;
  let publicKey;
  let signature;
  // State parsing
  try {
    state = JSON.parse(decodeURIComponent(stateStr.toString()));
    if (!state.public_key || !state.signature) {
      throw "Invalid state object";
    }
    publicKey = state.public_key;
    signature = state.signature;
  } catch (e) {
    return c.text("An invalid state object was provided", 400);
  }
  // If we cannot cast it into a PublicKey, it's invalid
  try {
    new PublicKey(publicKey);
  } catch (e) {
    return c.text("An invalid public key was provided", 400);
  }
  // Finally, verifying the signature and providing a JWT
  try {
    const valid = verifyWalletSignature(publicKey, signature);
    if (!valid) throw "An invalid signature was provided";
    const jwtRes = jwt.sign({ publicKey }, salt, { expiresIn: "1d" });
    return c.json({ response: jwtRes });
  } catch (e) {
    return c.text("An invalid signature was provided", 400);
  }
});

export default jwtRouter;
