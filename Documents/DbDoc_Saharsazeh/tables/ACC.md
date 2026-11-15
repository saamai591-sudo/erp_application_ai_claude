# Schema `ACC`

## Tables

### ACC.AccCurrencyExchange

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccCurrencyExchangeID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | CurrencyID | int | N |  |  |
| 6 | CurrencyRate | decimal(20,10) | N |  |  |
| 7 | FinancialPeriodID | int | N |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | PreVoucherID | int | Y |  |  |

- **Primary key:** AccCurrencyExchangeID
- **FK** `FK_AccCurrencyExchange_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_AccCurrencyExchange_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_AccCurrencyExchange_Branch` (BranchID) -> CFG.Branch (BranchID)
- **Referenced by:** ACC.AccCurrencyExchangeAccountLevel (AccCurrencyExchangeID); ACC.AccCurrencyExchangeItem (AccCurrencyExchangeID)

### ACC.AccCurrencyExchangeAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccCurrencyExchangeAccountLevelID | int | N |  | identity |
| 2 | AccCurrencyExchangeID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AccCurrencyExchangeAccountLevelID
- **FK** `FK_AccCurrencyExchangeAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchangeAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_AccCurrencyExchangeAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchangeAccountLevel_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_AccCurrencyExchangeAccountLevel_AccCurrencyExchange` (AccCurrencyExchangeID) -> ACC.AccCurrencyExchange (AccCurrencyExchangeID) on delete CASCADE

### ACC.AccCurrencyExchangeItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccCurrencyExchangeItemID | int | N |  | identity |
| 2 | AccCurrencyExchangeID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | Debit | decimal(36,10) | Y |  |  |
| 5 | Credit | decimal(36,10) | Y |  |  |
| 6 | DebitRemain | decimal(36,10) | Y |  |  |
| 7 | CreditRemain | decimal(36,10) | Y |  |  |
| 8 | CurrencyDebit | decimal(36,10) | Y |  |  |
| 9 | CurrencyCredit | decimal(36,10) | Y |  |  |
| 10 | CurrencyDebitRemain | decimal(36,10) | Y |  |  |
| 11 | CurrencyCreditRemain | decimal(36,10) | Y |  |  |
| 12 | TasirDebitRemain | decimal(36,10) | Y |  |  |
| 13 | TasirCreditRemain | decimal(36,10) | Y |  |  |
| 14 | DiffDebit | decimal(36,10) | Y |  |  |
| 15 | DiffCredit | decimal(36,10) | Y |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | Version | int | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AccCurrencyExchangeItemID
- **FK** `FK_AccCurrencyExchange_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchange_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchangeItem_AccCurrencyExchange` (AccCurrencyExchangeID) -> ACC.AccCurrencyExchange (AccCurrencyExchangeID) on delete CASCADE
- **FK** `FK_AccCurrencyExchange_Sl` (SlID) -> ACC.SL (SlID)
- **Referenced by:** ACC.AccCurrencyExchangeItemAccountLevel (AccCurrencyExchangeItemID)

### ACC.AccCurrencyExchangeItemAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccCurrencyExchangeItemAccountLevelID | int | N |  | identity |
| 2 | AccCurrencyExchangeItemID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AccCurrencyExchangeItemAccountLevelID
- **FK** `FK_AccCurrencyExchangeItemAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchangeItemAccountLevel_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_AccCurrencyExchangeItemAccountLevel_AccCurrencyExchangeItem` (AccCurrencyExchangeItemID) -> ACC.AccCurrencyExchangeItem (AccCurrencyExchangeItemID) on delete CASCADE
- **FK** `FK_AccCurrencyExchangeItemAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AccCurrencyExchangeItemAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)

### ACC.AccountLevel

Rows: 2 | سطح حساب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccountLevelID | int | N |  | identity |
| 2 | Code | smallint | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | AccountLevelTypeID | smallint | N |  |  |
| 6 | IsMandatory | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | OrderView | int | N | ((1)) |  |

- **Primary key:** AccountLevelID
- **FK** `FK_AccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccCurrencyExchangeAccountLevel (AccountLevelID); ACC.AccCurrencyExchangeItemAccountLevel (AccountLevelID); ACC.AccountLevelItem (AccountLevelID); ACC.AccountLevelSL (AccountLevelID); ACC.AccountLevelVoucherItem (AccountLevelID); ACC.PreVoucherItemAccountLevel (AccountLevelID); APT.ApportionAccountingAccountLevel (AccountLevelID); APT.ApportionCalculationAccountLevel (AccountLevelID); APT.PortionerAccountLevel (AccountLevelID); FIN.PettyCashCostItemAccountLevel (AccountLevelID); FSS.CodingReportStructureSl (AccountLevelID); FSS.TopicReportStructureCodingAccountLevel (AccountLevelID); PAY.PayrollAccConfigurationPartyType (AccountLevelID); STC.OutgoingAccSettingAccountLevel (AccountLevelID)

