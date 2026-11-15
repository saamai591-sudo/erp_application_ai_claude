# Schema `FIN`

## Tables

### FIN.BankBill

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankBillID | int | N |  | identity |
| 2 | BankAccountID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Status | tinyint | N |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** BankBillID
- **FK** `FK_BankBill_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_BankBill_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankBill_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.BankBillItem (BankBillID); FIN.Reconciliation (BankBillID)

### FIN.BankBillItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankBillItemID | int | N |  | identity |
| 2 | BankBillID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Number | nvarchar(150) | N |  |  |
| 5 | Description | nvarchar(1050) | Y |  |  |
| 6 | Description2 | nvarchar(1050) | Y |  |  |
| 7 | Deposite | decimal(30,4) | N |  |  |
| 8 | Withdraw | decimal(30,4) | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** BankBillItemID
- **FK** `FK_BankBillItem_BankBill` (BankBillID) -> FIN.BankBill (BankBillID) on delete CASCADE
- **FK** `FK_BankBillItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankBillItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.ReconciledBillItem (BankBillItemID)

### FIN.Book

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BookID | int | N |  | identity |
| 2 | BankAccountID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** BookID
- **FK** `FK_Book_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_Book_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Book_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.BookItem (BookID)

### FIN.BookItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BookItemID | int | N |  | identity |
| 2 | BookID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Number | nvarchar(150) | N |  |  |
| 5 | Description | nvarchar(1050) | Y |  |  |
| 6 | Description2 | nvarchar(1050) | Y |  |  |
| 7 | Deposite | decimal(30,4) | N |  |  |
| 8 | Withdraw | decimal(30,4) | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** BookItemID
- **FK** `FK_BookItem_Book` (BookID) -> FIN.Book (BookID) on delete CASCADE
- **FK** `FK_BookItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BookItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### FIN.CashLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashLevelID | int | N |  | identity |
| 2 | Order | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CashLevelID
- **FK** `FK_CashLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CashLevel_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** FIN.CashStructure (CashLevelID)

### FIN.CashStructure

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashStructureID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | CashLevelID | int | N |  |  |
| 4 | Code | int | N |  |  |
| 5 | Title | nvarchar(256) | N |  |  |
| 6 | Title2 | nvarchar(256) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CashStructureID
- **FK** `FK_CashStructure_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CashStructure_Parent` (ParentID) -> FIN.CashStructure (CashStructureID)
- **FK** `Fk_CashStructure_CashLevel` (CashLevelID) -> FIN.CashLevel (CashLevelID)
- **FK** `FK_CashStructure_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** FIN.CashStructure (ParentID); FIN.PaymentType (CashstructureID); FIN.ReceiptType (CashStructureID)

### FIN.CashTransfer

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashTransferID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | BranchID | int | N |  |  |
| 7 | SourceCashID | int | N |  |  |
| 8 | TargetCashID | int | N |  |  |
| 9 | Description | nvarchar(256) | Y |  |  |
| 10 | Description2 | nvarchar(256) | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CashTransferID
- **FK** `FK_CashTransfer_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_CashTransfer_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_CashTransfer_SourceCash` (SourceCashID) -> CFG.Cash (CashID)
- **FK** `FK_CashTransfer_TargetCash` (TargetCashID) -> CFG.Cash (CashID)
- **FK** `FK_CashTransfer_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashTransfer_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.CashTransferItem (CashTransferID)

### FIN.CashTransferItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashTransferItemID | int | N |  | identity |
| 2 | CashTransferID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | ReceivedCheqeID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CashTransferItemID
- **FK** `FK_CashTransferItem_CashTransfer` (CashTransferID) -> FIN.CashTransfer (CashTransferID) on delete CASCADE
- **FK** `FK_CashTransferItem_ReceivedCheqe` (ReceivedCheqeID) -> FIN.ReceivedCheqe (ReceivedCheqeID)
- **FK** `FK_CashTransferItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashTransferItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### FIN.CheqeBook

Rows: 3159

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CheqeBookID | int | N |  | identity |
| 2 | BankAccountID | int | N |  |  |
| 3 | Seri | nvarchar(100) | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Count | tinyint | N |  |  |
| 6 | ReportID | int | Y |  |  |
| 7 | Status | tinyint | N |  |  |
| 8 | PrintDateToString | bit | N |  |  |
| 9 | PrintNumberToWord | bit | N |  |  |
| 10 | Perforage | bit | N |  |  |
| 11 | Scratch | bit | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CheqeBookID
- **unique index** `IX_CheqeBook_BankAccount_Seri_Number` (BankAccountID, Seri, Number)
- **FK** `FK_CheqeBook_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_CheqeBook_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CheqeBook_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CheqeBook_Report` (ReportID) -> CFG.SaturnReport (ReportID)
- **Referenced by:** FIN.PaymentCheqe (CheqeBookID); FIN.PaymentCheqeCommitment (CheqeBookID)

### FIN.CommitmentType

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CommitmentTypeID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | SLID | int | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | OtherPartySlID | int | Y |  |  |

- **Primary key:** CommitmentTypeID
- **FK** `FK_CommitmentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CommitmentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CommitmentType_SL` (SLID) -> ACC.SL (SlID)
- **FK** `FK_CommitmentType_OtherPartySlID` (OtherPartySlID) -> ACC.SL (SlID)
- **Referenced by:** FIN.PaymentCheqeCommitment (CommitmentTypeID); FIN.PaymentGuarantyCommitment (CommitmentTypeID); FIN.PaymentPromissoryCommitment (CommitmentTypeID); FIN.ReceiveCheqeCommitment (CommitmentTypeID); FIN.ReceiveGuarantyCommitment (CommitmentTypeID); FIN.ReceivePromissoryCommitment (CommitmentTypeID)

