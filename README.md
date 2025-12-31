# Lifelogs

A personal event tracking app for logging arbitrary life events with custom data fields.

## Features

- **Flexible event logging** - Log any event type with arbitrary key-value data
- **Quick entry** - Recent event types shown as one-click buttons to pre-fill forms
- **Visualizations** - Chart numeric data over time with Chart.js
- **Import/Export** - Import events via CSV or JSON
- **PWA** - Installable on mobile devices
- **Edge-deployed** - API runs on Cloudflare Workers with D1 database

## Screenshots

*Coming soon*

## Getting Started

### Prerequisites

- Node.js 18+
- Cloudflare account (for deployment)

### Local Development

1. Install dependencies:
```bash
cd api && npm install
cd ../web && npm install
```

2. Run database migrations:
```bash
cd api && npm run db:migrate
```

3. Start the API server:
```bash
cd api && npm run dev
```

4. In a new terminal, start the web app:
```bash
cd web && npm run dev
```

5. Open http://localhost:5173

### Deployment

See [CLAUDE.md](./CLAUDE.md) for deployment instructions.

## Tech Stack

| Component | Technology |
|-----------|------------|
| API | Cloudflare Workers + Hono |
| Database | Cloudflare D1 (SQLite) |
| Frontend | SvelteKit (static) |
| Auth | Custom sessions + PBKDF2 |
| Charts | Chart.js |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Get current user |
| GET | /api/events | List events (with filters) |
| POST | /api/events | Create event |
| PATCH | /api/events/:id | Update event |
| DELETE | /api/events/:id | Delete event |
| POST | /api/import/json | Import JSON events |
| POST | /api/import/csv | Import CSV events |

## License

MIT
