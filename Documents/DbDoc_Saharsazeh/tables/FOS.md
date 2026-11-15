# Schema `FOS`

## Tables

### FOS.BillOfLading

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BillOfLadingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | PurchaseInvoiceItemID | int | Y |  |  |
| 8 | BillNumber | varchar(250) | N |  |  |
| 9 | ShareDividingBase | tinyint | Y |  |  |
| 10 | IssueDate | date | N |  |  |
| 11 | StartDateOfLading | date | N |  |  |
| 12 | LadingTypeID | int | N |  |  |
| 13 | PreVoucherID | int | Y |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | Version | int | N |  |  |
| 19 | PurchaseInvoiceItemNon | decimal(36,10) | Y |  |  |

- **Primary key:** BillOfLadingID
- **FK** `FK_BillOfLading_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_BillOfLading_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BillOfLading_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_BillOfLading_LadingType` (LadingTypeID) -> FOS.LadingType (LadingTypeID)
- **FK** `FK_BillOfLading_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BillOfLading_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_BillOfLading_Prevoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_BillOfLading_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **Referenced by:** FOS.BillOfLadingItem (BillOfLadingID); FOS.CostOfOrder (BillOfLadingID); FOS.OrderPricingCost (BillOfLadingID)

### FOS.BillOfLadingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BillOfLadingItemID | int | N |  | identity |
| 2 | BillOfLadingID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | MainQuantity | decimal(30,4) | N |  |  |
| 5 | SubQuantity | decimal(30,4) | Y |  |  |
| 6 | SharingAmount | decimal(36,10) | N | ((0)) |  |
| 7 | Description | nvarchar(256) | Y |  |  |
| 8 | Description2 | nvarchar(256) | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | PurchaseInvoiceItemID | int | N |  |  |

- **Primary key:** BillOfLadingItemID
- **FK** `FK_BillOfLadingItem_BillOfLading` (BillOfLadingID) -> FOS.BillOfLading (BillOfLadingID) on delete CASCADE
- **FK** `FK_BillOfLadingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BillOfLadingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BillOfLadingItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **Referenced by:** FOS.ClearanceItem (BillOfLadingItemID)

### FOS.Clearance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ClearanceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Description | nvarchar(256) | Y |  |  |
| 7 | Description2 | nvarchar(256) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | PartyID | bigint | N |  |  |
| 14 | CotajNumber | varchar(250) | N |  |  |
| 15 | CotajDate | date | N |  |  |
| 16 | EntranceCustomsID | int | N |  |  |
| 17 | AssessmentCustomsID | int | N |  |  |
| 18 | PreVoucherID | int | Y |  |  |

- **Primary key:** ClearanceID
- **FK** `FK_Clearance_AssessmentCustoms` (AssessmentCustomsID) -> CFG.Customs (CustomsID)
- **FK** `FK_Clearance_EntranceCustoms` (EntranceCustomsID) -> CFG.Customs (CustomsID)
- **FK** `FK_Clearance_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Clearance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Clearance_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Clearance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Clearance_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Clearance_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FOS.ClearanceCustomsCost (ClearanceID); FOS.ClearanceItem (ClearanceID); FOS.CostOfOrder (ClearanceID); FOS.OrderPricing (ClearanceID)

### FOS.ClearanceCustomsCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ClearanceCustomsCostID | int | N |  | identity |
| 2 | ClearanceID | int | N |  |  |
| 3 | ClearanceItemID | int | N |  |  |
| 4 | SpecialCostID | int | N |  |  |
| 5 | Amount | decimal(30,4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ClearanceCustomsCostID
- **FK** `FK_ClearanceCustomsCost_Clearance` (ClearanceID) -> FOS.Clearance (ClearanceID) on delete CASCADE
- **FK** `FK_ClearanceCustomsCost_ClearanceItem` (ClearanceItemID) -> FOS.ClearanceItem (ClearanceItemID)
- **FK** `FK_ClearanceCustomsCost_SpecialCost` (SpecialCostID) -> FOS.SpecialCost (SpecialCostID)
- **FK** `FK_ClearanceCustomsCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ClearanceCustomsCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FOS.OrderPricingCost (ClearanceCustomsCostID)

