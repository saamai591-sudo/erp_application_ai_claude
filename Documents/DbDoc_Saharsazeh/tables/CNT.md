# Schema `CNT`

## Tables

### CNT.ActivityAssign

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityAssignID | int | N |  | identity |
| 2 | ContractSubjectID | int | N |  |  |
| 3 | ProjectActivityID | int | N |  |  |
| 4 | Price | decimal(36,10) | N |  |  |
| 5 | ProgressRate | decimal(5,2) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ActivityAssignID
- **FK** `Fk_ProjectActivity` (ProjectActivityID) -> PMO.ProjectActivity (ProjectActivityID)
- **FK** `Fk_ContractSubject` (ContractSubjectID) -> CNT.ContractSubject (ContractSubjectID)
- **Referenced by:** CNT.ContractStatementAnalysisItem (ActivityAssignID)

### CNT.AdditionDeductionType

Rows: 8

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdditionDeductionTypeID | int | N |  | identity |
| 2 | IsActive | bit | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Criterion | tinyint | N |  |  |
| 5 | Title | nvarchar(500) | N |  |  |
| 6 | Title2 | nvarchar(500) | N |  |  |
| 7 | Payable | bit | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | CompanyRoll | tinyint | N |  |  |

- **Primary key:** AdditionDeductionTypeID
- **FK** `FK_AdditionDeductionType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AdditionDeductionType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CNT.AdditionDeductionTypeMethod (AdditionDeductionTypeID); CNT.ConfirmStatementItem (AdditionDeductionTypeID); CNT.ContractDeduction (AdditionDeductionTypeID); VND.ConfirmPurchaseInvoiceItem (AdditionDeductionTypeID)

### CNT.AdditionDeductionTypeFormulaParameter

Rows: 6

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdditionDeductionTypeFormulaParameterID | int | N |  | identity |
| 2 | AdditionDeductionTypeMethodFormulaID | int | N |  |  |
| 3 | AdditionDeductionTypeID | int | N |  |  |
| 4 | Type | int | Y |  |  |
| 5 | LastEditionDate | datetime | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |

- **Primary key:** AdditionDeductionTypeFormulaParameterID
- **FK** `FK_AdditionDeductionTypeFormulaParameter_AdditionDeductionTypeMethodFormula` (AdditionDeductionTypeMethodFormulaID) -> CNT.AdditionDeductionTypeMethodFormula (AdditionDeductionTypeMethodFormulaID) on delete CASCADE

### CNT.AdditionDeductionTypeMethod

Rows: 13

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdditionDeductionTypeMethodID | int | N |  | identity |
| 2 | AdditionDeductionTypeID | int | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | IsManual | bit | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | SlID | int | N |  |  |
| 12 | ExchangeGainLossSlID | int | Y |  |  |

- **Primary key:** AdditionDeductionTypeMethodID
- **FK** `FK_AdditionDeductionTypeMethod_AdditionDeductionType` (AdditionDeductionTypeID) -> CNT.AdditionDeductionType (AdditionDeductionTypeID) on delete CASCADE
- **FK** `FK_AdditionDeductionTypeMethod_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_AdditionDeductionTypeMethod_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AdditionDeductionTypeMethod_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_AdditionDeductionTypeMethod_ExchangeGainLossSl` (ExchangeGainLossSlID) -> ACC.SL (SlID)
- **Referenced by:** CNT.AdditionDeductionTypeMethodFormula (AdditionDeductionTypeMethodID); CNT.ConfirmStatementItem (AdditionDeductionTypeMethodID); CNT.ContractDeduction (AdditionDeductionTypeMethodID); VND.ConfirmPurchaseInvoiceItem (AdditionDeductionTypeMethodID)

### CNT.AdditionDeductionTypeMethodFormula

Rows: 6

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdditionDeductionTypeMethodFormulaID | int | N |  | identity |
| 2 | AdditionDeductionTypeMethodID | int | N |  |  |
| 3 | Title | nvarchar(512) | N |  |  |
| 4 | Expression | varchar(MAX) | N |  |  |
| 5 | Condition | varchar(MAX) | Y |  |  |
| 6 | SQLExpression | nvarchar(MAX) | Y |  |  |
| 7 | SQLCondition | nvarchar(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AdditionDeductionTypeMethodFormulaID
- **FK** `FK_AdditionDeductionTypeMethodFormula_AdditionDeductionTypeMethod` (AdditionDeductionTypeMethodID) -> CNT.AdditionDeductionTypeMethod (AdditionDeductionTypeMethodID) on delete CASCADE
- **FK** `FK_AdditionDeductionTypeMethodFormula_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_AdditionDeductionTypeMethodFormula_EditorUser` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CNT.AdditionDeductionTypeFormulaParameter (AdditionDeductionTypeMethodFormulaID)

### CNT.ConfirmStatement

Rows: 139

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmStatementID | int | N |  | identity |
| 2 | ContractID | int | Y |  |  |
| 3 | ContractStatementID | int | Y |  |  |
| 4 | Initial | bit | N |  |  |
| 5 | Amount | decimal(30,4) | N |  |  |
| 6 | PaidAmount | decimal(30,4) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | CurrencyRate | decimal(20,10) | N | ((1)) |  |
| 13 | PreVoucherID | int | Y |  |  |
| 14 | Number | int | N |  |  |
| 15 | Date | date | N |  |  |
| 16 | FinancialPeriodID | int | Y |  |  |
| 17 | ConfirmStatus | tinyint | Y |  |  |

- **Primary key:** ConfirmStatementID
- **FK** `FK_ConfirmStatement_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ConfirmStatement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmStatement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConfirmStatement_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ConfirmStatement_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ConfirmStatement_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID)
- **Referenced by:** CFG.DebitCreditNoteItem (ConfirmStatementID); CNT.ConfirmStatementItem (ConfirmStatementID); FIN.PaymentSubject (ConfirmStatementID); FIN.ReceiveSubject (ConfirmStatementID); FOS.CreditAllocationItem (ConfirmStatementID)

