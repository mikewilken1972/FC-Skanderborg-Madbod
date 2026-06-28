import { Day, Shift, Event, Task } from '../types';
import { Clock } from 'lucide-react';

interface PrintViewProps {
  printData: { type: 'day' | 'shift'; id: string; tasks: Task[] };
  days: Day[];
  shifts: Shift[];
  events: Event[];
}

export function PrintView({ printData, days, shifts, events }: PrintViewProps) {
  if (printData.type === 'day') {
    const day = days.find(d => d.id === printData.id);
    if (!day) return null;

    const event = events.find(e => e.id === day.eventId);
    const dayShifts = shifts.filter(s => s.dayId === day.id);

    return (
      <div className="bg-white text-black p-8 min-h-screen">
        <div className="mb-8 border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold mb-2">Vagtplan</h1>
          <h2 className="text-xl font-semibold capitalize">
            {new Date(day.date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h2>
          {event && <p className="text-lg text-gray-700 mt-1">Arrangement: {event.name}</p>}
        </div>

        <div className="space-y-10">
          {dayShifts.map(shift => {
            const shiftTasks = printData.tasks.filter(t => t.shiftId === shift.id);
            return (
              <div key={shift.id} className="break-inside-avoid shadow-none border border-gray-300 rounded-xl p-4">
                <div className="border-b border-gray-200 pb-2 mb-4">
                  <h3 className="text-xl font-bold">{shift.name}</h3>
                  <div className="flex items-center gap-1.5 text-gray-600 mt-1 font-medium">
                    <Clock className="w-4 h-4" />
                    {shift.startTime} - {shift.endTime}
                  </div>
                </div>

                {shiftTasks.length === 0 ? (
                  <p className="text-gray-500 italic">Ingen opgaver for denne vagt.</p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-2 font-bold w-1/3">Opgave</th>
                        <th className="border p-2 font-bold w-1/3">Tildelt til</th>
                        <th className="border p-2 font-bold w-1/3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftTasks.map(task => (
                        <tr key={task.id} className="border-b border-gray-200 break-inside-avoid">
                          <td className="border p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{task.title}</span>
                              {(task.startTime || task.endTime) && (
                                <span className="text-xs bg-gray-100 px-1 border border-gray-300 rounded font-medium whitespace-nowrap">
                                  {task.startTime || '?'} {task.endTime && `- ${task.endTime}`}
                                </span>
                              )}
                            </div>
                            {task.description && <div className="text-sm text-gray-600 mt-1">{task.description}</div>}
                          </td>
                          <td className="border p-2 font-medium">{task.assignedTo || '-'}</td>
                          <td className="border p-2 capitalize">{task.status || 'ledig'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Print single shift
  const shift = shifts.find(s => s.id === printData.id);
  if (!shift) return null;

  const day = days.find(d => d.id === shift.dayId);
  const event = day ? events.find(e => e.id === day.eventId) : null;
  const shiftTasks = printData.tasks.filter(t => t.shiftId === shift.id);

  return (
    <div className="bg-white text-black p-8 min-h-screen">
      <div className="mb-8 border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold mb-2">Vagtseddel: {shift.name}</h1>
        <div className="text-lg text-gray-700 flex flex-col gap-1">
          {day && (
            <p className="capitalize text-xl font-semibold text-black">
              {new Date(day.date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <div className="flex items-center gap-1.5 font-bold">
            <Clock className="w-5 h-5" />
            {shift.startTime} - {shift.endTime}
          </div>
          {event && <p className="mt-2">Arrangement: {event.name}</p>}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Opgaver ({shiftTasks.length})</h2>
        {shiftTasks.length === 0 ? (
          <p className="text-gray-500 italic">Ingen opgaver for denne vagt.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border-2 border-gray-300 p-3 font-bold w-1/3">Opgave & Beskrivelse</th>
                <th className="border-2 border-gray-300 p-3 font-bold w-1/3">Tildelt til / Ansvarlig</th>
                <th className="border-2 border-gray-300 p-3 font-bold w-1/3">Bemærkninger / Signatur</th>
              </tr>
            </thead>
            <tbody>
              {shiftTasks.map(task => (
                <tr key={task.id} className="border-b-2 border-gray-300 break-inside-avoid">
                  <td className="border-2 border-gray-300 p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{task.title}</span>
                      {(task.startTime || task.endTime) && (
                        <span className="text-sm bg-gray-100 px-1 border border-gray-300 rounded font-medium whitespace-nowrap">
                          {task.startTime || '?'} {task.endTime && `- ${task.endTime}`}
                        </span>
                      )}
                    </div>
                    {task.description && <div className="text-gray-700 mt-2">{task.description}</div>}
                  </td>
                  <td className="border-2 border-gray-300 p-4 font-medium text-lg">
                    {task.assignedTo || '________________________'}
                  </td>
                  <td className="border-2 border-gray-300 p-4">
                    {/* Empty space for signature / comments */}
                    <div className="h-12 w-full"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
