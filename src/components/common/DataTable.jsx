import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

const DataTable = ({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  pagination,
  sortConfig,
  onSort,
}) => {
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

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
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
              {columns.map((col) => (
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

