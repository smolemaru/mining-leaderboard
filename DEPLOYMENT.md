# BIGCOIN Mining Leaderboard Deployment Guide

This document provides instructions for deploying the BIGCOIN Mining Leaderboard application in both development and production environments.

## Prerequisites

- Node.js (v16+)
- npm (v7+) or yarn
- A GitHub account
- A Vercel account (you can sign up with your GitHub account)

## Development Environment Setup

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd mining-leaderboard/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```
   
   This will start the server with nodemon, which automatically restarts when files change.

### Frontend Setup

During development, you can serve the frontend using a simple HTTP server:

1. From the project root, install the project dependencies:
   ```
   cd mining-leaderboard
   npm install
   ```

2. Start the frontend development server:
   ```
   npm run start:frontend
   ```

3. Open your browser and navigate to `http://localhost:8080`

Alternatively, you can start both the backend and frontend with a single command:
```
npm start
```

## Production Deployment with Vercel

Vercel provides a simple and efficient way to deploy full-stack JavaScript applications. The BIGCOIN Mining Leaderboard is already configured for Vercel deployment.

### Preparation

1. Push your project to GitHub:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/mining-leaderboard.git
   git push -u origin main
   ```

### Deploying to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Import your GitHub repository:
   - Select the mining-leaderboard repository you created
   - Vercel will automatically detect the project configuration

4. Configure Project Settings:
   - Name: `mining-leaderboard` (or your preferred name)
   - Framework Preset: Leave as "Other" (auto-detected)
   - Root Directory: Keep as default (/)
   - Build and Output Settings: Leave as default

5. Click "Deploy"

Vercel will automatically build and deploy your application, providing you with a deployment URL (e.g., `https://mining-leaderboard.vercel.app`).

### Custom Domain (Optional)

If you'd like to use a custom domain:

1. In your project dashboard, go to "Settings" > "Domains"
2. Add your custom domain and follow the verification steps

### How It Works

The deployment uses the `vercel.json` configuration file in your project:

```json
{
  "version": 2,
  "builds": [
    { "src": "backend/server.js", "use": "@vercel/node" },
    { "src": "frontend/**/*", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "backend/server.js" },
    { "src": "/(.*)", "dest": "frontend/$1" }
  ]
}
```

This configuration:
- Builds the backend as a serverless function
- Deploys the frontend as static files
- Routes API requests to the backend
- Routes all other requests to the frontend

## Verifying Deployment

After deployment, verify that everything is working:

1. Visit your deployment URL (provided by Vercel)
2. Check that the leaderboard displays correctly
3. Verify API endpoints:
   - `https://your-deployment-url.vercel.app/api/health`
   - `https://your-deployment-url.vercel.app/api/leaderboard`

You can also run the verification script locally against your deployment:

```javascript
// Modify verify-deployment.js with your Vercel URL:
const CONFIG = {
  frontend: {
    url: 'https://your-deployment-url.vercel.app',
    expectedStatus: 200
  },
  backend: {
    healthUrl: 'https://your-deployment-url.vercel.app/api/health',
    leaderboardUrl: 'https://your-deployment-url.vercel.app/api/leaderboard',
    expectedStatus: 200
  },
  contract: {
    address: '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705'
  },
  timeoutMs: 10000
};

// Then run:
node verify-deployment.js
```

## Environment Variables

For production on Vercel, configure environment variables in the Vercel dashboard:

1. In your Vercel project, go to "Settings" > "Environment Variables"
2. Add the following variables:
   - `NODE_ENV`: Set to "production"
   - `PROVIDER_URL`: Your blockchain provider URL
   - `CONTRACT_ADDRESS`: Your contract address

## Monitoring and Health Checks

### Built-in Health Endpoint

The application provides a health check endpoint at `/api/health` that returns the current status.

### External Monitoring

For production deployments, consider using external monitoring services:

1. **Uptime Monitoring**:
   - Services like UptimeRobot, Pingdom, or StatusCake can monitor your Vercel deployment
   - Set up monitoring for both the frontend URL and backend health endpoint

2. **Log Monitoring**:
   - Vercel provides built-in logs for your deployments
   - Access logs from your Vercel dashboard under "Deployments" > select a deployment > "Logs"

3. **Performance Monitoring**:
   - Use Vercel Analytics for frontend performance monitoring
   - Add Application Performance Monitoring (APM) using tools like New Relic or Datadog

## Scaling Considerations

- Vercel automatically handles scaling for serverless functions
- For higher traffic applications, consider:
  - Using a CDN for serving frontend static assets (Vercel includes this by default)
  - Setting up database caching for blockchain data to reduce API calls
  - Adding appropriate caching headers in your API responses

## Maintenance and Updates

1. Deploying updates:
   - Simply push changes to your GitHub repository
   - Vercel will automatically rebuild and deploy your application

2. Rolling back to previous deployments:
   - From your Vercel dashboard, go to "Deployments"
   - Find the previous working deployment
   - Click on the three dots menu and select "Promote to Production"

## Security Recommendations

1. Secure your environment variables in the Vercel dashboard
2. Implement rate limiting on the API endpoints
3. Consider adding authentication for admin functions
4. Keep Node.js and dependencies updated regularly 