"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
var zod_1 = require("zod");
// Environment variable schema for WebSocket server
var schema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    WS_HOST: zod_1.z.string().default('0.0.0.0'),
    // Default to 8080 or use process.env.PORT if available
    WS_PORT: zod_1.z.coerce
        .number()
        .default(function () { return parseInt(process.env.PORT || '8080'); }),
    MONGODB_URI: zod_1.z.string().min(1).default('mongodb://localhost:27017'),
    REDIS_URL: zod_1.z.string().min(1).default('redis://localhost:6379'),
    // Optional public URL for this WebSocket server
    WS_URL: zod_1.z.string().optional(),
    REDIS_PASSWORD: zod_1.z.string().optional(),
    REDIS_TLS: zod_1.z.enum(['true', 'false']).default('false').transform(function (val) { return val === 'true'; }),
    MAX_CONNECTIONS_PER_SESSION: zod_1.z.coerce.number().default(5),
    SESSION_TTL: zod_1.z.coerce.number().default(3600), // 1 hour
    ENABLE_REQUEST_LOGGING: zod_1.z.enum(['true', 'false']).default('false').transform(function (val) { return val === 'true'; }),
    ALLOWED_ORIGINS: zod_1.z.string().default('http://localhost:3000,http://localhost:8080,https://sermon-translation-larsbuilds.vercel.app'),
});
function validateEnv() {
    try {
        var env_1 = schema.parse(process.env);
        // Log environment details in development mode
        if (env_1.NODE_ENV !== 'production') {
            console.log('Environment configuration:', {
                NODE_ENV: env_1.NODE_ENV,
                WS_HOST: env_1.WS_HOST,
                WS_PORT: env_1.WS_PORT,
                WS_URL: env_1.WS_URL,
                REDIS_URL: env_1.REDIS_URL,
                REDIS_TLS: env_1.REDIS_TLS,
            });
        }
        // Additional validation for production
        if (env_1.NODE_ENV === 'production') {
            // Check if we're in a Railway deployment with internal hostnames
            var isRailwayInternal = env_1.REDIS_URL.includes('.railway.internal');
            // Only require password if not using Railway internal network
            if (!env_1.REDIS_PASSWORD && !isRailwayInternal) {
                console.warn('⚠️ REDIS_PASSWORD is not set in production but may be required if not using Railway internal network');
            }
            if (!env_1.REDIS_TLS && !isRailwayInternal) {
                console.warn('⚠️ REDIS_TLS should be enabled in production when not using Railway internal network');
            }
        }
        return env_1;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            var issues = error.issues.map(function (issue) {
                return "".concat(issue.path.join('.'), ": ").concat(issue.message);
            });
            console.error('❌ Invalid environment variables:', issues.join('\n'));
            process.exit(1);
        }
        if (error instanceof Error) {
            console.error('❌ Environment validation failed:', error.message);
            process.exit(1);
        }
        throw error;
    }
}
exports.env = validateEnv();