### ACC.AccountLevelItem

Rows: 0 | قلم سطح حساب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccountLevelItemID | int | N |  | identity |
| 2 | AccountLevelID | int | N |  |  |
| 3 | Item | nvarchar(1024) | N |  |  |
| 4 | Item2 | nvarchar(1024) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** AccountLevelItemID
- **FK** `FK_AccountLevelItem_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID) on delete CASCADE
- **FK** `FK_AccountLevelItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccountLevelItem_LastEditor` (LastEditor) -> CFG.User (UserID) on delete CASCADE

### ACC.AccountLevelSL

Rows: 306 | ارتباط سطح حساب با معین

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccountLevelSLID | int | N |  | identity |
| 2 | AccountLevelID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | DlTypeID | int | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** AccountLevelSLID
- **unique index** `IX_AccountLevelSL` (SlID, AccountLevelID)
- **FK** `FK_AccountLevelSL_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_AccountLevelSL_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccountLevelSL_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_AccountLevelSL_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AccountLevelSL_SL` (SlID) -> ACC.SL (SlID) on delete CASCADE

### ACC.AccountLevelVoucherItem

Rows: 282354 | سطوح آیتم حسابداری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccountLevelVoucherItemID | int | N |  | identity |
| 2 | VoucherItemID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** AccountLevelVoucherItemID
- **unique index** `IX_AccountLevelVoucherItem` (VoucherItemID, AccountLevelID)
- **index** `NonClusteredIndex-20151108-104529` (AccountLevelVoucherItemID) include (DlID, Value, AccountLevelID)
- **FK** `FK_AccountLevelVoucheItem_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_AccountLevelVoucheItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AccountLevelVoucheItem_VoucherItem` (VoucherItemID) -> ACC.VoucherItem (VoucherItemID) on delete CASCADE
- **FK** `FK_AccountLevelVoucherItem_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_AccountLevelVoucherItem_Creator` (Creator) -> CFG.User (UserID)

### ACC.BalanceType

Rows: 16 | ماهیت حساب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BalanceTypeID | smallint | N |  | identity |
| 2 | Name | nvarchar(256) | N |  |  |
| 3 | EngName | varchar(256) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | AccountTypeID | smallint | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** BalanceTypeID
- **FK** `FK_BalanceType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BalanceType_LastEditor` (LastEditor) -> CFG.User (UserID)

### ACC.DCNote

Rows: 52 | اعلامیه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DCNoteID | int | N |  | identity |
| 2 | DlID | bigint | Y |  |  |
| 3 | Number | int | N |  |  |
| 4 | VoucherItemID | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | FinancialPeriodID | int | Y |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DCNoteID
- **FK** `FK_DCNote_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_DCNote_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_DCNote_VoucherItem` (VoucherItemID) -> ACC.VoucherItem (VoucherItemID)

### ACC.DL

Rows: 1772 | حساب تفصیل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DLID | bigint | N |  | identity |
| 2 | DlTypeID | int | N |  |  |
| 3 | Code | varchar(100) | N |  |  |
| 4 | ParentID | bigint | Y |  |  |
| 5 | Title | nvarchar(256) | N |  |  |
| 6 | Title2 | nvarchar(256) | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DLID
- **unique index** `IX_DlCode` (Code)
- **unique index** `IX_DlTitle` (Title)
- **FK** `FK_DL_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DL_DL` (ParentID) -> ACC.DL (DLID)
- **FK** `FK_DL_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_DL_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccCurrencyExchangeAccountLevel (DlID); ACC.AccCurrencyExchangeItemAccountLevel (DlID); ACC.AccountLevelVoucherItem (DlID); ACC.DCNote (DlID); ACC.DL (ParentID); ACC.PreVoucherItemAccountLevel (DlID); APS.DimSaleItem (DlID); APT.ApportionAccountingAccountLevel (DLID); APT.ApportionCalculationAccountLevel (DLID); APT.PortionedToDl (DLID); APT.PortionerAccountLevel (DLID); AST.AssetSettingDl (DlID); CFG.BankAccount (DlID); CFG.Cash (DlID); CFG.CostCenter (DlID); CFG.ExecutionLocation (DlID); CFG.Party (DlID); CNT.Contract (DLID); CNT.Contract (ProjectId); CNT.ContractSubject (DlID); CTM.OrderItemTrace (DlID); CTM.ReceptionItemTrace (DlID); FIN.Fund (DlID); FIN.PaymentCommitmentRecall (DLID); FIN.PaymentSubject (DLID); FIN.PettyCashCostItemAccountLevel (DlID); FIN.ReceiveCommitmentRecall (DLID); FIN.ReceiveSubject (DLID); FOS.LetterCredit (DLID); FOS.ProformaInvoice (DLID); FSS.ReportResult (DlID); FSS.TopicReportStructureCodingAccountLevel (DlID); NOC.CashFounding (DLID); PAY.PersonelVoucherSetting (MissionOrganizationDlId); PAY.PersonelVoucherSettingDl (DlID); PAY.TimeSheet (DlID); PAY.TimeSheetCalculationResult (DlID); PMO.Project (DlID); POS.CardReader (DlID); POS.PosInvoiceItemTrace (DlID); POS.Station (CostCenterDlID); POS.Station (DlID); PRM.ConsumptionStatisticItemTrace (DlID); PRM.PlanningItemTrace (DlID); PRM.ProductionAnalysisItemTrace (DlID); PRM.ProductionDeliveryItemTrace (DlID); PRM.ProductionFormulaItemMaterialTrace (DlID); PRM.ProductionFormulaTrace (DlID); PRM.ProductionOrderItemTrace (DlID); PRM.ProductionPlanningItemTrace (DlID); PRM.ProductionStatisticItemTrace (DlID); PRM.ProductionTimingTrace (DlID); PRM.RequiredMaterialTrace (DlID); PRM.RequiredProductTrace (DlID); PRM.ReworkItemTrace (DlID); PRM.SpoilageStatisticItemTrace (DlID); PRM.StationPerformanceItemTrace (DlID); PRM.WorkingInventoryItemTrace (DlID); REQ.PurchaseRequestItemTrace (DlID); REQ.ReturnRequestItemTrace (DlID); REQ.StuffRequestItemTrace (DlID); SLE.InvoiceItemTrace (DlID); SLE.JustificationItemTrace (DlID); SLE.PercentagePriceListItemBaseTrace (DlID); SLE.PercentagePriceListItemTrace (DlID); SLE.PriceListItemTrace (DlID); SLE.QuotationItemTrace (DlID); SLE.RemittanceItemTrace (DlID); SLE.ReturnedSaleInvoiceItemTrace (DlID); SLE.ReturnedSaleJustificationItemTrace (DlID); SLE.SaleContractItemTrace (DlID); STC.ConvertSpecificationTrace (DlID); STC.InventoryEditionItemTrace (DlID); STC.JustificationInputItemTrace (DlID); STC.Outgoing (DeliverDlID); STC.OutgoingAccSettingAccountLevel (DlID); STC.OutgoingDl (DlID); STC.OutgoingItemTrace (DlID); STC.PricingItemTrace (DlID); STC.ProductionPrice (DlID); STC.ProductionPriceItemTrace (DlID); STC.ReceiptCost (ProformaDlId); STC.RecountingInventoryTagItemTrace (DlID); STC.ReturnedOutgoing (DlDeliverID); STC.ReturnedOutgoingDl (DlID); STC.ReturnedOutgoingItemTrace (DlID); STC.ReturnedTemporaryOutgoing (DlID); STC.ReturnedTemporaryStockReceipt (DeliverDlID); STC.ReturnedTemporaryStockReceiptItemTrace (DlID); STC.ReturnStockReceipt (DeliverDlID); STC.ReturnStockReceiptDl (DlID); STC.ReturnStockReceiptItemTrace (DlID); STC.StockReceipt (DeliverDlID); STC.StockReceiptDl (DlID); STC.StockReceiptItemTrace (DlID); STC.StuffCompositionTrace (DlID); STC.TemporaryOutgoing (DlID); STC.TemporaryOutgoingItemTrace (DlID); STC.TemporaryStockReceipt (DeliverDlID); STC.TemporaryStockReceiptItemTrace (DlID); STF.StockDocumentTypeSlDl (DlID); VND.PurchaseContract (DlID); VND.PurchaseContract (PurchaseOrderDlID); VND.PurchaseInvoice (DlID); VND.ReturnInvoice (DlID)

