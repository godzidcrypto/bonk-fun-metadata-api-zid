import { Hono, type Context } from "hono";
import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { requireWalletJWT } from "../middleware/jwt.js";
import { db } from "../db/index.js";
import { and, eq, desc } from "drizzle-orm";
import { contestRegistrationSchema, userSchema } from "../db/schema.js";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { metadataEnv } from "../env.js";

const contestRouter = new Hono();
const MIN_SOL_REQUIRED = 0.1;

const RegistrationSchema = type({
  contestId: "string>0",
  twitter: "string>0",
  profileImageUrl: "string>0",
});

// Register for contest
contestRouter.post(
  "/register",
  arktypeValidator("json", RegistrationSchema, (result, c) => {
    if (!result.success) {
      console.error("Validation Problems:", result.errors.summary);
      return c.text(`Invalid registration data: ${result.errors.summary}`, 400);
    }
  }),
  requireWalletJWT,
  async (c) => {
    try {
      let { contestId, twitter, profileImageUrl } = c.req.valid("json") as {
        contestId: string;
        twitter: string;
        profileImageUrl: string;
      };
      const pubkey = c.get("wallet")!;

      // Normalize/validate twitter handle
      twitter = twitter.replace(/^@+/, "").trim();
      const twitterValid = /^[A-Za-z0-9_]{1,15}$/.test(twitter);
      if (!twitterValid) {
        return c.text(
          "Invalid twitter handle. Use 1-15 chars: letters, numbers, underscore.",
          400
        );
      }

      // Optional: verify pubkey is a valid Solana address
      try {
        new PublicKey(pubkey);
      } catch {
        return c.text("Invalid wallet in JWT", 400);
      }

      // Verify balance on mainnet
      const connection = new Connection("https://api.mainnet-beta.solana.com");
      const lamports = await connection.getBalance(new PublicKey(pubkey));
      const sol = lamports / LAMPORTS_PER_SOL;
      if (sol < MIN_SOL_REQUIRED) {
        return c.text(
          `Insufficient SOL balance (need ${MIN_SOL_REQUIRED} SOL)`,
          400
        );
      }

      // Ensure user row exists for FK
      const existingUser = await db.query.userSchema.findFirst({
        where: (u, { eq }) => eq(u.pubkey, pubkey),
      });
      if (!existingUser) {
        await db.insert(userSchema).values({
          pubkey,
          name: pubkey,
          bio: "Hello, welcome to my profile!",
        });
      }

      // Upsert-like behavior: if already registered, update twitter/profileImageUrl
      const existing = await db.query.contestRegistrationSchema.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.contestId, contestId), eq(t.userPubkey, pubkey)),
      });

      if (existing) {
        await db
          .update(contestRegistrationSchema)
          .set({ twitter, profileImageUrl })
          .where(and(eq(contestRegistrationSchema.id, existing.id!)));
        return c.json({ status: "updated", approved: !!existing.approved });
      }

      await db.insert(contestRegistrationSchema).values({
        contestId,
        userPubkey: pubkey,
        twitter,
        profileImageUrl,
        walletAddress: pubkey,
        approved: false,
      });

      return c.json({ status: "registered", approved: false });
    } catch (e) {
      console.error("Failed to register for contest", e);
      return c.text("Failed to register", 500);
    }
  }
);

// Get current user's registration status
contestRouter.get("/status/:contestId", requireWalletJWT, async (c) => {
  try {
    const contestId = c.req.param("contestId");
    const pubkey = c.get("wallet")!;
    const row = await db.query.contestRegistrationSchema.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.contestId, contestId), eq(t.userPubkey, pubkey)),
    });
    if (!row) return c.json({ registered: false });
    return c.json({ registered: true, approved: !!row.approved, data: row });
  } catch (e) {
    console.error("Failed to fetch status", e);
    return c.text("Failed to fetch status", 500);
  }
});

// Public leaderboard for a contest (approved only)
contestRouter.get("/leaderboard/:contestId", async (c) => {
  try {
    const contestId = c.req.param("contestId");
    const rows = await db
      .select()
      .from(contestRegistrationSchema)
      .where(
        and(
          eq(contestRegistrationSchema.contestId, contestId),
          eq(contestRegistrationSchema.approved, true)
        )
      )
      .orderBy(desc(contestRegistrationSchema.created));

    return c.json({ items: rows });
  } catch (e) {
    console.error("Failed to fetch leaderboard", e);
    return c.text("Failed to fetch leaderboard", 500);
  }
});

// ===== Admin endpoints =====
// Simple password gate using ADMIN_PASSWORD
function isAdminAuthorized(c: Context) {
  const pwd = c.req.header("x-admin-password") || c.req.query("admin_password");
  return !!pwd && pwd === metadataEnv.ADMIN_PASSWORD;
}

// Admin: list all registrations for a contest
contestRouter.get("/admin/list/:contestId", async (c) => {
  if (!isAdminAuthorized(c)) return c.text("Unauthorized", 401);
  try {
    const contestId = c.req.param("contestId");
    const rows = await db
      .select()
      .from(contestRegistrationSchema)
      .where(eq(contestRegistrationSchema.contestId, contestId))
      .orderBy(desc(contestRegistrationSchema.created));
    return c.json({ items: rows });
  } catch (e) {
    console.error("Failed to fetch admin list", e);
    return c.text("Failed to fetch admin list", 500);
  }
});

// Admin: approve/unapprove a registration by id
const ApproveSchema = type({ id: "number", approved: "boolean" });
contestRouter.post(
  "/admin/approve",
  arktypeValidator("json", ApproveSchema, (result, c) => {
    if (!result.success) {
      console.error("Validation Problems:", result.errors.summary);
      return c.text(`Invalid approve data: ${result.errors.summary}`, 400);
    }
  }),
  async (c) => {
    if (!isAdminAuthorized(c)) return c.text("Unauthorized", 401);
    try {
      const { id, approved } = c.req.valid("json") as {
        id: number;
        approved: boolean;
      };
      await db
        .update(contestRegistrationSchema)
        .set({ approved })
        .where(eq(contestRegistrationSchema.id, id));
      return c.json({ status: "ok" });
    } catch (e) {
      console.error("Failed to update approval", e);
      return c.text("Failed to update approval", 500);
    }
  }
);

export default contestRouter;
