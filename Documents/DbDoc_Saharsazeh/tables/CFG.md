# Schema `CFG`

## Tables

### CFG.ActivityArea

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityAreaID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(MAX) | N |  |  |
| 4 | Title2 | nvarchar(MAX) | N |  |  |
| 5 | IsActive | bit | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ActivityAreaID
- **FK** `FK_ActivityArea_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ActivityArea_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.Address

Rows: 922

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AddressID | int | N |  | identity |
| 2 | PartyID | bigint | N |  | ارجاع به جدول party |
| 3 | LocationID | int | N |  | ارجاع به جدول شهر |
| 4 | Address | nvarchar(256) | N |  |  |
| 5 | ZipCode | nvarchar(256) | Y |  |  |
| 6 | IsMain | bit | N |  | آدرس اصلي |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | AddressTypeID | int | N |  |  |
| 13 | Address2 | nvarchar(256) | N |  |  |

- **Primary key:** AddressID
- **FK** `FK_Address_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Address_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Address_Location` (LocationID) -> CFG.Location (LocationID)
- **FK** `FK_Address_Party` (PartyID) -> CFG.Party (PartyID) on delete CASCADE
- **FK** `FK_Address_AddressType` (AddressTypeID) -> CFG.AddressType (AddressTypeID)
- **Referenced by:** CTM.Order (AddressID); CTM.Reception (AddressID); SLE.Invoice (AddressID); SLE.Justification (AddressID); SLE.Quotation (AddressID); SLE.Remittance (AddressID)

### CFG.AddressType

Rows: 4 | نوع آدرس-تلفن

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AddressTypeID | int | N |  | identity |
| 2 | Type | tinyint | N |  |  |
| 3 | Title | nvarchar(100) | N |  |  |
| 4 | Title2 | nvarchar(100) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Nature | tinyint | Y |  |  |

- **Primary key:** AddressTypeID
- **unique index** `IX_Type_Title` (Type, Title)
- **unique index** `IX_Type_Title2` (Type, Title2)
- **FK** `FK_AddressType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AddressType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.Address (AddressTypeID); CFG.Phone (AddressTypeID)

### CFG.Backup

Rows: 45 | فایل پشتیبان

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BackupID | int | N |  | identity |
| 2 | Date | datetime | N |  |  |
| 3 | Path | nvarchar(MAX) | N |  | مسير فايل پشتيبان |
| 4 | Filename | nvarchar(MAX) | N |  | نام فايل |
| 5 | RestoreDate | datetime | Y |  | آخرين تاريخ بازيابي فايل |
| 6 | IsSystemBackup | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** BackupID
- **FK** `FK_Backup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Backup_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.Bank

Rows: 35 | بانک

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Name | nvarchar(255) | Y |  |  |

- **Primary key:** BankID
- **unique index** `IX_Bank` (Title)
- **FK** `FK_Bank_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Bank_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.BankBranch (BankID); CFG.PartyAccount (BankID); FIN.ReceiveCheqeCommitment (BankID); FIN.ReceivedCheqe (BankID); FIN.ReceiveGuarantyCommitment (BankID); PAY.PayrollFile (BankID); POS.PosReceiptItem (BankID)

### CFG.BankAccount

Rows: 27 | حساب بانکی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankAccountID | int | N |  | identity |
| 2 | BankBranchID | int | N |  | شناسه شعبه – مرتبط با جدول BankBranch |
| 3 | AccountNo | nvarchar(50) | N |  | شماره حساب |
| 4 | BankAccountTypeID | int | N |  | شناسه نوع حساب – مرتبط با جدول AccountType |
| 5 | DlID | bigint | N |  | شناسه کد تفصیلی – مرتبط با جدول DL |
| 6 | CurrencyID | int | N |  | شناسه ارز – مرتبط با جدول Currency |
| 7 | CurrencyRate | decimal(20,10) | N |  | نرخ ارز |
| 8 | FirstAmount | decimal(30,4) | N |  | موجودي ابتداي دوره |
| 9 | IsActive | bit | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  | تاريخ تعريف حساب بانکي |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | FirstDate | datetime | N |  | تاریخ افتتاح |
| 16 | BankAccountOwner | nvarchar(256) | Y |  |  |
| 17 | SLID | int | N |  |  |
| 18 | WageSLID | int | Y |  |  |
| 19 | CompanyID | int | N | ((-1)) |  |
| 20 | NegativeStoreControl | bit | N |  |  |

- **Primary key:** BankAccountID
- **unique index** `IX_BankBranchAndAccountNo` (BankBranchID, AccountNo)
- **FK** `FK_BankAccount_Company` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_BankAccount_Dl` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_BankAccount_BankAccountType` (BankAccountTypeID) -> CFG.BankAccountType (BankAccountTypeID)
- **FK** `FK_BankAccount_BankBranch` (BankBranchID) -> CFG.BankBranch (BankBranchID)
- **FK** `FK_BankAccount_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankAccount_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_BankAccount_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BankAccount_SL` (SLID) -> ACC.SL (SlID)
- **FK** `FK_BankAccount_WageSL` (WageSLID) -> ACC.SL (SlID)
- **Referenced by:** FIN.BankBill (BankAccountID); FIN.Book (BankAccountID); FIN.CheqeBook (BankAccountID); FIN.GuarantyOperation (BankAccountID); FIN.PaymentBankDraft (BankAccountID); FIN.PaymentCheqe (BankAccountID); FIN.PaymentCheqeCommitment (BankAccountID); FIN.PaymentCheqeFlow (BankAccountID); FIN.PaymentGuarantyCommitment (BankAccountID); FIN.PettyCash (BankAccountID); FIN.ReceiptCheqeFlow (BankAccountID); FIN.ReceivedBankDraft (BankAccountID); FIN.Reconciliation (BankAccountID); POS.CardReader (BankAccountID); POS.PosReceiptItem (BankAccountID); REQ.PaymentOrder (BankAccountID); REQ.PaymentOrderItem (BankAccountID)

### CFG.BankAccountType

Rows: 13 | نوع حساب بانکی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankAccountTypeID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | Y |  |  |
| 4 | HasChequeBook | bit | N |  |  |
| 5 | Creator | int | N |  | تاريخ تعريف نوع حساب  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** BankAccountTypeID
- **FK** `FK_BankAccountType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankAccountType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.BankAccount (BankAccountTypeID); HRM.PersonelAccount (BankAccountTypeID)

### CFG.BankBranch

Rows: 11 | شعبه بانک

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BankBranchID | int | N |  | identity |
| 2 | BankID | int | N |  | شناسه بانک – مرتبط با جدول Bank |
| 3 | Code | int | N |  | کد شعبه |
| 4 | Title | nvarchar(256) | N |  | عنوان شعبه |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | LocationID | int | Y |  | شناسه شهر – مرتبط با جدول Location |
| 7 | Creator | int | N |  | تعريف کننده شعبه |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** BankBranchID
- **unique index** `IX_BankBranch` (BankID, Title)
- **FK** `FK_BankBranch_Bank` (BankID) -> CFG.Bank (BankID) on delete CASCADE
- **FK** `FK_BankBranch_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_BankBranch_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_BankBranch_Location` (LocationID) -> CFG.Location (LocationID)
- **Referenced by:** CFG.BankAccount (BankBranchID); HRM.PersonelAccount (BankBranchID); PAY.PayPreparing (BankBranchID)

### CFG.Branch

Rows: 10 | شعبه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | BranchID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Address | nvarchar(256) | Y |  |  |
| 5 | Phone | nvarchar(256) | Y |  |  |
| 6 | Fax | nvarchar(256) | Y |  |  |
| 7 | Supervisor | nvarchar(256) | Y |  |  |
| 8 | IsActive | bit | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Title2 | nvarchar(256) | N |  |  |
| 11 | Address2 | nvarchar(256) | Y |  |  |
| 12 | Supervisor2 | nvarchar(256) | Y |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | PostalCode | nvarchar(50) | Y |  |  |
| 18 | CompanyID | int | Y |  |  |

- **Primary key:** BranchID
- **unique index** `IX_Branch` (Title)
- **FK** `FK_Branch_CompanyID` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_Branch_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Branch_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccCurrencyExchange (BranchID); ACC.PreVoucher (BranchID); ACC.Voucher (BranchID); AST.Adjustment (BranchID); AST.Asset (BranchID); AST.AssetClosingOperation (BranchID); AST.AssetReceipt (BranchID); AST.ChangeCategory (BranchID); AST.ChangePosition (BranchID); AST.Creation (BranchID); AST.DepreciationCalculation (BranchID); AST.Destruction (BranchID); AST.Insurance (BranchID); AST.ReceivedFromBranch (DestinationBranchID); AST.ReceivedFromBranch (SourceBranchID); AST.Revaluation (BranchID); AST.Sale (BranchID); AST.Salvage (BranchID); AST.Transfer (DestinationBranchID); AST.Transfer (SourceBranchID); CFG.DebitCreditNote (BranchID); CFG.InstallmentPayment (BranchID); CFG.ManualReceipt (BranchID); CFG.NumberingPatternItem (BranchID); CNT.Contract (BranchID); CTM.Order (BranchID); CTM.Reception (BranchID); FIN.CashTransfer (BranchID); FIN.GuarantyOperation (BranchID); FIN.PaymentCheqeFlow (BranchID); FIN.PaymentCommitment (BranchID); FIN.PaymentCommitmentRecall (BranchID); FIN.PaymentReceipt (BranchID); FIN.PettyCashCharging (BranchID); FIN.PettyCashCost (BranchID); FIN.ReceiptCheqeFlow (BranchID); FIN.ReceiveCommitment (BranchID); FIN.ReceiveCommitmentRecall (BranchID); FIN.ReceiveReceipt (BranchID); FOS.BillOfLading (BranchID); FOS.Clearance (BranchID); FOS.CostOfOrder (BranchID); FOS.LetterCredit (BranchID); FOS.OrderPricing (BranchID); FOS.ProformaInvoice (BranchID); FOS.Registration (BranchID); FOS.ShippingInsurance (BranchID); HRM.Agreement (BranchID); PAY.PayPreparing (BranchID); POS.Station (BranchID); REQ.PaymentOrder (BranchID); REQ.PaymentRequest (BranchID); REQ.PurchaseRequest (BranchID); REQ.ReceiveRequest (BranchID); REQ.ReturnRequest (BranchID); REQ.ServiceRequest (BranchID); REQ.StuffRequest (BranchID); REQ.TenderRequest (BranchID); SLE.Invoice (BranchID); SLE.InvoiceCorrection (BranchID); SLE.Justification (BranchID); SLE.Quotation (BranchID); SLE.Remittance (BranchID); SLE.ReturnedSaleInvoice (BranchID); SLE.ReturnedSaleJustification (BranchID); SLE.SaleContract (BranchID); STC.RevisionCost (BranchID); STF.Stock (BranchID); VND.DeliveryJustification (BranchID); VND.InqueryPermission (BranchID); VND.Proposal (BranchID); VND.ProposalCommission (BranchID); VND.PurchaseContract (BranchID); VND.PurchaseInvoice (BranchID); VND.PurchasePlanning (BranchID); VND.ReturnInvoice (BranchID)

### CFG.Cash

Rows: 5 | صندوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | DlID | bigint | N |  |  |
| 11 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** CashID
- **unique index** `IX_Cash` (Title)
- **FK** `FK_Cash_Company` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_Cash_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Cash_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_Cash_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.CashBalance (CashID); FIN.CashTransfer (SourceCashID); FIN.CashTransfer (TargetCashID); FIN.PaymentCash (CashID); FIN.PaymentCommitmentRecall (CashID); FIN.ReceiptCheqeFlow (CashID); FIN.ReceiveCommitment (CashID); FIN.ReceivedCash (CashID); FIN.ReceivedCheqe (CashID); POS.DeliverCheque (CashID); POS.PosReceiptItem (CashID); POS.StationCash (CashID)

### CFG.CashBalance

Rows: 4 | موجودی صندوق

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CashBalanceID | int | N |  | identity |
| 2 | CashID | int | N |  |  |
| 3 | CurrencyID | int | N |  |  |
| 4 | FirstAmount | decimal(30,4) | N |  |  |
| 5 | CurrencyRate | decimal(20,10) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | SLID | int | N |  |  |

- **Primary key:** CashBalanceID
- **FK** `FK_CashBalance_Cash` (CashID) -> CFG.Cash (CashID) on delete CASCADE
- **FK** `FK_CashBalance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CashBalance_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_CashBalance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CashBalance_SL` (SLID) -> ACC.SL (SlID)

### CFG.Comment

Rows: 64

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CommentID | int | N |  | identity |
| 2 | DocumentName | nvarchar(250) | N |  |  |
| 3 | DocumentID | bigint | N |  |  |
| 4 | Description | nvarchar(MAX) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CommentID
- **FK** `FK_WorkComment_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_WorkComment_CreatorUser` (Creator) -> CFG.User (UserID)

### CFG.Company

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CompanyID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | RegistrationNumber | nvarchar(100) | Y |  |  |
| 6 | NationalId | nvarchar(100) | Y |  |  |
| 7 | EconomicCode | nvarchar(100) | Y |  |  |
| 8 | Email | nvarchar(256) | Y |  |  |
| 9 | WebSite | nvarchar(256) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | HoldingStructureID | int | Y |  |  |
| 16 | Type | tinyint | N |  |  |
| 17 | DefaultSettellment | tinyint | N | ((3)) |  |
| 18 | IsNumberingBasedOnStock | bit | N | ((0)) |  |

- **Primary key:** CompanyID
- **FK** `FK_Company_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Company_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Company_HoldingStructureID` (HoldingStructureID) -> CFG.HoldingStructure (HoldingStructureID)
- **Referenced by:** CFG.BankAccount (CompanyID); CFG.Branch (CompanyID); CFG.Cash (CompanyID); CFG.CompanyImage (CompanyID); CFG.CompanyTaxData (CompanyID); CFG.CompanyVatItem (CompanyID); CFG.NumberingPattern (CompanyID); CFG.SeasonFile (CompanyID); CFG.TaxLedger (CompanyID); CFG.Vat (CompanyID); HRM.FlowChart (CompanyID); HRM.OrganizationItem (CompanyID); HRM.Personel (CompanyID)

### CFG.CompanyImage

Rows: 2 | تصویر شرکت

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CompanyImageID | int | N |  | identity |
| 2 | Image | image | Y |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | CompanyID | int | Y |  |  |
| 9 | FileType | int | Y |  |  |

- **Primary key:** CompanyImageID
- **FK** `FK_CompanyImage_CompanyID` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_CompanyImage_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CompanyImage_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.CompanyTaxData

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CompanyTaxDataID | int | N |  | identity |
| 2 | CompanyID | int | N |  |  |
| 3 | Name | nvarchar(512) | N |  |  |
| 4 | Country | nvarchar(512) | Y |  |  |
| 5 | CompanyType | nvarchar(128) | N |  |  |
| 6 | CSRKey | nvarchar(MAX) | Y |  |  |
| 7 | CSRPrivateKey | nvarchar(MAX) | Y |  |  |
| 8 | CSRPublicKey | nvarchar(MAX) | Y |  |  |
| 9 | UniqueTaxID | nvarchar(1024) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** CompanyTaxDataID
- **FK** `FK_CompanyTaxData_Company` (CompanyID) -> CFG.Company (CompanyID)
- **FK** `FK_CompanyTaxData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CompanyTaxData_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.CompanyVatItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CompanyVatItemID | int | N |  | identity |
| 2 | CompanyID | int | N |  |  |
| 3 | VatRate | decimal(4,2) | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **FK** `FK_CompanyVatItem_CompanyID` (CompanyID) -> CFG.Company (CompanyID) on delete CASCADE
- **FK** `FK_CompanyVatItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CompanyVatItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.Concept

Rows: 70 | مفهوم انتقال اطلاعات

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConceptID | int | N |  | identity |
| 2 | SaturnModuleID | int | Y |  |  |
| 3 | Title | nvarchar(128) | N |  |  |
| 4 | Title2 | nvarchar(128) | N |  |  |
| 5 | EngName | nvarchar(128) | Y |  |  |
| 6 | ConceptType | tinyint | N |  |  |
| 7 | XmlContent | xml | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ConceptID
- **FK** `FK_Concept_SaturnModule` (SaturnModuleID) -> CFG.SaturnModule (SaturnModuleID)

### CFG.Configuration

Rows: 184 | تنظیمات سیستم

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  |  |
| 2 | ConfigKey | varchar(50) | N |  |  |
| 3 | ConfigValue | nvarchar(MAX) | Y |  |  |
| 4 | ConfigType | tinyint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ID
- **FK** `FK_Configuration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Configuration_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.CostCenter

Rows: 10 | مرکز هزینه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CostCenterID | int | N |  | identity |
| 2 | CostCenterType | tinyint | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | DlID | bigint | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CostCenterID
- **unique index** `IX_CostCenter` (Title)
- **FK** `FK_CostCenter_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CostCenter_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CostCenter_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **Referenced by:** HRM.Agreement (CostCenterID); PRM.ConsumptionStatistic (CostCenterId); PRM.PlanningItem (CostCenterId); PRM.ProductionAnalysisItem (CostCenterId); PRM.ProductionDelivery (CostCenterId); PRM.ProductionDelivery (DeliverCostCenterId); PRM.ProductionPlanningItem (CostCenterId); PRM.ProductionStatistic (CostCenterId); PRM.ProductionTiming (CostCenterId); PRM.RequiredMaterialCostCenter (CostCenterID); PRM.Rework (CostCenterId); PRM.Rework (DeliverToCostCenterId); PRM.SpoilageStatistic (CostCenterId); PRM.StandardConsumption (CostCenterID); PRM.WorkingInventory (CostCenterId); PRM.WorkStation (CostCenterID); SLE.SaleArea (CostCenterID)

### CFG.CultureInfo

Rows: 1 | اطلاعات Culture

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CultureInfoID | smallint | N |  | identity |
| 2 | Culture | varchar(25) | N |  |  |
| 3 | CultureNo | tinyint | N |  |  |

- **Primary key:** CultureInfoID

### CFG.Currency

Rows: 1 | ارز

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CurrencyID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | PrecisionCount | smallint | N | ((0)) |  |
| 5 | PrecisionTitle | nvarchar(256) | Y |  |  |
| 6 | PrecisionTitle2 | nvarchar(256) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | IsBaseCurrencyBasis | bit | N | ((0)) |  |
| 13 | ExchangeUnit | decimal(8,2) | N | ((1)) |  |
| 14 | Code | varchar(50) | Y |  |  |

- **Primary key:** CurrencyID
- **unique index** `IX_Currency` (Title)
- **FK** `FK_Currency_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Currency_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.AccCurrencyExchange (CurrencyID); ACC.PreVoucherItem (CurrencyID); ACC.VoucherItem (CurrencyID); CFG.BankAccount (CurrencyID); CFG.CashBalance (CurrencyID); CFG.CurrencyRate (CurrencyID); CFG.DebitCreditNoteItem (CurrencyID); CFG.InstallmentPayment (CurrencyID); CFG.ManualReceipt (CurrencyID); CNT.ContractStatement (CurrencyID); CNT.ContractStatementAnalysis (CurrencyID); CNT.ContractSubject (CurrencyID); FIN.PaymentBankDraft (CurrencyID); FIN.PaymentCash (CurrencyID); FIN.PaymentCheqe (CurrencyID); FIN.PaymentCheqeCommitment (CurrencyID); FIN.PaymentGuarantyCommitment (CurrencyID); FIN.PaymentPromissoryCommitment (CurrencyID); FIN.PaymentSubject (BaseDocumentCurrencyID); FIN.PaymentSubject (CurrencyID); FIN.PettyCash (CurrencyID); FIN.ReceiveCheqeCommitment (CurrencyID); FIN.ReceivedBankDraft (CurrencyID); FIN.ReceivedCash (CurrencyID); FIN.ReceivedCheqe (CurrencyID); FIN.ReceiveGuarantyCommitment (CurrencyID); FIN.ReceivePromissoryCommitment (CurrencyID); FIN.ReceiveSubject (CurrencyID); FOS.CostOfOrderItem (CurrencyID); FOS.ProformaInvoice (CurrencyID); FOS.ShippingInsurance (CurrencyID); POS.PosReceiptItem (CurrencyID); REQ.PaymentOrder (PaymentCurrencyID); REQ.PaymentOrderItem (BaseCurrencyID); REQ.PaymentRequestItem (CurrencyID); REQ.ReceiveRequest (CurrencyID); SLE.CustomerOpeningBalance (CurrencyID); SLE.DiscountModel (CurrencyID); SLE.Invoice (CurrencyID); SLE.Justification (CurrencyID); SLE.PercentagePriceList (CurrencyID); SLE.PriceList (CurrencyID); SLE.PricingCalculation (CurrencyID); SLE.Quotation (CurrencyID); SLE.ReturnedSaleInvoice (CurrencyID); SLE.ReturnedSaleJustification (CurrencyID); SLE.SaleContract (CurrencyID); VND.DocumentVerificationPath (CurrencyID); VND.Proposal (CurrencyID); VND.PurchaseContract (CurrencyID); VND.PurchaseInvoice (CurrencyID); VND.PurchasePlanning (CurrencyID); VND.ReturnInvoice (CurrencyID); VND.VendorOpeningBalance (CurrencyID)

### CFG.CurrencyRate

Rows: 0 | نرخ ارز

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CurrencyRateID | int | N |  | identity |
| 2 | CurrencyID | int | N |  |  |
| 3 | Rate | decimal(36,10) | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** CurrencyRateID
- **FK** `FK_CurrencyRate_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CurrencyRate_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_CurrencyRate_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.CustomAction

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CustomActionID | int | N |  | identity |
| 2 | EntityName | varchar(150) | N |  |  |
| 3 | Title | nvarchar(MAX) | N |  |  |
| 4 | Title2 | nvarchar(MAX) | N |  |  |
| 5 | SystemName | nvarchar(250) | N |  |  |
| 6 | UserDefinedActionStatus | tinyint | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CustomActionID
- **FK** `FK_CustomAction_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CustomAction_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.Customs

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CustomsID | int | N |  | identity |
| 2 | Code | nvarchar(100) | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** CustomsID
- **unique index** `IX_Customs_Code` (Code)
- **unique index** `IX_Customs_PartyID` (PartyID)
- **FK** `FK_Customs_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Customs_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Customs_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FOS.Clearance (AssessmentCustomsID); FOS.Clearance (EntranceCustomsID)

### CFG.DbMigration

Rows: 350

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MigrationNumber | int | N |  |  |
| 2 | Date | datetime | N | (getdate()) |  |
| 3 | HotfixNumber | int | N | ((0)) |  |
| 4 | UniqueCode | nvarchar(16) | Y |  |  |
| 5 | Timespan | bigint | Y |  |  |
| 6 | Name | nvarchar(256) | Y |  |  |
| 7 | Revision | int | Y |  |  |
| 8 | Author | nvarchar(256) | Y |  |  |

- **unique index** `UX_DbMigration_UniqueCode` (UniqueCode) where ([UniqueCode] IS NOT NULL)

### CFG.DbSchema

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SchemaID | int | N |  |  |
| 2 | SchemaVersion | nchar(15) | Y |  |  |
| 3 | SaturnVersion | nchar(15) | Y |  |  |
| 4 | VersionDate | date | Y |  |  |

- **Primary key:** SchemaID

### CFG.DebitCreditNote

Rows: 862

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DebitCreditNoteID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | PreVoucherID | int | Y |  |  |
| 5 | FinancialPeriodID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | BranchID | int | N | ((-1)) |  |
| 12 | Description | nvarchar(MAX) | Y |  |  |
| 13 | Description2 | nvarchar(MAX) | Y |  |  |

- **Primary key:** DebitCreditNoteID
- **FK** `FK_DebitCreditNote_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_DebitCreditNote_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DebitCreditNote_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_DebitCreditNote_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DebitCreditNote_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** CFG.DebitCreditNoteItem (DebitCreditNoteID)

### CFG.DebitCreditNoteItem