### ACC.DlType

Rows: 13 | نوع تفصیل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DlTypeID | int | N |  | identity |
| 2 | ParentID | int | Y |  | شناسه مرجع |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | FirstNumber | bigint | N |  |  |
| 7 | LastNumber | bigint | Y |  |  |
| 8 | IsManual | bit | N |  | دستی یا اتوماتیک |
| 9 | CodeLength | int | N | ((1)) |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DlTypeID
- **unique index** `IX_DlType` (Title)
- **FK** `FK_DlType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DlType_DlType` (ParentID) -> ACC.DlType (DlTypeID)
- **FK** `FK_DlType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccountLevelSL (DlTypeID); ACC.DL (DlTypeID); ACC.DlType (ParentID); ACC.UsedDlType (DlTypeID); APT.PortionedToDl (DlTypeID); AST.AssetSettingDl (DlTypeID); PAY.PayrollAccGroup (ShareBaseDlTypeId); PAY.PayrollDlType (DlTypeID); PAY.PersonelVoucherSettingDl (DlTypeID); STC.OutgoingDl (DlTypeID); STC.ReturnedOutgoingDl (DlTypeID); STC.ReturnStockReceiptDl (DlTypeID); STC.StockDocumentType (DlTypeID); STC.StockDocumentTypeDlType (DlTypeID); STC.StockReceiptDl (DlTypeID); STF.Trace (DlTypeID)

### ACC.DocumentType

Rows: 5 | نوع سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentTypeID | smallint | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | IsSystem | bit | N |  |  |
| 5 | DefaultSelectInReport | bit | N | ((1)) |  |
| 6 | IsActive | bit | N | ((1)) |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | engname | varchar(50) | Y |  |  |

- **Primary key:** DocumentTypeID
- **FK** `FK_DocumentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.Voucher (DocumentTypeID)