### FIN.Fund

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FundID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | IsActive | bit | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FundID
- **FK** `FK_Fund_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Fund_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Fund_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **Referenced by:** FIN.PettyCash (FundID)

### FIN.GuarantyOperation

Rows: 34

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | GuarantyOperationID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | CommitmentType | tinyint | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | date | date | N |  |  |
| 6 | PaymentGuarantyCommitmentID | int | Y |  |  |
| 7 | ReceiveGuarantyCommitmentID | int | Y |  |  |
| 8 | OperationType | tinyint | N |  |  |
| 9 | DueDate | date | Y |  |  |
| 10 | DeductedAmount | decimal(30,4) | N |  |  |
| 11 | BankAccountID | int | Y |  |  |
| 12 | DraftNumber | nvarchar(50) | Y |  |  |
| 13 | Description | nvarchar(250) | Y |  |  |
| 14 | Description2 | nvarchar(250) | Y |  |  |
| 15 | PreVoucherID | int | Y |  |  |
| 16 | FinancialPeriodID | int | N |  |  |
| 17 | Version | int | N |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | SlID | int | Y |  |  |
| 23 | CurrencyRate | decimal(20,10) | Y |  |  |

- **Primary key:** GuarantyOperationID
- **FK** `FK_GuarantyOperation_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_GuarantyOperation_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_GuarantyOperation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_GuarantyOperation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_GuarantyOperation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_GuarantyOperation_PaymentGuarantyCommitment` (PaymentGuarantyCommitmentID) -> FIN.PaymentGuarantyCommitment (PaymentGuarantyCommitmentID)
- **FK** `FK_GuarantyOperation_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_GuarantyOperation_ReceiveGuarantyCommitment` (ReceiveGuarantyCommitmentID) -> FIN.ReceiveGuarantyCommitment (ReceiveGuarantyCommitmentID)
- **FK** `FK_GuarantyOperation_SL` (SlID) -> ACC.SL (SlID)

### FIN.PaymentBankDraft

Rows: 11777

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentBankDraftID | int | N |  | identity |
| 2 | PaymentReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BankAccountID | int | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Wage | decimal(36,10) | N | ((0)) |  |

- **Primary key:** PaymentBankDraftID
- **FK** `FK_PaymentBankDraft_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentBankDraft_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentBankDraft_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentBankDraft_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentBankDraft_PaymentReceipt` (PaymentReceiptID) -> FIN.PaymentReceipt (PaymentReceiptID) on delete CASCADE
- **Referenced by:** FIN.PaymentSubject (PaymentBankDraftID)

### FIN.PaymentCash

Rows: 368

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCashID | int | N |  | identity |
| 2 | PaymentReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | CashID | int | N |  |  |
| 5 | CurrencyID | int | N |  |  |
| 6 | CurrencyRate | decimal(20,10) | N |  |  |
| 7 | Amount | decimal(36,10) | Y |  |  |
| 8 | Description | nvarchar(250) | Y |  |  |
| 9 | Description2 | nvarchar(250) | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentCashID
- **FK** `FK_PaymentCash_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_PaymentCash_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCash_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentCash_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCash_PaymentReceipt` (PaymentReceiptID) -> FIN.PaymentReceipt (PaymentReceiptID) on delete CASCADE
- **Referenced by:** FIN.PaymentSubject (PaymentCashID)

### FIN.PaymentCheqe

Rows: 2492

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCheqeID | int | N |  | identity |
| 2 | PaymentReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BankAccountID | int | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | PaymentCheqeTypeID | int | N |  |  |
| 11 | Description | nvarchar(MAX) | Y |  |  |
| 12 | Description2 | nvarchar(MAX) | Y |  |  |
| 13 | LastState | tinyint | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | CheqeBookID | int | Y |  |  |

- **Primary key:** PaymentCheqeID
- **FK** `FK_PaymentCheqe_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentCheqe_CheqeBook` (CheqeBookID) -> FIN.CheqeBook (CheqeBookID)
- **FK** `FK_PaymentCheqe_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqe_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentCheqe_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqe_PaymentCheqeType` (PaymentCheqeTypeID) -> FIN.PaymentCheqeType (PaymentCheqeTypeID)
- **FK** `FK_PaymentCheqe_PaymentReceipt` (PaymentReceiptID) -> FIN.PaymentReceipt (PaymentReceiptID) on delete CASCADE
- **Referenced by:** FIN.PaymentCheqeFlowItem (PaymentCheqeID); FIN.PaymentSubject (PaymentCheqeID)

### FIN.PaymentCheqeCommitment

Rows: 81

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCheqeCommitmentID | int | N |  | identity |
| 2 | PaymentCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BankAccountID | int | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | CurrencyID | int | N |  |  |
| 7 | CurrencyRate | decimal(20,10) | N |  |  |
| 8 | Amount | decimal(30,4) | N |  |  |
| 9 | Description | nvarchar(250) | Y |  |  |
| 10 | Description2 | nvarchar(250) | Y |  |  |
| 11 | LastState | tinyint | N |  |  |
| 12 | Date | date | Y |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | CommitmentTypeID | int | N |  |  |
| 19 | CheqeBookID | int | Y |  |  |

- **Primary key:** PaymentCheqeCommitmentID
- **FK** `FK_PaymentCheqeCommitment_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentCheqeCommitment_CheqeBook` (CheqeBookID) -> FIN.CheqeBook (CheqeBookID)
- **FK** `FK_PaymentCheqeCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_PaymentCheqeCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentCheqeCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeCommitment_PaymentCommitment` (PaymentCommitmentID) -> FIN.PaymentCommitment (PaymentCommitmentID) on delete CASCADE
- **Referenced by:** FIN.PaymentCommitmentRecallItem (PaymentCheqeCommitmentID); FOS.LetterCreditGuarantee (PaymentCheqeCommitmentID)

### FIN.PaymentCheqeFlow

Rows: 132

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCheqeFlowID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | BankAccountID | int | Y |  |  |
| 7 | PartyID | bigint | Y |  |  |
| 8 | PreVoucherID | int | Y |  |  |
| 9 | InnerNumber | int | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentCheqeFlowID
- **FK** `FK_PaymentCheqeFlow_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentCheqeFlow_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentCheqeFlow_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeFlow_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PaymentCheqeFlow_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeFlow_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PaymentCheqeFlow_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.PaymentCheqeFlowItem (PaymentCheqeFlowID)

### FIN.PaymentCheqeFlowItem

Rows: 186

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCheqeFlowItemID | int | N |  | identity |
| 2 | PaymentCheqeFlowID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PaymentCheqeID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentCheqeFlowItemID
- **FK** `FK_PaymentCheqeFlowItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeFlowItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeFlowItem_PaymentCheqe` (PaymentCheqeID) -> FIN.PaymentCheqe (PaymentCheqeID)
- **FK** `FK_PaymentCheqeFlowItem_PaymentCheqeFlow` (PaymentCheqeFlowID) -> FIN.PaymentCheqeFlow (PaymentCheqeFlowID) on delete CASCADE

### FIN.PaymentCheqeType

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCheqeTypeID | int | N |  | identity |
| 2 | Title | nvarchar(500) | N |  |  |
| 3 | Title2 | nvarchar(500) | N |  |  |
| 4 | Today | bit | N |  |  |
| 5 | SlID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | IsActive | bit | N |  |  |

- **Primary key:** PaymentCheqeTypeID
- **FK** `FK_PaymentCheqeType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCheqeType_SlID` (SlID) -> ACC.SL (SlID)
- **Referenced by:** FIN.PaymentCheqe (PaymentCheqeTypeID)

### FIN.PaymentCommitment

Rows: 93

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCommitmentID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | ContractID | int | Y |  |  |
| 12 | TenderID | int | Y |  |  |
| 13 | PaymentRequestID | int | Y |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | BaseType | tinyint | N |  |  |

- **Primary key:** PaymentCommitmentID
- **FK** `FK_PaymentCommitment_PaymentRequest` (PaymentRequestID) -> REQ.PaymentRequest (PaymentRequestID)
- **FK** `FK_PaymentCommitment_Tender` (TenderID) -> VND.Tender (TenderID)
- **FK** `FK_PaymentCommitment_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentCommitment_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_PaymentCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitment_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PaymentCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitment_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PaymentCommitment_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.PaymentCheqeCommitment (PaymentCommitmentID); FIN.PaymentGuarantyCommitment (PaymentCommitmentID); FIN.PaymentPromissoryCommitment (PaymentCommitmentID)

### FIN.PaymentCommitmentRecall

Rows: 18

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCommitmentRecallID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | DLID | bigint | N |  |  |
| 6 | CashID | int | N |  |  |
| 7 | PreVoucherID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentCommitmentRecallID
- **FK** `FK_PaymentCommitmentRecall_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentCommitmentRecall_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_PaymentCommitmentRecall_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitmentRecall_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_PaymentCommitmentRecall_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PaymentCommitmentRecall_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitmentRecall_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.PaymentCommitmentRecallItem (PaymentCommitmentRecallID)

### FIN.PaymentCommitmentRecallItem

Rows: 27

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentCommitmentRecallItemID | int | N |  | identity |
| 2 | PaymentCommitmentRecallID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | RowIndex | smallint | N |  |  |
| 5 | PaymentCheqeCommitmentID | int | Y |  |  |
| 6 | PaymentGuarantyCommitmentID | int | Y |  |  |
| 7 | PaymentPromissoryCommitmentID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentCommitmentRecallItemID
- **FK** `FK_PaymentCommitmentRecallItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitmentRecallItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentCommitmentRecallItem_PaymentCheqeCommitment` (PaymentCheqeCommitmentID) -> FIN.PaymentCheqeCommitment (PaymentCheqeCommitmentID)
- **FK** `FK_PaymentCommitmentRecallItem_PaymentCommitmentRecall` (PaymentCommitmentRecallID) -> FIN.PaymentCommitmentRecall (PaymentCommitmentRecallID) on delete CASCADE
- **FK** `FK_PaymentCommitmentRecallItem_PaymentGuarantyCommitment` (PaymentGuarantyCommitmentID) -> FIN.PaymentGuarantyCommitment (PaymentGuarantyCommitmentID)
- **FK** `FK_PaymentCommitmentRecallItem_PaymentPromissoryCommitment` (PaymentPromissoryCommitmentID) -> FIN.PaymentPromissoryCommitment (PaymentPromissoryCommitmentID)