### CNT.ConfirmStatementItem

Rows: 364

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmStatementItemID | int | N |  | identity |
| 2 | ConfirmStatementID | int | Y |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | AdditionDeductionTypeID | int | N |  |  |
| 5 | Addition | decimal(30,4) | N |  |  |
| 6 | Deduction | decimal(30,4) | N |  |  |
| 7 | Paid | decimal(30,4) | N |  |  |
| 8 | Description | nvarchar(500) | Y |  |  |
| 9 | Description2 | nvarchar(500) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | AdditionDeductionTypeMethodID | int | Y |  |  |
| 16 | AllocationSharingAmount | decimal(30,4) | N | ((0)) |  |
| 17 | PurchaseInvoiceID | int | Y |  |  |
| 18 | BaseDocumentType | tinyint | Y |  |  |
| 19 | BaseDocumentID | int | Y |  |  |

- **Primary key:** ConfirmStatementItemID
- **FK** `FK_ConfirmStatementItem_AdditionDeductionTypeMethod` (AdditionDeductionTypeMethodID) -> CNT.AdditionDeductionTypeMethod (AdditionDeductionTypeMethodID)
- **FK** `FK_ConfirmStatementItem_AdditionDeductionType` (AdditionDeductionTypeID) -> CNT.AdditionDeductionType (AdditionDeductionTypeID)
- **FK** `FK_ConfirmStatementItem_ConfirmStatement` (ConfirmStatementID) -> CNT.ConfirmStatement (ConfirmStatementID) on delete CASCADE
- **FK** `FK_ConfirmStatementItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmStatementItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConfirmStatementItem_PurchaseInvoiceID` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID) on delete CASCADE
- **Referenced by:** CFG.DebitCreditNoteItem (ConfirmStatementItemID); CNT.ConfirmStatementPrePayment (ConfirmStatementItemID); FIN.PaymentSubject (ConfirmStatementItemID); FIN.ReceiveSubject (ConfirmStatementItemID); FOS.CreditAllocationItem (ConfirmStatementItemID)

### CNT.ConfirmStatementPrePayment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmStatementPrePaymentID | int | N |  | identity |
| 2 | ConfirmStatementItemID | int | N |  |  |
| 3 | PaymentSubjectID | int | Y |  |  |
| 4 | DebitCreditNoteItemID | int | Y |  |  |
| 5 | Price | decimal(30,4) | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | ReceiveSubjectID | int | Y |  |  |

