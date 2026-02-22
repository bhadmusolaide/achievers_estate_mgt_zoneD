import { Search, X } from 'lucide-react';
import { useState } from 'react';

const SearchFilter = ({ 
  searchPlaceholder = 'Search...', 
  onSearch, 
  filters = [],
  onFilterChange,
  activeFilters = {},
}) => {
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch?.(value);
  };

  const handleFilterChange = (key, value) => {
    onFilterChange?.({ ...activeFilters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange?.({});
  };

  const hasActiveFilters = Object.values(activeFilters).some(v => v);

  return (
    <div className="search-filter">
      <div className="search-controls">
        <div className="inline-filters">
          {/* Search bar integrated into the filters container */}
          {onSearch && (
            <div className="filter-group search-group">
              <label>Search</label>
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={handleSearch}
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>
          )}

          {filters.map((filter) => (
            <div key={filter.key} className="filter-group">
              <label>{filter.label}</label>
              {filter.type === 'text' ? (
                <input
                  type="text"
                  placeholder={filter.placeholder || ''}
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="filter-input"
                />
              ) : (
                <select
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                >
                  <option value="">All</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}

          {hasActiveFilters && (
            <button className="btn btn-sm btn-secondary clear-filters" onClick={clearFilters}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchFilter;

