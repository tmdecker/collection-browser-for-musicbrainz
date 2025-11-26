# OAuth2 Setup Guide

This guide explains how to set up MusicBrainz OAuth2 authentication for collection-browser-for-musicbrainz.

## What is OAuth Setup?

**This is a one-time configuration by the app host (you)** that enables user authentication functionality. Once configured:

- **All users** can click "Login with MusicBrainz" to authenticate with their own MusicBrainz accounts
- **Logged-in users** can browse their own collections (public or private)
- **Without OAuth configured**, the app still works - users can browse any public collection by entering its ID directly

**Important:** You (the app host) register the application once. End users login with their own MusicBrainz credentials through the standard OAuth flow.

## Prerequisites

- A MusicBrainz account (for app registration)
- Local development server running on port 3000

## Step 1: Register Your Application with MusicBrainz

1. **Log in to MusicBrainz**: Go to [https://musicbrainz.org](https://musicbrainz.org) and log in to your account.

2. **Navigate to Applications**: Visit [https://musicbrainz.org/account/applications](https://musicbrainz.org/account/applications)

3. **Register New Application**:
   - Click "Register new application"
   - Fill in the application details:
     - **Application Name**: `collection-browser-for-musicbrainz` (or your preferred name)
     - **Application Type**: Select **"Web application"** (Confidential client)
     - **Homepage URL**: `http://localhost:3000`
     - **Redirect URIs**: `http://localhost:3000/api/auth/callback`
   - Submit the form

4. **Save Your Credentials**:
   - After registration, you'll receive a **Client ID** and **Client Secret**
   - **IMPORTANT**: Copy both credentials immediately - the secret may only be shown once
   - Keep the Client Secret secure - treat it like a password

## Step 2: Configure Environment Variables

1. **Open `.env.local` file** in the project root

2. **Update the OAuth configuration**:
   ```env
   # OAuth2 Configuration
   MUSICBRAINZ_OAUTH_CLIENT_ID=your_actual_client_id_here
   MUSICBRAINZ_OAUTH_CLIENT_SECRET=your_actual_client_secret_here
   MUSICBRAINZ_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```

3. **Replace** the placeholder values:
   - `your_actual_client_id_here` with your Client ID
   - `your_actual_client_secret_here` with your Client Secret

## Step 3: Restart Development Server

The OAuth routes require environment variables to be loaded. Restart your dev server:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart
npm run dev
```

## Step 4: Test Authentication

1. **Navigate to Settings**: Open [http://localhost:3000/config](http://localhost:3000/config)

2. **Click "Login with MusicBrainz"**:
   - You'll be redirected to MusicBrainz authorization page
   - Review the permissions requested (profile, collection access)
   - Click "Allow" to grant access

3. **Authorization Complete**:
   - You'll be redirected back to the config page
   - Your username will be displayed
   - Your collections will be available in a dropdown

4. **Select a Collection**:
   - Choose a release-group collection from the dropdown
   - The collection ID will be auto-populated
   - Click "Save Configuration"

## How It Works

### OAuth2 with PKCE Flow

1. **Login Initiation** (`/api/auth/login`):
   - Generates PKCE code verifier and challenge
   - Stores verifier in httpOnly cookie
   - Redirects to MusicBrainz authorization page

2. **User Authorization**:
   - User logs in to MusicBrainz (if not already)
   - Reviews requested permissions
   - Grants or denies access

3. **Callback** (`/api/auth/callback`):
   - Verifies state parameter (CSRF protection)
   - Exchanges authorization code for tokens
   - Stores refresh token in httpOnly cookie (7 days)
   - Stores access token in cookie (short-lived)

4. **Authenticated Requests**:
   - Access token automatically included in API requests
   - Token refreshed automatically when expired
   - Collections fetched with user authorization

### Security Features

- **Client Secret** (Confidential clients): Authenticates the application with MusicBrainz
- **PKCE** (Proof Key for Code Exchange): Protects against authorization code interception
- **Defense-in-Depth**: Both client_secret and PKCE used together for maximum security
- **State Parameter**: CSRF protection during OAuth flow
- **httpOnly Cookies**: Refresh tokens not accessible to JavaScript
- **Automatic Token Refresh**: Access tokens refreshed before expiry
- **Token Revocation**: Logout revokes tokens with MusicBrainz

## Production Deployment

For production deployment:

1. **Register Production Application**:
   - Use your production domain (e.g., `https://yourdomain.com`)
   - Update redirect URI to `https://yourdomain.com/api/auth/callback`

2. **Update Environment Variables**:
   ```env
   MUSICBRAINZ_OAUTH_CLIENT_ID=your_production_client_id
   MUSICBRAINZ_OAUTH_CLIENT_SECRET=your_production_client_secret
   MUSICBRAINZ_OAUTH_REDIRECT_URI=https://yourdomain.com/api/auth/callback
   ```

3. **Enable HTTPS**:
   - Cookies are marked as `secure` in production
   - HTTPS is required for OAuth2 security

## Troubleshooting

### "Client not authentified" Error

This error occurs when using a **Web application** (Confidential client) without providing the client secret.

**Solution:**
- Verify `MUSICBRAINZ_OAUTH_CLIENT_SECRET` is set in `.env.local`
- Ensure the client secret matches the one from MusicBrainz registration
- Restart the development server after adding the secret
- Both `client_secret` and PKCE `code_verifier` are sent together for maximum security

### "OAuth not configured" Error

- Verify `MUSICBRAINZ_OAUTH_CLIENT_ID`, `MUSICBRAINZ_OAUTH_CLIENT_SECRET`, and `MUSICBRAINZ_OAUTH_REDIRECT_URI` are set in `.env.local`
- Restart the development server after changing environment variables

### "Invalid redirect URI" Error

- Ensure the redirect URI in `.env.local` matches exactly what you registered with MusicBrainz
- Common mistake: forgetting `/api/auth/callback` path
- Check for trailing slashes (should NOT have one)

### "State mismatch" Error

- Browser cookies may be blocked
- Try clearing cookies for `localhost:3000`
- Ensure third-party cookies are allowed (for development)

### "No collections found"

- Ensure you have release-group collections (not release or artist collections)
- Collections must be public or owned by your account
- Try creating a test collection on MusicBrainz

### Token Refresh Issues

- Refresh tokens expire after 7 days of inactivity
- Log out and log in again to get a new refresh token
- Check browser console for error messages

## Without OAuth Configuration

OAuth authentication is **optional for app deployment**. Without OAuth configured:

**What still works:**

- Browse any public MusicBrainz collection by entering its ID or URL
- All filtering, sorting, and display features
- Streaming links and album details

**What requires OAuth:**

- User login functionality
- Browsing a user's own collections
- Collection dropdown/selector
- Access to private collections

## Privacy & Data

### What We Store

- **Access Token**: Short-lived (typically 1 hour), stored in cookie
- **Refresh Token**: Long-lived (7 days), stored in httpOnly cookie
- **User Profile**: Username and user ID, stored in localStorage

### What We Don't Store

- Passwords (never transmitted to our server)
- Email address (unless explicitly needed for future features)
- Collection contents (fetched on-demand, cached in IndexedDB)

### Data Handling

- Tokens stored in secure httpOnly cookies
- Profile data stored in localStorage (user preferences)
- All API requests proxied through our server (rate limiting, CORS)
- No data sent to third parties

## Support

For issues related to:
- **OAuth setup**: Check this guide or open a GitHub issue
- **MusicBrainz API**: Visit [MusicBrainz Development](https://musicbrainz.org/doc/Development)
- **Account issues**: Contact MusicBrainz support
