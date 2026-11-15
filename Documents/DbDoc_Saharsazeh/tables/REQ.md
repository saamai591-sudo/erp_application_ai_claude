# Schema `REQ`

## Tables

### REQ.AdvancePaymentRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdvancePaymentRequestID | int | N |  | identity |
| 2 | Status | tinyint | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | RequestedAmount | decimal(36,10) | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | Description2 | nvarchar(MAX) | Y |  |  |
| 9 | Reviewer | int | Y |  |  |
| 10 | ReviewDate | datetime | Y |  |  |
| 11 | AcceptanceDate | date | Y |  |  |
| 12 | FinalAmount | decimal(36,10) | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AdvancePaymentRequestID
- **FK** `FK_AdvancePaymentRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_AdvancePaymentRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **FK** `FK_AdvancePaymentRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AdvancePaymentRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** REQ.PaymentOrderItem (AdvancePaymentRequestID)

### REQ.ConfirmationRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmationRequestID | int | N |  | identity |
| 2 | ConfirmationTypeID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | PersonelID | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Reciver | nvarchar(1024) | Y |  |  |
| 7 | ReciverPerson | nvarchar(1024) | Y |  |  |
| 8 | Amount | decimal(18,4) | Y |  |  |
| 9 | InstallmentAmount | decimal(18,4) | Y |  |  |
| 10 | Description | nvarchar(2048) | Y |  |  |
| 11 | Status | tinyint | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |

- **Primary key:** ConfirmationRequestID
- **FK** `FK_ConfirmationRequest_ConfirmationType` (ConfirmationTypeID) -> HRM.ConfirmationType (ConfirmationTypeID)
- **FK** `FK_ConfirmationRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmationRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConfirmationRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)

### REQ.LoanRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LoanRequestID | int | N |  | identity |
| 2 | Status | tinyint | N |  |  |
| 3 | PersonelID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | ParameterID | int | N |  |  |
| 7 | RequestedAmount | decimal(36,10) | N |  |  |
| 8 | InstallmentAmount | decimal(36,10) | N |  |  |
| 9 | Description | nvarchar(MAX) | Y |  |  |
| 10 | Description2 | nvarchar(MAX) | Y |  |  |
| 11 | Reviewer | int | Y |  |  |
| 12 | ReviewDate | datetime | Y |  |  |
| 13 | AcceptanceDate | date | Y |  |  |
| 14 | FinalAmount | decimal(36,10) | N |  |  |
| 15 | FinalInstallmentAmount | decimal(36,10) | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | Version | int | N |  |  |

- **Primary key:** LoanRequestID
- **FK** `FK_LoanRequest_Personel` (PersonelID) -> HRM.Personel (PersonelID)
- **FK** `FK_LoanRequest_Parameter` (ParameterID) -> PAY.Parameter (ParameterID)
- **FK** `FK_LoanRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **FK** `FK_LoanRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LoanRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** REQ.PaymentOrderItem (LoanRequestID)

### REQ.PaymentOrder

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentOrderID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | datetime | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | PaymentCurrencyID | int | N |  |  |
| 6 | BaseType | int | N |  |  |
| 7 | BankAccountID | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | Description | nvarchar(MAX) | Y |  |  |
| 14 | Description2 | nvarchar(MAX) | Y |  |  |
| 15 | PaymentOrderStatus | tinyint | N |  |  |

- **Primary key:** PaymentOrderID
- **FK** `FK_PaymentOrder_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentOrder_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentOrder_Currency` (PaymentCurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentOrder_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentOrder_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.PaymentReceipt (PaymentOrderID); REQ.PaymentOrderItem (PaymentOrderID)

### REQ.PaymentOrderItem

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentOrderItemID | int | N |  | identity |
| 2 | PaymentOrderID | int | N |  |  |
| 3 | PaymentRequestItemID | int | Y |  |  |
| 4 | PayPreparingID | int | Y |  |  |
| 5 | BankAccountID | int | Y |  |  |
| 6 | PettyCashID | int | Y |  |  |
| 7 | ReceiverID | bigint | Y |  |  |
| 8 | BaseCurrencyID | int | N |  |  |
| 9 | Price | decimal(36,10) | N |  |  |
| 10 | ExchangeRate | decimal(36,10) | N |  |  |
| 11 | Description | nvarchar(MAX) | Y |  |  |
| 12 | Description2 | nvarchar(MAX) | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |
| 18 | AdvancePaymentRequestID | int | Y |  |  |
| 19 | LoanRequestID | int | Y |  |  |

- **Primary key:** PaymentOrderItemID
- **FK** `FK_PaymentOrderItem_AdvancePaymentRequest` (AdvancePaymentRequestID) -> REQ.AdvancePaymentRequest (AdvancePaymentRequestID)
- **FK** `FK_PaymentOrderItem_LoanRequest` (LoanRequestID) -> REQ.LoanRequest (LoanRequestID)
- **FK** `FK_PaymentOrderItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentOrderItem_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentOrderItem_Currency` (BaseCurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentOrderItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentOrderItem_PaymentRequestItem` (PaymentRequestItemID) -> REQ.PaymentRequestItem (PaymentRequestItemID)
- **FK** `FK_PaymentOrderItem_PaymentOrder` (PaymentOrderID) -> REQ.PaymentOrder (PaymentOrderID) on delete CASCADE
- **FK** `FK_PaymentOrderItem_PayPreparing` (PayPreparingID) -> PAY.PayPreparing (PayPreparingID)
- **FK** `FK_PaymentOrderItem_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)

### REQ.PaymentRequest

Rows: 12

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentRequestID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | BranchID | int | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | Description2 | nvarchar(MAX) | Y |  |  |
| 9 | Status | tinyint | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | OrganizationUnitID | int | N |  |  |
| 16 | Reviewer | int | Y |  |  |
| 17 | ReviewDate | datetime | Y |  |  |

- **Primary key:** PaymentRequestID
- **FK** `FK_PaymentRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PaymentRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_PaymentRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **Referenced by:** FIN.PaymentCommitment (PaymentRequestID); FIN.PaymentReceipt (PaymentRequestID); REQ.PaymentRequestItem (PaymentRequestID)

