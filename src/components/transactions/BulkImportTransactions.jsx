import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { transactionService } from '../../services/transactionService';
import { activityLogService } from '../../services/activityLogService';

const BulkImportTransactions = () => {
  const { adminProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [step, setStep] = useState('upload');
  const [categories, setCategories] = useState([]);
  const [landlordMap, setLandlordMap] = useState(new Map());

  const initRef = useRef(false);

  const displayFileName = selectedFileName || 'No file selected';
  const requiredColumns = ['transaction_type', 'category_name', 'amount'];

  const loadCategories = useCallback(async () => {
    try {
      const cats = await transactionService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  const loadLandlords = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      loadCategories();
      loadLandlords();
    }
  }, [loadCategories, loadLandlords]);

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

    data.forEach((row, index) => {
      const errors = [];
      const normalizedRow = { ...row };

      requiredColumns.forEach(col => {
        if (!row[col] || row[col].trim() === '') {
          errors.push(`${col} is required`);
        }
      });

      if (row.transaction_type) {
        const type = row.transaction_type.toLowerCase().trim();
        if (!['credit', 'debit'].includes(type)) {
          errors.push('transaction_type must be "credit" or "debit"');
        } else {
          normalizedRow.transaction_type = type;
        }
      }

      if (row.category_name) {
        const name = row.category_name.trim().toLowerCase();
        const category = categories.find(
          c => c.name.toLowerCase() === name || (c.description && c.description.toLowerCase() === name)
        );

        if (!category) {
          errors.push(`Category "${row.category_name}" not found`);
        } else if (normalizedRow.transaction_type && category.type !== normalizedRow.transaction_type) {
          errors.push(`Category "${row.category_name}" is for ${category.type} transactions, not ${normalizedRow.transaction_type}`);
        } else {
          normalizedRow.category_id = category.id;
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

      if (row.landlord_phone) {
        const phone = normalizePhone(row.landlord_phone);
        normalizedRow.landlord_phone = phone;

        if (!landlordMap.has(phone)) {
          errors.push('Landlord with this phone number does not exist');
        } else {
          normalizedRow.landlord_id = landlordMap.get(phone).id;
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
          await transactionService.create({
            transaction_type: row.transaction_type,
            category_id: row.category_id,
            amount: row.amount,
            description: row.description || null,
            reference: row.reference || null,
            landlord_id: row.landlord_id || null,
          });
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
        actionType: 'transaction_csv_import',
        entityType: 'transaction',
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
    a.download = 'transaction_import_errors.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadSampleCSV = () => {
    const headers = [
      'transaction_type', 'category_name', 'amount', 'description',
      'reference', 'landlord_phone'
    ];

    const sampleData = [
      {
        transaction_type: 'credit',
        category_name: 'rent_income',
        amount: '50000',
        description: 'Monthly rent payment',
        reference: 'RENT-2026-09',
        landlord_phone: '08031234567'
      },
      {
        transaction_type: 'debit',
        category_name: 'maintenance',
        amount: '15000',
        description: 'Plumbing repairs',
        reference: '',
        landlord_phone: ''
      },
      {
        transaction_type: 'debit',
        category_name: 'utilities',
        amount: '8500',
        description: 'Monthly electricity bill',
        reference: 'UTIL-SEP-2026',
        landlord_phone: ''
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
    a.download = 'sample_transactions_import.csv';
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
        <h2 className="text-2xl font-bold mb-2">Bulk Import Transactions</h2>
        <p className="text-gray-600">Upload a CSV file to import multiple transactions at once</p>
      </div>

      {step === 'upload' && (
        <div className="upload-section">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
            <p className="text-gray-600 mb-4">
              Select a CSV file with transaction data. Required columns: transaction_type, category_name, amount
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
              <li><strong>Required:</strong> transaction_type, category_name, amount</li>
              <li><strong>Optional:</strong> description, reference, landlord_phone</li>
              <li><strong>transaction_type:</strong> "credit" or "debit"</li>
              <li><strong>category_name:</strong> Must match an existing transaction category name (e.g., rent_income, maintenance, utilities)</li>
              <li><strong>amount:</strong> Positive number (e.g., 50000)</li>
              <li><strong>landlord_phone:</strong> Must match an existing active landlord phone number. Will be normalized (e.g., 0803xxxxxxx → +234803xxxxxxx)</li>
              <li><strong>Approval:</strong> Debit transactions above the configured threshold will require approval</li>
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
                  <th className="border p-2 text-left">Type</th>
                  <th className="border p-2 text-left">Category</th>
                  <th className="border p-2 text-left">Amount</th>
                  <th className="border p-2 text-left">Description</th>
                  <th className="border p-2 text-left">Landlord Phone</th>
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
                    <td className="border p-2">{result.originalRow.transaction_type}</td>
                    <td className="border p-2">{result.originalRow.category_name}</td>
                    <td className="border p-2">{result.originalRow.amount}</td>
                    <td className="border p-2">{result.originalRow.description || '-'}</td>
                    <td className="border p-2">{result.originalRow.landlord_phone || '-'}</td>
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
          <h3 className="text-lg font-semibold mb-2">Importing Transactions...</h3>
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
                      <th className="border p-2 text-left">Type</th>
                      <th className="border p-2 text-left">Category</th>
                      <th className="border p-2 text-left">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.skipped_details?.map((skip) => (
                      <tr key={skip.rowNumber}>
                        <td className="border p-2">{skip.rowNumber}</td>
                        <td className="border p-2 text-red-600">{skip.reason}</td>
                        <td className="border p-2">{skip.data.transaction_type}</td>
                        <td className="border p-2">{skip.data.category_name}</td>
                        <td className="border p-2">{skip.data.amount}</td>
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

export default BulkImportTransactions;