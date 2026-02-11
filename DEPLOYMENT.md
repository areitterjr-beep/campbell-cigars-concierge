# Campbell Cigars Concierge - Deployment Guide

## Quick Deploy to Vercel

### Prerequisites
- GitHub account
- Vercel account (free at vercel.com)
- Your Groq API key

### Environment Variables Needed

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Your Groq API key for AI vision/chat | ✅ Yes (or Gemini) |
| `GEMINI_API_KEY` | Google Gemini API key (free fallback when Groq fails) | Optional |
| `ADMIN_PASSWORD` | Password for admin panel access | ✅ Yes |

---

## Step-by-Step Deployment

### 1. Push Code to GitHub

```bash
cd cigar-shop
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your repository
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `cigar-shop` (if it's in a subdirectory)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

5. Add Environment Variables:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here   # Optional: free fallback when Groq fails
   ADMIN_PASSWORD=your_secure_admin_password
   ```

   Get a free Gemini key at [aistudio.google.com](https://aistudio.google.com/apikey)

6. Click **"Deploy"**

### 3. After Deployment

Your app will be live at: `https://your-project.vercel.app`

- Main app: `https://your-project.vercel.app`
- Admin panel: `https://your-project.vercel.app/admin`
- Evaluation dashboard: `https://your-project.vercel.app/evaluate`

---

## Alternative: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd cigar-shop
vercel

# Follow the prompts, then add env vars in Vercel dashboard
```

---

## Important Notes

### Data Storage
Currently, the app uses local JSON files for:
- Inventory (`src/data/cigars.json`)
- Evaluations (`src/data/evaluations.json`)

**On Vercel**: These files are read-only in production. For a production app with persistent data, you'd need to:
1. Use a database (MongoDB, Supabase, etc.)
2. Or use Vercel KV/Blob storage

For demo/MVP purposes, the initial data will work fine.

### Image Processing
The app uses `sharp` for image compression. Vercel supports this natively.

---

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure TypeScript has no errors: `npm run build`

### API Not Working
- Verify `GROQ_API_KEY` or `GEMINI_API_KEY` is set correctly in Vercel (at least one required)
- Check Vercel function logs for errors

### Admin Panel Access
- Use the `ADMIN_PASSWORD` you set in environment variables
