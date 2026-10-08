# SchoolSphere ERP

A production-ready, multi-tenant **School Management SaaS platform** for managing multiple schools, their branches, students, parents, teachers, fees, attendance, exams, transport, library, HR, inventory, and more — from a single centralized dashboard.

---

## Overview

SchoolSphere ERP is built as a monorepo with:

- **`apps/web`** — Next.js 15 frontend (App Router, React 19, Tailwind CSS, shadcn/ui)
- **`apps/api`** — Node.js + Express REST API with clean architecture
- **`packages/`** — Shared TypeScript types, validation schemas, and config

The platform supports a **Super Admin** that manages multiple schools, while each school independently manages its own operations through role-based access control and strict tenant isolation.

## Technology Stack

| Layer        | Technology |
| ------------ | ---------- |
| Frontend     | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, TanStack Query, Zustand, Recharts, Framer Motion |
| Backend      | Node.js, Express, TypeScript, Socket.IO, BullMQ |
| Database     | PostgreSQL, Prisma ORM |
| Cache/Queue  | Redis, BullMQ |
| Auth         | JWT (access + refresh rotation), bcrypt, RBAC + Permission-based access |
| Storage      | AWS S3 / S3-compatible (Supabase supported) |
| Email        | Nodemailer (SMTP / Resend) |
| Payments     | Razorpay, Stripe (abstraction layer) |
| Testing      | Jest, Supertest, React Testing Library, Playwright |
| DevOps       | Docker, Docker Compose, GitHub Actions, Nginx |

## Architecture

### Monorepo Structure

```
school-erp/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # Express backend
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── validation/          # Shared Zod schemas
│   ├── config/              # Shared configuration
│   └── eslint-config/       # Shared ESLint config
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/
│   └── seed.ts              # Demo data seed
├── docker/
├── docs/
├── scripts/
├── .github/workflows/
├── docker-compose.yml
└── package.json
```

### Backend Clean Architecture

```
Routes → Controllers → Services → Repositories → Prisma → PostgreSQL
```

Business logic lives in services; route handlers only orchestrate HTTP concerns. Controllers delegate to services, and tenant isolation is enforced at the middleware and service layer — never in route handlers.

### Frontend

- Server Components for static content
- Client Components only where interactivity is required
- Global state via Zustand (auth, UI state)
- Server state via TanStack Query
- Design system components in `components/ui/`

## Multi-Tenancy

SchoolSphere uses **shared-database, per-row isolation**:

- Every tenant-owned table contains a `schoolId` foreign key
- Where applicable, `branchId` for sub-tenant isolation
- `SchoolId` is injected from the **authenticated JWT claims**, never trusted from the request body
- `tenantIsolation` middleware rejects any cross-school request
- Service-layer authorization re-verifies on every query
- Super Admin bypasses tenant scoping but must explicitly pass `schoolId`

## Authentication & RBAC

- JWT access tokens (15 min) + rotating refresh tokens (7 days)
- bcrypt password hashing (10 rounds)
- Predefined roles: SUPER_ADMIN, SCHOOL_ADMIN, BRANCH_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, ACCOUNTANT, HR_MANAGER, LIBRARIAN, TRANSPORT_MANAGER, RECEPTIONIST, STAFF, STUDENT, PARENT
- Granular permissions per role (e.g. `student.view`, `student.create`, `fees.collect`)
- Permissions are checked server-side; the frontend only renders UI based on whatever permissions the API exposes

## API Design

All endpoints under `/api/v1`:

| Module       | Endpoint |
| ------------ | -------- |
| Auth         | `/auth/*` |
| Schools      | `/schools/*` |
| Users        | `/users/*` |
| Students     | `/students/*` |
| Parents      | `/parents/*` |
| Teachers     | `/teachers/*` |
| Attendance   | `/attendance/*` |
| Fees         | `/fees/*` |
| Payments     | `/payments/*` |
| Exams        | `/exams/*` |
| Library      | `/library/*` |
| Transport    | `/transport/*` |
| HR           | `/hr/*` |
| Inventory    | `/inventory/*` |
| Notifications| `/notifications/*` |
| Reports      | `/reports/*` |
| Audit Logs   | `/audit-logs/*` |

Consistent response envelope:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "meta": {}
}
```

Errors:

```json
{
  "success": false,
  "message": "",
  "code": "VALIDATION_ERROR",
  "errors": []
}
```

## Installation

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7
- npm 10+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database, Redis, JWT secrets
```

### 3. Set up the database

```bash
npm run db:generate   # Generate Prisma Client
npm run db:migrate    # Create schema from migrations
npm run db:seed       # Load demo data
```

### 4. Run in development

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1

## Docker

```bash
docker compose up
```

This starts PostgreSQL, Redis, the API, and web frontend.

## Demo Accounts

| Role         | Email                   | Password |
| ------------ | ----------------------- | -------- |
| Super Admin  | `admin@schoolsphere.test` | `Admin@2024` |
| School Admin | `admin@gis001.test`      | `School@2024` |
| Teacher      | `teacher1@gis001.test`   | `School@2024` |
| Parent       | `parent1@gis001.test`    | `School@2024` |

> Demo credentials appear on the login page **only in development**.

## Testing

```bash
npm test            # API unit + integration tests
npm run test:e2e    # Playwright E2E tests
```

Covered: authentication, RBAC, tenant isolation, student CRUD, fee creation, payment webhooks, attendance, exam marks, and report generation.

## Production Deployment

1. Set `NODE_ENV=production` and harden all secrets in `.env`
2. Run `npm run build`
3. Serve the API behind Nginx TLS termination
4. Run the Next.js frontend with `npm run start` (or deploy to Vercel)
5. Configure S3 for object storage, SMTP/Resend for email, Razorpay/Stripe keys for payments
6. Set up GitHub Actions CI/CD (see `.github/workflows/`)

## Storage & Files

- Documents (student/staff/school) are stored in S3-compatible object storage
- Large binaries are never stored in PostgreSQL
- Frontend uploads via signed URLs; metadata is stored in the database
- File type, size, and extension are validated server-side

## Payments Flow

```
Invoice → Payment Initiated → Gateway (Razorpay/Stripe)
  → Webhook → Verify Signature → Update Transaction
  → Update Invoice → Generate Receipt → Notify Parent
```

Payment status is **never trusted from the frontend**; all confirmations happen via verified server-side webhooks.

## Background Jobs

Redis + BullMQ workers handle: email, SMS, WhatsApp, PDF/report generation, bulk imports, fee reminders, attendance notifications, and database backups — without blocking the API.

## Security

- Helmet, CORS, rate limiting, request validation
- JWT rotation and secure cookies
- Password hashing with bcrypt
- Account lockout on repeated failures (configurable)
- Immutable audit logs for every meaningful action
- Secrets only in environment variables — never in code

## Roadmap (Phased)

1. ✅ Project architecture, auth, DB, multi-tenancy, RBAC, Super Admin, School Management
2. Students, Parents, Teachers, Staff, Academic Management
3. Attendance, Timetable, Homework, Assignments
4. Fees, Invoices, Payments, Receipts
5. Exams, Marks, Grades, Report Cards
6. Library, Transport, Inventory, Assets
7. HR, Payroll, Leave
8. Communication, Notifications, Real-time Chat
9. Reports, Exports, PDFs, Audit Logs
10. AI Features, Subscription System, Advanced Analytics
11. Testing, Security, Performance, Docker, CI/CD, Production

## License

Proprietary. For the SchoolSphere ERP platform.