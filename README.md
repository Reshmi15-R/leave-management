# LeaveDesk: Leave Management System (MERN)

LeaveDesk is a leave management system for organizations, built on MongoDB, Express, React and Node.js. Employees apply for leave and track their balances. Managers approve requests through a multi-level workflow, and administrators configure policies, employees and reports.

## Quick start

```bash
npm install                # root (concurrently)
npm run install:all        # server + client dependencies
npm run seed               # demo data (refuses to overwrite; use: npm run seed --prefix server -- --reset)
npm run dev                # API on :5001, React app on :5173
```

Open http://localhost:5173. Every demo account uses the password `password123`:

| Role | Email |
|---|---|
| Administrator | admin@company.com |
| General Manager | gm@company.com |
| Team Manager | manager@company.com / sales.manager@company.com |
| Team Leader | leader@company.com / leader2@company.com |
| Team Member | member@company.com, priya@, kiran@, anita@company.com |

Reporting lines: Members report to a Leader, Leaders report to a Manager, Managers report to the GM.

Configuration is in `server/.env` (`MONGO_URI`, `DB_NAME=leave-management`, `JWT_SECRET`, `PORT=5001`). **Change `JWT_SECRET` before deploying.**

For production, run `npm run build`, then `npm start`. Express serves `client/dist` and the API on the same port.

## Roles & access

| Feature | Member | Leader | Manager | GM / Admin |
|---|:-:|:-:|:-:|:-:|
| Dashboard, apply, history, cancel pending, statements, calendar | ✓ | ✓ | ✓ | ✓ |
| Approve / reject team requests, team calendar, balances & reports | | ✓ | ✓ | ✓ |
| Adjust balances, record leave with policy override, approve with override | | | ✓ | ✓ |
| Employees, departments, leave types & policies, holidays, settings, org reports, audit log | | | | ✓ |

"Team" means everyone below you in the `reportsTo` hierarchy, direct and indirect. GM and Admin see the whole organization.

## Leave workflow

1. **Apply.** Live validation counts working days, skipping weekends and holidays. It also checks notice period, backdating limit, maximum consecutive days, required documents, overlaps and the available balance. The days are reserved as *pending*.
2. **Level 1:** the employee's `reportsTo`. If the employee has no manager, the request goes to the HR/GM pool.
3. **Level 2:** the approver's own manager. This level applies when a request is longer than *Settings → Second-level approval threshold* (default 5 days).
4. **Approved:** pending days move to *used*. **Rejected / cancelled:** pending days are released.
5. A GM or Admin can act at any level, and their approval is final. Overrides are flagged on the approval step and written to the audit log.

## Balances

Each employee has one balance per leave type per year:

`available = entitlement + carried forward + adjustments − used − pending`

- The entitlement is the leave type's default. It can be overridden per role (e.g. Earned Leave: Manager 21, GM 24).
- Carry-forward is capped per type and applied when the new year's balance is created. You can do this ahead of time with *Settings → Year-end processing*.
- Unpaid types (e.g. Loss of Pay) track usage without a limit.

## API overview (`/api`)

`auth` (register, login, me) · `dashboard` · `leaves` (preview, apply, my, approvals, team, calendar, override, :id approve/reject/cancel) · `balances` (me, team, user/:id, adjust, history, initialize) · `reports` (statement, team, organization: `format=json|csv|pdf`) · `users` · `departments` · `leave-types` · `settings` (+ holidays, audit)

## Project layout

```
server/src
  models/      User, Department, LeaveType, LeaveBalance, LeaveRequest, Settings, AuditLog
  routes/      one file per resource
  utils/       leave.js (working-day count, balances, hierarchy, validation, approval chain), export.js (PDF/CSV)
  seed.js
client/src
  pages/       employee pages, manager/, admin/
  components/  Layout, BalanceCard, LeaveDetail (approval timeline), Charts, ui
```
