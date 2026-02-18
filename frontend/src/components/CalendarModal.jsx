import React, { useState } from "react";

export default function CalendarModal({ open, onClose }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [task, setTask] = useState("");
  const [reminder, setReminder] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <span className="text-lg">×</span>
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Calendar & Tasks</h2>
        <input
          type="date"
          className="w-full mb-4 p-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white"
          value={selectedDate.toISOString().slice(0, 10)}
          onChange={e => setSelectedDate(new Date(e.target.value))}
        />
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Add Task</label>
          <input
            type="text"
            className="w-full p-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white"
            value={task}
            onChange={e => setTask(e.target.value)}
            placeholder="Task details..."
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Set Reminder</label>
          <input
            type="time"
            className="w-full p-2 rounded border border-gray-300 dark:bg-gray-800 dark:text-white"
            value={reminder}
            onChange={e => setReminder(e.target.value)}
          />
        </div>
        <button
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
          onClick={() => {
            // Save task/reminder logic here
            alert(`Task: ${task}\nDate: ${selectedDate.toLocaleDateString()}\nReminder: ${reminder}`);
            setTask("");
            setReminder("");
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