### REQ.PaymentRequestItem

Rows: 13

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentRequestItemID | int | N |  | identity |
| 2 | PaymentRequestID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BaseDocumentType | tinyint | N |  |  |
| 5 | BaseDocumentID | int | Y |  |  |
| 6 | CurrencyID | int | N |  |  |
| 7 | Amount | decimal(36,10) | Y |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | PartyID | bigint | N |  |  |
| 16 | PartyAccountID | int | Y |  |  |

- **Primary key:** PaymentRequestItemID
- **FK** `FK_PaymentRequestItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PaymentRequestItem_PartyAccount` (PartyAccountID) -> CFG.PartyAccount (PartyAccountID)
- **FK** `FK_PaymentRequestItem_PaymentRequest` (PaymentRequestID) -> REQ.PaymentRequest (PaymentRequestID) on delete CASCADE
- **FK** `FK_PaymentRequestItem_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentRequestItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentRequestItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** REQ.PaymentOrderItem (PaymentRequestItemID)

### REQ.PurchaseRequest

Rows: 0 | درخواست خرید

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseRequestID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | PurchaseRequestNumber | int | N |  |  |
| 4 | PurchaseRequestDate | date | N |  |  |
| 5 | PurchaseRequestState | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | FinancialPeriodID | int | N |  |  |
| 12 | OrganizationUnitID | int | N |  |  |
| 13 | BaseDocument | int | N | ((1)) |  |
| 14 | Reviewer | int | Y |  |  |
| 15 | ReviewDate | datetime | Y |  |  |

- **Primary key:** PurchaseRequestID
- **FK** `FK_PurchaseRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PurchaseRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PurchaseRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_PurchaseRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **Referenced by:** REQ.PurchaseRequestItem (PurchaseRequestID); VND.ProposalCommission (PurchaseRequestID)

### REQ.PurchaseRequestItem

Rows: 0 | آیتم درخواست خرید

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseRequestItemID | int | N |  | identity |
| 2 | PurchaseRequestID | int | N |  |  |
| 3 | PurchaseRequestItemIndex | int | N |  |  |
| 4 | StuffRequestItemID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(30,4) | N |  |  |
| 7 | SubQuantity | decimal(30,4) | Y |  |  |
| 8 | Description | nvarchar(256) | Y |  |  |
| 9 | Description2 | nvarchar(256) | Y |  |  |
| 10 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |  |  |
| 17 | OrderItemID | int | Y |  |  |
| 18 | JustificationItemID | int | Y |  |  |
| 19 | QuotationItemID | int | Y |  |  |
| 20 | SaleContractItemID | int | Y |  |  |
| 21 | ServiceRequestItemID | int | Y |  |  |

