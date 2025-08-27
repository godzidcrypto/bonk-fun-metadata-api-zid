import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { metadataEnv } from "../env";
import { userSchema } from "../db/schema";
import { requireWalletJWT } from "../middleware/jwt";
import { pubkeyValidator } from "../validation/pubkey_validation";
import { UserAssignSchema } from "../validation/user_assign_validation";

const userRouter = new Hono();

userRouter.post('/assign',
    arktypeValidator('json', UserAssignSchema, (result, c) => {
        if (!result.success) {
            console.error('Validation Problems:', result.errors.summary);
            return c.text(`You have provided incorrect user profile data:\n${result.errors.summary}`, 400);
        }
    }),
    requireWalletJWT,
    async (c) => {
        const validatedData = c.req.valid('json');
        const pubkey = c.get('wallet')!;

        const name = validatedData.name || pubkey;
        const bio = validatedData.bio || "Hello, welcome to my profile!";

        const userExists = await db.query.userSchema.findFirst({
            where: (users, { eq }) => eq(users.pubkey, pubkey)
        })

        if (userExists) {
            try {
                await db.update(userSchema).set({
                    name,
                    bio
                }).where(eq(userSchema.pubkey, pubkey))
                return c.text("User profile updated successfully");
            } catch (e) {
                console.error("Failed to update user profile information");
                console.error(e);
                return c.text("Failed to update user profile information", 500);
            }
        } else {
            try {
                await db.insert(userSchema).values({
                    pubkey,
                    name,
                    bio
                })
                return c.text("User profile created successfully");
            } catch (e) {
                console.error("Failed to insert new user profile information");
                console.error(e);
                return c.text("Failed to insert new user profile information", 500);
            }
        }
    })

userRouter.get('/get/:pubkey',
    arktypeValidator('param', type({ pubkey: pubkeyValidator }), (result, c) => {
        if (!result.success) {
            console.error('Validation Problems:', result.errors.summary);
            return c.text(`You have provided incorrect public key data:\n${result.errors.summary}`, 400);
        }
    }),
    async (c) => {
        const pubkey = c.req.param('pubkey');
        const user = await db.query.userSchema.findFirst({
            where: (users, { eq }) => eq(users.pubkey, pubkey)
        })

        if (!user) {
            return c.text("User not found", 404);
        }

        // Omit sensitive fields
        const { kickAccessToken, ...safeUser } = user as any
        return c.json(safeUser);
    })

// Kick connection: exchange code and store token + username
const KickConnectSchema = type({
  code: 'string>0',
  codeVerifier: 'string>0',
  redirectUri: 'string>0'
})

userRouter.post(
  '/connections/kick',
  arktypeValidator('json', KickConnectSchema, (result, c) => {
    if (!result.success) {
      console.error('Validation Problems:', result.errors.summary)
      return c.text(`Invalid request data: ${result.errors.summary}`, 400)
    }
  }),
  requireWalletJWT,
  async (c) => {
    const { code, codeVerifier, redirectUri } = c.req.valid('json') as {
      code: string; codeVerifier: string; redirectUri: string
    }
    const pubkey = c.get('wallet')!

    try {
      const KICK_OAUTH_URL = metadataEnv.KICK_OAUTH_URL
      const KICK_API_URL = metadataEnv.KICK_API_URL
      const KICK_CLIENT_ID = metadataEnv.KICK_CLIENT_ID
      const KICK_CLIENT_SECRET = metadataEnv.KICK_CLIENT_SECRET

      if (!KICK_CLIENT_ID || !KICK_CLIENT_SECRET) {
        return c.text('Server missing Kick OAuth credentials', 500)
      }

      // Exchange code for tokens
      const tokenRes = await fetch(`${KICK_OAUTH_URL.replace(/\/$/, '')}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KICK_CLIENT_ID,
          client_secret: KICK_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          code,
        }),
      })

      if (!tokenRes.ok) {
        const t = await tokenRes.text()
        console.error('Kick token exchange failed:', t)
        return c.text('Failed to exchange authorization code', 400)
      }

      const tokenJson = await tokenRes.json() as {
        access_token: string
        refresh_token?: string
        expires_in?: number
        scope?: string
        token_type?: string
      }

      const accessToken = tokenJson.access_token
      if (!accessToken) {
        return c.text('No access token returned by Kick', 400)
      }

      console.log("Access Token:", accessToken);
      console.log("Kick User API URL:", `${KICK_API_URL.replace(/\/$/, '')}/public/v1/users`);

      // Fetch user info (current authorised user)
      const meRes = await fetch(`${KICK_API_URL.replace(/\/$/, '')}/public/v1/users`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: '*/*',
        },
      })

      if (!meRes.ok) {
        const t = await meRes.text()
        console.error('Kick user fetch failed:', t)
        return c.text('Failed to fetch Kick user profile', 400)
      }

      const meJson = await meRes.json() as { data?: Array<{ name?: string; user_id?: number; email?: string }> }
      const kickName = meJson.data?.[0]?.name ?? ''

      // Store token + username on user record
      const userExists = await db.query.userSchema.findFirst({
        where: (users, { eq }) => eq(users.pubkey, pubkey)
      })

      if (userExists) {
        await db.update(userSchema).set({
          kickAccessToken: accessToken,
          kickUsername: kickName || userExists.kickUsername || null,
        }).where(eq(userSchema.pubkey, pubkey))
      } else {
        await db.insert(userSchema).values({
          pubkey,
          name: pubkey,
          bio: 'Hello, welcome to my profile!',
          kickAccessToken: accessToken,
          kickUsername: kickName || null,
        })
      }

      return c.json({ status: 'success', username: kickName || null })
    } catch (e) {
      console.error('Error connecting Kick:', e)
      return c.text('Internal server error', 500)
    }
  }
)

// Disconnect Kick: clear stored token and username
userRouter.delete('/connections/kick', requireWalletJWT, async (c) => {
  const pubkey = c.get('wallet')!
  try {
    const userExists = await db.query.userSchema.findFirst({
      where: (users, { eq }) => eq(users.pubkey, pubkey)
    })
    if (!userExists) {
      return c.text('User not found', 404)
    }
    await db.update(userSchema).set({ kickAccessToken: null, kickUsername: null }).where(eq(userSchema.pubkey, pubkey))
    return c.text('Disconnected Kick')
  } catch (e) {
    console.error('Error disconnecting Kick:', e)
    return c.text('Internal server error', 500)
  }
})

export default userRouter