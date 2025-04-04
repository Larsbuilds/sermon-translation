import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number).default('3002'),
  HOST: z.string().default('0.0.0.0'),
  
  // WebSocket Server
  WS_PORT: z.string().transform(Number).default('8080'),
  WS_HOST: z.string().default('0.0.0.0'),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().transform((val) => val === 'true').default('false'),

  // Security
  ALLOWED_ORIGINS: z.string(),
  JWT_SECRET: z.string().min(32).optional(),

  // Session
  SESSION_TTL: z.string().transform(Number).default('3600'),
  MAX_CONNECTIONS_PER_SESSION: z.string().transform(Number).default('2'),
  SESSION_CLEANUP_INTERVAL: z.string().transform(Number).default('300'),

  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_PER_WINDOW: z.string().transform(Number).default('100'),
  RATE_LIMIT_BLOCK_DURATION: z.string().transform(Number).default('300000'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['dev', 'json']).default('json'),
  ENABLE_REQUEST_LOGGING: z.string().transform((val) => val === 'true').default('true'),

  // Monitoring
  ENABLE_METRICS: z.string().transform((val) => val === 'true').default('false'),
  METRICS_PORT: z.string().transform(Number).default('9090'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);

    // Additional validation for production
    if (env.NODE_ENV === 'production') {
      if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production');
      }
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