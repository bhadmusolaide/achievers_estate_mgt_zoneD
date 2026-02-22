import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const DataWipeManager = () => {
  const [step, setStep] = useState(1); // 1: Initial, 2: First confirm, 3: Type phrase, 4: Processing, 5: Done
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
  const EXPECTED_PHRASE = 'DELETE ALL DATA';

  const handleFirstConfirm = () => {
    setStep(2);
  };

  const handleSecondConfirm = () => {
    setStep(3);
    setConfirmPhrase('');
    setError('');
  };

  const handleCancel = () => {
    setStep(1);
    setConfirmPhrase('');
    setError('');
    setResult(null);
  };

  const handleWipeData = async () => {
    if (confirmPhrase !== EXPECTED_PHRASE) {
      setError(`Please type "${EXPECTED_PHRASE}" exactly to confirm.`);
      return;
    }

    setStep(4);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wipe-all-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ confirmationPhrase: confirmPhrase }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to wipe data');
      }

      setResult(data);
      setStep(5);
    } catch (err) {
      setError(err.message || 'An error occurred while wiping data');
      setStep(3);
    }
  };

  return (
    <div className="data-wipe-manager">
      <h3>Danger Zone</h3>
      <p className="section-description">
        Permanently delete all application data. This action cannot be undone.
      </p>

      {/* Step 1: Initial state */}
      {step === 1 && (
        <div className="danger-zone-card">
          <div className="danger-header">
            <AlertTriangle size={24} className="danger-icon" />
            <div>
              <h4>Delete All Data</h4>
              <p>Remove all landlords, payments, receipts, transactions, and activity logs.</p>
            </div>
          </div>
          <p className="preserve-note">
            <strong>Preserved:</strong> Admin accounts, payment types, transaction categories, and settings.
          </p>
          <button className="btn btn-danger" onClick={handleFirstConfirm}>
            <Trash2 size={18} />
            Delete All Data
          </button>
        </div>
      )}

      {/* Step 2: First confirmation */}
      {step === 2 && (
        <div className="danger-zone-card confirm-step">
          <div className="danger-header">
            <AlertTriangle size={32} className="danger-icon pulse" />
            <h4>Are you absolutely sure?</h4>
          </div>
          <div className="warning-box">
            <p><strong>This will permanently delete:</strong></p>
            <ul>
              <li>All landlord records</li>
              <li>All payment records</li>
              <li>All receipts and receipt files</li>
              <li>All transactions</li>
              <li>All activity/audit logs</li>
              <li>All onboarding data</li>
              <li>All celebration queue items</li>
            </ul>
            <p className="warning-text">This action is <strong>irreversible</strong>.</p>
          </div>
          <div className="button-group">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleSecondConfirm}>
              Yes, I understand
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Type confirmation phrase */}
      {step === 3 && (
        <div className="danger-zone-card confirm-step">
          <div className="danger-header">
            <AlertTriangle size={32} className="danger-icon pulse" />
            <h4>Final Confirmation</h4>
          </div>
          <p>Type <code>{EXPECTED_PHRASE}</code> below to confirm:</p>
          <input
            type="text"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder="Type the phrase here..."
            className="confirm-input"
            autoFocus
          />
          {error && (
            <div className="error-message">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="button-group">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleWipeData}
              disabled={confirmPhrase !== EXPECTED_PHRASE}
            >
              <Trash2 size={18} />
              Delete Everything
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Processing */}
      {step === 4 && (
        <div className="danger-zone-card processing">
          <Loader2 size={48} className="spin" />
          <h4>Deleting all data...</h4>
          <p>Please wait. This may take a moment.</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 5 && result && (
        <div className="danger-zone-card complete">
          <CheckCircle size={48} className="success-icon" />
          <h4>Data Wipe Complete</h4>
          <p>All data has been successfully deleted.</p>
          <div className="results-summary">
            <h5>Deletion Summary:</h5>
            <ul>
              {result.results?.map((r, idx) => (
                <li key={idx}>
                  {r.table}: {r.count} {r.error ? `(Error: ${r.error})` : 'deleted'}
                </li>
              ))}
            </ul>
          </div>
          <button className="btn btn-primary" onClick={handleCancel}>
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default DataWipeManager;

