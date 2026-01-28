import { useState, useEffect } from 'react';
import api from '../utils/api';

function Reports({ user }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch employees for the filter dropdown
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (date) {
            fetchReport();
        }
    }, [date, selectedEmployee]);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/dashboard/stats');
            if (response.data.success && response.data.data.recentActivity) {
                // Extract unique employees from recent activity
                const uniqueEmployees = [...new Map(
                    response.data.data.recentActivity.map(a => [a.employee_id, { id: a.employee_id, name: a.employee_name }])
                ).values()];
                setEmployees(uniqueEmployees);
            }
        } catch (err) {
            // Silent fail - employees dropdown will be empty
        }
    };

    const fetchReport = async () => {
        setLoading(true);
        setError('');
        try {
            let url = `/reports/daily-summary?date=${date}`;
            if (selectedEmployee) {
                url += `&employee_id=${selectedEmployee}`;
            }
            const response = await api.get(url);
            if (response.data.success) {
                setReport(response.data.data);
            } else {
                setError(response.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch report');
        } finally {
            setLoading(false);
        }
    };

    // Only managers can access this page
    if (user?.role !== 'manager') {
        return (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                Access denied. This page is for managers only.
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Daily Summary Report</h2>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">
                            Select Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 text-sm font-medium mb-2">
                            Filter by Employee (Optional)
                        </label>
                        <select
                            value={selectedEmployee}
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Employees</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {loading && (
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {!loading && report && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4 text-center">
                            <p className="text-sm text-gray-500">Total Employees</p>
                            <p className="text-2xl font-bold text-blue-600">{report.summary.total_employees}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 text-center">
                            <p className="text-sm text-gray-500">Active Today</p>
                            <p className="text-2xl font-bold text-green-600">{report.summary.active_employees}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 text-center">
                            <p className="text-sm text-gray-500">Total Check-ins</p>
                            <p className="text-2xl font-bold text-purple-600">{report.summary.total_checkins}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 text-center">
                            <p className="text-sm text-gray-500">Avg Hours</p>
                            <p className="text-2xl font-bold text-orange-600">{report.summary.average_working_hours}</p>
                        </div>
                    </div>

                    {/* Employee Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Check-ins</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Hours Worked</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Clients Visited</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.employees.length > 0 ? (
                                    report.employees.map((emp) => (
                                        <tr key={emp.employee_id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium">{emp.employee_name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs ${emp.total_checkins > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {emp.total_checkins}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">{emp.working_hours}h</td>
                                            <td className="px-4 py-3 text-center">{emp.unique_clients}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                            No employee data for this date
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

export default Reports;