### FIN.PaymentGuarantyCommitment

Rows: 59

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentGuarantyCommitmentID | int | N |  | identity |
| 2 | PaymentCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BankAccountID | int | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | LastState | tinyint | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | CommitmentTypeID | int | N |  |  |

- **Primary key:** PaymentGuarantyCommitmentID
- **FK** `FK_PaymentGuarantyCommitment_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_PaymentGuarantyCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_PaymentGuarantyCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentGuarantyCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentGuarantyCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentGuarantyCommitment_PaymentCommitment` (PaymentCommitmentID) -> FIN.PaymentCommitment (PaymentCommitmentID) on delete CASCADE
- **Referenced by:** FIN.GuarantyOperation (PaymentGuarantyCommitmentID); FIN.PaymentCommitmentRecallItem (PaymentGuarantyCommitmentID); FOS.LetterCreditGuarantee (PaymentGuarantyCommitmentID)

### FIN.PaymentOtherCheqe

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentOtherCheqeID | int | N |  | identity |
| 2 | PaymentReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | ReceivedCheqeID | int | N |  |  |
| 5 | Description | nvarchar(250) | Y |  |  |
| 6 | Description2 | nvarchar(250) | Y |  |  |
| 7 | ReceiptCheqeFlowItemID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PaymentOtherCheqeID
- **FK** `FK_PaymentOtherCheqe_ReceiptCheqeFlowItem` (ReceiptCheqeFlowItemID) -> FIN.ReceiptCheqeFlowItem (ReceiptCheqeFlowItemID)
- **FK** `FK_PaymentOtherCheqe_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentOtherCheqe_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentOtherCheqe_PaymentReceipt` (PaymentReceiptID) -> FIN.PaymentReceipt (PaymentReceiptID) on delete CASCADE
- **FK** `FK_PaymentOtherCheqe_ReceivedCheqe` (ReceivedCheqeID) -> FIN.ReceivedCheqe (ReceivedCheqeID)
- **Referenced by:** FIN.PaymentSubject (PaymentOtherCheqeID)

### FIN.PaymentPromissoryCommitment

Rows: 12

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentPromissoryCommitmentID | int | N |  | identity |
| 2 | PaymentCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Date | date | Y |  |  |
| 6 | Seri | nvarchar(100) | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | LastState | tinyint | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | CommitmentTypeID | int | N |  |  |

- **Primary key:** PaymentPromissoryCommitmentID
- **FK** `FK_PaymentPromissoryCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_PaymentPromissoryCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentPromissoryCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentPromissoryCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentPromissoryCommitment_PaymentCommitment` (PaymentCommitmentID) -> FIN.PaymentCommitment (PaymentCommitmentID) on delete CASCADE
- **Referenced by:** FIN.PaymentCommitmentRecallItem (PaymentPromissoryCommitmentID); FOS.LetterCreditGuarantee (PaymentPromissoryCommitmentID)

### FIN.PaymentReceipt

Rows: 6975

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentReceiptID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | Status | tinyint | N |  |  |
| 10 | PreVoucherID | int | Y |  |  |
| 11 | PaymentRequestID | int | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | PaymentOrderID | int | Y |  |  |