- **Primary key:** ConfirmStatementPrePaymentID
- **FK** `FK_ConfirmStatementPrePayment_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)
- **FK** `FK_ConfirmStatementPrePayment_DebitCreditNoteItem` (DebitCreditNoteItemID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_ConfirmStatementPrePayment_ConfirmStatementItem` (ConfirmStatementItemID) -> CNT.ConfirmStatementItem (ConfirmStatementItemID) on delete CASCADE
- **FK** `FK_ConfirmStatementPrePayment_ReceiveSubject` (ReceiveSubjectID) -> FIN.ReceiveSubject (ReceiveSubjectID)

### CNT.Contract

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | CompanyRoll | tinyint | N |  |  |
| 5 | ContractTypeID | int | N |  |  |
| 6 | Number | nvarchar(250) | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | Title | nvarchar(500) | N |  |  |
| 9 | Title2 | nvarchar(500) | N |  |  |
| 10 | TenderID | int | Y |  |  |
| 11 | BranchID | int | N |  |  |
| 12 | PartyID | bigint | N |  |  |
| 13 | DLID | bigint | Y |  |  |
| 14 | Life | smallint | N |  |  |
| 15 | StartDate | date | Y |  |  |
| 16 | EndDate | date | Y |  |  |
| 17 | StatementDeliverySection | tinyint | N |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | Version | int | N |  |  |
| 23 | ContractNature | tinyint | N | ((1)) |  |
| 24 | Status | tinyint | N | ((2)) |  |
| 25 | ProjectId | bigint | Y |  |  |
| 26 | BaseType | tinyint | N | ((1)) |  |

- **Primary key:** ContractID
- **FK** `FK_Contract_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Contract_ContractType` (ContractTypeID) -> CNT.ContractType (ContractTypeID)
- **FK** `FK_Contract_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Contract_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_Contract_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Contract_Parent` (ParentID) -> CNT.Contract (ContractID)
- **FK** `FK_Contract_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Contract_Project` (ProjectId) -> ACC.DL (DLID) on delete CASCADE
- **Referenced by:** CFG.DebitCreditNoteItem (ContractID); CNT.ConfirmStatement (ContractID); CNT.Contract (ParentID); CNT.ContractContinuation (ContractID); CNT.ContractDeduction (ContractID); CNT.ContractParty (ContractID); CNT.ContractStatement (ContractID); CNT.ContractStatementAnalysis (ContractID); CNT.ContractSubject (ContractID); CNT.UnDepreciatedPayment (ContractID); FIN.PaymentCommitment (ContractID); FIN.PaymentSubject (ContractID); FIN.ReceiveCommitment (ContractID); FIN.ReceiveSubject (ContractID); NOC.CashAnalysing (ContractID); NOC.CurrencyExchange (ContractID)

### CNT.ContractContinuation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractContinuationID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Life | smallint | N |  |  |
| 5 | EndDate | date | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ContractContinuationID
- **FK** `FK_ContractContinuation_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ContractContinuation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractContinuation_LastEditor` (LastEditor) -> CFG.User (UserID)

### CNT.ContractDeduction

Rows: 15

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractDeductionID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | AdditionDeductionTypeID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | AdditionDeductionTypeMethodID | int | N |  |  |

- **Primary key:** ContractDeductionID
- **FK** `FK_ContractDeduction_AdditionDeductionTypeMethod` (AdditionDeductionTypeMethodID) -> CNT.AdditionDeductionTypeMethod (AdditionDeductionTypeMethodID)
- **FK** `FK_ContractDeduction_AdditionDeductionType` (AdditionDeductionTypeID) -> CNT.AdditionDeductionType (AdditionDeductionTypeID)
- **FK** `FK_ContractDeduction_Contract` (ContractID) -> CNT.Contract (ContractID) on delete CASCADE
- **FK** `FK_ContractDeduction_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractDeduction_LastEditor` (LastEditor) -> CFG.User (UserID)

### CNT.ContractParty

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractPartyID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | PartyID | bigint | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ContractPartyID
- **FK** `FK_ContractParty_Contract` (ContractID) -> CNT.Contract (ContractID) on delete CASCADE
- **FK** `FK_ContractParty_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractParty_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractParty_Party` (PartyID) -> CFG.Party (PartyID)

### CNT.ContractStatement

