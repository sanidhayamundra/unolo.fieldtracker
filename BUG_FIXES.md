# Bug Fixes Documentation

This document lists all bugs identified and fixed in the Field Force Tracker application.

---
## Bug 1: Login Fails Randomly

**Location:** `backend/routes/auth.js`, line 28  
**Cause:** `bcrypt.compare()` returns a Promise, but it wasn't awaited. Since a Promise object is truthy, the check `if (!isValidPassword)` never triggered—until async timing made it fail unpredictably.  
**Fix:** Added `await` before `bcrypt.compare()`.  
**Reasoning:** Authentication must be deterministic. Missing await is a common async pitfall.

---