- **Primary key:** PaymentReceiptID
- **FK** `FK_PaymentReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PaymentReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentReceipt_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PaymentReceipt_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_PaymentReceipt_PaymentRequest` (PaymentRequestID) -> REQ.PaymentRequest (PaymentRequestID)
- **FK** `FK_PaymentReceipt_PaymentOrder` (PaymentOrderID) -> REQ.PaymentOrder (PaymentOrderID)
- **FK** `FK_PaymentReceipt_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PaymentReceipt_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** FIN.PaymentBankDraft (PaymentReceiptID); FIN.PaymentCash (PaymentReceiptID); FIN.PaymentCheqe (PaymentReceiptID); FIN.PaymentOtherCheqe (PaymentReceiptID); FIN.PaymentSubject (PaymentReceiptID)

### FIN.PaymentSubject

Rows: 23484

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentSubjectID | int | N |  | identity |
| 2 | PaymentReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PaymentCashID | int | Y |  |  |
| 5 | PaymentCheqeID | int | Y |  |  |
| 6 | PaymentBankDraftID | int | Y |  |  |
| 7 | PaymentOtherCheqeID | int | Y |  |  |
| 8 | DLID | bigint | Y |  |  |
| 9 | PurchaseInvoiceID | int | Y |  |  |
| 10 | ReturnedSaleInvoiceID | int | Y |  |  |
| 11 | InstallmentPaymentItemID | int | Y |  |  |
| 12 | CurrencyID | int | N |  |  |
| 13 | CurrencyRate | decimal(20,10) | N |  |  |
| 14 | Amount | decimal(36,10) | Y |  |  |
| 15 | Discount | decimal(36,10) | Y |  |  |
| 16 | Description | nvarchar(MAX) | Y |  |  |
| 17 | Description2 | nvarchar(MAX) | Y |  |  |
| 18 | Version | int | N |  |  |
| 19 | Creator | int | N |  |  |
| 20 | CreationDate | datetime | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | PaymentTypeID | int | N |  |  |
| 24 | PurchaseContractID | int | Y |  |  |
| 25 | ProposalID | int | Y |  |  |
| 26 | CalculationResultID | decimal(18,0) | Y |  |  |
| 27 | InvoiceID | int | Y |  |  |
| 28 | ProformaInvoiceID | int | Y |  |  |
| 29 | ConfirmStatementID | int | Y |  |  |
| 30 | ConfirmStatementItemID | int | Y |  |  |
| 31 | ContractID | int | Y |  |  |
| 32 | ContractStatementID | int | Y |  |  |
| 33 | PayPreparingID | int | Y |  |  |
| 34 | Allocation | decimal(36,10) | N | ((0)) |  |
| 35 | PettyCashID | int | Y |  |  |
| 36 | ConfirmPurchaseInvoiceID | int | Y |  |  |
| 37 | ConfirmPurchaseInvoiceItemID | int | Y |  |  |
| 38 | BaseDocumentCurrencyID | int | Y |  |  |
| 39 | BaseDocumentCurrencyRate | decimal(20,10) | Y |  |  |

- **Primary key:** PaymentSubjectID
- **FK** `FK_PaymentSubject_CalculationResult` (CalculationResultID) -> PAY.CalculationResult (CalculationResultID)
- **FK** `FK_PaymentSubject_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_PaymentSubject_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentSubject_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentSubject_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_PaymentSubject_InstallmentPaymentItem` (InstallmentPaymentItemID) -> CFG.InstallmentPaymentItem (InstallmentPaymentItemID)
- **FK** `FK_PaymentSubject_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentSubject_PaymentBankDraft` (PaymentBankDraftID) -> FIN.PaymentBankDraft (PaymentBankDraftID)
- **FK** `FK_PaymentSubject_PaymentCash` (PaymentCashID) -> FIN.PaymentCash (PaymentCashID)
- **FK** `FK_PaymentSubject_PaymentCheqe` (PaymentCheqeID) -> FIN.PaymentCheqe (PaymentCheqeID)
- **FK** `FK_PaymentSubject_PaymentOtherCheqe` (PaymentOtherCheqeID) -> FIN.PaymentOtherCheqe (PaymentOtherCheqeID)
- **FK** `FK_PaymentSubject_PaymentReceipt` (PaymentReceiptID) -> FIN.PaymentReceipt (PaymentReceiptID) on delete CASCADE
- **FK** `FK_PaymentSubject_PaymentType` (PaymentTypeID) -> FIN.PaymentType (PaymentTypeID)
- **FK** `FK_PaymentSubject_Proposal` (ProposalID) -> VND.Proposal (ProposalID)
- **FK** `FK_PaymentSubject_PurchaseContract` (PurchaseContractID) -> VND.PurchaseContract (PurchaseContractID)
- **FK** `FK_PaymentSubject_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_PaymentSubject_ReturnedSaleInvoice` (ReturnedSaleInvoiceID) -> SLE.ReturnedSaleInvoice (ReturnedSaleInvoiceID)
- **FK** `FK_PaymentSubject_ConfirmPurchaseInvoiceItemID` (ConfirmPurchaseInvoiceItemID) -> VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceItemID)
- **FK** `FK_PaymentSubject_Invoice` (InvoiceID) -> SLE.Invoice (InvoiceID)
- **FK** `FK_PaymentSubject_ConfirmStatement` (ConfirmStatementID) -> CNT.ConfirmStatement (ConfirmStatementID)
- **FK** `FK_PaymentSubject_ConfirmStatementItem` (ConfirmStatementItemID) -> CNT.ConfirmStatementItem (ConfirmStatementItemID)
- **FK** `FK_PaymentSubject_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_PaymentSubject_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID)
- **FK** `FK_PaymentSubject_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID)
- **FK** `FK_PaymentSubject_PayPreparing` (PayPreparingID) -> PAY.PayPreparing (PayPreparingID)
- **FK** `FK_PaymentSubject_BaseDocumentCurrency` (BaseDocumentCurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PaymentSubject_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **Referenced by:** CFG.DebitCreditNoteItem (PaymentSubjectID); CNT.ConfirmStatementPrePayment (PaymentSubjectID); NOC.CashDataCollection (PaymentSubjectID); PAY.ParameterMonthlyData (PaymentSubjectID); VND.ConfirmPurchaseInvoiceAdvancePayment (PaymentSubjectID); VND.PurchaseInvoicePrePayment (PaymentSubjectID)

### FIN.PaymentType

Rows: 308

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PaymentTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Title | nvarchar(250) | N |  |  |
| 5 | Title2 | nvarchar(250) | N |  |  |
| 6 | SLID | int | Y |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | AnnouncedInAdditionalValue | bit | N | ((0)) |  |
| 14 | CompulsoryInBaseSelection | bit | N | ((0)) |  |
| 15 | AllocationSlID | int | Y |  |  |
| 16 | CashstructureID | int | Y |  |  |

- **Primary key:** PaymentTypeID
- **FK** `FK_PaymentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PaymentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PaymentType_SL` (SLID) -> ACC.SL (SlID)
- **FK** `FK_PaymentType_CashstructureID` (CashstructureID) -> FIN.CashStructure (CashStructureID)
- **FK** `FK_PaymentType_AllocationSl` (AllocationSlID) -> ACC.SL (SlID)
- **Referenced by:** CFG.DebitCreditNoteItem (PaymentTypeID); FIN.PaymentSubject (PaymentTypeID); FIN.PettyCashCostItem (PaymentTypeID); PAY.Parameter (PaymentTypeID); POS.Station (PaymentTypeID)

### FIN.PettyCash

Rows: 33

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashID | int | N |  | identity |
| 2 | PartyID | bigint | N |  |  |
| 3 | CurrencyID | int | N |  |  |
| 4 | CurrencyRate | decimal(20,10) | N |  |  |
| 5 | FirstAmount | decimal(30,4) | N |  |  |
| 6 | MaxAmount | decimal(30,4) | Y |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | SLID | int | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | FundID | int | Y |  |  |
| 15 | NegativeInventoryChecking | bit | N | ((1)) |  |
| 16 | HasBankPettyCash | bit | N | ((0)) |  |
| 17 | BankAccountID | int | Y |  |  |
| 18 | Identifier | nvarchar(256) | Y |  |  |

- **Primary key:** PettyCashID
- **FK** `FK_PettyCash_Fund` (FundID) -> FIN.Fund (FundID)
- **FK** `FK_PettyCash_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCash_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PettyCash_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PettyCash_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PettyCash_SL` (SLID) -> ACC.SL (SlID)
- **FK** `FK_PettyCash_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **Referenced by:** CFG.DebitCreditNoteItem (PettyCashID); FIN.PaymentSubject (PettyCashID); FIN.PettyCashChargingItem (PettyCashID); FIN.PettyCashCost (PettyCashID); FIN.PettyCashCostItem (PettyCashID); FIN.ReceiveSubject (PettyCashID); REQ.PaymentOrderItem (PettyCashID)

### FIN.PettyCashCharging

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashChargingID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | FinancialPeriodID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Description | nvarchar(MAX) | Y |  |  |
| 7 | Description2 | nvarchar(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PettyCashChargingID
- **FK** `FK_PettyCashCharging_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PettyCashCharging_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PettyCashCharging_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCashCharging_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.PettyCashChargingItem (PettyCashChargingID)

### FIN.PettyCashChargingItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashChargingItemID | int | N |  | identity |
| 2 | PettyCashChargingID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PettyCashID | int | N |  |  |
| 5 | Amount | decimal(36,10) | N |  |  |
| 6 | Description | nvarchar(MAX) | Y |  |  |
| 7 | Description2 | nvarchar(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PettyCashChargingItemID
- **FK** `FK_PettyCashChargingItem_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_PettyCashChargingItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCashChargingItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PettyCashChargingItem_PettyCashCharging` (PettyCashChargingID) -> FIN.PettyCashCharging (PettyCashChargingID) on delete CASCADE

### FIN.PettyCashCost

Rows: 4556

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashCostID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | PettyCashID | int | N |  |  |
| 5 | Number | int | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | CurrencyRate | decimal(20,10) | N |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | PreVoucherID | int | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Status | tinyint | Y |  |  |

- **Primary key:** PettyCashCostID
- **FK** `FK_PettyCashCost_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PettyCashCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCashCost_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PettyCashCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PettyCashCost_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_PettyCashCost_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.PettyCashCostItem (PettyCashCostID)

### FIN.PettyCashCostItem

Rows: 37406

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashCostItemID | int | N |  | identity |
| 2 | PettyCashCostID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | TraceNumber | nvarchar(50) | Y |  |  |
| 6 | Amount | decimal(30,4) | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | Description2 | nvarchar(MAX) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | PaymentTypeID | int | N |  |  |
| 15 | PurchaseInvoiceID | int | Y |  |  |
| 16 | ReturnedSaleInvoiceID | int | Y |  |  |
| 17 | InstallmentPaymentItemID | int | Y |  |  |
| 18 | PurchaseContractID | int | Y |  |  |
| 19 | ProposalID | int | Y |  |  |
| 20 | PartyID | bigint | Y |  |  |
| 21 | InvoiceID | int | Y |  |  |
| 22 | PettyCashID | int | Y |  |  |
| 23 | Allocation | decimal(36,10) | N | ((0)) |  |
| 24 | ConfirmPurchaseInvoiceID | int | Y |  |  |
| 25 | ConfirmPurchaseInvoiceItemID | int | Y |  |  |
| 26 | PayPreparingID | int | Y |  |  |

- **Primary key:** PettyCashCostItemID
- **FK** `FK_PettyCashCostItem_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_PettyCashCostItem_ConfirmPurchaseInvoiceItemID` (ConfirmPurchaseInvoiceItemID) -> VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceItemID)
- **FK** `FK_PettyCashCostItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCashCostItem_InstallmentPaymentItem` (InstallmentPaymentItemID) -> CFG.InstallmentPaymentItem (InstallmentPaymentItemID)
- **FK** `FK_PettyCashCostItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PettyCashCostItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PettyCashCostItem_PaymentType` (PaymentTypeID) -> FIN.PaymentType (PaymentTypeID)
- **FK** `FK_PettyCashCostItem_PettyCashCost` (PettyCashCostID) -> FIN.PettyCashCost (PettyCashCostID) on delete CASCADE
- **FK** `FK_PettyCashCostItem_Proposal` (ProposalID) -> VND.Proposal (ProposalID)
- **FK** `FK_PettyCashCostItem_PurchaseContract` (PurchaseContractID) -> VND.PurchaseContract (PurchaseContractID)
- **FK** `FK_PettyCashCostItem_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_PettyCashCostItem_ReturnedSaleInvoice` (ReturnedSaleInvoiceID) -> SLE.ReturnedSaleInvoice (ReturnedSaleInvoiceID)
- **FK** `FK_PettyCashCostItem_PayPreparing` (PayPreparingID) -> PAY.PayPreparing (PayPreparingID)
- **FK** `FK_PettyCashCostItem_Invoice` (InvoiceID) -> SLE.Invoice (InvoiceID)
- **FK** `FK_PettyCashCostItem_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID)
- **Referenced by:** CFG.DebitCreditNoteItem (PettyCashCostItemID); FIN.PettyCashCostItemAccountLevel (PettyCashCostItemID); NOC.CashDataCollection (PettyCashCostItemID); PAY.ParameterMonthlyData (PettyCashCostItemID); VND.PurchaseInvoicePrePayment (PettyCashCostItemID)

### FIN.PettyCashCostItemAccountLevel

Rows: 40336

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PettyCashCostItemAccountLevelID | int | N |  | identity |
| 2 | PettyCashCostItemID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DlID | bigint | Y |  |  |
| 5 | Value | nvarchar(MAX) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PettyCashCostItemAccountLevelID
- **unique index** `IX_AccountLevel` (PettyCashCostItemID, AccountLevelID)
- **FK** `FK_PettyCashCostItemAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_PettyCashCostItemAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PettyCashCostItemAccountLevel_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PettyCashCostItemAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PettyCashCostItemAccountLevel_PettyCashCostItem` (PettyCashCostItemID) -> FIN.PettyCashCostItem (PettyCashCostItemID) on delete CASCADE

### FIN.ReceiptCheqeFlow

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiptCheqeFlowID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Number | nvarchar(50) | Y |  |  |
| 7 | BankAccountID | int | Y |  |  |
| 8 | CashID | int | Y |  |  |
| 9 | PartyID | bigint | Y |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | InnerNumber | int | N |  |  |
| 12 | PreVoucherID | int | Y |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceiptCheqeFlowID
- **FK** `FK_ReceiptCheqeFlow_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_ReceiptCheqeFlow_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceiptCheqeFlow_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_ReceiptCheqeFlow_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiptCheqeFlow_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceiptCheqeFlow_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiptCheqeFlow_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ReceiptCheqeFlow_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.ReceiptCheqeFlowItem (ReceiptCheqeFlowID)

