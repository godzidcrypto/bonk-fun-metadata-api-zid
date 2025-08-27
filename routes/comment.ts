import { profanity } from '@2toad/profanity';
import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { Hono } from "hono";
import { db } from "../db";
import { commentSchema } from "../db/schema";
import { requireWalletJWT } from "../middleware/jwt";
import { CommentSchema } from "../validation/comment_validation";
import { pubkeyValidator } from "../validation/pubkey_validation";
import { metadataEnv } from '../env';

const commentRouter = new Hono();
const DISABLE_COMMENTS = metadataEnv?.FEATURE_DISABLE_COMMENTS === "true";

commentRouter.post('/post',
    arktypeValidator('json', CommentSchema, (result, c) => {
        if (!result.success) {
            console.error('Validation Problems:', result.errors.summary);
            return c.text(`You have provided incorrect comment data:\n${result.errors.summary}`, 400);
        }
    }),
    requireWalletJWT,
    async (c) => {
        if (DISABLE_COMMENTS) {
            return c.text("Comment service unavailable", 503);
        }

        const validatedData = c.req.valid('json');
        const pubkey = c.get('wallet')!;

        const userExists = await db.query.userSchema.findFirst({
            where: (users, { eq }) => eq(users.pubkey, pubkey)
        })

        if (!userExists) {
            return c.text("A user with this pubkey doesn't exist", 400);
        }

        const { comment, tokenMint } = validatedData

        if (profanity.exists(comment)) {
            return c.text("Your comment cannot contain profanity", 400);
        }

        try {
            await db.insert(commentSchema).values({
                userPubkey: pubkey,
                tokenMint,
                message: comment
            })
            return c.text("Successfully created comment")
        } catch (e) {
            console.error("Failed to create comment");
            console.error(e);
            return c.text("Failed to post comment, internal server error", 500);
        }
    })

commentRouter.get('/get/:pubkey',
    arktypeValidator('param', type({ pubkey: pubkeyValidator }), (result, c) => {
        if (!result.success) {
            console.error('Validation Problems:', result.errors.summary);
            return c.text(`You have provided incorrect public key data:\n${result.errors.summary}`, 400);
        }
    }),
    async (c) => {
    const tokenMint = c.req.param('pubkey');

    // Get comments with user data
    const comments = await db.query.commentSchema.findMany({
        where: (comments, { eq }) => eq(comments.tokenMint, tokenMint),
        with: {
            users: true
        }
    })

    return c.json(comments);
})

commentRouter.get('/user/:pubkey',
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
        const comments = await db.query.commentSchema.findMany({
            where: (comments, { eq }) => eq(comments.userPubkey, pubkey),
            with: {
                users: true
            },
            orderBy: (comments, { desc }) => [desc(comments.created)]
        })
        // Omit sensitive fields from user
        const { kickAccessToken, ...safeUser } = user as any
        return c.json({
            user: safeUser,
            comments
        });
    })

export default commentRouter