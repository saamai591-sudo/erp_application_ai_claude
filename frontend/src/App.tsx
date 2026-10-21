import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { TabsProvider } from "./lib/TabsContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Roles from "./pages/Roles";
import Users from "./pages/Users";
import Currencies from "./pages/Currencies";
import ExchangeRates from "./pages/ExchangeRates";
import FiscalPeriods from "./pages/FiscalPeriods";
import ReportingPeriods from "./pages/ReportingPeriods";
import GoodsPricing from "./pages/GoodsPricing";
import IssueWarehouseJournalEntries from "./pages/IssueWarehouseJournalEntries";
import OrgStructure from "./pages/OrgStructure";
import GeoRegions from "./pages/GeoRegions";
import DetailTypes from "./pages/DetailTypes";
import PartyIndividual from "./pages/PartyIndividual";
import PartyLegal from "./pages/PartyLegal";
import CashBoxes from "./pages/CashBoxes";
import BankAccountTypes from "./pages/BankAccountTypes";
import BankBranches from "./pages/BankBranches";
import BankAccounts from "./pages/BankAccounts";
import OrgUnits from "./pages/OrgUnits";
import CostCenters from "./pages/CostCenters";
import ReportingLevels from "./pages/ReportingLevels";
import Accounts from "./pages/Accounts";
import DocumentTypes from "./pages/DocumentTypes";
import JournalEntries from "./pages/JournalEntries";
import AccountClosing from "./pages/AccountClosing";
import AccountingSettings from "./pages/AccountingSettings";
import OpeningClosing from "./pages/OpeningClosing";
import DocumentConfirmation from "./pages/DocumentConfirmation";
import JournalConsolidation from "./pages/JournalConsolidation";
import AccountsReview from "./pages/AccountsReview";
import OlapReports from "./pages/OlapReports";
import UnitsOfMeasure from "./pages/UnitsOfMeasure";
import WarehouseGroups from "./pages/WarehouseGroups";
import Warehouses from "./pages/Warehouses";
import PhysicalLocations from "./pages/PhysicalLocations";
import Batches from "./pages/Batches";
import Serials from "./pages/Serials";
import GoodsGroupLevels from "./pages/GoodsGroupLevels";
import GoodsGroups from "./pages/GoodsGroups";
import GoodsAttributes from "./pages/GoodsAttributes";
import AccountingGroups from "./pages/AccountingGroups";
import GoodsServiceAccounting from "./pages/GoodsServiceAccounting";
import GoodsRequestTypes from "./pages/GoodsRequestTypes";
import Goods from "./pages/Goods";
import Services from "./pages/Services";
import InitialInventory from "./pages/InitialInventory";
import WarehouseReceipts from "./pages/WarehouseReceipts";
import CenterConsumptions from "./pages/CenterConsumptions";
import ProjectConsumptions from "./pages/ProjectConsumptions";
import ProductionConsumptions from "./pages/ProductionConsumptions";
import CenterConsumptionReturns from "./pages/CenterConsumptionReturns";
import ProjectConsumptionReturns from "./pages/ProjectConsumptionReturns";
import ProductionConsumptionReturns from "./pages/ProductionConsumptionReturns";
import SalesReturns from "./pages/SalesReturns";
import SupplierReturns from "./pages/SupplierReturns";
import ProductionReceipts from "./pages/ProductionReceipts";
import FixedAssetIssues from "./pages/FixedAssetIssues";
import InventoryCountingShortages from "./pages/InventoryCountingShortages";
import WarehouseTransferOut from "./pages/WarehouseTransferOut";
import WarehouseTransferIn from "./pages/WarehouseTransferIn";
import WarehouseAdjustments from "./pages/WarehouseAdjustments";
import WarehouseConfirmation from "./pages/WarehouseConfirmation";
import WarehouseQuantityClose from "./pages/WarehouseQuantityClose";
import InventoryAccountingClose from "./pages/InventoryAccountingClose";
import GoodsRequests from "./pages/GoodsRequests";
import SupplyRequests from "./pages/SupplyRequests";
import Suppliers from "./pages/Suppliers";
import PurchaseGroups from "./pages/PurchaseGroups";
import PurchaseExperts from "./pages/PurchaseExperts";
import PurchaseRoutes from "./pages/PurchaseRoutes";
import PurchaseTypes from "./pages/PurchaseTypes";
import PurchaseRequests from "./pages/PurchaseRequests";
import PurchasePlannings from "./pages/PurchasePlannings";
import InquiryAuthorizations from "./pages/InquiryAuthorizations";
import PriceInquiries from "./pages/PriceInquiries";
import InquiryEvaluations from "./pages/InquiryEvaluations";
import PurchaseOrders from "./pages/PurchaseOrders";
import DeliveryAuthorizations from "./pages/DeliveryAuthorizations";
import Customers from "./pages/Customers";
import SalesTypes from "./pages/SalesTypes";
import SalesCenters from "./pages/SalesCenters";
import SalesQuoteLostReasons from "./pages/SalesQuoteLostReasons";
import SalesPriceLists from "./pages/SalesPriceLists";
import FrequentDescriptions from "./pages/FrequentDescriptions";
import ReceiptTypes from "./pages/ReceiptTypes";
import PaymentTypes from "./pages/PaymentTypes";
import { ReceivableChequeTypes, PayableChequeTypes } from "./pages/ChequeTypes";
import TreasuryAccountSettings from "./pages/TreasuryAccountSettings";
import ChequeBookLeaves from "./pages/ChequeBookLeaves";
import PettyCashes from "./pages/PettyCashes";
import TaxMemories from "./pages/TaxMemories";
import Employees from "./pages/Employees";
import Positions from "./pages/Positions";
import Jobs from "./pages/Jobs";
import { EmploymentTypes, EducationLevels, TerminationReasons, DecreeComponents } from "./pages/HrMasters";
import EmploymentDecrees from "./pages/EmploymentDecrees";
import LegalParameters from "./pages/LegalParameters";
import PayrollDataEntry from "./pages/PayrollDataEntry";
import PersonnelConstants from "./pages/PersonnelConstants";
import PayrollComponents from "./pages/PayrollComponents";
import PayrollCalcTypes from "./pages/PayrollCalcTypes";
import LoanTypes from "./pages/LoanTypes";
import LoanPayments from "./pages/LoanPayments";
import { LoanAdjustments, LoanSuspensions } from "./pages/LoanDocs";
import WorkCalendars from "./pages/WorkCalendars";
import FactorMethods from "./pages/FactorMethods";
import { PayrollReportPage } from "./pages/PayrollCalculation";
import PayrollCalculateMonth from "./pages/PayrollCalculateMonth";
import { EmployeeEducation, EmployeeVeteran, EmployeeMarital } from "./pages/HrRecords";
import TradeLedgers from "./pages/TradeLedgers";
import TaxInvoiceSubmission from "./pages/TaxInvoiceSubmission";
import WarehouseDocDetails from "./pages/WarehouseDocDetails";
import DetailRules from "./pages/DetailRules";
import NumberingPatterns from "./pages/NumberingPatterns";
import ScheduledJobs from "./pages/ScheduledJobs";
import CompanyProfile from "./pages/CompanyProfile";
import PrintTemplates from "./pages/PrintTemplates";
import Management from "./pages/Management";
import PettyCashCustodians from "./pages/PettyCashCustodians";
import PettyCashPayments from "./pages/PettyCashPayments";
import PettyCashSummaries from "./pages/PettyCashSummaries";
import SalesQuotes from "./pages/SalesQuotes";
import SalesOrders from "./pages/SalesOrders";
import SalesDeliveries from "./pages/SalesDeliveries";
import SalesInvoices from "./pages/SalesInvoices";
import SalesReturnInvoices from "./pages/SalesReturnInvoices";
import SalesReview from "./pages/SalesReview";
import PurchaseReview from "./pages/PurchaseReview";
import BankAccountReview from "./pages/BankAccountReview";
import CashReview from "./pages/CashReview";
import PettyCashReview from "./pages/PettyCashReview";
import ChequeDocumentsReview from "./pages/ChequeDocumentsReview";
import TreasuryOpenings from "./pages/TreasuryOpenings";
import TreasuryYearClose from "./pages/TreasuryYearClose";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import ServicePurchaseInvoices from "./pages/ServicePurchaseInvoices";
import WarehouseReview from "./pages/WarehouseReview";
import Receipts from "./pages/Receipts";
import Payments from "./pages/Payments";
import Cheques from "./pages/Cheques";
import ChequeDeposits from "./pages/ChequeDeposits";
import ChequeDepositReturns from "./pages/ChequeDepositReturns";
import ChequeClearingReceivable from "./pages/ChequeClearingReceivable";
import ChequeClearingPayable from "./pages/ChequeClearingPayable";

