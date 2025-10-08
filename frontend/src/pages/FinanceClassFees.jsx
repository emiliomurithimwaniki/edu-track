import React, { useEffect, useState } from 'react';
import api from '../api';

export default function FinanceClassFees() {
    const [classFees, setClassFees] = useState([]);
    const [classes, setClasses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        klasses: [],
        fee_category: '',
        amount: '',
        year: new Date().getFullYear(),
        term: '',
        due_date: '',
    });

    useEffect(() => {
        (async () => {
            try {
                const [cfRes, clsRes, catRes] = await Promise.all([
                    api.get('/finance/class-fees/'),
                    api.get('/academics/classes/'),
                    api.get('/finance/fee-categories/'),
                ]);
                setClassFees(cfRes.data);
                setClasses(clsRes.data);
                setCategories(catRes.data);
            } catch (e) {
                console.error("Failed to load data:", e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/finance/class-fees/', formData);
            setClassFees(prev => [data, ...prev]);
            setShowForm(false);
            setFormData({
                klasses: [],
                fee_category: '',
                amount: '',
                year: new Date().getFullYear(),
                term: '',
                due_date: '',
            });
        } catch (error) {
            console.error("Failed to create class fee:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900">Class Fees</h1>
                <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 shadow-soft">Assign Fee to Class</button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">New Class Fee</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="klass" className="block text-sm font-medium text-gray-700">Class</label>
                            <select id="klasses" name="klasses" multiple value={formData.klasses} onChange={e => setFormData(prev => ({...prev, klasses: Array.from(e.target.selectedOptions, option => option.value)}))} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="fee_category" className="block text-sm font-medium text-gray-700">Fee Category</label>
                            <select id="fee_category" name="fee_category" value={formData.fee_category} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a category</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
                            <input type="number" id="year" name="year" value={formData.year} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="term" className="block text-sm font-medium text-gray-700">Term</label>
                            <select id="term" name="term" value={formData.term} onChange={handleInputChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="">Select a term</option>
                                <option value="1">Term 1</option>
                                <option value="2">Term 2</option>
                                <option value="3">Term 3</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">Due Date</label>
                            <input type="date" id="due_date" name="due_date" value={formData.due_date} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Assigned Class Fees</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Class</th>
                                <th scope="col" className="px-6 py-3">Fee Category</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Term</th>
                                <th scope="col" className="px-6 py-3">Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classFees.map(cf => (
                                <tr key={cf.id} className="bg-white border-b">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{classes.find(c => c.id === cf.klass)?.name}</td>
                                    <td className="px-6 py-4">{categories.find(c => c.id === cf.fee_category)?.name}</td>
                                    <td className="px-6 py-4">KES {cf.amount.toLocaleString()}</td>
                                    <td className="px-6 py-4">Term {cf.term}</td>
                                    <td className="px-6 py-4">{cf.year}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