### ACC.GIVoucher

Rows: 63 | سند کل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | GlVoucherID | bigint | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | datetime | N |  |  |
| 4 | FinancialPeriodID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** GlVoucherID
- **unique index** `IX_GIVoucher` (GlVoucherID, Number)
- **FK** `FK_GIVoucher_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_GIVoucher_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_GIVoucher_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.GIVoucherItem (GIVoucherID)

### ACC.GIVoucherItem

Rows: 26143 | قلم سند کل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | GIVoucherItemID | int | N |  | identity |
| 2 | GIVoucherID | bigint | N |  |  |
| 3 | VoucherID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** GIVoucherItemID
- **FK** `FK_GIVoucherItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_GIVoucherItem_GIVoucher` (GIVoucherID) -> ACC.GIVoucher (GlVoucherID) on delete CASCADE
- **FK** `FK_GIVoucherItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_GIVoucherItem_Voucher` (VoucherID) -> ACC.Voucher (VoucherID)

### ACC.PreVoucher

Rows: 54082 | پیش نویس سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PreVoucherID | int | N |  | identity |
| 2 | DocumentNumtypeID | smallint | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | FinancialPeriodID | int | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | BranchID | int | N | ((-1)) |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** PreVoucherID
- **FK** `FK_PreVoucher_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PreVoucher_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PreVoucher_DocumentNumtype` (DocumentNumtypeID) -> CFG.DocumentNumType (DocumentNumTypeID)
- **FK** `FK_PreVoucher_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PreVoucher_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccCurrencyExchange (PreVoucherID); ACC.PreVoucherItem (PreVoucherID); ACC.VoucherPrevoucher (PrevoucherID); AST.Adjustment (PreVoucherID); AST.AssetReceipt (PreVoucherID); AST.ChangeCategory (PreVoucherID); AST.Creation (PreVoucherID); AST.Destruction (PreVoucherID); AST.Insurance (PrevoucherID); AST.ReceivedFromBranch (PreVoucherID); AST.Repair (PreVoucherID); AST.Revaluation (PreVoucherID); AST.Sale (PrevoucherID); AST.Salvage (PreVoucherID); AST.Transfer (PreVoucherID); CFG.DebitCreditNote (PreVoucherID); CNT.ConfirmStatement (PreVoucherID); FIN.GuarantyOperation (PreVoucherID); FIN.PaymentCheqeFlow (PreVoucherID); FIN.PaymentCommitment (PreVoucherID); FIN.PaymentCommitmentRecall (PreVoucherID); FIN.PaymentReceipt (PreVoucherID); FIN.PettyCashCost (PreVoucherID); FIN.ReceiptCheqeFlow (PreVoucherID); FIN.ReceiveCommitment (PreVoucherID); FIN.ReceiveCommitmentRecall (PreVoucherID); FIN.ReceiveReceipt (PreVoucherID); FOS.BillOfLading (PreVoucherID); FOS.Clearance (PreVoucherID); FOS.CostOfOrder (PreVoucherID); FOS.CreditAllocation (PreVoucherID); FOS.LetterCredit (PreVoucherID); FOS.OrderPricing (PreVoucherID); FOS.Registration (PreVoucherID); FOS.ShippingInsurance (PreVoucherID); NOC.Modification (PreVoucherID); POS.Delivery (PreVoucherID); SLE.Invoice (PreVoucherID); SLE.InvoiceCorrection (PrevoucherID); SLE.ReturnedSaleInvoice (PreVoucherID); STC.Outgoing (PreVoucherID); STC.ReturnedOutgoing (PreVoucherID); STC.ReturnStockReceipt (PreVoucherID); STC.RevisionCost (PreVoucherID); STC.StockReceipt (PreVoucherID); VND.ConfirmPurchaseInvoice (PreVoucherID); VND.PurchaseInvoice (PreVoucherID); VND.ReturnInvoice (PreVoucherID)