Rows: 140

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementID | int | N |  | identity |
| 2 | ContractStatementTypeID | int | N |  |  |
| 3 | ContractID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | FromDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | FinancialPeriodID | int | Y |  |  |
| 13 | CurrencyID | int | N |  |  |
| 14 | PartyID | bigint | N |  |  |
| 15 | Date | date | Y |  |  |
| 16 | BaseType | tinyint | N | ((1)) |  |
| 17 | ContractStatementAnalysisID | int | Y |  |  |

- **Primary key:** ContractStatementID
- **FK** `FK_ContractStatement_ContractStatementAnalysis` (ContractStatementAnalysisID) -> CNT.ContractStatementAnalysis (ContractStatementAnalysisID)
- **FK** `FK_ContractStatement_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ContractStatement_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ContractStatement_ContractStatementType` (ContractStatementTypeID) -> CNT.ContractStatementType (ContractStatementTypeID)
- **FK** `FK_ContractStatement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractStatement_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ContractStatement_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** CFG.DebitCreditNoteItem (ContractStatementID); CNT.ConfirmStatement (ContractStatementID); CNT.ContractStatementDetail (ContractStatementID); CNT.ContractStatementItem (ContractStatementID); FIN.PaymentSubject (ContractStatementID); FIN.ReceiveSubject (ContractStatementID); FOS.CreditAllocationItem (ContractStatementID)

### CNT.ContractStatementAnalysis

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementAnalysisID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | CurrencyID | int | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | FinancialPeriodID | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | FromDate | date | N |  |  |
| 9 | ToDate | date | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** ContractStatementAnalysisID
- **FK** `FK_ContractStatementAnalysis_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ContractStatementAnalysis_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ContractStatementAnalysis_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ContractStatementAnalysis_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ContractStatementAnalysis_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatementAnalysis_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CNT.ContractStatement (ContractStatementAnalysisID); CNT.ContractStatementAnalysisItem (ContractStatementAnalysisID)

### CNT.ContractStatementAnalysisItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementAnalysisItemID | int | N |  | identity |
| 2 | ContractStatementAnalysisID | int | N |  |  |
| 3 | ActivityAssignID | int | N |  |  |
| 4 | RowIndex | int | N |  |  |
| 5 | Description | nvarchar(500) | N |  |  |
| 6 | Description2 | nvarchar(500) | N |  |  |
| 7 | Price | decimal(36,10) | N |  |  |
| 8 | ProgressRate | decimal(5,2) | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** ContractStatementAnalysisItemID
- **FK** `FK_ContractStatementAnalysisItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatementAnalysisItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractStatementAnalysisItem_ActivityAssign` (ActivityAssignID) -> CNT.ActivityAssign (ActivityAssignID)
- **FK** `FK_ContractStatementAnalysisItem_ContractStatementAnalysis` (ContractStatementAnalysisID) -> CNT.ContractStatementAnalysis (ContractStatementAnalysisID) on delete CASCADE

### CNT.ContractStatementDetail

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementDetailID | int | N |  | identity |
| 2 | ContractStatementID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PartyID | bigint | Y |  |  |
| 5 | BaseDocumentType | tinyint | N |  |  |
| 6 | BaseDocumentID | int | N |  |  |
| 7 | Date | date | N |  |  |
| 8 | Amount | decimal(30,4) | N |  |  |
| 9 | Description | nvarchar(500) | N |  |  |
| 10 | Description2 | nvarchar(500) | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |

- **Primary key:** ContractStatementDetailID
- **FK** `FK_ContractStatementDetail_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID) on delete CASCADE
- **FK** `FK_ContractStatementDetail_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatementDetail_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractStatementDetail_Party` (PartyID) -> CFG.Party (PartyID)

### CNT.ContractStatementItem

Rows: 140

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementItemID | int | N |  | identity |
| 2 | ContractStatementID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Description | nvarchar(500) | N |  |  |
| 5 | Description2 | nvarchar(500) | N |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | BaseOfAdditionDeduction | bit | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | ContractSubjectID | int | N |  |  |
| 14 | Tax | decimal(30,4) | N | ((0)) |  |
| 15 | Duty | decimal(30,4) | N | ((0)) |  |

- **Primary key:** ContractStatementItemID
- **FK** `FK_ContractStatementItem_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID) on delete CASCADE
- **FK** `FK_ContractStatementItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatementItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractStatementItem_ContractSubject` (ContractSubjectID) -> CNT.ContractSubject (ContractSubjectID)

