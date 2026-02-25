import { User, MapPin, Calendar, CheckCircle, Circle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatLandlordName } from '../../utils/helpers';

const OnboardingLandlordCard = ({ landlord, onViewTasks, isSelected, onSelect }) => {
  const tasks = landlord.onboarding_tasks || [];
  const completedCount = tasks.filter((t) => t.completed).length;
  const requiredCount = tasks.filter((t) => t.required).length;
  const progress = requiredCount > 0 ? Math.round((completedCount / requiredCount) * 100) : 0;

  const getDaysInOnboarding = () => {
    if (!landlord.onboarding_started_at) return 'N/A';
    return formatDistanceToNow(new Date(landlord.onboarding_started_at), { addSuffix: false });
  };

  const isComplete = landlord.onboarding_status === 'active';

  return (
    <div className={`onboarding-card ${isComplete ? 'completed' : ''} ${isSelected ? 'selected' : ''}`}>
      <div className="card-header">
        <div className="landlord-info">
          {!isComplete && onSelect && (
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={(e) => onSelect(landlord.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="selection-checkbox"
            />
          )}
          <div className="avatar">
            <User size={20} />
          </div>
          <div>
            <h4>{formatLandlordName(landlord)}</h4>
            <span className="address">
              <MapPin size={14} />
              {landlord.house_address}
            </span>
            {landlord.road && (
              <div className="road-info">
                <span className="road-label">{landlord.road}</span>
              </div>
            )}
          </div>
        </div>
        <span className={`badge ${isComplete ? 'badge-success' : 'badge-warning'}`}>
          {isComplete ? 'Completed' : 'Pending'}
        </span>
      </div>

      <div className="card-body">
        <div className="onboarding-meta">
          <div className="meta-item">
            <Calendar size={14} />
            <span>
              {isComplete ? 'Completed ' : 'Started '}
              {getDaysInOnboarding()} ago
            </span>
          </div>
        </div>

        <div className="task-progress">
          <div className="progress-header">
            <span>Tasks Progress</span>
            <span>
              {completedCount}/{requiredCount}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="task-summary">
          {tasks.slice(0, 3).map((task) => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              {task.completed ? (
                <CheckCircle size={14} className="task-icon completed" />
              ) : (
                <Circle size={14} className="task-icon" />
              )}
              <span>{task.task_label}</span>
            </div>
          ))}
          {tasks.length > 3 && (
            <span className="more-tasks">+{tasks.length - 3} more</span>
          )}
        </div>
      </div>

      <div className="card-footer">
        <button className="btn btn-primary btn-sm" onClick={onViewTasks}>
          {isComplete ? 'View Details' : 'Manage Tasks'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default OnboardingLandlordCard;

