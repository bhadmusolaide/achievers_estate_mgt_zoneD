import { formatCurrency, formatDateTime, getStatusClass } from '../../utils/helpers';

const RecentPayments = ({ payments, loading }) => {
  if (loading) {
    return (
      <div className="recent-payments loading">
        <div className="loading-skeleton" style={{ height: '200px' }}></div>
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="recent-payments empty">
        <p>No recent payments</p>
      </div>
    );
  }

  return (
    <div className="recent-payments">
      <table className="data-table compact">
        <thead>
          <tr>
            <th>Landlord</th>
            <th>Address</th>
            <th>Road</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.landlords?.full_name}</td>
              <td>{payment.landlords?.house_address}</td>
              <td>{payment.landlords?.road || '-'}</td>
              <td className="capitalize">{payment.payment_types?.name}</td>
              <td>{formatCurrency(payment.amount)}</td>
              <td>
                <span className={`badge ${getStatusClass(payment.status)}`}>
                  {payment.status}
                </span>
              </td>
              <td>{formatDateTime(payment.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentPayments;