Rows: 3186

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DebitCreditNoteItemID | int | N |  | identity |
| 2 | DebitCreditNoteID | int | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | RowIndex | int | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | CurrencyID | int | N |  |  |
| 8 | CurrencyRate | decimal(20,10) | N |  |  |
| 9 | Amount | decimal(30,4) | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | ReceiptTypeID | int | Y |  |  |
| 16 | PaymentTypeID | int | Y |  |  |
| 17 | Discount | decimal(30,4) | N | ((0)) |  |
| 18 | PettyCashCostItemID | int | Y |  |  |
| 19 | SaleContractID | int | Y |  |  |
| 20 | QuotationID | int | Y |  |  |
| 21 | InvoiceID | int | Y |  |  |
| 22 | ReturnInvoiceID | int | Y |  |  |
| 23 | PaymentSubjectID | int | Y |  |  |
| 24 | ReceiveSubjectID | int | Y |  |  |
| 25 | DebitCreditID | int | Y |  |  |
| 26 | PurchaseInvoiceID | int | Y |  |  |
| 27 | ReturnedSaleInvoiceID | int | Y |  |  |
| 28 | InstallmentPaymentItemID | int | Y |  |  |
| 29 | PurchaseContractID | int | Y |  |  |
| 30 | ProposalID | int | Y |  |  |
| 31 | CalculationResultID | decimal(18,0) | Y |  |  |
| 32 | PartyID | bigint | Y |  |  |
| 33 | ProformaInvoiceID | int | Y |  |  |
| 34 | ConfirmStatementID | int | Y |  |  |
| 35 | ConfirmStatementItemID | int | Y |  |  |
| 36 | ContractID | int | Y |  |  |
| 37 | ContractStatementID | int | Y |  |  |
| 38 | PettyCashID | int | Y |  |  |
| 39 | Allocation | decimal(36,10) | N | ((0)) |  |
| 40 | ConfirmPurchaseInvoiceID | int | Y |  |  |
| 41 | ConfirmPurchaseInvoiceItemID | int | Y |  |  |
| 42 | PayPreparingID | int | Y |  |  |

- **Primary key:** DebitCreditNoteItemID
- **FK** `FK_DebitCreditNoteItem_PettyCash` (PettyCashID) -> FIN.PettyCash (PettyCashID)
- **FK** `FK_DebitCreditNoteItem_CalculationResult` (CalculationResultID) -> PAY.CalculationResult (CalculationResultID)
- **FK** `FK_DebitCreditNoteItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DebitCreditNoteItem_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_DebitCreditNoteItem_DebitCredit` (DebitCreditID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_DebitCreditNoteItem_DebitCreditNote` (DebitCreditNoteID) -> CFG.DebitCreditNote (DebitCreditNoteID) on delete CASCADE
- **FK** `FK_DebitCreditNoteItem_InstallmentPaymentItem` (InstallmentPaymentItemID) -> CFG.InstallmentPaymentItem (InstallmentPaymentItemID)
- **FK** `FK_DebitCreditNoteItem_Invoice` (InvoiceID) -> SLE.Invoice (InvoiceID)
- **FK** `FK_DebitCreditNoteItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DebitCreditNoteItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_DebitCreditNoteItem_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)
- **FK** `FK_DebitCreditNoteItem_PaymentType` (PaymentTypeID) -> FIN.PaymentType (PaymentTypeID)
- **FK** `FK_DebitCreditNoteItem_ConfirmPurchaseInvoiceItemID` (ConfirmPurchaseInvoiceItemID) -> VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceItemID)
- **FK** `FK_DebitCreditNoteItem_PettyCashCostItem` (PettyCashCostItemID) -> FIN.PettyCashCostItem (PettyCashCostItemID)
- **FK** `FK_DebitCreditNoteItem_Proposal` (ProposalID) -> VND.Proposal (ProposalID)
- **FK** `FK_DebitCreditNoteItem_PurchaseContract` (PurchaseContractID) -> VND.PurchaseContract (PurchaseContractID)
- **FK** `FK_DebitCreditNoteItem_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_DebitCreditNoteItem_Quotation` (QuotationID) -> SLE.Quotation (QuotationID)
- **FK** `FK_DebitCreditNoteItem_ReceiptType` (ReceiptTypeID) -> FIN.ReceiptType (ReceiptTypeID)
- **FK** `FK_DebitCreditNoteItem_ReceiveSubject` (ReceiveSubjectID) -> FIN.ReceiveSubject (ReceiveSubjectID)
- **FK** `FK_DebitCreditNoteItem_ReturnedSaleInvoice` (ReturnedSaleInvoiceID) -> SLE.ReturnedSaleInvoice (ReturnedSaleInvoiceID)
- **FK** `FK_DebitCreditNoteItem_ReturnInvoice` (ReturnInvoiceID) -> VND.ReturnInvoice (ReturnInvoiceID)
- **FK** `FK_DebitCreditNoteItem_SaleContract` (SaleContractID) -> SLE.SaleContract (SaleContractID)
- **FK** `FK_DebitCreditNoteItem_PayPreparing` (PayPreparingID) -> PAY.PayPreparing (PayPreparingID)
- **FK** `Fk_DebitCreditNoteItem_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID)
- **FK** `FK_DebitCreditNoteItem_ProformaInvoice` (ProformaInvoiceID) -> FOS.ProformaInvoice (ProformaInvoiceID)
- **FK** `FK_DebitCreditNoteItem_ConfirmStatement` (ConfirmStatementID) -> CNT.ConfirmStatement (ConfirmStatementID)
- **FK** `FK_DebitCreditNoteItem_ConfirmStatementItem` (ConfirmStatementItemID) -> CNT.ConfirmStatementItem (ConfirmStatementItemID)
- **FK** `FK_DebitCreditNoteItem_Contract` (ContractID) -> CNT.Contract (ContractID)
- **FK** `FK_DebitCreditNoteItem_ContractStatement` (ContractStatementID) -> CNT.ContractStatement (ContractStatementID)
- **Referenced by:** CFG.DebitCreditNoteItem (DebitCreditID); CNT.ConfirmStatementPrePayment (DebitCreditNoteItemID); NOC.CashDataCollection (DebitCreditNoteItemID); PAY.ParameterMonthlyData (DebitCreditNoteItemID); SLE.InvoicePreReceive (DebitCreditNoteItemID); VND.ConfirmPurchaseInvoiceAdvancePayment (DebitCreditNoteItemID); VND.PurchaseInvoicePrePayment (DebitCreditNoteItemID)

### CFG.DeleteVoucherLog

Rows: 258

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherID | int | Y |  |  |
| 2 | UserID | int | Y |  |  |
| 3 | UserName | nvarchar(250) | Y |  |  |
| 4 | DeleteDate | nvarchar(250) | Y |  |  |


### CFG.DimDate

Rows: 16436 | اطلاعات تاریخ

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Date | date | N |  |  |
| 2 | FullDateAlternateKey | nvarchar(10) | N |  |  |
| 3 | CalendarYear | smallint | N |  |  |
| 4 | MonthNumberOfYear | tinyint | N |  |  |
| 5 | MonthName | nvarchar(10) | N |  |  |
| 6 | DayOfWeek | smallint | N |  |  |
| 7 | DayOfWeekName | nvarchar(30) | N |  |  |
| 8 | CalendarSeason | tinyint | N |  |  |
| 9 | SeasonName | nvarchar(10) | Y |  |  |
| 10 | PersianDateKey | int | N |  |  |
| 11 | PersianFullDateAlternateKey | nvarchar(10) | N |  |  |
| 12 | PersianCalendarYear | smallint | N |  |  |
| 13 | PersianMonthNumberOfYear | tinyint | N |  |  |
| 14 | PersianMonthName | nvarchar(10) | N |  |  |
| 15 | PersianDayOfWeek | smallint | N |  |  |
| 16 | PersianDayOfWeekName | nvarchar(30) | N |  |  |
| 17 | PersianCalendarSeason | tinyint | N |  |  |
| 18 | PersianSeasonName | nvarchar(10) | Y |  |  |
| 19 | DateId | int | N |  | identity |

- **Primary key:** Date
- **Referenced by:** APS.DimSaleItem (Date)

### CFG.DocumentNum

Rows: 441 | شماره گذاری سند

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentNumID | int | N |  | identity |
| 2 | DocumentNumTypeID | smallint | N |  |  |
| 3 | StartNum | int | N |  |  |
| 4 | EndNum | int | Y |  |  |
| 5 | CanNumManually | bit | N |  |  |
| 6 | FinancialPeriodID | int | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DocumentNumID
- **index** `IX_DocumentNum` (FinancialPeriodID, DocumentNumTypeID)
- **FK** `FK_DocumentNum_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentNum_DocumentNumType` (DocumentNumTypeID) -> CFG.DocumentNumType (DocumentNumTypeID)
- **FK** `FK_DocumentNum_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID) on delete CASCADE
- **FK** `FK_DocumentNum_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.DocumentNumResetNumberBase (DocumentNumID)

### CFG.DocumentNumResetNumberBase

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentNumResetNumberBaseID | int | N |  | identity |
| 2 | DocumentNumID | int | N |  |  |
| 3 | DocumentNumResetNumberBaseTypeID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DocumentNumResetNumberBaseID
- **unique index** `IX_DocumentNumResetNumberBase` (DocumentNumID, DocumentNumResetNumberBaseTypeID)
- **FK** `FK_DocumentNumResetNumberBase_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentNumResetNumberBase_DocumentNum` (DocumentNumID) -> CFG.DocumentNum (DocumentNumID) on delete CASCADE
- **FK** `FK_DocumentNumResetNumberBase_DocumentNumResetNumberBaseType` (DocumentNumResetNumberBaseTypeID) -> CFG.DocumentNumResetNumberBaseType (DocumentNumResetNumberBaseTypeID)
- **FK** `FK_DocumentNumResetNumberBase_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.DocumentNumResetNumberBaseType

Rows: 11

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentNumResetNumberBaseTypeID | int | N |  |  |
| 2 | SaturnModuleID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | EngName | varchar(50) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DocumentNumResetNumberBaseTypeID
- **FK** `FK_DocumentNumResetNumberBaseType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentNumResetNumberBaseType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DocumentNumResetNumberBaseType_SaturnModule` (SaturnModuleID) -> CFG.SaturnModule (SaturnModuleID) on update CASCADE
- **Referenced by:** CFG.DocumentNumResetNumberBase (DocumentNumResetNumberBaseTypeID)

### CFG.DocumentNumType

Rows: 87 | نوع سند برای شماره گذاری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentNumTypeID | smallint | N |  |  |
| 2 | Name | nvarchar(256) | N |  |  |
| 3 | EngName | varchar(256) | N |  |  |
| 4 | Type | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | TableName | varchar(256) | N | ('') |  |
| 11 | Name2 | nvarchar(256) | N | ('') |  |

- **Primary key:** DocumentNumTypeID
- **FK** `FK_DocumentNumType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentNumType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DocumentNumType_SaturnModule` (Type) -> CFG.SaturnModule (SaturnModuleID) on update CASCADE
- **Referenced by:** ACC.PreVoucher (DocumentNumtypeID); CFG.DocumentNum (DocumentNumTypeID); STF.TraceDocumentNumType (DocumentNumTypeID)

### CFG.EntityCustomeField

Rows: 20

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EntityCustomeFieldID | int | N |  | identity |
| 2 | EntityName | varchar(250) | N |  |  |
| 3 | FieldName | varchar(250) | N |  |  |
| 4 | FieldTitle | nvarchar(100) | N |  |  |
| 5 | FieldTitle2 | nvarchar(100) | N |  |  |
| 6 | FieldType | tinyint | Y |  | 1 = متن , 2 = رشته , 3 = عدد صحیح , 4 = عدد اعشاری , 5 = تاریخ ,  |
| 7 | Order | tinyint | N |  |  |
| 8 | LookupDataID | int | Y |  |  |
| 9 | IsRequired | bit | N | ((0)) |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EntityCustomeFieldID
- **FK** `FK_EntityCustomeField_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_EntityCustomeField_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_EntityCustomeField_LookupData` (LookupDataID) -> CFG.LookupData (LookupDataID)
- **Referenced by:** CFG.EntityCustomeFieldData (EntityCustomeFieldID)

### CFG.EntityCustomeFieldData

Rows: 26874

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EntityCustomeFieldDataID | int | N |  | identity |
| 2 | EntityCustomeFieldID | int | N |  |  |
| 3 | EntityID | decimal(18,0) | N |  |  |
| 4 | Value | nvarchar(MAX) | Y |  |  |
| 5 | LookupDataItemID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** EntityCustomeFieldDataID
- **unique index** `IX_EntityCustomeFieldData_Unique_EntityCustomeFieldID_EntityID` (EntityCustomeFieldID, EntityID)
- **FK** `FK_EntityCustomeFieldData_EntityCustomeField` (EntityCustomeFieldID) -> CFG.EntityCustomeField (EntityCustomeFieldID)

### CFG.ExecutionLocation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ExecutionLocationID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | IsActive | bit | N | ((1)) |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ExecutionLocationID
- **unique index** `IX_ExecutionLocation_Title` (Title)
- **FK** `FK_ExecutionLocation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ExecutionLocation_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_ExecutionLocation_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.FileAttachment

Rows: 9072

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FileAttachmentID | int | N |  | identity |
| 2 | MetaDataEntityID | int | N |  |  |
| 3 | Date | date | Y |  |  |
| 4 | Description | nvarchar(MAX) | Y |  |  |
| 5 | Description2 | nvarchar(MAX) | Y |  |  |
| 6 | FileName | nvarchar(300) | Y |  |  |
| 7 | FileContent | varbinary(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | EntityRelatedID | int | N |  |  |
| 14 | FileAttachmentTypeID | int | Y |  |  |
| 15 | Status | tinyint | N | ((1)) |  |

- **Primary key:** FileAttachmentID
- **FK** `FK_Attachment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Attachment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FileAttachment_DmdEntity` (MetaDataEntityID) -> MDT.DmdEntity (ID)

### CFG.FileAttachmentType

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FileAttachmentTypeID | int | N |  | identity |
| 2 | MetaDataEntityID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | IsSystem | bit | N | ((0)) |  |

- **FK** `FK_FileAttachmentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FileAttachmentType_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.FileDirectory

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FileDirectoryID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FileDirectoryID
- **FK** `FK_FileDirectory_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FileDirectory_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FileDirectory_FileDirectory` (ParentID) -> CFG.FileDirectory (FileDirectoryID)
- **Referenced by:** CFG.FileDirectory (ParentID); CFG.FileItem (FileDirectoryID)

### CFG.FileItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FileItemID | int | N |  | identity |
| 2 | FileDirectoryID | int | N |  |  |
| 3 | FileName | nvarchar(300) | Y |  |  |
| 4 | FileContent | varbinary(MAX) | Y |  |  |
| 5 | Date | date | Y |  |  |
| 6 | Description | nvarchar(MAX) | Y |  |  |
| 7 | Description2 | nvarchar(MAX) | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FileItemID
- **FK** `FK_FileItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FileItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FileItem_FileDirectory` (FileDirectoryID) -> CFG.FileDirectory (FileDirectoryID)
- **Referenced by:** SRM.SrmFileAttachement (FileItemID)

### CFG.FinancialPeriod

Rows: 9 | دوره مالی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FinancialPeriodID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | StartDate | datetime | N |  |  |
| 5 | EndDate | datetime | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** FinancialPeriodID
- **unique index** `IX_FinancialPeriod` (Title)
- **FK** `FK_FinancialPeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_FinancialPeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** ACC.DCNote (FinancialPeriodID); ACC.GIVoucher (FinancialPeriodID); ACC.PreVoucher (FinancialPeriodID); ACC.VatRate (FinancialPeriodID); ACC.Voucher (FinancialPeriodID); APS.DimSaleItem (FinancialPeriodID); APT.ApportionPeriod (FinancialPeriodID); AST.Adjustment (FinancialPeriodID); AST.AssetClosingOperation (FinancialPeriodID); AST.AssetReceipt (FinancialPeriodID); AST.ChangeCategory (FinancialPeriodID); AST.Creation (FinancialPeriodID); AST.Depreciation (FinancialPeriodID); AST.DepreciationPeriod (FinancialPeriodID); AST.Destruction (FinancialPeriodID); AST.Insurance (FinancialPeriodID); AST.InsuranceSharing (FinancialPeriodID); AST.ReceivedFromBranch (FinancialPeriodID); AST.Repair (FinancialPeriodID); AST.Revaluation (FinancialPeriodID); AST.Sale (FinancialPeriodID); AST.Salvage (FinancialPeriodID); AST.Statement (FinancialPeriodID); AST.Transfer (FinancialPeriodID); CFG.DebitCreditNote (FinancialPeriodID); CFG.DocumentNum (FinancialPeriodID); CFG.InstallmentPayment (FinancialPeriodID); CFG.ManualReceipt (FinancialPeriodID); CFG.SeasonFile (FinancialPeriodID); CFG.Vat (FinancialPeriodID); CNT.ConfirmStatement (FinancialPeriodID); CNT.ContractStatement (FinancialPeriodID); CNT.ContractStatementAnalysis (FinancialPeriodID); CTM.Order (FinancialPeriodID); CTM.Reception (FinancialPeriodID); FIN.CashTransfer (FinancialPeriodID); FIN.GuarantyOperation (FinancialPeriodID); FIN.PaymentCheqeFlow (FinancialPeriodID); FIN.PaymentCommitment (FinancialPeriodID); FIN.PaymentCommitmentRecall (FinancialPeriodID); FIN.PaymentReceipt (FinancialPeriodID); FIN.PettyCashCharging (FinancialPeriodID); FIN.PettyCashCost (FinancialPeriodID); FIN.ReceiptCheqeFlow (FinancialPeriodID); FIN.ReceiveCommitment (FinancialPeriodID); FIN.ReceiveCommitmentRecall (FinancialPeriodID); FIN.ReceiveReceipt (FinancialPeriodID); FIN.Reconciliation (FinancialPeriodID); FOS.BillOfLading (FinancialPeriodID); FOS.Clearance (FinancialPeriodID); FOS.CostOfOrder (FinancialPeriodID); FOS.CreditAllocation (FinancialPeriodID); FOS.LetterCredit (FinancialPeriodID); FOS.OrderPricing (FinancialPeriodID); FOS.ProformaInvoice (FinancialPeriodID); FOS.Registration (FinancialPeriodID); FOS.ShippingInsurance (FinancialPeriodID); FSS.FinancialStatement (FinancialPeriodID); POS.Delivery (FinancialPeriodID); POS.InstallmentAccumulation (FinancialPeriodID); POS.PosInvoice (FinancialPeriodID); POS.PosReceipt (FinancialPeriodID); PRM.ConsumptionStatistic (FinancialPeriodID); PRM.CostCalculationPeriod (FinancialPeriodID); PRM.ProductionAnalysis (FinancialPeriodID); PRM.ProductionOrder (FinancialPeriodID); PRM.ProductionPlanning (FinancialPeriodID); PRM.ProductionStatistic (FinancialPeriodID); PRM.Rework (FinancialPeriodID); PRM.SpoilageStatistic (FinancialPeriodID); PRM.StationPerformance (FinancialPeriodID); REQ.PaymentRequest (FinancialPeriodID); REQ.PurchaseRequest (FinancialPeriodID); REQ.ReceiveRequest (FinancialPeriodID); REQ.ReturnRequest (FinancialPeriodID); REQ.ServiceRequest (FinancialPeriodID); REQ.StuffRequest (FinancialPeriodID); REQ.TenderRequest (FinancialPeriodID); SLE.CustomerOpeningBalance (FinancialPeriodID); SLE.Invoice (FinancialPeriodID); SLE.InvoiceCorrection (FinancialPeriodID); SLE.Justification (FinancialPeriodID); SLE.PourcentagePeriod (FinancialPeriodID); SLE.Quotation (FinancialPeriodID); SLE.Remittance (FinancialPeriodID); SLE.ReturnedSaleInvoice (FinancialPeriodID); SLE.ReturnedSaleJustification (FinancialPeriodID); SLE.SaleContract (FinancialPeriodID); STC.InventoryEdition (FinancialPeriodID); STC.JustificationInput (FinancialPeriodID); STC.Outgoing (FinancialPeriodID); STC.ProductionPrice (FinancialPeriodID); STC.RecountingInventoryPeriod (FinancialPeriodID); STC.ReturnedOutgoing (FinancialPeriodID); STC.ReturnedTemporaryOutgoing (FinancialPeriodID); STC.ReturnedTemporaryStockReceipt (FinancialPeriodID); STC.ReturnStockReceipt (FinancialPeriodID); STC.RevisionCost (FinancialPeriodID); STC.StockClosingOperation (FinancialPeriodID); STC.StockReceipt (FinancialPeriodID); STC.TemporaryOutgoing (FinancialPeriodID); STC.TemporaryStockReceipt (FinancialPeriodID); VND.Proposal (FinancialPeriodID); VND.ProposalCommission (FinancialPeriodID); VND.PurchaseContract (FinancialPeriodID); VND.PurchaseInvoice (FinancialPeriodID); VND.ReturnInvoice (FinancialPeriodID); VND.VendorOpeningBalance (FinancialPeriodID); WMS.Packing (FinancialPeriodID); WMS.PhysicalLocation (FinancialPeriodID)

### CFG.FormViewSetting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FormViewSettingID | int | N |  | identity |
| 2 | FormKey | varchar(50) | N |  |  |
| 3 | FormType | tinyint | N |  |  |
| 4 | Setting | varchar(MAX) | N |  |  |

- **Primary key:** FormViewSettingID

### CFG.Group

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | GroupID | int | N |  | identity |
| 2 | GroupType | tinyint | N |  |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | Title2 | nvarchar(256) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** GroupID
- **index** `IX_CodeGroupTypeID` (Code, GroupType)
- **index** `IX_TitleGroupTypeID` (GroupType, Title)
- **FK** `FK_Group_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Group_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.Party (CustomerGroupID); CFG.Party (VendorGroupID); SLE.DiscountAnnouncement (CustomerGroupID); SLE.DiscountAnnouncement (DiscountGroupID); SLE.PourcentageParameterMethod (PorcentageGroupID); SLE.PourcentageParameterMethod (SaleAgentPorcentageGroupID); SLE.PourcentageRate (SaleAgentPourcentageGroupID); SLE.PourcentageRate (StuffPourcentageGroupID); SLE.SaleAgent (PorcentageGroupID); STF.StuffDetail (BuyGroupID); STF.StuffDetail (CommissionGroupID); STF.StuffDetail (DiscountGroupID); STF.StuffDetail (SalesGroupID)

### CFG.HoldingStructure

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | HoldingStructureID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Code | nvarchar(256) | Y |  |  |
| 4 | Title | nvarchar(512) | N |  |  |
| 5 | Title2 | nvarchar(512) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** HoldingStructureID
- **FK** `FK_HoldingStructure_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_HoldingStructure_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_HoldingStructure_Parent` (ParentID) -> CFG.HoldingStructure (HoldingStructureID)
- **Referenced by:** CFG.Company (HoldingStructureID); CFG.HoldingStructure (ParentID)

### CFG.InstallmentPayment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstallmentPaymentID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N | ((-1)) |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | InstallmentType | tinyint | N | ((1)) | 1-دریافتنی  2-پرداختنی  |
| 7 | BaseType | tinyint | N | ((2)) | 1-بدون مبنا 2-فاکتور فروش 3-مانده فروشگاه  4-فاکتور خرید |
| 8 | DocumentID | int | N |  |  |
| 9 | PartyID | bigint | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | CurrencyID | int | N | ((-1)) |  |

- **Primary key:** InstallmentPaymentID
- **FK** `FK_InstallmentPayment_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_InstallmentPayment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InstallmentPayment_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_InstallmentPayment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InstallmentPayment_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_InstallmentPayment_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **Referenced by:** CFG.InstallmentPaymentItem (InstallmentPaymentID)

### CFG.InstallmentPaymentItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InstallmentPaymentItemID | int | N |  | identity |
| 2 | InstallmentPaymentID | int | N |  |  |
| 3 | Number | smallint | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Amount | decimal(36,10) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** InstallmentPaymentItemID
- **FK** `FK_InstallmentPaymentItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InstallmentPaymentItem_InstallmentPayment` (InstallmentPaymentID) -> CFG.InstallmentPayment (InstallmentPaymentID) on delete CASCADE
- **FK** `FK_InstallmentPaymentItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.DebitCreditNoteItem (InstallmentPaymentItemID); CFG.ManualReceipt (InstallmentPaymentItemID); FIN.PaymentSubject (InstallmentPaymentItemID); FIN.PettyCashCostItem (InstallmentPaymentItemID); FIN.ReceiveSubject (InstallmentPaymentItemID)

