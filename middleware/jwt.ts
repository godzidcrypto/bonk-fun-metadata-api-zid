import jwt from "jsonwebtoken";
import { type WalletJWT } from "../types";
import { metadataEnv } from "../env";
import type { Context, Next } from "hono";
import type { WalletContext } from "../types";

const salt = metadataEnv.JWT_SALT || "SolportSalt";


/**
 * Verifies that the JWT token is present and binds the public key to
 * the context so it becomes reusable. This middleware is strict and
 * the request will fail if no JWT token is present.
 */
async function requireWalletJWT(c: Context<WalletContext>, next: Next) {
  const token = c.req.header("authorization");

  if (!token) {
    return c.text("Unauthorized", 401);
  }

  try {
    const jwtRes = jwt.verify(token, salt) as WalletJWT;
    c.set("wallet", jwtRes.publicKey);
    await next();
  } catch (err) {
    console.error("[Failed to validate JWT]");
    console.error(err);
    return c.text("Unauthorized", 401);
  }
}

/**
 * Searches for a JWT token, if found it binds the public key to
 * the context so it becomes reusable. This middleware is non-strict
 * and the request will pass even if no JWT token is present.
 */
async function optionalWalletJWT(c: Context<WalletContext>, next: Next) {
  const token = c.req.header("authorization");

  if (token) {
    try {
      const jwtRes = jwt.verify(token, salt) as WalletJWT;
      c.set("wallet", jwtRes.publicKey);
    } catch (err) {
      console.error("[Failed to optionally validate JWT]");
      console.error(err);
    }
  }
  await next();
}

export { requireWalletJWT, optionalWalletJWT };