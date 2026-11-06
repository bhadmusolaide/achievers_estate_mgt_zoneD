import { useState } from 'react';
import { Mail, MessageCircle, Download, Loader2, Check, X } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import ReceiptPDF from './ReceiptPDF';
import { receiptService } from '../../services/receiptService';
import { messagingService } from '../../services/messagingService';

const ReceiptActions = ({ receipt, payment, landlord, admin, onUpdate }) => {
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const generatePdfBlob = async () => {
    const doc = <ReceiptPDF receipt={receipt} payment={payment} landlord={landlord} admin={admin} />;
    return await pdf(doc).toBlob();
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${receipt.receipt_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!landlord.email) {
      alert('Landlord does not have an email address');
      return;
    }

    setSendingEmail(true);
    try {
      // Upload PDF if not already uploaded
      if (!receipt.pdf_url) {
        const blob = await generatePdfBlob();
        await receiptService.uploadPdf(receipt.id, blob);
      }

      const result = await messagingService.sendEmail(receipt, landlord, payment);
      
      if (result.success) {
        await receiptService.updateDeliveryStatus(receipt.id, { sent_email: true });
        onUpdate?.();
      } else {
        alert(`Failed to send email: ${result.error}`);
      }
    } catch (error) {
      console.error('Email send error:', error);
      alert('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!landlord.phone) {
      alert('Landlord does not have a phone number');
      return;
    }

    setSendingWhatsApp(true);
    try {
      // Upload PDF if not already uploaded
      if (!receipt.pdf_url) {
        const blob = await generatePdfBlob();
        await receiptService.uploadPdf(receipt.id, blob);
      }

      const result = await messagingService.sendWhatsApp(receipt, landlord, payment);
      
      if (result.success) {
        await receiptService.updateDeliveryStatus(receipt.id, { sent_whatsapp: true });
        onUpdate?.();
      } else {
        alert(`Failed to send WhatsApp: ${result.error}`);
      }
    } catch (error) {
      console.error('WhatsApp send error:', error);
      alert('Failed to send WhatsApp message');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <div className="receipt-actions">
      <button 
        className="btn btn-secondary"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
        Download PDF
      </button>

      <button 
        className={`btn ${receipt.sent_email ? 'btn-success' : 'btn-primary'}`}
        onClick={handleSendEmail}
        disabled={sendingEmail || !landlord.email}
        title={!landlord.email ? 'No email address' : ''}
      >
        {sendingEmail ? (
          <Loader2 className="spin" size={16} />
        ) : receipt.sent_email ? (
          <Check size={16} />
        ) : (
          <Mail size={16} />
        )}
        {receipt.sent_email ? 'Email Sent' : 'Send Email'}
      </button>

      <button 
        className={`btn ${receipt.sent_whatsapp ? 'btn-success' : 'btn-primary'}`}
        onClick={handleSendWhatsApp}
        disabled={sendingWhatsApp || !landlord.phone}
        title={!landlord.phone ? 'No phone number' : ''}
      >
        {sendingWhatsApp ? (
          <Loader2 className="spin" size={16} />
        ) : receipt.sent_whatsapp ? (
          <Check size={16} />
        ) : (
          <MessageCircle size={16} />
        )}
        {receipt.sent_whatsapp ? 'WhatsApp Sent' : 'Send WhatsApp'}
      </button>
    </div>
  );
};

export default ReceiptActions;