### FIN.ReceiptCheqeFlowItem

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiptCheqeFlowItemID | int | N |  | identity |
| 2 | ReceiptCheqeFlowID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PreviousFlow | int | Y |  |  |
| 5 | ReceivedCheqeID | int | N |  |  |
| 6 | State | tinyint | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceiptCheqeFlowItemID
- **FK** `FK_ReceiptCheqeFlowItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiptCheqeFlowItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiptCheqeFlowItem_PreviousFlow` (PreviousFlow) -> FIN.ReceiptCheqeFlowItem (ReceiptCheqeFlowItemID)
- **FK** `FK_ReceiptCheqeFlowItem_ReceiptCheqeFlow` (ReceiptCheqeFlowID) -> FIN.ReceiptCheqeFlow (ReceiptCheqeFlowID) on delete CASCADE
- **FK** `FK_ReceiptCheqeFlowItem_ReceivedCheqe` (ReceivedCheqeID) -> FIN.ReceivedCheqe (ReceivedCheqeID)
- **Referenced by:** FIN.PaymentOtherCheqe (ReceiptCheqeFlowItemID); FIN.ReceiptCheqeFlowItem (PreviousFlow); FIN.ReceivedCheqe (LastFlow)

### FIN.ReceiptType

Rows: 60

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiptTypeID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Title | nvarchar(250) | N |  |  |
| 5 | Title2 | nvarchar(250) | N |  |  |
| 6 | SLID | int | Y |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | CompulsoryBaseSelection | bit | N | ((0)) |  |
| 14 | AllocationSLID | int | Y |  |  |
| 15 | CashStructureID | int | Y |  |  |

- **Primary key:** ReceiptTypeID
- **FK** `FK_ReceiptType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiptType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiptType_SL` (SLID) -> ACC.SL (SlID)
- **FK** `FK_ReceiptType_CashstructureID` (CashStructureID) -> FIN.CashStructure (CashStructureID)
- **FK** `FK_ReceiptType_AllocationSL` (AllocationSLID) -> ACC.SL (SlID)
- **Referenced by:** CFG.DebitCreditNoteItem (ReceiptTypeID); FIN.ReceiveSubject (ReceiptTypeID); POS.Station (ReceiptTypeID)

### FIN.ReceiveCheqeCommitment

Rows: 6

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveCheqeCommitmentID | int | N |  | identity |
| 2 | ReceiveCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | CurrencyID | int | N |  |  |
| 6 | CurrencyRate | decimal(20,10) | N |  |  |
| 7 | Amount | decimal(30,4) | N |  |  |
| 8 | BankID | int | N |  |  |
| 9 | BankBranchCode | nvarchar(100) | Y |  |  |
| 10 | BankBranchName | nvarchar(250) | Y |  |  |
| 11 | AccountNumber | nvarchar(100) | N |  |  |
| 12 | Description | nvarchar(250) | Y |  |  |
| 13 | Description2 | nvarchar(250) | Y |  |  |
| 14 | LastState | tinyint | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | CommitmentTypeID | int | N |  |  |
| 21 | Date | datetime | Y |  |  |

- **Primary key:** ReceiveCheqeCommitmentID
- **FK** `FK_ReceiveCheqeCommitment_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_ReceiveCheqeCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_ReceiveCheqeCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveCheqeCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReceiveCheqeCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveCheqeCommitment_ReceiveCommitment` (ReceiveCommitmentID) -> FIN.ReceiveCommitment (ReceiveCommitmentID) on delete CASCADE
- **Referenced by:** FIN.ReceiveCommitmentRecallItem (ReceiveCheqeCommitmentID)

### FIN.ReceiveCommitment

Rows: 17

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveCommitmentID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | CashID | int | N |  |  |
| 12 | ContractID | int | Y |  |  |
| 13 | TenderID | int | Y |  |  |
| 14 | ReceiveRequestID | int | Y |  |  |
| 15 | Version | int | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | TenderParticipateID | int | Y |  |  |
| 21 | PurchaseContractID | int | Y |  |  |
| 22 | BaseType | tinyint | N |  |  |

- **Primary key:** ReceiveCommitmentID
- **FK** `FK_ReceiveCommitment_Tender` (TenderID) -> VND.Tender (TenderID)
- **FK** `FK_ReceiveCommitment_TenderParticipate` (TenderParticipateID) -> VND.TenderParticipate (TenderParticipateID)
- **FK** `FK_ReceiveCommitment_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceiveCommitment_PurchaseContract` (PurchaseContractID) -> VND.PurchaseContract (PurchaseContractID)
- **FK** `FK_ReceiveCommitment_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_ReceiveCommitment_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ReceiveCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitment_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceiveCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitment_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ReceiveCommitment_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ReceiveCommitment_ReceiveRequest` (ReceiveRequestID) -> REQ.ReceiveRequest (ReceiveRequestID)
- **Referenced by:** FIN.ReceiveCheqeCommitment (ReceiveCommitmentID); FIN.ReceiveGuarantyCommitment (ReceiveCommitmentID); FIN.ReceivePromissoryCommitment (ReceiveCommitmentID)

