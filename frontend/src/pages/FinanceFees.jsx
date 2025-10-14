import React from 'react'
import FinanceLayout from '../components/FinanceLayout'
import AdminFees from './AdminFees'

export default function FinanceFees(){
  return (
    <FinanceLayout>
      <AdminFees embed initialTab="payments" />
    </FinanceLayout>
  )
}