import BeneficiaryOrgs from "./pages/BeneficiaryOrgs";
import PayrollAccountGroups from "./pages/PayrollAccountGroups";
import PayrollJournalTemplates from "./pages/PayrollJournalTemplates";
import PayrollIssueSettings from "./pages/PayrollIssueSettings";
import BeneficiaryBranches from "./pages/BeneficiaryBranches";
import { ToastHost } from "./components/ToastHost";
import { UsageDialogHost } from "./components/UsageDialogHost";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastHost />
        <TabsProvider>
        <UsageDialogHost />
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* «مدیریت» (لایسنس): جدا از ورود ERP، با کلمه‌ی عبور خودش */}
          <Route path="/management" element={<Management />} />
          <Route element={<Layout />}>
            <Route index element={<Welcome />} />

            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/new" element={<Roles />} />
            <Route path="/roles/:id/edit" element={<Roles />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/new" element={<Users />} />
            <Route path="/users/:id/edit" element={<Users />} />
            <Route path="/currencies" element={<Currencies />} />
            <Route path="/currencies/new" element={<Currencies />} />
            <Route path="/currencies/:id/edit" element={<Currencies />} />
            <Route path="/exchange-rates" element={<ExchangeRates />} />
            <Route path="/exchange-rates/new" element={<ExchangeRates />} />
            <Route path="/exchange-rates/:id/edit" element={<ExchangeRates />} />
            <Route path="/fiscal-periods" element={<FiscalPeriods />} />
            <Route path="/fiscal-periods/new" element={<FiscalPeriods />} />
            <Route path="/fiscal-periods/:id/edit" element={<FiscalPeriods />} />
            <Route path="/reporting-periods" element={<ReportingPeriods />} />
            <Route path="/reporting-periods/new" element={<ReportingPeriods />} />
            <Route path="/reporting-periods/:id/edit" element={<ReportingPeriods />} />
            <Route path="/warehouse-accounting/goods-pricing" element={<GoodsPricing />} />
            <Route path="/warehouse-accounting/issue-journal-entries" element={<IssueWarehouseJournalEntries />} />
            <Route path="/warehouse-accounting/issue-journal-entries/new" element={<IssueWarehouseJournalEntries />} />
            <Route path="/warehouse-accounting/issue-journal-entries/:id/edit" element={<IssueWarehouseJournalEntries />} />
            <Route path="/org-structure" element={<OrgStructure />} />
            <Route path="/org-structure/new" element={<OrgStructure />} />
            <Route path="/org-structure/:id/edit" element={<OrgStructure />} />
            <Route path="/geo-regions" element={<GeoRegions />} />
            <Route path="/geo-regions/new" element={<GeoRegions />} />
            <Route path="/geo-regions/:id/edit" element={<GeoRegions />} />
            <Route path="/frequent-descriptions" element={<FrequentDescriptions />} />
            <Route path="/frequent-descriptions/:id/edit" element={<FrequentDescriptions />} />
            <Route path="/detail-types" element={<DetailTypes />} />

            <Route path="/parties/individual" element={<PartyIndividual />} />
            <Route path="/parties/individual/new" element={<PartyIndividual />} />
            <Route path="/parties/individual/:id/edit" element={<PartyIndividual />} />
            <Route path="/parties/legal" element={<PartyLegal />} />
            <Route path="/parties/legal/new" element={<PartyLegal />} />
            <Route path="/parties/legal/:id/edit" element={<PartyLegal />} />
            <Route path="/cash-boxes" element={<CashBoxes />} />
            <Route path="/cash-boxes/new" element={<CashBoxes />} />
            <Route path="/cash-boxes/:id/edit" element={<CashBoxes />} />
            <Route path="/bank-account-types" element={<BankAccountTypes />} />
            <Route path="/bank-account-types/new" element={<BankAccountTypes />} />
            <Route path="/bank-account-types/:id/edit" element={<BankAccountTypes />} />
            <Route path="/bank-branches" element={<BankBranches />} />
            <Route path="/bank-branches/new" element={<BankBranches />} />
            <Route path="/bank-branches/:id/edit" element={<BankBranches />} />
            <Route path="/bank-accounts" element={<BankAccounts />} />
            <Route path="/bank-accounts/new" element={<BankAccounts />} />
            <Route path="/bank-accounts/:id/edit" element={<BankAccounts />} />
            <Route path="/cost-centers" element={<CostCenters />} />
            <Route path="/cost-centers/new" element={<CostCenters />} />
            <Route path="/cost-centers/:id/edit" element={<CostCenters />} />
            <Route path="/org-units" element={<OrgUnits />} />
            <Route path="/org-units/new" element={<OrgUnits />} />
            <Route path="/org-units/:id/edit" element={<OrgUnits />} />

            <Route path="/reporting-levels" element={<ReportingLevels />} />
            <Route path="/reporting-levels/new" element={<ReportingLevels />} />
            <Route path="/reporting-levels/:id/edit" element={<ReportingLevels />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/new" element={<Accounts />} />
            <Route path="/accounts/:id/edit" element={<Accounts />} />
            <Route path="/document-types" element={<DocumentTypes />} />
            <Route path="/document-types/new" element={<DocumentTypes />} />
            <Route path="/document-types/:id/edit" element={<DocumentTypes />} />
            <Route path="/journal-entries" element={<JournalEntries />} />
            <Route path="/journal-entries/new" element={<JournalEntries />} />
            <Route path="/journal-entries/:id/edit" element={<JournalEntries />} />
            <Route path="/accounting-settings" element={<AccountingSettings />} />
            <Route path="/account-closing" element={<AccountClosing />} />
            <Route path="/account-closing/new" element={<AccountClosing />} />
            <Route path="/account-closing/:id" element={<AccountClosing />} />
            <Route path="/opening-closing" element={<OpeningClosing />} />
            <Route path="/opening-closing/new" element={<OpeningClosing />} />
            <Route path="/opening-closing/:id" element={<OpeningClosing />} />
            <Route path="/document-confirmation" element={<DocumentConfirmation />} />
            <Route path="/journal-consolidation" element={<JournalConsolidation />} />
            <Route path="/journal-consolidation/new" element={<JournalConsolidation />} />
            <Route path="/journal-consolidation/:id/edit" element={<JournalConsolidation />} />
            <Route path="/account-review" element={<AccountsReview />} />
            <Route path="/olap-reports" element={<OlapReports />} />
            <Route path="/olap-reports/new" element={<OlapReports />} />
            <Route path="/olap-reports/:id/edit" element={<OlapReports />} />

            <Route path="/units-of-measure" element={<UnitsOfMeasure />} />
            <Route path="/units-of-measure/new" element={<UnitsOfMeasure />} />
            <Route path="/units-of-measure/:id/edit" element={<UnitsOfMeasure />} />
            <Route path="/warehouse-groups" element={<WarehouseGroups />} />
            <Route path="/warehouse-groups/new" element={<WarehouseGroups />} />
            <Route path="/warehouse-groups/:id/edit" element={<WarehouseGroups />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/warehouses/new" element={<Warehouses />} />
            <Route path="/warehouses/:id/edit" element={<Warehouses />} />
            <Route path="/physical-locations" element={<PhysicalLocations />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/batches/new" element={<Batches />} />
            <Route path="/batches/:id/edit" element={<Batches />} />
            <Route path="/serials" element={<Serials />} />
            <Route path="/serials/new" element={<Serials />} />
            <Route path="/serials/:id/edit" element={<Serials />} />
            <Route path="/goods-group-levels" element={<GoodsGroupLevels />} />
            <Route path="/goods-group-levels/new" element={<GoodsGroupLevels />} />
            <Route path="/goods-group-levels/:id/edit" element={<GoodsGroupLevels />} />
            <Route path="/goods-groups" element={<GoodsGroups />} />
            <Route path="/goods-groups/new" element={<GoodsGroups />} />
            <Route path="/goods-groups/:id/edit" element={<GoodsGroups />} />
            <Route path="/goods-attributes" element={<GoodsAttributes />} />
            <Route path="/goods-attributes/new" element={<GoodsAttributes />} />
            <Route path="/goods-attributes/:id/edit" element={<GoodsAttributes />} />
            <Route path="/accounting-groups" element={<AccountingGroups />} />
            <Route path="/accounting-groups/new" element={<AccountingGroups />} />
            <Route path="/accounting-groups/:id/edit" element={<AccountingGroups />} />
            <Route path="/goods-service-accounting" element={<GoodsServiceAccounting />} />
            <Route path="/goods-service-accounting/new" element={<GoodsServiceAccounting />} />
            <Route path="/goods-service-accounting/:id/edit" element={<GoodsServiceAccounting />} />
            <Route path="/goods-request-types" element={<GoodsRequestTypes />} />
            <Route path="/goods-request-types/new" element={<GoodsRequestTypes />} />
            <Route path="/goods-request-types/:id/edit" element={<GoodsRequestTypes />} />
            <Route path="/goods" element={<Goods />} />
            <Route path="/goods/new" element={<Goods />} />
            <Route path="/goods/:id/edit" element={<Goods />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/new" element={<Services />} />
            <Route path="/services/:id/edit" element={<Services />} />

            <Route path="/warehousing/initial-inventory" element={<InitialInventory />} />
            <Route path="/warehousing/initial-inventory/new" element={<InitialInventory />} />
            <Route path="/warehousing/initial-inventory/:id/edit" element={<InitialInventory />} />

            <Route path="/warehousing/warehouse-receipts" element={<WarehouseReceipts />} />
            <Route path="/warehousing/warehouse-receipts/new" element={<WarehouseReceipts />} />
            <Route path="/warehousing/warehouse-receipts/:id/edit" element={<WarehouseReceipts />} />
            <Route path="/warehousing/warehouse-review" element={<WarehouseReview mode="qty" />} />
            <Route path="/warehouse-accounting/warehouse-review" element={<WarehouseReview mode="amount" />} />

            <Route path="/center-consumptions" element={<CenterConsumptions />} />
            <Route path="/center-consumptions/new" element={<CenterConsumptions />} />
            <Route path="/center-consumptions/:id/edit" element={<CenterConsumptions />} />
            <Route path="/project-consumptions" element={<ProjectConsumptions />} />
            <Route path="/project-consumptions/new" element={<ProjectConsumptions />} />
            <Route path="/project-consumptions/:id/edit" element={<ProjectConsumptions />} />
            <Route path="/production-consumptions" element={<ProductionConsumptions />} />
            <Route path="/production-consumptions/new" element={<ProductionConsumptions />} />
            <Route path="/production-consumptions/:id/edit" element={<ProductionConsumptions />} />
            <Route path="/center-consumption-returns" element={<CenterConsumptionReturns />} />
            <Route path="/center-consumption-returns/new" element={<CenterConsumptionReturns />} />
            <Route path="/center-consumption-returns/:id/edit" element={<CenterConsumptionReturns />} />
            <Route path="/project-consumption-returns" element={<ProjectConsumptionReturns />} />
            <Route path="/project-consumption-returns/new" element={<ProjectConsumptionReturns />} />
            <Route path="/project-consumption-returns/:id/edit" element={<ProjectConsumptionReturns />} />
            <Route path="/production-consumption-returns" element={<ProductionConsumptionReturns />} />
            <Route path="/production-consumption-returns/new" element={<ProductionConsumptionReturns />} />
            <Route path="/production-consumption-returns/:id/edit" element={<ProductionConsumptionReturns />} />
            <Route path="/sales-returns" element={<SalesReturns />} />
            <Route path="/sales-returns/new" element={<SalesReturns />} />
            <Route path="/sales-returns/:id/edit" element={<SalesReturns />} />
            <Route path="/supplier-returns" element={<SupplierReturns />} />
            <Route path="/supplier-returns/new" element={<SupplierReturns />} />
            <Route path="/supplier-returns/:id/edit" element={<SupplierReturns />} />
            <Route path="/production-receipts" element={<ProductionReceipts />} />
            <Route path="/production-receipts/new" element={<ProductionReceipts />} />
            <Route path="/production-receipts/:id/edit" element={<ProductionReceipts />} />
            <Route path="/fixed-asset-issues" element={<FixedAssetIssues />} />
            <Route path="/fixed-asset-issues/new" element={<FixedAssetIssues />} />
            <Route path="/fixed-asset-issues/:id/edit" element={<FixedAssetIssues />} />
            <Route path="/inventory-counting-shortages" element={<InventoryCountingShortages />} />
            <Route path="/inventory-counting-shortages/new" element={<InventoryCountingShortages />} />
            <Route path="/inventory-counting-shortages/:id/edit" element={<InventoryCountingShortages />} />

            <Route path="/warehousing/warehouse-transfer-out" element={<WarehouseTransferOut />} />
            <Route path="/warehousing/warehouse-transfer-out/new" element={<WarehouseTransferOut />} />
            <Route path="/warehousing/warehouse-transfer-out/:id/edit" element={<WarehouseTransferOut />} />
            <Route path="/warehousing/warehouse-transfer-in" element={<WarehouseTransferIn />} />
            <Route path="/warehousing/warehouse-transfer-in/new" element={<WarehouseTransferIn />} />
            <Route path="/warehousing/warehouse-transfer-in/:id/edit" element={<WarehouseTransferIn />} />

            <Route path="/warehousing/warehouse-adjustments" element={<WarehouseAdjustments />} />
            <Route path="/warehousing/warehouse-adjustments/new" element={<WarehouseAdjustments />} />
            <Route path="/warehousing/warehouse-adjustments/:id/edit" element={<WarehouseAdjustments />} />

            <Route path="/warehousing/warehouse-confirmation" element={<WarehouseConfirmation />} />
            <Route path="/warehousing/quantity-close" element={<WarehouseQuantityClose />} />
            <Route path="/warehousing/accounting-close" element={<InventoryAccountingClose />} />

            <Route path="/goods-requests" element={<GoodsRequests />} />
            <Route path="/goods-requests/new" element={<GoodsRequests />} />
            <Route path="/goods-requests/:id/edit" element={<GoodsRequests />} />
            <Route path="/supply-requests" element={<SupplyRequests />} />
            <Route path="/supply-requests/new" element={<SupplyRequests />} />
            <Route path="/supply-requests/:id/edit" element={<SupplyRequests />} />

            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suppliers/new" element={<Suppliers />} />
            <Route path="/suppliers/:id/edit" element={<Suppliers />} />
            <Route path="/purchase-groups" element={<PurchaseGroups />} />
            <Route path="/purchase-groups/new" element={<PurchaseGroups />} />
            <Route path="/purchase-groups/:id/edit" element={<PurchaseGroups />} />
            <Route path="/purchase-experts" element={<PurchaseExperts />} />
            <Route path="/purchase-experts/new" element={<PurchaseExperts />} />
            <Route path="/purchase-experts/:id/edit" element={<PurchaseExperts />} />
            <Route path="/purchase-routes" element={<PurchaseRoutes />} />
            <Route path="/purchase-routes/new" element={<PurchaseRoutes />} />
            <Route path="/purchase-routes/:id/edit" element={<PurchaseRoutes />} />
            <Route path="/purchase-types" element={<PurchaseTypes />} />
            <Route path="/purchase-types/new" element={<PurchaseTypes />} />
            <Route path="/purchase-types/:id/edit" element={<PurchaseTypes />} />

            <Route path="/purchase-requests" element={<PurchaseRequests />} />
            <Route path="/purchase-requests/new" element={<PurchaseRequests />} />
            <Route path="/purchase-requests/:id/edit" element={<PurchaseRequests />} />
            <Route path="/purchase-plannings" element={<PurchasePlannings />} />
            <Route path="/purchase-plannings/new" element={<PurchasePlannings />} />
            <Route path="/purchase-plannings/:id/edit" element={<PurchasePlannings />} />
            <Route path="/inquiry-authorizations" element={<InquiryAuthorizations />} />
            <Route path="/inquiry-authorizations/new" element={<InquiryAuthorizations />} />
            <Route path="/inquiry-authorizations/:id/edit" element={<InquiryAuthorizations />} />
            <Route path="/price-inquiries" element={<PriceInquiries />} />
            <Route path="/price-inquiries/new" element={<PriceInquiries />} />
            <Route path="/price-inquiries/:id/edit" element={<PriceInquiries />} />
            <Route path="/inquiry-evaluations" element={<InquiryEvaluations />} />
            <Route path="/inquiry-evaluations/new" element={<InquiryEvaluations />} />
            <Route path="/inquiry-evaluations/:id/edit" element={<InquiryEvaluations />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/purchase-orders/new" element={<PurchaseOrders />} />
            <Route path="/purchase-orders/:id/edit" element={<PurchaseOrders />} />
            <Route path="/delivery-authorizations" element={<DeliveryAuthorizations />} />
            <Route path="/delivery-authorizations/new" element={<DeliveryAuthorizations />} />
            <Route path="/delivery-authorizations/:id/edit" element={<DeliveryAuthorizations />} />
            <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
            <Route path="/purchase-invoices/new" element={<PurchaseInvoices />} />
            <Route path="/purchase-invoices/:id/edit" element={<PurchaseInvoices />} />
            <Route path="/service-purchase-invoices" element={<ServicePurchaseInvoices />} />
            <Route path="/service-purchase-invoices/new" element={<ServicePurchaseInvoices />} />
            <Route path="/service-purchase-invoices/:id/edit" element={<ServicePurchaseInvoices />} />

            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/new" element={<Customers />} />
            <Route path="/customers/:id/edit" element={<Customers />} />
            <Route path="/sales-types" element={<SalesTypes />} />
            <Route path="/sales-types/new" element={<SalesTypes />} />
            <Route path="/sales-types/:id/edit" element={<SalesTypes />} />
            <Route path="/sales-centers" element={<SalesCenters />} />
            <Route path="/sales-centers/new" element={<SalesCenters />} />
            <Route path="/sales-centers/:id/edit" element={<SalesCenters />} />
            <Route path="/sales-quote-lost-reasons" element={<SalesQuoteLostReasons />} />
            <Route path="/sales-quote-lost-reasons/new" element={<SalesQuoteLostReasons />} />
            <Route path="/sales-quote-lost-reasons/:id/edit" element={<SalesQuoteLostReasons />} />
            <Route path="/sales-price-lists" element={<SalesPriceLists />} />
            <Route path="/sales-price-lists/new" element={<SalesPriceLists />} />
            <Route path="/sales-price-lists/:id/edit" element={<SalesPriceLists />} />
            <Route path="/receipt-types" element={<ReceiptTypes />} />
            <Route path="/receipt-types/new" element={<ReceiptTypes />} />
            <Route path="/receipt-types/:id/edit" element={<ReceiptTypes />} />
            <Route path="/payment-types" element={<PaymentTypes />} />
            <Route path="/payment-types/new" element={<PaymentTypes />} />
            <Route path="/payment-types/:id/edit" element={<PaymentTypes />} />
            <Route path="/receivable-cheque-types" element={<ReceivableChequeTypes />} />
            <Route path="/receivable-cheque-types/new" element={<ReceivableChequeTypes />} />
            <Route path="/receivable-cheque-types/:id/edit" element={<ReceivableChequeTypes />} />
            <Route path="/payable-cheque-types" element={<PayableChequeTypes />} />
            <Route path="/payable-cheque-types/new" element={<PayableChequeTypes />} />
            <Route path="/payable-cheque-types/:id/edit" element={<PayableChequeTypes />} />
            <Route path="/treasury-account-settings" element={<TreasuryAccountSettings />} />
            <Route path="/treasury-account-settings/new" element={<TreasuryAccountSettings />} />
            <Route path="/treasury-account-settings/:id/edit" element={<TreasuryAccountSettings />} />
            <Route path="/cheque-book-leaves" element={<ChequeBookLeaves />} />
            <Route path="/cheque-book-leaves/new" element={<ChequeBookLeaves />} />
            <Route path="/cheque-book-leaves/:id/edit" element={<ChequeBookLeaves />} />
            <Route path="/numbering-patterns" element={<NumberingPatterns />} />
            <Route path="/numbering-patterns/new" element={<NumberingPatterns />} />
            <Route path="/numbering-patterns/:id/edit" element={<NumberingPatterns />} />
            <Route path="/scheduled-jobs" element={<ScheduledJobs />} />
            <Route path="/company-profile" element={<CompanyProfile />} />
            <Route path="/print-templates" element={<PrintTemplates />} />
            <Route path="/print-templates/new" element={<PrintTemplates />} />
            <Route path="/print-templates/:id/edit" element={<PrintTemplates />} />
            <Route path="/tax-memories" element={<TaxMemories />} />
            <Route path="/tax-memories/new" element={<TaxMemories />} />
            <Route path="/tax-memories/:id/edit" element={<TaxMemories />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/new" element={<Employees />} />
            <Route path="/employees/:id/edit" element={<Employees />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/positions/new" element={<Positions />} />
            <Route path="/positions/:id/edit" element={<Positions />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<Jobs />} />
            <Route path="/jobs/:id/edit" element={<Jobs />} />
            <Route path="/decree-components" element={<DecreeComponents />} />
            <Route path="/decree-components/new" element={<DecreeComponents />} />
            <Route path="/decree-components/:id/edit" element={<DecreeComponents />} />
            <Route path="/employment-decrees" element={<EmploymentDecrees />} />
            <Route path="/employment-decrees/new" element={<EmploymentDecrees />} />
            <Route path="/employment-decrees/:id/edit" element={<EmploymentDecrees />} />
            <Route path="/legal-parameters" element={<LegalParameters />} />
            <Route path="/legal-parameters/new" element={<LegalParameters />} />
            <Route path="/legal-parameters/:id/edit" element={<LegalParameters />} />
            <Route path="/work-calendars" element={<WorkCalendars />} />
            <Route path="/work-calendars/new" element={<WorkCalendars />} />
            <Route path="/work-calendars/:id/edit" element={<WorkCalendars />} />
            <Route path="/beneficiary-orgs" element={<BeneficiaryOrgs />} />
            <Route path="/beneficiary-orgs/new" element={<BeneficiaryOrgs />} />
            <Route path="/beneficiary-orgs/:id/edit" element={<BeneficiaryOrgs />} />
            <Route path="/beneficiary-branches" element={<BeneficiaryBranches />} />
            <Route path="/beneficiary-branches/new" element={<BeneficiaryBranches />} />
            <Route path="/beneficiary-branches/:id/edit" element={<BeneficiaryBranches />} />
            <Route path="/payroll-calc-types" element={<PayrollCalcTypes />} />
            <Route path="/payroll-calc-types/new" element={<PayrollCalcTypes />} />
            <Route path="/payroll-calc-types/:id/edit" element={<PayrollCalcTypes />} />
            <Route path="/payroll-account-groups" element={<PayrollAccountGroups />} />
            <Route path="/payroll-account-groups/new" element={<PayrollAccountGroups />} />
            <Route path="/payroll-account-groups/:id/edit" element={<PayrollAccountGroups />} />
            <Route path="/payroll-journal-templates" element={<PayrollJournalTemplates />} />
            <Route path="/payroll-journal-templates/new" element={<PayrollJournalTemplates />} />
            <Route path="/payroll-journal-templates/bulk" element={<PayrollJournalTemplates />} />
            <Route path="/payroll-journal-templates/:id/edit" element={<PayrollJournalTemplates />} />
            <Route path="/payroll-issue-settings" element={<PayrollIssueSettings />} />
            <Route path="/payroll-issue-settings/new" element={<PayrollIssueSettings />} />
            <Route path="/payroll-issue-settings/bulk" element={<PayrollIssueSettings />} />
            <Route path="/payroll-issue-settings/:id/edit" element={<PayrollIssueSettings />} />
            <Route path="/loan-types" element={<LoanTypes />} />
            <Route path="/loan-types/new" element={<LoanTypes />} />
            <Route path="/loan-types/:id/edit" element={<LoanTypes />} />
            <Route path="/loan-payments" element={<LoanPayments />} />
            <Route path="/loan-payments/new" element={<LoanPayments />} />
            <Route path="/loan-payments/:id/edit" element={<LoanPayments />} />
            <Route path="/loan-adjustments" element={<LoanAdjustments />} />
            <Route path="/loan-adjustments/new" element={<LoanAdjustments />} />
            <Route path="/loan-adjustments/:id/edit" element={<LoanAdjustments />} />
            <Route path="/loan-suspensions" element={<LoanSuspensions />} />
            <Route path="/loan-suspensions/new" element={<LoanSuspensions />} />
            <Route path="/loan-suspensions/:id/edit" element={<LoanSuspensions />} />
            <Route path="/payroll-components" element={<PayrollComponents />} />
            <Route path="/payroll-components/new" element={<PayrollComponents />} />
            <Route path="/payroll-components/:id/edit" element={<PayrollComponents />} />
            <Route path="/factor-methods" element={<FactorMethods />} />
            <Route path="/factor-methods/new" element={<FactorMethods />} />
            <Route path="/factor-methods/:id/edit" element={<FactorMethods />} />
            <Route path="/payroll-data-entry" element={<PayrollDataEntry />} />
            <Route path="/personnel-constants" element={<PersonnelConstants />} />
            <Route path="/payroll-calculation" element={<PayrollCalculateMonth />} />
            <Route path="/payroll-calculation-report" element={<PayrollReportPage />} />
            <Route path="/employee-education" element={<EmployeeEducation />} />
            <Route path="/employee-education/new" element={<EmployeeEducation />} />
            <Route path="/employee-education/:id/edit" element={<EmployeeEducation />} />
            <Route path="/employee-veteran" element={<EmployeeVeteran />} />
            <Route path="/employee-veteran/new" element={<EmployeeVeteran />} />
            <Route path="/employee-veteran/:id/edit" element={<EmployeeVeteran />} />
            <Route path="/employee-marital" element={<EmployeeMarital />} />
            <Route path="/employee-marital/new" element={<EmployeeMarital />} />
            <Route path="/employee-marital/:id/edit" element={<EmployeeMarital />} />
            <Route path="/employment-types" element={<EmploymentTypes />} />
            <Route path="/employment-types/new" element={<EmploymentTypes />} />
            <Route path="/employment-types/:id/edit" element={<EmploymentTypes />} />
            <Route path="/education-levels" element={<EducationLevels />} />
            <Route path="/education-levels/new" element={<EducationLevels />} />
            <Route path="/education-levels/:id/edit" element={<EducationLevels />} />
            <Route path="/termination-reasons" element={<TerminationReasons />} />
            <Route path="/termination-reasons/new" element={<TerminationReasons />} />
            <Route path="/termination-reasons/:id/edit" element={<TerminationReasons />} />
            <Route path="/detail-rules" element={<DetailRules />} />
            <Route path="/detail-rules/new" element={<DetailRules />} />
            <Route path="/detail-rules/:id/edit" element={<DetailRules />} />
            <Route path="/warehouse-doc-details" element={<WarehouseDocDetails />} />
            <Route path="/warehouse-doc-details/new" element={<WarehouseDocDetails />} />
            <Route path="/warehouse-doc-details/:id/edit" element={<WarehouseDocDetails />} />
            <Route path="/tax-invoice-submission" element={<TaxInvoiceSubmission />} />
            <Route path="/trade-ledgers" element={<TradeLedgers />} />
            <Route path="/trade-ledgers/new" element={<TradeLedgers />} />
            <Route path="/trade-ledgers/:id/edit" element={<TradeLedgers />} />
            <Route path="/petty-cashes" element={<PettyCashes />} />
            <Route path="/petty-cashes/new" element={<PettyCashes />} />
            <Route path="/petty-cashes/:id/edit" element={<PettyCashes />} />
            <Route path="/petty-cash-custodians" element={<PettyCashCustodians />} />
            <Route path="/petty-cash-custodians/new" element={<PettyCashCustodians />} />
            <Route path="/petty-cash-custodians/:id/edit" element={<PettyCashCustodians />} />
            <Route path="/petty-cash-payments" element={<PettyCashPayments />} />
            <Route path="/petty-cash-payments/new" element={<PettyCashPayments />} />
            <Route path="/petty-cash-payments/:id/edit" element={<PettyCashPayments />} />
            <Route path="/petty-cash-summaries" element={<PettyCashSummaries />} />
            <Route path="/petty-cash-summaries/new" element={<PettyCashSummaries />} />
            <Route path="/petty-cash-summaries/:id/edit" element={<PettyCashSummaries />} />
            <Route path="/sales-quotes" element={<SalesQuotes />} />
            <Route path="/sales-quotes/new" element={<SalesQuotes />} />
            <Route path="/sales-quotes/:id/edit" element={<SalesQuotes />} />
            <Route path="/sales-orders" element={<SalesOrders />} />
            <Route path="/sales-orders/new" element={<SalesOrders />} />
            <Route path="/sales-orders/:id/edit" element={<SalesOrders />} />
            <Route path="/sales-deliveries" element={<SalesDeliveries />} />
            <Route path="/sales-deliveries/new" element={<SalesDeliveries />} />
            <Route path="/sales-deliveries/:id/edit" element={<SalesDeliveries />} />
            <Route path="/sales-invoices" element={<SalesInvoices />} />
            <Route path="/sales-invoices/new" element={<SalesInvoices />} />
            <Route path="/sales-invoices/:id/edit" element={<SalesInvoices />} />
            <Route path="/sales-return-invoices" element={<SalesReturnInvoices />} />
            <Route path="/sales-return-invoices/new" element={<SalesReturnInvoices />} />
            <Route path="/sales-return-invoices/:id/edit" element={<SalesReturnInvoices />} />
            <Route path="/sales-review" element={<SalesReview />} />
            <Route path="/purchase-review" element={<PurchaseReview />} />
            <Route path="/bank-account-review" element={<BankAccountReview />} />
            <Route path="/cash-review" element={<CashReview />} />
            <Route path="/petty-cash-review" element={<PettyCashReview />} />
            <Route path="/receivable-documents-review" element={<ChequeDocumentsReview kind="receivable" />} />
            <Route path="/payable-documents-review" element={<ChequeDocumentsReview kind="payable" />} />
            <Route path="/treasury-openings" element={<TreasuryOpenings />} />
            <Route path="/treasury-openings/new" element={<TreasuryOpenings />} />
            <Route path="/treasury-openings/:id/edit" element={<TreasuryOpenings />} />
            <Route path="/treasury-year-close" element={<TreasuryYearClose />} />

            <Route path="/receipts" element={<Receipts />} />
            <Route path="/receipts/new" element={<Receipts />} />
            <Route path="/receipts/:id/edit" element={<Receipts />} />
            <Route path="/receipts/:id/re-edit" element={<Receipts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/new" element={<Payments />} />
            <Route path="/payments/:id/edit" element={<Payments />} />
            <Route path="/payments/:id/re-edit" element={<Payments />} />
            <Route path="/cheques" element={<Cheques />} />
            <Route path="/cheques/:id" element={<Cheques />} />
            <Route path="/cheque-deposits" element={<ChequeDeposits />} />
            <Route path="/cheque-deposits/new" element={<ChequeDeposits />} />
            <Route path="/cheque-deposits/:id/edit" element={<ChequeDeposits />} />
            <Route path="/cheque-deposits/:id/re-edit" element={<ChequeDeposits />} />
            <Route path="/cheque-deposit-returns" element={<ChequeDepositReturns />} />
            <Route path="/cheque-deposit-returns/new" element={<ChequeDepositReturns />} />
            <Route path="/cheque-deposit-returns/:id/edit" element={<ChequeDepositReturns />} />
            <Route path="/cheque-deposit-returns/:id/re-edit" element={<ChequeDepositReturns />} />
            <Route path="/cheque-clearings-receivable" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-receivable/new" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-receivable/:id/edit" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-receivable/:id/re-edit" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-payable" element={<ChequeClearingPayable />} />
            <Route path="/cheque-clearings-payable/new" element={<ChequeClearingPayable />} />
            <Route path="/cheque-clearings-payable/:id/edit" element={<ChequeClearingPayable />} />
            <Route path="/cheque-clearings-payable/:id/re-edit" element={<ChequeClearingPayable />} />
          </Route>
        </Routes>
        </TabsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