### FOS.ClearanceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ClearanceItemID | int | N |  | identity |
| 2 | ClearanceID | int | N |  |  |
| 3 | Description | nvarchar(256) | Y |  |  |
| 4 | Description2 | nvarchar(256) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | RowIndex | smallint | N |  |  |
| 11 | CurrencyRate | decimal(20,10) | N |  |  |
| 12 | Amount | decimal(30,4) | N |  |  |
| 13 | BillOfLadingItemID | int | N |  |  |

- **Primary key:** ClearanceItemID
- **FK** `FK_ClearanceItem_Clearance` (ClearanceID) -> FOS.Clearance (ClearanceID) on delete CASCADE
- **FK** `FK_ClearanceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ClearanceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ClearanceItem_BillOfLadingItem` (BillOfLadingItemID) -> FOS.BillOfLadingItem (BillOfLadingItemID)
- **Referenced by:** FOS.ClearanceCustomsCost (ClearanceItemID); FOS.OrderPricingItem (ClearanceItemID); STC.StockReceiptItem (ClearanceItemID)

### FOS.CostOfOrder

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostOfOrderID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | ProformaInvoiceID | int | Y |  |  |
| 7 | BillOfLadingID | int | Y |  |  |
| 8 | PreVoucherID | int | Y |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | BaseType | tinyint | N |  |  |
| 15 | RegistrationID | int | Y |  |  |
| 16 | ClearanceID | int | Y |  |  |

- **Primary key:** CostOfOrderID
- **FK** `FK_CostOfOrder_BillOfLading` (BillOfLadingID) -> FOS.BillOfLading (BillOfLadingID)
- **FK** `FK_CostOfOrder_Clearance` (ClearanceID) -> FOS.Clearance (ClearanceID)
- **FK** `FK_CostOfOrder_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_CostOfOrder_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostOfOrder_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_CostOfOrder_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostOfOrder_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_CostOfOrder_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **FK** `FK_CostOfOrder_Registration` (RegistrationID) -> FOS.Registration (RegistrationID)
- **Referenced by:** FOS.CostOfOrderItem (CostOfOrderID)

### FOS.CostOfOrderItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostOfOrderItemID | int | N |  | identity |
| 2 | CostOfOrderID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | SpecialCostID | int | N |  |  |
| 5 | PurchaseInvoiceItemID | int | Y |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | PartyID | bigint | Y |  |  |
| 8 | Description | nvarchar(256) | Y |  |  |
| 9 | Description2 | nvarchar(256) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | CurrencyID | int | N | ((-1)) |  |
| 16 | CurrencyRate | decimal(20,10) | N | ((1)) |  |

- **Primary key:** CostOfOrderItemID
- **FK** `FK_CostOfOrderItem_CostOfOrder` (CostOfOrderID) -> FOS.CostOfOrder (CostOfOrderID) on delete CASCADE
- **FK** `FK_CostOfOrderItem_SpecialCost` (SpecialCostID) -> FOS.SpecialCost (SpecialCostID)
- **FK** `FK_CostOfOrderItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_CostOfOrderItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostOfOrderItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostOfOrderItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **FK** `FK_CostOfOrderItem_CurrencyID` (CurrencyID) -> CFG.Currency (CurrencyID)
- **Referenced by:** FOS.OrderPricingCost (CostOfOrderItemID)

### FOS.CreditAllocation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CreditAllocationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | LetterCreditID | int | N |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | CurrencyRate | decimal(20,10) | N |  |  |
| 8 | Description | nvarchar(256) | Y |  |  |
| 9 | Description2 | nvarchar(256) | Y |  |  |
| 10 | PreVoucherID | int | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |

