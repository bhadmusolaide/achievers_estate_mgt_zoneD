import { useState } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import Modal from './Modal';
import { feedbackService } from '../../services/feedbackService';

const CATEGORIES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'compliment', label: 'Compliment' },
  { value: 'other', label: 'Other' },
];

const FeedbackModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'suggestion', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.message.trim().length < 10) {
      setError('Message must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await feedbackService.submit({
        name: form.name.trim() || 'Anonymous',
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        category: form.category,
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ name: '', email: '', phone: '', category: 'suggestion', message: '' });
    setSubmitted(false);
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Share Your Feedback" size="small">
      {submitted ? (
        <div className="feedback-success">
          <MessageSquare size={40} />
          <h3>Thank You!</h3>
          <p>Your feedback helps us improve the community experience.</p>
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      ) : (
        <form className="feedback-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fb-name">Name <span className="optional">(optional)</span></label>
            <input id="fb-name" name="name" value={form.name} onChange={handleChange} placeholder="Your name" />
          </div>
          <div className="form-group">
            <label htmlFor="fb-email">Email <span className="optional">(optional)</span></label>
            <input id="fb-email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="For follow-up" />
          </div>
          <div className="form-group">
            <label htmlFor="fb-phone">Phone <span className="optional">(optional)</span></label>
            <input id="fb-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="For follow-up" />
          </div>
          <div className="form-group">
            <label htmlFor="fb-category">Category</label>
            <select id="fb-category" name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="fb-message">Message <span className="required">*</span></label>
            <textarea id="fb-message" name="message" rows={4} value={form.message} onChange={handleChange} placeholder="Share your thoughts or suggestions..." />
          </div>
          {error && <div className="feedback-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      )}
    </Modal>
  );
};

export default FeedbackModal;