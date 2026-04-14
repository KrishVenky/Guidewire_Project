# Hermetical Mobile App

React Native + Expo mobile app for Hermetical income insurance platform.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (from Play Store / App Store)

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android (with Expo Go app)
npm run android

# Run on iOS (with Expo Go app)  
npm run ios

# Run on web browser
npm run web
```

### Connect to Backend

1. Update `src/api/config.ts`:
   - For local testing: Replace IP with your computer's IP address
   - For deployed testing: Set to your Railway/Render backend URL

```typescript
const API_BASE_URL = 'http://YOUR_IP:8000';  // Local
// OR
const API_BASE_URL = 'https://your-app.railway.app';  // Deployed
```

## Building for Submission

### Preview Build (for judges)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo (free account)
eas login

# Build Android APK (runs in cloud, takes ~10 min)
eas build --profile preview --platform android

# After build completes, download APK and share with judges
```

### Judges Can Test Via

1. **Expo Go (Recommended)**: Share QR code from `expo start`
2. **Direct APK**: Share the built APK file

## App Features

### Worker Flow
1. **Register** - Enter details, select zone (Whitefield, Koramangala, etc.)
2. **Login** - OTP-based authentication
3. **Dashboard** - View policy, claims, active disruptions
4. **Activate Coverage** - One-tap policy activation

### Admin Flow
1. **Login** - PIN-based (default: `admin123`)
2. **Dashboard** - View metrics, loss ratio, disruptions
3. **Claims Review** - Approve/reject flagged claims with fraud scores

## Screens

| Screen | Description |
|--------|-------------|
| Home | Role selection (Worker/Admin) |
| WorkerRegister | Registration with zone selection |
| WorkerLogin | OTP login flow |
| AdminLogin | PIN-based admin login |
| WorkerDashboard | Policy, claims, disruptions view |
| AdminDashboard | Metrics, pending claims, quick actions |

## Tech Stack

- **Framework**: React Native 0.81 + Expo SDK 54
- **Navigation**: React Navigation 7 (Stack)
- **State**: Zustand
- **API**: Axios with interceptors
- **Storage**: Expo SecureStore (encrypted)
- **Location**: Expo Location (for GPS validation - Phase 3)

## Project Structure

```
mobile/
├── App.tsx                 # Main app + navigation
├── app.json               # Expo config
├── eas.json               # Build config
├── src/
│   ├── api/
│   │   ├── config.ts      # Axios setup + base URL
│   │   └── index.ts       # API functions
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── WorkerRegisterScreen.tsx
│   │   ├── WorkerLoginScreen.tsx
│   │   ├── AdminLoginScreen.tsx
│   │   ├── WorkerDashboardScreen.tsx
│   │   └── AdminDashboardScreen.tsx
│   └── store/
│       └── index.ts       # Zustand stores
└── assets/                # App icons, splash
```

## Deployment Checklist

- [ ] Update `src/api/config.ts` with deployed backend URL
- [ ] Run `eas build --profile preview --platform android`
- [ ] Download APK from Expo build page
- [ ] Test with judge's Expo Go app via QR code
- [ ] Record 2-min demo video as backup

## Troubleshooting

**"Network request failed"**
- Ensure backend is running
- Check IP address in `config.ts` (not `localhost` on Android)
- For Android emulator: use `10.0.2.2` instead of localhost

**"Module not found"**
- Run `npm install` again
- Clear cache: `expo start -c`

**Build fails**
- Check `app.json` has valid `projectId`
- Ensure Expo account is logged in