### ACC.PreVoucherItem

Rows: 398083 | آیتم پیش نویس

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PreVoucherItemID | int | N |  | identity |
| 2 | PreVoucherID | int | N |  |  |
| 3 | RowIndex | int | N |  | ردیف |
| 4 | SlID | int | N |  |  |
| 5 | Description | nvarchar(MAX) | N |  |  |
| 6 | Description2 | nvarchar(MAX) | N |  |  |
| 7 | Debit | decimal(36,10) | Y |  |  |
| 8 | Credit | decimal(36,10) | Y |  |  |
| 9 | CurrencyID | int | N |  |  |
| 10 | CurrencyRate | decimal(20,10) | N |  |  |
| 11 | CurrencyDebit | decimal(36,10) | Y |  |  |
| 12 | CurrencyCredit | decimal(36,10) | Y |  |  |
| 13 | IsAutoGenerated | bit | N | ((1)) |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | Version | int | N |  |  |
| 19 | BaseDocumentName | varchar(256) | Y |  |  |
| 20 | BaseDocumentID | int | Y |  |  |

- **Primary key:** PreVoucherItemID
- **FK** `FK_PreVoucherItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PreVoucherItem_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PreVoucherItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PreVoucherItem_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete CASCADE
- **FK** `FK_PreVoucherItem_SlID` (SlID) -> ACC.SL (SlID)
- **Referenced by:** ACC.PreVoucherItemAccountLevel (PreVoucherItemID); ACC.VoucherPrevoucher (PrevoucherItemID)

### ACC.PreVoucherItemAccountLevel

Rows: 217721 | سطوح آیتم پیش نویس سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PreVoucherItemAccountLevelID | bigint | N |  | identity |
| 2 | PreVoucherItemID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PreVoucherItemAccountLevelID
- **unique index** `IX_PreVoucherItemAccountLevel` (PreVoucherItemID, AccountLevelID)
- **FK** `FK_PreVoucherItemAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_PreVoucherItemAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PreVoucherItemAccountLevel_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PreVoucherItemAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PreVoucherItemAccountLevel_PreVoucherItem` (PreVoucherItemID) -> ACC.PreVoucherItem (PreVoucherItemID) on delete CASCADE

### ACC.SL

Rows: 589 | معین

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SlID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Code | varchar(50) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | BalanceTypeID | tinyint | N |  | ماهیت حساب |
| 7 | HasBalanceTypeCheck | bit | N |  | کنترل ماهیت |
| 8 | HasCurrency | bit | N |  |  |
| 9 | HasCurrencyConversion | bit | N |  |  |
| 10 | IsActive | bit | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | SlTreeLevelID | int | Y |  |  |
| 17 | IsMoeen | bit | N | ((0)) |  |
| 18 | CurrencyExchangeSLID | int | Y |  |  |

- **Primary key:** SlID
- **unique index** `IX_SL` (ParentID, Title)
- **unique index** `IX_SL_1` (ParentID, Code)
- **FK** `FK_SL_SlTreeLevel` (SlTreeLevelID) -> ACC.SlTreeLevel (SlTreeLevelID)
- **FK** `FK_SL_CurrencyExchangeSL` (CurrencyExchangeSLID) -> ACC.SL (SlID)
- **FK** `FK_SL_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SL_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SL_SL1` (ParentID) -> ACC.SL (SlID)
- **Referenced by:** ACC.AccCurrencyExchangeItem (SlID); ACC.AccountLevelSL (SlID); ACC.PreVoucherItem (SlID); ACC.SL (CurrencyExchangeSLID); ACC.SL (ParentID); ACC.VoucherItem (SlID); APT.ApportionAccounting (SlID); APT.PortionerItem (SlID); AST.CategoryAccount (AccumulatedDepreciation); AST.CategoryAccount (AdjustmentSLID); AST.CategoryAccount (CompletingAsset); AST.CategoryAccount (DepreciationCost); AST.CategoryAccount (FixAsset); AST.CategoryAccount (GiftCost); AST.CategoryAccount (IncomeFromInsurance); AST.CategoryAccount (IncomeFromRevaluation); AST.CategoryAccount (IncomeFromSale); AST.CategoryAccount (LossOfStopWorking); AST.CategoryAccount (RepairCost); AST.CategoryAccount (TransfersBetweenBranches); AST.DestructionReason (LossFromDisaster); AST.InsuranceType (InsuranceCost); AST.InsuranceType (PrepaidInsurance); AST.RepairServiceCost (SlID); CFG.BankAccount (SLID); CFG.BankAccount (WageSLID); CFG.CashBalance (SLID); CNT.AdditionDeductionTypeMethod (ExchangeGainLossSlID); CNT.AdditionDeductionTypeMethod (SlID); CNT.ContractStatementType (AdjustmentSLID); CNT.ContractStatementType (DutySLID); CNT.ContractStatementType (SlID); CNT.ContractStatementType (SuspensionSLID); CNT.ContractStatementType (TaxSLID); CNT.ContractSubject (SlID); CTM.ShoppingCart (SlID); FIN.CommitmentType (OtherPartySlID); FIN.CommitmentType (SLID); FIN.GuarantyOperation (SlID); FIN.PaymentCheqeType (SlID); FIN.PaymentType (AllocationSlID); FIN.PaymentType (SLID); FIN.PettyCash (SLID); FIN.ReceiptType (AllocationSLID); FIN.ReceiptType (SLID); FOS.LadingType (SlID); FOS.LetterCreditBankCost (CostSlID); FOS.LetterCreditType (FacilitySl); FOS.LetterCreditType (PaymentableProfitSl); FOS.LetterCreditType (ProfitSl); FOS.ShippingInsuranceType (SlID); FOS.SpecialCost (SlID); FSS.CodingReportStructureSl (SlID); FSS.TopicReportStructureCoding (SlID); NOC.CashAnalysingItem (SlID); NOC.CashFounding (SlID); NOC.CurrencyExchange (ExchangeGainLoss); NOC.CurrencyExchange (SlID); NOC.Modification (SlID); NOC.ModifiedTopic (SlID); NOC.ReportHeadline (ProfitAndLossSlID); NOC.ReportHeadline (SlID); PAY.PayrollAccConfiguration (SlID); PAY.TimeSheetCalculationResult (SlID); POS.CardReader (SlID); PRM.CostDataCollectionAccountSetting (SlID); PRM.CostStructureAccountItem (SlID); SLE.SaleType (DutySlID); SLE.SaleType (SlID); SLE.SaleType (TaxSlID); STC.ReceiptCost (SlID); STF.StockDocumentTypeSlDl (SlID); STF.StuffAccountGroup (AdjustmentSLID); STF.StuffAccountGroupAccountSl (InventorySlID); STF.StuffAccountGroupPurchaseType (SlID); STF.StuffDetail (SlID); STF.StuffSaleSl (DiscountSlID); STF.StuffSaleSl (ReturnedSaleSlID); STF.StuffSaleSl (SaleSlID); VND.PurchaseType (DutySlId); VND.PurchaseType (SlID); VND.PurchaseType (TaxSlId)

### ACC.SlTreeLevel

Rows: 3 | سطح درختواره کدینگ حسابداری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SlTreeLevelID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | LevelType | tinyint | N |  |  |
| 5 | LevelOrder | tinyint | N |  |  |
| 6 | CodeLength | tinyint | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** SlTreeLevelID
- **FK** `FK_SlTreeLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SlTreeLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.SL (SlTreeLevelID)

