import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';
import { financialOverviewService } from '../../services/financialOverviewService';

const BulkImportFinancials = () => {
  const { adminProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [step, setStep] = useState('upload');
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [landlordMap, setLandlordMap] = useState(new Map());

  const displayFileName = selectedFileName || 'No file selected';
  const requiredColumns = ['landlord_phone', 'payment_type_name', 'amount', 'frequency'];

  const loadPaymentTypes = async () => {
    try {
      const types = await financialOverviewService.getPaymentTypes();
      setPaymentTypes(types);
    } catch (error) {
      console.error('Error loading payment types:', error);
    }
  };

  const loadLandlords = async () => {
    try {
      const { data, error } = await supabase
        .from('landlords')
        .select('id, phone, full_name')
        .eq('status', 'active');

      if (error) throw error;

      const map = new Map();
      data.forEach(landlord => {
        map.set(landlord.phone, landlord);
      });
      setLandlordMap(map);
    } catch (error) {
      console.error('Error loading landlords:', error);
    }
  };

  useEffect(() => {
    loadPaymentTypes();
    loadLandlords();
  }, []);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setSelectedFileName(selectedFile.name);
      parseCSV(selectedFile);
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const parseCSV = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        const validation = validateCSV(data);
        setParsedData(data);
        setValidationResults(validation);
        setStep('preview');
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        alert('Error parsing CSV file');
      }
    });
  };

  const normalizePhone = (phone) => {
    if (!phone) return '';
    let normalized = phone.replace(/[\s-]/g, '').replace(/^0+/, '');
    if (!normalized.startsWith('+') && !normalized.startsWith('234')) {
      normalized = '+234' + normalized;
    } else if (normalized.startsWith('234')) {
      normalized = '+' + normalized;
    }
    return normalized;
  };

  const validateCSV = (data) => {
    const results = [];
    const seenCombinations = new Set();

    data.forEach((row, index) => {
      const errors = [];
      const normalizedRow = { ...row };

      requiredColumns.forEach(col => {
        if (!row[col] || row[col].trim() === '') {
          errors.push(`${col} is required`);
        }
      });

      if (row.landlord_phone) {
        const phone = normalizePhone(row.landlord_phone);
        normalizedRow.landlord_phone = phone;

        if (!landlordMap.has(phone)) {
          errors.push('Landlord with this phone number does not exist');
        } else {
          normalizedRow.landlord_id = landlordMap.get(phone).id;
        }
      }

      if (row.payment_type_name) {
        const paymentType = paymentTypes.find(
          pt => pt.name.toLowerCase() === row.payment_type_name.trim().toLowerCase()
        );

        if (!paymentType) {
          errors.push('Payment type does not exist');
        } else {
          normalizedRow.payment_type_id = paymentType.id;
          normalizedRow.payment_type_frequency = paymentType.frequency;
        }
      }

      if (row.amount) {
        const amount = parseFloat(row.amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push('Amount must be a valid positive number');
        } else {
          normalizedRow.amount = amount;
        }
      }

      if (row.frequency) {
        const validFrequencies = ['monthly', 'yearly', 'one-time'];
        if (!validFrequencies.includes(row.frequency.toLowerCase())) {
          errors.push('Frequency must be monthly, yearly, or one-time');
        } else {
          normalizedRow.frequency = row.frequency.toLowerCase();
        }
      }

      if (row.start_year) {
        const year = parseInt(row.start_year);
        if (isNaN(year) || year < 2020 || year > 2030) {
          errors.push('Start year must be between 2020 and 2030');
        } else {
          normalizedRow.start_year = year;
        }
      } else {
        normalizedRow.start_year = new Date().getFullYear();
      }

      if (row.start_month) {
        const month = parseInt(row.start_month);
        if (isNaN(month) || month < 1 || month > 12) {
          errors.push('Start month must be between 1 and 12');
        } else {
          normalizedRow.start_month = month;
        }
      } else {
        normalizedRow.start_month = null;
      }

      if (normalizedRow.landlord_id && normalizedRow.payment_type_id && normalizedRow.start_year) {
        const comboKey = `${normalizedRow.landlord_id}_${normalizedRow.payment_type_id}_${normalizedRow.start_year}`;
        if (seenCombinations.has(comboKey)) {
          errors.push('Duplicate assignment in file (same landlord, payment type, and year)');
        } else {
          seenCombinations.add(comboKey);
        }
      }

      results.push({
        rowNumber: index + 1,
        originalRow: row,
        normalizedRow,
        errors,
        isValid: errors.length === 0
      });
    });

    return results;
  };

  const handleImport = async () => {
    const validRows = validationResults.filter(r => r.isValid).map(r => r.normalizedRow);
    if (validRows.length === 0) {
      alert('No valid rows to import');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      const totalRows = validRows.length;
      const skippedRows = [];

      for (const row of validRows) {
        try {
          const { data: existing, error: checkError } = await supabase
            .from('landlord_payment_types')
            .select('id')
            .eq('landlord_id', row.landlord_id)
            .eq('payment_type_id', row.payment_type_id)
            .eq('start_year', row.start_year)
            .maybeSingle();

          if (checkError) throw checkError;

          const assignmentData = {
            landlord_id: row.landlord_id,
            payment_type_id: row.payment_type_id,
            amount: row.amount,
            frequency: row.frequency,
            start_year: row.start_year,
            start_month: row.start_month,
            active: true,
            assigned_by: adminProfile.id,
            assigned_at: new Date().toISOString()
          };

          if (existing) {
            const { error: updateError } = await supabase
              .from('landlord_payment_types')
              .update(assignmentData)
              .eq('id', existing.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('landlord_payment_types')
              .insert(assignmentData);

            if (insertError) throw insertError;
          }
        } catch (error) {
          const validationRow = validationResults.find(v => v.normalizedRow === row);
          skippedRows.push({
            rowNumber: validationRow?.rowNumber,
            reason: error.message,
            data: row
          });
        }
      }

      const successfulCount = totalRows - skippedRows.length;

      await activityLogService.log({
        adminId: adminProfile.id,
        actionType: 'financial_bulk_import',
        entityType: 'landlord_payment_type',
        metadata: {
          total_rows: totalRows,
          successful_rows: successfulCount,
          skipped_rows: skippedRows.length,
          file_name: displayFileName
        }
      });

      setImportResult({
        total_rows: totalRows,
        successful_rows: successfulCount,
        skipped_rows: skippedRows.length,
        skipped_details: skippedRows
      });
      setStep('result');

    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + error.message);
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorCSV = () => {
    const invalidRows = validationResults.filter(r => !r.isValid);
    const csvData = invalidRows.map(row => ({
      row_number: row.rowNumber,
      errors: row.errors.join('; '),
      ...row.originalRow
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'financial_import_errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadSampleCSV = () => {
    const headers = [
      'landlord_phone', 'payment_type_name', 'amount', 'frequency',
      'start_year', 'start_month', 'notes'
    ];

    const sampleData = [
      {
        landlord_phone: '08031234567',
        payment_type_name: 'Dues',
        amount: '5000',
        frequency: 'monthly',
        start_year: '2025',
        start_month: '',
        notes: 'Monthly dues'
      },
      {
        landlord_phone: '08031234567',
        payment_type_name: 'Security',
        amount: '50000',
        frequency: 'yearly',
        start_year: '2025',
        start_month: '',
        notes: 'Annual security fee'
      },
      {
        landlord_phone: '08039876543',
        payment_type_name: 'Levy',
        amount: '10000',
        frequency: 'one-time',
        start_year: '2025',
        start_month: '6',
        notes: 'Development levy'
      }
    ];

    const csv = Papa.unparse({
      fields: headers,
      data: sampleData.map(row => headers.map(h => row[h] || ''))
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_financial_import.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setSelectedFileName('');
    setParsedData([]);
    setValidationResults([]);
    setImportResult(null);
    setStep('upload');
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!adminProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p>Admin access required for bulk import</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bulk-import-container p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Bulk Import Financial Data</h2>
        <p className="text-gray-600">Upload a CSV file to import payment type assignments for landlords</p>
      </div>

      {step === 'upload' && (
        <div className="upload-section">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
            <p className="text-gray-600 mb-4">
              Select a CSV file with financial assignment data. Required columns: landlord_phone, payment_type_name, amount, frequency
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Choose File
              </button>
              <button
                onClick={downloadSampleCSV}
                className="bg-green-800 text-white px-6 py-2 rounded hover:bg-green-900 flex items-center gap-2"
              >
                <Download size={16} />
                Download Sample CSV
              </button>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h4 className="font-semibold mb-2">CSV Format Requirements:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><strong>Required:</strong> landlord_phone, payment_type_name, amount, frequency</li>
              <li><strong>Optional:</strong> start_year, start_month, notes</li>
              <li><strong>landlord_phone:</strong> Must match existing landlord phone number</li>
              <li><strong>payment_type_name:</strong> Must match existing payment type name</li>
              <li><strong>frequency:</strong> monthly, yearly, or one-time</li>
              <li><strong>start_year:</strong> Defaults to current year if not specified</li>
              <li><strong>start_month:</strong> 1-12 for monthly/one-time assignments</li>
              <li><strong>Duplicates:</strong> Same landlord + payment type + year will update existing assignment</li>
            </ul>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="preview-section">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">Preview Import Data</h3>
              <p className="text-sm text-gray-500">File: {displayFileName}</p>
            </div>
            <button
              onClick={resetImport}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
              disabled={importing}
            >
              Upload Different File
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold">{parsedData.length}</div>
              <div className="text-gray-600">Total Rows</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold text-green-600">
                {validationResults.filter(r => r.isValid).length}
              </div>
              <div className="text-gray-600">Valid Rows</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold text-red-600">
                {validationResults.filter(r => !r.isValid).length}
              </div>
              <div className="text-gray-600">Invalid Rows</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Row</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-left">Landlord Phone</th>
                  <th className="border p-2 text-left">Payment Type</th>
                  <th className="border p-2 text-left">Amount</th>
                  <th className="border p-2 text-left">Frequency</th>
                  <th className="border p-2 text-left">Year</th>
                  <th className="border p-2 text-left">Errors</th>
                </tr>
              </thead>
              <tbody>
                {validationResults.map((result) => (
                  <tr key={result.rowNumber} className={!result.isValid ? 'bg-red-50' : ''}>
                    <td className="border p-2">{result.rowNumber}</td>
                    <td className="border p-2">
                      {result.isValid ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                    </td>
                    <td className="border p-2">{result.originalRow.landlord_phone}</td>
                    <td className="border p-2">{result.originalRow.payment_type_name}</td>
                    <td className="border p-2">{result.originalRow.amount}</td>
                    <td className="border p-2">{result.originalRow.frequency}</td>
                    <td className="border p-2">{result.normalizedRow.start_year}</td>
                    <td className="border p-2 text-red-600 text-sm">
                      {result.errors.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 mt-6">
            {validationResults.some(r => !r.isValid) && (
              <button
                onClick={downloadErrorCSV}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 flex items-center"
              >
                <Download size={16} className="mr-2" />
                Download Errors CSV
              </button>
            )}
            <button
              onClick={handleImport}
              disabled={validationResults.filter(r => r.isValid).length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Import Valid Rows ({validationResults.filter(r => r.isValid).length})
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="importing-section text-center py-12">
          <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Importing Financial Data...</h3>
          <p className="text-gray-600">Please wait while we process your data</p>
        </div>
      )}

      {step === 'result' && importResult && (
        <div className="result-section">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold">{importResult.total_rows}</div>
              <div className="text-gray-600">Rows Uploaded</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold text-green-600">{importResult.successful_rows}</div>
              <div className="text-gray-600">Rows Imported</div>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="text-3xl font-bold text-red-600">{importResult.skipped_rows}</div>
              <div className="text-gray-600">Rows Skipped</div>
            </div>
          </div>

          {importResult.skipped_rows > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold mb-2">Skipped Rows:</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Row</th>
                      <th className="border p-2 text-left">Reason</th>
                      <th className="border p-2 text-left">Phone</th>
                      <th className="border p-2 text-left">Payment Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.skipped_details?.map((skip) => (
                      <tr key={skip.rowNumber}>
                        <td className="border p-2">{skip.rowNumber}</td>
                        <td className="border p-2 text-red-600">{skip.reason}</td>
                        <td className="border p-2">{skip.data.landlord_phone}</td>
                        <td className="border p-2">{skip.data.payment_type_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={resetImport}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkImportFinancials;