import React from 'react'
import { useLocation } from 'react-router-dom'
import { useAssistant } from './AssistantContext'

export default function FloatingButton(){
  const { togglePanel } = useAssistant()
  const { pathname } = useLocation()
  const isMessages = typeof pathname === 'string' && pathname.includes('/messages')
  // Lift button on messages page to avoid covering the chat composer
  const bottomOffset = isMessages ? 88 : 20
  const rightOffset = 20
  return (
    <button
      onClick={togglePanel}
      aria-label="Open assistant"
      style={{
        position: 'fixed',
        right: `${rightOffset}px`,
        bottom: `${bottomOffset}px`,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        border: 'none',
        background: '#2563eb',
        color: 'white',
        boxShadow: '0 10px 15px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        zIndex: 1000,
        fontSize: '22px',
      }}
    >
      ✨
    </button>
  )
}
