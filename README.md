# SchoolSphere ERP — Multi-Tenant School Management SaaS

**SchoolSphere ERP** is a production-oriented, multi-tenant **School Management SaaS platform** that lets an education group run **many schools, each with multiple branches, from one centralized dashboard** — while each school operates independently with strict data isolation, role-based access, and its own academic, financial, and operational workflows.

> **In one line:** Think *“ERPNext / Fedena meets modern SaaS”* — Super Admin onboards schools → each school manages students, parents, teachers, classes, attendance, fees, exams, library, transport, HR/payroll, inventory, reports, and settings, all scoped by `schoolId`.

---

## Table of Contents

1. [Purpose & Vision](#1-purpose--vision)
2. [Who Is It For](#2-who-is-it-for)
3. [What The Platform Does — Feature Map](#3-what-the-platform-does--feature-map)
4. [User Journeys / Core Workflows](#4-user-journeys--core-workflows)
5. [Technology Stack](#5-technology-stack)
6. [Architecture](#6-architecture)
7. [Monorepo Structure](#7-monorepo-structure)
8. [Multi-Tenancy Model](#8-multi-tenancy-model)
9. [Authentication & RBAC](#9-authentication--rbac)
10. [Frontend (`apps/web`)](#10-frontend-appsweb)
11. [Backend (`apps/api`)](#11-backend-appsapi)
12. [Database (`prisma/schema.prisma`)](#12-database-prismaschemaprisma)
13. [API Reference](#13-api-reference)
14. [Shared Packages](#14-shared-packages)
15. [Background Jobs, Notifications & Integrations](#15-background-jobs-notifications--integrations)
16. [Getting Started](#16-getting-started)
17. [Configuration (Environment Variables)](#17-configuration-environment-variables)
18. [Docker & Deployment](#18-docker--deployment)
19. [Demo Accounts & Seed Data](#19-demo-accounts--seed-data)
20. [Testing & Quality](#20-testing--quality)
21. [Security](#21-security)
22. [Current Implementation Status](#22-current-implementation-status)
23. [Roadmap](#23-roadmap)
24. [License](#24-license)

---

## 1. Purpose & Vision

Schools still run on spreadsheets, paper registers, disconnected fee books, and WhatsApp groups. Groups running 5–50 schools have no consolidated view of admissions, fee collection, attendance, staff, or performance.

**SchoolSphere ERP proposes:**

- **One SaaS to run all schools:** Super Admin creates a school in 1 click — this auto-provisions a trial subscription, a `SCHOOL_ADMIN` login, a default academic year (Apr 1 – Mar 31), and default classes `LKG–12 + Sec A`.
- **Complete school lifecycle:** Admission → class/section allocation → daily attendance → timetable/homework → fee invoicing/collection/receipts → exams/marks/report cards → library/transport → HR/payroll/leave → inventory/assets → consolidated reports + audit trail.
- **Tenant-safe by design:** Shared PostgreSQL database, per-row `schoolId` (and `branchId` where needed). `schoolId` is **always derived from the JWT**, never trusted from the client. Super Admin explicitly passes `?schoolId=` to switch context.
- **Role-correct UX:** Same URL (`/students`, `/fees`, `/hr`…), different capabilities per role. A parent sees “my bus”, an accountant sees “collect fee”, a super admin sees a school picker.
- **Operational + financial truth:** Fee ledger (`INV/YYYY-YY/000001` invoice numbering, fines, discounts, partial payments, refunds, PDF receipts), attendance aggregates, exam publishing flow, payroll generation, and 7 cross-module reports power decisions.
- **Bilingual, modern UI:** English + Arabic (RTL with Vazirmatn), dark/light theme, responsive sidebar/topbar/global-search shell built on Next.js 15 + shadcn-style Tailwind.

Long-term vision: subscriptions/billing per school, AI insights (dropout risk, fee-default prediction, timetable optimization), mobile parent app, and live payment gateways / S3 / realtime chat.

---

## 2. Who Is It For

| Persona | What they get |
| ------- | ------------- |
| **Super Admin (Platform Owner)** | Onboard/suspend schools, reset school-admin passwords, platform dashboard (school counts, revenue, growth), switch `schoolId` context anywhere |
| **School Admin / Principal / Vice-Principal** | Full school scope: users, classes, admissions, attendance, fees, exams, staff, reports, school settings (branding, SMTP, roles, payments) |
| **Branch Admin** | Same as school admin but scoped to `branchId` (schema-ready) |
| **Teacher** | Roster + bulk attendance, timetable, homework/assignments, enter/verify marks |
| **Accountant** | Fee structures, bulk invoice generation, manual payment collection, fines, pending reports, invoice PDFs, receipts |
| **HR Manager** | Employees, departments, leave approve/reject, payroll generate/pay |
| **Librarian** | Book catalog, issue/return/overdue + fine |
| **Transport Manager** | Vehicles, drivers, routes/stops, student-bus assignments |
| **Receptionist / Staff** | Front-office CRUD, announcements |
| **Parent / Student** | Personal view (today: `Transport → My Bus`; rest via same pages scoped to their school), fee receipts, exam results when published |

14 system roles are seeded: `SUPER_ADMIN, SCHOOL_ADMIN, BRANCH_ADMIN, PRINCIPAL, VICE_PRINCIPAL, TEACHER, ACCOUNTANT, HR_MANAGER, LIBRARIAN, TRANSPORT_MANAGER, RECEPTIONIST, STAFF, STUDENT, PARENT` + custom roles per school via Settings.

---

## 3. What The Platform Does — Feature Map

### 3.1 School & Branch Management
- CRUD schools (`schoolCode` unique), `ACTIVE/INACTIVE/SUSPENDED` lifecycle, dashboard counts (students/teachers/fees collected).
- Auto-provisioning on create: `TRIAL + STARTER` subscription, admin user, academic year, default classes.
- `Branch(schoolId+code unique)` + `SchoolSetting` JSON sections (branding/general/security/email/whatsapp/notifications/payment).

### 3.2 Academics
- `AcademicYear` (Apr–Mar enforced), `Term`, `Department(schoolId+code)`, `SchoolClass(schoolId+year+code)`, `Section(class+name)`, `Subject(schoolId+code)`, `Timetable(dayOfWeek/start/end + class/subject/teacher)`, `Homework` + `Assignment` per class.
- UI: `/academics` tabs `subjects | classes` + `ClassesManager` (create classes, `setup-defaults`, add/delete sections).

### 3.3 Students, Parents, Teachers
- `Student(schoolId+admissionNumber unique, class/section, status)` — search/paginate (15/page), admit/edit/delete modal, stats dashboard, bulk promote/transfer.
- `Parent` + `StudentParent(student+parent unique)` link/unlink — parent can have many children.
- `Teacher(schoolId+employeeId unique)` + teacher dashboard. Same pattern for `Employee`.

### 3.4 Attendance
- `Attendance(studentId+date unique, PRESENT/ABSENT/LATE/HALF_DAY/LEAVE)`.
- Roster view (`GET /attendance/roster?school/class/section/date`), single + bulk mark, monthly report, stats cards.

### 3.5 Fees & Payments (deepest module, ~1500 lines service)
- Masters: `FeeCategory`, `FeeStructure(MONTHLY/QUARTERLY/HALF_YEARLY/ANNUAL)`, `AcademicYear`.
- Billing: `Invoice(school+invoiceNumber unique, INV/YYYY-YY/000001 via InvoiceSequence, total/paid/discount/fine, feeMonth/feeYear, PENDING/PARTIAL/PAID/OVERDUE/CANCELLED/REFUNDED)` + `InvoiceItem`, bulk generate by month, `monthlyDueDate = 10th next month`, `FineHistory`.
- Collection: manual ledger `collectPayment(CASH/UPI/BANK_TRANSFER/CARD/ONLINE/RAZORPAY/STRIPE/CHEQUE, transactionId dedupe/school)` → updates `paidAmount/status` in transaction + `AuditLog PAYMENT`. `Refund`, `Payment(COMPLETED/PENDING/FAILED/REFUNDED)`.
- Receipts: text receipt (`INV/...`, period, `formatINR`), requires linked parent, logs `ReceiptDelivery + AuditLog`.
- PDFs (local `pdfkit`): single invoice PDF + pending-report PDF (green/slate tables, `Rs.` plain font). No remote logo fetch.
- UI `/fees` (1172 lines): views `overview | years | structures | reports`, dashboard, invoice table + search/status filter, record payment, apply fine, `downloadPdf(blob)`.

### 3.6 Exams & Results
- `Exam(DRAFT/SCHEDULED/IN_PROGRESS/COMPLETED/PUBLISHED)` + `ExamSubject(exam+subject unique)` + `Mark(examSubject+student unique)`.
- Flow: create exam → add subjects → enter marks → verify → publish → parents/students see results. Dashboard + results tab.

### 3.7 Library
- `Book` CRUD + search/category filter, `LibraryIssue(ISSUED/RETURNED/OVERDUE)` issue/return/overdue + fine calculation. Dashboard + tabs `catalog | issues`.

### 3.8 Transport (largest page, 1984 lines)
- `Vehicle(school+registrationNo unique)`, `Driver(vehicle unique)`, `Route`, `RouteStop`, `StudentTransport` assignment.
- Dual mode: `PARENT/STUDENT → GET /transport/my` “my-bus card”; staff full CRUD on tabs `routes | vehicles | drivers | assignments`.

### 3.9 HR & Payroll
- `Employee(school+employeeId unique, salary Decimal)`, `Leave(PENDING/APPROVED/REJECTED/CANCELLED)` approve/reject, `Payroll(employee+month+year unique)` generate / pay-all / pay-one. Departments. Tabs `overview | employees | departments | leave | payroll`.

### 3.10 Inventory & Assets
- `Asset(school+assetCode)`, `InventoryItem(school+code)`, `InventoryTransaction(IN/OUT/ADJUST)` issue/purchase. Dashboard + items/assets/transactions.

### 3.11 Reports (read-only aggregator)
- `GET /reports/overview|students|attendance|finance|hr|library|transport` — counts, `groupBy`, month buckets. UI `/reports` (1053 lines): 7 tabs, `StatCard`s, tables, client `downloadCSV()`, INR formatters.

### 3.12 Communication, Documents, Audit
- `Announcement`, `Message(sender, school)`, `Notification(user, IN_APP/EMAIL/SMS/PUSH)`, `Document(entityType/entityId polymorphic, url)`, `AuditLog(CREATE/UPDATE/DELETE/LOGIN/LOGOUT/PAYMENT/EXPORT/IMPORT/PUBLISH/APPROVE)` — immutable trail, readable via `GET /users/audit-logs`.
- Email receipt + fee reminders via SMTP if configured, else simulated (see §15).

### 3.13 Settings (9-tab school configuration)
`profile | branding (tagline/colors/theme/logo URL) | general (timezone/currency/language/grace/fee-reminder + AY) | security (2FA flags/strong-pw/expiry/timeout/lockout + change-pw) | email (SMTP + templates + test-mail) | whatsapp (provider/key/sender + toggles + test) | roles (custom Role CRUD + permission matrix) | notifications (inApp/email/sms/push × fee/attendance/results/announcements/leave) | payments (gateway select + Razorpay/Stripe keys stored as JSON)`.

---

## 4. User Journeys / Core Workflows

**A. Onboard a school:** `Super Admin → POST /schools → School + TRIAL subscription + SCHOOL_ADMIN + AY + LKG-12 → Login as school admin → Settings → branding/email/payments`.

**B. New admission:** `Students → Admit (admissionNumber, name, gender, class/section) → Parents → Create parent → Link to student → Attendance roster auto-includes student`.

**C. Daily attendance:** `Attendance → pick school/class/section/date → GET roster → mark Present/Absent/Late → POST bulk → monthly report`.

**D. Fee cycle:** `Fees → Structures (tuition/transport/lab, MONTHLY) → Academic Years → Bulk-generate invoices for month → Invoices (PENDING) → Record payment (cash/UPI, transactionId) → PARTIAL/PAID → Send receipt (email to linked parent) → Pending report + PDF`.

**E. Exam cycle:** `Exams → Create exam (term, dates) → Add subjects → Enter marks → Verify → Publish → Reports`.

**F. Transport allotment:** `Transport → Vehicles + Drivers + Routes + Stops → Assignments (student → route/stop) → Parent sees My Bus`.

**G. HR month-end:** `HR → Employees → Leaves (approve) → Payroll Generate (month/year) → Pay-all → Reports → finance`.

All state changes emit `AuditLog` and standardized responses (see §13).

---

## 5. Technology Stack

| Layer | Technology (pinned) |
| ----- | ------------------- |
| Frontend | Next.js 15.1 (App Router), React 19, TypeScript 5.7, Tailwind CSS 3.4, shadcn-style `ui/` (`cva + tailwind-merge`), Radix primitives, TanStack Query 5.62, Zustand 5 (persist), Axios, Recharts 2.15, `next-themes`, `sonner`, `date-fns`, `lucide-react`, `Inter + Vazirmatn` fonts |
| Backend | Node.js 20, Express 4.21, TypeScript, Prisma 6.2, Zod, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `helmet`, `cors`, `compression`, `express-rate-limit`, `pino` |
| Database | PostgreSQL 16, Prisma ORM (1263-line schema, ~51 models) |
| Cache / Queue | Redis 7, BullMQ 5 + `ioredis` (9 queues defined, email worker live, `REDIS_ENABLED=false` fallback) |
| Auth | JWT access 15m + rotating refresh 7d (`User.refreshTokens[]`), bcrypt 10 rounds, RBAC + 60+ granular permissions |
| Files / PDF | `pdfkit` (local Buffer PDFs), `multer` + `exceljs` + `csv-parse` installed (uploads/imports scaffolding) |
| Email / SMS | `nodemailer` SMTP (per-school settings + global), SMS/WhatsApp providers stubbed (simulated `delivered:true`) |
| Payments | Manual ledger today; `Razorpay/Stripe` keys stored, no SDK webhook yet (abstraction-ready) |
| Realtime / Docs | `socket.io` + `socket.io-client`, `swagger-jsdoc/ui` installed but not mounted (roadmap) |
| Testing | Jest + `ts-jest`, Supertest (API), Playwright / RTL planned (web) |
| DevOps | Docker + Compose (Postgres/Redis/API/Web), Render Blueprint (`render.yaml`), GitHub Actions CI (`lint → test → build`), Nginx-ready |

---

## 6. Architecture

### 6.1 Monorepo + Clean Architecture

```
Routes → Controllers → Services → Prisma → PostgreSQL
                ↘ Validators (Zod) + Middleware (auth/tenant/rbac) + Utils/Errors
```

- **Routes** only mount + apply `authenticate`, `authorize(...perms)`, `validate(schema)`.
- **Controllers** orchestrate HTTP (params → service → `ApiResponse`).
- **Services** hold all business logic + tenant checks (`entity.schoolId !== ctxSchoolId → TenantError`) in transactions where needed.
- `repositories/` folder exists but is intentionally empty — DB access lives in services via `PrismaClient` singleton.
- Frontend: Server Components for static, `"use client"` pages for interactivity; global state Zustand (`auth`, `global-search`), server state TanStack Query (`staleTime 30s`).

### 6.2 Request Lifecycle

```
Browser (Zustand token) → Axios Bearer → helmet/cors/rate-limit → authenticate (JWT → req.user)
→ authorize (permissions) → tenant check (schoolId from JWT) → Zod validate
→ Controller → Service → Prisma → Postgres → ApiResponse{success,data,message,meta}
→ AuditLog + (email queue if needed)
```

---

## 7. Monorepo Structure

```
school-erp/
├── apps/
│   ├── web/                 # Next.js 15 frontend (App Router)
│   │   └── src/app/
│   │       ├── (auth)/login/        # Split-screen login + EN/AR + demo accounts
│   │       ├── (dashboard)/         # Guarded shell: Sidebar+Topbar+GlobalSearch
│   │       │   ├── dashboard/ schools/ students/ parents/ teachers/
│   │       │   ├── academics/ attendance/ fees/ exams/ library/
│   │       │   ├── transport/ hr/ inventory/ reports/ settings/
│   │       └── components/{layout,dashboard,academics,fees,ui}
│   │       └── lib/{api,i18n} stores/{auth-store} hooks/{use-settings}
│   └── api/                 # Express REST API
│       └── src/{routes,controllers,services,validators,middleware,utils,jobs,constants,config}
├── packages/
│   ├── types/               # @schoolsphere/types (AuthUser, ApiResponse, RoleName…)
│   ├── validation/          # @schoolsphere/validation (Zod primitives + student/invoice)
│   ├── config/              # @schoolsphere/config (prefix, pagination, upload limits)
│   └── eslint-config/       # Shared ESLint + Prettier
├── prisma/schema.prisma     # 51-model source of truth (apps/api/prisma mirrors it)
├── docs/                    # (empty — this README is canonical)
├── docker/{Dockerfile.api,Dockerfile.web}
├── .github/workflows/ci.yml
├── docker-compose.yml       # Postgres:5433 + Redis:6379 + API:4000 + Web:3000
├── render.yaml              # Render free-tier API blueprint
├── .env / .env.example
└── package.json             # npm workspaces apps/* + packages/*
```

---

## 8. Multi-Tenancy Model

**Shared-database, per-row isolation** (not per-tenant DB/schema):

- Every tenant table has `schoolId FK`; where needed `branchId`.
- `getContextSchoolId(req)`: Super Admin → `?schoolId` / body / params; everyone else → forced `req.user.schoolId`.
- `tenantIsolation` middleware + service-layer re-verification on every read/write; `TenantError` on mismatch.
- `User @@unique(email, schoolId)` allows same email in different schools; `School delete` cascades everything.
- Super Admin bypasses scoping but must be explicit — no silent cross-school reads.

---

## 9. Authentication & RBAC

- `POST /auth/register` always creates `SUPER_ADMIN` (bootstrap only); `POST /auth/login` (`findFirst` by lowercased email, `bcrypt.compare`, `isActive` check, push refresh token, `AuditLog LOGIN`).
- Tokens: access JWT 15m (embeds full `AuthUser{id,email,roleName,schoolId,branchId,permissions,isSuperAdmin}`), refresh 7d stored in `User.refreshTokens[]` with rotation; `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/profile`, `POST /auth/change-password` (clears tokens).
- `authorize(...perms)` requires **every** permission; `isSuperAdmin` bypass. Frontend `hasPermission()` returns true for `SUPER_ADMIN/SCHOOL_ADMIN`, else checks array — but UI gating is cosmetic; API is authoritative.
- `constants/permissions.ts`: 60+ `module.action` strings (e.g. `student.view/create/edit/delete`, `fees.collect`, `payroll.process`). Seeded idempotently by `initializeRoles()` + `createDefaultSubscriptionPlans()` + `ensureSuperAdmin()` on every boot.
- Custom roles via `Settings → Roles` (only `isSystem=false` editable; `name` globally unique).
- `2FA` columns + `avatar/multer` + lockout settings exist in schema/settings but have no live flow yet.

---

## 10. Frontend (`apps/web`)

- **Shell:** `(dashboard)/layout.tsx` auth guard (`!user → /login`), `<Sidebar w-64/w-16 collapsible, 14 navItems + Schools if SUPER_ADMIN> + <Topbar Ctrl+K search, EN/العربية switch, dark toggle, bell, profile menu> + <GlobalSearchModal (debounced 300ms GET /schools?search)>`.
- **Pages:** 14 modules, each: TanStack Query list (`[module, search, page, schoolId, tab]`) + `useMutation + invalidateQueries + toast` + search/pagination/stats + school picker if superadmin + role-gated actions (`canManage/canEdit` inline checks).
- **API client (`lib/api.ts`):** `axios(baseURL=NEXT_PUBLIC_API_URL||localhost:4000/api/v1, 30s)`, request injects `Bearer`, response auto-refreshes once (`POST /auth/refresh`), else clears `schoolsphere-auth` + redirects `/login`.
- **State:** `zustand/persist` (`schoolsphere-auth: user/accessToken/refreshToken`, `global-search: open`), `useSettings()` hook (`GET/PUT /settings`, `PUT /settings/profile`), local `useState` forms (no `react-hook-form` in code despite dep).
- **i18n:** `LanguageProvider` + `dictionaries/en (523 keys) + ar + modules/*×14`, `localStorage schoolsphere-lang-override/default-${schoolId}`, school default wins on fresh login, `document.dir/lang` switch, `t(key,params)` with `{n}` interpolation.
- **Charts/styling:** `recharts` (`Revenue/Attendance/FeeMix/Growth` — mocked series + live stat cards), Tailwind `primary #1a7a1a`, `accent #3366ff`, `sidebar #0f172a`, `sonner` toasts.

---

## 11. Backend (`apps/api`)

Mounted in `src/index.ts` under `API_PREFIX=/api/v1` (`GET /health` public, rest `authenticate`):

| Prefix | What it implements |
| ------ | ------------------ |
| `/auth` | register/login/refresh/logout/profile/change-password |
| `/schools` | CRUD + `setStatus` + `resetAdminPassword` + dashboard; create = school + TRIAL/STARTER sub + admin + AY + defaults |
| `/users` | User CRUD + `GET /audit-logs` |
| `/students` | CRUD + bulk promote/transfer + dashboard |
| `/parents` | CRUD + link/unlink `StudentParent` |
| `/teachers` | CRUD + dashboard |
| `/subjects` | Subjects + classes/sections/departments/timetables/homework/assignments (no separate routers) |
| `/attendance` | mark single/bulk, roster, monthly report |
| `/fees` | AY/categories/structures/generate-invoices/invoices/payments/fine/send-receipt/pending/dashboard + PDFs |
| `/exams` | Exams + ExamSubject + Mark (enter/verify/publish) + results |
| `/library` | Books + issue/return/overdue + dashboard |
| `/transport` | Vehicles/drivers/routes/stops/assignments + `/my` + dashboard |
| `/hr` | Employees/leaves (approve/reject)/payroll (generate/pay/pay-all)/departments + dashboard |
| `/inventory` | Items/assets/transactions + dashboard |
| `/reports` | Aggregates overview/students/attendance/finance/hr/library/transport |
| `/settings` | SchoolSetting JSON + custom Role CRUD + sendTest email/whatsapp |

16 Zod validator files + `validate()` middleware; `utils/errors.ts (AppError/Authentication/Authorization/Tenant/NotFound/Conflict)`, `utils/fees.ts (roundMoney, academicYearLabel, feeMonthLabel, due 10th next month, invoiceBalance, resolveInvoiceStatus)`.

---

## 12. Database (`prisma/schema.prisma`)

1263 lines, **~51 models**, all tenant relations `onDelete: Cascade` + indexes on `schoolId/status/dates`:

- **Auth/RBAC:** `Role(id,name unique,schoolId?,isSystem)`, `Permission(name unique,module,action)`, `RolePermission(role+perm unique)`, `User(email+schoolId unique,passwordHash,refreshTokens[],2FA,schoolId?,branchId?,roleId)`.
- **Tenant:** `School(name,schoolCode unique,email,status)`, `Branch(school+code unique)`, `SchoolSetting(school unique, branding/general/security/email/whatsapp/notifications/payment Json)`, `SubscriptionPlan(name unique,price,limits,features[])`, `Subscription(school unique,plan,TRIAL/ACTIVE/PAST_DUE/SUSPENDED/CANCELLED/EXPIRED)`.
- **Academic:** `AcademicYear(school+name unique)`, `Term`, `Department(school+code)`, `SchoolClass(school+year+code)`, `Section(class+name)`, `Subject(school+code)`, `Timetable`, `Homework`, `Assignment`.
- **People:** `Student(school+admissionNo unique)`, `Parent`, `StudentParent(student+parent unique)`, `Teacher(school+employeeId unique)`, `Employee(school+employeeId unique,salary Decimal)`, `Attendance(student+date unique)`.
- **Fees:** `FeeCategory(school+name)`, `FeeStructure`, `Invoice(school+number unique)`, `InvoiceItem`, `InvoiceSequence(school+year unique)`, `Payment`, `Refund`, `FineHistory`, `ReceiptDelivery`.
- **Exams/Library/Transport/HR/Inventory/Comms:** `Exam/ExamSubject/Mark`, `Book/LibraryIssue`, `Vehicle/Driver/Route/RouteStop/StudentTransport`, `Leave/Payroll`, `Asset/InventoryItem/InventoryTransaction`, `Announcement/Message/Notification/Document/AuditLog`.

No dedicated routers for `Document/Announcement/Message/Notification/Subscription/Refund/Branch` yet — models ready, APIs via parent modules or roadmap.

---

## 13. API Reference

Base: `http://localhost:4000/api/v1`. All (except `GET /health`, `POST /auth/login|refresh|register`) require `Authorization: Bearer <accessToken>`.

| Module | Representative endpoints |
| ------ | ------------------------ |
| Auth | `POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout, GET /auth/profile, POST /auth/change-password` |
| Schools | `GET /schools?search&page, POST /schools, GET /schools/:id, PUT /schools/:id, DELETE /schools/:id, POST /schools/:id/status, POST /schools/:id/reset-password, GET /schools/dashboard, GET/POST /schools/:schoolId/classes, POST .../setup-defaults, POST/DELETE .../:classId/sections` |
| Users/Students/Parents/Teachers | `GET /users/audit-logs`, `GET/POST /students, GET /students/dashboard, PUT/DELETE /students/:id`, same shape for `/parents (/link|/unlink)`, `/teachers` |
| Academics | `GET/POST /subjects, GET /subjects/dashboard, PUT/DELETE /subjects/:id` (+ classes via schools) |
| Attendance | `GET /attendance/roster?schoolId&classId&sectionId&date, POST /attendance, POST /attendance/bulk, GET /attendance/report` |
| Fees | `GET /fees/dashboard, GET/POST /fees/academic-years, POST /fees/academic-years/:id/current, GET/POST /fees/structures, POST /fees/generate-invoices, GET /fees/invoices?search&status&page, POST /fees/invoices, POST /fees/invoices/:id/payments, POST /fees/invoices/:id/fine, POST /fees/invoices/:id/send-receipt, GET /fees/reports/pending` |
| Exams/Library/Transport/HR/Inventory | `GET/POST /exams, GET /exams/dashboard, GET /exams/:id/results, POST /exams/:id/publish`, `GET /library/books|issues|dashboard, POST /library/issues`, `GET /transport/my|dashboard|vehicles|drivers|routes|assignments`, `GET /hr/dashboard|employees|departments|leaves|payroll, POST /hr/payroll/generate|pay-all`, `GET /inventory/dashboard|items|assets|transactions` |
| Reports/Settings | `GET /reports/overview|students|attendance|finance|hr|library|transport`, `GET/PUT /settings?schoolId=, PUT /settings/profile, POST /settings/roles, POST /settings/test-email|test-whatsapp` |

**Envelope:**

```json
{ "success": true, "data": {}, "message": "", "meta": { "total": 0, "page": 1, "limit": 25, "totalPages": 0 } }
{ "success": false, "message": "", "code": "VALIDATION_ERROR", "errors": [] }
```

---

## 14. Shared Packages

- `@schoolsphere/types`: `AuthUser`, `RoleName` (14 union), `ApiResponse<T>`, `PaginationMeta`, `School`, `Student`, `UserRole`.
- `@schoolsphere/validation` (Zod): `email/uuid/date/phone/pagination` primitives + `createStudentSchema` + `createInvoiceSchema`.
- `@schoolsphere/config`: `api{prefix:/api/v1,timeout:30000}`, `pagination{25/max100}`, `upload{10MB,[image,pdf,doc,xls,csv]}`, `app{name,version}`.
- `@schoolsphere/eslint-config`: `@typescript-eslint + prettier`, `ES2022 strict`, ignore `dist/node_modules/.next/coverage`.
- Note: packages are versioned and ready but `apps/*` do not yet import `@schoolsphere/*` — wiring is roadmap.

---

## 15. Background Jobs, Notifications & Integrations

| Area | Status in code |
| ---- | -------------- |
| Queue | `jobs/queue.ts` defines 9 BullMQ queues (`sendEmail/SMS/WhatsApp/generateReport/generatePDF/processImport/feeReminder/attendanceNotification/backupDatabase`). **Only `sendEmail` has a Worker** (nodemailer SMTP if `SMTP_HOST` set). `REDIS_ENABLED=false` → noop queue, API boots without Redis (Render free tier). |
| Email | Real via `notificationService` + queue + per-school SMTP (`SchoolSetting.email`) + `sendTest`. Without SMTP → simulated `{delivered:true, "[EMAIL] Queued..."}`. Receipts + fee reminders use this path. |
| SMS / WhatsApp | Stubbed `{delivered:true, "Provider integration pending"}` / `{simulated:true}` — numbers normalized, logged as `ReceiptDelivery`, ready for Twilio/Meta Graph API keys. |
| Payments | **Manual ledger today.** `collectPayment()` validates `amount>0, ≤balance`, dedupes `transactionId/school`, updates invoice in transaction. `SchoolSetting.payment{gateway,keys}` + `.env RAZORPAY/STRIPE` stored only — no SDK order/webhook/signature verification yet. Frontend `RAZORPAY/STRIPE` options map to manual `ONLINE` entries. Intended flow: `Invoice → Initiate → Gateway → Webhook verify → Transaction → Invoice → Receipt → Notify` (webhook step pending). |
| Storage | `S3_*` in config/env, `multer` installed, but **zero upload endpoints**; `Document.url` never written; PDFs skip remote logos. Signed-URL flow is roadmap. |
| Realtime | `socket.io` dep present, **no `new Server` usage**; `Message/Notification` are DB-only. Live chat/attendance push is roadmap. |
| PDFs/Exports | `pdfkit` live (invoice + pending PDFs → Buffer download); `exceljs/csv-parse` installed, CSV export done client-side in Reports. `swagger` installed, not mounted. |

---

## 16. Getting Started

### Prerequisites

- Node.js 20+, npm 10+
- PostgreSQL 16 (local `5433` via Compose or Neon/Supabase URL)
- Redis 7 (optional — set `REDIS_ENABLED=false` to run without)
- Git

### 1. Install

```bash
git clone <repo> school-erp
cd school-erp
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, JWT_SECRET/JWT_REFRESH_SECRET,
# CORS_ORIGIN, SMTP_*, S3_*, RAZORPAY_*, STRIPE_*, SUPERADMIN_*
```

Frontend URL defaults to `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` (see Compose).

### 3. Database

```bash
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev (apps/api)
npm run db:seed       # demo schools/users/students/fees (apps/api/prisma/seed.ts)
```

Boot also auto-runs `initializeRoles() + createDefaultSubscriptionPlans() + ensureSuperAdmin()` idempotently.

### 4. Run (dev)

```bash
npm run dev           # concurrently api:4000 + web:3000
# or separately:
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1/health

### 5. Build / Lint / Format

```bash
npm run build         # api tsc + web next build
npm run build:api
npm run build:web
npm run lint
npm run format
```

---

## 17. Configuration (Environment Variables)

| Group | Vars |
| ----- | ---- |
| Super Admin | `SUPERADMIN_EMAIL=admin@schoolsphere.test`, `SUPERADMIN_PASSWORD=Admin@2024` |
| DB / Redis / Server | `DATABASE_URL=postgresql://schoolsphere:schoolsphere_dev_2024@localhost:5433/schoolsphere`, `REDIS_URL=redis://localhost:6379`, `REDIS_ENABLED`, `NODE_ENV, PORT=4000, API_PREFIX=/api/v1` |
| Auth | `JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN=15m, JWT_REFRESH_EXPIRES_IN=7d` |
| CORS | `CORS_ORIGIN=http://localhost:3000` |
| Storage | `S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION=ap-south-1` |
| Email | `SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM=noreply@schoolsphere.com` |
| Payments | `RAZORPAY_KEY_ID=rzp_test_*, RAZORPAY_KEY_SECRET, STRIPE_SECRET_KEY=sk_test_*, STRIPE_WEBHOOK_SECRET=whsec_*` |
| Comms / AI | `SMS_PROVIDER=twilio, SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, SMS_FROM_NUMBER`, `WHATSAPP_API_URL=https://graph.facebook.com/v18.0/.../messages, WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY, HUGGINGFACE_API_KEY` |
| Frontend | `NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_NAME=SchoolSphere ERP` (Compose, not `.env.example`) |

> Secrets only in env — never in code. Harden `JWT_* + SUPERADMIN_* + DATABASE_URL` in production.

---

## 18. Docker & Deployment

**Local (dev-style, hot-reload binds):**

```bash
docker compose up --build
# postgres 5433:5432, redis 6379, api 4000:4000, web 3000:3000
```

`docker/Dockerfile.api` (`node:20-alpine`, `prisma generate`, `CMD prisma db push && tsx src/index.ts`); `Dockerfile.web` (`CMD npm run dev`). Production `build/start` + Nginx TLS is roadmap — Compose today is dev parity, not hardened prod.

**Render (free-tier API-only blueprint, `render.yaml`):**

- `runtime:node, plan:free`, `build: npm install --include=dev && prisma generate && npm run build --workspace=apps/api`, `start: prisma db push && node apps/api/dist/index.js`, `healthCheckPath:/api/v1/health`.
- `env: NODE_ENV=production, API_PREFIX, REDIS_ENABLED=false, JWT_SECRET/REFRESH_SECRET(generateValue), SUPERADMIN_*, DATABASE_URL (Neon/Supabase), CORS_ORIGIN (Vercel)` — pair with Vercel-hosted `apps/web`.

**CI (`.github/workflows/ci.yml` on `push[main,develop] / PR[main]`):** `lint-and-typecheck (node20, npm ci, eslint, tsc --noEmit api+web)` → `test (postgres:16 + redis:7 services, db:generate, jest)` → `build`.

---

## 19. Demo Accounts & Seed Data

Seed + login page (dev only) expose:

| Role | Email | Password |
| ---- | ----- | -------- |
| Super Admin | `admin@schoolsphere.test` | `Admin@2024` |
| School Admin | `admin@gis001.test` | `School@2024` |
| Teacher | `teacher1@gis001.test` | `School@2024` |
| Parent | `parent1@gis001.test` | `School@2024` |

> Shown on `/login` **only in development**. Change `SUPERADMIN_*` + all seeds before any public deploy.

---

## 20. Testing & Quality

```bash
npm test            # Jest + Supertest (apps/api): auth, RBAC, tenant isolation, student CRUD, fees, webhooks (stubbed), attendance, marks, reports
npm run test:e2e    # Playwright (apps/web) — scaffold
```

Covered per code: login/refresh, `authorize()` matrix, cross-school rejection, student CRUD scoping, invoice generation/balance/status, manual payment ledger, attendance uniqueness, mark publish gate, report aggregates.

---

## 21. Security

- `helmet, cors(CORS_ORIGIN), rate-limit(500/15m on /api/v1/*), json 10mb, cookie-parser, compression`.
- JWT rotation + `bcryptjs`, `change-password` revokes refresh tokens, account `isActive` gate.
- Zod validation on every mutating route, `AppError` taxonomy → consistent `code` + HTTP status.
- Immutable `AuditLog` for auth/payments/CRUD/publish/export/import.
- Tenant checks in middleware **and** services — route handlers never trust `schoolId` from body.
- Gaps to close before public prod: authorization tests for every new route, login school-scoping ambiguity (`findFirst` by email), rate-limit per-auth tightening, S3 signed-URL validation, webhook signature verification, 2FA/lockout flows, `swagger` auth.

---

## 22. Current Implementation Status

**Solid today:** monorepo wiring, auth + 14 roles + 60 permissions + custom roles, tenant isolation, school provisioning, students/parents/teachers CRUD, classes/sections/subjects/timetable/homework, attendance roster/bulk, full fee ledger + fines + invoice PDFs + simulated receipts, exams/marks/publish, library/transport/HR/inventory CRUD + dashboards, 7 reports + CSV, 9-tab settings + bilingual UI + global search + CI/Docker/Render scaffolds.

**Stubbed / pending:** live Razorpay/Stripe webhooks, S3 uploads, SMS/WhatsApp providers, Socket.IO realtime, BullMQ consumers beyond email, `exceljs/csv` bulk imports, Swagger UI, `@schoolsphere/*` wiring, E2E suite, `Document/Announcement/Message` dedicated APIs, subscription billing, AI features.

This README describes **code as it is** — not just the roadmap — so deploy/integration planning stays honest.

---

## 23. Roadmap

1. ✅ Architecture, auth, DB, multi-tenancy, RBAC, Super Admin, School Management
2. ✅ Students, Parents, Teachers, Staff, Academic Management
3. ✅ Attendance, Timetable, Homework, Assignments
4. ✅ Fees, Invoices, Manual Payments, Receipts (+ PDFs)
5. ✅ Exams, Marks, Grades, Report Cards (publish flow)
6. ✅ Library, Transport, Inventory, Assets
7. ✅ HR, Payroll, Leave
8. ⏳ Communication, Notifications, Realtime Chat (Socket.IO + SMS/WhatsApp live)
9. ✅ Reports, Exports, PDFs, Audit Logs (Excel/bulk-import pending)
10. ⏳ AI Features, Subscription Billing, Advanced Analytics
11. ⏳ Live Payment Gateways + S3 Storage + Swagger + Hardened Prod (Nginx/TLS) + E2E
12. ⏳ Mobile Parent App, Branch Portal polish, Per-branch analytics

---

## 24. License

Proprietary — for the SchoolSphere ERP platform. All rights reserved. Contact the platform owner for licensing, SaaS hosting, or on-premise deployment.
