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