### CFG.InternalAudit

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InternalAuditID | int | N |  | identity |
| 2 | OrderNo | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | SaturnDataSourceID | int | N |  |  |
| 6 | EngName | nvarchar(256) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** InternalAuditID
- **FK** `FK_InternalAudit_SaturnDataSource` (SaturnDataSourceID) -> CFG.SaturnDataSource (SaturnDataSourceID)
- **FK** `FK_InternalAudit_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_InternalAudit_EditorUser` (LastEditor) -> CFG.User (UserID)

### CFG.Introduction

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | IntroductionID | smallint | N |  | identity; شناسه ركورد روش آشنایی (روزنامه - سایت - ..) |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | Y |  |  |
| 4 | Default | bit | N |  | پيش فرض |
| 5 | Version | int | N |  |  |
| 6 | IsActive | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** IntroductionID
- **FK** `FK_Introduction_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Introduction_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.Party (IntroductionID)

### CFG.JsonLog

Rows: 9848 | لاگ داده

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | bigint | N |  | identity |
| 2 | TableId | int | N |  |  |
| 3 | ApplyDate | datetime | N |  |  |
| 4 | UserId | int | N |  |  |
| 5 | TransactionID | bigint | N |  |  |
| 6 | OperationType | tinyint | N |  |  |
| 7 | ComputerName | varchar(256) | N |  |  |

- **Primary key:** Id
- **FK** `FK_JsonLog_DmdTable` (TableId) -> MDT.DmdTable (ID)
- **Referenced by:** CFG.JsonLogItem (JsonLogId)

### CFG.JsonLogItem

Rows: 37741

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | bigint | N |  | identity |
| 2 | JsonLogId | bigint | N |  |  |
| 3 | Value | nvarchar(4000) | Y |  |  |
| 4 | EntityID | bigint | N |  |  |
| 5 | OperationType | tinyint | N |  |  |

- **Primary key:** Id
- **index** `IX_JsonLogItem_JsonLogId` (JsonLogId) include (Id, EntityID, OperationType)
- **FK** `FK_JsonLogItem_JsonLog` (JsonLogId) -> CFG.JsonLog (Id)

### CFG.LicenceInfo

Rows: 9

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LicenceInfoID | smallint | N |  | identity |
| 2 | LicenceKey | varchar(50) | N |  |  |
| 3 | LicenceValue | varchar(50) | N |  |  |

- **Primary key:** LicenceInfoID

### CFG.LocalizationSQLMessage

Rows: 146

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocalizationSQLMessageID | int | N |  | identity |
| 2 | SQLMessageCode | varchar(MAX) | N |  |  |

- **Primary key:** LocalizationSQLMessageID
- **Referenced by:** CFG.LocalizationSQLMessageValue (LocalizationSQLMessageID)

### CFG.LocalizationSQLMessageValue

Rows: 146

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocalizationSQLMessageValueID | int | N |  | identity |
| 2 | LocalizationSQLMessageID | int | N |  |  |
| 3 | Culture | varchar(50) | N |  |  |
| 4 | Value | nvarchar(2048) | N |  |  |

- **Primary key:** LocalizationSQLMessageValueID
- **FK** `FK_LocalizationSQLMessageValue_LocalizationSQLMessage` (LocalizationSQLMessageID) -> CFG.LocalizationSQLMessage (LocalizationSQLMessageID) on delete CASCADE

### CFG.LocalizeEnum

Rows: 1665

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocalizeEnumID | int | N |  | identity |
| 2 | Enum | varchar(50) | N |  |  |
| 3 | Item | varchar(50) | N |  |  |
| 4 | KeyValue | nvarchar(50) | Y |  |  |

- **Primary key:** LocalizeEnumID
- **Referenced by:** CFG.LocalizeEnumValue (LocalizeEnumID)

### CFG.LocalizeEnumValue

Rows: 1667

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocalizeEnumValueID | int | N |  | identity |
| 2 | LocalizeEnumID | int | N |  |  |
| 3 | Culture | varchar(50) | N |  |  |
| 4 | Value | nvarchar(2048) | N |  |  |

- **Primary key:** LocalizeEnumValueID
- **FK** `FK_LocalizeEnumValue_LocalizeEnum` (LocalizeEnumID) -> CFG.LocalizeEnum (LocalizeEnumID)

### CFG.Location

Rows: 1098

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocationID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | ParentID | int | Y |  |  |
| 5 | LocationTypeID | int | N |  |  |
| 6 | FinancialMinistryCode | nvarchar(50) | Y |  |  |
| 7 | PreNumberOfCity | nvarchar(50) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** LocationID
- **FK** `FK_Location_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Location_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Location_Location` (ParentID) -> CFG.Location (LocationID)
- **FK** `FK_Location_LocationType` (LocationTypeID) -> CFG.LocationType (LocationTypeID)
- **Referenced by:** CFG.Address (LocationID); CFG.BankBranch (LocationID); CFG.Location (ParentID)

### CFG.LocationType

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LocationTypeID | int | N |  | identity |
| 2 | Name | nvarchar(50) | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |

- **Primary key:** LocationTypeID
- **FK** `FK_LocationType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LocationType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.Location (LocationTypeID)

### CFG.LookupData

Rows: 14

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LookupDataID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | SystemName | varchar(50) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Type | tinyint | N | ((1)) |  |
| 11 | Attribute | nvarchar(MAX) | N | (N'{}') |  |
| 12 | Entity | nvarchar(500) | Y |  |  |
| 13 | Data_Hash | nvarchar(512) | Y |  |  |

- **Primary key:** LookupDataID
- **FK** `FK_LookupData_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LookupData_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.AssetCategorySpecification (CustomTypeID); CFG.EntityCustomeField (LookupDataID); CFG.LookupDataItem (LookupDataID)

### CFG.LookupDataItem

Rows: 70

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | LookupDataItemID | int | N |  | identity |
| 2 | LookupDataID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Code | nvarchar(128) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** LookupDataItemID
- **FK** `FK_LookupDataItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_LookupDataItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_LookupDataItem_LookupData` (LookupDataID) -> CFG.LookupData (LookupDataID) on delete CASCADE
- **Referenced by:** AST.AssetCertificate (LookupDataItemID); CFG.Party (Nationality)

### CFG.ManualReceipt

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ManualReceiptID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | BranchID | int | N |  |  |
| 4 | PartyID | bigint | Y |  |  |
| 5 | CurrencyID | int | N | ((-1)) |  |
| 6 | ManualReceiptType | tinyint | N | ((1)) | 1 -دریافتی 2- پرداختی |
| 7 | ManualReceiptSubject | tinyint | N | ((6)) | 1-فاکتور خرید 2-برگشت از فروش 3-حقوق 4-اقساط پرداختنی 5-فاکتور 6-اقساط دریافتنی  7-برگشت از خرید |
| 8 | InstallmentPaymentItemID | int | Y |  |  |
| 9 | PurchaseInvoiceID | int | Y |  |  |
| 10 | InvoiceID | int | Y |  |  |
| 11 | ReturnedSaleInvoiceID | int | Y |  |  |
| 12 | ReturnInvoiceID | int | Y |  |  |
| 13 | CalculationResultID | decimal(18,0) | Y |  |  |
| 14 | Number | int | N |  |  |
| 15 | Date | date | N |  |  |
| 16 | Amount | decimal(18,4) | N |  |  |
| 17 | Description | nvarchar(1024) | Y |  |  |
| 18 | Version | int | N |  |  |
| 19 | Creator | int | N |  |  |
| 20 | CreationDate | datetime | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | SaleContractID | int | Y |  |  |

- **Primary key:** ManualReceiptID
- **FK** `FK_ManualReceipt_SaleContract` (SaleContractID) -> SLE.SaleContract (SaleContractID)
- **FK** `FK_ManualReceipt_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ManualReceipt_CalculationResult` (CalculationResultID) -> PAY.CalculationResult (CalculationResultID)
- **FK** `FK_ManualReceipt_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ManualReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ManualReceipt_InstallmentPaymentItem` (InstallmentPaymentItemID) -> CFG.InstallmentPaymentItem (InstallmentPaymentItemID)
- **FK** `FK_ManualReceipt_Invoice` (InvoiceID) -> SLE.Invoice (InvoiceID)
- **FK** `FK_ManualReceipt_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_ManualReceipt_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_ManualReceipt_ReturnedSaleInvoice` (ReturnedSaleInvoiceID) -> SLE.ReturnedSaleInvoice (ReturnedSaleInvoiceID)
- **FK** `FK_ManualReceipt_ReturnInvoice` (ReturnInvoiceID) -> VND.ReturnInvoice (ReturnInvoiceID)

### CFG.Message

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MessageID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | RootParentID | int | Y |  |  |
| 4 | SenderID | int | N |  |  |
| 5 | Subject | nvarchar(200) | N |  |  |
| 6 | Body | nvarchar(MAX) | N |  |  |
| 7 | EntityName | nvarchar(50) | Y |  |  |
| 8 | ModuleName | nvarchar(50) | Y |  |  |
| 9 | EntityID | int | Y |  |  |
| 10 | IsDraft | bit | N | ((0)) |  |
| 11 | IsSenderDeleted | bit | N | ((0)) |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | IsReplyAll | bit | N | ((0)) |  |

- **Primary key:** MessageID
- **index** `IX_Message_RootParentID` (RootParentID)
- **FK** `FK_Message_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Message_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Message_Parent` (ParentID) -> CFG.Message (MessageID)
- **FK** `FK_Message_Message_RootParentID` (RootParentID) -> CFG.Message (MessageID)
- **FK** `FK_Message_User_SenderID` (SenderID) -> CFG.User (UserID)
- **Referenced by:** CFG.Message (ParentID); CFG.Message (RootParentID); CFG.MessageRecipient (MessageID); CFG.MessageUserDeletion (MessageID)

### CFG.MessageRecipient

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MessageRecipientID | int | N |  | identity |
| 2 | MessageID | int | N |  |  |
| 3 | ReceiverID | int | N |  |  |
| 4 | RecipientType | tinyint | N | ((0)) |  |
| 5 | IsRead | bit | N | ((0)) |  |
| 6 | IsDeleted | bit | N | ((0)) |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** MessageRecipientID
- **FK** `FK_MessageRecipient_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MessageRecipient_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MessageRecipient_Message` (MessageID) -> CFG.Message (MessageID)
- **FK** `FK_MessageRecipient_User_ReceiverID` (ReceiverID) -> CFG.User (UserID)

### CFG.MessageUserDeletion

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MessageUserDeletionID | int | N |  | identity |
| 2 | MessageID | int | N |  |  |
| 3 | UserID | int | N |  |  |
| 4 | Version | int | N | ((0)) |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N | (getdate()) |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N | (getdate()) |  |

- **Primary key:** MessageUserDeletionID
- **unique constraint** `UQ_MessageUserDeletion_MessageUser` (MessageID, UserID)
- **FK** `FK_MessageUserDeletion_Message` (MessageID) -> CFG.Message (MessageID)
- **FK** `FK_MessageUserDeletion_User` (UserID) -> CFG.User (UserID)

### CFG.NLog

Rows: 0 | لاگ رخداد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | bigint | N |  | identity |
| 2 | app | nvarchar(200) | Y |  |  |
| 3 | Logged | datetime | N |  |  |
| 4 | Level | varchar(5) | N |  |  |
| 5 | Message | nvarchar(MAX) | Y |  |  |
| 6 | Exception | nvarchar(MAX) | Y |  |  |
| 7 | Ip | varchar(50) | Y |  |  |
| 8 | method | varchar(50) | Y |  |  |
| 9 | db | varchar(50) | Y |  |  |
| 10 | url | nvarchar(1024) | Y |  |  |
| 11 | LogType | varchar(50) | Y |  |  |
| 12 | time | time(7) | Y |  |  |
| 13 | processid | bigint | Y |  |  |
| 14 | UserId | varchar(50) | Y |  |  |
| 15 | LevelId | int | Y |  |  |
| 16 | LogTypeId | int | Y |  |  |
| 17 | Message_Hash | varbinary(MAX) | Y |  |  |
| 18 | Message_Encrypt | varbinary(MAX) | Y | ((0)) |  |
| 19 | CategoryId | int | N | ((0)) |  |

- **Primary key:** ID

### CFG.NumberingPattern

Rows: 8 | الگوی شماره گذاری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NumberingPatternID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | StartNumber | bigint | N |  |  |
| 5 | ExecuteDate | datetime | N |  |  |
| 6 | ResetAtFinancialPeriodLevel | bit | N |  |  |
| 7 | LastAssignedNumber | bigint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | IsDateControllable | bit | N | ((1)) |  |
| 14 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** NumberingPatternID
- **FK** `FK_NumberingPattern_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_NumberingPattern_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_NumberingPattern_CompanyID` (CompanyID) -> CFG.Company (CompanyID)
- **Referenced by:** CFG.NumberingPatternItem (NumberingPatternID)

### CFG.NumberingPatternItem

Rows: 147

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NumberingPatternItemID | int | N |  | identity |
| 2 | NumberingPatternID | int | N |  |  |
| 3 | DmdEntityID | int | N |  |  |
| 4 | BranchID | int | Y |  |  |
| 5 | SaleTypeId | int | Y |  |  |
| 6 | SaleAreaId | int | Y |  |  |
| 7 | StationId | int | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** NumberingPatternItemID
- **FK** `FK_NumberingPatternItem_SaleArea` (SaleAreaId) -> SLE.SaleArea (SaleAreaID)
- **FK** `FK_NumberingPatternItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_NumberingPatternItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_NumberingPatternItem_SaleType` (SaleTypeId) -> SLE.SaleType (SaleTypeID)
- **FK** `FK_NumberingPatternItem_NumberingPattern` (NumberingPatternID) -> CFG.NumberingPattern (NumberingPatternID) on delete CASCADE
- **FK** `FK_NumberingPatternItem_DmdEntity` (DmdEntityID) -> MDT.DmdEntity (ID)
- **FK** `FK_NumberingPatternItem_Station` (StationId) -> POS.Station (StationID)
- **FK** `FK_NumberingPatternItem_Branch` (BranchID) -> CFG.Branch (BranchID)

### CFG.OrganizationUnit

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OrganizationUnitID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Code | nvarchar(256) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | CostCenterID | int | Y |  |  |
| 11 | FlowChartID | int | Y |  |  |

- **Primary key:** OrganizationUnitID
- **FK** `FK_OrganizationUnit_FlowChart` (FlowChartID) -> HRM.FlowChart (FlowChartID)
- **FK** `FK_OrganizationUnit_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_OrganizationUnit_Editor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** EDU.CourseRequest (OrganizationUnitID); HRM.Agreement (OrganizationUnitID); HRM.EmploymentRequest (OrganizationUnitID); REQ.PaymentRequest (OrganizationUnitID); REQ.PurchaseRequest (OrganizationUnitID); REQ.ReceiveRequest (OrganizationUnitID); REQ.ReturnRequest (OrganizationUnitID); REQ.ServiceRequest (OrganizationUnitID); REQ.StuffRequest (OrganizationUnitID); REQ.TenderRequest (OrganizationUnitID)

### CFG.OriginDestinationSetting

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | OriginDestinationSettingID | int | N |  | identity |
| 2 | OriginID | int | N |  |  |
| 3 | DestinationID | int | N |  |  |
| 4 | SettingKey | varchar(10) | N |  |  |
| 5 | SettingValue | int | N |  |  |

- **Primary key:** OriginDestinationSettingID
- **FK** `FK_OriginDestinationSetting_MDEntityOrigin` (OriginID) -> MDT.DmdEntity (ID)
- **FK** `FK_OriginDestinationSetting_MDEntityDestination` (DestinationID) -> MDT.DmdEntity (ID)

### CFG.Party

Rows: 1705 | طرف حساب

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PartyID | bigint | N |  | identity; شناسه ركورد طرف حساب(شرکت مورد نظر) |
| 2 | Type | tinyint | N |  | نوع حقيقي يا حقوقي |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | IdentificationCode | nvarchar(50) | Y |  | كد ملي/ شماره ثبت |
| 6 | EconomicCode | nvarchar(50) | Y |  | كد اقتصادي |
| 7 | IsActive | bit | N |  |  |
| 8 | IsInBlackList | bit | N |  | ليست سياه  = 1 |
| 9 | IsCustomer | bit | N |  | مشتري |
| 10 | CreditControl | bit | N |  | كنترل اعتبار مشتري=1 |
| 11 | CustomerCredit | decimal(30,4) | Y |  | مقدار اعتبار مشتري |
| 12 | IsDetterent | bit | N |  | بازدارنده= 1 |
| 13 | IntroductionName | nvarchar(256) | Y |  | عنوان معرف |
| 14 | IsVendor | bit | N |  | تامين كننده |
| 15 | Version | int | N |  |  |
| 16 | Creator | int | N |  |  |
| 17 | CreationDate | datetime | N |  |  |
| 18 | LastEditor | int | N |  |  |
| 19 | LastEditionDate | datetime | N |  |  |
| 20 | DlID | bigint | Y |  | ارجاع به جدول تفصيل |
| 21 | CustomerGroupID | int | Y |  | ارجاع به گروه از نوع مشتري |
| 22 | IntroductionID | smallint | Y |  | ارجاع به روش آشنايي |
| 23 | VendorGroupID | int | Y |  | ارجاع به گروه از نوع تامين كننده |
| 24 | ExemptFromTax | bit | N |  | معاف از ارزش افزوده |
| 25 | CustomerCode | nvarchar(256) | Y |  | کد مشتری |
| 26 | NationalID | nvarchar(256) | Y |  | شناسه ملی |
| 27 | LastName | nvarchar(256) | Y |  |  |
| 28 | LastName2 | nvarchar(256) | Y |  |  |
| 29 | Email | varchar(250) | Y |  |  |
| 30 | IsReceptionist | bit | N |  |  |
| 31 | TradeName | nvarchar(250) | Y |  |  |
| 32 | TradeName2 | nvarchar(250) | Y |  |  |
| 33 | IsShoppingCardExporter | bit | N | ((0)) |  |
| 34 | RegisterCode | nvarchar(50) | Y |  |  |
| 35 | Nationality | int | N |  |  |
| 36 | FidaCode | nvarchar(12) | Y |  | کد فراگیر |
| 37 | FidaIdCode | nvarchar(12) | Y |  | شناسه فراگیر |

- **Primary key:** PartyID
- **FK** `FK_Party_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **FK** `FK_Party_LookupDataItem` (Nationality) -> CFG.LookupDataItem (LookupDataItemID)
- **FK** `FK_Party_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Party_CustomerGroup` (CustomerGroupID) -> CFG.Group (GroupID)
- **FK** `FK_Party_Introduction` (IntroductionID) -> CFG.Introduction (IntroductionID)
- **FK** `FK_Party_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Party_VendorGroup` (VendorGroupID) -> CFG.Group (GroupID)
- **Referenced by:** AST.AssetSetting (Deliverer); AST.AssetSetting (Responsible); AST.Insurance (PartyID); AST.Sale (PartyID); AST.Statement (PartyID); CFG.Address (PartyID); CFG.Customs (PartyID); CFG.DebitCreditNoteItem (PartyID); CFG.InstallmentPayment (PartyID); CFG.ManualReceipt (PartyID); CFG.PartyAccount (PartyID); CFG.Phone (PartyID); CFG.RelatedPerson (PartyID); CFG.User (PartyID); CNT.Contract (PartyID); CNT.ContractParty (PartyID); CNT.ContractStatement (PartyID); CNT.ContractStatementAnalysis (PartyID); CNT.ContractStatementDetail (PartyID); CTM.Order (CustomerID); CTM.OrderSaleAgent (SaleAgentID); CTM.Reception (CustomerID); CTM.ReceptionTrace (PartyID); CTM.SubscribeCard (PartyID); EDU.CoursePlaningResult (PartyID); EDU.CourseRegistrationItem (PartyID); EDU.Teacher (PartyID); FIN.PaymentCheqeFlow (PartyID); FIN.PaymentCommitment (PartyID); FIN.PaymentReceipt (PartyID); FIN.PettyCash (PartyID); FIN.PettyCashCostItem (PartyID); FIN.ReceiptCheqeFlow (PartyID); FIN.ReceiveCommitment (PartyID); FIN.ReceiveReceipt (PartyID); FOS.BillOfLading (PartyID); FOS.Clearance (PartyID); FOS.CostOfOrderItem (PartyID); FOS.LetterCredit (OpeningCreditBank); FOS.ProformaInvoice (Vendor); FOS.Registration (PartyID); FOS.ShippingInsurance (PartyID); HRM.FoodOrder (PartyID); HRM.FoodOrderItem (PartyID); HRM.FoodPlanItem (PartyID); HRM.FoodPrice (PartyID); HRM.OrganizationItem (PartyID); HRM.Personel (PartyID); NOC.CurrencyExchange (PartyID); POS.InstallmentAccumulationCalculation (PartyID); POS.PosInvoice (CustomerID); POS.PosReceipt (CustomerID); POS.PosReceiptItem (PartyID); POS.Station (PartyID); PUM.PortalUser (PartyID); REQ.PaymentRequestItem (PartyID); REQ.ReceiveRequest (PartyID); SLE.CustomerOpeningBalance (CustomerID); SLE.Invoice (CustomerID); SLE.InvoiceCorrection (CustomerID); SLE.Justification (CustomerID); SLE.PricingCalculation (CustomerID); SLE.Quotation (CustomerID); SLE.Remittance (CustomerID); SLE.ReturnedSaleInvoice (CustomerID); SLE.ReturnedSaleJustification (CustomerID); SLE.SaleAgent (PartyID); SLE.SaleContract (CustomerID); SRM.Activity (PartyID); SRM.Contact (PartyID); VND.DeliveryJustification (PartyID); VND.Enactment (PartyID); VND.FinalEvaluationItem (PartyID); VND.InqueryPermissionItem (PartyID); VND.PorcumentGroupItem (PartyID); VND.Proposal (PartyID); VND.PurchasePlanning (PartyID); VND.TenderParticipate (PartyID); VND.VendorOpeningBalance (VendorID)

### CFG.PartyAccount

Rows: 689

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PartyAccountID | int | N |  | identity |
| 2 | PartyID | bigint | N |  |  |
| 3 | BankID | int | N |  |  |
| 4 | AccountNumber | nvarchar(256) | Y |  |  |
| 5 | IBAN | nvarchar(256) | Y |  |  |
| 6 | CardNumber | nvarchar(256) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** PartyAccountID
- **FK** `FK_PartyAccount_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PartyAccount_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PartyAccount_Bank` (BankID) -> CFG.Bank (BankID)
- **FK** `FK_PartyAccount_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** REQ.PaymentRequestItem (PartyAccountID)

### CFG.PeriodicTask

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PeriodicTaskID | int | N |  | identity |
| 2 | TaskKey | varchar(50) | N |  |  |
| 3 | LastExecuteDate | datetime | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** PeriodicTaskID
- **FK** `FK_PeriodicTask_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PeriodicTask_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.Phone

Rows: 635 | تلفن

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PhoneID | int | N |  | identity |
| 2 | PartyID | bigint | N |  | ارجاع به جدول party |
| 3 | Phone | nvarchar(50) | N |  | تلفن |
| 4 | IsMain | bit | N |  | تلفن اصلي |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | AddressTypeID | int | N |  |  |

- **Primary key:** PhoneID
- **FK** `FK_Phone_AddressType` (AddressTypeID) -> CFG.AddressType (AddressTypeID)
- **FK** `FK_Phone_Creator` (Creator) -> CFG.User (UserID) on delete CASCADE
- **FK** `FK_Phone_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Phone_Party` (PartyID) -> CFG.Party (PartyID) on delete CASCADE
- **Referenced by:** CTM.Reception (PhoneID)

### CFG.RecordLevelSetting

Rows: 33

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecordLevelSettingID | tinyint | N |  | identity |
| 2 | Entity | varchar(30) | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | AccessType | tinyint | N |  |  |
| 5 | Level | tinyint | N |  |  |
| 6 | Title | nvarchar(MAX) | Y |  |  |
| 7 | Title2 | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N | ((-1)) |  |
| 9 | LastEditor | int | N | ((-1)) |  |
| 10 | CreationDate | datetime | N | (getdate()) |  |
| 11 | LastEditionDate | datetime | N | (getdate()) |  |
| 12 | Version | int | N | ((0)) |  |

- **Primary key:** RecordLevelSettingID
- **FK** `FK_RecordLevelSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecordLevelSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.UserGroupRecordAccess (RecorLevelSettingID)

