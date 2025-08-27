import dotenvFlow from 'dotenv-flow';
import { type } from 'arktype';

// Environment + Validation
dotenvFlow.config();
const MetadataEnvSchema = type({
    PINATA_JWT: "string > 0",
    PINATA_GATEWAY: "string > 0",
    PORT: "string.numeric > 0",
    BIRDEYE_API_KEY: "string > 0",
    JWT_SALT: "string > 0",
    DB_FILE: "string > 0",
    FEATURE_DISABLE_COMMENTS: "string > 0",
    KICK_OAUTH_URL: "string > 0",
    KICK_API_URL: "string > 0",
    KICK_CLIENT_ID: "string > 0",
    KICK_CLIENT_SECRET: "string > 0",
    ADMIN_PASSWORD: "string > 0",
});

type MetadataEnv = typeof MetadataEnvSchema.infer;

const metadataEnvTemp = MetadataEnvSchema(process.env);

if (metadataEnvTemp instanceof type.errors) {
    throw metadataEnvTemp.summary;
}

export const metadataEnv = metadataEnvTemp;