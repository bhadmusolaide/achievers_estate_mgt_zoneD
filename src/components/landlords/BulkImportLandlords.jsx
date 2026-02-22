import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, Download, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { activityLogService } from '../../services/activityLogService';

const BulkImportLandlords = () => {
  const { adminProfile, user, isAuthenticated } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [step, setStep] = useState('upload');

  const displayFileName = selectedFileName || 'No file selected';
  const requiredColumns = ['full_name', 'phone', 'occupancy_type', 'road'];

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

  // FIX: Correct phone normalization
  const normalizePhone = (phone) => {
    if (!phone) return '';
    
    // Remove spaces, dashes, and leading zeros
    let normalized = phone.replace(/[\s-]/g, '').replace(/^0+/, '');
    
    // Add +234 only if it doesn't already have a country code
    if (!normalized.startsWith('+') && !normalized.startsWith('234')) {
      normalized = '+234' + normalized;
    } else if (normalized.startsWith('234')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  };

  const isValidPhone = (phone) => {
    return /^(\+234|234)\d{10}$/.test(phone);
  };

  const isValidMonthDay = (dateStr) => {
    if (!dateStr) return true;
    const parts = dateStr.split('-');
    if (parts.length !== 2) return false;
    const num1 = parseInt(parts[0], 10);
    const num2 = parseInt(parts[1], 10);
    if (isNaN(num1) || isNaN(num2)) return false;
    return (num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12) ||
           (num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31);
  };

  const validateCSV = (data) => {
    const results = [];
    const seenPhones = new Set();

    data.forEach((row, index) => {
      const errors = [];
      const normalizedRow = { ...row };

      // Check required columns
      requiredColumns.forEach(col => {
        if (!row[col] || row[col].trim() === '') {
          errors.push(`${col} is required`);
        }
      });

      // Normalize and validate phone
      if (row.phone) {
        const normalizedPhone = normalizePhone(row.phone);
        normalizedRow.phone = normalizedPhone;

        if (!isValidPhone(normalizedPhone)) {
          errors.push('Invalid phone number');
        } else if (seenPhones.has(normalizedPhone)) {
          errors.push('Duplicate phone number in file');
        } else {
          seenPhones.add(normalizedPhone);
        }
      }

      // Validate occupancy_type
      if (row.occupancy_type && !['owner', 'tenant'].includes(row.occupancy_type.toLowerCase())) {
        errors.push('occupancy_type must be "owner" or "tenant"');
      } else if (row.occupancy_type) {
        normalizedRow.occupancy_type = row.occupancy_type.toLowerCase();
      }

      // Validate dates
      if (row.date_of_birth && !isValidMonthDay(row.date_of_birth)) {
        errors.push('Invalid date_of_birth format (DD-MM or MM-DD)');
      }

      if (row.wedding_anniversary && !isValidMonthDay(row.wedding_anniversary)) {
        errors.push('Invalid wedding_anniversary format (DD-MM or MM-DD)');
      }

      // Validate celebrate_opt_in
      if (row.celebrate_opt_in !== undefined && row.celebrate_opt_in !== '') {
        const val = row.celebrate_opt_in.toString().toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no'].includes(val)) {
          errors.push('celebrate_opt_in must be true/false');
        } else {
          normalizedRow.celebrate_opt_in = ['true', '1', 'yes'].includes(val);
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

      // Check for duplicates
      const phonesToCheck = validRows.map(row => row.phone);
      const { data: existingLandlords, error: checkError } = await supabase
        .from('landlords')
        .select('phone')
        .in('phone', phonesToCheck);

      if (checkError) {
        throw new Error('Failed to check for duplicates: ' + checkError.message);
      }

      const existingPhones = new Set(existingLandlords?.map(l => l.phone) || []);

      // Filter duplicates and add defaults
      const finalValidRows = [];
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const rowNumber = validationResults.filter(r => r.isValid)[i].rowNumber;

        if (existingPhones.has(row.phone)) {
          skippedRows.push({
            rowNumber,
            reason: 'Phone number already exists',
            data: row
          });
        } else {
          row.onboarding_status = 'pending';
          row.status = 'active';
          finalValidRows.push(row);
        }
      }

      // Insert valid landlords
      let successfulRows = 0;
      if (finalValidRows.length > 0) {
        const { data, error: insertError } = await supabase
          .from('landlords')
          .insert(finalValidRows)
          .select();

        if (insertError) {
          throw new Error('Failed to insert landlords: ' + insertError.message);
        }

        successfulRows = data?.length || 0;
      }

      // Log activity
      const activityLog = await activityLogService.log({
        adminId: adminProfile.id,
        actionType: 'landlord_csv_import',
        entityType: 'landlord',
        metadata: {
          total_rows: totalRows,
          successful_rows: successfulRows,
          skipped_rows: skippedRows.length,
          file_name: displayFileName
        }
      });

      // Log skipped details
      if (skippedRows.length > 0 && activityLog) {
        const skippedDetails = skippedRows.map(skip => ({
          activity_log_id: activityLog.id,
          row_number: skip.rowNumber,
          failure_reason: skip.reason,
          row_data: skip.data
        }));

        const { error: detailsError } = await supabase
          .from('activity_log_details')
          .insert(skippedDetails);

        if (detailsError) {
          console.error('Failed to log skipped details:', detailsError);
        }
      }

      setImportResult({
        total_rows: totalRows,
        successful_rows: successfulRows,
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
    a.download = 'import_errors.csv';
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
        <h2 className="text-2xl font-bold mb-2">Bulk Import Landlords</h2>
        <p className="text-gray-600">Upload a CSV file to import multiple landlords at once</p>
      </div>

      {step === 'upload' && (
        <div className="upload-section">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
            <p className="text-gray-600 mb-4">
              Select a CSV file with landlord data. Required columns: full_name, phone, occupancy_type, road
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Choose File
            </button>
          </div>

          <div className="mt-6 bg-gray-50 p-4 rounded">
            <h4 className="font-semibold mb-2">CSV Format Requirements:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><strong>Required:</strong> full_name, phone, occupancy_type, road</li>
              <li><strong>Optional:</strong> email, house_address, zone, date_of_birth, wedding_anniversary, celebrate_opt_in</li>
              <li><strong>Phone:</strong> Will be normalized (e.g., 0803xxxxxxx → +234803xxxxxxx)</li>
              <li><strong>Dates:</strong> DD-MM or MM-DD format (e.g., 25-12 or 12-25)</li>
              <li><strong>celebrate_opt_in:</strong> true/false, 1/0, yes/no</li>
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
                  <th className="border p-2 text-left">Full Name</th>
                  <th className="border p-2 text-left">Phone</th>
                  <th className="border p-2 text-left">Type</th>
                  <th className="border p-2 text-left">Email</th>
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
                    <td className="border p-2">{result.originalRow.full_name}</td>
                    <td className="border p-2">{result.normalizedRow.phone}</td>
                    <td className="border p-2">{result.normalizedRow.occupancy_type}</td>
                    <td className="border p-2">{result.originalRow.email}</td>
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
          <h3 className="text-lg font-semibold mb-2">Importing Landlords...</h3>
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
                      <th className="border p-2 text-left">Name</th>
                      <th className="border p-2 text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.skipped_details?.map((skip) => (
                      <tr key={skip.rowNumber}>
                        <td className="border p-2">{skip.rowNumber}</td>
                        <td className="border p-2 text-red-600">{skip.reason}</td>
                        <td className="border p-2">{skip.data.full_name}</td>
                        <td className="border p-2">{skip.data.phone}</td>
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

export default BulkImportLandlords;