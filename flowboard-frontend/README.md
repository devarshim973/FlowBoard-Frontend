# FlowBoard Frontend

React + Vite frontend for the FlowBoard microservices backend.

## Features

- Animated landing page
- Login and signup flow
- Workspace dashboard
- Board view with lists and cards
- Notifications panel
- API-first structure for your Spring services

## Environment

Create `.env` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Point this to the API gateway if you route all services through Eureka + gateway.

## Run

```bash
npm install
npm run dev
```

Then open:

`http://localhost:5173`
