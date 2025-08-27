import { type } from "arktype";
import { metadataEnv } from "../env.js";

// --- Constants for validation ---
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 32;
const MIN_SYMBOL_LENGTH = 2;
const MAX_SYMBOL_LENGTH = 8;
const MAX_DESCRIPTION_LENGTH = 512;
const IMAGE_URL_PREFIX = `https://${metadataEnv.PINATA_GATEWAY}/`;
const TWITTER_URL_PREFIX_1 = "https://x.com/";
const TWITTER_URL_PREFIX_2 = "https://twitter.com/";
const TELEGRAM_URL_PREFIX = "https://t.me/";

// --- Main Schema Definition ---
export const TokenMetadataSchema = type({
  name: `string > ${MIN_NAME_LENGTH} & string < ${MAX_NAME_LENGTH}`,
  symbol: `string > ${MIN_SYMBOL_LENGTH} & string < ${MAX_SYMBOL_LENGTH}`,
  description: `string > 0 & string < ${MAX_DESCRIPTION_LENGTH}`,
  "createdOn?": "string.url < 256",
  image: type("string.url < 256").narrow((imageUrl, ctx) => {
    if (imageUrl.startsWith(IMAGE_URL_PREFIX)) {
      return true;
    }

    return ctx.reject({
      expected: "a valid Pinata image URL",
      actual: imageUrl,
      description: "Invalid Pinata image URL",
    });
  }),
  "twitter?": type("string.url < 256").narrow((imageUrl, ctx) => {
    if (
      imageUrl.startsWith(TWITTER_URL_PREFIX_1) ||
      imageUrl.startsWith(TWITTER_URL_PREFIX_2)
    ) {
      return true;
    }

    return ctx.reject({
      expected: "a valid Twitter/X URL",
      actual: imageUrl,
      description: "Invalid Twitter/X URL",
    });
  }),
  "telegram?": type("string.url < 256").narrow((imageUrl, ctx) => {
    if (imageUrl.startsWith(TELEGRAM_URL_PREFIX)) {
      return true;
    }

    return ctx.reject({
      expected: "a valid Telegram URL",
      actual: imageUrl,
      description: "Invalid Telegram URL",
    });
  }),
  "website?": "string.url < 256",
});
