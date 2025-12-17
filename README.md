# Hyperlocal SkillSwap

Hyperlocal SkillSwap is a Next.js web app for discovering nearby people, swapping skills, chatting, and completing credit-based transactions with reviews.

## User manual (how to use the web app)

### 1) Create an account

1. Open the app.
2. Go to **Register**.
3. Create your account and sign in.

### 2) Complete your profile

From **Dashboard → Profile** you can:

- Add your photo/avatar.
- Add a short bio (what you do, what you’re looking for).
- Set your location (used for distance + map-based discovery).

Tip: a complete profile gets better matches.

### 3) Add your skills

From **Dashboard → Skills**:

- Add skills you can offer.
- Add skills you need.

These are used to power matching and discovery.

### 4) Find people to swap skills with

Go to **Search**:

- Browse **Matches**.
- Open any profile to view details.
- (If available) Use the map to see neighbors and skill pins.

### 5) Favorite/bookmark people

In **Matches**, use the heart button to favorite someone. This helps you keep track of people you may want to contact later.

### 6) Start a chat

From a match card or a profile:

1. Click **Chat**.
2. Send messages in real time.

Chat behavior notes:

- The app uses realtime updates for incoming messages.
- Read/unread status updates as you view conversations.

### 7) Hire / create a transaction

When you want to request work (or confirm a swap):

1. Choose a user.
2. Click **Hire** (or create a transaction from the relevant flow).
3. Confirm details and proceed.

### 8) Credits / top-up (optional)

If your deployment enables payments, you can top up credits using Stripe.

- In development/test mode, Stripe runs with test keys.
- In production, configure Stripe keys and webhook for confirmations.

### 9) Confirm completion + leave reviews

After a transaction is completed:

- Confirm completion (where prompted).
- Leave a review and rating.

Reviews contribute to the rating shown on match cards.

## Local development (run on your machine)

### Prerequisites

- Node.js 18+
- A MongoDB connection string
- Cloudinary account (for uploads) — optional but recommended
- Mapbox token (for maps) — optional
- Stripe (for top-up/payments) — optional

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env.local`

Add these variables:

Required:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret

Recommended (uploads):

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional (maps):

- `NEXT_PUBLIC_MAPBOX_TOKEN` (client)
- `MAPBOX_TOKEN` (server, if you prefer using a non-public token)

Optional (payments / Stripe):

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY` (defaults to `usd`)

Optional (password reset emails):

- `SENDGRID_API_KEY`
- `SENDGRID_FROM`
- `NEXT_PUBLIC_BASE_URL` (used to build reset links)

Optional (credits tuning):

- `CREDIT_RATE_BDT` (defaults to `50`)

Optional (blockchain integration toggle):

- `ENABLE_CHAIN` (`true`/`false`)
- `CHAIN_RPC_URL`
- `CHAIN_PRIVATE_KEY`
- `CHAIN_NAME`

### 3) Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Realtime chat (SSE)

The app uses Server-Sent Events (SSE) for near-realtime chat updates.

- Auth: an HttpOnly cookie (`sseso`) is set on login/register so the SSE stream can authenticate without headers.
- Endpoint: `GET /api/events/stream`
- Keepalive: a ping comment is sent periodically to avoid idle timeouts.

Unread counts

- `GET /api/chat/unread` returns `{ total, perConversation }`.

Limits & deployment notes

- The SSE broker is in-memory and scoped to a single Node.js process. On serverless or multi-instance hosting, events won’t fan out across instances by default.
- For production-grade realtime, use a shared pub/sub (Redis, Pusher, Ably) or fall back to polling.

## Deploying to Vercel

1. Import the repo into Vercel.
2. Use:
   - Install: `npm ci`
   - Build: `npm run build`
   - Output directory: leave blank
3. Add environment variables (same as `.env.local`) in **Settings → Environment Variables**.

Runtime notes

- A `vercel.json` file pins `/api/events/stream` to the Node.js runtime with an increased timeout so SSE connections stay open.
- If you see frequent SSE disconnects, switch to a managed realtime provider or a polling fallback.

