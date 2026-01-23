import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { formatCurrency, formatDate, getMonthName } from '../../utils/helpers';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  estateName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 5,
  },
  zone: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 5,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#edf2f7',
    textAlign: 'center',
  },
  receiptNumber: {
    fontSize: 12,
    color: '#718096',
    marginTop: 5,
  },
  section: {
    marginTop: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 11,
    color: '#718096',
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    padding: 15,
    backgroundColor: '#1a365d',
    borderRadius: 5,
  },
  amountLabel: {
    fontSize: 14,
    color: '#ffffff',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 10,
    color: '#a0aec0',
  },
  stamp: {
    marginTop: 30,
    padding: 15,
    borderWidth: 2,
    borderColor: '#48bb78',
    borderRadius: 5,
    textAlign: 'center',
  },
  stampText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#48bb78',
  },
  stampDate: {
    fontSize: 10,
    color: '#718096',
    marginTop: 5,
  },
});

const ReceiptPDF = ({ receipt, payment, landlord, admin }) => {
  const estateName = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';
  const zone = import.meta.env.VITE_ESTATE_ZONE || 'Zone D';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.estateName}>{estateName}</Text>
          <Text style={styles.zone}>{zone}</Text>
          <Text style={styles.receiptTitle}>PAYMENT RECEIPT</Text>
          <Text style={styles.receiptNumber}>Receipt No: {receipt.receipt_number}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Landlord Name:</Text>
            <Text style={styles.value}>{landlord.full_name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>House Address:</Text>
            <Text style={styles.value}>{landlord.house_address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Purpose:</Text>
            <Text style={styles.value}>{payment.payment_types?.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Period:</Text>
            <Text style={styles.value}>
              {getMonthName(payment.payment_month)} {payment.payment_year}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Method:</Text>
            <Text style={styles.value}>{payment.payment_method.replace('_', ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Reference Code:</Text>
            <Text style={styles.value}>{payment.reference_code}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Amount Paid:</Text>
          <Text style={styles.amountValue}>{formatCurrency(payment.amount)}</Text>
        </View>

        <View style={styles.stamp}>
          <Text style={styles.stampText}>✓ PAYMENT CONFIRMED</Text>
          <Text style={styles.stampDate}>
            {formatDate(payment.confirmed_at, 'MMMM dd, yyyy HH:mm')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Processed by: {admin?.full_name || 'Administrator'}</Text>
          <Text>Generated on: {formatDate(receipt.generated_at, 'MMMM dd, yyyy HH:mm')}</Text>
          <Text>This is a computer-generated receipt and is valid without signature.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReceiptPDF;

