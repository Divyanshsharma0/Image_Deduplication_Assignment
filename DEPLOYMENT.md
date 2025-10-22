# Deployment Guide

## Vercel Deployment

### 1. Prerequisites
- Vercel account
- Google Cloud Console account (for Gemini API)
- GitHub repository (optional, for CI/CD)

### 2. Environment Variables Setup

In your Vercel dashboard, add these environment variables:

```bash
# Required for AI processing
GOOGLE_API_KEY=your-gemini-api-key-here

# Optional: For development mode
NODE_ENV=production
```

### 3. Getting Google Gemini API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Generative Language API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key and add it to Vercel environment variables

### 4. Vercel Configuration

Your `vercel.json` is already configured correctly:

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 10
    }
  }
}
```

### 5. Deployment Commands

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy
vercel --prod

# Or deploy from GitHub
# Connect your repository in Vercel dashboard
```

### 6. Test Your Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Fetch images (test brand API integration)
curl https://your-app.vercel.app/api/images?brands=levis-1

# Test processing (will use fallback if no API key)
curl -X POST https://your-app.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -d '{"images": [...], "similarityThreshold": 0.85}'
```

### 7. Monitoring

- Check Vercel function logs in dashboard
- Monitor API usage in Google Cloud Console
- Use the `/api/health` endpoint for uptime monitoring

### 8. Troubleshooting

**Common Issues:**

1. **API Key Not Working**: Ensure Gemini API is enabled in Google Cloud
2. **Timeout Errors**: Reduce batch size in `clipProcessor.js` or use fewer images
3. **Memory Issues**: Vercel has 1GB memory limit for free tier
4. **Build Failures**: Check Node.js version compatibility

**Fallback Mode:**
- App automatically uses dHash fallback when Gemini API fails
- No API key required for basic functionality
- Lower accuracy but still functional

## Performance Optimization

For production, consider:

1. **CDN**: Images are already served from brand CDNs
2. **Caching**: Add Redis for processed results caching
3. **Batch Size**: Tune `BATCH_SIZE` in processors based on memory limits
4. **Similarity Threshold**: Adjust based on desired precision/recall

## Cost Considerations

- **Gemini API**: ~$0.002-0.004 per image (varies by complexity)
- **Vercel**: Free tier includes 100GB bandwidth, 10GB storage
- **Estimated Cost**: ~$0.20-0.40 per 100 images processed

## Scaling Options

1. **Horizontal**: Use Vercel's edge functions
2. **Vertical**: Upgrade to Pro plan for more memory/CPU
3. **Alternative**: Deploy on cloud platforms with more resources