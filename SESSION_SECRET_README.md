# Session Secret Setup

## ⚠️ CRITICAL: Add SESSION_SECRET to your environment

The platform now uses cryptographically signed JWT sessions for security.

### Generate a secure secret (32+ characters):

```bash
# Option 1: Using openssl
openssl rand -base64 32

# Option 2: Using node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Random string
# Use a password generator to create a 32+ character random string
```

### Add to .env file:

```bash
SESSION_SECRET="your-generated-secret-here-minimum-32-characters"
```

### For production (Vercel, Railway, etc.):

Add the `SESSION_SECRET` environment variable to your deployment platform with a **unique, randomly generated secret**.

**IMPORTANT:**
- Never commit SESSION_SECRET to version control
- Use different secrets for development, staging, and production
- Keep this secret secure - it's used to sign all session tokens
- If compromised, regenerate immediately (will log out all users)

### Security Benefits:

- ✅ HMAC-SHA256 signing prevents session tampering
- ✅ Cryptographic verification on every request
- ✅ Expiration enforcement (24 hours)
- ✅ Issuer and audience validation
- ✅ Protection against session hijacking
