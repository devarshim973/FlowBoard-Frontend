# <div align="center">FlowBoard Frontend</div>

<div align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=24&duration=2800&pause=900&color=22C55E&center=true&vCenter=true&width=900&lines=Modern+task+orchestration+UI;React+%2B+Vite+frontend+for+FlowBoard;Boards%2C+workspaces%2C+cards%2C+comments+and+notifications" alt="FlowBoard typing banner" />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-0f172a?style=for-the-badge&logo=react&logoColor=61dafb" alt="React badge" />
  <img src="https://img.shields.io/badge/Vite-5.4.19-0f172a?style=for-the-badge&logo=vite&logoColor=ffd62e" alt="Vite badge" />
  <img src="https://img.shields.io/badge/Router-6.30.1-0f172a?style=for-the-badge&logo=reactrouter&logoColor=CA4245" alt="React Router badge" />
  <img src="https://img.shields.io/badge/Status-Frontend%20Ready-14532d?style=for-the-badge" alt="Status badge" />
</div>

<p align="center">
  FlowBoard is a Trello-inspired frontend built for workspace-based planning, board collaboration, card movement,
  comments, notifications, authentication, and admin operations. It is designed to sit on top of a microservices backend
  while still feeling like one smooth product.
</p>

---

## Overview

This frontend is built with `React`, `Vite`, and `React Router`. It provides a responsive product surface for users to:

- sign up, log in, and recover accounts
- manage personal workspaces
- create and browse boards
- organize lists and cards
- move work items across workflow stages
- add comments and track notifications
- access admin-only management screens

The UI also includes a polished landing experience and protected routes for authenticated users.

---

## Highlight Features

```text
[ Landing ] -> [ Auth ] -> [ Dashboard ] -> [ Board ] -> [ Cards + Comments + Notifications ]
                     \
                      -> [ Admin Login ] -> [ Admin Panel ]
```

- Clean landing page with a product-style intro and feature scroll navigation
- Authentication flow with signup, login, OTP actions, and password reset hooks
- Protected dashboard and board routes
- Workspace and board CRUD integration
- List and card management with move/status update support
- Notification panel with unread count and read actions
- Admin area for users, workspaces, and boards
- API-first structure ready for backend service integration

---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 18 |
| Build Tool | Vite 5 |
| Routing | React Router DOM 6 |
| State | Context-based auth state |
| Styling | Custom CSS |
| API Layer | `fetch` wrapper with shared helpers |

---

## Project Structure

```bash
flowboard-frontend/
|-- public/
|-- src/
|   |-- components/
|   |-- pages/
|   |-- services/
|   |-- state/
|   |-- styles/
|   |-- App.jsx
|   `-- main.jsx
|-- .env
|-- index.html
|-- package.json
`-- vite.config.js
```

### Core Pages

- `LandingPage` for the public product intro
- `AuthPage` for login, signup, and admin login mode
- `DashboardPage` for workspace access
- `BoardPage` for board, list, and card workflows
- `AdminPage` for admin controls
- `OAuthSuccessPage` for auth callback handling

---

## API Coverage

The frontend is already structured around service modules for:

- `authApi`
- `paymentApi`
- `userApi`
- `adminApi`
- `workspaceApi`
- `boardApi`
- `listApi`
- `cardApi`
- `commentApi`
- `notificationApi`

Requests are built from `VITE_API_BASE_URL`, and auth-aware calls attach:

- `Authorization: Bearer <token>`
- `X-User-Id`
- `X-User-Role`

---

## Environment Setup

Create a `.env` file inside the frontend app folder:

```env
VITE_API_BASE_URL=http://localhost:8080
```

If you are using an API gateway, point the variable to the gateway base URL instead of individual services.

---

## Local Development

### Install dependencies

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

Default Vite local URL:

```text
http://localhost:5173
```

---

## Route Map

| Route | Access | Purpose |
| --- | --- | --- |
| `/auth` | Public | Login and signup |
| `/oauth-success` | Public | OAuth callback success screen |
| `/admin/login` | Public | Admin login mode |
| `/app` | Protected | Dashboard |
| `/app/board/:boardId` | Protected | Board workspace |
| `/app/admin` | Admin only | Admin panel |

---

## Why This Frontend Stands Out

- Product-like landing page instead of a plain starter screen
- Clear separation between UI pages, shared components, state, and API services
- Built for real backend integration, not just mock data demos
- Ready for growth into a larger collaboration platform

---

## Suggested Backend Pairing

This frontend fits especially well with services such as:

- authentication service
- user service
- workspace service
- board service
- list/card service
- comment service
- notification service
- payment service
- API gateway

---

## Author 

Devarshi Mishra


<div align="center">
  <sub>Built for FlowBoard frontend delivery and presentation.</sub>
</div>
