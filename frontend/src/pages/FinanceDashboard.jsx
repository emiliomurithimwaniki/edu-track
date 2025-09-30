import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function FinanceDashboard(){
  const [invoices, setInvoices] = useState([])
  useEffect(()=>{ api.get('/finance/invoices/').then(res=>setInvoices(res.data)) },[])
  const paid = invoices.filter(i=>i.status==='paid').length
  const unpaid = invoices.filter(i=>i.status!=='paid').length
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Finance Dashboard</h1>
        <Link to="/finance/messages" className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm">Messages</Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded shadow p-4">
          <div className="text-sm text-gray-500">Paid Invoices</div>
          <div className="text-2xl font-semibold">{paid}</div>
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="text-sm text-gray-500">Unpaid/Partial</div>
          <div className="text-2xl font-semibold">{unpaid}</div>
        </div>
      </div>
      <div className="bg-white rounded shadow p-4">
        <h2 className="font-medium mb-2">Recent Invoices</h2>
        <table className="w-full text-left text-sm">
          <thead><tr><th>ID</th><th>Student</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.slice(0,10).map(i=> (
              <tr key={i.id} className="border-t"><td>{i.id}</td><td>{i.student}</td><td>KES {i.amount}</td><td className="capitalize">{i.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
