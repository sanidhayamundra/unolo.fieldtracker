const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Haversine formula for distance calculation between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
        return null;
    }
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // Rounded to 2 decimals
}

// Validate latitude/longitude ranges
function isValidCoordinate(lat, lon) {
    if (lat == null || lon == null) return false;
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// Get assigned clients for employee
router.get('/clients', authenticateToken, async (req, res) => {
    try {
        const [clients] = await pool.execute(
            `SELECT c.* FROM clients c
             INNER JOIN employee_clients ec ON c.id = ec.client_id
             WHERE ec.employee_id = ?`,
            [req.user.id]
        );

        res.json({ success: true, data: clients });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
});

// Create new check-i
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { client_id, latitude, longitude, notes } = req.body;

        if (!client_id) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        // Validate coordinates if provided
        if (latitude != null && longitude != null && !isValidCoordinate(latitude, longitude)) {
            return res.status(400).json({ success: false, message: 'Invalid latitude or longitude values' });
        }

        // Check if employee is assigned to this client
        const [assignments] = await pool.execute(
            'SELECT * FROM employee_clients WHERE employee_id = ? AND client_id = ?',
            [req.user.id, client_id]
        );

        if (assignments.length === 0) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this client' });
        }

        // Check for existing active check-in
        const [activeCheckins] = await pool.execute(
            `SELECT * FROM checkins WHERE employee_id = ? AND status = 'checked_in'`,
            [req.user.id]
        );

        if (activeCheckins.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active check-in. Please checkout first.'
            });
        }

        // Fetch client location for distance calculation
        const [clients] = await pool.execute(
            'SELECT latitude, longitude FROM clients WHERE id = ?',
            [client_id]
        );

        let distance = null;
        if (clients.length > 0 && clients[0].latitude != null && clients[0].longitude != null) {
            distance = calculateDistance(
                latitude,
                longitude,
                clients[0].latitude,
                clients[0].longitude
            );
        }

        const [result] = await pool.execute(
            `INSERT INTO checkins (employee_id, client_id, latitude, longitude, distance_from_client, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, client_id, latitude, longitude, distance, notes || null, 'checked_in']
        );

        res.status(201).json({
            success: true,
            data: {
                id: result.insertId,
                distance_km: distance,
                message: 'Checked in successfully'
            }
        });
    } catch (error) {
        console.error('Check-in failed:', error);
        res.status(500).json({ success: false, message: 'Check-in failed' });
    }
});

// Checkout from current locatio
router.put('/checkout', authenticateToken, async (req, res) => {
    try {
        const [activeCheckins] = await pool.execute(
            `SELECT * FROM checkins WHERE employee_id = ? AND status = 'checked_in' 
             ORDER BY checkin_time DESC LIMIT 1`,
            [req.user.id]
        );

        if (activeCheckins.length === 0) {
            return res.status(404).json({ success: false, message: 'No active check-in found' });
        }

        await pool.execute(
            `UPDATE checkins SET checkout_time = datetime('now'), status = 'checked_out' WHERE id = ?`,
            [activeCheckins[0].id]
        );

        res.json({ success: true, message: 'Checked out successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Checkout failed' });
    }
});

router.get('/history', authenticateToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let query = `
            SELECT ch.*, c.name as client_name, c.address as client_address
            FROM checkins ch
            INNER JOIN clients c ON ch.client_id = c.id
            WHERE ch.employee_id = ?
        `;
        const params = [req.user.id];

        if (start_date) {
            query += ` AND DATE(ch.checkin_time) >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            query += ` AND DATE(ch.checkin_time) <= ?`;
            params.push(end_date);
        }

        query += ' ORDER BY ch.checkin_time DESC';

        const [checkins] = await pool.execute(query, params);

        res.json({ success: true, data: checkins });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
});

// Get current active check-in
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const [checkins] = await pool.execute(
            `SELECT ch.*, c.name as client_name 
             FROM checkins ch
             INNER JOIN clients c ON ch.client_id = c.id
             WHERE ch.employee_id = ? AND ch.status = 'checked_in'
             ORDER BY ch.checkin_time DESC LIMIT 1`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: checkins.length > 0 ? checkins[0] : null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch active check-in' });
    }
});

module.exports = router;
