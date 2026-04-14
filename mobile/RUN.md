# Hermetical Mobile App - Run & Deploy Guide

## Quick Start (For You)

### First Time Setup

```bash
# Navigate to mobile folder
cd F:\Projects\Guidewire_Project\mobile

# Install dependencies (only once)
npm install

# Install web support (only once)
npx expo install react-dom react-native-web
```

---

## Running Locally

### Option 1: Web Browser (Fastest for Dev)

```bash
npm run web
```

Opens at: **http://localhost:8081**

### Option 2: Android Emulator

```bash
npm run android
```

### Option 3: Physical Device via Expo Go

```bash
npm start
```

Then:
1. Install **Expo Go** from Play Store on your Android phone
2. Scan the QR code that appears in terminal
3. App loads on your phone

---

## Connecting to Backend

### For Local Backend

1. Find your computer's IP address:
   ```bash
   ipconfig
   ```
   Look for IPv4 Address (e.g., `192.168.1.100`)

2. Edit `src/api/config.ts`:
   ```typescript
   const API_BASE_URL = 'http://192.168.1.100:8000';
   ```

3. Make sure backend is running:
   ```bash
   cd F:\Projects\Guidewire_Project
   uvicorn server.main:app --reload --port 8000
   ```

### For Deployed Backend (Railway/Render)

1. Deploy your backend first (see Deployment section below)

2. Edit `src/api/config.ts`:
   ```typescript
   const API_BASE_URL = 'https://your-app.railway.app';
   ```

---

## Test Credentials

### Worker
- **Phone**: Any 10-digit number (e.g., `9876543210`)
- **OTP**: `123456` (demo mode)

### Admin
- **PIN**: `admin123`

---

## Deployment (For Judges)

### Step 1: Deploy Backend

**Option A: Railway (Recommended - Free)**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Navigate to backend folder and deploy
cd F:\Projects\Guidewire_Project
railway init
railway up
```

Railway will auto-detect FastAPI and deploy it.

**Option B: Render (Free, No Credit Card)**

1. Go to https://render.com
2. New Web Service → Connect GitHub repo
3. Root Directory: `server`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 2: Update Mobile App Config

After backend is deployed, update `src/api/config.ts`:

```typescript
const API_BASE_URL = 'https://your-railway-app.up.railway.app';
```

### Step 3: Build Mobile App for Submission

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo (create free account if needed)
eas login

# Build Android APK (runs in cloud, ~10 minutes)
eas build --profile preview --platform android
```

### Step 4: Get Your Build

1. Go to https://expo.dev/accounts/your-account/projects/hermetical/builds
2. Download the APK
3. Share with judges OR submit the download link

### Step 5: Share with Judges

**Option A: QR Code (Live Demo)**
```bash
npm start
```
Share the QR code screenshot - judges scan with Expo Go app.

**Option B: APK File**
- Download APK from Expo build page
- Attach to submission or share via Google Drive

---

## Troubleshooting

### "Network request failed"
- Backend not running? Start it first
- Wrong IP? Check `ipconfig` and update `config.ts`
- Using localhost on Android? Use your IP instead (e.g., `192.168.1.100`)

### "Module not found"
```bash
npm install
```

### App shows blank screen
- Check browser console (F12) for errors
- Make sure backend is responding: `curl http://localhost:8000/health`

### Build fails on Expo
```bash
# Clear cache
npx expo start -c

# Update packages
npx expo install --fix
```

### "Cannot find module '@react-navigation/*'"
```bash
npm install
```

---

## File Checklist

Before deploying, ensure these files are configured:

| File | What to Check |
|------|---------------|
| `src/api/config.ts` | Backend URL updated |
| `app.json` | App name = "Hermetical", package name set |
| `eas.json` | Build profiles configured |
| `.gitignore` | `node_modules/` and `.env` excluded |

---

## Quick Commands Reference

| Command | What It Does |
|---------|--------------|
| `npm install` | Install dependencies |
| `npm start` | Start Expo dev server |
| `npm run web` | Run in browser |
| `npm run android` | Run on Android emulator |
| `npm run ios` | Run on iOS simulator |
| `eas build -p android` | Build Android APK in cloud |
| `npx expo install --fix` | Fix package version mismatches |

---

## Cost Summary

| Service | Free Tier | Paid When |
|---------|-----------|-----------|
| Expo | Unlimited dev builds | Need faster cloud builds |
| EAS Build | 30 min/month | Need more build time |
| Railway | $5 credit | After credit expires |
| Render | Free forever | Need more resources |

**Total for hackathon: ₹0**
