# Schema `NOC`

## Tables

### NOC.AccrueAnalysing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccrueAnalysingID | int | N |  | identity |
| 2 | AnalysingID | int | N |  |  |
| 3 | VoucherItemID | int | N |  |  |
| 4 | Status | tinyint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | ReportCurrencyRate | decimal(30,4) | Y |  |  |
| 11 | RowIndex | int | N |  |  |
| 12 | TransactionCurrencyID | int | Y |  |  |
| 13 | BaseCurrencyDebit | decimal(36,10) | Y |  |  |
| 14 | BaseCurrencyCredit | decimal(36,10) | Y |  |  |
| 15 | ReportCurrencyDebit | decimal(36,10) | Y |  |  |
| 16 | ReportCurrencyCredit | decimal(36,10) | Y |  |  |

- **Primary key:** AccrueAnalysingID
- **FK** `FK_AccrueAnalysing_Analysing` (AnalysingID) -> NOC.Analysing (AnalysingID) on delete CASCADE
- **FK** `FK_AccrueAnalysing_VoucherItem` (VoucherItemID) -> ACC.VoucherItem (VoucherItemID)
- **FK** `FK_AccrueAnalysing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccrueAnalysing_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.AccrueDataCollection

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AccrueDataCollectionID | int | N |  | identity |
| 2 | DataCollectionID | int | N |  |  |
| 3 | VoucherID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** AccrueDataCollectionID
- **FK** `FK_AccrueDataCollection_DataCollection` (DataCollectionID) -> NOC.DataCollection (DataCollectionID) on delete CASCADE
- **FK** `FK_AccrueDataCollection_Voucher` (VoucherID) -> ACC.Voucher (VoucherID)
- **FK** `FK_AccrueDataCollection_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AccrueDataCollection_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.AccrueDataCollection_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherItemID | int | Y |  |  |
| 2 | Status | tinyint | N |  |  |
| 3 | ReportagePeriodID | int | Y |  |  |
| 4 | SourcePreVoucherItemID | int | Y |  |  |
| 5 | TargetPrevoucherItemID | int | Y |  |  |


### NOC.Analysing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AnalysingID | int | N |  | identity |
| 2 | ReportagePeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | CalculatePeriodID | int | Y |  |  |

