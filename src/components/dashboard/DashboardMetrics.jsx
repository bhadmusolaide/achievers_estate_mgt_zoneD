import { Users, CreditCard, AlertCircle, Receipt, Wallet } from 'lucide-react';
import StatsCard from '../common/StatsCard';
import { formatCurrency } from '../../utils/helpers';

const DashboardMetrics = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="metrics-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stats-card loading-skeleton"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="metrics-grid">
      <StatsCard
        title="Estate Balance"
        value={formatCurrency(metrics?.accountBalance || 0)}
        icon={Wallet}
        color={metrics?.accountBalance >= 0 ? 'success' : 'danger'}
      />
      <StatsCard
        title="Total Landlords"
        value={metrics?.totalLandlords || 0}
        icon={Users}
        color="primary"
      />
      <StatsCard
        title="Confirmed Payments"
        value={formatCurrency(metrics?.totalConfirmedAmount || 0)}
        icon={CreditCard}
        color="success"
      />
      <StatsCard
        title="Pending Payments"
        value={formatCurrency(metrics?.pendingPayments || 0)}
        icon={AlertCircle}
        color="warning"
      />
      <StatsCard
        title="Receipts Today"
        value={metrics?.receiptsSentToday || 0}
        icon={Receipt}
        color="info"
      />
    </div>
  );
};

export default DashboardMetrics;

