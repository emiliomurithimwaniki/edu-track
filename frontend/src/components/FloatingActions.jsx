import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function FloatingActions(){
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef(null)
  const rootRef = useRef(null)
  const { pathname } = useLocation()
  const isMessages = typeof pathname === 'string' && pathname.includes('/messages')

  const resetTimer = () => {
    if (!expanded) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExpanded(false), 6000)
  }

  useEffect(() => {
    const onActivity = () => { if (expanded) resetTimer() }
    const events = ['mousemove','mousedown','keydown','touchstart','scroll']
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    return () => { events.forEach(ev => window.removeEventListener(ev, onActivity)) }
  }, [expanded])

  useEffect(() => {
    if (expanded) resetTimer()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [expanded])

  const toggle = () => {
    if (expanded) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setExpanded(false)
    } else {
      resetTimer()
    }
  }

  // Staggered reveal for actions inside the root container on expand
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.children || [])
    items.forEach((el, i) => {
      try {
        el.style.transition = 'opacity 220ms ease, transform 220ms ease'
        el.style.willChange = 'opacity, transform'
        if (!expanded) {
          el.style.opacity = '0'
          el.style.transform = 'translateY(6px) scale(0.98)'
          el.style.transitionDelay = `${Math.max(0, (items.length-1-i)*30)}ms`
        } else {
          el.style.opacity = '0'
          el.style.transform = 'translateY(6px) scale(0.98)'
          el.style.transitionDelay = `${i*40}ms`
          requestAnimationFrame(() => {
            el.style.opacity = '1'
            el.style.transform = 'translateY(0) scale(1)'
          })
        }
      } catch {}
    })
  }, [expanded])

  return (
    <div
      style={{
        position: 'fixed',
        right: expanded ? 18 : -20,
        bottom: `calc(${isMessages ? (expanded ? 210 : 188) : (expanded ? 56 : 20)}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? 12 : 6,
        pointerEvents: 'none',
        transition: 'right 200ms ease, bottom 200ms ease, gap 200ms ease',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => resetTimer()}
    >
      <div
        style={{
          padding: expanded ? 2 : 1,
          borderRadius: 9999,
          background: expanded
            ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(236,72,153,0.35))'
            : 'transparent',
          boxShadow: expanded ? '0 14px 40px rgba(0,0,0,0.18)' : 'none',
          transform: expanded ? 'translateY(0)' : 'translateY(2px)',
          transition: 'all 250ms ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: expanded ? 'inline-flex' : 'none',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'saturate(160%) blur(8px)',
            WebkitBackdropFilter: 'saturate(160%) blur(8px)',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.6)',
            padding: '8px 12px',
            maxWidth: 420,
            opacity: 1,
            transition: 'all 280ms ease',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          <div
            id="floating-actions-root"
            ref={rootRef}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}
          />
        </div>
      </div>

      <div
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 9999,
          background: expanded ? 'rgba(0,0,0,0.18)' : 'transparent',
          transform: expanded ? 'scale(1)' : 'scale(0.6)',
          opacity: expanded ? 0.3 : 0,
          transition: 'all 200ms ease',
          pointerEvents: 'none',
        }}
      />

      <button
        onClick={toggle}
        aria-label={expanded ? 'Collapse actions' : 'Expand actions'}
        style={{
          width: 40,
          height: 40,
          borderRadius: 9999,
          border: 'none',
          background: expanded
            ? 'linear-gradient(135deg, #111827, #1f2937)'
            : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: 'white',
          boxShadow: expanded
            ? '0 6px 14px rgba(17,24,39,0.25)'
            : '0 6px 14px rgba(37,99,235,0.35)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          pointerEvents: 'auto',
          transform: expanded ? 'translateX(0)' : 'translateX(2px)',
          transition: 'background-color 200ms ease, box-shadow 200ms ease, transform 150ms ease, filter 150ms ease',
          filter: expanded ? 'none' : 'drop-shadow(0 2px 8px rgba(37,99,235,0.35))',
        }}
        onMouseDown={(e)=>{ e.currentTarget.style.transform = 'scale(0.98)'}}
        onMouseUp={(e)=>{ e.currentTarget.style.transform = 'scale(1)'}}
      >
        {expanded ? (
          <span style={{ fontSize: 16 }}>&ndash;</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </button>
    </div>
  )
}
