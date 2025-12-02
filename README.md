# crypto-portfolio

Crypto portfolio tracker with live data, basic auth, and experimental quant tools.

> This is a learning / experimentation project. Do **not** use it for real-money decisions.

## Features

- Local-only portfolio tracking in the main dashboard (`index.html`).
- Live market data from public crypto APIs.
- Crypto news feed (RSS → JSON).
- Synthetic performance tools (volatility, drawdown, etc.).
- Node/Express backend for:
  - Authentication (JWT)
  - Portfolio “posts” API
  - External data endpoints (tickers + news)

## Project structure

```text
.
├── index.html          # Main dashboard entry point
├── src/                # Dashboard UI (modern React)
├── server/             # Node/Express + Mongo + JWT auth
├── client/             # Legacy MERN-style React client (optional)
├── scripts/            # Helper scripts
└── test/               # Node.js tests
Getting started
1. Backend API
Bash

cd server
npm install

# Copy example env and fill in real values
cp .env.example .env
Edit .env:

env

PORT=5000
CONNECTION_URL=your-mongodb-connection-string
JWT_SECRET=some-long-random-string
FRONTEND_URL=http://localhost:3000   # Or wherever you serve index.html from
Then run:

Bash

npm start
API will be available on http://localhost:5000.

2. Dashboard (index.html)
You can:

Open index.html directly in your browser, or
Serve it via a local static server so CORS origin matches FRONTEND_URL:
Bash

# from repo root
npx serve . -l 3000
Then visit http://localhost:3000 and ensure FRONTEND_URL in server/.env is the same.

3. Optional: legacy MERN client
Bash

cd client
npm install
npm start
The client/ app uses /user and /posts endpoints heavily; it’s kept as a reference version.

API overview
Auth:

POST /user/signup – create a new user.
POST /user/signin – login and receive a JWT.
Posts (portfolio entries):

GET /posts – list only the authenticated user’s posts (JWT required).
POST /posts – create a new post (JWT required).
PATCH /posts/:id – update an existing post (only creator can update).
DELETE /posts/:id – delete a post (only creator can delete).
PATCH /posts/:id/likePost – like/unlike a post (JWT required).
External data:

GET /external/tickers – market data (server-side cached).
GET /external/news – crypto news feed.
All protected routes expect:

http

Authorization: Bearer <token>
Security notes
JWTs are stored in localStorage for simplicity; for public deployment, harden all XSS surfaces or move to HTTP-only cookies.
Rate limiting is enabled globally and specifically for auth routes.
price and amount use BigNumber on the backend and are stored as Decimal128 in Mongo.
Tests
From the repo root:

Bash

npm test
Runs Node.js tests on the validation schemas (auth + posts).

