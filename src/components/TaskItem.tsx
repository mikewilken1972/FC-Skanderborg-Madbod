import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User, MessageSquare, Plus, Trash2, CheckCircle2, Clock, Edit2, X, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { Task, TaskComment, TaskStatus } from '../types';
import { cn } from '../lib/utils';

interface TaskItemProps {
  task: Task;
  isAdmin: boolean;
  shiftDisableSelfSignup?: boolean;
}

export function TaskItem({ task, isAdmin, shiftDisableSelfSignup = false }: TaskItemProps) {
  const [isTaking, setIsTaking] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editStartTime, setEditStartTime] = useState(task.startTime || '');
  const [editEndTime, setEditEndTime] = useState(task.endTime || '');
  const [editMaxHelpers, setEditMaxHelpers] = useState(task.maxHelpers?.toString() || '');

  const assigneesList = task.assignees || (task.assignedTo ? [task.assignedTo] : []);
  
  const taskIsFull = task.maxHelpers != null && assigneesList.length >= task.maxHelpers;
  const canTakeMore = !taskIsFull;
  
  // Fallback for older data without status
  const currentStatus: TaskStatus = task.status || (assigneesList.length > 0 ? 'taget' : 'ledig');

  const handleTakeTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    
    const newAssignees = [...assigneesList, nameInput.trim()];

    await updateDoc(doc(db, 'tasks', task.id), {
      assignees: newAssignees,
      assignedTo: newAssignees[0],
      status: currentStatus === 'ledig' ? 'taget' : currentStatus
    });
    setIsTaking(false);
    setNameInput('');
  };

  const handleReleaseAssignee = async (nameToRemove: string) => {
    if (window.confirm(`Er du sikker på, du vil fjerne ${nameToRemove} fra denne opgave?`)) {
      const newAssignees = assigneesList.filter(n => n !== nameToRemove);
      const newStatus = newAssignees.length > 0 ? currentStatus : 'ledig';
      await updateDoc(doc(db, 'tasks', task.id), {
        assignees: newAssignees,
        assignedTo: newAssignees.length > 0 ? newAssignees[0] : null,
        status: newStatus
      });
    }
  };

  const handleCompleteTask = async () => {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: 'udført'
    });
  };

  const handleRevertTask = async () => {
    await updateDoc(doc(db, 'tasks', task.id), {
      status: 'taget'
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !authorInput.trim()) return;

    const newComment: TaskComment = {
      id: Math.random().toString(36).substr(2, 9),
      text: commentInput.trim(),
      authorName: authorInput.trim(),
      createdAt: new Date().toISOString(),
    };

    const currentComments = task.comments || [];
    
    await updateDoc(doc(db, 'tasks', task.id), {
      comments: [...currentComments, newComment]
    });
    
    setCommentInput('');
  };

  const handleDeleteTask = async () => {
    if (confirmDelete) {
      await deleteDoc(doc(db, 'tasks', task.id));
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
    }
  };

  const handleStartEditing = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditStartTime(task.startTime || '');
    setEditEndTime(task.endTime || '');
    setEditMaxHelpers(task.maxHelpers?.toString() || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        title: editTitle,
        description: editDescription,
        startTime: editStartTime,
        endTime: editEndTime,
        maxHelpers: editMaxHelpers ? parseInt(editMaxHelpers, 10) : null
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert('Der opstod en fejl ved gem. Prøv igen.');
    }
  };

  if (isEditing) {
    return (
      <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-blue-500 focus:border-blue-500"
            placeholder="Opgavetitel"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={editStartTime}
              onChange={e => setEditStartTime(e.target.value)}
              className="flex-1 border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              title="Starttidspunkt"
            />
            <input
              type="time"
              value={editEndTime}
              onChange={e => setEditEndTime(e.target.value)}
              className="flex-1 border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              title="Sluttidspunkt (valgfri)"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Max personer:</span>
            <input
              type="number"
              min="1"
              placeholder="Ingen (ubegrænset)"
              value={editMaxHelpers}
              onChange={e => setEditMaxHelpers(e.target.value)}
              className="w-32 border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <textarea
            value={editDescription}
            onChange={e => setEditDescription(e.target.value)}
            className="w-full border-slate-300 border rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Beskrivelse (valgfri)"
            rows={2}
          />
          <div className="flex justify-end gap-2 text-sm pt-1">
            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1">
              <X className="w-4 h-4" /> Annuller
            </button>
            <button onClick={handleSaveEdit} className="px-4 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1">
              <Check className="w-4 h-4" /> Gem ret
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border rounded-xl p-4 transition-all relative overflow-hidden",
      currentStatus === 'udført' ? "bg-slate-50 border-slate-200 opacity-75" :
      currentStatus === 'taget' ? "bg-blue-50/50 border-blue-200" : 
      "bg-white border-slate-200 shadow-sm"
    )}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className={cn("font-bold text-lg", currentStatus === 'udført' ? "text-slate-600 line-through" : "text-slate-800")}>
              {task.title}
            </h4>
            {currentStatus === 'udført' && (
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Udført
              </span>
            )}
            {assigneesList.length === 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Ledig
              </span>
            )}
            {(task.startTime || task.endTime) && (
              <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.startTime || '?'} {task.endTime && `- ${task.endTime}`}
              </span>
            )}
            {task.maxHelpers != null && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-md font-medium">
                Max {task.maxHelpers} pers. ({assigneesList.length} tilmeldt)
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{task.description}</p>
          )}
        </div>
        
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <button 
              onClick={handleStartEditing} 
              className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded" 
              title="Rediger opgave"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={handleDeleteTask} 
              className={cn("transition-colors p-1 rounded", confirmDelete ? "bg-red-100 text-red-600" : "text-slate-400 hover:text-red-500")} 
              title="Slet opgave"
            >
              {confirmDelete ? <span className="text-xs font-bold px-1">Slet?</span> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
        {/* Assignment Section */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 min-h-[2.5rem]">
          {assigneesList.length > 0 ? (
            <div className="flex flex-wrap gap-2 flex-1">
              {assigneesList.map((name, idx) => (
                <div key={idx} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", 
                  currentStatus === 'udført' ? "text-slate-600 bg-slate-200/50" : "text-blue-800 bg-blue-100/50"
                )}>
                  <User className="w-4 h-4" />
                  <span className="font-medium text-sm">
                    {name}
                  </span>
                  {currentStatus !== 'udført' && isAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleReleaseAssignee(name); }}
                      className="ml-1 text-slate-400 hover:text-red-500 transition-colors bg-white/50 rounded-full p-0.5"
                      title="Fjern person"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 font-medium italic">
              Ingen tildelt endnu
            </div>
          )}

          <div className="flex items-center flex-wrap gap-2 ml-auto">
            {canTakeMore !== false && currentStatus !== 'udført' && !isTaking && isAdmin && (
              <button
                onClick={() => setIsTaking(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                Tildel opgave
              </button>
            )}
            
            {assigneesList.length > 0 && currentStatus === 'taget' && (
              <button
                onClick={handleCompleteTask}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                Markér Udført
              </button>
            )}

            {currentStatus === 'udført' && (
              <button
                onClick={handleRevertTask}
                className="text-slate-500 hover:text-blue-600 text-sm font-medium px-2 py-1 transition-colors"
              >
                Fortryd (Markér som taget)
              </button>
            )}
          </div>
        </div>

        {isTaking && currentStatus !== 'udført' && (
          <form onSubmit={handleTakeTask} className="flex gap-2 mt-1">
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Indtast dit navn..."
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <button type="submit" className="bg-yellow-400 hover:bg-yellow-500 text-blue-900 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm">
              Gem
            </button>
            <button type="button" onClick={() => setIsTaking(false)} className="text-slate-500 text-sm px-2 hover:bg-slate-100 rounded-lg">
              Annuller
            </button>
          </form>
        )}

        {/* Comments Toggle */}
        <div className="flex justify-end mt-1">
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            {task.comments?.length || 0} Kommentarer
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          <div className="space-y-3">
            {task.comments?.map(c => (
              <div key={c.id} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="font-bold text-slate-700">{c.authorName}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString('da-DK', { hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-slate-600">{c.text}</p>
              </div>
            ))}
            {(!task.comments || task.comments.length === 0) && (
              <p className="text-xs text-slate-400 italic">Ingen kommentarer endnu.</p>
            )}
          </div>
          
          <form onSubmit={handleAddComment} className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Tilføj kommentar</h5>
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              placeholder="Dit navn"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Skriv besked..."
              rows={2}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              required
            />
            <button type="submit" className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
              <Plus className="w-4 h-4" /> Send kommentar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
