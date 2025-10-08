import React, { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js';
import StatCard from '../components/StatCard';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

export default function FinanceDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        (async () => {
            try {
                const params = new URLSearchParams(dateRange).toString();
                const { data } = await api.get(`/finance/invoices/summary/?${params}`);
                setStats(data);
            } catch (e) {
                console.error("Failed to load finance summary:", e);
                setStats({ error: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [dateRange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (stats?.error) {
        return (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">
                Failed to load dashboard data. Please try refreshing the page.
            </div>
        );
    }

    const revenueData = {
        labels: stats?.revenueTrend?.map(d => d.month) || [],
        datasets: [
            {
                label: 'Revenue',
                data: stats?.revenueTrend?.map(d => d.amount) || [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
            },
        ],
    };

    const expensesData = {
        labels: stats?.expenseBreakdown?.map(d => d.category) || [],
        datasets: [
            {
                label: 'Expenses',
                data: stats?.expenseBreakdown?.map(d => d.amount) || [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                ],
            },
        ],
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
                <div className="flex items-center gap-4">
                    <input type="date" name="start" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    <input type="date" name="end" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={stats?.totalRevenue} icon="💰" accent="from-emerald-500 to-emerald-600" format={v => `KES ${v?.toLocaleString()}`} trend={stats?.trends?.totalRevenue} />
                <StatCard title="Outstanding Fees" value={stats?.outstandingFees} icon="⚠️" accent="from-rose-500 to-rose-600" format={v => `KES ${v?.toLocaleString()}`} trend={stats?.trends?.outstandingFees} />
                <StatCard title="Collection Rate" value={stats?.collectionRate} icon="📊" accent="from-sky-500 to-sky-600" format={v => `${v}%`} trend={stats?.trends?.collectionRate} />
                <StatCard title="Total Expenses" value={stats?.totalExpenses} icon="💸" accent="from-amber-500 to-orange-600" format={v => `KES ${v?.toLocaleString()}`} trend={stats?.trends?.totalExpenses} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Over Time</h2>
                    <Line data={revenueData} options={{ responsive: true }} />
                </div>
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h2>
                    <Bar data={expensesData} options={{ responsive: true, indexAxis: 'y' }} />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Transaction ID</th>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Type</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.recentTransactions?.map(t => (
                                <tr key={t.id} className="bg-white border-b">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{t.id}</td>
                                    <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">KES {t.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4 capitalize">{t.type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