### CNT.ContractStatementType

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractStatementTypeID | int | N |  | identity |
| 2 | Title | nvarchar(500) | N |  |  |
| 3 | Title2 | nvarchar(500) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | SlID | int | Y |  |  |
| 10 | CompanyRoll | tinyint | N | ((1)) |  |
| 11 | DutySLID | int | N |  |  |
| 12 | TaxSLID | int | N |  |  |
| 13 | Type | int | N | ((1)) |  |
| 14 | AdjustmentSLID | int | Y |  |  |
| 15 | SuspensionSLID | int | Y |  |  |

- **Primary key:** ContractStatementTypeID
- **FK** `FK_ContractStatementType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractStatementType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractStatementType_AdjustmentSL` (AdjustmentSLID) -> ACC.SL (SlID)
- **FK** `FK_ContractStatementType_SuspensionSL` (SuspensionSLID) -> ACC.SL (SlID)
- **FK** `FK_ContractStatementType_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_ContractStatementType_DutySL` (DutySLID) -> ACC.SL (SlID)
- **FK** `FK_ContractStatementType_TaxSL` (TaxSLID) -> ACC.SL (SlID)
- **Referenced by:** CNT.ContractStatement (ContractStatementTypeID)

### CNT.ContractSubject

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractSubjectID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | ParentID | int | Y |  |  |
| 5 | Description | nvarchar(500) | Y |  |  |
| 6 | Description2 | nvarchar(500) | Y |  |  |
| 7 | Quantity | decimal(30,4) | N |  |  |
| 8 | Fee | decimal(30,4) | N |  |  |
| 9 | Price | decimal(30,4) | N |  |  |
| 10 | SlID | int | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | StuffID | int | Y |  |  |
| 17 | Type | tinyint | N | ((1)) |  |
| 18 | CurrencyID | int | N |  |  |
| 19 | UniqueTaxID | nvarchar(255) | Y |  |  |
| 20 | DlID | bigint | Y |  |  |

- **Primary key:** ContractSubjectID
- **FK** `FK_ContractSubject_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ContractSubject_Contract` (ContractID) -> CNT.Contract (ContractID) on delete CASCADE
- **FK** `FK_ContractSubject_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractSubject_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ContractSubject_Parent` (ParentID) -> CNT.ContractSubject (ContractSubjectID)
- **FK** `FK_ContractSubject_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_ContractSubject_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_contractsubject_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **Referenced by:** CNT.ActivityAssign (ContractSubjectID); CNT.ContractStatementItem (ContractSubjectID); CNT.ContractSubject (ParentID); SLE.InvoiceItem (ContractSubjectID); STC.StockReceiptItem (ContractSubjectID); STC.TemporaryStockReceiptItem (ContractSubjectID); VND.PurchaseInvoiceItem (ContractSubjectID)

### CNT.ContractType

Rows: 32

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContractTypeID | int | N |  | identity |
| 2 | Title | nvarchar(500) | N |  |  |
| 3 | Title2 | nvarchar(500) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | CompanyRoll | tinyint | N |  |  |

- **Primary key:** ContractTypeID
- **FK** `FK_ContractType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContractType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CNT.Contract (ContractTypeID)

### CNT.UnDepreciatedPayment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UnDepreciatedPaymentID | int | N |  | identity |
| 2 | ContractID | int | N |  |  |
| 3 | PrePayment | decimal(30,4) | N |  |  |
| 4 | OnAccount | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** UnDepreciatedPaymentID
- **FK** `FK_UnDepreciatedPayment_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_UnDepreciatedPayment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UnDepreciatedPayment_LastEditor` (LastEditor) -> CFG.User (UserID)

## Views

### CNT.vwConfirmStatement_CostType

Definition: `programmability/views/CNT.vwConfirmStatement_CostType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | ContractID | int | Y |
| 3 | ContractStatementID | int | Y |
| 4 | Amount | decimal(30,4) | N |
| 5 | PaidAmount | decimal(30,4) | N |
| 6 | CurrencyRate | decimal(20,10) | N |
| 7 | PreVoucherID | int | Y |
| 8 | Number | int | N |
| 9 | Date | date | N |
| 10 | FinancialPeriodID | int | Y |

### CNT.vwConfirmStatement_NonRequested

Definition: `programmability/views/CNT.vwConfirmStatement_NonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | Amount | decimal(30,4) | N |
| 3 | Net | decimal(38,4) | Y |
| 4 | Done | decimal(38,10) | N |
| 5 | Remain | decimal(38,4) | Y |

