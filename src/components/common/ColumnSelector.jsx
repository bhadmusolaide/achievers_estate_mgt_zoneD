import { useState, useRef, useEffect } from 'react';
import { Columns, Check } from 'lucide-react';

const ColumnSelector = ({ columns, visibleKeys, onToggle, onToggleAll, allVisible }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getColumnLabel = (col) => {
    if (col.label) return col.label;
    if (typeof col.header === 'string') return col.header;
    return col.key;
  };

  return (
    <div className="column-selector" ref={dropdownRef}>
      <button
        className="btn btn-sm btn-secondary column-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Columns size={14} />
        <span>Columns</span>
      </button>
      {isOpen && (
        <div className="column-selector-dropdown">
          <label className="column-selector-all">
            <input
              type="checkbox"
              checked={allVisible}
              onChange={onToggleAll}
            />
            <Check size={12} className="check-icon" />
            <span>Show All</span>
          </label>
          <div className="column-selector-divider" />
          {columns.map((col) => (
            <label key={col.key} className="column-selector-item">
              <input
                type="checkbox"
                checked={visibleKeys.includes(col.key)}
                onChange={() => onToggle(col.key)}
              />
              <Check size={12} className="check-icon" />
              <span>{getColumnLabel(col)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColumnSelector;