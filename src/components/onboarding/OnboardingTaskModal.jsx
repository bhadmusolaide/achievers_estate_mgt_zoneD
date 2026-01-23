import { useState, useEffect } from 'react';
import { User, MapPin, CheckCircle, Circle, Loader2, Save, AlertCircle, PlusCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { onboardingService } from '../../services/onboardingService';
import { useAuth } from '../../context/AuthContext';

const OnboardingTaskModal = ({ landlord, onClose }) => {
  const { adminProfile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlord.id]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onboardingService.getLandlordTasks(landlord.id);
      setTasks(data || []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeTasks = async () => {
    setInitializing(true);
    setError(null);
    try {
      await onboardingService.createTasksForLandlord(landlord.id);
      await loadTasks();
    } catch (err) {
      console.error('Error initializing tasks:', err);
      setError('Failed to create tasks. Please try again.');
    } finally {
      setInitializing(false);
    }
  };

  const handleToggleTask = async (task) => {
    setSaving(task.id);
    try {
      if (task.completed) {
        await onboardingService.uncompleteTask(task.id, adminProfile.id);
      } else {
        await onboardingService.completeTask(task.id, adminProfile.id, task.notes);
      }
      await loadTasks();
    } catch (err) {
      console.error('Error toggling task:', err);
      alert('Failed to update task. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveNotes = async (task) => {
    setSaving(task.id);
    try {
      await onboardingService.updateTaskNotes(task.id, noteText);
      await loadTasks();
      setEditingNotes(null);
      setNoteText('');
    } catch (err) {
      console.error('Error saving notes:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleEditNotes = (task) => {
    setEditingNotes(task.id);
    setNoteText(task.notes || '');
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const requiredCount = tasks.filter((t) => t.required).length;
  const totalCount = tasks.length;
  const allRequiredComplete = tasks.filter((t) => t.required).every((t) => t.completed);
  const progressPercent = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : 0;

  return (
    <Modal isOpen={true} onClose={onClose} title="Onboarding Tasks" size="large">
      <div className="onboarding-task-modal">
        {/* Landlord Info Header */}
        <div className="landlord-summary">
          <div className="avatar">
            <User size={24} />
          </div>
          <div className="landlord-details">
            <h4>{landlord.full_name}</h4>
            <p className="address-text">
              <MapPin size={14} /> {landlord.house_address || 'No address'}
            </p>
            {landlord.road && (
              <p className="road-text">
                <MapPin size={14} /> {landlord.road}
              </p>
            )}
          </div>
          <div className="status-badge">
            <span className={`badge ${allRequiredComplete ? 'badge-success' : 'badge-warning'}`}>
              {allRequiredComplete ? 'Onboarding Complete' : 'In Progress'}
            </span>
            <span className="progress-text">
              {completedCount}/{requiredCount} required tasks
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="onboarding-progress">
          <div className="progress-header">
            <span>Overall Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="btn btn-sm btn-secondary" onClick={loadTasks}>
              Retry
            </button>
          </div>
        )}

        {/* Task List */}
        <div className="task-list">
          {loading ? (
            <div className="loading-center">
              <Loader2 className="spin" size={32} />
              <p>Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-tasks">
              <PlusCircle size={40} className="empty-icon" />
              <h4>No Onboarding Tasks</h4>
              <p>This landlord doesn't have any onboarding tasks yet. Would you like to initialize the standard onboarding checklist?</p>
              <div className="empty-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleInitializeTasks}
                  disabled={initializing}
                >
                  {initializing ? (
                    <>
                      <Loader2 className="spin" size={18} />
                      Creating Tasks...
                    </>
                  ) : (
                    <>
                      <PlusCircle size={18} />
                      Initialize Onboarding Tasks
                    </>
                  )}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={loadTasks}>
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className={`task-row ${task.completed ? 'completed' : ''}`}>
                <button
                  className="task-checkbox"
                  onClick={() => handleToggleTask(task)}
                  disabled={saving === task.id}
                  title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  {saving === task.id ? (
                    <Loader2 className="spin" size={20} />
                  ) : task.completed ? (
                    <CheckCircle size={20} className="checked" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>

                <div className="task-content">
                  <div className="task-label">
                    <span className={task.completed ? 'completed-text' : ''}>
                      {task.task_label}
                    </span>
                    {task.required && <span className="required-badge">Required</span>}
                  </div>

                  {task.completed && task.completed_by_admin && (
                    <div className="task-meta">
                      <CheckCircle size={12} />
                      Completed by {task.completed_by_admin.full_name} on{' '}
                      {new Date(task.completed_at).toLocaleDateString()}
                    </div>
                  )}

                  {editingNotes === task.id ? (
                    <div className="notes-editor">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add notes about this task..."
                        rows={3}
                      />
                      <div className="notes-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setEditingNotes(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSaveNotes(task)}
                          disabled={saving === task.id}
                        >
                          <Save size={14} /> Save Notes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="notes-display">
                      {task.notes && <p className="notes-text">{task.notes}</p>}
                      <button className="btn-link" onClick={() => handleEditNotes(task)}>
                        {task.notes ? 'Edit notes' : '+ Add notes'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Task Summary Footer */}
        {!loading && tasks.length > 0 && (
          <div className="task-summary-footer">
            <span>Total: {totalCount} tasks</span>
            <span>•</span>
            <span className="text-success">{completedCount} completed</span>
            <span>•</span>
            <span className="text-warning">{requiredCount - completedCount} required remaining</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingTaskModal;