- **Primary key:** AnalysingID
- **unique constraint** `UC_Analysing_ReportagePeriod_Type` (CalculatePeriodID, Type)
- **FK** `FK_Analysing_CalculatePeriod` (CalculatePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_Analysing_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_Analysing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Analysing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** NOC.AccrueAnalysing (AnalysingID); NOC.CashAnalysing (AnalysingID); NOC.CurrencyExchange (AnalysingID)

### NOC.CalculationTypeSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CalculationTypeSettingID | int | N |  | identity |
| 2 | CalculationTypeID | tinyint | Y |  |  |
| 3 | ReserveParameterID | int | Y |  |  |
| 4 | DifferenceParameterid | int | Y |  |  |
| 5 | BenefitParameterID | int | Y |  |  |
| 6 | NetPaymentParameterID | int | Y |  |  |
| 7 | Creator | int | N | ((-1)) |  |
| 8 | CreationDate | datetime | N | (getdate()) |  |
| 9 | LastEditor | int | N | ((-1)) |  |
| 10 | Version | int | N | ((0)) |  |
| 11 | LastEditionDate | datetime | N | (getdate()) |  |

- **Primary key:** CalculationTypeSettingID
- **FK** `FK_CalculationTypeSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CalculationTypeSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CalculationTypeSetting_CalculationType` (CalculationTypeID) -> PAY.CalculationType (CalculationTypeID)
- **FK** `FK_CalculationTypeSetting_ReserveParameter` (ReserveParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_CalculationTypeSetting_DifferenceParameter` (DifferenceParameterid) -> PAY.Parameter (ParameterID)
- **FK** `FK_CalculationTypeSetting_BenefitParameter` (BenefitParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_CalculationTypeSetting_NetPaymentParameter` (NetPaymentParameterID) -> PAY.Parameter (ParameterID)

### NOC.CashAnalysing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashAnalysingID | int | N |  | identity |
| 2 | AnalysingID | int | N |  |  |
| 3 | CashDataCollectionID | int | N |  |  |
| 4 | Status | tinyint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | ReportCurrencyRate | decimal(30,4) | Y |  |  |
| 11 | BaseDocumentID | int | Y |  |  |
| 12 | BaseDocumentType | varchar(100) | Y |  |  |
| 13 | EffectiveDate | date | Y |  |  |
| 14 | RowIndex | int | N |  |  |
| 15 | DlID | int | Y |  |  |
| 16 | ContractID | int | Y |  |  |

- **Primary key:** CashAnalysingID
- **FK** `FK_CashAnalysing_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_CashAnalysing_Analysing` (AnalysingID) -> NOC.Analysing (AnalysingID) on delete CASCADE
- **FK** `FK_CashAnalysing_CashDataCollection` (CashDataCollectionID) -> NOC.CashDataCollection (CashDataCollectionID)
- **FK** `FK_CashAnalysing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashAnalysing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** NOC.CashAnalysingItem (CashAnalysingID)

### NOC.CashAnalysingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashAnalysingItemID | int | N |  | identity |
| 2 | CashAnalysingID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | BaseCurrencyAmount | decimal(30,4) | Y |  |  |
| 11 | AccrueVoucherID | int | Y |  |  |
| 12 | AccruePreVoucherID | int | Y |  |  |

- **Primary key:** CashAnalysingItemID
- **FK** `FK_CashAnalysingItem_CashAnalysing` (CashAnalysingID) -> NOC.CashAnalysing (CashAnalysingID) on delete CASCADE
- **FK** `FK_CashAnalysingItem_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CashAnalysingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashAnalysingItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.CashAndExchangeModification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashAndExchangeModificationID | int | N |  | identity |
| 2 | ModificationID | int | N |  |  |
| 3 | ReferenceNumber | int | N |  |  |
| 4 | BaseCurrencyDebitCash | decimal(30,4) | N |  |  |
| 5 | BaseCurrencyCreditCash | decimal(30,4) | N |  |  |
| 6 | ReportCurrencyRate | decimal(30,4) | N |  |  |
| 7 | ReportCurrencyDebitCash | decimal(30,4) | N |  |  |
| 8 | ReportCurrencyCreditCash | decimal(30,4) | N |  |  |
| 9 | ReportCurrencyDebitExchange | decimal(30,4) | N |  |  |
| 10 | ReportCurrencyCreditExchange | decimal(30,4) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | CashAnalysingItemID | int | Y |  |  |

- **FK** `FK_CashAndExchangeModification_Modification` (ModificationID) -> NOC.Modification (ModificationID) on delete CASCADE

### NOC.CashDataCollection

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashDataCollectionID | int | N |  | identity |
| 2 | DataCollectionID | int | N |  |  |
| 3 | PaymentSubjectID | int | Y |  |  |
| 4 | DebitCreditNoteItemID | int | Y |  |  |
| 5 | PettyCashCostItemID | int | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | ConfirmStatementPrePaymentID | int | Y |  |  |
| 12 | PurchaseInvoicePrePaymentID | int | Y |  |  |
| 13 | VoucherID | int | Y |  |  |
| 14 | CalculationResultID | decimal(18,0) | Y |  |  |
| 15 | ReceiveSubjectID | int | Y |  |  |
| 16 | CalculationID | int | Y |  |  |
| 17 | ConfirmStatementItemID | int | Y |  |  |
| 18 | DestructionItemID | int | Y |  |  |
| 19 | ConfirmPurchaseInvoiceAdvancePaymentID | int | Y |  |  |

- **Primary key:** CashDataCollectionID
- **FK** `FK_CashDataCollection_DataCollection` (DataCollectionID) -> NOC.DataCollection (DataCollectionID) on delete CASCADE
- **FK** `FK_CashDataCollection_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)
- **FK** `FK_CashDataCollection_DebitCreditNoteItem` (DebitCreditNoteItemID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_CashDataCollection_PettyCashCostItem` (PettyCashCostItemID) -> FIN.PettyCashCostItem (PettyCashCostItemID)
- **FK** `FK_CashDataCollection_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashDataCollection_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CashDataCollection_PurchaseInvoicePrePayment` (PurchaseInvoicePrePaymentID) -> VND.PurchaseInvoicePrePayment (PurchaseInvoicePrePaymentID)
- **FK** `FK_CashDataCollection_Voucher` (VoucherID) -> ACC.Voucher (VoucherID)
- **FK** `FK_CashDataCollection_CalculationResult` (CalculationResultID) -> PAY.CalculationResult (CalculationResultID)
- **FK** `FK_CashDataCollection_ReceiveSubject` (ReceiveSubjectID) -> FIN.ReceiveSubject (ReceiveSubjectID)
- **Referenced by:** NOC.CashAnalysing (CashDataCollectionID)

### NOC.CashDataCollection_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSubjectID | int | Y |  |  |
| 2 | DebitCreditNoteItemID | int | Y |  |  |
| 3 | PettyCashCostItemID | int | Y |  |  |
| 4 | ConfirmStatementPrePaymentID | int | Y |  |  |
| 5 | PurchaseInvoicePrePaymentID | int | Y |  |  |
| 6 | VoucherID | int | Y |  |  |
| 7 | CalculationResultID | int | Y |  |  |
| 8 | Status | tinyint | N |  |  |
| 9 | ReceiveSubjectID | int | Y |  |  |
| 10 | ReportagePeriodID | int | Y |  |  |
| 11 | CalculationID | int | Y |  |  |
| 12 | ConfirmStatementItemID | int | Y |  |  |
| 13 | BaseDocumentType | varchar(100) | Y |  |  |
| 14 | BaseDocumentID | int | Y |  |  |


### NOC.CashFounding

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashFoundingID | int | N |  | identity |
| 2 | SlID | int | N |  |  |
| 3 | DLID | bigint | N |  |  |
| 4 | Debit | decimal(30,4) | N |  |  |
| 5 | Credit | decimal(30,4) | N |  |  |
| 6 | CurrencyRate | decimal(30,4) | N |  |  |
| 7 | BaseCurrencyDebit | decimal(30,4) | N |  |  |
| 8 | BaseCurrencyCredit | decimal(30,4) | N |  |  |
| 9 | ToDate | date | N |  |  |
| 10 | ReportagePeriodID | int | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | Status | tinyint | N | ((1)) |  |
| 17 | Description | nvarchar(MAX) | Y |  |  |
| 18 | Description2 | nvarchar(MAX) | Y |  |  |
| 19 | Number | int | Y |  |  |

- **Primary key:** CashFoundingID
- **FK** `FK_CashFounding_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CashFounding_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_CashFounding_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_CashFounding_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashFounding_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.ConfirmedReport

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmedReportID | int | N |  | identity |
| 2 | ReportagePeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Status | tinyint | N | ((1)) |  |

- **Primary key:** ConfirmedReportID
- **unique constraint** `UC_ConfirmedReport_ReportagePeriodID_Type` (ReportagePeriodID, Type)
- **FK** `FK_ConfirmedReport_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_ConfirmedReport_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmedReport_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.CurrencyExchange

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CurrencyExchangeID | int | N |  | identity |
| 2 | AnalysingID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | SlID | int | N |  |  |
| 5 | ExchangeGainLoss | int | Y |  |  |
| 6 | Value | decimal(30,4) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | PartyID | bigint | Y |  |  |
| 13 | CashVoucherID | int | Y |  |  |
| 14 | AccruePreVoucherID | int | Y |  |  |
| 15 | OriginSlID | int | Y |  |  |
| 16 | AccrueVoucherID | int | Y |  |  |
| 17 | ContractID | int | Y |  |  |

- **Primary key:** CurrencyExchangeID
- **FK** `FK_CurrencyExchange_AccrueVoucher` (AccrueVoucherID) -> ACC.Voucher (VoucherID)
- **FK** `FK_CurrencyExchange_CashVoucher` (CashVoucherID) -> ACC.Voucher (VoucherID)
- **FK** `FK_CurrencyExchange_Analysing` (AnalysingID) -> NOC.Analysing (AnalysingID) on delete CASCADE
- **FK** `FK_CurrencyExchange_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_CurrencyExchange_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_CurrencyExchange_ExchangeGainLoss` (ExchangeGainLoss) -> ACC.SL (SlID)
- **FK** `FK_CurrencyExchange_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CurrencyExchange_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CurrencyExchange_Party` (PartyID) -> CFG.Party (PartyID)

### NOC.DataCollection

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DataCollectionID | int | N |  | identity |
| 2 | ReportagePeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** DataCollectionID
- **unique constraint** `UC_DataCollection_ReportagePeriodID_Type` (ReportagePeriodID, Type)
- **FK** `FK_DataCollection_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_DataCollection_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DataCollection_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** NOC.AccrueDataCollection (DataCollectionID); NOC.CashDataCollection (DataCollectionID)

### NOC.FractionPayrollParameterSetting

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParameterID | int | Y |  |  |
| 2 | Type | tinyint | Y |  |  |
| 3 | FractionPayrollParameterSettingID | int | N |  | identity |
| 4 | Version | int | Y |  |  |
| 5 | Creator | int | Y |  |  |
| 6 | CreationDate | datetime | Y |  |  |
| 7 | LastEditor | int | Y |  |  |
| 8 | LastEditionDate | datetime | Y |  |  |

- **Primary key:** FractionPayrollParameterSettingID
- **FK** `FK_FractionPayrollParameterSetting_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FractionPayrollParameterSetting_LastEditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FractionPayrollParameterSetting_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)

### NOC.InventoryAnalysis

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentName | varchar(256) | Y |  |  |
| 2 | DocumentID | int | Y |  |  |
| 3 | ShareOfBalancing | decimal(30,4) | Y |  |  |
| 4 | Creator | int | Y |  |  |
| 5 | CreationDate | datetime | Y |  |  |
| 6 | LastEditor | int | Y |  |  |
| 7 | LastEditionDate | datetime | Y |  |  |
| 8 | Version | int | Y |  |  |


### NOC.Modification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ModificationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Description | nvarchar(1024) | Y |  |  |
| 5 | Description2 | nvarchar(1024) | Y |  |  |
| 6 | ReportagePeriodID | int | N |  |  |
| 7 | SlID | int | N |  |  |
| 8 | VoucherItemID | int | N |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | ReportCurrencyRate | decimal(30,10) | Y |  |  |
| 16 | BasePrevoucherID | int | Y |  |  |

- **Primary key:** ModificationID
- **FK** `FK_Modification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Modification_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Modification_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_Modification_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_Modification_VoucherItem` (VoucherItemID) -> ACC.VoucherItem (VoucherItemID)
- **FK** `FK_Modification_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** NOC.CashAndExchangeModification (ModificationID); NOC.ModifiedTopic (ModificationID)

### NOC.ModifiedTopic

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ModifiedTopicID | int | N |  | identity |
| 2 | ModificationID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | ModificationPercent | decimal(13,10) | N |  |  |
| 5 | BaseCurrencyDebitAccrue | decimal(30,4) | N |  |  |
| 6 | BaseCurrencyCreditAccrue | decimal(30,4) | N |  |  |
| 7 | ReportCurrencyDebitAccrue | decimal(30,4) | N |  |  |
| 8 | ReportCurrencyCreditAccrue | decimal(30,4) | N |  |  |
| 9 | BaseCurrencyDebitCash | decimal(30,4) | N |  |  |
| 10 | BaseCurrencyCreditCash | decimal(30,4) | N |  |  |
| 11 | ReportCurrencyDebitCash | decimal(30,4) | N |  |  |
| 12 | ReportCurrencyCreditCash | decimal(30,4) | N |  |  |
| 13 | ReportCurrencyDebitExchange | decimal(30,4) | N |  |  |
| 14 | ReportCurrencyCreditExchange | decimal(30,4) | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | ToBeReported | bit | N | ((0)) |  |

- **Primary key:** ModifiedTopicID
- **FK** `FK_ModifiedTopic_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ModifiedTopic_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ModifiedTopic_Modified` (ModificationID) -> NOC.Modification (ModificationID) on delete CASCADE
- **FK** `FK_ModifiedTopic_Sl` (SlID) -> ACC.SL (SlID)

### NOC.NIOCAccountCode

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NIOCAccountCodeID | int | N |  | identity |
| 2 | SlID | int | N |  |  |
| 3 | DlID | int | Y |  |  |
| 4 | NIOCCode | varchar(100) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** NIOCAccountCodeID
- **FK** `FK_NIOCAccountCode_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_NIOCAccountCode_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.NIOCSetting

Rows: 12

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NIOCSettingID | int | N |  | identity |
| 2 | ConfigKey | varchar(50) | N |  |  |
| 3 | ConfigValue | nvarchar(500) | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** NIOCSettingID
- **FK** `FK_NIOCSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_NIOCSetting_LastEditor` (LastEditor) -> CFG.User (UserID)

### NOC.ReportagePeriod

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportagePeriodID | int | N |  | identity |
| 2 | Order | int | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | StartDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** ReportagePeriodID
- **FK** `FK_ReportagePeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReportagePeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** NOC.Analysing (CalculatePeriodID); NOC.Analysing (ReportagePeriodID); NOC.CashFounding (ReportagePeriodID); NOC.ConfirmedReport (ReportagePeriodID); NOC.DataCollection (ReportagePeriodID); NOC.Modification (ReportagePeriodID); NOC.ReportHeadline (ReportagePeriodID)

### NOC.ReportHeadline

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportHeadlineID | int | N |  | identity |
| 2 | ReportagePeriodID | int | N |  |  |
| 3 | SlID | int | N |  |  |
| 4 | HasCashNature | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | ProfitAndLossSlID | int | Y |  |  |
| 11 | OnlyInPeriodReview | bit | N |  |  |

- **Primary key:** ReportHeadlineID
- **unique constraint** `Uc_ReportHeadline_SlID` (SlID)
- **FK** `FK_ReportHeadline_ReportagePeriod` (ReportagePeriodID) -> NOC.ReportagePeriod (ReportagePeriodID)
- **FK** `FK_ReportHeadline_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_ReportHeadline_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReportHeadline_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReportHeadline_ProfitAndLossSl` (ProfitAndLossSlID) -> ACC.SL (SlID)

## Views

### NOC.VWAddDeducPerConfirmPurchaseInvoiceItem

Definition: `programmability/views/NOC.VWAddDeducPerConfirmPurchaseInvoiceItem.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceItemID | int | N |
| 2 | SlID | int | Y |
| 3 | Share | float | Y |
| 4 | VoucherID | int | N |
| 5 | AccruePreVoucherID | int | Y |

### NOC.VWAdditionDeductionPortion

Definition: `programmability/views/NOC.VWAdditionDeductionPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementItemID | int | N |
| 2 | SlID | int | Y |
| 3 | ContractID | int | Y |
| 4 | Share | float | Y |
| 5 | VoucherID | int | Y |
| 6 | PreVoucherID | int | Y |

### NOC.vwCalculationTypeHasReserve

Definition: `programmability/views/NOC.vwCalculationTypeHasReserve.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CalculationPersonelID | int | N |
| 2 | CalculationTypeID | tinyint | N |
| 3 | CalendarMonthID | int | N |
| 4 | PersonelID | int | N |
| 5 | EndDate | date | N |
| 6 | PreviousCalcDate | date | Y |
| 7 | ParameterID | int | Y |
| 8 | Value | decimal(30,10) | N |
| 9 | SlID | int | N |
| 10 | VoucherID | int | Y |
| 11 | NetParam | int | Y |

### NOC.VWConfirmPurchaseInvoiceAdvancePayment

Definition: `programmability/views/NOC.VWConfirmPurchaseInvoiceAdvancePayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceAdvancePaymentID | int | N |
| 2 | ConfirmPurchaseInvoiceID | int | Y |
| 3 | PurchaseInvoiceID | int | N |
| 4 | CurrencyAmount | decimal(30,4) | Y |
| 5 | Amount | decimal(38,6) | Y |
| 6 | PaymentTypeID | int | Y |
| 7 | EffectiveDate | date | Y |
| 8 | DocumentNumber | int | N |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | ReferenceNumber | int | N |
| 12 | VoucherID | int | N |
| 13 | VoucherDate | date | N |
| 14 | DlID | bigint | N |
| 15 | Description | nvarchar(MAX) | Y |
| 16 | AdditionDeductionSlID | int | N |

### NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion

Definition: `programmability/views/NOC.VWConfirmPurchaseInvoiceAdvancePaymentSlPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceAdvancePaymentID | int | N |
| 2 | ConfirmPurchaseInvoiceID | int | Y |
| 3 | SlID | int | Y |
| 4 | Share | float | Y |
| 5 | VoucherID | int | N |
| 6 | AccruePreVoucherID | int | Y |
| 7 | AdditionDeductionSlID | int | N |

### NOC.VwConfirmStatementItem

Definition: `programmability/views/NOC.VwConfirmStatementItem.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | ConfirmStatementItemID | int | N |
| 3 | ConfirmStatementPrePaymentID | int | N |
| 4 | EffectiveDate | date | Y |
| 5 | DocumentNumber | int | N |
| 6 | ReferenceNumber | int | N |
| 7 | VoucherID | int | N |
| 8 | VoucherDate | date | N |
| 9 | Amount | decimal(38,6) | Y |
| 10 | DlID | bigint | Y |
| 11 | FinancialPeriodID | int | Y |
| 12 | Description | nvarchar(MAX) | Y |
| 13 | PreVoucherID | int | Y |
| 14 | CurrencyID | int | N |
| 15 | CurrencyRate | decimal(20,10) | N |

### NOC.VWConfirmStatementItemPortion

Definition: `programmability/views/NOC.VWConfirmStatementItemPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementPrePaymentID | int | N |
| 2 | SlID | int | Y |
| 3 | Share | decimal(38,6) | Y |
| 4 | AdditionDeductionSlID | int | N |

### NOC.VWConfirmStatementPortion

Definition: `programmability/views/NOC.VWConfirmStatementPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | SlID | int | Y |
| 3 | Share | decimal(38,6) | Y |
| 4 | VoucherID | int | Y |
| 5 | PreVoucherID | int | Y |

### NOC.VWContractVat

Definition: `programmability/views/NOC.VWContractVat.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractStatementID | int | N |
| 2 | VoucherID | int | Y |
| 3 | Share | float | Y |
| 4 | SlID | int | N |
| 5 | PreVoucherID | int | Y |

### NOC.VwDebitCreditNote

Definition: `programmability/views/NOC.VwDebitCreditNote.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DebitCreditNoteID | int | N |
| 2 | DebitCreditNoteItemID | int | N |
| 3 | SlID | int | Y |
| 4 | EffectiveDate | date | Y |
| 5 | DocumentNumber | int | N |
| 6 | ReferenceNumber | int | N |
| 7 | VoucherID | int | N |
| 8 | VoucherDate | date | N |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | PaymentTypeID | int | Y |
| 12 | ReceiptTypeID | int | Y |
| 13 | PurchaseInvoiceID | int | Y |
| 14 | ReturnInvoiceID | int | Y |
| 15 | ContractID | int | Y |
| 16 | ConfirmStatementID | int | Y |
| 17 | ConfirmStatementItemID | int | Y |
| 18 | ContractStatementID | int | Y |
| 19 | CalculationResultID | decimal(18,0) | Y |
| 20 | ConfirmPurchaseInvoiceID | int | Y |
| 21 | ConfirmPurchaseInvoiceItemID | int | Y |
| 22 | CurrencyAmount | decimal(38,4) | Y |
| 23 | Amount | decimal(38,6) | Y |
| 24 | DlID | bigint | Y |
| 25 | Description | nvarchar(MAX) | Y |
| 26 | Type | tinyint | N |
| 27 | PreVoucherID | int | Y |
| 28 | Date | date | N |

### NOC.VwDepreciatedDeductionInConfirmStatement

Definition: `programmability/views/NOC.VwDepreciatedDeductionInConfirmStatement.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | ConfirmStatementItemID | int | N |
| 3 | EffectiveDate | date | N |
| 4 | DocumentNumber | int | N |
| 5 | ReferenceNumber | int | N |
| 6 | VoucherID | int | N |
| 7 | VoucherDate | date | N |
| 8 | Amount | decimal(38,6) | Y |
| 9 | DlID | bigint | Y |
| 10 | FinancialPeriodID | int | Y |
| 11 | Description | nvarchar(MAX) | Y |
| 12 | PreVoucherID | int | Y |
| 13 | CurrencyID | int | N |
| 14 | CurrencyRate | decimal(20,10) | N |

### NOC.VWDollarOfStock

Definition: `programmability/views/NOC.VWDollarOfStock.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocumentName | varchar(256) | Y |
| 2 | DocumentID | int | Y |
| 3 | Price | decimal(38,7) | Y |

### NOC.VwPaymentReceipt

Definition: `programmability/views/NOC.VwPaymentReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PaymentReceiptID | int | N |
| 2 | PaymentSubjectID | int | N |
| 3 | SlID | int | Y |
| 4 | EffectiveDate | date | Y |
| 5 | DocumentNumber | int | N |
| 6 | ReferenceNumber | int | N |
| 7 | VoucherID | int | N |
| 8 | BaseVoucherID | int | N |
| 9 | VoucherDate | date | N |
| 10 | CurrencyID | int | N |
| 11 | CurrencyRate | decimal(20,10) | N |
| 12 | PaymentTypeID | int | N |
| 13 | PurchaseInvoiceID | int | Y |
| 14 | ContractID | int | Y |
| 15 | ConfirmStatementID | int | Y |
| 16 | ConfirmStatementItemID | int | Y |
| 17 | ContractStatementID | int | Y |
| 18 | CalculationResultID | decimal(18,0) | Y |
| 19 | PayPreparingID | int | Y |
| 20 | ConfirmPurchaseInvoiceID | int | Y |
| 21 | ConfirmPurchaseInvoiceItemID | int | Y |
| 22 | CurrencyAmount | decimal(36,10) | Y |
| 23 | Amount | decimal(38,6) | Y |
| 24 | DLID | bigint | Y |
| 25 | Description | nvarchar(250) | Y |
| 26 | PreVoucherID | int | Y |
| 27 | CheqeNumber | nvarchar(100) | Y |

### NOC.VWPayrollCostPortion

Definition: `programmability/views/NOC.VWPayrollCostPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PayPreparingID | int | N |
| 2 | PersonelID | int | N |
| 3 | VoucherID | int | Y |
| 4 | SlID | int | Y |
| 5 | CalculationTypeID | tinyint | N |
| 6 | Amount | float | Y |
| 7 | ShareOfRoundingIsAllowed | int | N |

### NOC.VwPettyCashCost

Definition: `programmability/views/NOC.VwPettyCashCost.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PettyCashCostID | int | N |
| 2 | PettyCashCostItemID | int | N |
| 3 | SlID | int | Y |
| 4 | EffectiveDate | date | N |
| 5 | DocumentNumber | int | N |
| 6 | ReferenceNumber | int | N |
| 7 | VoucherID | int | N |
| 8 | VoucherDate | date | N |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | PaymentTypeID | int | N |
| 12 | PurchaseInvoiceID | int | Y |
| 13 | ConfirmPurchaseInvoiceID | int | Y |
| 14 | ConfirmPurchaseInvoiceItemID | int | Y |
| 15 | PayPreparingID | int | Y |
| 16 | CurrencyAmount | decimal(30,4) | N |
| 17 | Amount | decimal(38,6) | Y |
| 18 | DlID | bigint | Y |
| 19 | Description | nvarchar(MAX) | Y |
| 20 | PreVoucherID | int | Y |

### NOC.VWPurchaseInvoicePrePayment

Definition: `programmability/views/NOC.VWPurchaseInvoicePrePayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoicePrePaymentID | int | N |
| 2 | PurchaseInvoiceID | int | N |
| 3 | Amount | decimal(38,6) | Y |
| 4 | PaymentTypeID | int | Y |
| 5 | EffectiveDate | date | Y |
| 6 | DocumentNumber | int | N |
| 7 | CurrencyID | int | N |
| 8 | CurrencyRate | decimal(20,10) | N |
| 9 | ReferenceNumber | int | N |
| 10 | VoucherID | int | N |
| 11 | VoucherDate | date | N |
| 12 | DlID | bigint | N |
| 13 | Description | nvarchar(MAX) | Y |

### NOC.VWPurchaseInvoicePrePaymentSlPortion

Definition: `programmability/views/NOC.VWPurchaseInvoicePrePaymentSlPortion.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoicePrePaymentID | int | N |
| 2 | PurchaseInvoiceID | int | N |
| 3 | SlID | int | Y |
| 4 | Share | float | Y |
| 5 | VoucherID | int | N |
| 6 | AccruePreVoucherID | int | Y |

### NOC.VwReceiveReceipt

Definition: `programmability/views/NOC.VwReceiveReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReceiveReceiptID | int | N |
| 2 | ReceiveSubjectID | int | N |
| 3 | SlID | int | Y |
| 4 | EffectiveDate | date | Y |
| 5 | DocumentNumber | int | N |
| 6 | ReferenceNumber | int | N |
| 7 | VoucherID | int | N |
| 8 | VoucherDate | date | N |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | ReceiptTypeID | int | N |
| 12 | PurchaseInvoiceID | int | Y |
| 13 | ReturnInvoiceID | int | Y |
| 14 | ContractID | int | Y |
| 15 | ConfirmStatementID | int | Y |
| 16 | ConfirmStatementItemID | int | Y |
| 17 | ContractStatementID | int | Y |
| 18 | Amount | decimal(38,6) | Y |
| 19 | DLID | bigint | Y |
| 20 | Description | nvarchar(250) | Y |
| 21 | PreVoucherID | int | Y |
| 22 | BaseVoucherID | int | N |

### NOC.VWReportagePeriodAccess

Definition: `programmability/views/NOC.VWReportagePeriodAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | ReportagePeriodID | int | N |

### NOC.VWTraceOfPurchaseInvoice

Definition: `programmability/views/NOC.VWTraceOfPurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |
| 2 | VoucherID | int | N |
| 3 | SlID | int | Y |
| 4 | Share | float | Y |
| 5 | Title2 | nvarchar(256) | N |
| 6 | AccruePreVoucherID | int | Y |
| 7 | DonePrice | decimal(38,4) | Y |
| 8 | CurrencyID | int | N |
| 9 | HasConfirmStatement | bit | N |

### NOC.VWTraceOfPurchaseInvoice_Net

Definition: `programmability/views/NOC.VWTraceOfPurchaseInvoice_Net.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |
| 2 | VoucherID | int | N |
| 3 | SlID | int | Y |
| 4 | Share | float | Y |
| 5 | Title2 | nvarchar(256) | N |
| 6 | AccruePreVoucherID | int | Y |
| 7 | DonePrice | decimal(38,4) | Y |
| 8 | CurrencyID | int | N |
| 9 | ConfirmPurchaseInvoiceID | int | Y |
| 10 | HasConfirmStatement | bit | N |

### NOC.VWTraceOfPurchaseInvoice_Vat

Definition: `programmability/views/NOC.VWTraceOfPurchaseInvoice_Vat.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |
| 2 | VoucherID | int | N |
| 3 | SlID | int | N |
| 4 | Share | float | Y |
| 5 | Title2 | nvarchar(256) | N |
| 6 | AccruePreVoucherID | int | Y |
| 7 | DonePrice | decimal(36,10) | Y |
| 8 | CurrencyID | int | N |
| 9 | HasConfirmStatement | bit | N |

### NOC.VWTraceOfReturnInvoice

Definition: `programmability/views/NOC.VWTraceOfReturnInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnInvoiceID | int | N |
| 2 | VoucherID | int | N |
| 3 | SlID | int | Y |
| 4 | Share | float | Y |
| 5 | Title2 | nvarchar(256) | N |
| 6 | AccruePreVoucherID | int | Y |
| 7 | DonePrice | decimal(38,10) | Y |

