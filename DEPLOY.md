# =====================================================
# CRM Cloud Deployment Guide
# =====================================================

## Quick Deploy Options

### Option 1: Railway (Recommended - Free $5/month credit)
1. Go to https://railway.app
2. Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `final_crm` repository
5. Railway will auto-detect Node.js
6. Add PostgreSQL: Click "New" → "Database" → "PostgreSQL"
7. Set environment variables (see below)
8. Done! Your app is live 24/7

### Option 2: Render (Free tier available)
1. Go to https://render.com
2. Login with GitHub  
3. Click "New" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Build Command: `npm run postinstall`
   - Start Command: `npm start`
6. Create a PostgreSQL database in Render
7. Set environment variables

### Option 3: Fly.io (Free tier: 3 VMs)
1. Install flyctl: https://fly.io/docs/getting-started/installing-flyctl/
2. Run: `fly launch`
3. Run: `fly postgres create`
4. Deploy: `fly deploy`

---

## Environment Variables (REQUIRED)

Set these in your cloud platform's dashboard:

```bash
# Database (REQUIRED - get from your cloud PostgreSQL)
DATABASE_HOST=your-db-host.railway.app
DATABASE_PORT=5432
DATABASE_NAME=railway
DATABASE_USER=postgres
DATABASE_PASSWORD=your-password

# OR use connection string format:
DATABASE_URL=postgresql://postgres:password@host:5432/railway

# Enable SSL for cloud databases
DATABASE_SSL=true

# Application Settings
NODE_ENV=production
PORT=4000

# Backend Mode
BACKEND_MODE=LIVE

# Tally (if you have a cloud Tally server)
TALLY_URL=http://your-tally-server:9000

# Optional
SERVICE_ENABLED=true
MAX_ADMINS=5
MAX_TOTAL_USERS=200
```

---

## Deploying via Git

### First-time Setup on Cloud Server:
```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/final_crm.git
cd final_crm

# Install dependencies
npm run install:all

# Set environment variables
export DATABASE_HOST=your-db-host
export DATABASE_PORT=5432
export DATABASE_NAME=samcrm
export DATABASE_USER=postgres
export DATABASE_PASSWORD=your-password
export DATABASE_SSL=true
export NODE_ENV=production
export PORT=4000

# Start the server
npm start
```

### Updating on Cloud Server:
```bash
cd final_crm
git pull origin main
npm run postinstall
# Restart your process manager (PM2/systemd)
pm2 restart crm
```

---

## Running 24/7 with PM2

Install PM2 (process manager):
```bash
npm install -g pm2
```

Start with PM2:
```bash
pm2 start backend/server.js --name "crm"
pm2 save
pm2 startup  # Auto-start on reboot
```

PM2 Commands:
```bash
pm2 list          # List all processes
pm2 logs crm      # View logs
pm2 restart crm   # Restart
pm2 stop crm      # Stop
```

---

## Frontend Deployment

The frontend (React/Vite) needs to be built and served:

### Option A: Serve from Backend
```bash
cd frontend
npm run build
# Copy dist/ to backend/public/
```

### Option B: Deploy to Vercel/Netlify (Free)
1. Connect your GitHub repo
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

---

## Database Migration

After deploying, initialize the database:
```bash
cd database
node -e "require('./index').initialize({ runMigrations: true })"
```

---

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_HOST is not `localhost`
- Ensure DATABASE_SSL=true for cloud databases
- Verify credentials in your cloud database dashboard

### "Port already in use"
- Cloud platforms assign PORT automatically
- Make sure server.js uses: `process.env.PORT || 4000`

### "Module not found"
- Run `npm run postinstall` to install all dependencies

---

## Recommended Cloud Stack

| Component | Service | Cost |
|-----------|---------|------|
| Backend   | Railway | $5 free/month |
| Database  | Railway PostgreSQL | Included |
| Frontend  | Vercel | Free |
| Domain    | Cloudflare | Free DNS |

Total: **$0-5/month** for small usage