- **Primary key:** PurchaseRequestItemID
- **FK** `FK_PurchaseRequestItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequestItem_JustificationItem` (JustificationItemID) -> SLE.JustificationItem (JustificationItemID)
- **FK** `FK_PurchaseRequestItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequestItem_OrderItem` (OrderItemID) -> CTM.OrderItem (OrderItemID)
- **FK** `FK_PurchaseRequestItem_PurchaseRequest` (PurchaseRequestID) -> REQ.PurchaseRequest (PurchaseRequestID) on delete CASCADE
- **FK** `FK_PurchaseRequestItem_QuotationItem` (QuotationItemID) -> SLE.QuotationItem (QuotationItemID)
- **FK** `FK_PurchaseRequestItem_SaleContractItem` (SaleContractItemID) -> SLE.SaleContractItem (SaleContractItemID)
- **FK** `FK_PurchaseRequestItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_PurchaseRequestItem_StuffRequestItem` (StuffRequestItemID) -> REQ.StuffRequestItem (StuffRequestItemID)
- **FK** `FK_PurchaseRequestItem_ServiceRequestItem` (ServiceRequestItemID) -> REQ.ServiceRequestItem (ServiceRequestItemID)
- **Referenced by:** FOS.ProformaInvoiceItem (PurchaseRequestItemID); REQ.PurchaseRequestItemTrace (PurchaseRequestItemID); REQ.TenderRequestItem (PurchaseRequestItemID); STC.JustificationInputItem (PurchaseRequestItemID); STC.StockReceiptItem (PurchaseRequestItemID); STC.TemporaryStockReceiptItem (PurchaseRequestItemID); VND.ProposalItem (PurchaseRequestItemID); VND.PurchaseContractItem (PurchaseRequestItemID); VND.PurchaseInvoiceItem (PurchaseRequestItemID); VND.PurchasePlanningItem (PurchaseRequestItemID)

### REQ.PurchaseRequestItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseRequestItemTraceID | int | N |  | identity |
| 2 | PurchaseRequestItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** PurchaseRequestItemTraceID
- **unique index** `IX_PurchaseRequestItemTrace` (PurchaseRequestItemID, TraceID)
- **FK** `FK_PurchaseRequestItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequestItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PurchaseRequestItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseRequestItemTrace_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID) on delete CASCADE
- **FK** `FK_PurchaseRequestItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)
- **FK** `FK_PurchaseRequestItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)

### REQ.ReceiveRequest

Rows: 1 | درخواست دریافت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveRequestID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | BranchID | int | N |  |  |
| 7 | PartyID | bigint | N |  |  |
| 8 | CurrencyID | int | N |  |  |
| 9 | Amount | decimal(36,10) | Y |  |  |
| 10 | Non_Received | decimal(36,10) | Y |  |  |
| 11 | Description | nvarchar(MAX) | Y |  |  |
| 12 | Description2 | nvarchar(MAX) | Y |  |  |
| 13 | Status | tinyint | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | OrganizationUnitID | int | N |  |  |
| 20 | Reviewer | int | Y |  |  |
| 21 | ReviewDate | datetime | Y |  |  |

- **Primary key:** ReceiveRequestID
- **FK** `FK_ReceiveRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceiveRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveRequest_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReceiveRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceiveRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_ReceiveRequest_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ReceiveRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **Referenced by:** FIN.ReceiveCommitment (ReceiveRequestID)

### REQ.ReturnRequest

Rows: 0 | درخواست برگشت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnRequestID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | StockID | int | N |  |  |
| 4 | ReturnRequestNumber | int | N |  |  |
| 5 | ReturnRequestDate | date | N |  |  |
| 6 | ReturnRequestState | tinyint | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | FinancialPeriodID | int | N |  |  |
| 13 | OrganizationUnitID | int | N |  |  |
| 14 | DocumentType | int | N | ((1)) |  |
| 15 | Reviewer | int | Y |  |  |
| 16 | ReviewDate | datetime | Y |  |  |

