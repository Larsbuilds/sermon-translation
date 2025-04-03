# Setting Up GitHub Secrets for CI/CD

This guide explains how to set up the required secrets for our GitHub Actions CI/CD pipeline.

## Required Secrets

1. **RAILWAY_TOKEN**
   - Purpose: Authenticate with Railway for WebSocket server deployment
   - How to get:
     1. Go to [Railway Dashboard](https://railway.app/dashboard)
     2. Click on your profile picture → Developer Settings
     3. Generate a new token with appropriate permissions
     4. Copy the token

2. **VERCEL_TOKEN**
   - Purpose: Authenticate with Vercel for Next.js app deployment
   - How to get:
     1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
     2. Click on your avatar → Settings
     3. Go to Tokens tab
     4. Create a new token with full scope
     5. Copy the token

3. **VERCEL_ORG_ID**
   - Purpose: Identify your Vercel organization
   - How to get:
     1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
     2. Click on your organization settings
     3. Copy the ID from the URL or settings page

4. **VERCEL_PROJECT_ID**
   - Purpose: Identify your Vercel project
   - How to get:
     1. Go to your project in Vercel
     2. Go to Project Settings
     3. Copy the Project ID from the General tab

5. **MONGODB_URI**
   - Purpose: Connect to MongoDB for tests
   - Value: Your MongoDB connection string

## Adding Secrets to GitHub

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Click on "Secrets and variables" → "Actions" in the sidebar
4. Click "New repository secret"
5. Add each secret:
   - Name: Use the exact names listed above
   - Value: Paste the corresponding value
   - Click "Add secret"

## Verifying Secrets

1. Go to repository "Settings" → "Secrets and variables" → "Actions"
2. You should see all secrets listed (values will be hidden)
3. Secrets should be:
   - RAILWAY_TOKEN
   - VERCEL_TOKEN
   - VERCEL_ORG_ID
   - VERCEL_PROJECT_ID
   - MONGODB_URI

## Testing the Setup

1. Make a small change to your repository
2. Push to main branch
3. Go to "Actions" tab
4. You should see the workflow running
5. Check that all jobs complete successfully

## Troubleshooting

If you encounter errors:

1. **Railway Deployment Fails**
   - Verify RAILWAY_TOKEN is correct
   - Check Railway CLI is installed in workflow
   - Verify project exists in Railway

2. **Vercel Deployment Fails**
   - Verify all Vercel secrets are correct
   - Check project exists in Vercel
   - Verify project ID matches

3. **Tests Fail**
   - Verify MONGODB_URI is correct
   - Check MongoDB instance is accessible
   - Review test logs for specific errors

## Security Notes

- Never commit secrets to the repository
- Rotate secrets periodically
- Use minimal required permissions
- Monitor GitHub Actions usage 