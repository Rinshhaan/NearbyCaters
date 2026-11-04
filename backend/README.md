# NearMe Catering — Backend

## Setup

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Environment Variables
Copy `.env.example` to `.env` and fill in values.

## API Base URL
`https://nearbycaters.onrender.com/api/v1`

## Role-Based Access
- `admin` — hardcoded single admin account
- `client` — event owners (must be approved by admin)
- `user` — boys who book events

## Auth Flow
- All roles use JWT tokens (access token in Authorization header)
- Users log in with phone + 4-digit PIN
- Clients & Admin log in with email + password
