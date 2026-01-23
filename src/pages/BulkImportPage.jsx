import BulkImportLandlords from '../components/landlords/BulkImportLandlords';
import Header from '../components/layout/Header';

const BulkImportPage = () => {
  return (
    <div className="page bulk-import-page">
      <Header title="Bulk Import" />
      <div className="page-content">
        <BulkImportLandlords />
      </div>
    </div>
  );
};

export default BulkImportPage;