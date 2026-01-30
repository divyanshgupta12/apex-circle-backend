# Google OAuth Setup Guide

## Overview
The client portal now supports real Google Sign-In authentication using Google Identity Services (GIS). Follow these steps to configure it.

## Prerequisites
- A Google Cloud Platform (GCP) account
- Access to Google Cloud Console

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown and select "New Project"
3. Enter a project name (e.g., "Apex Circle Events")
4. Click "Create"

### 2. Enable Google+ API

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Google+ API" or "Google Identity Services"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External (for production, use Internal if you have Google Workspace)
   - App name: "The Apex Circle"
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue"
   - Scopes: Click "Save and Continue" (default scopes are fine)
   - Test users: Add test email addresses if needed, then "Save and Continue"
   - Summary: Review and "Back to Dashboard"

4. Create OAuth Client ID:
   - Application type: "Web application"
   - Name: "Apex Circle Client Portal"
   - Authorized JavaScript origins:
     - `http://localhost` (for local testing)
     - `http://localhost:8000` (if using a local server)
     - `https://yourdomain.com` (your production domain)
   - Authorized redirect URIs:
     - `http://localhost/dashboard/user/login.html` (local)
     - `https://yourdomain.com/dashboard/user/login.html` (production)
   - Click "Create"
   - Copy the **Client ID** (it will look like: `123456789-abc123def456.apps.googleusercontent.com`)

### 4. Update the Code

1. Open `dashboard/user/login.html`
2. Find this line:
   ```javascript
   const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
   ```
3. Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
4. Save the file

### 5. Test the Integration

1. Open the client login page in your browser
2. You should see the Google Sign-In button
3. Click it to test the authentication flow
4. After successful login, you'll be redirected to the plans page

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit your Client ID to public repositories** - Use environment variables or configuration files that are git-ignored
2. **Client Secret** - The Client Secret should NEVER be exposed in client-side code. It should only be used on the server side if needed.
3. **HTTPS Required** - For production, always use HTTPS. Google OAuth may not work properly on HTTP in production.
4. **Token Validation** - In a production environment, you should validate the ID token on your backend server before trusting the user's identity.

## Troubleshooting

### Button doesn't appear
- Check browser console for errors
- Verify the Google Identity Services script is loading
- Ensure your Client ID is correctly formatted

### "Error 400: redirect_uri_mismatch"
- Verify the redirect URI in Google Cloud Console matches your current URL exactly
- Include the protocol (http/https) and full path

### "Error 403: access_denied"
- Check OAuth consent screen configuration
- Ensure test users are added if app is in testing mode
- Verify the app is published or in testing mode with your account as a test user

### Token verification fails
- Ensure Google+ API is enabled
- Check that the token hasn't expired
- Verify the Client ID matches between the code and Google Console

## Production Deployment

For production deployment:

1. Update authorized JavaScript origins and redirect URIs to your production domain
2. Submit your OAuth consent screen for verification (if using External user type)
3. Ensure your site uses HTTPS
4. Implement backend token verification for enhanced security
5. Set up proper error handling and logging

## Additional Resources

- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 for Client-Side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google Cloud Console](https://console.cloud.google.com/)

## Support

If you encounter issues, check:
1. Browser console for error messages
2. Network tab to see if requests are being made
3. Google Cloud Console for API quota and status
4. OAuth consent screen status


