import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Building2, Heart, DollarSign, CreditCard } from 'lucide-react';
import Header from '../components/layout/Header';
import Modal from '../components/common/Modal';
import ConfirmActionModal from '../components/common/ConfirmActionModal';
import { projectService } from '../services/projectService';
import { pledgeService } from '../services/pledgeService';
import { debtService } from '../services/debtService';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';

const MILESTONE_LABELS = {
  open: 'Open',
  awaiting_funding: 'Awaiting Funding',
  in_progress: 'In Progress',
  pending: 'Pending',
  canceled: 'Canceled',
  completed: 'Completed',
};

const MILESTONE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_funding', label: 'Awaiting Funding' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'completed', label: 'Completed' },
];

const PLEDGE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'fulfilled', label: 'Fulfilled' },
];

const PLEDGE_STATUS_COLORS = {
  pending: 'badge-warning',
  partial: 'badge-info',
  fulfilled: 'badge-success',
};

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
];

const ZoneManagementPage = () => {
  const { adminProfile } = useAuth();
  const [projects, setProjects] = useState([]);
  const [pledges, setPledges] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Project form state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', estimated_budget: '', milestone_level: 'open' });
  const [savingProject, setSavingProject] = useState(false);

  // Pledge form state
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [editingPledge, setEditingPledge] = useState(null);
  const [pledgeForm, setPledgeForm] = useState({ donor_name: '', amount: '', description: '', status: 'pending' });
  const [savingPledge, setSavingPledge] = useState(false);

  // Debt form state
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtForm, setDebtForm] = useState({ project_id: '', amount: '' });
  const [savingDebt, setSavingDebt] = useState(false);

  // Debt payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingDebt, setPayingDebt] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'bank_transfer', notes: '' });
  const [savingPayment, setSavingPayment] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsData, pledgesData, debtsData] = await Promise.all([
        projectService.getAll(),
        pledgeService.getAll(),
        debtService.getAll(),
      ]);
      setProjects(projectsData);
      setPledges(pledgesData);
      setDebts(debtsData);
    } catch (error) {
      console.error('Error loading management data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Project handlers
  const openNewProject = () => {
    setEditingProject(null);
    setProjectForm({ name: '', description: '', estimated_budget: '', milestone_level: 'open' });
    setShowProjectModal(true);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      estimated_budget: project.estimated_budget?.toString() || '',
      milestone_level: project.milestone_level,
    });
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    try {
      const payload = {
        name: projectForm.name,
        description: projectForm.description || null,
        estimated_budget: parseFloat(projectForm.estimated_budget) || 0,
        milestone_level: projectForm.milestone_level,
      };

      if (editingProject) {
        await projectService.update(editingProject.id, payload);
      } else {
        await projectService.create({ ...payload, created_by: adminProfile?.id });
      }
      setShowProjectModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setSavingProject(false);
    }
  };

  const confirmDeleteProject = (project) => {
    setDeleteTarget(project);
    setDeleteType('project');
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  // Pledge handlers
  const openNewPledge = () => {
    setEditingPledge(null);
    setPledgeForm({ donor_name: '', amount: '', description: '', status: 'pending' });
    setShowPledgeModal(true);
  };

  const openEditPledge = (pledge) => {
    setEditingPledge(pledge);
    setPledgeForm({
      donor_name: pledge.donor_name,
      amount: pledge.amount?.toString() || '',
      description: pledge.description || '',
      status: pledge.status,
    });
    setShowPledgeModal(true);
  };

  const handleSavePledge = async (e) => {
    e.preventDefault();
    setSavingPledge(true);
    try {
      const payload = {
        donor_name: pledgeForm.donor_name,
        amount: parseFloat(pledgeForm.amount),
        description: pledgeForm.description || null,
        status: pledgeForm.status,
      };

      if (editingPledge) {
        await pledgeService.update(editingPledge.id, payload);
      } else {
        await pledgeService.create({ ...payload, created_by: adminProfile?.id });
      }
      setShowPledgeModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving pledge:', error);
    } finally {
      setSavingPledge(false);
    }
  };

  const confirmDeletePledge = (pledge) => {
    setDeleteTarget(pledge);
    setDeleteType('pledge');
  };

  const handleDeletePledge = async () => {
    try {
      await pledgeService.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting pledge:', error);
    }
  };

  // Debt handlers
  const openNewDebt = () => {
    setDebtForm({ project_id: '', amount: '' });
    setShowDebtModal(true);
  };

  const handleCreateDebt = async (e) => {
    e.preventDefault();
    setSavingDebt(true);
    try {
      await debtService.create({
        project_id: debtForm.project_id,
        amount: parseFloat(debtForm.amount),
        created_by: adminProfile?.id,
      });
      setShowDebtModal(false);
      await loadData();
    } catch (error) {
      console.error('Error creating debt:', error);
    } finally {
      setSavingDebt(false);
    }
  };

  const handlePayDebt = (debt) => {
    setPayingDebt(debt);
    setPaymentForm({
      amount: debt.remaining_amount?.toString() || '',
      payment_method: 'bank_transfer',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!payingDebt) return;
    setSavingPayment(true);
    try {
      await debtService.makePayment(
        payingDebt.id,
        parseFloat(paymentForm.amount),
        paymentForm.payment_method,
        paymentForm.notes,
        adminProfile?.id
      );
      setShowPaymentModal(false);
      setPayingDebt(null);
      await loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setSavingPayment(false);
    }
  };

  const confirmDeleteDebt = (debt) => {
    setDeleteTarget(debt);
    setDeleteType('debt');
  };

  const handleDeleteDebt = async () => {
    try {
      await debtService.remove(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting debt:', error);
    }
  };

  const completedProjects = projects.filter(p => p.milestone_level === 'completed');

  const renderSkeleton = () => (
    <div className="page zone-management-page">
      <Header title="Zone Management" />
      <div className="page-content">
        {[1, 2, 3].map(i => <div key={i} className="zone-management-section loading-skeleton" style={{ height: '300px', marginBottom: '1.5rem' }}></div>)}
      </div>
    </div>
  );

  if (loading) return renderSkeleton();

  return (
    <div className="page zone-management-page">
      <Header title="Zone Management" />
      
      <div className="page-content">
        {/* Projects Section */}
        <div className="zone-management-section">
          <div className="section-header">
            <div className="section-header-left">
              <Building2 size={20} />
              <h3>Projects</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewProject}>
              <Plus size={16} /> Add Project
            </button>
          </div>
          <div className="zone-management-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Budget</th>
                  <th>Milestone</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">No projects yet</td></tr>
                ) : (
                  projects.map(project => (
                    <tr key={project.id}>
                      <td className="cell-name">{project.name}</td>
                      <td>{formatCurrency(project.estimated_budget || 0)}</td>
                      <td>
                        <span className={`badge badge-${project.milestone_level === 'completed' ? 'success' : project.milestone_level === 'in_progress' ? 'info' : project.milestone_level === 'awaiting_funding' ? 'warning' : 'default'}`}>
                          {MILESTONE_LABELS[project.milestone_level] || project.milestone_level}
                        </span>
                      </td>
                      <td className="cell-desc">{project.description || '-'}</td>
                      <td className="cell-date">{formatDateTime(project.created_at)}</td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-icon" onClick={() => openEditProject(project)} title="Edit">
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-icon btn-icon-danger" onClick={() => confirmDeleteProject(project)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pledges Section */}
        <div className="zone-management-section">
          <div className="section-header">
            <div className="section-header-left">
              <Heart size={20} />
              <h3>Pledges & Donations</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewPledge}>
              <Plus size={16} /> Add Pledge
            </button>
          </div>
          <div className="zone-management-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pledges.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">No pledges yet</td></tr>
                ) : (
                  pledges.map(pledge => (
                    <tr key={pledge.id}>
                      <td className="cell-name">{pledge.donor_name}</td>
                      <td>{formatCurrency(pledge.amount)}</td>
                      <td>
                        <span className={`badge ${PLEDGE_STATUS_COLORS[pledge.status] || 'badge-default'}`}>
                          {pledge.status.charAt(0).toUpperCase() + pledge.status.slice(1)}
                        </span>
                      </td>
                      <td className="cell-desc">{pledge.description || '-'}</td>
                      <td className="cell-date">{formatDateTime(pledge.created_at)}</td>
                      <td>
                        <div className="cell-actions">
                          <button className="btn btn-icon" onClick={() => openEditPledge(pledge)} title="Edit">
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-icon btn-icon-danger" onClick={() => confirmDeletePledge(pledge)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project Debts Section */}
        <div className="zone-management-section">
          <div className="section-header">
            <div className="section-header-left">
              <DollarSign size={20} />
              <h3>Project Debts</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewDebt}>
              <Plus size={16} /> Add Debt
            </button>
          </div>
          <div className="zone-management-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Total Amount</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {debts.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">No project debts</td></tr>
                ) : (
                  debts.map(debt => (
                    <tr key={debt.id}>
                      <td className="cell-name">{debt.projects?.name || 'Unknown'}</td>
                      <td>{formatCurrency(debt.total_amount)}</td>
                      <td className="zone-item-debt">{formatCurrency(debt.remaining_amount)}</td>
                      <td>
                        <span className={`badge ${debt.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                          {debt.status === 'paid' ? 'Paid' : 'Outstanding'}
                        </span>
                      </td>
                      <td className="cell-date">{formatDateTime(debt.created_at)}</td>
                      <td>
                        <div className="cell-actions">
                          {debt.status === 'active' && (
                            <button className="btn btn-icon" onClick={() => handlePayDebt(debt)} title="Record Payment">
                              <CreditCard size={16} />
                            </button>
                          )}
                          <button className="btn btn-icon btn-icon-danger" onClick={() => confirmDeleteDebt(debt)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project Modal */}
        <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} size="small" title={editingProject ? 'Edit Project' : 'New Project'}>
          <form onSubmit={handleSaveProject} className="zone-form">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input type="text" className="form-input" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Community Hall Renovation" />
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Budget</label>
              <input type="number" className="form-input" value={projectForm.estimated_budget} onChange={e => setProjectForm(f => ({ ...f, estimated_budget: e.target.value }))} min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Milestone Level</label>
              <select className="form-input" value={projectForm.milestone_level} onChange={e => setProjectForm(f => ({ ...f, milestone_level: e.target.value }))}>
                {MILESTONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Brief description of the project" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingProject || !projectForm.name.trim()}>
                {savingProject ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Pledge Modal */}
        <Modal isOpen={showPledgeModal} onClose={() => setShowPledgeModal(false)} size="small" title={editingPledge ? 'Edit Pledge' : 'New Pledge'}>
          <form onSubmit={handleSavePledge} className="zone-form">
            <div className="form-group">
              <label className="form-label">Donor Name *</label>
              <input type="text" className="form-input" value={pledgeForm.donor_name} onChange={e => setPledgeForm(f => ({ ...f, donor_name: e.target.value }))} required placeholder="Donor or organization name" />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input type="number" className="form-input" value={pledgeForm.amount} onChange={e => setPledgeForm(f => ({ ...f, amount: e.target.value }))} required min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={pledgeForm.status} onChange={e => setPledgeForm(f => ({ ...f, status: e.target.value }))}>
                {PLEDGE_STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={pledgeForm.description} onChange={e => setPledgeForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Optional notes about this pledge" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPledgeModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingPledge || !pledgeForm.donor_name.trim() || !pledgeForm.amount}>
                {savingPledge ? 'Saving...' : editingPledge ? 'Update Pledge' : 'Create Pledge'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Debt Modal */}
        <Modal isOpen={showDebtModal} onClose={() => setShowDebtModal(false)} size="small" title="New Project Debt">
          <form onSubmit={handleCreateDebt} className="zone-form">
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-input" value={debtForm.project_id} onChange={e => setDebtForm(f => ({ ...f, project_id: e.target.value }))} required>
                <option value="">Select a project</option>
                {completedProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.estimated_budget)})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Debt Amount *</label>
              <input type="number" className="form-input" value={debtForm.amount} onChange={e => setDebtForm(f => ({ ...f, amount: e.target.value }))} required min="0.01" step="0.01" placeholder="0.00" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDebtModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingDebt || !debtForm.project_id || !debtForm.amount}>
                {savingDebt ? 'Saving...' : 'Create Debt'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Payment Modal */}
        <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setPayingDebt(null); }} size="small" title="Record Debt Payment">
          <form onSubmit={handleSubmitPayment} className="zone-form">
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
              Project: <strong>{payingDebt?.projects?.name}</strong><br />
              Remaining: <strong className="zone-item-debt">{formatCurrency(payingDebt?.remaining_amount || 0)}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Payment Amount *</label>
              <input type="number" className="form-input" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} required min="0.01" step="0.01" max={payingDebt?.remaining_amount || 0} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-input" value={paymentForm.payment_method} onChange={e => setPaymentForm(f => ({ ...f, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes about this payment" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowPaymentModal(false); setPayingDebt(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingPayment || !paymentForm.amount}>
                {savingPayment ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation */}
        {deleteTarget && (
          <ConfirmActionModal
            title={`Delete ${deleteType === 'project' ? 'Project' : deleteType === 'pledge' ? 'Pledge' : 'Debt'}`}
            message={`Are you sure you want to delete "${deleteTarget.name || deleteTarget.donor_name || deleteTarget.projects?.name}"? This action cannot be undone.`}
            variant="danger"
            confirmLabel="Delete"
            onConfirm={deleteType === 'project' ? handleDeleteProject : deleteType === 'pledge' ? handleDeletePledge : handleDeleteDebt}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ZoneManagementPage;