- **Primary key:** ReturnRequestID
- **FK** `FK_ReturnRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReturnRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_ReturnRequest_Stock` (StockID) -> STF.Stock (StockID)
- **FK** `FK_ReturnRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **Referenced by:** REQ.ReturnRequestItem (ReturnRequestID)

### REQ.ReturnRequestItem

Rows: 0 | آیتم درخواست برگشت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnRequestItemID | int | N |  | identity |
| 2 | ReturnRequestID | int | N |  |  |
| 3 | ReturnRequestItemIndex | tinyint | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(256) | Y |  |  |
| 8 | Description2 | nvarchar(256) | Y |  |  |
| 9 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | StockReceiptItemID | int | Y |  |  |
| 16 | TemporaryStockReceiptItemID | int | Y |  |  |
| 17 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |  |  |

- **Primary key:** ReturnRequestItemID
- **FK** `FK_ReturnRequestItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnRequestItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnRequestItem_ReturnRequest` (ReturnRequestID) -> REQ.ReturnRequest (ReturnRequestID) on delete CASCADE
- **FK** `FK_ReturnRequestItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_ReturnRequestItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ReturnRequestItem_TemporaryStockReceiptItem` (TemporaryStockReceiptItemID) -> STC.TemporaryStockReceiptItem (TemporaryStockReceiptItemID)
- **Referenced by:** REQ.ReturnRequestItemTrace (ReturnRequestItemID); STC.ReturnedTemporaryStockReceiptItem (ReturnRequestItemID); STC.ReturnStockReceiptItem (ReturnRequestItemID)

### REQ.ReturnRequestItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnRequestItemTraceID | int | N |  | identity |
| 2 | ReturnRequestItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** ReturnRequestItemTraceID
- **unique index** `IX_ReturnRequestItemTrace` (ReturnRequestItemID, TraceID)
- **FK** `FK_ReturnRequestItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnRequestItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_ReturnRequestItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnRequestItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnRequestItemTrace_ReturnRequestItem` (ReturnRequestItemID) -> REQ.ReturnRequestItem (ReturnRequestItemID) on delete CASCADE
- **FK** `FK_ReturnRequestItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### REQ.ServiceRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ServiceRequestID | int | N |  | identity |
| 2 | OrganizationUnitID | int | N |  |  |
| 3 | FinancialPeriodID | int | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | Date | datetime | N |  |  |
| 7 | State | tinyint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | ReviewerID | int | Y |  |  |
| 14 | ReviewDate | date | Y |  |  |

- **Primary key:** ServiceRequestID
- **FK** `FK_ServiceRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ServiceRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_ServiceRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ServiceRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ServiceRequest_Reviewer` (ReviewerID) -> CFG.User (UserID)
- **FK** `FK_ServiceRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **Referenced by:** REQ.ServiceRequestItem (ServiceRequestID)

### REQ.ServiceRequestItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ServiceRequestItemID | int | N |  | identity |
| 2 | ServiceRequestID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | RowIndex | int | N |  |  |
| 5 | Quantity | decimal(30,4) | N |  |  |
| 6 | Description | nvarchar(255) | Y |  |  |
| 7 | Description2 | nvarchar(255) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ServiceRequestItemID
- **FK** `FK_ServiceRequestItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ServiceRequestItem_ServiceRequest` (ServiceRequestID) -> REQ.ServiceRequest (ServiceRequestID) on delete CASCADE
- **FK** `FK_ServiceRequestItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ServiceRequestItem_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** REQ.PurchaseRequestItem (ServiceRequestItemID)

### REQ.StuffRequest

Rows: 1 | درخواست کالا

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffRequestID | int | N |  | identity |
| 2 | BranchID | int | Y |  |  |
| 3 | StuffRequestNumber | int | N |  |  |
| 4 | StuffRequestDate | date | N |  |  |
| 5 | StuffRequestState | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | FinancialPeriodID | int | N |  |  |
| 12 | OrganizationUnitID | int | Y |  |  |
| 13 | BaseDocument | int | N |  |  |
| 14 | FromStockID | int | Y |  |  |
| 15 | Type | tinyint | N | ((1)) |  |
| 16 | ToStockID | int | Y |  |  |
| 17 | UtilizationPlace | tinyint | N | ((1)) |  |
| 18 | Reviewer | int | Y |  |  |
| 19 | ReviewDate | datetime | Y |  |  |