### CFG.RelatedPerson

Rows: 1 | فرد مرتبط

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RelatedPersonID | int | N |  | identity |
| 2 | PartyID | bigint | N |  | ارجاع به جدول party |
| 3 | Name | nvarchar(256) | N |  |  |
| 4 | Position | nvarchar(MAX) | Y |  | سمت |
| 5 | Email | nvarchar(256) | Y |  |  |
| 6 | Phone | nvarchar(50) | Y |  |  |
| 7 | IsMain | bit | N |  | فرد اصلي |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RelatedPersonID
- **FK** `FK_RelatedPerson_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RelatedPerson_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RelatedPerson_Party` (PartyID) -> CFG.Party (PartyID) on delete CASCADE

### CFG.SaturnCustomType

Rows: 8 | نوع داده سفارشی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaturnCustomTypeID | int | N |  |  |
| 2 | Title | nvarchar(1024) | N |  |  |
| 3 | Title2 | nvarchar(1024) | N |  |  |
| 4 | RealType | tinyint | N |  |  |
| 5 | Query | nvarchar(MAX) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SaturnCustomTypeID
- **FK** `FK_SaturnCustomType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SaturnCustomType_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.SaturnDataSource

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaturnDataSourceID | int | N |  | identity |
| 2 | Name | nvarchar(150) | N |  |  |
| 3 | Query | nvarchar(MAX) | Y |  |  |
| 4 | DesignerString | nvarchar(MAX) | Y |  |  |
| 5 | DesingerBase | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Title | nvarchar(500) | N |  |  |
| 12 | Title2 | nvarchar(500) | N |  |  |
| 13 | Data_Hash | nvarchar(512) | Y |  |  |

- **Primary key:** SaturnDataSourceID
- **FK** `FK_SaturDataSource_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SaturDataSource_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.InternalAudit (SaturnDataSourceID); CFG.SaturnDataSourceParam (SaturnDataSourceID)

### CFG.SaturnDataSourceParam

Rows: 9

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaturnDataSourceParamID | int | N |  | identity |
| 2 | SaturnDataSourceID | int | N |  |  |
| 3 | Name | nvarchar(256) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | ParamType | int | N |  |  |
| 6 | DefaultValue | nvarchar(256) | Y |  |  |
| 7 | AllowMultiValue | bit | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | ItemType | tinyint | N | ((1)) |  |

- **Primary key:** SaturnDataSourceParamID
- **FK** `FK_SaturnDataSourceParam_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SaturnDataSourceParam_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SaturnDataSourceParam_SaturnDataSource` (SaturnDataSourceID) -> CFG.SaturnDataSource (SaturnDataSourceID) on delete CASCADE

### CFG.SaturnModule

Rows: 29

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaturnModuleID | int | N |  |  |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | EngName | varchar(50) | N |  |  |
| 4 | SchemaName | varchar(50) | N |  |  |

- **Primary key:** SaturnModuleID
- **Referenced by:** ACC.UsedDlType (SaturnModuleID); CFG.Concept (SaturnModuleID); CFG.DocumentNumResetNumberBaseType (SaturnModuleID); CFG.DocumentNumType (Type)

### CFG.SaturnReport

Rows: 167 | گزارش

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Query | nvarchar(MAX) | N |  |  |
| 5 | DesignString | nvarchar(MAX) | N |  |  |
| 6 | ModuleID | int | Y |  |  |
| 7 | SaturnReportGroupID | int | Y |  |  |
| 8 | IsSystem | bit | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Type | tinyint | N | ((1)) |  |
| 15 | IsActive | bit | N | ((1)) |  |
| 16 | ShowInMenu | bit | Y |  |  |
| 17 | ModuleName | nvarchar(200) | Y |  |  |
| 18 | Data_Hash | nvarchar(512) | Y |  |  |

- **Primary key:** ReportID
- **FK** `FK_SaturnReport_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SaturnReport_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SaturnReport_SaturnReportGroup` (SaturnReportGroupID) -> CFG.SaturnReportGroup (SaturnReportGroupID)
- **Referenced by:** ACC.VoucherCoverSetting (FiveColumnReportID); ACC.VoucherCoverSetting (ItemOrderReportID); ACC.VoucherCoverSetting (ThreeColumnReportID); ACC.VoucherCoverSetting (TwoColumnReportID); CFG.SaturnReportParam (ReportID); FIN.CheqeBook (ReportID); HRM.ConfirmationType (SaturnReportID); POS.StationPrintSetting (ReportID)

### CFG.SaturnReportGroup

Rows: 105 | گروه گزارش

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaturnReportGroupID | int | N |  | identity |
| 2 | Title | nvarchar(512) | N |  |  |
| 3 | Title2 | nvarchar(512) | N |  |  |
| 4 | EngName | nvarchar(512) | Y |  |  |
| 5 | ModuleID | int | Y |  |  |
| 6 | IsSystem | bit | N |  |  |
| 7 | ParentGroupID | int | Y |  |  |
| 8 | Type | tinyint | N | ((1)) |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Version | int | N |  |  |

- **Primary key:** SaturnReportGroupID
- **FK** `FK_SaturnReportGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SaturnReportGroup_SaturnReportGroup` (ParentGroupID) -> CFG.SaturnReportGroup (SaturnReportGroupID)
- **FK** `FK_SaturnReportGroup_Creator` (Creator) -> CFG.User (UserID)
- **Referenced by:** CFG.SaturnReport (SaturnReportGroupID); CFG.SaturnReportGroup (ParentGroupID)

### CFG.SaturnReportParam

Rows: 18 | پارامتر گزارش

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReportParamID | int | N |  | identity |
| 2 | ReportID | int | N |  |  |
| 3 | Name | nvarchar(256) | N |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | ParamType | tinyint | N |  |  |
| 6 | DefaultValue | nvarchar(256) | Y |  |  |
| 7 | IsQueryParam | bit | N |  |  |
| 8 | AllowMultiValue | bit | N | ((0)) |  |

- **Primary key:** ReportParamID
- **FK** `FK_ReportParam_Report` (ReportID) -> CFG.SaturnReport (ReportID) on delete CASCADE

### CFG.SeasonFile

Rows: 17548 | خرید و فروش فصلی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SeasonFileID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Season | tinyint | N |  |  |
| 4 | AutoGenerated | bit | N |  |  |
| 5 | DOCType | tinyint | N |  |  |
| 6 | DocName | nvarchar(MAX) | N |  |  |
| 7 | ID | bigint | N |  |  |
| 8 | StuffTitle | nvarchar(MAX) | N |  |  |
| 9 | Sarjam | bit | N | ((0)) |  |
| 10 | IsHagholAmalKari | bit | N | ((0)) |  |
| 11 | IsArzi | bit | N | ((0)) |  |
| 12 | KalaType | int | Y | ((12)) |  |
| 13 | LessThanQuorum | bit | N |  |  |
| 14 | Amount | decimal(30,4) | Y |  |  |
| 15 | Tax | decimal(30,4) | Y |  |  |
| 16 | Duty | decimal(30,4) | Y |  |  |
| 17 | Discount | decimal(30,4) | Y |  |  |
| 18 | ZipCode | nvarchar(256) | Y |  |  |
| 19 | PreNumberOfCity | nvarchar(50) | Y |  |  |
| 20 | Phone | nvarchar(50) | Y |  |  |
| 21 | Address | nvarchar(MAX) | Y |  |  |
| 22 | PartyFirstName | nvarchar(MAX) | Y |  |  |
| 23 | PartyLastName | nvarchar(MAX) | N |  |  |
| 24 | EconomicCode | nvarchar(50) | Y |  |  |
| 25 | NationalID | nvarchar(50) | Y |  |  |
| 26 | HCType1Code | tinyint | Y |  |  |
| 27 | provinceCode | nvarchar(50) | Y |  |  |
| 28 | cityCode | nvarchar(50) | Y |  |  |
| 29 | Type | bit | Y |  |  |
| 30 | Number | int | Y |  |  |
| 31 | Date | nvarchar(50) | Y |  |  |
| 32 | TradeType | tinyint | Y |  |  |
| 33 | BranchCode | int | N |  |  |
| 34 | BranchTitle | nvarchar(MAX) | N |  |  |
| 35 | Version | int | N |  |  |
| 36 | Creator | int | N |  |  |
| 37 | CreationDate | datetime | N |  |  |
| 38 | LastEditor | int | N |  |  |
| 39 | LastEditionDate | datetime | N |  |  |
| 40 | ArzType | int | Y |  |  |
| 41 | Arz_Price | decimal(30,4) | Y |  |  |
| 42 | Arz_MaliatArzeshAfzoodeh | decimal(30,4) | Y |  |  |
| 43 | Arz_AvarezArzeshAfzoodeh | decimal(30,4) | Y |  |  |
| 44 | Arz_SayerAvarez | decimal(30,4) | Y |  |  |
| 45 | Arz_TakhfifPrice | decimal(30,4) | Y |  |  |
| 46 | ArzBarabari_Price | decimal(18,2) | Y |  |  |
| 47 | ArzBarabari_MaliatArzeshAfzoodeh | decimal(18,2) | Y |  |  |
| 48 | ArzBarabari_AvarezArzeshAfzoodeh | decimal(18,2) | Y |  |  |
| 49 | ArzBarabari_SayerAvarez | decimal(18,2) | Y |  |  |
| 50 | ArzBarabari_TakhfifPrice | decimal(18,2) | Y |  |  |
| 51 | FactorNo | nvarchar(100) | Y |  |  |
| 52 | FactorDate | varchar(10) | Y |  |  |
| 53 | SarFaslType | int | Y |  |  |
| 54 | SaleTypeTitle | nvarchar(256) | Y |  |  |
| 55 | PurchaseType | tinyint | Y |  |  |
| 56 | FidaCode | nvarchar(11) | Y |  |  |
| 57 | AmountAccordingLicense | decimal(30,4) | Y |  |  |
| 58 | Currency | nvarchar(25) | Y |  |  |
| 59 | Arz_AmountAccordingLicense | decimal(30,4) | Y |  |  |
| 60 | ArzBarabari_AmountAccordingLicense | decimal(18,2) | Y |  |  |
| 61 | CotajNumber | varchar(250) | Y |  |  |
| 62 | CotajDate | varchar(10) | Y |  |  |
| 63 | EntranceCustomsCode | nvarchar(100) | Y |  |  |
| 64 | AssessmentCustomsCode | nvarchar(100) | Y |  |  |
| 65 | LetterCreditNumber | nvarchar(100) | Y |  |  |
| 66 | OpeningCreditDate | varchar(10) | Y |  |  |
| 67 | CountryCode | varchar(50) | Y |  |  |
| 68 | Nationality | int | Y |  |  |
| 69 | PayDate | nvarchar(10) | Y |  |  |
| 70 | GrossPrice | decimal(30,4) | Y |  |  |
| 71 | NetPrice | decimal(30,4) | Y |  |  |
| 72 | TaxDeducted | decimal(30,4) | Y |  |  |
| 73 | ContractNumber | nvarchar(250) | Y |  |  |
| 74 | StartDate | date | Y |  |  |
| 75 | FinishDate | date | Y |  |  |
| 76 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** SeasonFileID
- **FK** `FK_SeasonFile_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SeasonFile_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_SeasonFile_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SeasonFile_Company` (CompanyID) -> CFG.Company (CompanyID)

### CFG.SecurityConfiguration

Rows: 3

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SecurityConfigurationID | int | N |  | identity |
| 2 | ConfigKey | varchar(50) | N |  |  |
| 3 | ConfigValue | nvarchar(500) | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** SecurityConfigurationID
- **FK** `FK_SecurityConfiguration_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SecurityConfiguration_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.StandardDescription

Rows: 450 | شرح استاندارد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StandardDescriptionID | int | N |  | identity |
| 2 | Description | nvarchar(1050) | N |  |  |
| 3 | EntityName | varchar(150) | N |  |  |
| 4 | Creator | int | N |  | تعريف کننده شعبه |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** StandardDescriptionID
- **FK** `FK_StandardDescription_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StandardDescription_LastEditor` (LastEditor) -> CFG.User (UserID)

### CFG.SystemPolicy

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SystemPolicyID | int | N |  | identity |
| 2 | Title | nvarchar(100) | N |  |  |
| 3 | Title2 | nvarchar(100) | N |  |  |
| 4 | PolicyContent | nvarchar(MAX) | N |  |  |
| 5 | PolicyType | tinyint | N |  |  |
| 6 | IsDefault | bit | N |  |  |
| 7 | IsActive | bit | N |  |  |
| 8 | Description | nvarchar(2048) | Y |  |  |
| 9 | Description2 | nvarchar(2048) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** SystemPolicyID
- **FK** `FK_SystemPolicy_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SystemPolicy_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.User (SessionTimeOutPolicyID)

### CFG.TaxData

Rows: 215

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxDataID | int | N |  | identity |
| 2 | DocumentName | nvarchar(256) | N |  |  |
| 3 | DocumentID | int | N |  |  |
| 4 | Status | tinyint | N |  |  |
| 5 | UID | nvarchar(256) | N |  |  |
| 6 | RowID | bigint | N |  |  |
| 7 | ReferenceNumber | nvarchar(256) | Y |  |  |
| 8 | ErrorCode | nvarchar(256) | Y |  |  |
| 9 | ErrorDetail | nvarchar(MAX) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | UniqueTaxID | nvarchar(50) | Y |  |  |
| 13 | Settellment | tinyint | Y | ((1)) |  |
| 14 | SettellmentEditable | bit | Y |  |  |
| 15 | Article9 | bit | Y |  |  |

- **Primary key:** TaxDataID

### CFG.TaxLedger

Rows: 18

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxLedgerID | int | N |  | identity |
| 2 | CompanyID | int | N |  |  |
| 3 | StartDate | datetime | N |  |  |
| 4 | EndDate | datetime | N |  |  |
| 5 | TaxLedgerStatus | tinyint | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | WithVoucherDescription | bit | N | ((1)) |  |
| 12 | WithSl | bit | N | ((1)) |  |
| 13 | SubmissionMethod | tinyint | N |  |  |

- **Primary key:** TaxLedgerID
- **FK** `FK_TaxLedger_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TaxLedger_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TaxLedger_Company` (CompanyID) -> CFG.Company (CompanyID)
- **Referenced by:** CFG.TaxLedgerItem (TaxLedgerID)

### CFG.TaxLedgerItem

Rows: 60741

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaxLedgerItemID | int | N |  | identity |
| 2 | TaxLedgerID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | GlAccountCode | nvarchar(10) | Y |  |  |
| 6 | GlAccountTitle | nvarchar(256) | Y |  |  |
| 7 | SlAccountCode | nvarchar(10) | Y |  |  |
| 8 | SlAccountTitle | nvarchar(256) | Y |  |  |
| 9 | Description | nvarchar(256) | Y |  |  |
| 10 | DebitAmount | decimal(36,10) | Y |  |  |
| 11 | CreditAmount | decimal(36,10) | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TaxLedgerItemID
- **index** `IX_TaxLedgerItem_TaxLedgerID_RowIndex` (TaxLedgerID, RowIndex, GlAccountCode, CreditAmount) include (Date, GlAccountTitle, SlAccountCode, SlAccountTitle, Description, DebitAmount, Version)
- **FK** `FK_TaxLedgerItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TaxLedgerItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TaxLedgerItem_TaxLedger` (TaxLedgerID) -> CFG.TaxLedger (TaxLedgerID) on delete CASCADE

### CFG.TRecordLevelAccess

Rows: 1155 | دسترسی در سطح رکورد

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RecordLevelAccessID | int | N |  | identity |
| 2 | UserID | int | N |  |  |
| 3 | EntityRef | int | N |  |  |
| 4 | Type | smallint | N |  | شعبه = 7 انبار = 9 |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** RecordLevelAccessID
- **unique index** `IX_RecordLevelAccess` (UserID, EntityRef, Type)
- **FK** `FK_RecordLevelAccess_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RecordLevelAccess_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RecordLevelAccess_User` (UserID) -> CFG.User (UserID) on delete CASCADE

### CFG.User

Rows: 38

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserID | int | N |  | identity |
| 2 | Username | nvarchar(256) | N |  |  |
| 3 | Name | nvarchar(512) | N |  |  |
| 4 | Password | nvarchar(512) | N |  |  |
| 5 | IsActive | bit | N |  |  |
| 6 | PartyID | bigint | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Code | int | N |  |  |
| 13 | Name2 | nvarchar(512) | N |  |  |
| 14 | Data_Hash | nvarchar(512) | Y |  |  |
| 15 | ExternalLoginId | nvarchar(150) | Y |  |  |
| 16 | IpPolicyId | int | Y |  |  |
| 17 | TimePolicyID | int | Y |  |  |
| 18 | IsTwoFactor | bit | N | ((0)) |  |
| 19 | TwoFactorSecretKey | nvarchar(128) | Y |  |  |
| 20 | AccessInfo | nvarchar(MAX) | Y |  |  |
| 21 | DenyAccessInfo | nvarchar(MAX) | Y |  |  |
| 22 | SessionTimeOutPolicyID | int | Y |  |  |
| 23 | IsPurchaseExpert | bit | Y |  |  |

