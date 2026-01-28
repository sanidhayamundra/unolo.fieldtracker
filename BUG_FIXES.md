# Bug Fixes Documentation

This document lists all bugs identified and fixed in the Field Force Tracker application.

---
## Bug 1: Login Fails Randomly

**Location:** `backend/routes/auth.js`, line 28  
**Cause:** `bcrypt.compare()` returns a Promise, but it wasn't awaited. Since a Promise object is truthy, the check `if (!isValidPassword)` never triggered—until async timing made it fail unpredictably.  
**Fix:** Added `await` before `bcrypt.compare()`.  
**Reasoning:** Authentication must be deterministic. Missing await is a common async pitfall.

---

## Bug 2: Password Exposed in JWT Token

**Location:** `backend/routes/auth.js`, line 35  
**Cause:** The JWT payload included `password: user.password`. Anyone decoding the token (it's just base64) could see the hashed password.  
**Fix:** Removed `password` from the JWT payload.  
**Reasoning:** Hashed or not, passwords should never leave the server. JWTs are not encrypted.

---

## Bug 3: Email Login is Case-Sensitive

**Location:** `backend/routes/auth.js`, line 17-19  
**Cause:** Email was compared directly without normalization. `User@UNOLO.COM` wouldn't match `user@unolo.com`.  
**Fix:** Normalized email with `.toLowerCase().trim()` and used `LOWER()` in the SQL query.  
**Reasoning:** Emails are case-insensitive by RFC. Users expect this.

---

## Bug 4: Validation Error Returns HTTP 200

**Location:** `backend/routes/checkin.js`, line 30  
**Cause:** Missing client_id returned status 200 with `success: false`. Clients checking HTTP status would think the request succeeded.  
**Fix:** Changed to status 400.  
**Reasoning:** 4xx codes indicate client error. 200 with an error body is an API anti-pattern.

---

## Bug 5: SQL Injection Vulnerability

**Location:** `backend/routes/checkin.js`, lines 113-116  
**Cause:** `start_date` and `end_date` were concatenated directly into SQL strings via template literals.  
**Fix:** Used parameterized queries with `?` placeholders.  
**Reasoning:** String concatenation in SQL is how injection attacks happen. Always use parameters.

---

## Bug 6: Wrong Column Names in INSERT

**Location:** `backend/routes/checkin.js`, lines 57-58  
**Cause:** INSERT used `lat, lng` but the schema defines `latitude, longitude`.  
**Fix:** Changed to `latitude, longitude`.  
**Reasoning:** Schema mismatch causes SQLite errors or silent data loss.

---

## Bug 7: MySQL NOW() Used in SQLite

**Location:** `backend/routes/checkin.js`, line 88  
**Cause:** `NOW()` is MySQL syntax. SQLite doesn't recognize it.  
**Fix:** Replaced with `datetime('now')`.  
**Reasoning:** Different databases have different function syntax. SQLite uses datetime().


---

## Bug 8: Checkout Doesn't Verify Status

**Location:** `backend/routes/checkin.js`, lines 78-80  
**Cause:** Query found the most recent check-in regardless of status. Could "checkout" from an already checked-out record.  
**Fix:** Added `status = 'checked_in'` filter to the query.  
**Reasoning:** State machines need proper guards. Only active check-ins should be checkable-out.

---

## Bug 9: MySQL DATE_SUB in SQLite

**Location:** `backend/routes/dashboard.js`, line 80  
**Cause:** `DATE_SUB(NOW(), INTERVAL 7 DAY)` is MySQL syntax.  
**Fix:** Changed to `datetime('now', '-7 days')`.  
**Reasoning:** Same issue as Bug 7—SQLite has its own date arithmetic syntax.


## Bug 10: Role Check Uses User ID Instead of Role

**Location:** `frontend/src/pages/Dashboard.jsx`, line 15  
**Cause:** `user.id === 1` was used to check if user is a manager. Only works if the first user is always a manager.  
**Fix:** Changed to `user.role === 'manager'`.  
**Reasoning:** Hardcoded IDs break when data changes. Role field exists for this purpose.

---

## Bug 11: History Page Crashes on Load

**Location:** `frontend/src/pages/History.jsx`, lines 45-53  
**Cause:** `totalHours` was calculated using `checkins.reduce()` before `checkins` was loaded. Initial state was `null`, and `null.reduce()` throws.  
**Fix:** Moved calculation after loading check and guarded with `(checkins || [])`.  
**Reasoning:** Race condition between render and data fetch. Always guard against null.

---


## Bug 12: Check-in Form Submits Twice

**Location:** `frontend/src/pages/CheckIn.jsx`, line 58  
**Cause:** `handleCheckIn` didn't call `e.preventDefault()`. Form submitted via HTTP POST AND the handler.  
**Fix:** Added `e.preventDefault()` at the start of the handler.  
**Reasoning:** Default form behavior conflicts with SPA patterns. Always prevent default in React forms.

---