- **Primary key:** StuffRequestID
- **FK** `FK_StuffRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_StuffRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_StuffRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_StuffRequest_Stock_FromStock` (FromStockID) -> STF.Stock (StockID)
- **FK** `FK_StuffRequest_Stock_ToStock` (ToStockID) -> STF.Stock (StockID)
- **FK** `FK_StuffRequest_Reviewer` (Reviewer) -> CFG.User (UserID)
- **Referenced by:** REQ.StuffRequestItem (StuffRequestID)

### REQ.StuffRequestItem

Rows: 1 | آیتم درخواست کالا

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffRequestItemID | int | N |  | identity |
| 2 | StuffRequestID | int | N |  |  |
| 3 | StuffRequestItemIndex | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | Description | nvarchar(256) | Y |  |  |
| 8 | Description2 | nvarchar(256) | Y |  |  |
| 9 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |  |  |
| 16 | RequiredMaterialID | int | Y |  |  |
| 17 | RequiredProductID | int | Y |  |  |
| 18 | CostCenterID | int | Y |  |  |
| 19 | RequiredMaterialCostCenterID | int | Y |  |  |
| 20 | BaseStuffRequestItemID | int | Y |  |  |
| 21 | ProjectID | int | Y |  |  |

- **Primary key:** StuffRequestItemID
- **FK** `FK_StuffRequestItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffRequestItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffRequestItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_StuffRequestItem_StuffRequest` (StuffRequestID) -> REQ.StuffRequest (StuffRequestID) on delete CASCADE
- **FK** `FK_StuffRequestItem_RequiredMaterial` (RequiredMaterialID) -> PRM.RequiredMaterial (RequiredMaterialID)
- **FK** `FK_StuffRequestItem_StuffRequestItem` (BaseStuffRequestItemID) -> REQ.StuffRequestItem (StuffRequestItemID)
- **FK** `FK_StuffRequestItem_Project` (ProjectID) -> PMO.Project (ProjectID)
- **Referenced by:** REQ.PurchaseRequestItem (StuffRequestItemID); REQ.StuffRequestItem (BaseStuffRequestItemID); REQ.StuffRequestItemTrace (StuffRequestItemID); STC.OutgoingItem (StuffRequestItemID); VND.PurchaseContractItem (StuffRequestItemID)

### REQ.StuffRequestItemTrace

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StuffRequestItemTraceID | int | N |  | identity |
| 2 | StuffRequestItemID | int | N |  |  |
| 3 | TraceID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | TraceItemID | int | Y |  |  |

- **Primary key:** StuffRequestItemTraceID
- **unique index** `IX_StuffRequestItemTrace` (StuffRequestItemID, TraceID)
- **FK** `FK_StuffRequestItemTrace_TraceItem` (TraceItemID) -> STF.TraceItem (TraceItemID)
- **FK** `FK_StuffRequestItemTrace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StuffRequestItemTrace_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_StuffRequestItemTrace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StuffRequestItemTrace_StuffRequestItem` (StuffRequestItemID) -> REQ.StuffRequestItem (StuffRequestItemID) on delete CASCADE
- **FK** `FK_StuffRequestItemTrace_Trace` (TraceID) -> STF.Trace (TraceID)

### REQ.TenderRequest

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderRequestID | int | N |  | identity |
| 2 | OrganizationUnitID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | State | tinyint | N |  |  |
| 7 | FinalEstimate | decimal(36,10) | Y |  |  |
| 8 | NeedDocumentVerification | bit | Y |  |  |
| 9 | DocumentVerificationPathID | int | Y |  |  |
| 10 | FinancialPeriodID | int | N |  |  |
| 11 | ReviewerID | int | Y |  |  |
| 12 | ReviewDate | datetime | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |
| 18 | BaseDocument | int | N | ((1)) |  |

