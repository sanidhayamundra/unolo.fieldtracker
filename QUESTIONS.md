# Technical Questions

These answers are written in the context of **this specific Field Force Tracker codebase**.

---

## 1. What breaks at 10,000 users and why?

**SQLite file locking.** SQLite uses database-level locks. When 10k employees check in simultaneously, write operations queue up. Response times spike, and eventually the connection pool (if we had one) exhausts.

**Specific bottlenecks in this code:**
- `/api/checkin` does 4 sequential DB queries per request (assignment check, active check, client coords, insert). That's 40k queries just for check-ins.
- `/api/reports/daily-summary` does a full table scan with GROUP BY. Works fine for 50 employees, dies with 10k.
- JWT validation is CPU-bound. 10k concurrent verify operations will max out cores.

**What I'd change:**
- Switch to PostgreSQL with connection pooling (10k users = real database time)
- Add Redis for session caching to reduce JWT verification load
- Index `checkins(employee_id, checkin_time, status)` properly
- Consider read replicas for reporting queries

---

## 2. JWT security flaw and improvement?

**The flaw I already fixed:** Password hash was in the JWT payload. JWTs are base64-encoded, not encrypted. Anyone could decode and see it.

**Other issues still present:**
- `JWT_SECRET` has a hardcoded fallback (`'default-secret-key'` in middleware/auth.js line 3). If `.env` is missing, everyone gets the same secret.
- No token refresh mechanism. 24-hour expiry is long—stolen token is valid for a full day.
- Token isn't bound to device/IP. Can be used from anywhere once leaked.

**What I'd add:**
- Remove the fallback secret entirely—fail loudly if JWT_SECRET isn't set
- Implement refresh tokens with shorter access token expiry (15 min access, 7 day refresh)
- Store a token version in the DB to enable logout-everywhere
- Consider adding `jti` (JWT ID) for blacklisting

---

## 3. Offline check-in strategy?

Field employees often work in basements, rural areas, or places with spotty connectivity. We need offline-first.

**Queue + Sync approach:**
1. Store check-ins in IndexedDB with status `pending`
2. Each record gets a `created_at` timestamp (client time) and a UUID
3. When online, sync endpoint receives batch of pending check-ins
4. Server validates and responds with success/failure for each UUID
5. Client marks synced records as `synced`

**Edge cases this codebase would need to handle:**
- Duplicate check-ins: Use UUID deduplication on server
- Clock skew: Trust client timestamp for display, but server timestamp for calculations
- Conflict resolution: If someone checks in offline at 9am but syncs at 2pm while server shows them checked in elsewhere, reject with clear message
- Stale client data: Force re-fetch of assignments on sync

**Implementation:**
```javascript
// Service worker intercepts /api/checkin
if (!navigator.onLine) {
    await saveToIndexedDB({
        uuid: crypto.randomUUID(),
        ...checkinData,
        created_at: new Date().toISOString(),
        status: 'pending'
    });
    return { success: true, offline: true };
}
```

---

## 4. SQL vs NoSQL for this app?

**SQL is the right choice here.** Here's why:

- **Relationships are core.** Users belong to managers, employees are assigned to clients, check-ins link to both. These are classic relational patterns.
- **Reporting needs JOINs.** The daily summary report aggregates across users and check-ins. NoSQL would require denormalization or multiple queries.
- **ACID matters.** When an employee checks in, we read assignment, check active status, then write. That sequence needs consistency.

**Where NoSQL might help:**
- Location history (time-series of lat/lng pings) → Could go in MongoDB or InfluxDB
- Session data / cache → Redis
- Audit logs → Could be append-only in DynamoDB

**But the core domain—users, clients, check-ins, assignments—stays relational.** Schema is well-defined and relationships are central. Forcing this into MongoDB would mean either embedding (denormalized mess) or manual joins (reinventing SQL badly).

---

## 5. Authentication vs Authorization (mapped to this code)?

**Authentication = Who are you?**
- `backend/routes/auth.js` POST `/login` — verifies password, issues JWT
- `backend/middleware/auth.js` `authenticateToken()` — verifies JWT signature and expiry
- If token is missing or invalid → 401 Unauthorized

**Authorization = What can you do?**
- `backend/middleware/auth.js` `requireManager()` — checks if `req.user.role === 'manager'`
- `backend/routes/checkin.js` lines 33-40 — checks if employee is assigned to client
- `backend/routes/reports.js` lines 46-56 — checks if requested employee belongs to this manager
- If role/assignment is wrong → 403 Forbidden

**Simple summary:**
- Authentication happens once (login)
- Authorization happens on every protected request
- 401 = "I don't know who you are"
- 403 = "I know who you are, but you can't do that"

---

## 6. Real race conditions in this codebase?

**Race Condition 1: Double Check-in**

Location: `backend/routes/checkin.js`, the "check for existing active check-in" logic.

```javascript
const [activeCheckins] = await pool.execute(...);  // Query 1
if (activeCheckins.length > 0) return error;
// ← Another request could insert here
await pool.execute('INSERT INTO checkins...');     // Query 2
```

If the same user submits two rapid check-ins, both pass the check before either completes the insert. You get duplicate active check-ins.

**Fix:** Use a database transaction with row-level locking, or add a unique constraint on `(employee_id, status)` where status = 'checked_in'.

**Race Condition 2: Checkout After Checkin**

If a user rapidly clicks "Check Out" and then "Check In", the operations might complete out of order. The check-out targets "status = checked_in", but by the time it runs, a new check-in might exist.

**Fix:** Use optimistic locking—include a version number or last-modified timestamp in the update WHERE clause.

**Race Condition 3: Frontend State vs Server State**

`frontend/src/pages/CheckIn.jsx` refreshes via `fetchData()` after check-in. But if the network is slow, the user might navigate away or submit again before the refresh completes.

**Fix:** Disable the form immediately on submit (already done with `submitting` state), but also prevent navigation during pending operations.

**In production, I'd add:**
- `UNIQUE INDEX idx_active_checkin ON checkins(employee_id) WHERE status = 'checked_in'` (PostgreSQL partial index)
- Request debouncing on frontend
- Idempotency keys for POST requests