### ACC.UsedDlType

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UsedDlTypeID | int | N |  | identity |
| 2 | SaturnModuleID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** UsedDlTypeID
- **FK** `FK_AssetDlType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetDlType_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_AssetDlType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UsedDlType_SaturnModule` (SaturnModuleID) -> CFG.SaturnModule (SaturnModuleID)

### ACC.VatRate

Rows: 9 | نرخ مالیلت و عوارض

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VatRateID | int | N |  | identity |
| 2 | TaxRate | decimal(4,2) | N |  |  |
| 3 | DutyRate | decimal(4,2) | N |  |  |
| 4 | FinancialPeriodID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VatRateID
- **FK** `FK_VatRate_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VatRate_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID) on delete CASCADE
- **FK** `FK_VatRate_LastEditor` (LastEditor) -> CFG.User (UserID)

### ACC.Voucher

Rows: 39712 | سند حسابداری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | FinancialPeriodID | int | N |  |  |
| 4 | DocumentTypeID | smallint | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | ReferenceNumber | int | N |  |  |
| 7 | DailyNumber | int | N |  |  |
| 8 | SubNumber | nvarchar(256) | Y |  |  |
| 9 | Date | date | N |  |  |
| 10 | VoucherStatusID | smallint | N |  |  |
| 11 | Description | nvarchar(MAX) | Y |  |  |
| 12 | Description2 | nvarchar(MAX) | Y |  |  |
| 13 | Total | decimal(36,10) | Y |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Reviewer | int | Y |  |  |
| 20 | Corroborator | int | Y |  |  |
| 21 | AutoGenerated | bit | N |  |  |

- **Primary key:** VoucherID
- **index** `IX_Voucher_FinancialPeriod` (FinancialPeriodID)
- **FK** `FK_Voucher_Reviewer` (Reviewer) -> CFG.User (UserID)
- **FK** `FK_Voucher_Corroborator` (Corroborator) -> CFG.User (UserID)
- **FK** `FK_Voucher_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Voucher_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Voucher_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Voucher_DocumentType` (DocumentTypeID) -> ACC.DocumentType (DocumentTypeID)
- **FK** `FK_Voucher_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.GIVoucherItem (VoucherID); ACC.VoucherItem (VoucherID); ACC.VoucherPrevoucher (VoucherID); APT.ApportionPeriodCalculation (VoucherID); AST.Depreciation (VoucherID); AST.DepreciationCalculation (VoucherID); AST.InsuranceSharing (VoucherID); NOC.AccrueDataCollection (VoucherID); NOC.CashDataCollection (VoucherID); NOC.CurrencyExchange (AccrueVoucherID); NOC.CurrencyExchange (CashVoucherID); PAY.CalculationPersonel (VoucherID); PRM.CostCalculation (VoucherID)

