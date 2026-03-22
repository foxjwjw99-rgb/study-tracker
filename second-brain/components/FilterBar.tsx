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
  { value: 'week', label: '本週' },
  { value: 'month', label: '本月' },
]

export default function FilterBar({
  selectedType,
  selectedDate,
  onTypeChange,
  onDateChange,
}: FilterBarProps) {
  return (
    <div className="px-6 py-3 bg-white border-t border-slate-200 flex gap-6">
      {/* Type Filter */}
      <div className="flex gap-2">
        {TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => onTypeChange(type.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedType === type.value
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Date Filter */}
      <div className="flex gap-2">
        {DATES.map((date) => (
          <button
            key={date.value}
            onClick={() => onDateChange(date.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedDate === date.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {date.label}
          </button>
        ))}
      </div>
    </div>
  )
}
