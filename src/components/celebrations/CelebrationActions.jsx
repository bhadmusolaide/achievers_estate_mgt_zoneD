import { useState } from 'react';
import { CheckCircle, Send, XCircle, Loader2, Mail, MessageSquare, MapPin } from 'lucide-react';
import { celebrationService } from '../../services/celebrationService';
import { celebrationMessagingService } from '../../services/celebrationMessagingService';
import { useAuth } from '../../context/AuthContext';
import { formatLandlordName } from '../../utils/helpers';

const CelebrationActions = ({ celebration, onComplete }) => {
  const { adminProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [showSkipForm, setShowSkipForm] = useState(false);
  const [sendChannel, setSendChannel] = useState('whatsapp');

  const handleApprove = async () => {
    setLoading(true);
    try {
      // If it's a computed celebration, queue and approve it
      if (celebration.computed) {
        await celebrationService.approveComputed(celebration, adminProfile.id);
      } else {
        await celebrationService.approve(celebration.id, adminProfile.id);
      }
      onComplete();
    } catch (error) {
      console.error('Error approving celebration:', error);
      alert('Failed to approve. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (celebration.status !== 'approved') {
      alert('Please approve the celebration before sending.');
      return;
    }

    setLoading(true);
    try {
      const { landlords: landlord } = celebration;

      // Send the celebration message
      const result = await celebrationMessagingService.sendCelebration(
        celebration,
        landlord,
        sendChannel
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Mark as sent in database
      await celebrationService.markSent(celebration.id, sendChannel);
      onComplete();
    } catch (error) {
      console.error('Error sending celebration:', error);
      alert(`Failed to send: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!skipReason.trim()) {
      alert('Please provide a reason for skipping.');
      return;
    }
    
    setLoading(true);
    try {
      await celebrationService.skip(celebration.id, skipReason);
      onComplete();
    } catch (error) {
      console.error('Error skipping celebration:', error);
      alert('Failed to skip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { landlords: landlord } = celebration;

  return (
    <div className="celebration-actions">
      <div className="action-info">
        <h4>{formatLandlordName(landlord)}</h4>
        <p>
          {celebration.celebration_type === 'birthday' ? 'Birthday' : 'Wedding Anniversary'}
          {' on '}
          {new Date(celebration.celebration_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="address-info">
          <MapPin size={14} />
          {landlord?.house_address || 'N/A'}
          {landlord?.road && ` (${landlord?.road})`}
        </p>
        <p className="days-info">
          {celebration.days_to_event === 0
            ? '🎉 Today!'
            : `${celebration.days_to_event} day(s) away`}
        </p>
      </div>

      {(celebration.computed || celebration.status === 'pending') && !showSkipForm && (
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? <Loader2 className="spin" size={18} /> : <CheckCircle size={18} />}
            {celebration.computed ? 'Queue & Approve' : 'Approve Celebration'}
          </button>
          {!celebration.computed && (
            <button
              className="btn btn-danger"
              onClick={() => setShowSkipForm(true)}
              disabled={loading}
            >
              <XCircle size={18} /> Skip
            </button>
          )}
        </div>
      )}

      {celebration.status === 'approved' && !showSkipForm && (
        <div className="send-options">
          <h5>Send Message Via:</h5>
          <div className="channel-select">
            <label className={`channel-option ${sendChannel === 'whatsapp' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="channel"
                value="whatsapp"
                checked={sendChannel === 'whatsapp'}
                onChange={(e) => setSendChannel(e.target.value)}
              />
              <MessageSquare size={20} />
              <span>WhatsApp</span>
            </label>
            <label className={`channel-option ${sendChannel === 'email' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="channel"
                value="email"
                checked={sendChannel === 'email'}
                onChange={(e) => setSendChannel(e.target.value)}
              />
              <Mail size={20} />
              <span>Email</span>
            </label>
          </div>
          <div className="action-buttons">
            <button className="btn btn-success" onClick={handleSend} disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              Send Now
            </button>
            <button
              className="btn btn-danger"
              onClick={() => setShowSkipForm(true)}
              disabled={loading}
            >
              <XCircle size={18} /> Skip
            </button>
          </div>
        </div>
      )}

      {showSkipForm && (
        <div className="skip-form">
          <h5>Skip Celebration</h5>
          <p>Please provide a reason for skipping this celebration:</p>
          <textarea
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Enter reason..."
            rows={3}
          />
          <div className="action-buttons">
            <button className="btn btn-secondary" onClick={() => setShowSkipForm(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleSkip} disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} /> : <XCircle size={18} />}
              Confirm Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CelebrationActions;

