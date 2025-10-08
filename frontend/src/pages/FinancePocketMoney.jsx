import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function FinancePocketMoney() {
    const navigate = useNavigate();
    const [wallets, setWallets] = useState([]);
    const [students, setStudents] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedWallet, setSelectedWallet] = useState(null);
    const [transactionType, setTransactionType] = useState('deposit');
    const [formData, setFormData] = useState({ amount: '', description: '' });
    // New: allow selecting student when opening a global transaction form
    const [studentQuery, setStudentQuery] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const todayLabel = new Date().toLocaleDateString();

    // Filters and pagination for transactions list
    const [filterStudentId, setFilterStudentId] = useState(''); // '' means all
    const [filterType, setFilterType] = useState(''); // '', 'deposit', 'withdrawal'
    const [dateFrom, setDateFrom] = useState(''); // YYYY-MM-DD
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Wallet modal state
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const [walletModalWallet, setWalletModalWallet] = useState(null);
    const [walletModalStudent, setWalletModalStudent] = useState(null);
    const [walletModalTx, setWalletModalTx] = useState([]);
    const [walletModalLoading, setWalletModalLoading] = useState(false);

    // Search modal state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [walletRes, studentRes] = await Promise.all([
                    api.get('/finance/pocket-money-wallets/'),
                    api.get('/academics/students/?page_size=10000'),
                ]);
                setWallets(walletRes.data);
                // Support both paginated and non-paginated responses
                const studentsPayload = Array.isArray(studentRes.data) ? studentRes.data : (studentRes.data?.results || []);
                setStudents(studentsPayload);
                // Initial transactions load
                await fetchTransactions(1, pageSize, filterStudentId, filterType, dateFrom, dateTo, walletRes.data, studentsPayload);
            } catch (e) {
                console.error("Failed to load data:", e);
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When filters or pagination change, reload transactions
    useEffect(() => {
        fetchTransactions(page, pageSize, filterStudentId, filterType, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, filterStudentId, filterType, dateFrom, dateTo]);

    const buildTxQuery = (p, ps, studentId, type) => {
        const params = new URLSearchParams();
        if (p) params.set('page', String(p));
        if (ps) params.set('page_size', String(ps));
        // Prefer backend ordering if available
        params.set('ordering', '-created_at');
        if (type) params.set('transaction_type', type);
        if (studentId) {
            // One wallet per student; map to wallet id if available
            const w = wallets.find(x => x.student === Number(studentId));
            if (w) params.set('wallet', String(w.id));
        }
        return params.toString();
    };

    // Export current (filtered) transactions to CSV
    const handleExportCsv = () => {
        try {
            const headers = ['Date','Student','Admission No','Type','Amount','Description'];
            const rows = [headers];
            for (const tx of transactions) {
                const wallet = wallets.find(w => w.id === tx.wallet);
                const s = wallet ? students.find(st => st.id === wallet.student) : null;
                rows.push([
                    new Date(tx.created_at).toLocaleString(),
                    s ? s.name : '',
                    s ? (s.admission_no || '') : '',
                    tx.transaction_type,
                    String(tx.amount),
                    (tx.description || '').replaceAll('\n',' ').replaceAll('\r',' '),
                ]);
            }
            const csv = rows.map(r => r.map(v => {
                const val = String(v ?? '');
                // Escape double quotes and wrap if needed
                const needsWrap = /[",\n]/.test(val);
                const escaped = val.replaceAll('"','""');
                return needsWrap ? `"${escaped}"` : escaped;
            }).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const d = new Date();
            const pad = (n) => String(n).padStart(2,'0');
            a.download = `pocket_transactions_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
            a.href = url;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    // Open wallet modal for a given wallet
    const openWalletModal = async (wallet) => {
        try {
            const student = students.find(st => st.id === wallet.student);
            setWalletModalStudent(student || null);
            setWalletModalWallet(wallet);
            setWalletModalOpen(true);
            setWalletModalLoading(true);
            const res = await api.get(`/finance/pocket-money-transactions/?wallet=${wallet.id}&page_size=50&ordering=-created_at`);
            const payload = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            payload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            setWalletModalTx(payload);
        } catch (e) {
            console.error('Failed to load wallet transactions:', e);
        } finally {
            setWalletModalLoading(false);
        }
    };

    const closeWalletModal = () => {
        setWalletModalOpen(false);
        setWalletModalWallet(null);
        setWalletModalStudent(null);
        setWalletModalTx([]);
    };

    const applyClientDateFilter = (items) => {
        if (!dateFrom && !dateTo) return items;
        const fromTs = dateFrom ? Date.parse(dateFrom + 'T00:00:00') : null;
        const toTs = dateTo ? Date.parse(dateTo + 'T23:59:59') : null;
        return items.filter(tx => {
            const t = Date.parse(tx.created_at);
            if (fromTs && t < fromTs) return false;
            if (toTs && t > toTs) return false;
            return true;
        });
    };

    const fetchTransactions = async (p = 1, ps = 20, studentId = '', type = '', from = '', to = '', ws = null, sts = null) => {
        try {
            const query = buildTxQuery(p, ps, studentId, type);
            const res = await api.get(`/finance/pocket-money-transactions/?${query}`);
            const payload = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            // DRF count for pagination if present
            setTotalCount(typeof res.data?.count === 'number' ? res.data.count : payload.length);
            // Sort newest first (client fallback)
            payload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const filtered = applyClientDateFilter(payload);
            setTransactions(filtered);
        } catch (e) {
            console.error('Failed to fetch transactions:', e);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Resolve wallet either from a selected row or from selected student
            let walletId = selectedWallet?.id;
            if (!walletId) {
                let w = wallets.find(w => w.student === selectedStudentId);
                if (!w) {
                    // Try to auto-create wallet then reload
                    try {
                        await api.post('/finance/pocket-money-wallets/', { student: selectedStudentId, balance: 0 });
                        const refresh = await api.get('/finance/pocket-money-wallets/');
                        setWallets(refresh.data);
                        w = refresh.data.find(x => x.student === selectedStudentId);
                    } catch (err) {
                        console.error('Failed to auto-create wallet:', err);
                    }
                }
                if (!w) {
                    alert('No wallet found for the selected student.');
                    return;
                }
                walletId = w.id;
            }

            if (!formData.amount || Number(formData.amount) <= 0) {
                alert('Enter a valid amount greater than 0');
                return;
            }

            await api.post('/finance/pocket-money-transactions/', {
                wallet: walletId,
                transaction_type: transactionType,
                ...formData,
            });
            // Refresh wallets to show updated balance
            const [resWallets, resTx] = await Promise.all([
                api.get('/finance/pocket-money-wallets/'),
                api.get(`/finance/pocket-money-transactions/?${buildTxQuery(page, pageSize, filterStudentId, filterType)}`),
            ]);
            setWallets(resWallets.data);
            const txPayload2 = Array.isArray(resTx.data) ? resTx.data : (resTx.data?.results || []);
            txPayload2.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            const filtered = applyClientDateFilter(txPayload2);
            setTransactions(filtered);
            // If wallet modal is open, refresh its balance and transactions
            if (walletModalOpen && walletModalWallet) {
                const updatedWallet = resWallets.data.find(w => w.id === walletId);
                if (updatedWallet) {
                    setWalletModalWallet(updatedWallet);
                }
                try {
                    const modalRes = await api.get(`/finance/pocket-money-transactions/?wallet=${walletId}&page_size=50&ordering=-created_at`);
                    const modalPayload = Array.isArray(modalRes.data) ? modalRes.data : (modalRes.data?.results || []);
                    modalPayload.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                    setWalletModalTx(modalPayload);
                } catch (e) {
                    // ignore modal refresh error
                }
            }
            setShowForm(false);
            setSelectedWallet(null);
            setFormData({ amount: '', description: '' });
            setSelectedStudentId(null);
            setStudentQuery('');
        } catch (error) {
            console.error("Failed to create transaction:", error);
        }
    };

    const openTransactionForm = (wallet, type) => {
        setSelectedWallet(wallet);
        setTransactionType(type);
        // If opened from a specific wallet row, lock to that student; otherwise require selection
        if (wallet) {
            setSelectedStudentId(wallet.student);
        } else {
            setSelectedStudentId(null);
        }
        setShowForm(true);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Pocket Money</h1>

            {/* Top-level quick actions */}
            <div className="flex gap-3">
                <button onClick={() => openTransactionForm(null, 'deposit')} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">
                    Deposit
                </button>
                <button onClick={() => openTransactionForm(null, 'withdrawal')} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">
                    Withdraw
                </button>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={async () => {
                        setSearchOpen(true);
                        // If students not loaded yet, fetch
                        if (!students || students.length === 0) {
                            try {
                                setSearchLoading(true);
                                const res = await api.get('/academics/students/?page_size=10000');
                                const payload = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                                setStudents(payload);
                            } catch (e) { console.error('Failed to load students', e); }
                            finally { setSearchLoading(false); }
                        }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                    Search Student
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {transactionType === 'deposit' ? 'New Deposit' : 'New Withdrawal'}
                        {(() => {
                            const sid = selectedWallet ? selectedWallet.student : selectedStudentId;
                            const s = students.find(st => st.id === sid);
                            return s ? ` for ${s.name} (${s.admission_no})` : '';
                        })()}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Student selection (only when not launched from a specific wallet) */}
                        {!selectedWallet && (
                            <div>
                                <label htmlFor="student" className="block text-sm font-medium text-gray-700">Student (search by Admission No. or Name)</label>
                                <input
                                    type="text"
                                    id="student"
                                    placeholder="Type to search..."
                                    value={studentQuery}
                                    onChange={(e) => setStudentQuery(e.target.value)}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                <div className="mt-2 max-h-40 overflow-auto border border-gray-200 rounded-md divide-y">
                                    {students
                                        .filter(s => {
                                            const q = studentQuery.trim().toLowerCase();
                                            if (!q) return true;
                                            return (
                                                s.admission_no?.toLowerCase().includes(q) ||
                                                s.name?.toLowerCase().includes(q)
                                            );
                                        })
                                        .map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => { setSelectedStudentId(s.id); setStudentQuery(`${s.admission_no} - ${s.name}`); }}
                                                className={`w-full text-left px-3 py-2 text-sm ${selectedStudentId === s.id ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
                                            >
                                                {s.admission_no} - {s.name}
                                            </button>
                                        ))}
                                </div>
                                {selectedStudentId && (
                                    <p className="text-xs text-gray-500 mt-1">Selected student ID: {selectedStudentId}</p>
                                )}
                            </div>
                        )}

                        {/* Date display (backend uses created_at automatically) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <input value={todayLabel} readOnly className="mt-1 block w-full bg-gray-50 border border-gray-200 rounded-md py-2 px-3 text-sm text-gray-700" />
                        </div>
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" id="amount" name="amount" value={formData.amount} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="3" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button type="button" onClick={() => { setShowForm(false); setSelectedWallet(null); }} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300">Cancel</button>
                            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Save</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-3 mb-4">
                    <div className="w-48">
                        <label className="block text-sm font-medium text-gray-700">Student</label>
                        <select value={filterStudentId} onChange={(e)=>{ setFilterStudentId(e.target.value); setPage(1); }} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm">
                            <option value="">All students</option>
                            {students.map(s => (
                                <option key={s.id} value={s.id}>{s.admission_no} - {s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-40">
                        <label className="block text-sm font-medium text-gray-700">Type</label>
                        <select value={filterType} onChange={(e)=>{ setFilterType(e.target.value); setPage(1); }} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3 text-sm">
                            <option value="">All</option>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">From</label>
                        <input type="date" value={dateFrom} onChange={(e)=>{ setDateFrom(e.target.value); setPage(1); }} className="mt-1 block border border-gray-300 rounded-md py-2 px-3 text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">To</label>
                        <input type="date" value={dateTo} onChange={(e)=>{ setDateTo(e.target.value); setPage(1); }} className="mt-1 block border border-gray-300 rounded-md py-2 px-3 text-sm" />
                    </div>
                    <div className="flex-1"></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Page size</label>
                        <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="mt-1 block border border-gray-300 rounded-md py-2 px-3 text-sm">
                            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                    <div>
                        <button type="button" onClick={handleExportCsv} className="mt-6 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">Export CSV</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Student</th>
                                <th scope="col" className="px-6 py-3">Type</th>
                                <th scope="col" className="px-6 py-3">Amount</th>
                                <th scope="col" className="px-6 py-3">Description</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map(tx => {
                                const wallet = wallets.find(w => w.id === tx.wallet);
                                const s = wallet ? students.find(st => st.id === wallet.student) : null;
                                return (
                                    <tr key={tx.id} className="bg-white border-b">
                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                            {s ? (
                                                <button type="button" onClick={() => navigate(`/finance/pocket-money/wallet/${wallet.student}`)} className="text-indigo-600 hover:underline">
                                                    {s.name} ({s.admission_no})
                                                </button>
                                            ) : '—'}
                                        </td>
                                        <td className="px-6 py-4 capitalize">{tx.transaction_type}</td>
                                        <td className="px-6 py-4">KES {Number(tx.amount).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-gray-600">{tx.description || ''}</td>
                                        <td className="px-6 py-4 flex gap-3">
                                            {s && (
                                                <>
                                                    <button onClick={() => openTransactionForm(wallet, 'deposit')} className="text-emerald-600 hover:underline">Deposit</button>
                                                    <button onClick={() => openTransactionForm(wallet, 'withdrawal')} className="text-rose-600 hover:underline">Withdraw</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {(!transactions || transactions.length === 0) && (
                                <tr>
                                    <td className="px-6 py-6 text-gray-500" colSpan={6}>No transactions yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination controls */}
                <div className="flex items-center justify-between mt-4 text-sm text-gray-700">
                    <div>
                        Showing page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))} ({totalCount} total)
                    </div>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={()=> setPage(p => Math.max(1, p-1))} className={`px-3 py-1 rounded border ${page<=1 ? 'text-gray-400 border-gray-200' : 'text-gray-800 border-gray-300 hover:bg-gray-50'}`}>Prev</button>
                        <button disabled={page >= Math.ceil(totalCount / pageSize)} onClick={()=> setPage(p => p+1)} className={`px-3 py-1 rounded border ${page >= Math.ceil(totalCount / pageSize) ? 'text-gray-400 border-gray-200' : 'text-gray-800 border-gray-300 hover:bg-gray-50'}`}>Next</button>
                    </div>
                </div>
            </div>
            {/* Wallet modal */}
            {walletModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e)=>{ if (e.key === 'Escape') closeWalletModal(); }} tabIndex={-1} aria-modal="true" role="dialog">
                    <div className="relative bg-white w-full max-w-2xl mx-4 rounded-2xl shadow-card border border-gray-200 p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Wallet Details</h3>
                                <p className="text-sm text-gray-600">{walletModalStudent ? `${walletModalStudent.name} (${walletModalStudent.admission_no})` : ''}</p>
{{ ... }}
            {searchOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e)=>{ if (e.key === 'Escape') setSearchOpen(false); }} tabIndex={-1} aria-modal="true" role="dialog">
                            <button onClick={closeWalletModal} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm text-gray-700">Current Balance</div>
                            <div className="text-lg font-semibold">KES {Number(walletModalWallet.balance).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-3 mb-4">
                            <button onClick={() => { setShowForm(true); setTransactionType('deposit'); setSelectedWallet(walletModalWallet); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">Deposit</button>
                            <button onClick={() => { setShowForm(true); setTransactionType('withdrawal'); setSelectedWallet(walletModalWallet); }} className="px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700">Withdraw</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2">Date</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Amount</th>
                                        <th className="px-4 py-2">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {walletModalLoading && (
                                        <tr><td colSpan={4} className="px-4 py-4 text-gray-500">Loading...</td></tr>
                                    )}
                                    {!walletModalLoading && walletModalTx.map(tx => (
                                        <tr key={tx.id} className="border-b">
                                            <td className="px-4 py-2 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                                            <td className="px-4 py-2 capitalize">{tx.transaction_type}</td>
                                            <td className="px-4 py-2">KES {Number(tx.amount).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-gray-600">{tx.description || ''}</td>
                                        </tr>
                                    ))}
                                    {!walletModalLoading && walletModalTx.length === 0 && (
                                        <tr><td colSpan={4} className="px-4 py-4 text-gray-500">No transactions</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
