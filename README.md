# Hyperlocal SkillSwap

A Next.js app for swapping skills locally with chat, reviews, and transactions.

## Realtime chat (SSE)

The app uses Server-Sent Events (SSE) for near-realtime chat updates.

- Auth: An HttpOnly cookie (`sseso`) is set on login/register to authenticate the SSE stream without headers. The middleware accepts this cookie.
- Endpoint: `GET /api/events/stream` streams events.
- Events:
  - `conversation-start`: when a conversation is created or resumed
  - `message`: when a new message is sent (includes message payload)
- Keepalive: a ping comment is sent every 25s to avoid idle timeouts.

Unread counts

- `GET /api/chat/unread` returns `{ total, perConversation }` for precise badges.

Limits & deployment notes

- The SSE broker is in-memory and scoped to a single Node.js process. On serverless or multi-instance hosting, events won’t fan out across instances by default.
- For production-grade realtime, use a shared pub/sub (Redis, Pusher, Ably) or fall back to polling.

## Local development

1. Install dependencies and run the dev server.
2. Configure environment variables: `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `NEXT_PUBLIC_MAPBOX_TOKEN` (or use MapLibre).
3. Login/register to start the `sseso` cookie and open `/chat`.

## Deploying to Vercel

1. **Fork or push** this repository to your own GitHub/GitLab account so Vercel can access it.
2. In the [Vercel dashboard](https://vercel.com/dashboard), click **New Project** and import the repo.
3. On the configuration screen:
   - Framework preset: **Next.js** (auto-detected).
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: leave blank (Vercel handles `.next`).
4. Add the required environment variables under **Settings → Environment Variables** for each environment (Preview/Production):

   | Key | Description |
   | --- | --- |
   | `JWT_SECRET` | Secret used to sign auth tokens. |
   | `MONGODB_URI` | Connection string to your MongoDB cluster. |
   | `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name. |
   | `CLOUDINARY_API_KEY` | Cloudinary API key. |
   | `CLOUDINARY_API_SECRET` | Cloudinary API secret. |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | Public token for Mapbox (or drop-in MapLibre if preferred). |

   (Optional) `NEXT_PUBLIC_APP_NAME` and any other values from `.env.example` can also be supplied.

5. Deploy the project. Vercel will build the app using `npm run build` and host it on their global edge network.
6. After the first deployment succeeds:
   - Visit the live URL to verify the landing page, login/register screens, and dashboard load correctly.
   - Because chat uses Server-Sent Events, keep the deployment on a single Node.js instance or move the SSE broker (`lib/sse`) to a shared service such as Redis/Pusher before enabling multiple regions.

### Runtime notes

- A `vercel.json` file pins the `/api/events/stream` function to the Node.js runtime with an increased timeout so SSE connections stay open.
- If you experience frequent disconnects, consider switching `/api/events/stream` to a managed realtime provider or polling fallback as mentioned in the SSE section above.

