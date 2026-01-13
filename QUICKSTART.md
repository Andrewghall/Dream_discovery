# Quick Start - Get Running in 5 Minutes

The dev server is running at **http://localhost:3000**, but you need to configure the database and API key first.

## Option 1: Quick Start with Supabase (Recommended)

### 1. Create Free Supabase Database

1. Go to https://supabase.com
2. Sign up for free account
3. Create new project
4. Go to **Settings → Database**
5. Copy the **Connection String** (URI format)
6. Enable **pgvector** extension:
   - Go to **Database → Extensions**
   - Search for "vector"
   - Enable it

### 2. Configure Environment

Edit `.env.local`:
```env
DATABASE_URL="your-supabase-connection-string-here"
OPENAI_API_KEY="sk-your-openai-key-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set Up Database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Open App

Go to http://localhost:3000/admin

---

## Option 2: Local PostgreSQL

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create Database

```bash
createdb dream_discovery
psql dream_discovery -c "CREATE EXTENSION vector;"
```

### 3. Configure Environment

Edit `.env.local`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dream_discovery"
OPENAI_API_KEY="sk-your-openai-key-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Set Up Database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 5. Open App

Go to http://localhost:3000/admin

---

## What You'll See

### Admin Dashboard
- Demo workshop: "Q1 2026 Strategic Planning Workshop"
- 3 sample participants (Sarah, Michael, Emily)
- Stats and completion tracking

### Test the AI Conversation

1. Click on the demo workshop
2. Find a participant (e.g., Sarah Johnson)
3. Click the **copy icon** next to their name
4. Open the copied link in a new tab
5. Start the AI conversation!

The AI will:
- Welcome you and ask for attribution preference
- Guide you through 6 conversation phases
- Probe for specific examples and details
- Extract insights automatically
- Not advance until you provide enough depth

---

## Troubleshooting

### "Can't reach database server"
- Make sure PostgreSQL is running OR
- Use Supabase/Neon cloud database instead

### "Prisma Client not found"
```bash
npm run db:generate
```

### "OpenAI API Error"
- Check your API key in `.env.local`
- Verify you have credits at https://platform.openai.com

### Port 3000 already in use
```bash
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

## Next Steps

1. **Create Your Own Workshop**
   - Click "New Workshop" in admin dashboard
   - Choose workshop type
   - Add business context
   - Add participants

2. **Test Discovery Conversations**
   - Copy participant links
   - Open in incognito/private window
   - Complete the AI conversation
   - See insights extracted in real-time

3. **Monitor Progress**
   - View completion rates
   - Read conversation transcripts
   - Review extracted insights

4. **Send Real Invitations** (coming soon)
   - Configure Resend API key
   - Send email invitations
   - Track responses

---

## What's Working Now

✅ Admin dashboard
✅ Workshop creation
✅ Participant management
✅ AI-driven conversations with GPT-4
✅ Depth-checking logic
✅ Insight extraction
✅ Real-time progress tracking
✅ Mobile-responsive UI

## What's Coming Next

⏳ Email invitations (Resend integration)
⏳ Pre-meeting visualization dashboard
⏳ Theme aggregation across participants
⏳ Conversation transcript viewer
⏳ Export functionality
⏳ Zoom meeting integration

---

## Support

- Check `SETUP.md` for detailed setup
- Review `README.md` for architecture
- See spec docs in parent directory for full details
