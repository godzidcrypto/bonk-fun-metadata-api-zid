import { type } from "arktype";

const MIN_NAME_LENGTH = 4;
const MAX_NAME_LENGTH = 64;
const MIN_BIO_LENGTH = 4;
const MAX_BIO_LENGTH = 512;

export const UserAssignSchema = type({
    'name?': `string >= ${MIN_NAME_LENGTH} & string <= ${MAX_NAME_LENGTH}`,
    'bio?': `string >= ${MIN_BIO_LENGTH} & string <= ${MAX_BIO_LENGTH}`
})