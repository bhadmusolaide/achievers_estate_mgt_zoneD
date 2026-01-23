import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '../../utils/helpers';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  estateName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#edf2f7',
    textAlign: 'center',
  },
  reportDate: {
    fontSize: 10,
    color: '#718096',
    marginTop: 5,
  },
  summarySection: {
    marginTop: 15,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f7fafc',
    borderRadius: 5,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2d3748',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#718096',
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  summaryHighlight: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a365d',
    marginTop: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a365d',
    padding: 8,
    marginTop: 10,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 8,
  },
  tableRowAlt: {
    backgroundColor: '#f7fafc',
  },
  tableCell: {
    fontSize: 9,
    color: '#2d3748',
  },
  colName: { width: '20%' },
  colZone: { width: '10%' },
  colTypes: { width: '20%' },
  colExpected: { width: '12%', textAlign: 'right' },
  colPaid: { width: '12%', textAlign: 'right' },
  colBalance: { width: '12%', textAlign: 'right' },
  colStatus: { width: '8%', textAlign: 'center' },
  colDate: { width: '12%', textAlign: 'right' },
  statusPaid: { color: '#38a169' },
  statusPartial: { color: '#d69e2e' },
  statusPending: { color: '#e53e3e' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#a0aec0',
  },
  pageNumber: {
    fontSize: 9,
    color: '#718096',
    textAlign: 'right',
  },
});

const FinancialReportPDF = ({ data, totals, filters }) => {
  const estateName = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';
  const generatedDate = formatDate(new Date(), 'MMMM dd, yyyy HH:mm');

  const getStatusStyle = (status) => {
    switch (status) {
      case 'paid': return styles.statusPaid;
      case 'partial': return styles.statusPartial;
      default: return styles.statusPending;
    }
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.estateName}>{estateName}</Text>
          <Text style={styles.reportTitle}>FINANCIAL OVERVIEW REPORT</Text>
          <Text style={styles.reportDate}>Generated: {generatedDate}</Text>
          {filters?.zone && <Text style={styles.reportDate}>Zone: {filters.zone}</Text>}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Landlords:</Text>
            <Text style={styles.summaryValue}>{totals.landlordCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fully Paid:</Text>
            <Text style={styles.summaryValue}>{totals.paidCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Partial Payments:</Text>
            <Text style={styles.summaryValue}>{totals.partialCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pending:</Text>
            <Text style={styles.summaryValue}>{totals.pendingCount}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryHighlight]}>
            <Text style={styles.summaryLabel}>Total Expected:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(totals.totalExpected)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Paid:</Text>
            <Text style={[styles.summaryValue, styles.statusPaid]}>{formatCurrency(totals.totalPaid)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Outstanding:</Text>
            <Text style={[styles.summaryValue, styles.statusPending]}>{formatCurrency(totals.totalOutstanding)}</Text>
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colName]}>Landlord</Text>
          <Text style={[styles.tableHeaderCell, styles.colZone]}>Zone</Text>
          <Text style={[styles.tableHeaderCell, styles.colTypes]}>Payment Types</Text>
          <Text style={[styles.tableHeaderCell, styles.colExpected]}>Expected</Text>
          <Text style={[styles.tableHeaderCell, styles.colPaid]}>Paid</Text>
          <Text style={[styles.tableHeaderCell, styles.colBalance]}>Balance</Text>
          <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
          <Text style={[styles.tableHeaderCell, styles.colDate]}>Last Payment</Text>
        </View>

        {/* Table Rows */}
        {data.map((landlord, index) => (
          <View
            key={landlord.id}
            style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            wrap={false}
          >
            <Text style={[styles.tableCell, styles.colName]}>{landlord.full_name}</Text>
            <Text style={[styles.tableCell, styles.colZone]}>{landlord.zone}</Text>
            <Text style={[styles.tableCell, styles.colTypes]}>
              {landlord.assignedPaymentTypes.map(t => t.name).join(', ') || '-'}
            </Text>
            <Text style={[styles.tableCell, styles.colExpected]}>
              {formatCurrency(landlord.totalExpected)}
            </Text>
            <Text style={[styles.tableCell, styles.colPaid]}>
              {formatCurrency(landlord.totalPaid)}
            </Text>
            <Text style={[styles.tableCell, styles.colBalance]}>
              {formatCurrency(landlord.balance)}
            </Text>
            <Text style={[styles.tableCell, styles.colStatus, getStatusStyle(landlord.paymentStatus)]}>
              {landlord.paymentStatus.toUpperCase()}
            </Text>
            <Text style={[styles.tableCell, styles.colDate]}>
              {landlord.lastPaymentDate ? formatDate(landlord.lastPaymentDate, 'MMM dd, yyyy') : '-'}
            </Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text>This report is generated from the Zone-D Estate Management System.</Text>
          <Text>Generated on {generatedDate}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
};

export default FinancialReportPDF;

