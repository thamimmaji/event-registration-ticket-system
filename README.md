# Event Registration and Ticket System — MERN

React + Vite frontend, Express + Node.js backend, MongoDB Atlas database.

## Features
- Attendee registration and login with JWT
- Admin signup with a private admin code
- Event browsing and searching
- Admin event creation, editing, and deletion
- Limited-capacity event registrations
- Unique QR code tickets and print view
- Attendee ticket list and admin check-in

## Run
1. Install Node.js 20+ and set up MongoDB Atlas.
2. In `backend`, run `npm install`.
3. Copy `backend/.env.example` to `backend/.env` and fill `MONGO_URI`, `JWT_SECRET`, and `ADMIN_CODE`.
4. Run `npm run dev` in `backend`. Test `http://localhost:5000/api/health`.
5. In another terminal, open `frontend` and run `npm install`.
6. Copy `frontend/.env.example` to `frontend/.env` (default localhost API URL is fine).
7. Run `npm run dev` in `frontend` and visit `http://localhost:5173`.

## Demo
Register as admin with your `ADMIN_CODE`, create an event, then sign up as attendee and reserve a ticket. The ticket shows a QR and unique code. Log in as admin and check in the ticket by code.

**Note:** Tickets are free; no payment gateway is integrated. This is a college demo project, not a production-grade ticketing platform. Do not publish `.env` secrets. Set `CLIENT_ORIGIN` and `VITE_API_URL` to your deployment domains when deploying.
