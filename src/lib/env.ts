import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number).default('3000'),

  // Database
  MONGODB_URI: z.string().url(),

  // WebSocket
  NEXT_PUBLIC_WS_URL: z.string().url(),

  // API
  NEXT_PUBLIC_API_URL: z.string().url(),

  // Security
  CORS_ORIGIN: z.string().url(),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().transform((val) => val === 'true').default('false'),
  NEXT_PUBLIC_ENABLE_SENTRY: z.string().transform((val) => val === 'true').default('false'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => {
        return `${issue.path.join('.')}: ${issue.message}`;
      });
      console.error('❌ Invalid environment variables:', issues.join('\n'));
      process.exit(1);
    }
    throw error;
  }
}

export const env = validateEnv(); 