### CNT.vwConfirmStatement_RevenueType

Definition: `programmability/views/CNT.vwConfirmStatement_RevenueType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | ContractID | int | Y |
| 3 | ContractStatementID | int | Y |
| 4 | Amount | decimal(30,4) | N |
| 5 | PaidAmount | decimal(30,4) | N |
| 6 | CurrencyRate | decimal(20,10) | N |
| 7 | PreVoucherID | int | Y |
| 8 | Number | int | N |
| 9 | Date | date | N |
| 10 | FinancialPeriodID | int | Y |
| 11 | BranchID | int | N |

### CNT.vwConfirmStatementItemNonRequestedRemain

Definition: `programmability/views/CNT.vwConfirmStatementItemNonRequestedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | Y |
| 2 | ContractID | int | Y |
| 3 | ConfirmStatementItemID | int | N |
| 4 | AdditionDeductionTypeID | int | N |
| 5 | Net | decimal(32,4) | Y |
| 6 | Done | decimal(38,10) | N |
| 7 | Remain | decimal(38,10) | Y |

### CNT.vwConfirmStatementItemRemain

Definition: `programmability/views/CNT.vwConfirmStatementItemRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | Y |
| 2 | ContractID | int | Y |
| 3 | ConfirmStatementItemID | int | N |
| 4 | AdditionDeductionTypeID | int | N |
| 5 | Net | decimal(32,4) | Y |
| 6 | Done | decimal(38,4) | Y |
| 7 | Remain | decimal(38,4) | Y |
| 8 | DLID | bigint | Y |
| 9 | CurrencyID | int | Y |
| 10 | PurchaseInvoiceID | int | Y |

### CNT.vwConfirmStatementItemRemain_Dollar

Definition: `programmability/views/CNT.vwConfirmStatementItemRemain_Dollar.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmStatementID | int | N |
| 2 | ContractID | int | Y |
| 3 | ConfirmStatementItemID | int | N |
| 4 | AdditionDeductionTypeID | int | N |
| 5 | Net | decimal(38,6) | Y |
| 6 | Done | decimal(38,8) | Y |
| 7 | CurrencyID | int | N |
| 8 | Remain | decimal(38,6) | Y |

### CNT.vwConfirmStatementRemain

Definition: `programmability/views/CNT.vwConfirmStatementRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | Y |
| 2 | ConfirmStatementID | int | N |
| 3 | PreVoucherID | int | Y |
| 4 | ContractStatementNumber | int | N |
| 5 | ContractNumber | nvarchar(250) | N |
| 6 | ContractDate | date | N |
| 7 | dlid | bigint | Y |
| 8 | CurrencyID | int | N |
| 9 | PartyID | bigint | N |
| 10 | Amount | decimal(30,4) | N |
| 11 | Net | decimal(38,4) | Y |
| 12 | Done | decimal(38,4) | Y |
| 13 | Remain | decimal(38,4) | Y |

### CNT.VWContractCommitment

Definition: `programmability/views/CNT.VWContractCommitment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | Y |
| 2 | DocName | varchar(23) | Y |
| 3 | DocID | int | N |
| 4 | DocNumber | int | Y |
| 5 | Date | date | N |
| 6 | ItemType | nvarchar(15) | N |
| 7 | ItemNumber | nvarchar(100) | N |
| 8 | CurrencyID | int | N |
| 9 | Amount | decimal(38,4) | Y |
| 10 | CommitmentTypeID | int | N |

### CNT.VWContractCommitment_Dollar

Definition: `programmability/views/CNT.VWContractCommitment_Dollar.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | Y |
| 2 | DocName | varchar(23) | Y |
| 3 | DocID | int | N |
| 4 | DocNumber | int | Y |
| 5 | Date | date | N |
| 6 | ItemType | varchar(15) | N |
| 7 | ItemNumber | nvarchar(100) | N |
| 8 | CurrencyID | int | N |
| 9 | Amount | decimal(38,4) | Y |
| 10 | CommitmentTypeID | int | N |

### CNT.vwContractNonRequestedRemain

Definition: `programmability/views/CNT.vwContractNonRequestedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | Net | decimal(38,4) | Y |
| 3 | CurrencyID | int | N |
| 4 | Done | decimal(38,10) | N |
| 5 | Remain | decimal(38,4) | Y |

