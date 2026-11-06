import { useState, useEffect } from 'react';
import { 
  UserPlus, Edit, Send, Check, Upload, LogIn, 
  PartyPopper, ClipboardCheck, FileText, RefreshCw 
} from 'lucide-react';
import Header from '../components/layout/Header';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from '../services/activityLogService';
import { formatDateTime } from '../utils/helpers';

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 50,
  });
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await activityLogService.getAll(filters);
      setLogs(result.data);
      setTotalCount(result.count || result.data.length);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType) => {
    if (actionType.includes('created') || actionType.includes('logged')) 
      return { icon: UserPlus, className: 'action-create' };
    if (actionType.includes('updated')) 
      return { icon: Edit, className: 'action-update' };
    if (actionType.includes('sent')) 
      return { icon: Send, className: 'action-send' };
    if (actionType.includes('confirmed') || actionType.includes('approved') || actionType.includes('completed')) 
      return { icon: Check, className: 'action-confirm' };
    if (actionType.includes('import')) 
      return { icon: Upload, className: 'action-import' };
    if (actionType.includes('login')) 
      return { icon: LogIn, className: 'action-login' };
    if (actionType.includes('celebration')) 
      return { icon: PartyPopper, className: 'action-send' };
    if (actionType.includes('onboarding')) 
      return { icon: ClipboardCheck, className: 'action-confirm' };
    return { icon: FileText, className: 'action-update' };
  };

  const formatActionType = (actionType) => {
    return actionType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatMetadata = (metadata) => {
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: 50,
    });
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(totalCount / filters.pageSize);

  return (
    <div className="page audit-log-page">
      <Header title="Audit Log" />
      <div className="page-content">
        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <label>Action Type</label>
            <select 
              value={filters.actionType} 
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
            >
              <option value="">All Actions</option>
              {Object.values(ACTION_TYPES).map(type => (
                <option key={type} value={type}>{formatActionType(type)}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Entity Type</label>
            <select 
              value={filters.entityType} 
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
            >
              <option value="">All Entities</option>
              {Object.values(ENTITY_TYPES).map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="filter-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
              Clear
            </button>
            <button className="btn btn-primary btn-sm" onClick={loadLogs}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Log Entries */}
        {loading ? (
          <div className="table-loading">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="table-empty">No audit logs found</div>
        ) : (
          <>
            {logs.map((log) => {
              const { icon: Icon, className } = getActionIcon(log.action_type);
              return (
                <div key={log.id} className="log-entry">
                  <div className={`log-icon ${className}`}>
                    <Icon size={20} />
                  </div>
                  <div className="log-content">
                    <div className="log-header">
                      <span className="log-action">{formatActionType(log.action_type)}</span>
                      <span className="log-timestamp">{formatDateTime(log.created_at)}</span>
                    </div>
                    <div className="log-admin">
                      by <strong>{log.admin_profiles?.full_name || 'Unknown Admin'}</strong>
                      {log.admin_profiles?.role && ` (${log.admin_profiles.role})`}
                    </div>
                    <div>
                      <span className="log-entity">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="log-entity">ID: {log.entity_id.substring(0, 8)}...</span>
                      )}
                    </div>
                    {formatMetadata(log.metadata) && (
                      <div className="log-metadata">{formatMetadata(log.metadata)}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="btn btn-secondary btn-sm"
                  disabled={filters.page === 1}
                  onClick={() => handlePageChange(filters.page - 1)}
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {filters.page} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary btn-sm"
                  disabled={filters.page >= totalPages}
                  onClick={() => handlePageChange(filters.page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
