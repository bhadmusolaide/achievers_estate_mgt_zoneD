const StatsCard = ({ title, value, icon: Icon, color = 'primary', trend }) => {
  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-icon">
        {Icon && <Icon size={24} />}
      </div>
      <div className="stats-content">
        <span className="stats-value">{value}</span>
        <span className="stats-title">{title}</span>
        {trend && (
          <span className={`stats-trend ${trend.positive ? 'positive' : 'negative'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;

