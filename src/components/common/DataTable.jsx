import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import ColumnSelector from './ColumnSelector';

const STORAGE_PREFIX = 'datatable_columns_';

const DataTable = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  pagination,
  sortConfig,
  onSort,
  customizable = false,
  tableId,
}) => {
  const [visibleKeys, setVisibleKeys] = useState([]);

  const getDefaultVisibleKeys = useCallback(() => {
    return columns.filter((col) => col.hideable !== false).map((col) => col.key);
  }, [columns]);

  useEffect(() => {
    if (!customizable || !tableId) {
      setVisibleKeys(columns.map((c) => c.key));
      return;
    }
    const stored = localStorage.getItem(STORAGE_PREFIX + tableId);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const validKeys = columns.map((c) => c.key);
        const filtered = parsed.filter((k) => validKeys.includes(k));
        if (filtered.length > 0) {
          setVisibleKeys(filtered);
          return;
        }
      } catch {}
    }
    setVisibleKeys(getDefaultVisibleKeys());
  }, [customizable, tableId, columns, getDefaultVisibleKeys]);

  const persistVisibleKeys = (keys) => {
    setVisibleKeys(keys);
    if (customizable && tableId) {
      localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(keys));
    }
  };

  const handleToggle = (key) => {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter((k) => k !== key)
      : [...visibleKeys, key];
    persistVisibleKeys(next);
  };

  const handleToggleAll = () => {
    const defaultKeys = getDefaultVisibleKeys();
    const allCurrentlyVisible = defaultKeys.every((k) => visibleKeys.includes(k));
    if (allCurrentlyVisible) {
      persistVisibleKeys([]);
    } else {
      persistVisibleKeys([...defaultKeys]);
    }
  };

  const isColumnVisible = (col) => {
    if (!customizable) return true;
    if (col.hideable === false) return true;
    return visibleKeys.includes(col.key);
  };

  const visibleColumns = columns.filter(isColumnVisible);

  if (loading) {
    return (
      <div className="table-loading">
        <div className="spinner"></div>
        <p>Loading data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const allVisible = getDefaultVisibleKeys().every((k) => visibleKeys.includes(k));

  return (
    <div className="table-container">
      {customizable && (
        <div className="table-toolbar">
          <ColumnSelector
            columns={columns.filter((c) => c.hideable !== false)}
            visibleKeys={visibleKeys}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
            allVisible={allVisible}
          />
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={col.sortable ? 'sortable' : ''}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="header-content">
                  {col.header}
                  {col.sortable && sortConfig?.key === col.key && (
                    <span className="sort-icon">
                      {sortConfig.direction === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  )}
                  {col.sortable && sortConfig?.key !== col.key && (
                    <span className="sort-icon sort-icon-inactive">
                      <ChevronUp size={14} />
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id || index}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'clickable' : ''}
            >
              {visibleColumns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && (
        <div className="table-pagination">
          <span className="pagination-info">
            Showing {pagination.from} to {pagination.to} of {pagination.total}
          </span>
          <div className="pagination-controls">
            <button
              className="btn btn-sm"
              disabled={pagination.page === 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button
              className="btn btn-sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;