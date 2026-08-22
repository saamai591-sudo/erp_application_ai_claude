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
import GoodsPricingCorrections from "./pages/GoodsPricingCorrections";
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
import OpeningClosing from "./pages/OpeningClosing";
import DocumentConfirmation from "./pages/DocumentConfirmation";
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
import WarehouseTransfers from "./pages/WarehouseTransfers";
import WarehouseAdjustments from "./pages/WarehouseAdjustments";
import InventoryClosing from "./pages/InventoryClosing";
import GoodsRequests from "./pages/GoodsRequests";
import SupplyRequests from "./pages/SupplyRequests";
import Suppliers from "./pages/Suppliers";
import PurchaseGroups from "./pages/PurchaseGroups";
import PurchaseExperts from "./pages/PurchaseExperts";
import PurchaseRoutes from "./pages/PurchaseRoutes";
import PurchaseRequests from "./pages/PurchaseRequests";
import PurchasePlannings from "./pages/PurchasePlannings";
import InquiryAuthorizations from "./pages/InquiryAuthorizations";
import PriceInquiries from "./pages/PriceInquiries";
import InquiryEvaluations from "./pages/InquiryEvaluations";
import PurchaseOrders from "./pages/PurchaseOrders";
import DeliveryAuthorizations from "./pages/DeliveryAuthorizations";
import Customers from "./pages/Customers";
import SalesQuotes from "./pages/SalesQuotes";
import SalesOrders from "./pages/SalesOrders";
import SalesDeliveries from "./pages/SalesDeliveries";
import SalesInvoices from "./pages/SalesInvoices";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import WarehouseReview from "./pages/WarehouseReview";
import Receipts from "./pages/Receipts";
import Payments from "./pages/Payments";
import Cheques from "./pages/Cheques";
import ChequeDeposits from "./pages/ChequeDeposits";
import ChequeDepositReturns from "./pages/ChequeDepositReturns";
import ChequeClearingReceivable from "./pages/ChequeClearingReceivable";
import ChequeClearingPayable from "./pages/ChequeClearingPayable";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TabsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="/warehouse-accounting/goods-pricing-corrections" element={<GoodsPricingCorrections />} />
            <Route path="/org-structure" element={<OrgStructure />} />
            <Route path="/org-structure/new" element={<OrgStructure />} />
            <Route path="/org-structure/:id/edit" element={<OrgStructure />} />
            <Route path="/geo-regions" element={<GeoRegions />} />
            <Route path="/geo-regions/new" element={<GeoRegions />} />
            <Route path="/geo-regions/:id/edit" element={<GeoRegions />} />
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
            <Route path="/account-closing" element={<AccountClosing />} />
            <Route path="/account-closing/new" element={<AccountClosing />} />
            <Route path="/account-closing/:id" element={<AccountClosing />} />
            <Route path="/opening-closing" element={<OpeningClosing />} />
            <Route path="/opening-closing/new" element={<OpeningClosing />} />
            <Route path="/opening-closing/:id" element={<OpeningClosing />} />
            <Route path="/document-confirmation" element={<DocumentConfirmation />} />
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

            <Route path="/warehousing/initial-inventory" element={<InitialInventory mode="warehousing" />} />
            <Route path="/warehousing/initial-inventory/new" element={<InitialInventory mode="warehousing" />} />
            <Route path="/warehousing/initial-inventory/:id/edit" element={<InitialInventory mode="warehousing" />} />
            <Route path="/warehouse-accounting/initial-inventory" element={<InitialInventory mode="accounting" />} />
            <Route path="/warehouse-accounting/initial-inventory/new" element={<InitialInventory mode="accounting" />} />
            <Route path="/warehouse-accounting/initial-inventory/:id/edit" element={<InitialInventory mode="accounting" />} />

            <Route path="/warehousing/warehouse-receipts" element={<WarehouseReceipts mode="warehousing" />} />
            <Route path="/warehousing/warehouse-receipts/new" element={<WarehouseReceipts mode="warehousing" />} />
            <Route path="/warehousing/warehouse-receipts/:id/edit" element={<WarehouseReceipts mode="warehousing" />} />
            <Route path="/warehouse-accounting/warehouse-receipts" element={<WarehouseReceipts mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-receipts/new" element={<WarehouseReceipts mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-receipts/:id/edit" element={<WarehouseReceipts mode="accounting" />} />
            <Route path="/warehousing/warehouse-review" element={<WarehouseReview mode="qty" />} />
            <Route path="/warehouse-accounting/warehouse-review" element={<WarehouseReview mode="amount" />} />

            <Route path="/center-consumptions" element={<CenterConsumptions mode="warehousing" />} />
            <Route path="/center-consumptions/new" element={<CenterConsumptions mode="warehousing" />} />
            <Route path="/center-consumptions/:id/edit" element={<CenterConsumptions mode="warehousing" />} />
            <Route path="/warehouse-accounting/center-consumptions" element={<CenterConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/center-consumptions/new" element={<CenterConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/center-consumptions/:id/edit" element={<CenterConsumptions mode="accounting" />} />
            <Route path="/project-consumptions" element={<ProjectConsumptions mode="warehousing" />} />
            <Route path="/project-consumptions/new" element={<ProjectConsumptions mode="warehousing" />} />
            <Route path="/project-consumptions/:id/edit" element={<ProjectConsumptions mode="warehousing" />} />
            <Route path="/warehouse-accounting/project-consumptions" element={<ProjectConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/project-consumptions/new" element={<ProjectConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/project-consumptions/:id/edit" element={<ProjectConsumptions mode="accounting" />} />
            <Route path="/production-consumptions" element={<ProductionConsumptions mode="warehousing" />} />
            <Route path="/production-consumptions/new" element={<ProductionConsumptions mode="warehousing" />} />
            <Route path="/production-consumptions/:id/edit" element={<ProductionConsumptions mode="warehousing" />} />
            <Route path="/warehouse-accounting/production-consumptions" element={<ProductionConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/production-consumptions/new" element={<ProductionConsumptions mode="accounting" />} />
            <Route path="/warehouse-accounting/production-consumptions/:id/edit" element={<ProductionConsumptions mode="accounting" />} />
            <Route path="/center-consumption-returns" element={<CenterConsumptionReturns mode="warehousing" />} />
            <Route path="/center-consumption-returns/new" element={<CenterConsumptionReturns mode="warehousing" />} />
            <Route path="/center-consumption-returns/:id/edit" element={<CenterConsumptionReturns mode="warehousing" />} />
            <Route path="/warehouse-accounting/center-consumption-returns" element={<CenterConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/center-consumption-returns/new" element={<CenterConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/center-consumption-returns/:id/edit" element={<CenterConsumptionReturns mode="accounting" />} />
            <Route path="/project-consumption-returns" element={<ProjectConsumptionReturns mode="warehousing" />} />
            <Route path="/project-consumption-returns/new" element={<ProjectConsumptionReturns mode="warehousing" />} />
            <Route path="/project-consumption-returns/:id/edit" element={<ProjectConsumptionReturns mode="warehousing" />} />
            <Route path="/warehouse-accounting/project-consumption-returns" element={<ProjectConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/project-consumption-returns/new" element={<ProjectConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/project-consumption-returns/:id/edit" element={<ProjectConsumptionReturns mode="accounting" />} />
            <Route path="/production-consumption-returns" element={<ProductionConsumptionReturns mode="warehousing" />} />
            <Route path="/production-consumption-returns/new" element={<ProductionConsumptionReturns mode="warehousing" />} />
            <Route path="/production-consumption-returns/:id/edit" element={<ProductionConsumptionReturns mode="warehousing" />} />
            <Route path="/warehouse-accounting/production-consumption-returns" element={<ProductionConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/production-consumption-returns/new" element={<ProductionConsumptionReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/production-consumption-returns/:id/edit" element={<ProductionConsumptionReturns mode="accounting" />} />
            <Route path="/sales-returns" element={<SalesReturns mode="warehousing" />} />
            <Route path="/sales-returns/new" element={<SalesReturns mode="warehousing" />} />
            <Route path="/sales-returns/:id/edit" element={<SalesReturns mode="warehousing" />} />
            <Route path="/warehouse-accounting/sales-returns" element={<SalesReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/sales-returns/new" element={<SalesReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/sales-returns/:id/edit" element={<SalesReturns mode="accounting" />} />
            <Route path="/supplier-returns" element={<SupplierReturns mode="warehousing" />} />
            <Route path="/supplier-returns/new" element={<SupplierReturns mode="warehousing" />} />
            <Route path="/supplier-returns/:id/edit" element={<SupplierReturns mode="warehousing" />} />
            <Route path="/warehouse-accounting/supplier-returns" element={<SupplierReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/supplier-returns/new" element={<SupplierReturns mode="accounting" />} />
            <Route path="/warehouse-accounting/supplier-returns/:id/edit" element={<SupplierReturns mode="accounting" />} />
            <Route path="/production-receipts" element={<ProductionReceipts mode="warehousing" />} />
            <Route path="/production-receipts/new" element={<ProductionReceipts mode="warehousing" />} />
            <Route path="/production-receipts/:id/edit" element={<ProductionReceipts mode="warehousing" />} />
            <Route path="/warehouse-accounting/production-receipts" element={<ProductionReceipts mode="accounting" />} />
            <Route path="/warehouse-accounting/production-receipts/new" element={<ProductionReceipts mode="accounting" />} />
            <Route path="/warehouse-accounting/production-receipts/:id/edit" element={<ProductionReceipts mode="accounting" />} />
            <Route path="/fixed-asset-issues" element={<FixedAssetIssues mode="warehousing" />} />
            <Route path="/fixed-asset-issues/new" element={<FixedAssetIssues mode="warehousing" />} />
            <Route path="/fixed-asset-issues/:id/edit" element={<FixedAssetIssues mode="warehousing" />} />
            <Route path="/warehouse-accounting/fixed-asset-issues" element={<FixedAssetIssues mode="accounting" />} />
            <Route path="/warehouse-accounting/fixed-asset-issues/new" element={<FixedAssetIssues mode="accounting" />} />
            <Route path="/warehouse-accounting/fixed-asset-issues/:id/edit" element={<FixedAssetIssues mode="accounting" />} />

            <Route path="/warehousing/warehouse-transfers" element={<WarehouseTransfers mode="warehousing" />} />
            <Route path="/warehousing/warehouse-transfers/new" element={<WarehouseTransfers mode="warehousing" />} />
            <Route path="/warehousing/warehouse-transfers/:id/edit" element={<WarehouseTransfers mode="warehousing" />} />
            <Route path="/warehouse-accounting/warehouse-transfers" element={<WarehouseTransfers mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-transfers/new" element={<WarehouseTransfers mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-transfers/:id/edit" element={<WarehouseTransfers mode="accounting" />} />

            <Route path="/warehousing/warehouse-adjustments" element={<WarehouseAdjustments mode="warehousing" />} />
            <Route path="/warehousing/warehouse-adjustments/new" element={<WarehouseAdjustments mode="warehousing" />} />
            <Route path="/warehousing/warehouse-adjustments/:id/edit" element={<WarehouseAdjustments mode="warehousing" />} />
            <Route path="/warehouse-accounting/warehouse-adjustments" element={<WarehouseAdjustments mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-adjustments/new" element={<WarehouseAdjustments mode="accounting" />} />
            <Route path="/warehouse-accounting/warehouse-adjustments/:id/edit" element={<WarehouseAdjustments mode="accounting" />} />

            <Route path="/warehousing/inventory-closing" element={<InventoryClosing />} />

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

            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/new" element={<Customers />} />
            <Route path="/customers/:id/edit" element={<Customers />} />
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

            <Route path="/receipts" element={<Receipts />} />
            <Route path="/receipts/new" element={<Receipts />} />
            <Route path="/receipts/:id/edit" element={<Receipts />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payments/new" element={<Payments />} />
            <Route path="/payments/:id/edit" element={<Payments />} />
            <Route path="/cheques" element={<Cheques />} />
            <Route path="/cheques/:id" element={<Cheques />} />
            <Route path="/cheque-deposits" element={<ChequeDeposits />} />
            <Route path="/cheque-deposits/new" element={<ChequeDeposits />} />
            <Route path="/cheque-deposits/:id/edit" element={<ChequeDeposits />} />
            <Route path="/cheque-deposit-returns" element={<ChequeDepositReturns />} />
            <Route path="/cheque-deposit-returns/new" element={<ChequeDepositReturns />} />
            <Route path="/cheque-deposit-returns/:id/edit" element={<ChequeDepositReturns />} />
            <Route path="/cheque-clearings-receivable" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-receivable/new" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-receivable/:id/edit" element={<ChequeClearingReceivable />} />
            <Route path="/cheque-clearings-payable" element={<ChequeClearingPayable />} />
            <Route path="/cheque-clearings-payable/new" element={<ChequeClearingPayable />} />
            <Route path="/cheque-clearings-payable/:id/edit" element={<ChequeClearingPayable />} />
          </Route>
        </Routes>
        </TabsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