### ACC.VoucherAnalyze

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherAnalyzeID | int | N |  | identity |
| 2 | DebitVoucherItemID | int | N |  |  |
| 3 | CreditVoucherItemID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VoucherAnalyzeID
- **FK** `FK_VoucherAnalyze_DebitVoucherItem` (DebitVoucherItemID) -> ACC.VoucherItem (VoucherItemID)
- **FK** `FK_VoucherAnalyze_CreditVoucherItem` (CreditVoucherItemID) -> ACC.VoucherItem (VoucherItemID)
- **FK** `FK_VoucherAnalyze_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VoucherAnalyze_CreatorUser` (Creator) -> CFG.User (UserID)

### ACC.VoucherCoverSetting

Rows: 2 | تنظیم روکش سند و سند کل

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherCoverSettingID | int | N |  | identity |
| 2 | ShowVoucherNumber | bit | N |  |  |
| 3 | ShowSubNumber | bit | N |  |  |
| 4 | ShowReferenceNumber | bit | N |  |  |
| 5 | PrintDescription | bit | N |  |  |
| 6 | PrintVoucherStatus | bit | N |  |  |
| 7 | IsVoucherItemIndexBased | bit | N |  |  |
| 8 | ColumnNumber | int | N |  |  |
| 9 | AccountLevels | nvarchar(MAX) | N |  |  |
| 10 | VoucherCoverType | tinyint | N |  |  |
| 11 | ItemOrderReportID | int | Y |  |  |
| 12 | TwoColumnReportID | int | Y |  |  |
| 13 | ThreeColumnReportID | int | Y |  |  |
| 14 | FiveColumnReportID | int | Y |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VoucherCoverSettingID
- **FK** `FK_VoucherCoverSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VoucherCoverSetting_FiveColumnSaturnReport` (FiveColumnReportID) -> CFG.SaturnReport (ReportID)
- **FK** `FK_VoucherCoverSetting_ItemOrderSaturnRepor` (ItemOrderReportID) -> CFG.SaturnReport (ReportID)
- **FK** `FK_VoucherCoverSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VoucherCoverSetting_ThreeColumnSaturnReport` (ThreeColumnReportID) -> CFG.SaturnReport (ReportID)
- **FK** `FK_VoucherCoverSetting_TwoColumnSaturnReport` (TwoColumnReportID) -> CFG.SaturnReport (ReportID)

### ACC.VoucherItem

Rows: 378387 | اقلام سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherItemID | int | N |  | identity |
| 2 | VoucherID | int | N |  |  |
| 3 | VoucherItemIndex | int | N |  | ردیف |
| 4 | SlID | int | N |  |  |
| 5 | Description | nvarchar(MAX) | N |  |  |
| 6 | Description2 | nvarchar(MAX) | N |  |  |
| 7 | Debit | decimal(36,10) | Y |  |  |
| 8 | Credit | decimal(36,10) | Y |  |  |
| 9 | CurrencyID | int | N |  |  |
| 10 | CurrencyRate | decimal(36,10) | N |  |  |
| 11 | CurrencyDebit | decimal(36,10) | Y |  |  |
| 12 | CurrencyCredit | decimal(36,10) | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |

