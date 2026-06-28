import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Day, Shift, Event } from '../types';
import { ShiftList } from './ShiftList';

export function PublicView() {
  const [events, setEvents] = useState<Event[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>(localStorage.getItem('publicSelectedEventId') || '');
  const [selectedDay, setSelectedDay] = useState<string | null>(localStorage.getItem('publicSelectedDay') || null);

  useEffect(() => {
    // Load events
    const qEvents = query(collection(db, 'events'));
    const unsubEvents = onSnapshot(qEvents, (snap) => {
      const loaded: Event[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Event));
      loaded.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setEvents(loaded);
    }, (error) => console.error(error));

    const qDays = query(collection(db, 'days'));
    const unsubDays = onSnapshot(qDays, (snap) => {
      const loaded: Day[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Day));
      loaded.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setDays(loaded);
    });

    const qShifts = query(collection(db, 'shifts'));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const loaded: Shift[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Shift));
      loaded.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      setShifts(loaded);
    });

    return () => {
      unsubEvents();
      unsubDays();
      unsubShifts();
    };
  }, []);

  useEffect(() => {
    if (events.length > 0) {
      if (!selectedEventId || !events.some(e => e.id === selectedEventId)) {
        setSelectedEventId(events[0].id);
      }
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      localStorage.setItem('publicSelectedEventId', selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedDay) {
      localStorage.setItem('publicSelectedDay', selectedDay);
    }
  }, [selectedDay]);

  useEffect(() => {
    if (selectedEventId || events.length === 0) {
      const eventDays = days.filter(d => !d.eventId || d.eventId === selectedEventId);
      setSelectedDay(currentDay => {
        if (eventDays.length > 0 && !eventDays.some(d => d.id === currentDay)) {
          return eventDays[0].id;
        } else if (eventDays.length === 0) {
          return null;
        }
        return currentDay;
      });
    }
  }, [selectedEventId, days, events.length]);

  const activeDaysShifts = shifts.filter(s => s.dayId === selectedDay);
  const activeEventDays = days.filter(d => !d.eventId || d.eventId === selectedEventId);

  return (
    <div className="space-y-6">
      {events.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <label className="block text-sm font-bold text-slate-800 mb-2">Vælg arrangement</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full md:w-auto min-w-[250px] border-slate-300 border rounded-xl px-4 py-2.5 text-slate-700 focus:ring-blue-500 focus:border-blue-500 font-medium"
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}

      {(selectedEventId || events.length === 0) && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 pb-2 overflow-x-auto">
          <h2 className="text-lg font-bold text-slate-800 mb-3 px-1">Vælg Dato</h2>
          <div className="flex gap-2 pb-2">
            {activeEventDays.length === 0 && <p className="text-slate-500 italic text-sm">Ingen dage oprettet endnu.</p>}
            {activeEventDays.map((day) => {
              const isSelected = selectedDay === day.id;
              const d = new Date(day.date);
              const formatted = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });

              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDay(day.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                    isSelected 
                      ? 'bg-yellow-400 text-blue-900 shadow-md ring-2 ring-yellow-400 ring-offset-2' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {formatted}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Vagter denne dag
          </h2>
          {activeDaysShifts.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-500">Ingen vagter på denne dag.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {activeDaysShifts.map(shift => (
                <ShiftList key={shift.id} shift={shift} isAdmin={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