### FIN.ReceiveCommitmentRecall

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveCommitmentRecallID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | DLID | bigint | N |  |  |
| 6 | PreVoucherID | int | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceiveCommitmentRecallID
- **FK** `FK_ReceiveCommitmentRecall_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceiveCommitmentRecall_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitmentRecall_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_ReceiveCommitmentRecall_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceiveCommitmentRecall_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitmentRecall_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.ReceiveCommitmentRecallItem (ReceiveCommitmentRecallID)

### FIN.ReceiveCommitmentRecallItem

Rows: 28

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveCommitmentRecallItemID | int | N |  | identity |
| 2 | ReceiveCommitmentRecallID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | RowIndex | smallint | N |  |  |
| 5 | ReceiveCheqeCommitmentID | int | Y |  |  |
| 6 | ReceiveGuarantyCommitmentID | int | Y |  |  |
| 7 | ReceivePromissoryCommitmentID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceiveCommitmentRecallItemID
- **FK** `FK_ReceiveCommitmentRecallItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitmentRecallItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveCommitmentRecallItem_ReceiveCheqeCommitment` (ReceiveCheqeCommitmentID) -> FIN.ReceiveCheqeCommitment (ReceiveCheqeCommitmentID)
- **FK** `FK_ReceiveCommitmentRecallItem_ReceiveCommitmentRecall` (ReceiveCommitmentRecallID) -> FIN.ReceiveCommitmentRecall (ReceiveCommitmentRecallID) on delete CASCADE
- **FK** `FK_ReceiveCommitmentRecallItem_ReceiveGuarantyCommitment` (ReceiveGuarantyCommitmentID) -> FIN.ReceiveGuarantyCommitment (ReceiveGuarantyCommitmentID)
- **FK** `FK_ReceiveCommitmentRecallItem_ReceivePromissoryCommitment` (ReceivePromissoryCommitmentID) -> FIN.ReceivePromissoryCommitment (ReceivePromissoryCommitmentID)

### FIN.ReceivedBankDraft

Rows: 1408

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivedBankDraftID | int | N |  | identity |
| 2 | ReceiveReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | BankAccountID | int | N |  |  |
| 5 | Number | nvarchar(100) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceivedBankDraftID
- **FK** `FK_BankDraftDocument_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_BankDraftDocument_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankDraftDocument_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_BankDraftDocument_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivedBankDraft_ReceiveReceipt` (ReceiveReceiptID) -> FIN.ReceiveReceipt (ReceiveReceiptID) on delete CASCADE
- **Referenced by:** FIN.ReceiveSubject (ReceivedBankDraftID)

### FIN.ReceivedCash

Rows: 361

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivedCashID | int | N |  | identity |
| 2 | ReceiveReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | CashID | int | N |  |  |
| 5 | CurrencyID | int | N |  |  |
| 6 | CurrencyRate | decimal(20,10) | N |  |  |
| 7 | Amount | decimal(36,10) | Y |  |  |
| 8 | Description | nvarchar(250) | Y |  |  |
| 9 | Description2 | nvarchar(250) | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceivedCashID
- **FK** `FK_CashDocument_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_CashDocument_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashDocument_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_CashDocument_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivedCash_ReceiveReceipt` (ReceiveReceiptID) -> FIN.ReceiveReceipt (ReceiveReceiptID) on delete CASCADE
- **Referenced by:** FIN.ReceiveSubject (ReceivedCashID)

### FIN.ReceivedCheqe

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivedCheqeID | int | N |  | identity |
| 2 | ReceiveReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | CurrencyID | int | N |  |  |
| 7 | CurrencyRate | decimal(20,10) | N |  |  |
| 8 | Amount | decimal(30,4) | N |  |  |
| 9 | BankID | int | N |  |  |
| 10 | BankBranchCode | nvarchar(100) | Y |  |  |
| 11 | BankBranchName | nvarchar(250) | Y |  |  |
| 12 | AccountNumber | nvarchar(100) | N |  |  |
| 13 | Commercial | bit | N |  |  |
| 14 | Description | nvarchar(MAX) | Y |  |  |
| 15 | Description2 | nvarchar(MAX) | Y |  |  |
| 16 | LastState | tinyint | N |  |  |
| 17 | LastFlow | int | Y |  |  |
| 18 | CashID | int | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | Creator | int | N |  |  |
| 21 | CreationDate | datetime | N |  |  |
| 22 | LastEditor | int | N |  |  |
| 23 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReceivedCheqeID
- **FK** `FK_CheqeDocument_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CheqeDocument_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_CheqeDocument_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivedCheqe_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_ReceivedCheqe_Cash` (CashID) -> CFG.Cash (CashID)
- **FK** `FK_ReceivedCheqe_LastFlow` (LastFlow) -> FIN.ReceiptCheqeFlowItem (ReceiptCheqeFlowItemID)
- **FK** `FK_ReceivedCheqe_ReceiveReceipt` (ReceiveReceiptID) -> FIN.ReceiveReceipt (ReceiveReceiptID) on delete CASCADE
- **Referenced by:** FIN.CashTransferItem (ReceivedCheqeID); FIN.PaymentOtherCheqe (ReceivedCheqeID); FIN.ReceiptCheqeFlowItem (ReceivedCheqeID); FIN.ReceiveSubject (ReceivedCheqeID)

### FIN.ReceiveGuarantyCommitment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveGuarantyCommitmentID | int | N |  | identity |
| 2 | ReceiveCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | CurrencyID | int | N |  |  |
| 7 | CurrencyRate | decimal(20,10) | N |  |  |
| 8 | Amount | decimal(30,4) | N |  |  |
| 9 | BankID | int | N |  |  |
| 10 | BankBranchCode | nvarchar(100) | Y |  |  |
| 11 | BankBranchName | nvarchar(250) | Y |  |  |
| 12 | Description | nvarchar(250) | Y |  |  |
| 13 | Description2 | nvarchar(250) | Y |  |  |
| 14 | LastState | tinyint | N |  |  |
| 15 | Version | int | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | CommitmentTypeID | int | N |  |  |

- **Primary key:** ReceiveGuarantyCommitmentID
- **FK** `FK_ReceiveGuarantyCommitment_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_ReceiveGuarantyCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_ReceiveGuarantyCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveGuarantyCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReceiveGuarantyCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveGuarantyCommitment_ReceiveCommitment` (ReceiveCommitmentID) -> FIN.ReceiveCommitment (ReceiveCommitmentID) on delete CASCADE
- **Referenced by:** FIN.GuarantyOperation (ReceiveGuarantyCommitmentID); FIN.ReceiveCommitmentRecallItem (ReceiveGuarantyCommitmentID)

### FIN.ReceivePromissoryCommitment

Rows: 53

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivePromissoryCommitmentID | int | N |  | identity |
| 2 | ReceiveCommitmentID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Number | nvarchar(100) | N |  |  |
| 5 | Date | date | Y |  |  |
| 6 | Seri | nvarchar(100) | N |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |
| 12 | LastState | tinyint | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | CommitmentTypeID | int | N |  |  |

- **Primary key:** ReceivePromissoryCommitmentID
- **FK** `FK_ReceivePromissoryCommitment_CommitmentType` (CommitmentTypeID) -> FIN.CommitmentType (CommitmentTypeID)
- **FK** `FK_ReceivePromissoryCommitment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceivePromissoryCommitment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReceivePromissoryCommitment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivePromissoryCommitment_ReceiveCommitment` (ReceiveCommitmentID) -> FIN.ReceiveCommitment (ReceiveCommitmentID) on delete CASCADE
- **Referenced by:** FIN.ReceiveCommitmentRecallItem (ReceivePromissoryCommitmentID)

### FIN.ReceiveReceipt

Rows: 1608

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveReceiptID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Status | tinyint | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | DeliverChequeID | int | Y |  |  |

- **Primary key:** ReceiveReceiptID
- **FK** `FK_ReceiveReceipt_DeliverCheque` (DeliverChequeID) -> POS.DeliverCheque (DeliverChequeID)
- **FK** `FK_ReceiptReceive_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceiveReceipt_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceiveReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveReceipt_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ReceiveReceipt_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** FIN.ReceivedBankDraft (ReceiveReceiptID); FIN.ReceivedCash (ReceiveReceiptID); FIN.ReceivedCheqe (ReceiveReceiptID); FIN.ReceiveSubject (ReceiveReceiptID)