- **Primary key:** CreditAllocationID
- **FK** `FK_CreditAllocation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_CreditAllocation_LetterCredit` (LetterCreditID) -> FOS.LetterCredit (LetterCreditID)
- **FK** `FK_CreditAllocation_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_CreditAllocation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CreditAllocation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FOS.CreditAllocationItem (CreditAllocationID)

### FOS.CreditAllocationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CreditAllocationItemID | int | N |  | identity |
| 2 | CreditAllocationID | int | N |  |  |
| 3 | PurchaseInvoiceID | int | Y |  |  |
| 4 | ConfirmStatementID | int | Y |  |  |
| 5 | ConfirmStatementItemID | int | Y |  |  |
| 6 | ContractStatementID | int | Y |  |  |
| 7 | Amount | decimal(30,4) | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | ConfirmPurchaseInvoiceID | int | Y |  |  |
| 15 | ConfirmPurchaseInvoiceItemID | int | Y |  |  |

- **Primary key:** CreditAllocationItemID
- **FK** `FK_CreditAllocationItem_ConfirmPurchaseInvoiceItem` (ConfirmPurchaseInvoiceItemID) -> VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceItemID)
- **FK** `FK_CreditAllocationItem_CreditAllocation` (CreditAllocationID) -> FOS.CreditAllocation (CreditAllocationID) on delete CASCADE
- **FK** `FK_CreditAllocationItem_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_CreditAllocationItem_ConfirmStatement` (ConfirmStatementID) -> CNT.ConfirmStatement (ConfirmStatementID)
- **FK** `FK_CreditAllocationItem_ConfirmStatementItem` (ConfirmStatementItemID) -> CNT.ConfirmStatementItem (ConfirmStatementItemID)
- **FK** `FK_CreditAllocationItem_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID)
- **FK** `FK_CreditAllocationItem_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID)
- **FK** `FK_CreditAllocationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CreditAllocationItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### FOS.LadingType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LadingTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** LadingTypeID
- **FK** `FK_LadingType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LadingType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LadingType_Sl` (SlID) -> ACC.SL (SlID)
- **Referenced by:** FOS.BillOfLading (LadingTypeID)

### FOS.LetterCredit

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LetterCreditID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | ProformaInvoiceID | int | N |  |  |
| 7 | LetterCreditTypeID | int | N |  |  |
| 8 | OpeningCreditBank | bigint | N |  |  |
| 9 | LetterCreditNumber | nvarchar(100) | N |  |  |
| 10 | OpeningCreditDate | date | N |  |  |
| 11 | DueDate | date | Y |  |  |
| 12 | UsanceDuration | int | N |  |  |
| 13 | ProfitAmount | decimal(30,4) | N |  |  |
| 14 | Description | nvarchar(1024) | Y |  |  |
| 15 | Description2 | nvarchar(1024) | Y |  |  |
| 16 | PreVoucherID | int | Y |  |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | Version | int | N |  |  |
| 22 | CreditAmount | decimal(30,4) | Y |  |  |
| 23 | DLID | bigint | N |  |  |

