import { Link } from 'react-router-dom';
import { Cake, Heart, Calendar, ArrowRight, Bell } from 'lucide-react';

const UpcomingCelebrationsAlert = ({ celebrations, loading }) => {
  if (loading) {
    return (
      <div className="alert-banner">
        <div className="alert-content">
          <Bell className="alert-icon loading-skeleton" size={20} />
          <div className="alert-text loading-skeleton" style={{ width: '200px', height: '20px' }}></div>
        </div>
      </div>
    );
  }

  if (!celebrations || celebrations.length === 0) {
    return null;
  }

  const upcomingCount = celebrations.length;
  const birthdays = celebrations.filter(c => c.celebration_type === 'birthday');
  const anniversaries = celebrations.filter(c => c.celebration_type === 'anniversary');

  let alertText = '';
  let alertIcon = null;

  if (upcomingCount === 1) {
    const celebration = celebrations[0];
    const dateStr = new Date(celebration.celebration_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    if (celebration.days_to_event === 0) {
      alertText = `${celebration.landlords?.full_name}'s ${celebration.celebration_type === 'birthday' ? 'birthday' : 'wedding anniversary'} is today!`;
    } else if (celebration.days_to_event === 1) {
      alertText = `${celebration.landlords?.full_name}'s ${celebration.celebration_type === 'birthday' ? 'birthday' : 'wedding anniversary'} is tomorrow!`;
    } else {
      alertText = `${celebration.landlords?.full_name}'s ${celebration.celebration_type === 'birthday' ? 'birthday' : 'wedding anniversary'} is in ${celebration.days_to_event} days (${dateStr})`;
    }
    
    alertIcon = celebration.celebration_type === 'birthday' ? <Cake size={20} /> : <Heart size={20} />;
  } else {
    // Multiple upcoming celebrations
    alertText = `${upcomingCount} upcoming celebrations: ${birthdays.length} birthday${birthdays.length !== 1 ? 's' : ''}, ${anniversaries.length} anniversary${anniversaries.length !== 1 ? 's' : ''}`;
    alertIcon = <Calendar size={20} />;
  }

  return (
    <div className="alert-banner alert-banner-celebration">
      <div className="alert-content">
        <div className="alert-icon">
          {alertIcon}
        </div>
        <div className="alert-text">
          <span>{alertText}</span>
        </div>
        <Link to="/celebrations" className="alert-action">
          View All <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
};

export default UpcomingCelebrationsAlert;