### FIN.ReceiveSubject

Rows: 1835

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceiveSubjectID | int | N |  | identity |
| 2 | ReceiveReceiptID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | InvoiceID | int | Y |  |  |
| 5 | ReturnInvoiceID | int | Y |  |  |
| 6 | InstallmentPaymentItemID | int | Y |  |  |
| 7 | ReceivedBankDraftID | int | Y |  |  |
| 8 | ReceivedCashID | int | Y |  |  |
| 9 | ReceivedCheqeID | int | Y |  |  |
| 10 | CurrencyID | int | N |  |  |
| 11 | CurrencyRate | decimal(20,10) | N |  |  |
| 12 | Amount | decimal(36,10) | Y |  |  |
| 13 | Discount | decimal(36,10) | Y |  |  |
| 14 | Description | nvarchar(250) | Y |  |  |
| 15 | Description2 | nvarchar(250) | Y |  |  |
| 16 | DLID | bigint | Y |  |  |
| 17 | Version | int | N |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | ReceiptTypeID | int | N |  |  |
| 23 | PurchaseInvoiceID | int | Y |  |  |
| 24 | QuotationID | int | Y |  |  |
| 25 | SaleContractID | int | Y |  |  |
| 26 | CardReaderSettlementID | int | Y |  |  |
| 27 | ConfirmStatementID | int | Y |  |  |
| 28 | ConfirmStatementItemID | int | Y |  |  |
| 29 | ContractID | int | Y |  |  |
| 30 | ContractStatementID | int | Y |  |  |
| 31 | PettyCashID | int | Y |  |  |
| 32 | Allocation | decimal(36,10) | N | ((0)) |  |
| 33 | ConfirmPurchaseInvoiceID | int | Y |  |  |

- **Primary key:** ReceiveSubjectID
- **index** `IX_SaleContractItem` (SaleContractID)
- **FK** `FK_ReceiveSubject_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceiveSubject_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReceiveSubject_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_ReceiveSubject_InstallmentPaymentItem` (InstallmentPaymentItemID) -> CFG.InstallmentPaymentItem (InstallmentPaymentItemID)
- **FK** `FK_ReceiveSubject_Invoice` (InvoiceID) -> SLE.Invoice (InvoiceID)
- **FK** `FK_ReceiveSubject_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceiveSubject_ReceiptType` (ReceiptTypeID) -> FIN.ReceiptType (ReceiptTypeID)
- **FK** `FK_ReceiveSubject_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_ReceiveSubject_ReceivedBankDraft` (ReceivedBankDraftID) -> FIN.ReceivedBankDraft (ReceivedBankDraftID)
- **FK** `FK_ReceiveSubject_ReceivedCash` (ReceivedCashID) -> FIN.ReceivedCash (ReceivedCashID)
- **FK** `FK_ReceiveSubject_ReceivedCheqe` (ReceivedCheqeID) -> FIN.ReceivedCheqe (ReceivedCheqeID)
- **FK** `FK_ReceiveSubject_ReceiveReceipt` (ReceiveReceiptID) -> FIN.ReceiveReceipt (ReceiveReceiptID) on delete CASCADE
- **FK** `FK_ReceiveSubject_ReturnInvoice` (ReturnInvoiceID) -> VND.ReturnInvoice (ReturnInvoiceID)
- **FK** `FK_ReceiveSubject_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_ReceiveSubject_Quotation` (QuotationID) -> SLE.Quotation (QuotationID)
- **FK** `FK_ReceiveSubject_SaleContract` (SaleContractID) -> SLE.SaleContract (SaleContractID)
- **FK** `FK_ReceiveSubject_CardReaderSettlement` (CardReaderSettlementID) -> POS.CardReaderSettlement (CardReaderSettlementID)
- **FK** `FK_ReceiveSubject_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID)
- **FK** `FK_ReceiveSubject_ConfirmStatement` (ConfirmStatementID) -> CNT.ConfirmStatement (ConfirmStatementID)
- **FK** `FK_ReceiveSubject_ConfirmStatementItem` (ConfirmStatementItemID) -> CNT.ConfirmStatementItem (ConfirmStatementItemID)
- **FK** `FK_ReceiveSubject_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_ReceiveSubject_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID)
- **Referenced by:** CFG.DebitCreditNoteItem (ReceiveSubjectID); CNT.ConfirmStatementPrePayment (ReceiveSubjectID); NOC.CashDataCollection (ReceiveSubjectID); SLE.InvoicePreReceive (ReceiveSubjectID)

### FIN.ReconciledBillItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReconciledBillItemID | int | N |  | identity |
| 2 | ReconciliationID | int | N |  |  |
| 3 | BankBillItemID | int | N |  |  |
| 4 | Passed | bit | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Description | nvarchar(MAX) | Y |  |  |

- **Primary key:** ReconciledBillItemID
- **FK** `FK_ReconciledBillItem_BankBillItem` (BankBillItemID) -> FIN.BankBillItem (BankBillItemID)
- **FK** `FK_ReconciledBillItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReconciledBillItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReconciledBillItem_Reconciliation` (ReconciliationID) -> FIN.Reconciliation (ReconciliationID) on delete CASCADE

### FIN.ReconciledBookItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReconciledBookItemID | int | N |  | identity |
| 2 | ReconciliationID | int | N |  |  |
| 3 | EntityType | tinyint | N |  |  |
| 4 | EntityID | int | N |  |  |
| 5 | Number | varchar(250) | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | Deposite | decimal(30,4) | N |  |  |
| 8 | Withdraw | decimal(30,4) | N |  |  |
| 9 | Passed | bit | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Description | nvarchar(MAX) | Y |  |  |
| 16 | VoucherID | int | Y |  |  |
| 17 | PartyID | bigint | Y |  |  |

- **Primary key:** ReconciledBookItemID
- **FK** `FK_ReconciledBookItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReconciledBookItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReconciledBookItem_Reconciliation` (ReconciliationID) -> FIN.Reconciliation (ReconciliationID) on delete CASCADE

### FIN.Reconciliation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReconciliationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | BankAccountID | int | N |  |  |
| 6 | BankBillID | int | N |  |  |
| 7 | DateBased | bit | N |  |  |
| 8 | NumberBased | bit | N |  |  |
| 9 | AmountBased | bit | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ReconciliationID
- **FK** `FK_Reconciliation_BankAccount` (BankAccountID) -> CFG.BankAccount (BankAccountID)
- **FK** `FK_Reconciliation_BankBill` (BankBillID) -> FIN.BankBill (BankBillID)
- **FK** `FK_Reconciliation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Reconciliation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Reconciliation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.ReconciledBillItem (ReconciliationID); FIN.ReconciledBookItem (ReconciliationID)

## Views

### FIN.PaymentSubject_PriceRemains

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PaymentSubjectID | int | N |
| 2 | Amount | decimal(37,10) | Y |
| 3 | DoPrice | decimal(38,4) | Y |
| 4 | NonPrice | decimal(38,4) | Y |

### FIN.PettyCash_LastAmount

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PettyCashID | int | Y |
| 2 | LastAmount | decimal(38,4) | Y |

### FIN.PettyCashCostItem_Remain

Definition: `programmability/views/FIN.PettyCashCostItem_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PettyCashCostItemID | int | N |
| 2 | Amount | decimal(30,4) | N |
| 3 | Credits | decimal(38,4) | Y |
| 4 | remain | decimal(38,4) | Y |

### FIN.ReceiveSubject_PriceRemains

