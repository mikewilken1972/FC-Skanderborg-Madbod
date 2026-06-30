import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, updateDoc, doc, getDocs } from 'firebase/firestore';
import { Clock, Edit2, Check, X, Copy, Printer, Users, MessageCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { Shift, Task, Day } from '../types';
import { TaskItem } from './TaskItem';

interface ShiftListProps {
  shift: Shift;
  isAdmin: boolean;
  days?: Day[];
  onPrint?: () => void;
}

export function ShiftList({ shift, isAdmin, days = [], onPrint }: ShiftListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [targetDayId, setTargetDayId] = useState('');
  const [editName, setEditName] = useState(shift.name);
  const [editStartTime, setEditStartTime] = useState(shift.startTime);
  const [editEndTime, setEditEndTime] = useState(shift.endTime);
  const [editDisableSelfSignup, setEditDisableSelfSignup] = useState(shift.disableSelfSignup || false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const qTasks = query(collection(db, 'tasks'), where('shiftId', '==', shift.id));
    const unsub = onSnapshot(qTasks, (snap) => {
      const loaded: Task[] = [];
      snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() } as Task));
      setTasks(loaded);
    });
    return unsub;
  }, [shift.id]);

  const handleDeleteShift = async () => {
    if (confirmDelete) {
      try {
        // First delete all tasks associated with this shift
        const qTasks = query(collection(db, 'tasks'), where('shiftId', '==', shift.id));
        const snap = await getDocs(qTasks);
        const deletePromises = snap.docs.map(tDoc => deleteDoc(doc(db, 'tasks', tDoc.id)));
        await Promise.all(deletePromises);

        // Then delete the shift itself
        await deleteDoc(doc(db, 'shifts', shift.id));
        setConfirmDelete(false);
      } catch (err) {
        console.error(err);
        alert('Der opstod en fejl ved sletning. Prøv igen.');
      }
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
    }
  };

  const handleUpdateShift = async () => {
    if (!editName || !editStartTime || !editEndTime) return;
    await updateDoc(doc(db, 'shifts', shift.id), {
      name: editName,
      startTime: editStartTime,
      endTime: editEndTime,
      disableSelfSignup: editDisableSelfSignup
    });
    setIsEditing(false);
  };

  const handleCopyShift = async () => {
    if (!targetDayId) return;

    // 1. Create the new shift
    const newShiftRef = await addDoc(collection(db, 'shifts'), {
      dayId: targetDayId,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      disableSelfSignup: shift.disableSelfSignup || false
    });

    // 2. Fetch current tasks and copy them to the new shift
    const q = query(collection(db, 'tasks'), where('shiftId', '==', shift.id));
    const snapshot = await getDocs(q);

    snapshot.forEach(async (docSnap) => {
      const data = docSnap.data();
      await addDoc(collection(db, 'tasks'), {
        shiftId: newShiftRef.id,
        title: data.title,
        description: data.description || '',
        assignedTo: null,
        assignees: [],
        comments: [],
        status: 'ledig'
      });
    });

    setIsCopying(false);
    setTargetDayId('');
    // Kopieret!
  };

  const totalAssignees = tasks.reduce((sum, task) => {
    const list = task.assignees || (task.assignedTo ? [task.assignedTo] : []);
    return sum + list.length;
  }, 0);

  const allAssignments = tasks.flatMap(t => {
    const list = t.assignees || (t.assignedTo ? [t.assignedTo] : []);
    return list.map(name => ({ task: t, name }));
  });

  const handleSendReminder = () => {
    const phones: string[] = [];
    const emails: string[] = [];
    
    // Brug allAssignments for at se alle der er tilmeldt
    allAssignments.forEach(({ task }) => {
      const desc = task.description || '';
      const phoneMatch = desc.match(/Tlf:\s*([^\n]+)/);
      const emailMatch = desc.match(/Email:\s*([^\n]+)/);
      
      if (phoneMatch) {
         // rens telefonnummeret for unødige tegn men bevar + osv
         const p = phoneMatch[1].trim().replace(/[^0-9+]/g, '');
         if (p && !phones.includes(p)) phones.push(p);
      }
      if (emailMatch) {
         const e = emailMatch[1].trim();
         if (e && !emails.includes(e)) emails.push(e);
      }
    });

    const hasPhones = phones.length > 0;
    const hasEmails = emails.length > 0;

    if (!hasPhones && !hasEmails) {
      alert("Ingen kontaktinformationer (telefon/email) fundet for de tilmeldte på denne vagt.");
      return;
    }

    const message = `Påmindelse: Du har en vagt "${shift.name}" kl. ${shift.startTime}-${shift.endTime}.`;

    const options = [];
    if (hasPhones) options.push("sms");
    if (hasEmails) options.push("email");

    const choice = window.prompt(`Vil du sende via ${options.join(' eller ')}?\nSkriv dit valg her:`, options[0]);
    if (!choice) return;

    if (choice.toLowerCase().includes('sms') && hasPhones) {
      // iOS kræver typisk &, mens Android bruger ? og måske , i stedet for ;
      // Standard er dog comma-separated
      const phoneList = phones.join(',');
      window.location.href = `sms:${phoneList}?body=${encodeURIComponent(message)}`;
    } else if (choice.toLowerCase().includes('mail') && hasEmails) {
      const emailList = emails.join(',');
      window.location.href = `mailto:?bcc=${emailList}&subject=${encodeURIComponent(`Påmindelse om vagt: ${shift.name}`)}&body=${encodeURIComponent(message)}`;
    } else {
       alert("Ugyldigt valg eller ingen modtagere tilgængelige.");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {isEditing ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
            <input 
              type="text" 
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="px-2 py-1 border border-slate-300 rounded text-sm w-full sm:w-auto"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="time" 
                value={editStartTime}
                onChange={e => setEditStartTime(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-sm w-full sm:w-auto"
              />
              <span className="text-slate-500 font-bold">-</span>
              <input 
                type="time" 
                value={editEndTime}
                onChange={e => setEditEndTime(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-sm w-full sm:w-auto"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={editDisableSelfSignup}
                  onChange={e => setEditDisableSelfSignup(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700">Deaktiver selv-tilmelding</span>
              </label>
            </div>
            <div className="flex gap-1 ml-auto">
              <button onClick={handleUpdateShift} className="text-green-600 bg-green-50 p-1.5 rounded-lg hover:bg-green-100 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setIsEditing(false)} className="text-red-500 bg-red-50 p-1.5 rounded-lg hover:bg-red-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : isCopying ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
            <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Kopiér til:</span>
            <select 
              value={targetDayId}
              onChange={e => setTargetDayId(e.target.value)}
              className="px-2 py-1.5 border border-slate-300 rounded text-sm w-full sm:w-auto focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Vælg dag...</option>
              {days.filter(d => d.id !== shift.dayId).map(d => (
                <option key={d.id} value={d.id}>
                  {new Date(d.date).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
            <div className="flex gap-1 ml-auto">
              <button disabled={!targetDayId} onClick={handleCopyShift} className="text-blue-600 bg-blue-50 p-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 font-bold px-3 text-sm">
                Kopiér
              </button>
              <button onClick={() => setIsCopying(false)} className="text-slate-500 bg-slate-100 p-1.5 rounded-lg hover:bg-slate-200 transition-colors px-3 text-sm">
                Annuller
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">{shift.name}</h3>
                {tasks.length > 0 && (() => {
                  const isCompletelyFull = tasks.every(task => {
                    const assigneesList = task.assignees || (task.assignedTo ? [task.assignedTo] : []);
                    return task.maxHelpers != null && assigneesList.length >= task.maxHelpers;
                  });
                  
                  const hasUnlimitedTasks = tasks.some(task => task.maxHelpers == null);
                  
                  let availableSpots = 0;
                  if (!hasUnlimitedTasks) {
                    tasks.forEach(task => {
                      const assigneesList = task.assignees || (task.assignedTo ? [task.assignedTo] : []);
                      if (task.maxHelpers != null && assigneesList.length < task.maxHelpers) {
                        availableSpots += (task.maxHelpers - assigneesList.length);
                      }
                    });
                  }

                  if (isCompletelyFull) {
                    return (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-xs font-bold border border-red-200">
                        Udfyldt
                      </span>
                    );
                  } else if (hasUnlimitedTasks) {
                    return (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-xs font-bold border border-green-200">
                        Ledig
                      </span>
                    );
                  } else {
                    return (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-xs font-bold border border-green-200">
                        Ledig ({availableSpots} {availableSpots === 1 ? 'plads' : 'pladser'})
                      </span>
                    );
                  }
                })()}
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mt-1 font-medium">
                <Clock className="w-4 h-4" />
                {shift.startTime} - {shift.endTime}
                {shift.disableSelfSignup && (
                  <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-xs font-bold">
                    Selv-tilmelding deaktiveret
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link 
                to={`/shift/${shift.id}/helpers`}
                state={{ isAdmin }}
                className="text-blue-600 bg-blue-50 text-sm font-medium hover:bg-blue-100 p-2 rounded-lg transition-colors flex items-center justify-center border border-blue-100 mr-2"
                title="Se medhjælpere"
              >
                <Users className="w-4 h-4 mr-1.5" />
                Medhjælpere
              </Link>
              
              {isAdmin && (
                <>
                  <button 
                    onClick={handleSendReminder}
                    className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center bg-slate-100"
                    title="Send påmindelse til tilmeldte (SMS/E-mail)"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                  {onPrint && (
                    <button 
                      onClick={onPrint}
                      className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center bg-slate-100"
                      title="Print vagt"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsCopying(true)}
                    className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center bg-slate-100"
                    title="Kopiér vagt til en anden dag"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-slate-600 text-sm font-medium hover:bg-slate-200 p-2 rounded-lg transition-colors flex items-center justify-center bg-slate-100"
                    title="Rediger vagt"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDeleteShift}
                    className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                  >
                    {confirmDelete ? 'Bekræft sletning' : 'Slet vagt'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className="p-4 sm:p-5 space-y-6">
        {allAssignments.length > 0 && (
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
            <h4 className="font-bold text-blue-900 text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> 
              Bemanding på vagten ({allAssignments.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAssignments.map((assignment, idx) => (
                <div key={`${assignment.task.id}-${idx}`} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex flex-col">
                  <span className="font-bold text-slate-800 text-sm line-clamp-1 truncate" title={assignment.name || ''}>{assignment.name}</span>
                  <span className="text-xs font-medium text-blue-600 mb-1">{assignment.task.title}</span>
                  {assignment.task.description && (
                    <div className="text-xs text-slate-500 mt-1.5 whitespace-pre-wrap border-t border-slate-100 pt-1.5 leading-relaxed font-mono">
                      {assignment.task.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Arbejdsopgaver</h4>
          {tasks.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Ingen opgaver endnu.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {tasks.map(task => (
                <TaskItem key={task.id} task={task} isAdmin={isAdmin} shiftDisableSelfSignup={shift.disableSelfSignup} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