- **Primary key:** UserID
- **unique index** `IX_User` (Username)
- **unique index** `IX_Code` (Code)
- **FK** `FK_User_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_User_LastUpdateUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_User_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_User_SessionTimeOutPolicyID` (SessionTimeOutPolicyID) -> CFG.SystemPolicy (SystemPolicyID)
- **Referenced by:** ACC.AccCurrencyExchangeAccountLevel (Creator); ACC.AccCurrencyExchangeAccountLevel (LastEditor); ACC.AccCurrencyExchangeItem (Creator); ACC.AccCurrencyExchangeItem (LastEditor); ACC.AccCurrencyExchangeItemAccountLevel (Creator); ACC.AccCurrencyExchangeItemAccountLevel (LastEditor); ACC.AccountLevel (Creator); ACC.AccountLevel (LastEditor); ACC.AccountLevelItem (Creator); ACC.AccountLevelItem (LastEditor); ACC.AccountLevelSL (Creator); ACC.AccountLevelSL (LastEditor); ACC.AccountLevelVoucherItem (Creator); ACC.AccountLevelVoucherItem (LastEditor); ACC.BalanceType (Creator); ACC.BalanceType (LastEditor); ACC.DL (Creator); ACC.DL (LastEditor); ACC.DlType (Creator); ACC.DlType (LastEditor); ACC.DocumentType (Creator); ACC.DocumentType (LastEditor); ACC.GIVoucher (Creator); ACC.GIVoucher (LastEditor); ACC.GIVoucherItem (Creator); ACC.GIVoucherItem (LastEditor); ACC.PreVoucher (Creator); ACC.PreVoucher (LastEditor); ACC.PreVoucherItem (Creator); ACC.PreVoucherItem (LastEditor); ACC.PreVoucherItemAccountLevel (Creator); ACC.PreVoucherItemAccountLevel (LastEditor); ACC.SL (Creator); ACC.SL (LastEditor); ACC.SlTreeLevel (Creator); ACC.SlTreeLevel (LastEditor); ACC.UsedDlType (Creator); ACC.UsedDlType (LastEditor); ACC.VatRate (Creator); ACC.VatRate (LastEditor); ACC.Voucher (Corroborator); ACC.Voucher (Creator); ACC.Voucher (LastEditor); ACC.Voucher (Reviewer); ACC.VoucherAnalyze (Creator); ACC.VoucherAnalyze (LastEditor); ACC.VoucherCoverSetting (Creator); ACC.VoucherCoverSetting (LastEditor); ACC.VoucherItem (Creator); ACC.VoucherItem (LastEditor); ACC.VoucherPrevoucher (Creator); ACC.VoucherPrevoucher (LastEditor); APS.AnalysisCube (Creator); APS.AnalysisCube (LastEditor); APT.ApportionAccounting (Creator); APT.ApportionAccounting (LastEditor); APT.ApportionAccountingAccountLevel (Creator); APT.ApportionAccountingAccountLevel (LastEditor); APT.ApportionBase (Creator); APT.ApportionBase (LastEditor); APT.ApportionBaseValue (Creator); APT.ApportionBaseValue (LastEditor); APT.ApportionCalculation (Creator); APT.ApportionCalculation (LastEditor); APT.ApportionCalculationAccountLevel (Creator); APT.ApportionCalculationAccountLevel (LastEditor); APT.ApportionCalculationItem (Creator); APT.ApportionCalculationItem (LastEditor); APT.ApportionGroup (Creator); APT.ApportionGroup (LastEditor); APT.ApportionPeriod (Creator); APT.ApportionPeriod (LastEditor); APT.ApportionPeriodCalculation (Creator); APT.ApportionPeriodCalculation (LastEditor); APT.PortionedTo (Creator); APT.PortionedTo (LastEditor); APT.PortionedToDl (Creator); APT.PortionedToDl (LastEditor); APT.Portioner (Creator); APT.Portioner (LastEditor); APT.PortionerAccountLevel (Creator); APT.PortionerAccountLevel (LastEditor); APT.PortionerItem (Creator); APT.PortionerItem (LastEditor); APT.Portioning (Creator); APT.Portioning (LastEditor); APT.PortioningItem (Creator); APT.PortioningItem (LastEditor); AST.Adjustment (Creator); AST.Adjustment (LastEditor); AST.AdjustmentItem (Creator); AST.AdjustmentItem (LastEditor); AST.Asset (Creator); AST.Asset (LastEditor); AST.AssetCapacity (Creator); AST.AssetCapacity (LastEditor); AST.AssetCategory (Creator); AST.AssetCategory (LastEditor); AST.AssetCategorySpecification (Creator); AST.AssetCategorySpecification (LastEditor); AST.AssetCertificate (Creator); AST.AssetCertificate (LastEditor); AST.AssetClosingOperation (Creator); AST.AssetClosingOperation (LastEditor); AST.AssetItem (Creator); AST.AssetItem (LastEditor); AST.AssetReceipt (Creator); AST.AssetReceipt (LastEditor); AST.AssetReceiptItem (Creator); AST.AssetReceiptItem (LastEditor); AST.AssetReceiptUtilizationCost (Creator); AST.AssetReceiptUtilizationCost (LastEditor); AST.AssetSetting (Creator); AST.AssetSetting (LastEditor); AST.AssetSettingDl (Creator); AST.AssetSettingDl (LastEditor); AST.AssetSettingPerformance (Creator); AST.AssetSettingPerformance (LastEditor); AST.CategoryAccount (Creator); AST.CategoryAccount (LastEditor); AST.ChangeCategory (Creator); AST.ChangeCategory (LastEditor); AST.ChangeCategoryItem (Creator); AST.ChangeCategoryItem (LastEditor); AST.ChangePlauqe (Creator); AST.ChangePlauqe (LastEditor); AST.ChangePosition (Creator); AST.ChangePosition (LastEditor); AST.Creation (Creator); AST.Creation (LastEditor); AST.DeployPlace (Creator); AST.DeployPlace (LastEditor); AST.Depreciation (Creator); AST.Depreciation (LastEditor); AST.DepreciationPeriod (Creator); AST.DepreciationPeriod (LastEditor); AST.Destruction (Creator); AST.Destruction (LastEditor); AST.DestructionItem (Creator); AST.DestructionItem (LastEditor); AST.DestructionReason (Creator); AST.DestructionReason (LastEditor); AST.Insurance (Creator); AST.Insurance (LastEditor); AST.InsuranceItem (Creator); AST.InsuranceItem (LastEditor); AST.InsuranceType (Creator); AST.InsuranceType (LastEditor); AST.ReceivedFromBranch (Creator); AST.ReceivedFromBranch (LastEditor); AST.ReceivedFromBranchItem (Creator); AST.ReceivedFromBranchItem (LastEditor); AST.Repair (Creator); AST.Repair (LastEditor); AST.RepairServiceCost (Creator); AST.RepairServiceCost (LastEditor); AST.RepairStuffCost (Creator); AST.RepairStuffCost (LastEditor); AST.Revaluation (Creator); AST.Revaluation (LastEditor); AST.RevaluationItem (Creator); AST.RevaluationItem (LastEditor); AST.Sale (Creator); AST.Sale (LastEditor); AST.SaleItem (Creator); AST.SaleItem (LastEditor); AST.Salvage (Creator); AST.Salvage (LastEditor); AST.SalvageItem (Creator); AST.SalvageItem (LastEditor); AST.Statement (Creator); AST.Statement (LastEditor); AST.StatementItem (Creator); AST.StatementItem (LastEditor); AST.Transfer (Creator); AST.Transfer (LastEditor); AST.TransferItem (Creator); AST.TransferItem (LastEditor); AST.UtilizationCost (Creator); AST.UtilizationCost (LastEditor); AST.UtilizationStatus (Creator); AST.UtilizationStatus (LastEditor); ATN.AtnParameterCalculationResult (Creator); ATN.AtnParameterCalculationResult (LastEditor); ATN.AttendanceCalculationMethod (Creator); ATN.AttendanceCalculationMethod (LastEditor); ATN.AttendanceCalculationMethodFormula (Creator); ATN.AttendanceCalculationMethodFormula (LastEditor); ATN.AttendanceCalculationMethodFormulaParameter (Creator); ATN.AttendanceCalculationMethodFormulaParameter (LastEditor); ATN.AttendanceCalculationPersonnel (Creator); ATN.AttendanceCalculationPersonnel (LastEditor); ATN.AttendanceCalendar (Creator); ATN.AttendanceCalendar (LastEditor); ATN.AttendanceChangeRequest (Creator); ATN.AttendanceChangeRequest (LastEditor); ATN.AttendanceChangeRequest (ReviewerID); ATN.AttendanceDevice (Creator); ATN.AttendanceDevice (LastEditor); ATN.AttendanceGroup (Creator); ATN.AttendanceGroup (LastEditor); ATN.AttendanceGroupType (Creator); ATN.AttendanceGroupType (LastEditor); ATN.AttendanceParameter (Creator); ATN.AttendanceParameter (LastEditor); ATN.AttendanceShift (Creator); ATN.AttendanceShift (LastEditor); ATN.AttendanceShiftItem (Creator); ATN.AttendanceShiftItem (LastEditor); ATN.AttendanceTimeInterpretation (Creator); ATN.AttendanceTimeInterpretation (LastEditor); ATN.AttendanceTimeInterpretationItem (Creator); ATN.AttendanceTimeInterpretationItem (LastEditor); ATN.EntryAndExit (Creator); ATN.EntryAndExit (LastEditor); ATN.GroupAssignment (Creator); ATN.GroupAssignment (LastEditor); ATN.JustificationRegistration (Creator); ATN.JustificationRegistration (LastEditor); ATN.LeaveRequest (Creator); ATN.LeaveRequest (LastEditor); ATN.LeaveRequest (ReviewerID); ATN.MissionReport (Creator); ATN.MissionReport (LastEditor); ATN.MissionRequest (Creator); ATN.MissionRequest (LastEditor); ATN.MissionType (Creator); ATN.MissionType (LastEditor); ATN.PayParameterCalculationResult (Creator); ATN.PayParameterCalculationResult (LastEditor); ATN.PersonelAttendanceDevice (Creator); ATN.PersonelAttendanceDevice (LastEditor); ATN.PersonelRequest (Creator); ATN.PersonelRequest (LastEditor); ATN.PersonnelShiftAssignmentItem (Creator); ATN.PersonnelShiftAssignmentItem (LastEditor); ATN.RequestType (Creator); ATN.RequestType (LastEditor); ATN.VacancyEdition (Creator); ATN.VacancyEdition (LastEditor); ATN.VacancyEstablishment (Creator); ATN.VacancyEstablishment (LastEditor); ATN.VacancyNature (Creator); ATN.VacancyNature (LastEditor); ATN.VacancyType (Creator); ATN.VacancyType (LastEditor); ATN.VacancyTypeAssignmentItem (Creator); ATN.VacancyTypeAssignmentItem (LastEditor); ATN.VacancyTypeItem (Creator); ATN.VacancyTypeItem (LastEditor); CFG.ActivityArea (Creator); CFG.ActivityArea (LastEditor); CFG.Address (Creator); CFG.Address (LastEditor); CFG.AddressType (Creator); CFG.AddressType (LastEditor); CFG.Backup (Creator); CFG.Backup (LastEditor); CFG.Bank (Creator); CFG.Bank (LastEditor); CFG.BankAccount (Creator); CFG.BankAccount (LastEditor); CFG.BankAccountType (Creator); CFG.BankAccountType (LastEditor); CFG.BankBranch (Creator); CFG.BankBranch (LastEditor); CFG.Branch (Creator); CFG.Branch (LastEditor); CFG.Cash (Creator); CFG.Cash (LastEditor); CFG.CashBalance (Creator); CFG.CashBalance (LastEditor); CFG.Comment (Creator); CFG.Comment (LastEditor); CFG.Company (Creator); CFG.Company (LastEditor); CFG.CompanyImage (Creator); CFG.CompanyImage (LastEditor); CFG.CompanyTaxData (Creator); CFG.CompanyTaxData (LastEditor); CFG.CompanyVatItem (Creator); CFG.CompanyVatItem (LastEditor); CFG.Configuration (Creator); CFG.Configuration (LastEditor); CFG.CostCenter (Creator); CFG.CostCenter (LastEditor); CFG.Currency (Creator); CFG.Currency (LastEditor); CFG.CurrencyRate (Creator); CFG.CurrencyRate (LastEditor); CFG.CustomAction (Creator); CFG.CustomAction (LastEditor); CFG.Customs (Creator); CFG.Customs (LastEditor); CFG.DebitCreditNote (Creator); CFG.DebitCreditNote (LastEditor); CFG.DebitCreditNoteItem (Creator); CFG.DebitCreditNoteItem (LastEditor); CFG.DocumentNum (Creator); CFG.DocumentNum (LastEditor); CFG.DocumentNumResetNumberBase (Creator); CFG.DocumentNumResetNumberBase (LastEditor); CFG.DocumentNumResetNumberBaseType (Creator); CFG.DocumentNumResetNumberBaseType (LastEditor); CFG.DocumentNumType (Creator); CFG.DocumentNumType (LastEditor); CFG.EntityCustomeField (Creator); CFG.EntityCustomeField (LastEditor); CFG.ExecutionLocation (Creator); CFG.ExecutionLocation (LastEditor); CFG.FileAttachment (Creator); CFG.FileAttachment (LastEditor); CFG.FileAttachmentType (Creator); CFG.FileAttachmentType (LastEditor); CFG.FileDirectory (Creator); CFG.FileDirectory (LastEditor); CFG.FileItem (Creator); CFG.FileItem (LastEditor); CFG.FinancialPeriod (Creator); CFG.FinancialPeriod (LastEditor); CFG.Group (Creator); CFG.Group (LastEditor); CFG.HoldingStructure (Creator); CFG.HoldingStructure (LastEditor); CFG.InstallmentPayment (Creator); CFG.InstallmentPayment (LastEditor); CFG.InstallmentPaymentItem (Creator); CFG.InstallmentPaymentItem (LastEditor); CFG.InternalAudit (Creator); CFG.InternalAudit (LastEditor); CFG.Introduction (Creator); CFG.Introduction (LastEditor); CFG.Location (Creator); CFG.Location (LastEditor); CFG.LocationType (Creator); CFG.LocationType (LastEditor); CFG.LookupData (Creator); CFG.LookupData (LastEditor); CFG.LookupDataItem (Creator); CFG.LookupDataItem (LastEditor); CFG.Message (Creator); CFG.Message (LastEditor); CFG.Message (SenderID); CFG.MessageRecipient (Creator); CFG.MessageRecipient (LastEditor); CFG.MessageRecipient (ReceiverID); CFG.MessageUserDeletion (UserID); CFG.NumberingPattern (Creator); CFG.NumberingPattern (LastEditor); CFG.NumberingPatternItem (Creator); CFG.NumberingPatternItem (LastEditor); CFG.OrganizationUnit (Creator); CFG.OrganizationUnit (LastEditor); CFG.Party (Creator); CFG.Party (LastEditor); CFG.PartyAccount (Creator); CFG.PartyAccount (LastEditor); CFG.PeriodicTask (Creator); CFG.PeriodicTask (LastEditor); CFG.Phone (Creator); CFG.Phone (LastEditor); CFG.RecordLevelSetting (Creator); CFG.RecordLevelSetting (LastEditor); CFG.RelatedPerson (Creator); CFG.RelatedPerson (LastEditor); CFG.SaturnCustomType (Creator); CFG.SaturnCustomType (LastEditor); CFG.SaturnDataSource (Creator); CFG.SaturnDataSource (LastEditor); CFG.SaturnDataSourceParam (Creator); CFG.SaturnDataSourceParam (LastEditor); CFG.SaturnReport (Creator); CFG.SaturnReport (LastEditor); CFG.SaturnReportGroup (Creator); CFG.SaturnReportGroup (LastEditor); CFG.SeasonFile (Creator); CFG.SeasonFile (LastEditor); CFG.SecurityConfiguration (Creator); CFG.SecurityConfiguration (LastEditor); CFG.StandardDescription (Creator); CFG.StandardDescription (LastEditor); CFG.SystemPolicy (Creator); CFG.SystemPolicy (LastEditor); CFG.TaxLedger (Creator); CFG.TaxLedger (LastEditor); CFG.TaxLedgerItem (Creator); CFG.TaxLedgerItem (LastEditor); CFG.TRecordLevelAccess (Creator); CFG.TRecordLevelAccess (LastEditor); CFG.TRecordLevelAccess (UserID); CFG.User (Creator); CFG.User (LastEditor); CFG.UserGroup (Creator); CFG.UserGroup (LastEditor); CFG.UserGroup (UserAdminID); CFG.UserGroupUser (Creator); CFG.UserGroupUser (LastEditor); CFG.UserGroupUser (UserID); CFG.UserLoginHistory (UserID); CFG.UserSetting (Creator); CFG.UserSetting (LastEditor); CFG.UserSetting (UserID); CFG.UserSignature (Creator); CFG.UserSignature (LastEditor); CFG.UserSignature (UserID); CFG.Vat (Creator); CFG.Vat (LastEditor); CFG.VatItem (Creator); CFG.VatItem (LastEditor); CFG.Work (Creator); CFG.Work (LastEditor); CFG.WorkType (Creator); CFG.WorkType (LastEditor); CNT.AdditionDeductionType (Creator); CNT.AdditionDeductionType (LastEditor); CNT.AdditionDeductionTypeMethod (Creator); CNT.AdditionDeductionTypeMethod (LastEditor); CNT.AdditionDeductionTypeMethodFormula (Creator); CNT.AdditionDeductionTypeMethodFormula (LastEditor); CNT.ConfirmStatement (Creator); CNT.ConfirmStatement (LastEditor); CNT.ConfirmStatementItem (Creator); CNT.ConfirmStatementItem (LastEditor); CNT.Contract (Creator); CNT.Contract (LastEditor); CNT.ContractContinuation (Creator); CNT.ContractContinuation (LastEditor); CNT.ContractDeduction (Creator); CNT.ContractDeduction (LastEditor); CNT.ContractParty (Creator); CNT.ContractParty (LastEditor); CNT.ContractStatement (Creator); CNT.ContractStatement (LastEditor); CNT.ContractStatementAnalysis (Creator); CNT.ContractStatementAnalysis (LastEditor); CNT.ContractStatementAnalysisItem (Creator); CNT.ContractStatementAnalysisItem (LastEditor); CNT.ContractStatementDetail (Creator); CNT.ContractStatementDetail (LastEditor); CNT.ContractStatementItem (Creator); CNT.ContractStatementItem (LastEditor); CNT.ContractStatementType (Creator); CNT.ContractStatementType (LastEditor); CNT.ContractSubject (Creator); CNT.ContractSubject (LastEditor); CNT.ContractType (Creator); CNT.ContractType (LastEditor); CNT.UnDepreciatedPayment (Creator); CNT.UnDepreciatedPayment (LastEditor); CTM.Order (Creator); CTM.Order (LastEditor); CTM.OrderItem (Creator); CTM.OrderItem (LastEditor); CTM.OrderItemTrace (Creator); CTM.OrderItemTrace (LastEditor); CTM.OrderSaleAgent (Creator); CTM.OrderSaleAgent (LastEditor); CTM.Reception (Creator); CTM.Reception (LastEditor); CTM.ReceptionItem (Creator); CTM.ReceptionItem (LastEditor); CTM.ReceptionItemTrace (Creator); CTM.ReceptionItemTrace (LastEditor); CTM.ReceptionStatus (Creator); CTM.ReceptionStatus (LastEditor); CTM.ReceptionTrace (Creator); CTM.ReceptionTrace (LastEditor); CTM.ReceptionType (Creator); CTM.ReceptionType (LastEditor); CTM.ShoppingCart (Creator); CTM.ShoppingCart (LastEditor); CTM.SubscribeCard (Creator); CTM.SubscribeCard (LastEditor); CTM.SubscribeCardCharge (Creator); CTM.SubscribeCardCharge (LastEditor); CTM.SubscribeCardChargeType (Creator); CTM.SubscribeCardChargeType (LastEditor); DMS.Document (Creator); DMS.Document (LastEditor); DMS.DocumentStoreChange (UserID); EDU.CheckExam (Creator); EDU.CheckExam (LastEditor); EDU.CheckExamItem (Creator); EDU.CheckExamItem (LastEditor); EDU.CostElement (Creator); EDU.CostElement (LastEditor); EDU.Course (Creator); EDU.Course (LastEditor); EDU.CourseCostEstimation (Creator); EDU.CourseCostEstimation (LastEditor); EDU.CourseCostEstimationItem (Creator); EDU.CourseCostEstimationItem (LastEditor); EDU.CourseExamType (Creator); EDU.CourseExamType (LastEditor); EDU.CourseExamTypeItem (Creator); EDU.CourseExamTypeItem (LastEditor); EDU.CourseExamTypeItemFormula (Creator); EDU.CourseExamTypeItemFormula (LastEditor); EDU.CourseLocation (Creator); EDU.CourseLocation (LastEditor); EDU.CoursePlaningCondition (Creator); EDU.CoursePlaningCondition (LastEditor); EDU.CoursePlaningConditionCourse (Creator); EDU.CoursePlaningConditionCourse (LastEditor); EDU.CoursePlaningConditionEmploymentType (Creator); EDU.CoursePlaningConditionEmploymentType (LastEditor); EDU.CoursePlaningConditionFlowChart (Creator); EDU.CoursePlaningConditionFlowChart (LastEditor); EDU.CoursePlaningConditionJob (Creator); EDU.CoursePlaningConditionJob (LastEditor); EDU.CoursePlaningConditionPosition (Creator); EDU.CoursePlaningConditionPosition (LastEditor); EDU.CoursePlaningConditionStudyDegree (Creator); EDU.CoursePlaningConditionStudyDegree (LastEditor); EDU.CoursePlaningConditionStudyField (Creator); EDU.CoursePlaningConditionStudyField (LastEditor); EDU.CoursePlaningItem (Creator); EDU.CoursePlaningItem (LastEditor); EDU.CoursePlaningResult (Creator); EDU.CoursePlaningResult (LastEditor); EDU.CoursePlaningResultScore (Creator); EDU.CoursePlaningResultScore (LastEditor); EDU.CoursePlanning (Creator); EDU.CoursePlanning (LastEditor); EDU.CourseRegistration (Creator); EDU.CourseRegistration (LastEditor); EDU.CourseRegistrationItem (Creator); EDU.CourseRegistrationItem (LastEditor); EDU.CourseRequest (Creator); EDU.CourseRequest (LastEditor); EDU.CourseRequestCoursePlaning (Creator); EDU.CourseRequestCoursePlaning (LastEditor); EDU.CourseType (Creator); EDU.CourseType (LastEditor); EDU.Rollcall (Creator); EDU.Rollcall (LastEditor); EDU.RollcallItem (Creator); EDU.RollcallItem (LastEditor); EDU.Teacher (Creator); EDU.Teacher (LastEditor); EDU.TeacherEducation (Creator); EDU.TeacherEducation (LastEditor); EDU.TeacherExperience (Creator); EDU.TeacherExperience (LastEditor); EDU.TeacherSchooling (Creator); EDU.TeacherSchooling (LastEditor); FIN.BankBill (Creator); FIN.BankBill (LastEditor); FIN.BankBillItem (Creator); FIN.BankBillItem (LastEditor); FIN.Book (Creator); FIN.Book (LastEditor); FIN.BookItem (Creator); FIN.BookItem (LastEditor); FIN.CashLevel (Creator); FIN.CashLevel (LastEditor); FIN.CashStructure (Creator); FIN.CashStructure (LastEditor); FIN.CashTransfer (Creator); FIN.CashTransfer (LastEditor); FIN.CashTransferItem (Creator); FIN.CashTransferItem (LastEditor); FIN.CheqeBook (Creator); FIN.CheqeBook (LastEditor); FIN.CommitmentType (Creator); FIN.CommitmentType (LastEditor); FIN.Fund (Creator); FIN.Fund (LastEditor); FIN.GuarantyOperation (Creator); FIN.GuarantyOperation (LastEditor); FIN.PaymentBankDraft (Creator); FIN.PaymentBankDraft (LastEditor); FIN.PaymentCash (Creator); FIN.PaymentCash (LastEditor); FIN.PaymentCheqe (Creator); FIN.PaymentCheqe (LastEditor); FIN.PaymentCheqeCommitment (Creator); FIN.PaymentCheqeCommitment (LastEditor); FIN.PaymentCheqeFlow (Creator); FIN.PaymentCheqeFlow (LastEditor); FIN.PaymentCheqeFlowItem (Creator); FIN.PaymentCheqeFlowItem (LastEditor); FIN.PaymentCheqeType (Creator); FIN.PaymentCheqeType (LastEditor); FIN.PaymentCommitment (Creator); FIN.PaymentCommitment (LastEditor); FIN.PaymentCommitmentRecall (Creator); FIN.PaymentCommitmentRecall (LastEditor); FIN.PaymentCommitmentRecallItem (Creator); FIN.PaymentCommitmentRecallItem (LastEditor); FIN.PaymentGuarantyCommitment (Creator); FIN.PaymentGuarantyCommitment (LastEditor); FIN.PaymentOtherCheqe (Creator); FIN.PaymentOtherCheqe (LastEditor); FIN.PaymentPromissoryCommitment (Creator); FIN.PaymentPromissoryCommitment (LastEditor); FIN.PaymentReceipt (Creator); FIN.PaymentReceipt (LastEditor); FIN.PaymentSubject (Creator); FIN.PaymentSubject (LastEditor); FIN.PaymentType (Creator); FIN.PaymentType (LastEditor); FIN.PettyCash (Creator); FIN.PettyCash (LastEditor); FIN.PettyCashCharging (Creator); FIN.PettyCashCharging (LastEditor); FIN.PettyCashChargingItem (Creator); FIN.PettyCashChargingItem (LastEditor); FIN.PettyCashCost (Creator); FIN.PettyCashCost (LastEditor); FIN.PettyCashCostItem (Creator); FIN.PettyCashCostItem (LastEditor); FIN.PettyCashCostItemAccountLevel (Creator); FIN.PettyCashCostItemAccountLevel (LastEditor); FIN.ReceiptCheqeFlow (Creator); FIN.ReceiptCheqeFlow (LastEditor); FIN.ReceiptCheqeFlowItem (Creator); FIN.ReceiptCheqeFlowItem (LastEditor); FIN.ReceiptType (Creator); FIN.ReceiptType (LastEditor); FIN.ReceiveCheqeCommitment (Creator); FIN.ReceiveCheqeCommitment (LastEditor); FIN.ReceiveCommitment (Creator); FIN.ReceiveCommitment (LastEditor); FIN.ReceiveCommitmentRecall (Creator); FIN.ReceiveCommitmentRecall (LastEditor); FIN.ReceiveCommitmentRecallItem (Creator); FIN.ReceiveCommitmentRecallItem (LastEditor); FIN.ReceivedBankDraft (Creator); FIN.ReceivedBankDraft (LastEditor); FIN.ReceivedCash (Creator); FIN.ReceivedCash (LastEditor); FIN.ReceivedCheqe (Creator); FIN.ReceivedCheqe (LastEditor); FIN.ReceiveGuarantyCommitment (Creator); FIN.ReceiveGuarantyCommitment (LastEditor); FIN.ReceivePromissoryCommitment (Creator); FIN.ReceivePromissoryCommitment (LastEditor); FIN.ReceiveReceipt (Creator); FIN.ReceiveReceipt (LastEditor); FIN.ReceiveSubject (Creator); FIN.ReceiveSubject (LastEditor); FIN.ReconciledBillItem (Creator); FIN.ReconciledBillItem (LastEditor); FIN.ReconciledBookItem (Creator); FIN.ReconciledBookItem (LastEditor); FIN.Reconciliation (Creator); FIN.Reconciliation (LastEditor); FLW.WfProcess (Creator); FLW.WfProcess (LastEditor); FOS.BillOfLading (Creator); FOS.BillOfLading (LastEditor); FOS.BillOfLadingItem (Creator); FOS.BillOfLadingItem (LastEditor); FOS.Clearance (Creator); FOS.Clearance (LastEditor); FOS.ClearanceCustomsCost (Creator); FOS.ClearanceCustomsCost (LastEditor); FOS.ClearanceItem (Creator); FOS.ClearanceItem (LastEditor); FOS.CostOfOrder (Creator); FOS.CostOfOrder (LastEditor); FOS.CostOfOrderItem (Creator); FOS.CostOfOrderItem (LastEditor); FOS.CreditAllocation (Creator); FOS.CreditAllocation (LastEditor); FOS.CreditAllocationItem (Creator); FOS.CreditAllocationItem (LastEditor); FOS.LadingType (Creator); FOS.LadingType (LastEditor); FOS.LetterCredit (Creator); FOS.LetterCredit (LastEditor); FOS.LetterCreditBankCost (Creator); FOS.LetterCreditBankCost (LastEditor); FOS.LetterCreditGuarantee (Creator); FOS.LetterCreditGuarantee (LastEditor); FOS.LetterCreditType (Creator); FOS.LetterCreditType (LastEditor); FOS.OrderPricing (Creator); FOS.OrderPricing (LastEditor); FOS.OrderPricingCost (Creator); FOS.OrderPricingCost (LastEditor); FOS.OrderPricingItem (Creator); FOS.OrderPricingItem (LastEditor); FOS.ProformaInvoice (Creator); FOS.ProformaInvoice (LastEditor); FOS.ProformaInvoiceItem (Creator); FOS.ProformaInvoiceItem (LastEditor); FOS.Registration (Creator); FOS.Registration (LastEditor); FOS.ShippingInsurance (Creator); FOS.ShippingInsurance (LastEditor); FOS.ShippingInsuranceType (Creator); FOS.ShippingInsuranceType (LastEditor); FOS.SpecialCost (Creator); FOS.SpecialCost (LastEditor); FSS.CodingReportStructure (Creator); FSS.CodingReportStructure (LastEditor); FSS.CodingReportStructureSl (Creator); FSS.CodingReportStructureSl (LastEditor); FSS.CodingReportStructureSlReportColumn (Creator); FSS.CodingReportStructureSlReportColumn (LastEditor); FSS.FinancialStatement (Creator); FSS.FinancialStatement (LastEditor); FSS.Report (Creator); FSS.Report (LastEditor); FSS.ReportColumn (Creator); FSS.ReportColumn (LastEditor); FSS.ReportResult (Creator); FSS.ReportResult (LastEditor); FSS.Topic (Creator); FSS.Topic (LastEditor); FSS.TopicReportStructure (Creator); FSS.TopicReportStructure (LastEditor); FSS.TopicReportStructureCoding (Creator); FSS.TopicReportStructureCoding (LastEditor); FSS.TopicReportStructureCodingAccountLevel (Creator); FSS.TopicReportStructureCodingAccountLevel (LastEditor); FSS.TopicReportStructureFormulaPrameter (Creator); FSS.TopicReportStructureFormulaPrameter (LastEditor); HRM.Agreement (ConfirmedBy); HRM.Agreement (Creator); HRM.Agreement (LastEditor); HRM.AgreementBaseValue (Creator); HRM.AgreementBaseValue (LastEditor); HRM.AgreementBatchModel (Creator); HRM.AgreementBatchModel (LastEditor); HRM.AgreementBatchModelFormula (Creator); HRM.AgreementBatchModelFormula (LastEditor); HRM.AgreementBatchModelFormulaParameter (Creator); HRM.AgreementBatchModelFormulaParameter (LastEditor); HRM.AgreementOrganization (Creator); HRM.AgreementOrganization (LastEditor); HRM.AgreementParameter (Creator); HRM.AgreementParameter (LastEditor); HRM.AgreementTranscript (Creator); HRM.AgreementTranscript (LastEditor); HRM.AgreementType (Creator); HRM.AgreementType (LastEditor); HRM.AgreementTypeForm (Creator); HRM.AgreementTypeForm (LastEditor); HRM.AgreementTypeInterpretation (Creator); HRM.AgreementTypeInterpretation (LastEditor); HRM.AgreementTypePrePersonelStatus (Creator); HRM.AgreementTypePrePersonelStatus (LastEditor); HRM.AgreementTypeTranscript (Creator); HRM.AgreementTypeTranscript (LastEditor); HRM.BaseValue (Creator); HRM.BaseValue (LastEditor); HRM.BaseValueData (Creator); HRM.BaseValueData (LastEditor); HRM.BaseValuePaymentSystem (Creator); HRM.BaseValuePaymentSystem (LastEditor); HRM.Calendar (Creator); HRM.Calendar (LastEditor); HRM.CalendarMonth (Creator); HRM.CalendarMonth (LastEditor); HRM.CertificateType (Creator); HRM.CertificateType (LastEditor); HRM.ChangePersonelStatus1 (Creator); HRM.ChangePersonelStatus1 (LastEditor); HRM.Confirmation (Creator); HRM.Confirmation (LastEditor); HRM.ConfirmationForm (Creator); HRM.ConfirmationForm (LastEditor); HRM.ConfirmationType (Creator); HRM.ConfirmationType (LastEditor); HRM.CostRegistration (Creator); HRM.CostRegistration (LastEditor); HRM.CostRegistrationItem (Creator); HRM.CostRegistrationItem (LastEditor); HRM.Education (Creator); HRM.Education (LastEditor); HRM.EmployerShare (Creator); HRM.EmployerShare (LastEditor); HRM.EmploymentRequest (Creator); HRM.EmploymentRequest (LastEditor); HRM.EmploymentRequestCV (Creator); HRM.EmploymentRequestCV (LastEditor); HRM.EmploymentStatus (Creator); HRM.EmploymentStatus (LastEditor); HRM.EmploymentType (Creator); HRM.EmploymentType (LastEditor); HRM.EmploymentTypeEmploymentStatus (Creator); HRM.EmploymentTypeEmploymentStatus (LastEditor); HRM.EndReason (Creator); HRM.EndReason (LastEditor); HRM.Experience (Creator); HRM.Experience (LastEditor); HRM.FlowChart (Creator); HRM.FlowChart (LastEditor); HRM.Food (Creator); HRM.Food (LastEditor); HRM.FoodOrder (Creator); HRM.FoodOrder (LastEditor); HRM.FoodOrderItem (Creator); HRM.FoodOrderItem (LastEditor); HRM.FoodPlan (Creator); HRM.FoodPlan (LastEditor); HRM.FoodPlanItem (Creator); HRM.FoodPlanItem (LastEditor); HRM.FoodPrice (Creator); HRM.FoodPrice (LastEditor); HRM.FoodType (Creator); HRM.FoodType (LastEditor); HRM.FoodTypeItem (Creator); HRM.FoodTypeItem (LastEditor); HRM.Institue (Creator); HRM.Institue (LastEditor); HRM.Job (Creator); HRM.Job (LastEditor); HRM.JobGroup (Creator); HRM.JobGroup (LastEditor); HRM.OccupationGrade (Creator); HRM.OccupationGrade (LastEditor); HRM.Organization (Creator); HRM.Organization (LastEditor); HRM.OrganizationItem (Creator); HRM.OrganizationItem (LastEditor); HRM.OtherPersonnelInformation (Creator); HRM.OtherPersonnelInformation (LastEditor); HRM.PaymentSystem (Creator); HRM.PaymentSystem (LastEditor); HRM.PaymentSystemCalculationMethod (Creator); HRM.PaymentSystemCalculationMethod (LastEditor); HRM.PaymentSystemFormula (Creator); HRM.PaymentSystemFormula (LastEditor); HRM.PaymentSystemFormulaParameter (Creator); HRM.PaymentSystemFormulaParameter (LastEditor); HRM.PaymentTopic (Creator); HRM.PaymentTopic (LastEditor); HRM.PayrollBase (Creator); HRM.PayrollBase (LastEditor); HRM.PayrollGroup (Creator); HRM.PayrollGroup (LastEditor); HRM.Personel (Creator); HRM.Personel (LastEditor); HRM.PersonelAccount (Creator); HRM.PersonelAccount (LastEditor); HRM.PersonelDedication (Creator); HRM.PersonelDedication (LastEditor); HRM.PersonelFile (Creator); HRM.PersonelFile (LastEditor); HRM.PersonelMarriageStatus (Creator); HRM.PersonelMarriageStatus (LastEditor); HRM.PersonelStatus (Creator); HRM.PersonelStatus (LastEditor); HRM.Position (Creator); HRM.Position (LastEditor); HRM.PositionJob (Creator); HRM.PositionJob (LastEditor); HRM.Relative (Creator); HRM.Relative (LastEditor); HRM.ServingPlace (Creator); HRM.ServingPlace (LastEditor); HRM.StaffCost (Creator); HRM.StaffCost (LastEditor); HRM.StudyDegree (Creator); HRM.StudyDegree (LastEditor); HRM.StudyField (Creator); HRM.StudyField (LastEditor); HRM.TaxTable (Creator); HRM.TaxTable (LastEditor); HRM.TaxTableItem (Creator); HRM.TaxTableItem (LastEditor); HRM.TaxTableType (Creator); HRM.TaxTableType (LastEditor); HRM.Vacation (Creator); HRM.Vacation (LastEditor); HRM.WorkPlace (Creator); HRM.WorkPlace (LastEditor); HRM.WorkPosition (Creator); HRM.WorkPosition (LastEditor); NOC.AccrueAnalysing (Creator); NOC.AccrueAnalysing (LastEditor); NOC.AccrueDataCollection (Creator); NOC.AccrueDataCollection (LastEditor); NOC.Analysing (Creator); NOC.Analysing (LastEditor); NOC.CalculationTypeSetting (Creator); NOC.CalculationTypeSetting (LastEditor); NOC.CashAnalysing (Creator); NOC.CashAnalysing (LastEditor); NOC.CashAnalysingItem (Creator); NOC.CashAnalysingItem (LastEditor); NOC.CashDataCollection (Creator); NOC.CashDataCollection (LastEditor); NOC.CashFounding (Creator); NOC.CashFounding (LastEditor); NOC.ConfirmedReport (Creator); NOC.ConfirmedReport (LastEditor); NOC.CurrencyExchange (Creator); NOC.CurrencyExchange (LastEditor); NOC.DataCollection (Creator); NOC.DataCollection (LastEditor); NOC.FractionPayrollParameterSetting (Creator); NOC.FractionPayrollParameterSetting (LastEditor); NOC.Modification (Creator); NOC.Modification (LastEditor); NOC.ModifiedTopic (Creator); NOC.ModifiedTopic (LastEditor); NOC.NIOCAccountCode (Creator); NOC.NIOCAccountCode (LastEditor); NOC.NIOCSetting (Creator); NOC.NIOCSetting (LastEditor); NOC.ReportagePeriod (Creator); NOC.ReportagePeriod (LastEditor); NOC.ReportHeadline (Creator); NOC.ReportHeadline (LastEditor); PAY.CalculationAggregateExpression (Creator); PAY.CalculationAggregateExpression (LastEditor); PAY.CalculationFunction (Creator); PAY.CalculationFunction (LastEditor); PAY.CalculationMethod (Creator); PAY.CalculationMethod (LastEditor); PAY.CalculationPersonel (Creator); PAY.CalculationPersonel (LastEditor); PAY.CalculationResult (Creator); PAY.CalculationResult (LastEditor); PAY.CalculationType (Creator); PAY.CalculationType (LastEditor); PAY.Category (Creator); PAY.Category (LastEditor); PAY.CategoryParameterType (Creator); PAY.CategoryParameterType (LastEditor); PAY.Formula (Creator); PAY.Formula (LastEditor); PAY.FormulaMetaData (Creator); PAY.FormulaMetaData (LastEditor); PAY.FormulaParameter (Creator); PAY.FormulaParameter (LastEditor); PAY.Loan (Creator); PAY.Loan (LastEditor); PAY.Parameter (Creator); PAY.Parameter (LastEditor); PAY.ParameterConstantData (Creator); PAY.ParameterConstantData (LastEditor); PAY.ParameterMonthlyData (Creator); PAY.ParameterMonthlyData (LastEditor); PAY.ParameterMonthlyDataFilter (Creator); PAY.ParameterMonthlyDataFilter (LastEditor); PAY.ParameterMonthlyDataFilterEmploymentType (Creator); PAY.ParameterMonthlyDataFilterEmploymentType (LastEditor); PAY.ParameterMonthlyDataFilterParameter (Creator); PAY.ParameterMonthlyDataFilterParameter (LastEditor); PAY.ParameterOrder (Creator); PAY.ParameterOrder (LastEditor); PAY.ParameterType (Creator); PAY.ParameterType (LastEditor); PAY.ParameterValueType (Creator); PAY.ParameterValueType (LastEditor); PAY.PayPreparing (Creator); PAY.PayPreparing (LastEditor); PAY.PayPreparingItem (Creator); PAY.PayPreparingItem (LastEditor); PAY.PayrollAccConfiguration (Creator); PAY.PayrollAccConfiguration (LastEditor); PAY.PayrollAccConfigurationPartyType (Creator); PAY.PayrollAccConfigurationPartyType (LastEditor); PAY.PayrollAccGroup (Creator); PAY.PayrollAccGroup (LastEditor); PAY.PayrollDlType (Creator); PAY.PayrollDlType (LastEditor); PAY.PayrollFile (Creator); PAY.PayrollFile (LastEditor); PAY.PayrollFileItem (Creator); PAY.PayrollFileItem (LastEditor); PAY.PayrollListSetting (Creator); PAY.PayrollListSetting (LastEditor); PAY.PayrollPaymentType (Creator); PAY.PayrollPaymentType (LastEditor); PAY.PayrollPaymentTypeParameter (Creator); PAY.PayrollPaymentTypeParameter (LastEditor); PAY.PersonelVoucherSetting (Creator); PAY.PersonelVoucherSetting (LastEditor); PAY.PersonelVoucherSettingDl (Creator); PAY.PersonelVoucherSettingDl (LastEditor); PAY.Postpone (Creator); PAY.Postpone (LastEditor); PAY.PostponedLoan (Creator); PAY.PostponedLoan (LastEditor); PAY.SettlementCalculation (Creator); PAY.SettlementCalculation (LastEditor); PAY.TimeSheet (Creator); PAY.TimeSheet (LastEditor); PAY.TimeSheetCalculationResult (Creator); PAY.TimeSheetCalculationResult (LastEditor); POS.ActivityTime (Creator); POS.ActivityTime (LastEditor); POS.CardReader (Creator); POS.CardReader (LastEditor); POS.DeliverCheque (Creator); POS.DeliverCheque (LastEditor); POS.DeliverChequeItem (Creator); POS.DeliverChequeItem (LastEditor); POS.InstallmentAccumulation (Creator); POS.InstallmentAccumulation (LastEditor); POS.InstallmentAccumulationCalculation (Creator); POS.InstallmentAccumulationCalculation (LastEditor); POS.InstallmentAccumulationItem (Creator); POS.InstallmentAccumulationItem (LastEditor); POS.OrderFood (Creator); POS.OrderFood (LastEditor); POS.OrderFoodItem (Creator); POS.OrderFoodItem (LastEditor); POS.PosInvoice (Creator); POS.PosInvoice (LastEditor); POS.PosInvoiceItem (Creator); POS.PosInvoiceItem (LastEditor); POS.PosInvoiceItemTrace (Creator); POS.PosInvoiceItemTrace (LastEditor); POS.PosReceipt (Creator); POS.PosReceipt (LastEditor); POS.PosReceiptItem (Creator); POS.PosReceiptItem (LastEditor); POS.RestaurantTable (Creator); POS.RestaurantTable (LastEditor); POS.Station (Creator); POS.Station (LastEditor); POS.StationCardReader (Creator); POS.StationCardReader (LastEditor); POS.StationCash (Creator); POS.StationCash (LastEditor); POS.StationFixService (Creator); POS.StationFixService (LastEditor); POS.StationPrintGroup (Creator); POS.StationPrintGroup (LastEditor); POS.StationPrintGroupStuff (Creator); POS.StationPrintGroupStuff (LastEditor); POS.StationPrintSetting (Creator); POS.StationPrintSetting (LastEditor); POS.StationSaleAgent (Creator); POS.StationSaleAgent (LastEditor); POS.StationSaleModel (Creator); POS.StationSaleModel (LastEditor); POS.StationVitrin (Creator); POS.StationVitrin (LastEditor); POS.StationVitrinItem (Creator); POS.StationVitrinItem (LastEditor); POS.Subscription (Creator); POS.Subscription (LastEditor); PRM.BomGroup (Creator); PRM.BomGroup (LastEditor); PRM.CalculatedConversionCost (Creator); PRM.CalculatedConversionCost (LastEditor); PRM.CalculatedMaterialCost (Creator); PRM.CalculatedMaterialCost (LastEditor); PRM.CalculatedWorkStation (Creator); PRM.CalculatedWorkStation (LastEditor); PRM.ConsumptionStatistic (Creator); PRM.ConsumptionStatistic (LastEditor); PRM.ConsumptionStatisticItem (Creator); PRM.ConsumptionStatisticItem (LastEditor); PRM.ConsumptionStatisticItemTrace (Creator); PRM.ConsumptionStatisticItemTrace (LastEditor); PRM.CostCalculation (Creator); PRM.CostCalculation (LastEditor); PRM.CostCalculationPeriod (Creator); PRM.CostCalculationPeriod (LastEditor); PRM.CostCollectedData (Creator); PRM.CostCollectedData (LastEditor); PRM.CostDataCollectionAccountSetting (Creator); PRM.CostDataCollectionAccountSetting (LastEditor); PRM.CostDataCollectionSetting (Creator); PRM.CostDataCollectionSetting (LastEditor); PRM.CostDriver (Creator); PRM.CostDriver (LastEditor); PRM.CostDriverPeriodData (Creator); PRM.CostDriverPeriodData (LastEditor); PRM.CostStructure (Creator); PRM.CostStructure (LastEditor); PRM.CostStructureAccount (Creator); PRM.CostStructureAccount (LastEditor); PRM.CostStructureAccountItem (Creator); PRM.CostStructureAccountItem (LastEditor); PRM.Machinery (Creator); PRM.Machinery (LastEditor); PRM.MaterialPlanningSetting (Creator); PRM.MaterialPlanningSetting (LastEditor); PRM.PlanningItem (Creator); PRM.PlanningItem (LastEditor); PRM.PlanningItemTrace (Creator); PRM.PlanningItemTrace (LastEditor); PRM.ProductionAnalysis (Creator); PRM.ProductionAnalysis (LastEditor); PRM.ProductionAnalysisItem (Creator); PRM.ProductionAnalysisItem (LastEditor); PRM.ProductionAnalysisItemTrace (Creator); PRM.ProductionAnalysisItemTrace (LastEditor); PRM.ProductionDelivery (Creator); PRM.ProductionDelivery (LastEditor); PRM.ProductionDeliveryItem (Creator); PRM.ProductionDeliveryItem (LastEditor); PRM.ProductionDeliveryItemTrace (Creator); PRM.ProductionDeliveryItemTrace (LastEditor); PRM.ProductionFormula (Creator); PRM.ProductionFormula (LastEditor); PRM.ProductionFormulaItem (Creator); PRM.ProductionFormulaItem (LastEditor); PRM.ProductionFormulaItemMaterial (Creator); PRM.ProductionFormulaItemMaterial (LastEditor); PRM.ProductionFormulaItemMaterialTrace (Creator); PRM.ProductionFormulaItemMaterialTrace (LastEditor); PRM.ProductionFormulaTrace (Creator); PRM.ProductionFormulaTrace (LastEditor); PRM.ProductionManagementSetting (Creator); PRM.ProductionManagementSetting (LastEditor); PRM.ProductionOrder (Creator); PRM.ProductionOrder (LastEditor); PRM.ProductionOrderItem (Creator); PRM.ProductionOrderItem (LastEditor); PRM.ProductionOrderItemTrace (Creator); PRM.ProductionOrderItemTrace (LastEditor); PRM.ProductionPlanning (Creator); PRM.ProductionPlanning (LastEditor); PRM.ProductionPlanningItem (Creator); PRM.ProductionPlanningItem (LastEditor); PRM.ProductionPlanningItemTrace (Creator); PRM.ProductionPlanningItemTrace (LastEditor); PRM.ProductionProcess (Creator); PRM.ProductionProcess (LastEditor); PRM.ProductionProcessItem (Creator); PRM.ProductionProcessItem (LastEditor); PRM.ProductionStatistic (Creator); PRM.ProductionStatistic (LastEditor); PRM.ProductionStatisticItem (Creator); PRM.ProductionStatisticItem (LastEditor); PRM.ProductionStatisticItemTrace (Creator); PRM.ProductionStatisticItemTrace (LastEditor); PRM.ProductionStop (Creator); PRM.ProductionStop (LastEditor); PRM.ProductionStopItem (Creator); PRM.ProductionStopItem (LastEditor); PRM.ProductionStopReason (Creator); PRM.ProductionStopReason (LastEditor); PRM.ProductionTiming (Creator); PRM.ProductionTiming (LastEditor); PRM.ProductionTimingTrace (Creator); PRM.ProductionTimingTrace (LastEditor); PRM.QualityControl (Creator); PRM.QualityControl (LastEditor); PRM.QualityParameter (Creator); PRM.QualityParameter (LastEditor); PRM.QualityParameterItem (Creator); PRM.QualityParameterItem (LastEditor); PRM.RepairPlanning (Creator); PRM.RepairPlanning (LastEditor); PRM.RepairReport (Creator); PRM.RepairReport (LastEditor); PRM.RepairReportService (Creator); PRM.RepairReportService (LastEditor); PRM.RepairReportStuff (Creator); PRM.RepairReportStuff (LastEditor); PRM.RepairRequirement (Creator); PRM.RepairRequirement (LastEditor); PRM.RepairRequirementItem (Creator); PRM.RepairRequirementItem (LastEditor); PRM.RequiredMaterial (Creator); PRM.RequiredMaterial (LastEditor); PRM.RequiredMaterialCostCenter (Creator); PRM.RequiredMaterialCostCenter (LastEditor); PRM.RequiredMaterialTrace (Creator); PRM.RequiredMaterialTrace (LastEditor); PRM.RequiredProduct (Creator); PRM.RequiredProduct (LastEditor); PRM.RequiredProductTrace (Creator); PRM.RequiredProductTrace (LastEditor); PRM.Rework (Creator); PRM.Rework (LastEditor); PRM.ReworkItem (Creator); PRM.ReworkItem (LastEditor); PRM.ReworkItemTrace (Creator); PRM.ReworkItemTrace (LastEditor); PRM.SpoilageStatistic (Creator); PRM.SpoilageStatistic (LastEditor); PRM.SpoilageStatisticItem (Creator); PRM.SpoilageStatisticItem (LastEditor); PRM.SpoilageStatisticItemTrace (Creator); PRM.SpoilageStatisticItemTrace (LastEditor); PRM.StandardConsumption (Creator); PRM.StandardConsumption (LastEditor); PRM.StandardConsumptionItem (Creator); PRM.StandardConsumptionItem (LastEditor); PRM.StationPerformance (Creator); PRM.StationPerformance (LastEditor); PRM.StationPerformanceItem (Creator); PRM.StationPerformanceItem (LastEditor); PRM.StationPerformanceItemTrace (Creator); PRM.StationPerformanceItemTrace (LastEditor); PRM.StuffBomGroup (Creator); PRM.StuffBomGroup (LastEditor); PRM.WorkingInventory (Creator); PRM.WorkingInventory (LastEditor); PRM.WorkingInventoryItem (Creator); PRM.WorkingInventoryItem (LastEditor); PRM.WorkingInventoryItemTrace (Creator); PRM.WorkingInventoryItemTrace (LastEditor); PRM.WorkSchedule (Creator); PRM.WorkSchedule (LastEditor); PRM.WorkShift (Creator); PRM.WorkShift (LastEditor); PRM.WorkShiftItem (Creator); PRM.WorkShiftItem (LastEditor); PRM.WorkStation (Creator); PRM.WorkStation (LastEditor); PUM.PortalUser (Creator); PUM.PortalUser (LastEditor); PUM.SurveyDesign (Creator); PUM.SurveyDesign (LastEditor); PUM.SurveyDesignItem (Creator); PUM.SurveyDesignItem (LastEditor); PUM.Ticket (ExpertID); PUM.TicketAnswer (ExpertID); PUM.TicketAssign (From); PUM.TicketAssign (To); PUM.TicketStatus (Creator); PUM.TicketStatus (LastEditor); PUM.TicketType (Creator); PUM.TicketType (LastEditor); REQ.AdvancePaymentRequest (Creator); REQ.AdvancePaymentRequest (LastEditor); REQ.AdvancePaymentRequest (Reviewer); REQ.ConfirmationRequest (Creator); REQ.ConfirmationRequest (LastEditor); REQ.LoanRequest (Creator); REQ.LoanRequest (LastEditor); REQ.LoanRequest (Reviewer); REQ.PaymentOrder (Creator); REQ.PaymentOrder (LastEditor); REQ.PaymentOrderItem (Creator); REQ.PaymentOrderItem (LastEditor); REQ.PaymentRequest (Creator); REQ.PaymentRequest (LastEditor); REQ.PaymentRequest (Reviewer); REQ.PaymentRequestItem (Creator); REQ.PaymentRequestItem (LastEditor); REQ.PurchaseRequest (Creator); REQ.PurchaseRequest (LastEditor); REQ.PurchaseRequest (Reviewer); REQ.PurchaseRequestItem (Creator); REQ.PurchaseRequestItem (LastEditor); REQ.PurchaseRequestItemTrace (Creator); REQ.PurchaseRequestItemTrace (LastEditor); REQ.ReceiveRequest (Creator); REQ.ReceiveRequest (LastEditor); REQ.ReceiveRequest (Reviewer); REQ.ReturnRequest (Creator); REQ.ReturnRequest (LastEditor); REQ.ReturnRequest (Reviewer); REQ.ReturnRequestItem (Creator); REQ.ReturnRequestItem (LastEditor); REQ.ReturnRequestItemTrace (Creator); REQ.ReturnRequestItemTrace (LastEditor); REQ.ServiceRequest (Creator); REQ.ServiceRequest (LastEditor); REQ.ServiceRequest (ReviewerID); REQ.ServiceRequestItem (Creator); REQ.ServiceRequestItem (LastEditor); REQ.StuffRequest (Creator); REQ.StuffRequest (LastEditor); REQ.StuffRequest (Reviewer); REQ.StuffRequestItem (Creator); REQ.StuffRequestItem (LastEditor); REQ.StuffRequestItemTrace (Creator); REQ.StuffRequestItemTrace (LastEditor); REQ.TenderRequest (Creator); REQ.TenderRequest (LastEditor); REQ.TenderRequest (ReviewerID); REQ.TenderRequestItem (Creator); REQ.TenderRequestItem (LastEditor); SLE.CustomerOpeningBalance (Creator); SLE.CustomerOpeningBalance (LastEditor); SLE.DiscountAnnouncement (Creator); SLE.DiscountAnnouncement (LastEditor); SLE.DiscountBaseType (Creator); SLE.DiscountBaseType (LastEditor); SLE.DiscountModel (Creator); SLE.DiscountModel (LastEditor); SLE.DiscountModelItem (Creator); SLE.DiscountModelItem (LastEditor); SLE.Invoice (Creator); SLE.Invoice (LastEditor); SLE.InvoiceCorrection (Creator); SLE.InvoiceCorrection (LastEditor); SLE.InvoiceCorrectionItem (Creator); SLE.InvoiceCorrectionItem (LastEditor); SLE.InvoiceItem (Creator); SLE.InvoiceItem (LastEditor); SLE.InvoiceItemTrace (Creator); SLE.InvoiceItemTrace (LastEditor); SLE.Justification (Creator); SLE.Justification (LastEditor); SLE.JustificationItem (Creator); SLE.JustificationItem (LastEditor); SLE.JustificationItemTrace (Creator); SLE.JustificationItemTrace (LastEditor); SLE.PercentagePriceList (Creator); SLE.PercentagePriceList (LastEditor); SLE.PercentagePriceListItem (Creator); SLE.PercentagePriceListItem (LastEditor); SLE.PercentagePriceListItemBase (Creator); SLE.PercentagePriceListItemBase (LastEditor); SLE.PercentagePriceListItemBaseTrace (Creator); SLE.PercentagePriceListItemBaseTrace (LastEditor); SLE.PercentagePriceListItemTrace (Creator); SLE.PercentagePriceListItemTrace (LastEditor); SLE.PourcentageFormulaParameter (Creator); SLE.PourcentageFormulaParameter (LastEditor); SLE.PourcentageParameter (Creator); SLE.PourcentageParameter (LastEditor); SLE.PourcentageParameterItem (Creator); SLE.PourcentageParameterItem (LastEditor); SLE.PourcentagePeriod (Creator); SLE.PourcentagePeriod (LastEditor); SLE.PourcentagePeriodItem (Creator); SLE.PourcentagePeriodItem (LastEditor); SLE.PourcentageRate (Creator); SLE.PourcentageRate (LastEditor); SLE.PriceList (Creator); SLE.PriceList (LastEditor); SLE.PriceListItem (Creator); SLE.PriceListItem (LastEditor); SLE.PriceListItemTrace (Creator); SLE.PriceListItemTrace (LastEditor); SLE.PricingCalculation (Creator); SLE.PricingCalculation (LastEditor); SLE.PricingCalculationItem (Creator); SLE.PricingCalculationItem (LastEditor); SLE.PricingCalculationItemParameterValue (Creator); SLE.PricingCalculationItemParameterValue (LastEditor); SLE.PricingParameter (Creator); SLE.PricingParameter (LastEditor); SLE.PricingParameterAPIResult (Creator); SLE.PricingParameterAPIResult (LastEditor); SLE.PricingParameterFormula (Creator); SLE.PricingParameterFormula (LastEditor); SLE.Quotation (Creator); SLE.Quotation (LastEditor); SLE.QuotationItem (Creator); SLE.QuotationItem (LastEditor); SLE.QuotationItemTrace (Creator); SLE.QuotationItemTrace (LastEditor); SLE.Remittance (Creator); SLE.Remittance (LastEditor); SLE.RemittanceItem (Creator); SLE.RemittanceItem (LastEditor); SLE.RemittanceItemTrace (Creator); SLE.RemittanceItemTrace (LastEditor); SLE.ReturnedSaleInvoice (Creator); SLE.ReturnedSaleInvoice (LastEditor); SLE.ReturnedSaleInvoiceItem (Creator); SLE.ReturnedSaleInvoiceItem (LastEditor); SLE.ReturnedSaleInvoiceItemTrace (Creator); SLE.ReturnedSaleInvoiceItemTrace (LastEditor); SLE.ReturnedSaleJustification (Creator); SLE.ReturnedSaleJustification (LastEditor); SLE.ReturnedSaleJustificationItem (Creator); SLE.ReturnedSaleJustificationItem (LastEditor); SLE.ReturnedSaleJustificationItemTrace (Creator); SLE.ReturnedSaleJustificationItemTrace (LastEditor); SLE.SaleAgent (Creator); SLE.SaleAgent (LastEditor); SLE.SaleArea (Creator); SLE.SaleArea (LastEditor); SLE.SaleContract (Creator); SLE.SaleContract (LastEditor); SLE.SaleContractItem (Creator); SLE.SaleContractItem (LastEditor); SLE.SaleContractItemTrace (Creator); SLE.SaleContractItemTrace (LastEditor); SLE.SaleModel (Creator); SLE.SaleModel (LastEditor); SLE.SaleType (Creator); SLE.SaleType (LastEditor); SRM.Activity (Creator); SRM.Activity (LastEditor); SRM.ActivityLevelHistory (Creator); SRM.ActivityLevelHistory (LastEditor); SRM.ActivityType (Creator); SRM.ActivityType (LastEditor); SRM.ActivityTypeLevel (Creator); SRM.ActivityTypeLevel (LastEditor); SRM.Call (Creator); SRM.Call (LastEditor); SRM.Contact (Creator); SRM.Contact (LastEditor); SRM.ContactNumber (Creator); SRM.ContactNumber (LastEditor); SRM.ExternalSrmItem (Creator); SRM.ExternalSrmItem (LastEditor); SRM.ItemRelatedActivity (Creator); SRM.ItemRelatedActivity (LastEditor); SRM.Meeting (Creator); SRM.Meeting (LastEditor); SRM.MeetingContact (Creator); SRM.MeetingContact (LastEditor); SRM.MeetingUser (Creator); SRM.MeetingUser (LastEditor); SRM.Note (Creator); SRM.Note (LastEditor); SRM.SentReciveEmail (Creator); SRM.SentReciveEmail (LastEditor); SRM.SentReciveFax (Creator); SRM.SentReciveFax (LastEditor); SRM.SentReciveSms (Creator); SRM.SentReciveSms (LastEditor); SRM.SrmDocAttachement (Creator); SRM.SrmDocAttachement (LastEditor); SRM.SrmFileAttachement (Creator); SRM.SrmFileAttachement (LastEditor); SRM.Task (Assignee); SRM.Task (Creator); SRM.Task (LastEditor); SRM.UserEmail (Creator); SRM.UserEmail (LastEditor); STC.ConvertSpecification (Creator); STC.ConvertSpecification (LastEditor); STC.ConvertSpecificationTrace (Creator); STC.ConvertSpecificationTrace (LastEditor); STC.InventoryEdition (Creator); STC.InventoryEdition (LastEditor); STC.InventoryEditionItem (Creator); STC.InventoryEditionItem (LastEditor); STC.InventoryEditionItemTrace (Creator); STC.InventoryEditionItemTrace (LastEditor); STC.InventoryMethod (Creator); STC.InventoryMethod (LastEditor); STC.InventoryMethodStock (Creator); STC.InventoryMethodStock (LastEditor); STC.JustificationInput (Creator); STC.JustificationInput (LastEditor); STC.JustificationInputItem (Creator); STC.JustificationInputItem (LastEditor); STC.JustificationInputItemTrace (Creator); STC.JustificationInputItemTrace (LastEditor); STC.Outgoing (Creator); STC.Outgoing (LastEditor); STC.OutgoingAccSetting (Creator); STC.OutgoingAccSetting (LastEditor); STC.OutgoingAccSettingAccountLevel (Creator); STC.OutgoingAccSettingAccountLevel (LastEditor); STC.OutgoingDl (Creator); STC.OutgoingDl (LastEditor); STC.OutgoingItem (Creator); STC.OutgoingItem (LastEditor); STC.OutgoingItemTrace (Creator); STC.OutgoingItemTrace (LastEditor); STC.OutgoingSerialSpecification (Creator); STC.OutgoingSerialSpecification (LastEditor); STC.PricingItem (Creator); STC.PricingItem (LastEditor); STC.PricingItemTrace (Creator); STC.PricingItemTrace (LastEditor); STC.ProductionPrice (Creator); STC.ProductionPrice (LastEditor); STC.ProductionPriceItem (Creator); STC.ProductionPriceItem (LastEditor); STC.ProductionPriceItemTrace (Creator); STC.ProductionPriceItemTrace (LastEditor); STC.ReceiptCost (Creator); STC.ReceiptCost (LastEditor); STC.RecountingInventory (Creator); STC.RecountingInventory (LastEditor); STC.RecountingInventoryItem (Creator); STC.RecountingInventoryItem (LastEditor); STC.RecountingInventoryPeriod (Creator); STC.RecountingInventoryPeriod (LastEditor); STC.RecountingInventoryTag (Creator); STC.RecountingInventoryTag (LastEditor); STC.RecountingInventoryTagItem (Creator); STC.RecountingInventoryTagItem (LastEditor); STC.RecountingInventoryTagItemTrace (Creator); STC.RecountingInventoryTagItemTrace (LastEditor); STC.ReturnedOutgoing (Creator); STC.ReturnedOutgoing (LastEditor); STC.ReturnedOutgoingDl (Creator); STC.ReturnedOutgoingDl (LastEditor); STC.ReturnedOutgoingItem (Creator); STC.ReturnedOutgoingItem (LastEditor); STC.ReturnedOutgoingItemTrace (Creator); STC.ReturnedOutgoingItemTrace (LastEditor); STC.ReturnedOutgoingSerialSpecification (Creator); STC.ReturnedOutgoingSerialSpecification (LastEditor); STC.ReturnedTemporaryOutgoing (Creator); STC.ReturnedTemporaryOutgoing (LastEditor); STC.ReturnedTemporaryOutgoingItem (Creator); STC.ReturnedTemporaryOutgoingItem (LastEditor); STC.ReturnedTemporaryStockReceipt (Creator); STC.ReturnedTemporaryStockReceipt (LastEditor); STC.ReturnedTemporaryStockReceiptItem (Creator); STC.ReturnedTemporaryStockReceiptItem (LastEditor); STC.ReturnedTemporaryStockReceiptItemTrace (Creator); STC.ReturnedTemporaryStockReceiptItemTrace (LastEditor); STC.ReturnStockReceipt (Creator); STC.ReturnStockReceipt (LastEditor); STC.ReturnStockReceiptDl (Creator); STC.ReturnStockReceiptDl (LastEditor); STC.ReturnStockReceiptItem (Creator); STC.ReturnStockReceiptItem (LastEditor); STC.ReturnStockReceiptItemTrace (Creator); STC.ReturnStockReceiptItemTrace (LastEditor); STC.ReturnStockReceiptSerialSpecification (Creator); STC.ReturnStockReceiptSerialSpecification (LastEditor); STC.RevisionCost (Creator); STC.RevisionCost (LastEditor); STC.RevisionCostItem (Creator); STC.RevisionCostItem (LastEditor); STC.StockClosePeriod (Creator); STC.StockClosePeriod (LastEditor); STC.StockClosingOperation (Creator); STC.StockClosingOperation (LastEditor); STC.StockDocumentType (Creator); STC.StockDocumentType (LastEditor); STC.StockDocumentTypeBaseEntity (Creator); STC.StockDocumentTypeBaseEntity (LastEditor); STC.StockDocumentTypeDlType (Creator); STC.StockDocumentTypeDlType (LastEditor); STC.StockReceipt (Creator); STC.StockReceipt (LastEditor); STC.StockReceiptChargingService (Creator); STC.StockReceiptChargingService (LastEditor); STC.StockReceiptDl (Creator); STC.StockReceiptDl (LastEditor); STC.StockReceiptItem (Creator); STC.StockReceiptItem (LastEditor); STC.StockReceiptItemTrace (Creator); STC.StockReceiptItemTrace (LastEditor); STC.StockReceiptSerialSpecification (Creator); STC.StockReceiptSerialSpecification (LastEditor); STC.StuffComposition (Creator); STC.StuffComposition (LastEditor); STC.StuffCompositionTrace (Creator); STC.StuffCompositionTrace (LastEditor); STC.TemporaryOutgoing (Creator); STC.TemporaryOutgoing (LastEditor); STC.TemporaryOutgoingItem (Creator); STC.TemporaryOutgoingItem (LastEditor); STC.TemporaryOutgoingItemTrace (Creator); STC.TemporaryOutgoingItemTrace (LastEditor); STC.TemporaryStockReceipt (Creator); STC.TemporaryStockReceipt (LastEditor); STC.TemporaryStockReceiptItem (Creator); STC.TemporaryStockReceiptItem (LastEditor); STC.TemporaryStockReceiptItemTrace (Creator); STC.TemporaryStockReceiptItemTrace (LastEditor); STF.BarcodeInterpretation (Creator); STF.BarcodeInterpretation (LastEditor); STF.BarcodeInterpretationItem (Creator); STF.BarcodeInterpretationItem (LastEditor); STF.MeasureUnit (Creator); STF.MeasureUnit (LastEditor); STF.MeasureUnitTrace (Creator); STF.MeasureUnitTrace (LastEditor); STF.Property (Creator); STF.Property (LastEditor); STF.PursuitGroup (Creator); STF.PursuitGroup (LastEditor); STF.PursuitGroupStock (Creator); STF.PursuitGroupStock (LastEditor); STF.SerialPattern (Creator); STF.SerialPattern (LastEditor); STF.SerialPatternItem (Creator); STF.SerialPatternItem (LastEditor); STF.Stock (Creator); STF.Stock (LastEditor); STF.StockDocumentTypeSlDl (Creator); STF.StockDocumentTypeSlDl (LastEditor); STF.StockType (Creator); STF.StockType (LastEditor); STF.Stuff (Creator); STF.Stuff (LastEditor); STF.StuffAccountGroup (Creator); STF.StuffAccountGroup (LastEditor); STF.StuffAccountGroupAccountSl (Creator); STF.StuffAccountGroupAccountSl (LastEditor); STF.StuffAccountGroupPurchaseType (Creator); STF.StuffAccountGroupPurchaseType (LastEditor); STF.StuffDetail (Creator); STF.StuffDetail (LastEditor); STF.StuffDetailType (Creator); STF.StuffDetailType (LastEditor); STF.StuffGroup (Creator); STF.StuffGroup (LastEditor); STF.StuffGroupProperty (Creator); STF.StuffGroupProperty (LastEditor); STF.StuffImage (Creator); STF.StuffImage (LastEditor); STF.StuffPropertyValue (Creator); STF.StuffPropertyValue (LastEditor); STF.StuffPursuitGroup (Creator); STF.StuffPursuitGroup (LastEditor); STF.StuffSaleSl (Creator); STF.StuffSaleSl (LastEditor); STF.StuffSerial (Creator); STF.StuffSerial (LastEditor); STF.StuffTrace (Creator); STF.StuffTrace (LastEditor); STF.Trace (Creator); STF.Trace (LastEditor); STF.TraceDocumentNumType (Creator); STF.TraceDocumentNumType (LastEditor); STF.TraceGenerateConfig (Creator); STF.TraceGenerateConfig (LastEditor); STF.TraceItem (Creator); STF.TraceItem (LastEditor); STF.TraceListType (Creator); STF.TraceListType (LastEditor); VND.ConfirmPurchaseInvoice (Creator); VND.ConfirmPurchaseInvoice (LastEditor); VND.ConfirmPurchaseInvoiceAdvancePayment (Creator); VND.ConfirmPurchaseInvoiceAdvancePayment (LastEditor); VND.Criteria (Creator); VND.Criteria (LastEditor); VND.DeliveryJustification (Creator); VND.DeliveryJustification (LastEditor); VND.DeliveryJustificationItem (Creator); VND.DeliveryJustificationItem (LastEditor); VND.DocumentVerification (Creator); VND.DocumentVerification (LastEditor); VND.DocumentVerificationPath (Creator); VND.DocumentVerificationPath (LastEditor); VND.DocumentVerificationPathItem (Creator); VND.DocumentVerificationPathItem (LastEditor); VND.Enactment (Creator); VND.Enactment (LastEditor); VND.FinalEvaluation (Creator); VND.FinalEvaluation (LastEditor); VND.FinalEvaluationItem (Creator); VND.FinalEvaluationItem (LastEditor); VND.Indicator (Creator); VND.Indicator (LastEditor); VND.InqueryPermission (Creator); VND.InqueryPermission (LastEditor); VND.InqueryPermissionItem (Creator); VND.InqueryPermissionItem (LastEditor); VND.PorcumentGroup (Creator); VND.PorcumentGroup (LastEditor); VND.PorcumentGroupItem (Creator); VND.PorcumentGroupItem (LastEditor); VND.Proposal (Creator); VND.Proposal (LastEditor); VND.ProposalCommission (Creator); VND.ProposalCommission (LastEditor); VND.ProposalCommissionItem (Creator); VND.ProposalCommissionItem (LastEditor); VND.ProposalItem (Creator); VND.ProposalItem (LastEditor); VND.PurchaseContract (Creator); VND.PurchaseContract (LastEditor); VND.PurchaseContractItem (Creator); VND.PurchaseContractItem (LastEditor); VND.PurchaseInvoice (Creator); VND.PurchaseInvoice (LastEditor); VND.PurchaseInvoiceItem (Creator); VND.PurchaseInvoiceItem (LastEditor); VND.PurchasePlanning (Creator); VND.PurchasePlanning (LastEditor); VND.PurchasePlanning (PurchaseExpertUserID); VND.PurchasePlanningItem (Creator); VND.PurchasePlanningItem (LastEditor); VND.PurchaseType (Creator); VND.PurchaseType (LastEditor); VND.ReturnInvoice (Creator); VND.ReturnInvoice (LastEditor); VND.ReturnInvoiceItem (Creator); VND.ReturnInvoiceItem (LastEditor); VND.Tender (Creator); VND.Tender (LastEditor); VND.TenderCommission (Creator); VND.TenderCommission (LastEditor); VND.TenderCommissionItem (Creator); VND.TenderCommissionItem (LastEditor); VND.TenderCriteria (Creator); VND.TenderCriteria (LastEditor); VND.TenderCriteriaItem (Creator); VND.TenderCriteriaItem (LastEditor); VND.TenderDocument (Creator); VND.TenderDocument (LastEditor); VND.TenderDocumentType (Creator); VND.TenderDocumentType (LastEditor); VND.TenderEvaluation (Creator); VND.TenderEvaluation (LastEditor); VND.TenderEvaluationItem (Creator); VND.TenderEvaluationItem (LastEditor); VND.TenderIndicator (Creator); VND.TenderIndicator (LastEditor); VND.TenderIndicatorItem (Creator); VND.TenderIndicatorItem (LastEditor); VND.TenderParticipate (Creator); VND.TenderParticipate (LastEditor); VND.TenderVendorList (Creator); VND.TenderVendorList (LastEditor); VND.TenderVendorListItem (Creator); VND.TenderVendorListItem (LastEditor); VND.VendorOpeningBalance (Creator); VND.VendorOpeningBalance (LastEditor); WMS.Packing (Creator); WMS.Packing (LastEditor); WMS.PackingItem (Creator); WMS.PackingItem (LastEditor); WMS.PackingType (Creator); WMS.PackingType (LastEditor); WMS.PhysicalLocation (Creator); WMS.PhysicalLocation (LastEditor); WMS.PhysicalLocationItem (Creator); WMS.PhysicalLocationItem (LastEditor); WMS.WarehouseOutput (Creator); WMS.WarehouseOutput (LastEditor); WMS.WarehouseSpaceDesign (Creator); WMS.WarehouseSpaceDesign (LastEditor); WMS.Warehousing (Creator); WMS.Warehousing (LastEditor); WMS.Zone (Creator); WMS.Zone (LastEditor); WMS.ZoneInventory (Creator); WMS.ZoneInventory (LastEditor)