Definition: `programmability/views/FIN.ReceiveSubject_PriceRemains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReceiveSubjectID | int | N |
| 2 | Amount | decimal(37,10) | Y |
| 3 | DoPrice | decimal(38,4) | Y |
| 4 | NonPrice | decimal(38,4) | Y |

### FIN.VWAdvanceReceiveAndPayment

| # | Column | Type | Null |
|---|---|---|---|
| 1 | EntityType | int | N |
| 2 | EntityId | int | N |
| 3 | Number | int | N |
| 4 | Date | date | N |
| 5 | DLID | bigint | Y |
| 6 | RowIndex | int | N |
| 7 | Amount | decimal(36,10) | Y |
| 8 | NonPrice | decimal(38,4) | Y |
| 9 | CurrencyRate | decimal(20,10) | N |
| 10 | CurrencyID | int | N |
| 11 | DocumentName | varchar(15) | Y |
| 12 | DocumentNumber | varchar(150) | Y |
| 13 | ContractID | int | Y |
| 14 | PaymentType | tinyint | Y |
| 15 | ReceiptType | tinyint | Y |
| 16 | BranchID | int | N |
| 17 | IsCredit | int | N |
| 18 | PartyID | bigint | Y |

### FIN.vwbankaccount

Definition: `programmability/views/FIN.vwbankaccount.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BankAccountID | int | Y |
| 2 | Amount | decimal(38,4) | Y |
| 3 | Date | datetime | Y |
| 4 | CurrencyID | int | Y |
| 5 | BranchID | int | N |
| 6 | FinancialPeriodID | int | Y |

### FIN.vwbankaccount_Detail

Definition: `programmability/views/FIN.vwbankaccount_Detail.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BankAccountID | int | Y |
| 2 | Amount | decimal(38,4) | Y |
| 3 | Date | datetime | Y |
| 4 | CurrencyID | int | Y |
| 5 | BranchID | int | N |
| 6 | DocCode | int | N |
| 7 | HederID | int | Y |
| 8 | HederNumber | int | Y |
| 9 | Number | nvarchar(100) | Y |
| 10 | PartyID | bigint | Y |
| 11 | FinancialPeriodID | int | Y |
| 12 | ReferenceNumber | int | Y |
| 13 | VoucherDate | int | Y |
| 14 | PrevoucherID | int | Y |

### FIN.VWCash

Definition: `programmability/views/FIN.VWCash.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CashID | int | Y |
| 2 | Amount | decimal(38,10) | Y |
| 3 | Date | datetime | Y |
| 4 | CurrencyID | int | N |
| 5 | BranchID | int | Y |
| 6 | FinancialPeriodID | int | Y |

### FIN.vwLatestCashTransfers

Definition: `programmability/views/FIN.vwLatestCashTransfers.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CashTransferItemID | int | N |
| 2 | ReceivedCheqeID | int | N |
| 3 | Date | date | N |
| 4 | SourceCashID | int | N |
| 5 | TargetCashID | int | N |
| 6 | Type | tinyint | N |

### FIN.vwLatestCashTransfersStatus

Definition: `programmability/views/FIN.vwLatestCashTransfersStatus.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CashTransferItemID | int | N |
| 2 | ReceivedCheqeID | int | N |
| 3 | Date | date | N |
| 4 | SourceCashID | int | N |
| 5 | TargetCashID | int | N |
| 6 | Status | int | Y |

### FIN.VWLiquidityPerspective

Definition: `programmability/views/FIN.VWLiquidityPerspective.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Type | varchar(19) | N |
| 2 | Date | date | Y |
| 3 | Amount | decimal(38,4) | Y |
| 4 | DlCode | varchar(100) | N |
| 5 | DlTitle | nvarchar(256) | N |
| 6 | DlTitle2 | nvarchar(256) | N |
| 7 | BranchCode | int | N |
| 8 | BranchTitle | nvarchar(256) | N |
| 9 | BranchTitle2 | nvarchar(256) | N |
| 10 | BranchID | int | N |
| 11 | Number | varchar(1024) | Y |
| 12 | FinancialPeriodID | int | N |

### FIN.vwPartyDebit

Definition: `programmability/views/FIN.vwPartyDebit.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Id | int | N |
| 2 | ItemType | int | N |
| 3 | Title | nvarchar(1054) | Y |
| 4 | PartyID | bigint | Y |
| 5 | Amount | decimal(30,4) | N |
| 6 | Date | date | N |
| 7 | PaymentTypeID | int | Y |
| 8 | BranchID | int | N |
| 9 | CurrencyID | int | N |

### FIN.VWPettyCash

Definition: `programmability/views/FIN.VWPettyCash.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PettyCashID | int | Y |
| 2 | Amount | decimal(36,10) | Y |
| 3 | Date | date | Y |
| 4 | CurrencyID | int | Y |
| 5 | BranchID | int | N |
| 6 | FinancialPeriodID | int | Y |
| 7 | BankAccountID | int | Y |

### FIN.VWReceiveAndPaymentSubjectDlTypes

Definition: `programmability/views/FIN.VWReceiveAndPaymentSubjectDlTypes.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Type | varchar(7) | N |
| 2 | SubjectID | int | N |
| 3 | Code | varchar(100) | N |
| 4 | Title | nvarchar(256) | N |
| 5 | Title2 | nvarchar(256) | N |
| 6 | DlID | bigint | N |
| 7 | DlTypeID | int | N |

### FIN.vwReceivedCheque

Definition: `programmability/views/FIN.vwReceivedCheque.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PartyID | bigint | N |
| 2 | PartyFullName | nvarchar(513) | N |
| 3 | DlID | bigint | Y |
| 4 | LastState | tinyint | N |
| 5 | LastFlow | int | Y |
| 6 | Number | nvarchar(100) | N |
| 7 | CashID | int | N |
| 8 | BankID | int | N |
| 9 | ReceivedCheqeID | int | N |
| 10 | Date | date | N |
| 11 | ReceiveDate | date | N |
| 12 | CurrencyID | int | N |
| 13 | CurrencyRate | decimal(20,10) | N |
| 14 | Amount | decimal(30,4) | N |
| 15 | BranchID | int | N |
| 16 | ReceiveReceiptID | int | N |
| 17 | BankBranchCode | nvarchar(100) | Y |
| 18 | BankBranchName | nvarchar(250) | Y |
| 19 | AccountNumber | nvarchar(100) | N |
| 20 | Commercial | bit | N |
| 21 | ChequeSource | varchar(9) | N |
| 22 | Status | tinyint | N |

### FIN.VWResourcesConsumption

Definition: `programmability/views/FIN.VWResourcesConsumption.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocumentType | varchar(17) | N |
| 2 | DocumentID | int | N |
| 3 | DocumentEngName | varchar(20) | Y |
| 4 | Date | date | N |
| 5 | AmountInBaseCurrency | decimal(38,6) | Y |
| 6 | Amount | decimal(38,10) | Y |
| 7 | CurrencyID | int | N |
| 8 | DlCode | varchar(100) | Y |
| 9 | DlTitle | nvarchar(256) | Y |
| 10 | DlTitle2 | nvarchar(256) | Y |
| 11 | BranchID | int | N |
| 12 | BankOrCashTitle | nvarchar(256) | Y |
| 13 | BankOrCashTitle2 | nvarchar(256) | Y |
| 14 | Type | varchar(7) | N |
| 15 | SubjectID | int | Y |
| 16 | SubjectTypeID | int | Y |
| 17 | SubjectType | nvarchar(2048) | Y |
| 18 | SubjectTitle | nvarchar(250) | Y |
| 19 | SubjectTitle2 | nvarchar(250) | Y |
| 20 | FinancialPeriodID | int | N |
| 21 | Description | nvarchar(MAX) | Y |
| 22 | Description2 | nvarchar(MAX) | Y |
| 23 | CashStructureID | int | Y |
| 24 | CashID | int | Y |
| 25 | BankAccountID | int | Y |
| 26 | PettyCashID | int | Y |