### CNT.vwContractRemain

Definition: `programmability/views/CNT.vwContractRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | CurrencyID | int | N |
| 3 | Net | decimal(38,4) | Y |
| 4 | Done | decimal(38,4) | Y |
| 5 | Remain | decimal(38,4) | Y |
| 6 | ContractNumber | nvarchar(250) | N |

### CNT.vwContractRemain_Dollar

Definition: `programmability/views/CNT.vwContractRemain_Dollar.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | Net | decimal(38,6) | Y |
| 3 | Done | decimal(38,4) | Y |
| 4 | Remain | decimal(38,4) | Y |

### CNT.VWContractStatement

Definition: `programmability/views/CNT.VWContractStatement.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | Amount | decimal(38,4) | Y |

### CNT.VwContractStatementItem

Definition: `programmability/views/CNT.VwContractStatementItem.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractStatementID | int | N |
| 2 | ContractStatementItemID | int | N |
| 3 | contractsubjectid | int | N |
| 4 | amount | decimal(31,4) | Y |
| 5 | BaseOfAdditionDeduction | bit | N |

### CNT.VwContractStatementItem_Remain

Definition: `programmability/views/CNT.VwContractStatementItem_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractStatementItemID | int | N |
| 2 | amount | decimal(31,4) | Y |
| 3 | Remain | decimal(32,4) | Y |

### CNT.vwContractStatementNonRequestedRemain

Definition: `programmability/views/CNT.vwContractStatementNonRequestedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | ContractStatementID | int | N |
| 3 | NetAmount | decimal(38,4) | Y |
| 4 | CurrenctNetVat | decimal(38,4) | Y |
| 5 | NetVat | decimal(38,6) | Y |
| 6 | Done | decimal(38,10) | N |
| 7 | CurrencyDone | decimal(38,6) | Y |
| 8 | VatRemain | decimal(38,6) | Y |

### CNT.vwContractStatementRemain

Definition: `programmability/views/CNT.vwContractStatementRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractID | int | N |
| 2 | ContractStatementID | int | N |
| 3 | NetAmount | decimal(38,4) | Y |
| 4 | Vat | decimal(38,4) | Y |
| 5 | Done | decimal(38,4) | N |
| 6 | VatRemain | decimal(38,4) | Y |
| 7 | PreVoucherID | int | Y |
| 8 | ContractStatementNumber | int | N |
| 9 | ContractNumber | nvarchar(250) | N |
| 10 | DLID | bigint | Y |
| 11 | CurrencyID | int | N |
| 12 | ContractDate | date | N |

### CNT.VWContractSubject

Definition: `programmability/views/CNT.VWContractSubject.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractSubjectID | int | Y |
| 2 | ContractID | int | Y |
| 3 | Price | decimal(30,4) | N |
| 4 | Title | nvarchar(500) | Y |
| 5 | Title2 | nvarchar(500) | Y |
| 6 | stuffid | int | Y |
| 7 | RowIndex | int | Y |
| 8 | Issupplementary | bit | Y |
| 9 | FirstPrice | decimal(30,4) | N |
| 10 | SlCode | varchar(200) | Y |
| 11 | SLTitle | nvarchar(256) | Y |
| 12 | SLTitle2 | nvarchar(256) | Y |
| 13 | Quantity | decimal(30,4) | N |
| 14 | Fee | decimal(30,4) | N |
| 15 | CurrencyID | int | N |
| 16 | SlID | int | Y |
| 17 | StuffTitle | nvarchar(MAX) | Y |
| 18 | StuffTitle2 | nvarchar(MAX) | Y |
| 19 | CurrencyTitle | nvarchar(256) | N |
| 20 | CurrencyTitle2 | nvarchar(256) | N |
| 21 | Type | tinyint | N |
| 22 | UniqueTaxID | nvarchar(255) | Y |
| 23 | ContractPartyID | bigint | N |
| 24 | PartyDlID | bigint | Y |
| 25 | DlID | bigint | Y |
| 26 | DlCode | varchar(100) | Y |
| 27 | DLTitle | nvarchar(256) | Y |
| 28 | DLTitle2 | nvarchar(256) | Y |
| 29 | Remain | decimal(38,4) | Y |