- **Primary key:** TenderRequestID
- **FK** `FK_TenderRequest_OrganizationUnit` (OrganizationUnitID) -> CFG.OrganizationUnit (OrganizationUnitID)
- **FK** `FK_TenderRequest_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_TenderRequest_DocumentVerificationPath` (DocumentVerificationPathID) -> VND.DocumentVerificationPath (DocumentVerificationPathID)
- **FK** `FK_TenderRequest_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_TenderRequest_Reviewer` (ReviewerID) -> CFG.User (UserID)
- **FK** `FK_TenderRequest_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderRequest_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** REQ.TenderRequestItem (TenderRequestID)

### REQ.TenderRequestItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderRequestItemID | int | N |  | identity |
| 2 | TenderRequestID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PurchaseRequestItemID | int | Y |  |  |
| 5 | StuffGroupID | int | Y |  |  |
| 6 | StuffID | int | Y |  |  |
| 7 | Quantity | decimal(36,10) | N |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | EstimatedCost | decimal(36,10) | Y |  |  |
| 11 | TimeRequired | int | Y |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |

- **Primary key:** TenderRequestItemID
- **FK** `FK_TenderRequestItemID_TenderRequest` (TenderRequestID) -> REQ.TenderRequest (TenderRequestID) on delete CASCADE
- **FK** `FK_TenderRequestItemID_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_TenderRequestItemID_StuffGroup` (StuffGroupID) -> STF.StuffGroup (StuffGroupID)
- **FK** `FK_TenderRequestItemID_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_TenderRequestItemID_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderRequestItemID_LastEditor` (LastEditor) -> CFG.User (UserID)

## Views

### REQ.PurchaseRequest_JustificationInput

Definition: `programmability/views/REQ.PurchaseRequest_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | JustificationInputItemID | int | N |

### REQ.PurchaseRequest_Non_Proposal

Definition: `programmability/views/REQ.PurchaseRequest_Non_Proposal.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | N |
| 5 | DoSubQuantity | decimal(38,4) | N |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### REQ.PurchaseRequest_Non_StockReceipt

Definition: `programmability/views/REQ.PurchaseRequest_Non_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | MainQuantity | decimal(38,4) | Y |
| 2 | SubQuantity | decimal(38,4) | Y |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | SubNon | decimal(38,4) | Y |

### REQ.PurchaseRequest_Non_TemporaryStockReceipt

Definition: `programmability/views/REQ.PurchaseRequest_Non_TemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### REQ.PurchaseRequest_Proposal

Definition: `programmability/views/REQ.PurchaseRequest_Proposal.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | ProposalItemID | int | N |

### REQ.PurchaseRequest_PurchaseContract

Definition: `programmability/views/REQ.PurchaseRequest_PurchaseContract.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | PurchaseContractItemID | int | N |

### REQ.PurchaseRequest_PurchaseInvoice

Definition: `programmability/views/REQ.PurchaseRequest_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | N |

### REQ.PurchaseRequest_Remains

Definition: `programmability/views/REQ.PurchaseRequest_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | N |
| 2 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |
| 3 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | N |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | NonSub | decimal(38,4) | Y |

### REQ.PurchaseRequest_ReturnedTemporaryStockReceipt

Definition: `programmability/views/REQ.PurchaseRequest_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |

### REQ.PurchaseRequest_ReturnRequest

Definition: `programmability/views/REQ.PurchaseRequest_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | ReturnRequestItemID | int | N |

### REQ.PurchaseRequest_StockReceipt

Definition: `programmability/views/REQ.PurchaseRequest_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | StockReceiptItemID | int | N |
| 3 | StockReceiptMainQuantity | decimal(36,10) | Y |

### REQ.PurchaseRequest_TemporaryStockReceipt

Definition: `programmability/views/REQ.PurchaseRequest_TemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestItemID | int | Y |
| 2 | TemporaryStockReceiptItemID | int | N |

### REQ.ReturnRequest_Remains

Definition: `programmability/views/REQ.ReturnRequest_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnRequestItemID | int | N |
| 2 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |
| 3 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | NonSub | decimal(38,4) | Y |

### REQ.ReturnRequest_Return_Remain

Definition: `programmability/views/REQ.ReturnRequest_Return_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnRequestItemID | int | N |
| 2 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |
| 3 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | NonSub | decimal(38,4) | Y |

### REQ.ReturnRequest_ReturnedTemporaryStockReceipt

Definition: `programmability/views/REQ.ReturnRequest_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnRequestItemID | int | Y |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |

### REQ.StuffRequest_JustificationInput

