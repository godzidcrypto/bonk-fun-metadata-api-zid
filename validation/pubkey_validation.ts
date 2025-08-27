import { PublicKey } from "@solana/web3.js"
import { type } from "arktype"

export const pubkeyValidator = type('string').narrow((x, ctx) => {
    try {
        new PublicKey(x)
        return true
    } catch (e) {
        return ctx.mustBe('a valid public key')
    }
})