### CNT.VWContractSubject_Dollar

Definition: `programmability/views/CNT.VWContractSubject_Dollar.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractSubjectID | int | Y |
| 2 | ContractID | int | Y |
| 3 | Price | decimal(38,6) | Y |
| 4 | OrginalPrice | decimal(30,4) | N |
| 5 | Title | nvarchar(500) | Y |
| 6 | Title2 | nvarchar(500) | Y |
| 7 | stuffid | int | Y |
| 8 | RowIndex | int | Y |
| 9 | Issupplementary | int | N |
| 10 | FirstPrice | decimal(38,6) | Y |
| 11 | CurrencyID | int | N |

### CNT.vwContractSubject_Stuff_Non

Definition: `programmability/views/CNT.vwContractSubject_Stuff_Non.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ContractSubjectID | int | Y |
| 2 | StuffID | int | Y |
| 3 | ContractPartyID | bigint | N |
| 4 | PartyDlID | bigint | Y |
| 5 | Quantity | decimal(30,4) | N |
| 6 | Done | decimal(38,10) | Y |
| 7 | Non | decimal(38,10) | Y |
| 8 | FeeChangeble | bit | Y |
| 9 | QuantityIncreasable | bit | Y |

### CNT.VWNetContractStatementItem

Definition: `programmability/views/CNT.VWNetContractStatementItem.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | FinancialPeriodID | int | Y |
| 2 | ContractID | int | N |
| 3 | CurrencyID | int | N |
| 4 | BranchID | int | N |
| 5 | PartyID | bigint | N |
| 6 | ContractStatementItemID | int | N |
| 7 | Number | int | N |
| 8 | EndDate | date | N |
| 9 | Date | date | N |
| 10 | ContractStatementID | int | N |
| 11 | ConfirmStatementID | int | N |
| 12 | Tax | decimal(30,4) | N |
| 13 | Duty | decimal(30,4) | N |
| 14 | Amount | decimal(31,4) | Y |
| 15 | RowIndex | smallint | N |
| 16 | CurrencyRate | decimal(20,10) | N |

### CNT.VWReceiptAndPayment

Definition: `programmability/views/CNT.VWReceiptAndPayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Type | varchar(16) | N |
| 2 | DocID | int | N |
| 3 | Number | int | Y |
| 4 | Date | date | Y |
| 5 | BaseDocument | nvarchar(770) | Y |
| 6 | Amount | decimal(36,10) | Y |
| 7 | Description | nvarchar(MAX) | Y |
| 8 | Description2 | nvarchar(MAX) | Y |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | ContractID | int | Y |
| 12 | BaseDocumentType | varchar(22) | N |
| 13 | ItemType | varchar(20) | Y |
| 14 | ItemID | int | Y |
| 15 | ReceiptAndPaymentType | nvarchar(14) | Y |
| 16 | BaseDocID | int | Y |
| 17 | OriginVatCurrency | int | Y |
| 18 | ItemCurrencyID | int | Y |
| 19 | ItemCurrencyRate | decimal(20,10) | Y |
| 20 | ItemAmount | decimal(36,10) | Y |

### CNT.VWReceiptAndPayment_Dollar

Definition: `programmability/views/CNT.VWReceiptAndPayment_Dollar.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Type | varchar(16) | N |
| 2 | DocID | int | N |
| 3 | Number | int | Y |
| 4 | Date | date | Y |
| 5 | BaseDocument | nvarchar(770) | Y |
| 6 | Amount | decimal(36,10) | Y |
| 7 | Description | nvarchar(MAX) | Y |
| 8 | Description2 | nvarchar(MAX) | Y |
| 9 | CurrencyID | int | N |
| 10 | CurrencyRate | decimal(20,10) | N |
| 11 | ContractID | int | Y |
| 12 | BaseDocumentType | varchar(17) | N |
| 13 | ItemType | varchar(20) | Y |
| 14 | ItemID | int | Y |
| 15 | ReceiptAndPaymentType | nvarchar(14) | Y |
| 16 | BaseDocID | int | Y |
| 17 | OriginVatCurrency | int | Y |
| 18 | DollarRate | decimal(30,4) | Y |
| 19 | DollarAmount | decimal(38,6) | Y |

