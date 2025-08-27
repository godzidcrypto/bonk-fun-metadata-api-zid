import { type } from "arktype";
import { pubkeyValidator } from "./pubkey_validation.js";

const MIN_COMMENT_LENGTH = 4;
const MAX_COMMENT_LENGTH = 1024;

export const CommentSchema = type({
  comment: `string >= ${MIN_COMMENT_LENGTH} & string <= ${MAX_COMMENT_LENGTH}`,
  tokenMint: pubkeyValidator,
});