### CFG.UserGroup

Rows: 20 | گروه کاربری

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserGroupID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | ParentUserGroupID | int | Y |  |  |
| 6 | UserAdminID | int | N | ((-1)) |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | ApplyAllUser | bit | N | ((0)) |  |
| 13 | AccessInfo | nvarchar(MAX) | Y |  |  |

- **Primary key:** UserGroupID
- **FK** `FK_UserGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UserGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UserGroup_UserAdmin` (UserAdminID) -> CFG.User (UserID)
- **Referenced by:** CFG.UserGroupRecordAccess (UserGroupID); CFG.UserGroupUser (UserGroupID)

### CFG.UserGroupRecordAccess

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserGroupRecordAccessID | int | N |  | identity |
| 2 | RecorLevelSettingID | tinyint | N |  |  |
| 3 | EntityID | bigint | N |  |  |
| 4 | UserGroupID | int | N |  |  |

- **Primary key:** UserGroupRecordAccessID
- **FK** `FK_UserGroupRecordAccess_UserGroup` (UserGroupID) -> CFG.UserGroup (UserGroupID)
- **FK** `FK_UserGroupRecordAccess_RecordLevelSetting` (RecorLevelSettingID) -> CFG.RecordLevelSetting (RecordLevelSettingID)

### CFG.UserGroupUser