- **Primary key:** VoucherItemID
- **index** `NonClusteredIndex-VoucherID` (VoucherID)
- **FK** `FK_VoucherItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VoucherItem_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_VoucherItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VoucherItem_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_VoucherItem_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete CASCADE
- **Referenced by:** ACC.AccountLevelVoucherItem (VoucherItemID); ACC.DCNote (VoucherItemID); ACC.VoucherAnalyze (CreditVoucherItemID); ACC.VoucherAnalyze (DebitVoucherItemID); ACC.VoucherPrevoucher (VoucherItemID); NOC.AccrueAnalysing (VoucherItemID); NOC.Modification (VoucherItemID)

### ACC.VoucherPrevoucher

Rows: 398004 | ارتباط قلم سند و قلم پیش نویس

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherPrevoucherID | int | N |  | identity |
| 2 | VoucherID | int | N |  |  |
| 3 | VoucherItemID | int | N |  |  |
| 4 | PrevoucherID | int | N |  |  |
| 5 | PrevoucherItemID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VoucherPrevoucherID
- **index** `NonClusteredIndex-PrevoucherID` (PrevoucherID)
- **index** `IX_VoucherPrevoucher_VoucherItemID` (VoucherItemID)
- **unique index** `IX_VoucherPrevoucher_PrevoucherItemID` (PrevoucherItemID)
- **index** `IX_VoucherPrevoucher_PrevoucherID_VoucherID` (PrevoucherID) include (VoucherID)
- **FK** `FK_VoucherPrevoucher_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VoucherPrevoucher_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VoucherPrevoucher_Prevoucher` (PrevoucherID) -> ACC.PreVoucher (PreVoucherID)
- **FK** `FK_VoucherPrevoucher_PrevoucherItem` (PrevoucherItemID) -> ACC.PreVoucherItem (PreVoucherItemID)
- **FK** `FK_VoucherPrevoucher_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete CASCADE
- **FK** `FK_VoucherPrevoucher_VoucherItem` (VoucherItemID) -> ACC.VoucherItem (VoucherItemID)

## Views

### ACC.vwAccountLevelSL

Definition: `programmability/views/ACC.vwAccountLevelSL.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SlID | int | N |
| 2 | AccountLevelID | int | N |
| 3 | DlTypeCode | int | N |

### ACC.vwaccounts

| # | Column | Type | Null |
|---|---|---|---|
| 1 | slid | int | N |
| 2 | SlCode | varchar(200) | Y |
| 3 | SlTitle | nvarchar(256) | N |
| 4 | SlTitle2 | nvarchar(256) | N |
| 5 | GlCode | varchar(100) | N |
| 6 | GlID | int | N |
| 7 | GlTitle | nvarchar(256) | N |
| 8 | GlTitle2 | nvarchar(256) | N |
| 9 | PlID | int | N |
| 10 | PlCode | varchar(50) | N |
| 11 | PlTitle | nvarchar(256) | N |
| 12 | PlTitle2 | nvarchar(256) | N |
| 13 | SlBalanceType | nvarchar(256) | N |
| 14 | glbalancetype | nvarchar(256) | N |
| 15 | plbalancetype | nvarchar(256) | N |
| 16 | SlBalanceTypeCode | smallint | N |
| 17 | glbalancetypeCode | smallint | N |
| 18 | plbalancetypeCode | smallint | N |
| 19 | HasBalanceTypeCheck | bit | N |
| 20 | HasCurrency | bit | N |
| 21 | HasCurrencyConversion | bit | N |
| 22 | IsActive | bit | N |

### ACC.VwDlTypeAccess

Definition: `programmability/views/ACC.VwDlTypeAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserId | int | Y |
| 2 | DlTypeID | int | N |

### ACC.vwSl

Definition: `programmability/views/ACC.vwSl.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SlID | int | N |
| 2 | Code | varchar(50) | N |
| 3 | Title | nvarchar(256) | N |
| 4 | Title2 | nvarchar(256) | N |
| 5 | FullCode | varchar(200) | Y |
| 6 | GLId | int | Y |
| 7 | GLFullCode | varchar(200) | Y |
| 8 | GlTitle | varchar(200) | Y |
| 9 | GlTitle2 | varchar(200) | Y |
| 10 | GlCode | varchar(200) | Y |

### ACC.vwSl2

Definition: `programmability/views/ACC.vwSl2.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SlID | int | N |
| 2 | Code | varchar(50) | N |
| 3 | Title | nvarchar(256) | N |
| 4 | Title2 | nvarchar(256) | N |
| 5 | FullCode | varchar(200) | Y |
| 6 | GLId | int | Y |
| 7 | GLFullCode | varchar(200) | Y |
| 8 | GlTitle | varchar(200) | Y |
| 9 | GlTitle2 | varchar(200) | Y |
| 10 | GlCode | varchar(200) | Y |
| 11 | PLFullCode | varchar(200) | Y |
| 12 | PlTitle | varchar(200) | Y |
| 13 | PlTitle2 | varchar(200) | Y |

### ACC.vwVoucherAnalyzeRemain

Definition: `programmability/views/ACC.vwVoucherAnalyzeRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | VoucherItemID | int | N |
| 2 | remain | decimal(38,4) | Y |

### ACC.VWVoucherPrevoucher

Definition: `programmability/views/ACC.VWVoucherPrevoucher.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PrevoucherID | int | N |
| 2 | VoucherID | int | N |
| 3 | ReferenceNumber | int | N |
| 4 | Date | date | N |
| 5 | EngName | varchar(256) | N |
| 6 | Number | int | N |
| 7 | FinancialPeriodID | int | N |
| 8 | VoucherStatus | nvarchar(7) | N |
| 9 | Type | int | N |

