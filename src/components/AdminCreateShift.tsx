import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Day } from '../types';

export function AdminCreateShift({ days }: { days: Day[] }) {
  const [dayId, setDayId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [disableSelfSignup, setDisableSelfSignup] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayId || !name || !startTime || !endTime) return;
    
    await addDoc(collection(db, 'shifts'), {
      dayId,
      name,
      startTime,
      endTime,
      disableSelfSignup
    });
    
    setDayId('');
    setName('');
    setStartTime('');
    setEndTime('');
    setDisableSelfSignup(false);
  };

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-bold text-slate-800 mb-4">2. Opret Vagt</h3>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Vælg Dato</label>
          <select 
            value={dayId} 
            onChange={e => setDayId(e.target.value)}
            className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">-- Vælg --</option>
            {days.map(d => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Vagtnavn (f.eks. Morgen, Eftermiddag)</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Start tid</label>
            <input 
              type="time" 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Slut tid</label>
            <input 
              type="time" 
              value={endTime} 
              onChange={e => setEndTime(e.target.value)}
              className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={disableSelfSignup} 
              onChange={e => setDisableSelfSignup(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">Deaktiver selv-tilmelding på denne vagt</span>
          </label>
        </div>

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors text-sm">
          Tilføj Vagt
        </button>
      </form>
    </div>
  );
}
