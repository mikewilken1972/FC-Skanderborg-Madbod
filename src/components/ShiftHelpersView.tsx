import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { ArrowLeft, Users, User, Phone, Mail, FileText, Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { Shift, Task, Day, Event } from '../types';

export function ShiftHelpersView() {
  const { shiftId } = useParams<{ shiftId: string }>();
  const location = useLocation();
  const isAdmin = location.state?.isAdmin || false;
  
  const [shift, setShift] = useState<Shift | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newHelperName, setNewHelperName] = useState('');

  const handleAddManualHelper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHelperName.trim() || !shiftId) return;

    try {
      await addDoc(collection(db, 'tasks'), {
        shiftId: shiftId,
        title: 'Manuel tilmelding',
        description: '',
        assignedTo: null,
        assignees: [newHelperName.trim()],
        comments: [],
        status: 'taget'
      });
      setNewHelperName('');
    } catch (err) {
      console.error("Error adding helper:", err);
      alert("Der opstod en fejl ved tilføjelse.");
    }
  };

  useEffect(() => {
    if (!shiftId) return;

    // Fetch shift
    const fetchShiftData = async () => {
      try {
        const shiftSnap = await getDoc(doc(db, 'shifts', shiftId));
        if (shiftSnap.exists()) {
          const shiftData = { id: shiftSnap.id, ...shiftSnap.data() } as Shift;
          setShift(shiftData);

          // Fetch Day
          const daySnap = await getDoc(doc(db, 'days', shiftData.dayId));
          if (daySnap.exists()) {
            const dayData = { id: daySnap.id, ...daySnap.data() } as Day;
            setDay(dayData);

            // Fetch Event
            if (dayData.eventId) {
              const eventSnap = await getDoc(doc(db, 'events', dayData.eventId));
              if (eventSnap.exists()) {
                setEvent({ id: eventSnap.id, ...eventSnap.data() } as Event);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching shift data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShiftData();

    // Listen to tasks
    const qTasks = query(collection(db, 'tasks'), where('shiftId', '==', shiftId));
    const unsub = onSnapshot(qTasks, (snap) => {
      const loaded: Task[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Task));
      setTasks(loaded);
    });

    return () => unsub();
  }, [shiftId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-800">Vagten blev ikke fundet</h2>
        <Link to="/" className="text-blue-600 hover:text-blue-800 mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Tilbage til oversigten
        </Link>
      </div>
    );
  }

  const allAssignments = tasks.flatMap(t => {
    const list = t.assignees || (t.assignedTo ? [t.assignedTo] : []);
    return list.map(name => ({ task: t, name }));
  });

  return (
    <div className="space-y-6">
      <Link to={-1 as any} className="inline-flex items-center gap-2 text-blue-800 hover:text-blue-600 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Tilbage
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-blue-800 px-6 py-8 text-white text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-700/50 rounded-full mb-4">
            <Users className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Oversigt over Medhjælpere</h1>
          <div className="mt-4 flex flex-col items-center gap-2 text-blue-100">
            {event && <p className="font-medium text-lg text-white">{event.name}</p>}
            {day && (
              <p className="flex items-center gap-2">
                <span className="font-bold">{new Date(day.date).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </p>
            )}
            <p className="flex items-center gap-2 bg-blue-900/50 px-3 py-1 rounded-full text-sm font-medium mt-1">
              <Clock className="w-4 h-4" />
              {shift.name} ({shift.startTime} - {shift.endTime})
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">Medhjælpere på vagten</h2>
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold border border-blue-100">
                {allAssignments.length} besat {shift.maxHelpers ? `/ ${shift.maxHelpers} max` : ''}
              </span>
            </div>
            
            {isAdmin && (
              <form onSubmit={handleAddManualHelper} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Tilføj navn..."
                  value={newHelperName}
                  onChange={(e) => setNewHelperName(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                />
                <button
                  type="submit"
                  disabled={!newHelperName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Tilføj
                </button>
              </form>
            )}
          </div>

          {allAssignments.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Der er endnu ingen medhjælpere tilmeldt eller tildelt denne vagt.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allAssignments.map((assignment, idx) => {
                const task = assignment.task;
                // Extract possible phone/email from description if imported via CSV
                const desc = task.description || '';
                const phoneMatch = desc.match(/Tlf:\s*([^\n]+)/);
                const emailMatch = desc.match(/Email:\s*([^\n]+)/);
                const infoMatch = desc.match(/Info:\s*([^\n]+)/);
                
                const phone = phoneMatch ? phoneMatch[1].trim() : null;
                const email = emailMatch ? emailMatch[1].trim() : null;
                const info = infoMatch ? infoMatch[1].trim() : null;

                // Find only real description bits (not matching the regexes above)
                const realDesc = desc.replace(/Tlf:\s*[^\n]+|Email:\s*[^\n]+|Info:\s*[^\n]+|Alder:\s*[^\n]+/g, '').trim();

                return (
                  <div key={`${task.id}-${idx}`} className="bg-white border text-sm border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3 pb-3 border-b border-slate-100">
                      <div className="bg-blue-100 text-blue-700 p-2 rounded-full">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{assignment.name}</h3>
                        <p className="text-blue-600 font-medium text-xs">{task.title}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-slate-600">
                      {phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />
                          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-blue-600 transition-colors">{phone}</a>
                        </div>
                      )}
                      {email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <a href={`mailto:${email}`} className="hover:text-blue-600 transition-colors truncate" title={email}>{email}</a>
                        </div>
                      )}
                      {info && (
                        <div className="flex items-start gap-2 pt-1">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-xs italic">{info}</p>
                        </div>
                      )}
                      {(!phone && !email && !info && realDesc) ? (
                        <div className="flex items-start gap-2 pt-1">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-slate-700 text-xs leading-relaxed max-h-24 overflow-y-auto">{realDesc}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