Definition: `programmability/views/REQ.StuffRequest_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | JustificationInputItemID | int | N |

### REQ.StuffRequest_Outgoing

Definition: `programmability/views/REQ.StuffRequest_Outgoing.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | OutgoingItemID | int | N |

### REQ.StuffRequest_Proposal

Definition: `programmability/views/REQ.StuffRequest_Proposal.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | ProposalItemID | int | N |

### REQ.StuffRequest_PurchaseContract

Definition: `programmability/views/REQ.StuffRequest_PurchaseContract.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | PurchaseContractItemID | int | N |

### REQ.StuffRequest_PurchaseInvoice

Definition: `programmability/views/REQ.StuffRequest_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | N |

### REQ.StuffRequest_PurchaseRequest

Definition: `programmability/views/REQ.StuffRequest_PurchaseRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | PurchaseRequestItemID | int | N |

### REQ.StuffRequest_Remains

Definition: `programmability/views/REQ.StuffRequest_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | N |
| 2 | StuffID | int | N |
| 3 | BranchID | int | N |
| 4 | StuffRequestState | tinyint | N |
| 5 | AcceptRequestMainMeasureQuantity | decimal(30,4) | N |
| 6 | AcceptRequestSubMeasureQuantity | decimal(30,4) | Y |
| 7 | StuffRequestDate | date | N |
| 8 | StuffRequestNumber | int | N |
| 9 | StuffRequestID | int | N |
| 10 | DoMainQuantity | decimal(38,4) | Y |
| 11 | DoSubQuantity | decimal(38,4) | Y |
| 12 | DoOutGoing | decimal(38,10) | N |
| 13 | DoSubOutGoing | decimal(38,10) | N |
| 14 | Non | decimal(38,4) | Y |
| 15 | NonSub | decimal(38,4) | Y |
| 16 | NonOutgoing | decimal(38,10) | Y |
| 17 | NonSubOutgoing | decimal(38,10) | Y |

### REQ.StuffRequest_ReturnedTemporaryStockReceipt

Definition: `programmability/views/REQ.StuffRequest_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |

### REQ.StuffRequest_ReturnRequest

Definition: `programmability/views/REQ.StuffRequest_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | ReturnRequestItemID | int | N |

### REQ.StuffRequest_StockReceipt

Definition: `programmability/views/REQ.StuffRequest_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | StockReceiptItemID | int | N |

### REQ.StuffRequest_TemporaryStockReceipt

Definition: `programmability/views/REQ.StuffRequest_TemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestItemID | int | Y |
| 2 | TemporaryStockReceiptItemID | int | N |

### REQ.vwPayemntRequest_NonPaymented

Definition: `programmability/views/REQ.vwPayemntRequest_NonPaymented.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PaymentRequestID | int | N |
| 2 | CurrencyID | int | N |
| 3 | Amount | decimal(38,10) | Y |
| 4 | done | decimal(38,10) | N |
| 5 | non | decimal(38,10) | Y |

### REQ.vwPurchaseRequestFlowDetection

Definition: `programmability/views/REQ.vwPurchaseRequestFlowDetection.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseRequestID | int | N |
| 2 | HeaderFlow | int | N |
| 3 | ItemFlow | int | N |

### REQ.vwReceiveRequestRemain

Definition: `programmability/views/REQ.vwReceiveRequestRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReceiveRequestID | int | N |
| 2 | remain | decimal(38,4) | Y |

### REQ.vwStuffRequestReviewDataSource

Definition: `programmability/views/REQ.vwStuffRequestReviewDataSource.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | StuffRequestID | int | N |
| 2 | OrganizationUnitID | int | Y |
| 3 | StuffRequestDate | date | N |
| 4 | BranchID | int | N |
| 5 | StuffRequestItemID | int | N |
| 6 | StuffID | int | N |
| 7 | PurchaseRequestQuantity | numeric(30,4) | N |
| 8 | PurchaseContractQuantity | numeric(31,5) | N |
| 9 | TemporaryStockReceiptQuantity | numeric(36,10) | Y |
| 10 | StockReceiptQuantity | numeric(36,10) | Y |
| 11 | OutgoingQuantity | decimal(36,10) | Y |
| 12 | Document | varchar(21) | N |
| 13 | DocumentID | int | N |
| 14 | DocumentNumber | int | N |
| 15 | DocumentDate | date | N |

