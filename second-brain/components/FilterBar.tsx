'use client'

interface FilterBarProps {
  selectedType: string
  selectedDate: string
  onTypeChange: (type: string) => void
  onDateChange: (date: string) => void
}

const TYPES = [
  { value: 'all', label: '全部' },
  { value: 'memory', label: '記憶' },
  { value: 'note', label: '筆記' },
  { value: 'conversation', label: '對話' },
  { value: 'thought', label: '想法' },
]

const DATES = [
  { value: 'all', label: '所有時間' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '近 7 天' },
  { value: 'month', label: '近 30 天' },
]

function FilterGroup({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={[
              'rounded-full px-3.5 py-2 text-sm font-medium transition',
              active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterBar({
  selectedType,
  selectedDate,
  onTypeChange,
  onDateChange,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          類型
        </p>
        <FilterGroup items={TYPES} value={selectedType} onChange={onTypeChange} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          日期
        </p>
        <FilterGroup items={DATES} value={selectedDate} onChange={onDateChange} />
      </div>
    </div>
  )
}
