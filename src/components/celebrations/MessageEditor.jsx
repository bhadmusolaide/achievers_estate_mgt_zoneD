import { useState, useEffect } from 'react';
import { Save, RefreshCw, Loader2 } from 'lucide-react';
import { celebrationService } from '../../services/celebrationService';

const ESTATE_NAME = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';

const MessageEditor = ({ celebration, onSave, onCancel }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const { landlords: landlord } = celebration;

  const replaceTemplateVariables = (template) => {
    return template
      .replace(/{landlord_name}/g, landlord?.full_name || 'Valued Resident')
      .replace(/{estate_name}/g, ESTATE_NAME)
      .replace(/{chairman_name}/g, 'The Chairman')
      .replace(/{zone}/g, landlord?.zone || 'Zone D');
  };

  useEffect(() => {
    const loadTemplate = async () => {
      setLoadingTemplate(true);
      try {
        // Use custom message if exists, otherwise load default template
        if (celebration.custom_message) {
          setMessage(celebration.custom_message);
        } else {
          const template = await celebrationService.getDefaultTemplate(celebration.celebration_type);
          if (template) {
            setMessage(replaceTemplateVariables(template.message_template));
          }
        }
      } catch (error) {
        console.error('Error loading template:', error);
      } finally {
        setLoadingTemplate(false);
      }
    };
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration.id, celebration.custom_message, celebration.celebration_type]);

  const handleResetTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const template = await celebrationService.getDefaultTemplate(celebration.celebration_type);
      if (template) {
        setMessage(replaceTemplateVariables(template.message_template));
      }
    } catch (error) {
      console.error('Error resetting template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await celebrationService.updateMessage(celebration.id, message);
      onSave();
    } catch (error) {
      console.error('Error saving message:', error);
      alert('Failed to save message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingTemplate) {
    return (
      <div className="message-editor loading">
        <Loader2 className="spin" size={24} />
        <p>Loading template...</p>
      </div>
    );
  }

  return (
    <div className="message-editor">
      <div className="editor-header">
        <h4>
          {celebration.celebration_type === 'birthday' ? 'Birthday' : 'Anniversary'} Message for{' '}
          {landlord?.full_name}
        </h4>
        <button
          className="btn btn-sm btn-secondary"
          onClick={handleResetTemplate}
          disabled={loading}
        >
          <RefreshCw size={14} /> Reset to Default
        </button>
      </div>

      <div className="editor-content">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter celebration message..."
          rows={12}
          disabled={loading}
        />
        <div className="editor-hint">
          <strong>Available variables:</strong> {'{landlord_name}'}, {'{estate_name}'},{' '}
          {'{chairman_name}'}, {'{zone}'}
        </div>
      </div>

      <div className="editor-preview">
        <h5>Preview:</h5>
        <div className="preview-content">
          {message.split('\n').map((line, i) => (
            <p key={i}>{line || <br />}</p>
          ))}
        </div>
      </div>

      <div className="editor-actions">
        <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
          Save Message
        </button>
      </div>
    </div>
  );
};

export default MessageEditor;

