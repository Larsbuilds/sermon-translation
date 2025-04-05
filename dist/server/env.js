import { z } from 'zod';
// Environment variable schema for WebSocket server
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    WS_HOST: z.string().default('0.0.0.0'),
    // Default to 8080 or use process.env.PORT if available
    WS_PORT: z.coerce
        .number()
        .default(() => parseInt(process.env.PORT || '8080')),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    // Optional public URL for this WebSocket server
    WS_URL: z.string().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
    MAX_CONNECTIONS_PER_SESSION: z.coerce.number().default(5),
    SESSION_TTL: z.coerce.number().default(3600), // 1 hour
    ENABLE_REQUEST_LOGGING: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8080,https://sermon-translation-larsbuilds.vercel.app'),
});
function validateEnv() {
    try {
        const env = schema.parse(process.env);
        // Log environment details in development mode
        if (env.NODE_ENV !== 'production') {
            console.log('Environment configuration:', {
                NODE_ENV: env.NODE_ENV,
                WS_HOST: env.WS_HOST,
                WS_PORT: env.WS_PORT,
                WS_URL: env.WS_URL,
                REDIS_URL: env.REDIS_URL,
                REDIS_TLS: env.REDIS_TLS,
            });
        }
        // Additional validation for production
        if (env.NODE_ENV === 'production') {
            // Check if we're in a Railway deployment with internal hostnames
            const isRailwayInternal = env.REDIS_URL.includes('.railway.internal');
            // Only require password if not using Railway internal network
            if (!env.REDIS_PASSWORD && !isRailwayInternal) {
                console.warn('⚠️ REDIS_PASSWORD is not set in production but may be required if not using Railway internal network');
            }
            if (!env.REDIS_TLS && !isRailwayInternal) {
                console.warn('⚠️ REDIS_TLS should be enabled in production when not using Railway internal network');
            }
        }
        return env;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => {
                return `${issue.path.join('.')}: ${issue.message}`;
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
export const env = validateEnv();
//# sourceMappingURL=env.js.map