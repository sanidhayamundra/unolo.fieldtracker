const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

// Validate YYYY-MM-DD date format
function isValidDateFormat(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

// GET /api/reports/daily-summary
router.get('/daily-summary', authenticateToken, requireManager, async (req, res) => {
    try {
        const { date, employee_id } = req.query;

        // Validate date is required and in correct format
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required (format: YYYY-MM-DD)'
            });
        }

        if (!isValidDateFormat(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // If employee_id is provided, validate it's a number and belongs to this manager
        if (employee_id) {
            const empId = parseInt(employee_id, 10);
            if (isNaN(empId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid employee_id'
                });
            }

            const [employees] = await pool.execute(
                'SELECT id FROM users WHERE id = ? AND manager_id = ?',
                [empId, req.user.id]
            );

            if (employees.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Employee not found or not under your management'
                });
            }
        }

        // Build the query - single efficient query with LEFT JOIN
        let sql = `
            SELECT 
                u.id as employee_id,
                u.name as employee_name,
                COUNT(c.id) as total_checkins,
                COALESCE(SUM(
                    CASE 
                        WHEN c.checkout_time IS NOT NULL 
                        THEN (julianday(c.checkout_time) - julianday(c.checkin_time)) * 24
                        ELSE 0
                    END
                ), 0) as working_hours,
                COUNT(DISTINCT c.client_id) as unique_clients
            FROM users u
            LEFT JOIN checkins c ON u.id = c.employee_id 
                AND DATE(c.checkin_time) = ?
            WHERE u.manager_id = ?
        `;

        const params = [date, req.user.id];

        if (employee_id) {
            sql += ` AND u.id = ?`;
            params.push(parseInt(employee_id, 10));
        }

        sql += ` GROUP BY u.id, u.name ORDER BY u.name`;

        const [employeeStats] = await pool.execute(sql, params);

        // Calculate team-level summary
        const activeEmployees = employeeStats.filter(e => e.total_checkins > 0).length;
        const totalCheckins = employeeStats.reduce((sum, e) => sum + e.total_checkins, 0);
        const totalHours = employeeStats.reduce((sum, e) => sum + e.working_hours, 0);
        const avgHours = activeEmployees > 0 ? totalHours / activeEmployees : 0;

        // Format response
        const employees = employeeStats.map(e => ({
            employee_id: e.employee_id,
            employee_name: e.employee_name,
            total_checkins: e.total_checkins,
            working_hours: Math.round(e.working_hours * 100) / 100,
            unique_clients: e.unique_clients
        }));

        res.json({
            success: true,
            data: {
                date: date,
                employees: employees,
                summary: {
                    total_employees: employeeStats.length,
                    active_employees: activeEmployees,
                    total_checkins: totalCheckins,
                    average_working_hours: Math.round(avgHours * 100) / 100
                }
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
});

module.exports = router;
