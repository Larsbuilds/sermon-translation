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
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
  MAX_CONNECTIONS_PER_SESSION: z.coerce.number().default(5),
  SESSION_TTL: z.coerce.number().default(3600), // 1 hour
  ENABLE_REQUEST_LOGGING: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8080,https://sermon-translation-larsbuilds.vercel.app'),
});

export type Env = z.infer<typeof schema>;

function validateEnv(): Env {
  try {
    const env = schema.parse(process.env);

    // Additional validation for production
    if (env.NODE_ENV === 'production') {
      if (!env.REDIS_PASSWORD) {
        throw new Error('REDIS_PASSWORD is required in production');
      }
      if (!env.REDIS_TLS) {
        console.warn('⚠️ REDIS_TLS should be enabled in production');
      }
    }

    return env;
  } catch (error) {
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