- **Primary key:** LetterCreditID
- **FK** `FK_LetterCredit_DL` (DLID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_LetterCredit_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_LetterCredit_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_LetterCredit_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_LetterCredit_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LetterCredit_LetterCreditType` (LetterCreditTypeID) -> FOS.LetterCreditType (LetterCreditTypeID)
- **FK** `FK_LetterCredit_OpeningCreditBank` (OpeningCreditBank) -> CFG.Party (PartyID)
- **FK** `FK_LetterCredit_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_LetterCredit_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **Referenced by:** FOS.CreditAllocation (LetterCreditID); FOS.LetterCreditBankCost (LetterCreditID); FOS.LetterCreditGuarantee (LetterCreditID); FOS.OrderPricingCost (LetterCreditID)

### FOS.LetterCreditBankCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LetterCreditBankCostID | int | N |  | identity |
| 2 | LetterCreditID | int | N |  |  |
| 3 | StuffID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | CostSlID | int | N |  |  |
| 6 | Description | nvarchar(2048) | Y |  |  |
| 7 | Description2 | nvarchar(2048) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** LetterCreditBankCostID
- **FK** `FK_LetterCreditBankCost_CostSl` (CostSlID) -> ACC.SL (SlID)
- **FK** `FK_LetterCreditBankCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LetterCreditBankCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LetterCreditBankCost_LetterCredit` (LetterCreditID) -> FOS.LetterCredit (LetterCreditID) on delete CASCADE
- **FK** `FK_LetterCreditBankCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** FOS.OrderPricingCost (LetterCreditBankCostID)

### FOS.LetterCreditGuarantee

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LetterCreditGuaranteeID | int | N |  | identity |
| 2 | LetterCreditID | int | N |  |  |
| 3 | PaymentCheqeCommitmentID | int | Y |  |  |
| 4 | PaymentPromissoryCommitmentID | int | Y |  |  |
| 5 | PaymentGuarantyCommitmentID | int | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | RowIndex | smallint | N |  |  |

- **Primary key:** LetterCreditGuaranteeID
- **FK** `FK_LetterCreditGuarantee_LetterCredit` (LetterCreditID) -> FOS.LetterCredit (LetterCreditID) on delete CASCADE
- **FK** `FK_LetterCreditGuarantee_PaymentCheqeCommitment` (PaymentCheqeCommitmentID) -> FIN.PaymentCheqeCommitment (PaymentCheqeCommitmentID)
- **FK** `FK_LetterCreditGuarantee_PaymentPromissoryCommitment` (PaymentPromissoryCommitmentID) -> FIN.PaymentPromissoryCommitment (PaymentPromissoryCommitmentID)
- **FK** `FK_LetterCreditGuarantee_PaymentGuarantyCommitment` (PaymentGuarantyCommitmentID) -> FIN.PaymentGuarantyCommitment (PaymentGuarantyCommitmentID)
- **FK** `FK_LetterCreditGuarantee_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LetterCreditGuarantee_LastEditor` (LastEditor) -> CFG.User (UserID)

### FOS.LetterCreditType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LetterCreditTypeID | int | N |  | identity |
| 2 | Code | nvarchar(250) | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Term | bit | N |  |  |
| 6 | ProfitSl | int | Y |  |  |
| 7 | PaymentableProfitSl | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | FacilitySl | int | Y |  |  |

- **Primary key:** LetterCreditTypeID
- **FK** `FK_LetterCreditType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_LetterCreditType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LetterCreditType_PaymentableProfitSl` (PaymentableProfitSl) -> ACC.SL (SlID)
- **FK** `FK_LetterCreditType_ProfitSl` (ProfitSl) -> ACC.SL (SlID)
- **FK** `FK_LetterCreditType_FacilitySl` (FacilitySl) -> ACC.SL (SlID)
- **Referenced by:** FOS.LetterCredit (LetterCreditTypeID)

### FOS.OrderPricing

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderPricingID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | BranchID | int | N |  |  |
| 6 | ClearanceID | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | PreVoucherID | int | Y |  |  |

- **Primary key:** OrderPricingID
- **FK** `FK_OrderPricing_Clearance` (ClearanceID) -> FOS.Clearance (ClearanceID)
- **FK** `FK_OrderPricing_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_OrderPricing_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderPricing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_OrderPricing_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderPricing_Prevoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FOS.OrderPricingCost (OrderPricingID); FOS.OrderPricingItem (OrderPricingID)

### FOS.OrderPricingCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderPricingCostID | int | N |  | identity |
| 2 | OrderPricingID | int | N |  |  |
| 3 | SpecialCostID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | ShareDividingBase | tinyint | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | BillOfLadingID | int | Y |  |  |
| 12 | LetterCreditID | int | Y |  |  |
| 13 | ShippingInsuranceID | int | Y |  |  |
| 14 | RegistrationID | int | Y |  |  |
| 15 | Description | nvarchar(1024) | Y |  |  |
| 16 | Description2 | nvarchar(1024) | Y |  |  |
| 17 | ClearanceCustomsCostID | int | Y |  |  |
| 18 | CostOfOrderItemID | int | Y |  |  |
| 19 | LetterCreditBankCostID | int | Y |  |  |

- **Primary key:** OrderPricingCostID
- **FK** `FK_OrderPricingCost_LetterCreditBankCost` (LetterCreditBankCostID) -> FOS.LetterCreditBankCost (LetterCreditBankCostID)
- **FK** `FK_OrderPricingCost_BillOfLading` (BillOfLadingID) -> FOS.BillOfLading (BillOfLadingID)
- **FK** `FK_OrderPricingCost_ClearanceCustomsCost` (ClearanceCustomsCostID) -> FOS.ClearanceCustomsCost (ClearanceCustomsCostID)
- **FK** `FK_OrderPricingCost_CostOfOrderItem` (CostOfOrderItemID) -> FOS.CostOfOrderItem (CostOfOrderItemID)
- **FK** `FK_OrderPricingCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderPricingCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderPricingCost_LetterCredit` (LetterCreditID) -> FOS.LetterCredit (LetterCreditID)
- **FK** `FK_OrderPricingCost_OrderPricing` (OrderPricingID) -> FOS.OrderPricing (OrderPricingID) on delete CASCADE
- **FK** `FK_OrderPricingCost_Registration` (RegistrationID) -> FOS.Registration (RegistrationID)
- **FK** `FK_OrderPricingCost_ShippingInsurance` (ShippingInsuranceID) -> FOS.ShippingInsurance (ShippingInsuranceID)
- **FK** `FK_OrderPricingCost_SpecialCost` (SpecialCostID) -> FOS.SpecialCost (SpecialCostID)
- **Referenced by:** FOS.OrderPricingItem (OrderPricingCostID)

### FOS.OrderPricingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrderPricingItemID | int | N |  | identity |
| 2 | OrderPricingID | int | N |  |  |
| 3 | ClearanceItemID | int | N |  |  |
| 4 | OrderPricingCostID | int | Y |  |  |
| 5 | Share | decimal(30,4) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | PurchaseInvoiceItemID | int | Y |  |  |

- **Primary key:** OrderPricingItemID
- **FK** `FK_OrderPricingItem_ClearanceItem` (ClearanceItemID) -> FOS.ClearanceItem (ClearanceItemID)
- **FK** `FK_OrderPricingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrderPricingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_OrderPricingItem_OrderPricing` (OrderPricingID) -> FOS.OrderPricing (OrderPricingID) on delete CASCADE
- **FK** `FK_OrderPricingItem_OrderPricingCost` (OrderPricingCostID) -> FOS.OrderPricingCost (OrderPricingCostID)

### FOS.ProformaInvoice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProformaInvoiceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Base | tinyint | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | Vendor | bigint | N |  |  |
| 8 | CurrencyID | int | N |  |  |
| 9 | DLID | bigint | N |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | ParentID | int | Y |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |
| 17 | CreditDate | date | Y |  |  |

- **Primary key:** ProformaInvoiceID
- **FK** `FK_ProformaInvoice_DL` (DLID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_ProformaInvoice_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ProformaInvoice_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProformaInvoice_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ProformaInvoice_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProformaInvoice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProformaInvoice_ProformaInvoice` (ParentID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **FK** `FK_ProformaInvoice_Vendor` (Vendor) -> CFG.Party (PartyID)
- **Referenced by:** CFG.DebitCreditNoteItem (ProformaInvoiceID); FIN.PaymentSubject (ProformaInvoiceID); FOS.CostOfOrder (ProformaInvoiceID); FOS.LetterCredit (ProformaInvoiceID); FOS.ProformaInvoice (ParentID); FOS.ProformaInvoiceItem (ProformaInvoiceID); FOS.Registration (ProformaInvoiceID); FOS.ShippingInsurance (ProformaInvoiceID)

### FOS.ProformaInvoiceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProformaInvoiceItemID | int | N |  | identity |
| 2 | ProformaInvoiceID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PurchaseRequestItemID | int | Y |  |  |
| 5 | ProposalItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(30,4) | N |  |  |
| 8 | SubQuantity | decimal(30,4) | Y |  |  |
| 9 | Fee | decimal(36,10) | Y |  |  |
| 10 | Price | decimal(30,4) | N |  |  |
| 11 | Description | nvarchar(256) | Y |  |  |
| 12 | Description2 | nvarchar(256) | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |
| 18 | PurchaseContractItemID | int | Y |  |  |

- **Primary key:** ProformaInvoiceItemID
- **FK** `FK_ProformaInvoiceItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_ProformaInvoiceItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProformaInvoiceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProformaInvoiceItem_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID) on delete CASCADE
- **FK** `FK_ProformaInvoiceItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_ProformaInvoiceItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_ProformaInvoiceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** VND.PurchaseInvoiceItem (ProformaInvoiceItemID)

### FOS.Registration

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RegistrationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | ProformaInvoiceID | int | N |  |  |
| 7 | RegistrationNumber | nvarchar(100) | N |  |  |
| 8 | RegistrationDate | date | N |  |  |
| 9 | WageRate | decimal(18,4) | N |  |  |
| 10 | WageRateManner | tinyint | N |  |  |
| 11 | CurrencyRate | decimal(20,10) | N |  |  |
| 12 | WageAmount | decimal(30,4) | N |  |  |
| 13 | Description | nvarchar(2048) | Y |  |  |
| 14 | Description2 | nvarchar(2048) | Y |  |  |
| 15 | PreVoucherID | int | Y |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | Version | int | N |  |  |
| 21 | CreditDate | date | N | (getdate()) |  |
| 22 | PartyID | bigint | Y |  |  |

- **Primary key:** RegistrationID
- **FK** `FK_Registration_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Registration_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Registration_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Registration_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Registration_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Registration_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Registration_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **Referenced by:** FOS.CostOfOrder (RegistrationID); FOS.OrderPricingCost (RegistrationID)

### FOS.ShippingInsurance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ShippingInsuranceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | ProformaInvoiceID | int | N |  |  |
| 7 | PartyID | bigint | N |  |  |
| 8 | ShippingInsuranceNumber | nvarchar(100) | N |  |  |
| 9 | IssueDate | date | N |  |  |
| 10 | CreditDate | date | N |  |  |
| 11 | ShippingInsuranceTypeID | int | N |  |  |
| 12 | CurrencyID | int | N |  |  |
| 13 | Price | decimal(30,4) | N |  |  |
| 14 | PurchaseInvoiceItemID | int | N |  |  |
| 15 | Description | nvarchar(2048) | Y |  |  |
| 16 | Description2 | nvarchar(2048) | Y |  |  |
| 17 | PreVoucherID | int | Y |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | Version | int | N |  |  |

- **Primary key:** ShippingInsuranceID
- **FK** `FK_ShippingInsurance_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ShippingInsurance_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ShippingInsurance_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ShippingInsurance_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ShippingInsurance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ShippingInsurance_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ShippingInsurance_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ShippingInsurance_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **FK** `FK_ShippingInsurance_ShippingInsuranceType` (ShippingInsuranceTypeID) -> FOS.ShippingInsuranceType (ShippingInsuranceTypeID)
- **FK** `FK_ShippingInsurance_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **Referenced by:** FOS.OrderPricingCost (ShippingInsuranceID)

### FOS.ShippingInsuranceType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ShippingInsuranceTypeID | int | N |  | identity |
| 2 | Code | nvarchar(250) | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ShippingInsuranceTypeID
- **FK** `FK_ShippingInsuranceType_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_ShippingInsuranceType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ShippingInsuranceType_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** FOS.ShippingInsurance (ShippingInsuranceTypeID)

### FOS.SpecialCost

Rows: 4

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SpecialCostID | int | N |  | identity |
| 2 | Code | nvarchar(256) | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | SlID | int | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | ShareDividingBase | tinyint | N |  |  |
| 12 | CustomsCost | bit | N | ((0)) |  |
| 13 | ValueAddedTax | bit | N | ((0)) |  |
| 14 | ValueAddedDuty | bit | N | ((0)) |  |
| 15 | Active | bit | N | ((1)) |  |

- **Primary key:** SpecialCostID
- **unique index** `IX_SpecialCost_Code` (Code)
- **unique index** `IX_SpecialCost_Title` (Title)
- **unique index** `IX_SpecialCost_Title2` (Title2)
- **FK** `FK_SpecialCost_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_SpecialCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SpecialCost_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** FOS.ClearanceCustomsCost (SpecialCostID); FOS.CostOfOrderItem (SpecialCostID); FOS.OrderPricingCost (SpecialCostID)

## Views

### FOS.ProformaInvoice_Non_PurchaseInvoice

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProformaInvoiceItemID | int | N |
| 2 | ProformaInvoiceID | int | N |
| 3 | MainQuantity | decimal(30,4) | N |
| 4 | SubQuantity | decimal(30,4) | Y |
| 5 | DoMainQuantity | decimal(38,4) | Y |
| 6 | DoSubQuantity | decimal(38,4) | Y |
| 7 | Non | decimal(38,4) | Y |
| 8 | NonSub | decimal(38,4) | Y |

### FOS.ProformaInvoice_Remain

Definition: `programmability/views/FOS.ProformaInvoice_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProformaInvoiceID | int | N |
| 2 | Remain | decimal(36,10) | Y |

### FOS.vwClearance_Non_StockReceipt

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ClearanceItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | SubQuantity | decimal(30,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | N |
| 5 | DoSubQuantity | decimal(38,4) | N |
| 6 | Non | decimal(38,4) | Y |
| 7 | NonSub | decimal(38,4) | Y |

### FOS.vwLetterCreditRemain

| # | Column | Type | Null |
|---|---|---|---|
| 1 | LetterCreditID | int | N |
| 2 | Remain | decimal(38,4) | Y |