Rows: 18

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserGroupUserID | int | N |  | identity |
| 2 | UserGroupID | int | N |  |  |
| 3 | UserID | int | N |  |  |
| 4 | IsAdmin | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** UserGroupUserID
- **unique index** `IX_UserGroupUser_UserGroupAndUser` (UserGroupID, UserID)
- **FK** `FK_UserGroupUser_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UserGroupUser_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UserGroupUser_User` (UserID) -> CFG.User (UserID)
- **FK** `FK_UserGroupUser_UserGroup` (UserGroupID) -> CFG.UserGroup (UserGroupID)

### CFG.UserLoginHistory

Rows: 36290

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserLoginHistoryID | int | N |  | identity |
| 2 | UserID | int | Y |  |  |
| 3 | UserName | nvarchar(256) | N |  |  |
| 4 | LoginDate | datetime | N |  |  |
| 5 | IsSucceed | bit | N |  |  |
| 6 | FailCause | varchar(512) | Y |  |  |
| 7 | DbName | varchar(50) | N |  |  |
| 8 | ClientAppId | varchar(1024) | N |  |  |
| 9 | ClientIp | varchar(50) | N |  |  |
| 10 | LogoutDate | datetime | Y |  |  |
| 11 | TokenID | varchar(50) | Y |  |  |
| 12 | UserAgent | nvarchar(300) | Y |  |  |

- **Primary key:** UserLoginHistoryID
- **FK** `FK_UserLoginHistory_User` (UserID) -> CFG.User (UserID)

### CFG.UserSetting

Rows: 318

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserSettingID | int | N |  | identity |
| 2 | UserID | int | N |  |  |
| 3 | SettingKey | varchar(512) | N |  |  |
| 4 | SettingSubKey | varchar(512) | Y |  |  |
| 5 | SettingValue | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** UserSettingID
- **FK** `FK_UserSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UserSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UserSetting_User` (UserID) -> CFG.User (UserID) on delete CASCADE

### CFG.UserSignature

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserSignatureID | int | N |  | identity |
| 2 | UserID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | SignatureContent | varbinary(MAX) | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** UserSignatureID
- **FK** `FK_UserSignature_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UserSignature_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UserSignature_User` (UserID) -> CFG.User (UserID)
- **Referenced by:** SRM.SentReciveEmail (UserSignatureID)

### CFG.Vat

Rows: 25

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VatID | int | N |  | identity |
| 2 | FromDate | date | N |  |  |
| 3 | EndDate | date | N |  |  |
| 4 | InclusiveSale | decimal(30,4) | N |  |  |
| 5 | ExemptSale | decimal(30,4) | N |  |  |
| 6 | Export | decimal(30,4) | N |  |  |
| 7 | InclusivePurchase | decimal(30,4) | N |  |  |
| 8 | ExemptPurchase | decimal(30,4) | N |  |  |
| 9 | InclusiveImport | decimal(30,4) | N |  |  |
| 10 | ExemptImport | decimal(30,4) | N |  |  |
| 11 | TaxOfSale | decimal(30,4) | N |  |  |
| 12 | DutyOfSale | decimal(30,4) | N |  |  |
| 13 | TaxOfPurchase | decimal(30,4) | N |  |  |
| 14 | DutyOfPurchase | decimal(30,4) | N |  |  |
| 15 | TaxOfImport | decimal(30,4) | N |  |  |
| 16 | DutyOfImport | decimal(30,4) | N |  |  |
| 17 | FinancialPeriodID | int | N |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | Version | int | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | CalculationDate | date | Y |  |  |
| 24 | CompanyID | int | N | ((-1)) |  |

- **Primary key:** VatID
- **FK** `FK_Vat_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Vat_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Vat_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Vat_Company` (CompanyID) -> CFG.Company (CompanyID)
- **Referenced by:** CFG.VatItem (VatID)

### CFG.VatItem

