# CuraPulse Frontend

React/Vite frontend for the FastAPI clinic backend. The app uses role-specific sign-in and only shows routes allowed for the authenticated role.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Vite is pinned to `http://localhost:5173`, which is the origin allowed by the backend CORS configuration. The API defaults to `http://localhost:8000`; set `VITE_API_BASE_URL` in a local `.env` file to override it.

Patient OTP login uses `/auth/otp/request` and `/auth/otp/verify`. The current backend needs `ENABLE_DEV_OTP=true` to print development codes in its terminal; real SMS delivery is not configured there yet. Staff sign in with phone and password.

## Connected workflows

- Patients: doctor and slot lookup, booking, appointment history, cancellation, and development-only mock token payment.
- Doctors: daily appointments, starting/completing consultations, no-show status, weekly schedule updates, and slot generation.
- Receptionists: daily dashboard and appointments, patient search, check-in, no-show, balance collection, and credit refunds.

Automated queue dispatch, WhatsApp/SMS notifications, clinical note editing, prescription management, walk-in creation, and a live payment gateway do not have backend endpoints yet. The original HTML designs remain in `src/prototypes/legacy/assets` as reference only.

Run `npm run build` to create the production build.
