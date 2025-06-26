import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import './calendar.css'

function isSameDay(a, b) {
  return (
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function DateCalendar({ date, setDate }) {
  // Get today
  const today = new Date()

  // Add custom class names for selected and today
  const modifiers = {
    selected: date,
    today: today,
  }
  const modifiersClassNames = {
    selected: 'calendar-selected',
    today: 'calendar-today',
  }

  return (
    <div className="flex flex-col gap-4">
      <DayPicker
        mode="single"
        selected={date}
        onSelect={setDate}
        captionLayout="dropdown"
        defaultMonth={date}
        className="custom-calendar shadow-lg"
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
      />
    </div>
  )
} 