Rows: 32863

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VatItemID | int | N |  | identity |
| 2 | VatID | int | N |  |  |
| 3 | DocType | tinyint | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | InclusiveVatStuffs | decimal(30,4) | N |  |  |
| 6 | ExemptOfVatStuffs | decimal(30,4) | N |  |  |
| 7 | Tax | decimal(30,4) | N |  |  |
| 8 | Duty | decimal(30,4) | N |  |  |
| 9 | Selected | bit | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | Type | int | N |  |  |
| 14 | Date | varchar(50) | N |  |  |
| 15 | Number | varchar(50) | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | DocID | int | Y |  |  |
| 19 | DocItemId | int | Y |  |  |
| 20 | NatureType | int | Y |  |  |
| 21 | IsSystem | bit | N | ((1)) |  |

- **Primary key:** VatItemID
- **FK** `FK_VatItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VatItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VatItem_Vat` (VatID) -> CFG.Vat (VatID) on delete CASCADE

### CFG.VersionFix

Rows: 505

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VersionFixID | int | N |  | identity |
| 2 | Version | varchar(50) | N |  |  |
| 3 | Fix | int | N |  |  |
| 4 | ApplyDate | datetime | N |  |  |

- **Primary key:** VersionFixID

### CFG.VersionInfo

Rows: 314

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VersionInfoID | int | N |  | identity |
| 2 | SystemVersion | varchar(50) | N |  |  |
| 3 | DbVersion | varchar(50) | N |  |  |
| 4 | EnumVersion | varchar(50) | N |  |  |
| 5 | VersionDate | varchar(50) | N |  |  |
| 6 | ApplyDate | varchar(50) | N |  |  |

- **Primary key:** VersionInfoID

### CFG.VoucherDescription

Rows: 193

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherDescriptionID | int | N |  | identity |
| 2 | MDEntityID | int | Y |  |  |
| 3 | Key | varchar(100) | Y |  |  |
| 4 | Description | nvarchar(1024) | Y |  |  |
| 5 | Description2 | nvarchar(1024) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |


### CFG.VoucherDescriptionMetaData

Rows: 200

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherDescriptionMetaDataID | int | N |  | identity |
| 2 | MDEntityID | int | Y |  |  |
| 3 | Key | varchar(100) | Y |  |  |
| 4 | FaTitle | nvarchar(1024) | Y |  |  |
| 5 | EnTitle | nvarchar(1024) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |


### CFG.VoucherDescriptionMetaDataParameter

Rows: 349

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VoucherDescriptionMetaDataParameterID | int | N |  | identity |
| 2 | MDEntityID | int | Y |  |  |
| 3 | Key | varchar(100) | Y |  |  |
| 4 | ParamKey | varchar(100) | Y |  |  |
| 5 | FaTitle | nvarchar(1024) | Y |  |  |
| 6 | EnTitle | nvarchar(1024) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |


### CFG.Work

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkID | int | N |  | identity |
| 2 | WorkTypeID | int | N |  |  |
| 3 | Title | nvarchar(250) | N |  |  |
| 4 | Title2 | nvarchar(250) | N |  |  |
| 5 | Description | nvarchar(MAX) | N |  |  |
| 6 | Description2 | nvarchar(MAX) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Status | tinyint | N | ((1)) |  |

- **Primary key:** WorkID
- **FK** `FK_Work_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Work_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Work_WorkType` (WorkTypeID) -> CFG.WorkType (WorkTypeID)

### CFG.WorkType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkTypeID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** WorkTypeID
- **FK** `FK_WorkType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WorkType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.Work (WorkTypeID)

### CFG.XMLLog

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | XmlLogId | int | N |  | identity |
| 2 | TableName | varchar(500) | N |  |  |
| 3 | Operation | nvarchar(MAX) | N |  |  |
| 4 | ModifiedDate | nvarchar(MAX) | N |  |  |
| 5 | ComputerName | varchar(500) | N |  |  |
| 6 | UserId | int | N |  |  |
| 7 | XmlDatas | xml | N |  |  |
| 8 | XmlDatasNew | xml | Y |  |  |

- **Primary key:** XmlLogId

## Views

### CFG.BankAccount_LastAmount

Definition: `programmability/views/CFG.BankAccount_LastAmount.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BankAccountID | int | Y |
| 2 | LastAmount | decimal(38,4) | Y |

### CFG.Cash_LastAmount

Definition: `programmability/views/CFG.Cash_LastAmount.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CashID | int | N |
| 2 | CurrencyID | int | N |
| 3 | LastAmount | decimal(38,4) | Y |

### CFG.Credit_DebitCreditNoteItem_Remain

Definition: `programmability/views/CFG.Credit_DebitCreditNoteItem_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DebitCreditNoteItemID | int | N |
| 2 | Amount | decimal(31,4) | Y |
| 3 | Debits | decimal(38,4) | Y |
| 4 | remain | decimal(38,4) | Y |

### CFG.Debit_DebitCreditNoteItem_Remain

Definition: `programmability/views/CFG.Debit_DebitCreditNoteItem_Remain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DebitCreditNoteItemID | int | N |
| 2 | Amount | decimal(31,4) | Y |
| 3 | Credits | decimal(38,4) | Y |
| 4 | remain | decimal(38,4) | Y |

### CFG.ForeignKeys2

| # | Column | Type | Null |
|---|---|---|---|
| 1 | RefTable | sysname | Y |
| 2 | RefColumn | nvarchar(128) | Y |
| 3 | BaseTable | sysname | Y |
| 4 | BaseColumn | nvarchar(128) | Y |
| 5 | Constraint_Name | sysname | N |
| 6 | DELETE_RULE | varchar(11) | Y |

### CFG.RecordLevelAccess

Definition: `programmability/views/CFG.RecordLevelAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | RNo | bigint | Y |
| 2 | UserID | int | N |
| 3 | Type | tinyint | Y |
| 4 | EntityRef | int | N |

### CFG.vwAccountingSlAccess

Definition: `programmability/views/CFG.vwAccountingSlAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | SLID | int | N |

### CFG.vwActivityAreaAccess

Definition: `programmability/views/CFG.vwActivityAreaAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | ActivityAreaID | int | N |

### CFG.VwAddress

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AddressID | int | N |
| 2 | AddressTypeID | int | N |
| 3 | IsMain | bit | N |
| 4 | TitleAddress | nvarchar(256) | N |
| 5 | TitleAddress2 | nvarchar(256) | N |
| 6 | ZipCode | nvarchar(256) | Y |
| 7 | PartyID | bigint | N |
| 8 | country | nvarchar(256) | N |
| 9 | country2 | nvarchar(256) | N |
| 10 | province | nvarchar(256) | N |
| 11 | province2 | nvarchar(256) | N |
| 12 | county | nvarchar(256) | N |
| 13 | county2 | nvarchar(256) | N |
| 14 | city | nvarchar(256) | N |
| 15 | city2 | nvarchar(256) | N |
| 16 | PreNumberOfCity | nvarchar(50) | Y |
| 17 | ProvinceTaxCode | nvarchar(50) | Y |
| 18 | CityTaxCode | nvarchar(50) | Y |
| 19 | Nature | tinyint | Y |

### CFG.vwAnalysisCubeAccess

Definition: `programmability/views/CFG.vwAnalysisCubeAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | N |
| 2 | AnalysisCubeID | int | Y |

### CFG.vwBankAccountAccess

Definition: `programmability/views/CFG.vwBankAccountAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | BankAccountID | int | N |

### CFG.vwBranchAccess

Definition: `programmability/views/CFG.vwBranchAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | BranchID | int | N |

### CFG.vwCardReaderAccess

Definition: `programmability/views/CFG.vwCardReaderAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | CardReaderID | int | N |

### CFG.vwCashAccess

Definition: `programmability/views/CFG.vwCashAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | CashID | int | N |

### CFG.vwCompanyAccess

Definition: `programmability/views/CFG.vwCompanyAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | CompanyID | int | N |

### CFG.vwCustomActionAccess

Definition: `programmability/views/CFG.vwCustomActionAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | CustomActionID | int | N |

### CFG.VWCustomer

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PartyID | bigint | N |
| 2 | Type | tinyint | N |
| 3 | IdentificationCode | nvarchar(50) | Y |
| 4 | RegisterNumber | nvarchar(50) | Y |
| 5 | NationalID | nvarchar(256) | Y |
| 6 | EconomicCode | nvarchar(50) | Y |
| 7 | Introduction | nvarchar(256) | Y |
| 8 | IntroductionName | nvarchar(256) | Y |
| 9 | DlCode | varchar(100) | N |
| 10 | DlTitle | nvarchar(256) | N |
| 11 | CustomerGroupCode | int | Y |
| 12 | CustomerGroupTitle | nvarchar(256) | Y |
| 13 | CustomerCode | nvarchar(256) | Y |
| 14 | TradeName | nvarchar(250) | Y |

### CFG.vwDashboardAccess

Definition: `programmability/views/CFG.vwDashboardAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | DashboardID | int | N |

### CFG.VwEnums

Definition: `programmability/views/CFG.VwEnums.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Enum | varchar(50) | N |
| 2 | Item | nvarchar(100) | N |
| 3 | KeyValue | nvarchar(50) | Y |
| 4 | Value | nvarchar(2048) | N |

### CFG.vwFileAttachmentTypeAccess

Definition: `programmability/views/CFG.vwFileAttachmentTypeAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | FileAttachmentTypeID | int | N |

### CFG.vwFinancialPeriodAccess

Definition: `programmability/views/CFG.vwFinancialPeriodAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | FinancialPeriodID | int | N |

### CFG.vwInstallmentPayment

Definition: `programmability/views/CFG.vwInstallmentPayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | InstallmentPaymentItemID | int | Y |
| 2 | Amount | decimal(31,4) | Y |
| 3 | Date | date | Y |

### CFG.vwInstallmentPaymentRemain

Definition: `programmability/views/CFG.vwInstallmentPaymentRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | InstallmentPaymentItemID | int | N |
| 2 | Amount | decimal(36,10) | N |
| 3 | PaidAmount | decimal(36,10) | Y |
| 4 | remain | decimal(36,10) | Y |

### CFG.vwInternalAuditAccess

Definition: `programmability/views/CFG.vwInternalAuditAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | InternalAuditID | int | N |

### CFG.vwManagerSubordinates

Definition: `programmability/views/CFG.vwManagerSubordinates.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ManagerUserID | int | Y |
| 2 | ManagedGroupID | int | Y |
| 3 | SubGroupID | int | Y |
| 4 | SubordinateUserID | int | N |
| 5 | GroupDepth | int | Y |
| 6 | IsDirectGroup | int | N |

### CFG.vwOperationLevelAccess

Definition: `programmability/views/CFG.vwOperationLevelAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | N |
| 2 | EntityName | nvarchar(4000) | Y |
| 3 | AccessKey | nvarchar(MAX) | Y |
| 4 | Users | nvarchar(4000) | Y |

### CFG.vwOrganizationUnitAccess

Definition: `programmability/views/CFG.vwOrganizationUnitAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | OrganizationUnitID | int | N |

### CFG.vwParameterMonthlyDataFilterAccess

Definition: `programmability/views/CFG.vwParameterMonthlyDataFilterAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | ParameterMonthlyDataFilterID | int | N |

### CFG.vwPartyAccess

Definition: `programmability/views/CFG.vwPartyAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | PartyID | bigint | N |
| 3 | DlID | bigint | Y |

### CFG.vwPartyAccount

Definition: `programmability/views/CFG.vwPartyAccount.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Title | nvarchar(256) | Y |
| 2 | Title2 | nvarchar(256) | Y |
| 3 | AccountNumber | nvarchar(256) | Y |
| 4 | IBAN | nvarchar(256) | Y |
| 5 | CardNumber | nvarchar(256) | Y |
| 6 | PartyID | bigint | N |
| 7 | PartyAccountID | int | N |
| 8 | DlID | bigint | Y |

### CFG.VwPartyTaxType

Definition: `programmability/views/CFG.VwPartyTaxType.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PartyID | bigint | N |
| 2 | VendorTaxType | nvarchar(128) | Y |
| 3 | CustomerTaxType | nvarchar(128) | Y |

### CFG.vwPettyCashAccess

Definition: `programmability/views/CFG.vwPettyCashAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | PettyCashID | int | N |

### CFG.vwphone

Definition: `programmability/views/CFG.vwphone.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PartyID | bigint | N |
| 2 | FixPhone | nvarchar(50) | Y |
| 3 | Fax | nvarchar(50) | Y |
| 4 | Mobile | nvarchar(50) | Y |
| 5 | Phone | nvarchar(50) | Y |

### CFG.vwPrePaymentDataSource

Definition: `programmability/views/CFG.vwPrePaymentDataSource.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BranchID | int | Y |
| 2 | DLID | bigint | Y |
| 3 | CurrencyID | int | Y |
| 4 | CurrencyRate | decimal(20,10) | Y |
| 5 | Amount | decimal(36,10) | Y |
| 6 | DepreciatedAmount | numeric(30,4) | Y |
| 7 | DocumentID | int | N |
| 8 | Document | varchar(22) | N |
| 9 | DocumentItemID | int | N |
| 10 | BaseDocumentItemID | int | Y |
| 11 | DocumentDate | date | N |
| 12 | BaseDocumentDate | date | Y |
| 13 | DocumentNumber | int | Y |

### CFG.vwReservedStuffs

Definition: `programmability/views/CFG.vwReservedStuffs.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BranchID | int | N |
| 2 | StuffID | int | N |
| 3 | Non | decimal(38,10) | Y |

### CFG.VWSaleAgent

Definition: `programmability/views/CFG.VWSaleAgent.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SaleAgentID | int | N |
| 2 | PartyID | bigint | N |
| 3 | Type | tinyint | N |
| 4 | IdentificationCode | nvarchar(50) | Y |
| 5 | NationalID | nvarchar(256) | Y |
| 6 | EconomicCode | nvarchar(50) | Y |
| 7 | DlCode | varchar(100) | N |
| 8 | DlTitle | nvarchar(256) | N |
| 9 | DlTitle2 | nvarchar(256) | N |
| 10 | CommissionGroupCode | int | N |
| 11 | CommissionGroupTitle | nvarchar(256) | N |
| 12 | CommissionGroupTitle2 | nvarchar(256) | N |

### CFG.VWSaleAndPurchaseBill

Definition: `programmability/views/CFG.VWSaleAndPurchaseBill.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocumentID | int | N |
| 2 | EngName | varchar(36) | N |
| 3 | Type | varchar(8) | Y |
| 4 | Date | date | Y |
| 5 | OpeningBalance | decimal(36,10) | Y |
| 6 | SalePurchase | decimal(36,10) | Y |
| 7 | Returned | decimal(36,10) | Y |
| 8 | Discount | decimal(38,10) | Y |
| 9 | Vat | decimal(37,10) | Y |
| 10 | Received | decimal(37,10) | Y |
| 11 | Payed | decimal(38,10) | Y |
| 12 | CurrencyID | int | N |
| 13 | PartyID | bigint | Y |

### CFG.VWSaleAndPurchaseBill_Detail

Definition: `programmability/views/CFG.VWSaleAndPurchaseBill_Detail.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocumentID | int | N |
| 2 | EngName | varchar(36) | N |
| 3 | Type | varchar(8) | Y |
| 4 | Date | datetime | N |
| 5 | Description | nvarchar(MAX) | Y |
| 6 | Number | int | Y |
| 7 | Debit | decimal(37,10) | Y |
| 8 | Credit | decimal(37,10) | Y |
| 9 | CurrencyID | int | N |
| 10 | PartyID | bigint | Y |
| 11 | StuffCode | nvarchar(256) | Y |
| 12 | StuffTitle | nvarchar(MAX) | Y |
| 13 | MainQuantity | decimal(36,10) | Y |
| 14 | Fee | decimal(36,10) | Y |
| 15 | Price | decimal(36,10) | Y |
| 16 | Discount | decimal(36,10) | Y |
| 17 | Vat | decimal(37,10) | Y |

### CFG.VWSaleAndPurchaseBill_Total

Definition: `programmability/views/CFG.VWSaleAndPurchaseBill_Total.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DocumentID | int | N |
| 2 | EngName | varchar(36) | N |
| 3 | Type | varchar(8) | Y |
| 4 | Date | datetime | N |
| 5 | Description | nvarchar(MAX) | Y |
| 6 | Number | int | Y |
| 7 | Debit | decimal(37,10) | Y |
| 8 | Credit | decimal(37,10) | Y |
| 9 | Title | nvarchar(256) | Y |
| 10 | CurrencyID | int | N |
| 11 | FinancialPeriodID | int | N |
| 12 | PartyID | bigint | Y |
| 13 | Schema | varchar(3) | N |
| 14 | Periority | int | N |

### CFG.vwSaleAndPurchaseParty

Definition: `programmability/views/CFG.vwSaleAndPurchaseParty.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | CustomerID | bigint | Y |
| 2 | FinancialPeriodID | int | Y |
| 3 | Type | varchar(19) | N |
| 4 | HCType1Code | nvarchar(128) | Y |
| 5 | HCForoushandeType1Code | nvarchar(128) | Y |
| 6 | date | date | N |
| 7 | addressId | int | Y |
| 8 | CurrencyID | int | N |
| 9 | BranchID | int | N |

### CFG.vwSaleAreaAccess

Definition: `programmability/views/CFG.vwSaleAreaAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | SaleAreaID | int | N |

### CFG.vwSaturnReportAccess

Definition: `programmability/views/CFG.vwSaturnReportAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | SaturnReportID | int | N |

### CFG.VwSeasonFile

Definition: `programmability/views/CFG.VwSeasonFile.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SeasonFileID | int | N |
| 2 | FinancialPeriodID | int | N |
| 3 | Season | tinyint | N |
| 4 | AutoGenerated | bit | N |
| 5 | DOCType | tinyint | N |
| 6 | DocName | nvarchar(MAX) | N |
| 7 | ID | bigint | N |
| 8 | StuffTitle | nvarchar(MAX) | N |
| 9 | LessThanQuorum | bit | N |
| 10 | Amount | decimal(30,4) | Y |
| 11 | Tax | decimal(30,4) | Y |
| 12 | Duty | decimal(30,4) | Y |
| 13 | ZipCode | nvarchar(256) | Y |
| 14 | PreNumberOfCity | nvarchar(50) | Y |
| 15 | Phone | nvarchar(50) | Y |
| 16 | Address | nvarchar(MAX) | Y |
| 17 | PartyFirstName | nvarchar(MAX) | Y |
| 18 | PartyLastName | nvarchar(MAX) | N |
| 19 | EconomicCode | nvarchar(50) | Y |
| 20 | NationalID | nvarchar(50) | Y |
| 21 | HCType1Code | tinyint | Y |
| 22 | provinceCode | nvarchar(50) | Y |
| 23 | cityCode | nvarchar(50) | Y |
| 24 | Type | bit | Y |
| 25 | Number | int | Y |
| 26 | Date | nvarchar(50) | Y |
| 27 | TradeType | tinyint | Y |
| 28 | BranchCode | int | N |
| 29 | BranchTitle | nvarchar(MAX) | N |
| 30 | Version | int | N |
| 31 | Creator | int | N |
| 32 | CreationDate | datetime | N |
| 33 | LastEditor | int | N |
| 34 | LastEditionDate | datetime | N |
| 35 | Discount | decimal(30,4) | Y |
| 36 | ArzType | int | Y |
| 37 | Arz_Price | decimal(30,4) | Y |
| 38 | Arz_MaliatArzeshAfzoodeh | decimal(30,4) | Y |
| 39 | Arz_AvarezArzeshAfzoodeh | decimal(30,4) | Y |
| 40 | Arz_SayerAvarez | decimal(30,4) | Y |
| 41 | Arz_TakhfifPrice | decimal(30,4) | Y |
| 42 | ArzBarabari_Price | decimal(18,2) | Y |
| 43 | ArzBarabari_MaliatArzeshAfzoodeh | decimal(18,2) | Y |
| 44 | ArzBarabari_AvarezArzeshAfzoodeh | decimal(18,2) | Y |
| 45 | ArzBarabari_SayerAvarez | decimal(18,2) | Y |
| 46 | ArzBarabari_TakhfifPrice | decimal(18,2) | Y |
| 47 | FactorNo | nvarchar(100) | Y |
| 48 | FactorDate | varchar(10) | Y |
| 49 | SarFaslType | int | Y |
| 50 | Sarjam | bit | N |
| 51 | IsHagholAmalKari | bit | N |
| 52 | IsArzi | bit | N |
| 53 | KalaType | int | Y |
| 54 | SaleTypeTitle | nvarchar(256) | Y |
| 55 | PurchaseType | tinyint | Y |
| 56 | FidaCode | nvarchar(11) | Y |
| 57 | AmountAccordingLicense | decimal(30,4) | Y |
| 58 | Currency | nvarchar(25) | Y |
| 59 | Arz_AmountAccordingLicense | decimal(30,4) | Y |
| 60 | ArzBarabari_AmountAccordingLicense | decimal(18,2) | Y |
| 61 | CotajNumber | varchar(250) | Y |
| 62 | CotajDate | varchar(10) | Y |
| 63 | EntranceCustomsCode | nvarchar(100) | Y |
| 64 | AssessmentCustomsCode | nvarchar(100) | Y |
| 65 | LetterCreditNumber | nvarchar(100) | Y |
| 66 | OpeningCreditDate | varchar(10) | Y |
| 67 | CountryCode | varchar(50) | Y |
| 68 | Nationality | int | Y |
| 69 | PayDate | nvarchar(10) | Y |
| 70 | GrossPrice | decimal(30,4) | Y |
| 71 | NetPrice | decimal(30,4) | Y |
| 72 | TaxDeducted | decimal(30,4) | Y |
| 73 | ContractNumber | nvarchar(250) | Y |
| 74 | StartDate | date | Y |
| 75 | FinishDate | date | Y |
| 76 | CompanyID | int | N |
| 77 | K_TypeCode | int | N |
| 78 | K_Tabeiat | int | N |
| 79 | K_Type1Code | int | Y |
| 80 | K_Name | nvarchar(256) | Y |
| 81 | K_LastNameSherkatName | nvarchar(256) | Y |
| 82 | K_EconomicNO | nvarchar(50) | Y |
| 83 | K_NationalCode | nvarchar(256) | Y |
| 84 | K_TellPishCode | int | Y |
| 85 | K_Tell | nvarchar(50) | Y |
| 86 | K_StateCode | nvarchar(50) | Y |
| 87 | K_CityCode | nvarchar(50) | Y |
| 88 | K_Address | nvarchar(256) | Y |
| 89 | K_PostCode | nvarchar(256) | Y |

### CFG.vwStationShiftAccess

Definition: `programmability/views/CFG.vwStationShiftAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | StationShiftID | int | N |

### CFG.vwStockAccess

Definition: `programmability/views/CFG.vwStockAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | StockID | int | N |

### CFG.vwStockDocumentsAccess

Definition: `programmability/views/CFG.vwStockDocumentsAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | StockDocumentTypeID | int | N |

### CFG.vwTableSizes

Definition: `programmability/views/CFG.vwTableSizes.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TableName | sysname | N |
| 2 | SchemaName | sysname | Y |
| 3 | RowCounts | bigint | Y |
| 4 | TotalSpaceKB | bigint | Y |
| 5 | TotalSpaceMB | numeric(36,2) | Y |
| 6 | UsedSpaceKB | bigint | Y |
| 7 | UsedSpaceMB | numeric(36,2) | Y |
| 8 | UnusedSpaceKB | bigint | Y |
| 9 | UnusedSpaceMB | numeric(36,2) | Y |

### CFG.vwTempName

| # | Column | Type | Null |
|---|---|---|---|
| 1 | tempName | varchar(8000) | Y |

### CFG.VwUserGroupRecordLevelAccess

Definition: `programmability/views/CFG.VwUserGroupRecordLevelAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | EntityID | bigint | N |
| 3 | RecorLevelSettingID | tinyint | N |

### CFG.VwUserSigniture

Definition: `programmability/views/CFG.VwUserSigniture.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | N |
| 2 | Signature | image | Y |
| 3 | FullName | nvarchar(512) | N |

### CFG.vwWorkTypeAccess

Definition: `programmability/views/CFG.vwWorkTypeAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | Y |
| 2 | WorkTypeID | int | N |

