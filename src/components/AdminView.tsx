import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Day, Shift, Event, Task } from '../types';
import { ShiftList } from './ShiftList';
import { LogOut, Plus, ShieldCheck, Download, Printer, Upload, Trash2, Copy, Edit2 } from 'lucide-react';
import { AdminCreateShift } from './AdminCreateShift';
import { PrintView } from './PrintView';
import { parseCSV } from '../lib/utils';


const ADMIN_PIN = '1895';

export function AdminView() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('adminPinAuth') === 'true');
  
  // Auth state
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Data state
  const [events, setEvents] = useState<Event[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  
  const [selectedEventId, setSelectedEventId] = useState<string>(localStorage.getItem('selectedEventId') || '');
  const [selectedDay, setSelectedDay] = useState<string | null>(localStorage.getItem('adminSelectedDay') || null);
  const [newEventName, setNewEventName] = useState('');
  
  // Form states
  const [newDate, setNewDate] = useState('');

  // Print context
  const [printData, setPrintData] = useState<{type: 'day'|'shift', id: string, tasks: Task[]} | null>(null);

  // Import context
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDayId, setImportDayId] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;
    
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
    }, (error) => {
      console.error("Error fetching events:", error);
      alert("Fejl ved indlæsning af arrangementer: " + error.message);
    });

    // Load days
    const qDays = query(collection(db, 'days'));
    const unsubDays = onSnapshot(qDays, (snap) => {
      const loaded: Day[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Day));
      loaded.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setDays(loaded);
    }, (error) => {
      console.error("Error fetching days:", error);
      alert("Fejl ved indlæsning af dage: " + error.message);
    });

    // Load shifts
    const qShifts = query(collection(db, 'shifts'));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const loaded: Shift[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Shift));
      loaded.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      setShifts(loaded);
    }, (error) => {
      console.error("Error fetching shifts:", error);
      alert("Fejl ved indlæsning af vagter: " + error.message);
    });

    return () => {
      unsubEvents();
      unsubDays();
      unsubShifts();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (events.length > 0) {
      if (!selectedEventId || !events.some(e => e.id === selectedEventId)) {
        setSelectedEventId(events[0].id);
      }
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      localStorage.setItem('selectedEventId', selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedDay) {
      localStorage.setItem('adminSelectedDay', selectedDay);
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

  useEffect(() => {
    let timer: any;
    if (printData) {
      timer = setTimeout(() => {
        window.print();
        setPrintData(null);
      }, 500);
    }
    return () => clearTimeout(timer);
  }, [printData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem('adminPinAuth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Forkert PIN kode.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminPinAuth');
    setIsAuthenticated(false);
    setPin('');
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName) return;
    try {
      const docRef = await addDoc(collection(db, 'events'), {
        name: newEventName,
        createdAt: new Date().toISOString()
      });
      setNewEventName('');
      setSelectedEventId(docRef.id);
    } catch (err) {
      console.error(err);
      // Kunne ikke oprette arrangement
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Er du sikker på, at du vil slette dette arrangement og alt dets indhold?')) return;
    try {
      const eventDays = days.filter(d => d.eventId === eventId);
      const dayIds = eventDays.map(d => d.id);
      const eventShifts = shifts.filter(s => dayIds.includes(s.dayId));
      const shiftIds = eventShifts.map(s => s.id);
      
      const allTasksSnap = await getDocs(collection(db, 'tasks'));
      const tasksToDelete = allTasksSnap.docs.filter(doc => shiftIds.includes(doc.data().shiftId));
      
      for (const t of tasksToDelete) {
        await deleteDoc(doc(db, 'tasks', t.id));
      }
      for (const s of eventShifts) {
        await deleteDoc(doc(db, 'shifts', s.id));
      }
      for (const d of eventDays) {
        await deleteDoc(doc(db, 'days', d.id));
      }
      await deleteDoc(doc(db, 'events', eventId));
      
      if (selectedEventId === eventId) {
        setSelectedEventId(events.find(e => e.id !== eventId)?.id || '');
      }
    } catch (err) {
      console.error('Kunne ikke slette arrangement:', err);
    }
  };

  const handleCopyEvent = async (sourceEventId: string) => {
    const sourceEvent = events.find(e => e.id === sourceEventId);
    if (!sourceEvent) return;
    
    const newName = window.prompt(`Kopierer "${sourceEvent.name}". Indtast navn for det nye arrangement:`, `${sourceEvent.name} (Kopi)`);
    if (!newName) return;
    
    try {
      const eventRef = await addDoc(collection(db, 'events'), {
        name: newName,
        createdAt: new Date().toISOString()
      });
      const newEventId = eventRef.id;
      
      const sourceDays = days.filter(d => !d.eventId || d.eventId === sourceEventId);
      const allTasksSnap = await getDocs(collection(db, 'tasks'));
      const allTasks = allTasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      for (const srcDay of sourceDays) {
        const dayRef = await addDoc(collection(db, 'days'), {
          date: srcDay.date,
          eventId: newEventId
        });
        const dayShifts = shifts.filter(s => s.dayId === srcDay.id);
        
        for (const srcShift of dayShifts) {
          const shiftRef = await addDoc(collection(db, 'shifts'), {
            dayId: dayRef.id,
            name: srcShift.name,
            startTime: srcShift.startTime,
            endTime: srcShift.endTime,
            disableSelfSignup: srcShift.disableSelfSignup || false
          });
          const shiftTasks = allTasks.filter(t => t.shiftId === srcShift.id);
          
          for (const srcTask of shiftTasks) {
            await addDoc(collection(db, 'tasks'), {
              shiftId: shiftRef.id,
              title: srcTask.title,
              description: srcTask.description,
              maxHelpers: srcTask.maxHelpers ?? null,
              assignedTo: null,
              assignees: [],
              comments: [],
              status: 'ledig',
              startTime: srcTask.startTime || '',
              endTime: srcTask.endTime || ''
            });
          }
        }
      }
      setSelectedEventId(newEventId);
    } catch (err) {
      console.error('Kunne ikke kopiere arrangement:', err);
      alert('Der opstod en fejl ved kopiering af arrangement. Prøv igen.');
    }
  };

  const handleRenameEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const newName = window.prompt(`Indtast nyt navn for arrangementet:`, event.name);
    if (!newName || newName.trim() === event.name || newName.trim() === '') return;
    
    try {
      await updateDoc(doc(db, 'events', eventId), {
        name: newName.trim()
      });
    } catch (err) {
      console.error('Kunne ikke omdøbe arrangement:', err);
      alert('Der opstod en fejl ved omdøbning af arrangement. Prøv igen.');
    }
  };

  const handleCreateDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !selectedEventId) {
      return;
    }
    try {
      await addDoc(collection(db, 'days'), {
        date: newDate,
        eventId: selectedEventId
      });
      setNewDate('');
    } catch (err) {
      console.error(err);
      // Kunne ikke oprette dagen
    }
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!window.confirm('Er du sikker på, at du vil slette denne dag?')) return;
    try {
      await deleteDoc(doc(db, 'days', dayId));
      if (selectedDay === dayId) {
         setSelectedDay(null);
      }
    } catch (err) {
      console.error('Kunne ikke slette dag', err);
    }
  };

  const loadAllTasksForEvent = async () => {
    const allTasksSnap = await getDocs(collection(db, 'tasks'));
    return allTasksSnap.docs.map(doc => ({id: doc.id, ...doc.data()} as Task));
  };

  const handleExportCSV = async () => {
    if (!selectedEventId) return;
    const eventDays = days.filter(d => !d.eventId || d.eventId === selectedEventId);
    if (eventDays.length === 0) return;
    const eventShifts = shifts.filter(s => eventDays.some(d => d.id === s.dayId));
    
    const allTasks = await loadAllTasksForEvent();
    const eventTasks = allTasks.filter(t => eventShifts.some(s => s.id === t.shiftId));

    let csv = 'Dato,Vagt Navn,Vagt Start,Vagt Slut,Opgave Start,Opgave Slut,Opgave,Beskrivelse,Tildelt til,Status\n';
    
    eventDays.forEach(day => {
      const dayShifts = eventShifts.filter(s => s.dayId === day.id);
      dayShifts.forEach(shift => {
        const shiftTasks = eventTasks.filter(t => t.shiftId === shift.id);
        const dayStr = new Date(day.date).toLocaleDateString('da-DK');
        
        if (shiftTasks.length === 0) {
           csv += `"${dayStr}","${shift.name}","${shift.startTime}","${shift.endTime}","","","","","",""\n`;
        } else {
          shiftTasks.forEach(task => {
             const desc = (task.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
             csv += `"${dayStr}","${shift.name}","${shift.startTime}","${shift.endTime}","${task.startTime || ''}","${task.endTime || ''}","${task.title.replace(/"/g, '""')}","${desc}","${task.assignedTo || ''}","${task.status || 'ledig'}"\n`;
          });
        }
      });
    });

    const blob = new Blob(["\uFEFF"+csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'vagtplan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintDay = async (dayId: string) => {
    const allTasks = await loadAllTasksForEvent();
    setPrintData({ type: 'day', id: dayId, tasks: allTasks });
  };

  const handlePrintShift = async (shiftId: string) => {
    const allTasks = await loadAllTasksForEvent();
    setPrintData({ type: 'shift', id: shiftId, tasks: allTasks });
  };

  const triggerImport = (dayId: string) => {
    setImportDayId(dayId);
    fileInputRef.current?.click();
  };

  const handleImportCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importDayId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const delimiter = text.indexOf(';') !== -1 && text.indexOf(';') < text.indexOf(',') ? ';' : ',';
      const rows = parseCSV(text, delimiter);
      
      let currentShiftId: string | null = null;
      
      for (const row of rows) {
        if (!row || row.length < 2) continue;
        
        const col0 = row[0]?.trim() || '';
        const col1 = row[1]?.trim() || '';
        
        // Is it a shift row? (e.g. "Formiddag", "07.00-11.45")
        if (col0 && col1 && col1.includes('-') && /\d/.test(col1)) {
          const shiftName = col0;
          const [startTimeStr, endTimeStr] = col1.split('-');
          const startTime = startTimeStr?.trim().replace('.', ':') || '';
          const endTime = endTimeStr?.trim().replace('.', ':') || '';
          
          const shiftRef = await addDoc(collection(db, 'shifts'), {
            dayId: importDayId,
            name: shiftName,
            startTime,
            endTime
          });
          currentShiftId = shiftRef.id;
          continue;
        }
        
        // Is it a task row? (col1 is "Voksen" or "Ung")
        if (currentShiftId && (col1.toLowerCase() === 'voksen' || col1.toLowerCase() === 'ung')) {
          const type = col1;
          const num = row[2]?.trim() || '';
          const name = row[3]?.trim() || '';
          const aargang = row[4]?.trim() || '';
          const mobile = row[5]?.trim() || '';
          const email = row[6]?.trim() || '';
          const alder = row[7]?.trim() || '';
          const comment = row[8]?.trim() || '';
          
          const title = num ? `${type} ${num}` : type;
          const assignedTo = name || null;
          const status: Task['status'] = name ? 'taget' : 'ledig';
          
          const descParts = [];
          if (aargang) descParts.push(`Årgang: ${aargang}`);
          if (mobile) descParts.push(`Tlf: ${mobile}`);
          if (email) descParts.push(`Email: ${email}`);
          if (alder && alder.toLowerCase() !== type.toLowerCase()) descParts.push(`Alder: ${alder}`);
          if (comment) descParts.push(`Info: ${comment}`);
          
          await addDoc(collection(db, 'tasks'), {
            shiftId: currentShiftId,
            title,
            description: descParts.join('\n'),
            assignedTo,
            assignees: assignedTo ? [assignedTo] : [],
            status,
            comments: []
          });
        }
      }
      
      e.target.value = '';
      setImportDayId('');
    };
    reader.readAsText(file);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-10">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-700">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Admin Login</h2>
        <p className="text-center text-sm text-slate-500 mb-6">Indtast den fælles PIN kode (1895)</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Kode</label>
            <input 
              type="password" 
              value={pin} 
              onChange={e => setPin(e.target.value)}
              className="w-full border-slate-300 rounded-lg px-4 py-2 focus:ring-blue-500 focus:border-blue-500 border text-center text-xl tracking-widest"
              required
              autoFocus
            />
          </div>
          <button type="submit" className="w-full bg-blue-800 text-yellow-400 font-bold py-2.5 rounded-lg hover:bg-blue-900 transition-colors">
            Log ind
          </button>
        </form>
      </div>
    );
  }

  // When rendering the interface
  if (printData) {
    return <PrintView printData={printData} days={days} shifts={shifts} events={events} />
  }

  return (
    <div className="space-y-8">
      <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImportCSVFile} />
      
      <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
        <div>
          <h2 className="text-lg font-bold text-blue-900">Admin Dashboard</h2>
          <p className="text-sm text-blue-700">Logget ind med PIN (Admin tilstand)</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log ud
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Opret Arrangement Panel */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Vælg eller Opret Arrangement</h3>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 border-r-0 sm:border-r border-slate-200 sm:pr-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Aktivt arrangement</label>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500 italic mt-2">Ingen arrangementer endnu.</p>
              ) : (
                <select 
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 font-medium"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex-1 sm:pl-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nyt arrangement</label>
              <form onSubmit={handleCreateEvent} className="flex gap-2">
                <input 
                  type="text" 
                  value={newEventName} 
                  onChange={e => setNewEventName(e.target.value)}
                  placeholder="f.eks. Sommerfest 2026"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  required 
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  Opret
                </button>
              </form>
            </div>
          </div>

          {(selectedEventId || events.length === 0) && (
            <>
              <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Alle Arrangementer</h4>
                {events.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Ingen arrangementer at vise.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {events.map(ev => (
                      <div key={ev.id} className={`flex items-center justify-between p-3 rounded-xl border ${selectedEventId === ev.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-col">
                          <span className={`font-medium ${selectedEventId === ev.id ? 'text-blue-900' : 'text-slate-800'}`}>{ev.name}</span>
                          <span className="text-xs text-slate-500">
                            {ev.createdAt ? `Oprettet ${new Date(ev.createdAt).toLocaleDateString('da-DK')}` : 'Tidligere arrangement'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleRenameEvent(ev.id)}
                            className="p-2 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Omdøb arrangement"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleCopyEvent(ev.id)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Kopier arrangement"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(ev.id)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Slet arrangement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end items-center border-t border-slate-100 pt-4">
                <button onClick={handleExportCSV} className="text-slate-600 bg-white border border-slate-300 px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors">
                  <Download className="w-4 h-4" /> Eksportér data til CSV
                </button>
              </div>
            </>
          )}
        </div>

        {(selectedEventId || events.length === 0) && (
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl shadow-sm md:col-span-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Aktivt arrangement</span>
              <h3 className="text-xl font-bold text-blue-900 mt-1">
                {events.find(e => e.id === selectedEventId)?.name || 'Vælg arrangement'}
              </h3>
            </div>
          </div>
        )}

        {(selectedEventId || events.length === 0) && (
          <>
            {/* Opret Dag Panel */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">1. Opret en Dato</h3>
              <form onSubmit={handleCreateDay} className="flex gap-2">
                <input 
                  type="date" 
                  value={newDate} 
                  onChange={e => setNewDate(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  required 
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                  Tilføj Dag
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wider">Oprettede Dage</h4>
                {days.filter(d => !d.eventId || d.eventId === selectedEventId).length === 0 ? (
                  <p className="text-sm text-slate-500 italic">Ingen dage endnu.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {days.filter(d => !d.eventId || d.eventId === selectedEventId).map(d => (
                      <div key={d.id} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium border border-slate-200">
                        <span>{new Date(d.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>
                        <button 
                          onClick={() => handleDeleteDay(d.id)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition-colors"
                          title="Slet dag"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Opret Vagt Panel */}
            <AdminCreateShift days={days.filter(d => !d.eventId || d.eventId === selectedEventId)} />
          </>
        )}
      </div>

      {(selectedEventId || events.length === 0) && (
        <div className="pt-6 border-t border-slate-200">
          <div className="flex flex-col gap-4 mb-6">
            <h3 className="text-xl font-bold text-slate-800">Oversigt & Opgaver</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.filter(d => !d.eventId || d.eventId === selectedEventId).map(day => {
                const d = new Date(day.date);
                const isSelected = selectedDay === day.id;
                return (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-8">
            {selectedDay ? (
              (() => {
                const day = days.find(d => d.id === selectedDay);
                if (!day || (day.eventId && day.eventId !== selectedEventId)) return <p className="text-slate-500 italic">Vælg en gyldig dag.</p>;

                const dayShifts = shifts.filter(s => s.dayId === day.id);
                return (
                  <div key={day.id} className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      <h4 className="text-lg font-bold text-slate-800 capitalize">
                        {new Date(day.date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </h4>
                      <div className="flex items-center gap-2">
                        <button onClick={() => triggerImport(day.id)} className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 bg-slate-100" title="Importer vagtplan fra CSV">
                          <Upload className="w-4 h-4" /> Import CSV
                        </button>
                        <button onClick={() => handlePrintDay(day.id)} className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center gap-2 bg-slate-100">
                          <Printer className="w-4 h-4" /> Print Dag
                        </button>
                      </div>
                    </div>
                    
                    {dayShifts.length === 0 ? (
                      <p className="text-slate-500 italic text-sm">Ingen vagter oprettet for denne dag.</p>
                    ) : (
                      <div className="space-y-6">
                        {dayShifts.map(shift => (
                          <div key={shift.id} className="space-y-3 relative group">
                            <ShiftList shift={shift} isAdmin={true} days={days.filter(d => !d.eventId || d.eventId === selectedEventId)} onPrint={() => handlePrintShift(shift.id)} />
                            <AdminCreateTask shift={shift} allShifts={shifts.filter(s => days.find(d => d.id === s.dayId && (!d.eventId || d.eventId === selectedEventId)))} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <p className="text-slate-500 italic">Vælg en dato ovenfor for at se vagter.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminCreateTask({ shift, allShifts }: { shift: Shift, allShifts: Shift[] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxHelpers, setMaxHelpers] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [copySourceShiftId, setCopySourceShiftId] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    
    await addDoc(collection(db, 'tasks'), {
      shiftId: shift.id,
      title,
      description,
      startTime,
      endTime,
      maxHelpers: maxHelpers ? parseInt(maxHelpers, 10) : null,
      assignedTo: null,
      assignees: [],
      comments: [],
      status: 'ledig'
    });
    
    setTitle('');
    setDescription('');
    setStartTime('');
    setEndTime('');
    setMaxHelpers('');
    setIsFormOpen(false);
  };

  const handleCopyTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySourceShiftId) return;

    // Fetch tasks from source shift
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(collection(db, 'tasks'), where('shiftId', '==', copySourceShiftId));
    const snapshot = await getDocs(q);

    snapshot.forEach(async (docSnap) => {
      const data = docSnap.data();
      await addDoc(collection(db, 'tasks'), {
        shiftId: shift.id,
        title: data.title,
        description: data.description || '',
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        maxHelpers: data.maxHelpers ?? null,
        assignedTo: null,
        assignees: [],
        comments: [],
        status: 'ledig'
      });
    });

    setIsCopyOpen(false);
    setCopySourceShiftId('');
  };

  if (!isFormOpen && !isCopyOpen) {
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 text-sm text-blue-600 font-medium py-3 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" /> Tilføj opgave
        </button>
        <button 
          onClick={() => setIsCopyOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-600 font-medium py-3 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Kopiér opgaver fra anden vagt
        </button>
      </div>
    );
  }

  if (isCopyOpen) {
    return (
      <form onSubmit={handleCopyTasks} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <h5 className="font-bold text-sm text-slate-800 mb-3">Kopiér opgaver</h5>
        <div className="space-y-3">
          <select 
            value={copySourceShiftId} 
            onChange={e => setCopySourceShiftId(e.target.value)}
            className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">-- Vælg kilde vagt --</option>
            {allShifts.filter(s => s.id !== shift.id).map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime} - {s.endTime})
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 text-sm pt-1">
            <button type="button" onClick={() => setIsCopyOpen(false)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Annuller
            </button>
            <button type="submit" className="px-4 py-1.5 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-900 shadow-sm transition-colors">
              Kopiér valgte
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleCreate} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
      <h5 className="font-bold text-sm text-slate-800 mb-3">Ny opgave</h5>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Opgavens titel (f.eks. Kasse 1, Opfyldning)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <div className="flex gap-2">
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            title="Starttidspunkt (valgfri)"
          />
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            title="Sluttidspunkt (valgfri)"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Max personer:</span>
          <input
            type="number"
            min="1"
            placeholder="Ingen (ubegrænset)"
            value={maxHelpers}
            onChange={e => setMaxHelpers(e.target.value)}
            className="w-32 border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <textarea
          placeholder="Beskrivelse (valgfri)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
        />
        <div className="flex justify-end gap-2 text-sm pt-1">
          <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Annuller
          </button>
          <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
            Opret opgave
          </button>
        </div>
      </div>
    </form>
  )
}
