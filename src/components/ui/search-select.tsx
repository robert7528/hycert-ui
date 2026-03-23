'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn, Input } from '@hysp/ui-kit'
import { Search, X, ChevronDown } from 'lucide-react'

export interface SearchSelectOption {
  value: string
  label: string
  description?: string
}

interface SearchSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  emptyLabel?: string
  clearable?: boolean
  className?: string
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  emptyLabel = '—',
  clearable = true,
  className,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : options

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]')
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setQuery('')
    setHighlightIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const handleSelect = useCallback((val: string) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleOpen()
      }
      return
    }

    const total = filtered.length + (clearable ? 1 : 0) // +1 for empty option
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => (i + 1) % total)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => (i - 1 + total) % total)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIdx === 0 && clearable) {
          handleSelect('')
        } else {
          const idx = clearable ? highlightIdx - 1 : highlightIdx
          if (idx >= 0 && idx < filtered.length) {
            handleSelect(filtered[idx].value)
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setQuery('')
        break
    }
  }, [open, filtered, highlightIdx, clearable, handleOpen, handleSelect])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Display button */}
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !selectedOption && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : emptyLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      )}

      {/* Search input (shown when open) */}
      {open && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlightIdx(-1) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-8 py-1 text-sm shadow-sm',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          />
          {(query || value) && (
            <button
              type="button"
              onClick={() => { handleSelect(''); setQuery('') }}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-[240px] overflow-auto rounded-md border bg-popover shadow-md"
        >
          {clearable && (
            <div
              data-item
              onClick={() => handleSelect('')}
              className={cn(
                'px-3 py-1.5 text-sm cursor-pointer text-muted-foreground',
                highlightIdx === 0 && 'bg-accent text-accent-foreground',
              )}
            >
              {emptyLabel}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center text-muted-foreground">
              No results
            </div>
          ) : (
            filtered.map((opt, i) => {
              const idx = clearable ? i + 1 : i
              return (
                <div
                  key={opt.value}
                  data-item
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'px-3 py-1.5 text-sm cursor-pointer',
                    highlightIdx === idx && 'bg-accent text-accent-foreground',
                    opt.value === value && 'font-medium',
                  )}
                >
                  <div className="truncate">{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-muted-foreground truncate">{opt.description}</div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
