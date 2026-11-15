# Schema `VND`

## Tables

### VND.ConfirmPurchaseInvoice

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceID | int | N |  | identity |
| 2 | Number | int | Y |  |  |
| 3 | Date | date | N |  |  |
| 4 | PreVoucherID | int | Y |  |  |
| 5 | PurchaseInvoiceID | int | N |  |  |
| 6 | Amount | decimal(30,4) | Y |  |  |
| 7 | FinancialPeriodID | int | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | ConfirmPurchaseInvoiceStatus | tinyint | N |  |  |

- **Primary key:** ConfirmPurchaseInvoiceID
- **FK** `FK_ConfirmPurchaseInvoice_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ConfirmPurchaseInvoice_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID)
- **FK** `FK_ConfirmPurchaseInvoice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmPurchaseInvoice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** CFG.DebitCreditNoteItem (ConfirmPurchaseInvoiceID); FIN.PaymentSubject (ConfirmPurchaseInvoiceID); FIN.PettyCashCostItem (ConfirmPurchaseInvoiceID); FIN.ReceiveSubject (ConfirmPurchaseInvoiceID); FOS.CreditAllocationItem (ConfirmPurchaseInvoiceID); VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceID)

### VND.ConfirmPurchaseInvoiceAdvancePayment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceAdvancePaymentID | int | N |  | identity |
| 2 | ConfirmPurchaseInvoiceItemID | int | Y |  |  |
| 3 | PaymentSubjectID | int | Y |  |  |
| 4 | DebitCreditNoteItemID | int | Y |  |  |
| 5 | Price | decimal(30,4) | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | AllocationSharingAmount | decimal(30,4) | Y |  |  |

- **FK** `FK_ConfirmPurchaseInvoiceAdvancePayment_ConfirmPurchaseInvoiceItem` (ConfirmPurchaseInvoiceItemID) -> VND.ConfirmPurchaseInvoiceItem (ConfirmPurchaseInvoiceItemID) on delete CASCADE
- **FK** `FK_ConfirmPurchaseInvoiceAdvancePayment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ConfirmPurchaseInvoiceAdvancePayment_DebitCreditNoteItem` (DebitCreditNoteItemID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_ConfirmPurchaseInvoiceAdvancePayment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ConfirmPurchaseInvoiceAdvancePayment_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)

### VND.ConfirmPurchaseInvoiceItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceItemID | int | N |  | identity |
| 2 | ConfirmPurchaseInvoiceID | int | Y |  |  |
| 3 | RowIndex | int | Y |  |  |
| 4 | AdditionDeductionTypeID | int | Y |  |  |
| 5 | AdditionDeductionTypeMethodID | int | Y |  |  |
| 6 | Addition | decimal(30,4) | Y |  |  |
| 7 | Deduction | decimal(30,4) | Y |  |  |
| 8 | Description | nvarchar(500) | Y |  |  |
| 9 | Description2 | nvarchar(500) | Y |  |  |
| 10 | AllocationSharingAmount | decimal(30,4) | Y |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Version | int | N |  |  |

- **Primary key:** ConfirmPurchaseInvoiceItemID
- **FK** `FK_ConfirmPurchaseInvoiceItem_ConfirmPurchaseInvoice` (ConfirmPurchaseInvoiceID) -> VND.ConfirmPurchaseInvoice (ConfirmPurchaseInvoiceID) on delete CASCADE
- **FK** `FK_ConfirmPurchaseInvoiceItem_AdditionDeductionType` (AdditionDeductionTypeID) -> CNT.AdditionDeductionType (AdditionDeductionTypeID)
- **FK** `FK_ConfirmPurchaseInvoiceItem_AdditionDeductionTypeMethod` (AdditionDeductionTypeMethodID) -> CNT.AdditionDeductionTypeMethod (AdditionDeductionTypeMethodID)
- **Referenced by:** CFG.DebitCreditNoteItem (ConfirmPurchaseInvoiceItemID); FIN.PaymentSubject (ConfirmPurchaseInvoiceItemID); FIN.PettyCashCostItem (ConfirmPurchaseInvoiceItemID); FOS.CreditAllocationItem (ConfirmPurchaseInvoiceItemID); VND.ConfirmPurchaseInvoiceAdvancePayment (ConfirmPurchaseInvoiceItemID)

### VND.Criteria

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CriteriaID | int | N |  | identity |
| 2 | Title | nvarchar(255) | N |  |  |
| 3 | Title2 | nvarchar(255) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** CriteriaID
- **FK** `FK_Criteria_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Criteria_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.DeliveryJustification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliveryJustificationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | BaseType | tinyint | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | BranchID | int | N |  |  |
| 7 | Status | tinyint | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** DeliveryJustificationID
- **FK** `FK_DeliveryJustification_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_DeliveryJustification_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_DeliveryJustification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DeliveryJustification_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** VND.DeliveryJustificationItem (DeliveryJustificationID)

### VND.DeliveryJustificationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeliveryJustificationItemID | int | N |  | identity |
| 2 | DeliveryJustificationID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PurchaseContractItemID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(30,4) | N |  |  |
| 7 | SubQuantity | decimal(30,4) | Y |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** DeliveryJustificationItemID
- **FK** `FK_DeliveryJustificationItem_DeliveryJustification` (DeliveryJustificationID) -> VND.DeliveryJustification (DeliveryJustificationID) on delete CASCADE
- **FK** `FK_DeliveryJustificationItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_DeliveryJustificationItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_DeliveryJustificationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DeliveryJustificationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.AssetReceiptItem (DeliveryJustificationItemID); STC.StockReceiptItem (DeliveryJustificationItemID); STC.TemporaryStockReceiptItem (DeliveryJustificationItemID)

### VND.DocumentVerification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentVerificationID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | BaseType | tinyint | N |  |  |
| 5 | BaseID | int | N |  |  |
| 6 | DocumentVerificationPathItemID | int | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | Description2 | nvarchar(MAX) | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DocumentVerificationID
- **FK** `FK_DocumentVerification_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentVerification_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.DocumentVerificationPath

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentVerificationPathID | int | N |  | identity |
| 2 | Title | nvarchar(255) | N |  |  |
| 3 | Title2 | nvarchar(255) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | FromAmount | decimal(36,10) | Y |  |  |
| 10 | ToAmount | decimal(36,10) | Y |  |  |
| 11 | Nature | tinyint | N | ((1)) |  |
| 12 | EffectiveDate | datetime | N | (getdate()) |  |
| 13 | CurrencyID | int | N |  |  |

- **Primary key:** DocumentVerificationPathID
- **FK** `FK_DocumentVerificationPath_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentVerificationPath_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DocumentVerificationPath_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **Referenced by:** REQ.TenderRequest (DocumentVerificationPathID); VND.DocumentVerificationPathItem (DocumentVerificationPathID); VND.Enactment (DocumentVerificationPathID); VND.PurchasePlanning (DocumentVerificationPathID)

### VND.DocumentVerificationPathItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentVerificationPathItemID | int | N |  | identity |
| 2 | DocumentVerificationPathID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | Title | nvarchar(1024) | N |  |  |
| 5 | Title2 | nvarchar(1024) | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** DocumentVerificationPathItemID
- **FK** `FK_DocumentVerificationPathItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DocumentVerificationPathItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DocumentVerificationPathItem_DocumentVerificationPath` (DocumentVerificationPathID) -> VND.DocumentVerificationPath (DocumentVerificationPathID) on delete CASCADE

### VND.Enactment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | EnactmentID | int | N |  | identity |
| 2 | Number | varchar(100) | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | TenderID | int | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | State | tinyint | N |  |  |
| 7 | Description | nvarchar(MAX) | Y |  |  |
| 8 | NeedDocumentVerification | bit | Y |  |  |
| 9 | DocumentVerificationPathID | int | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |

- **Primary key:** EnactmentID
- **FK** `FK_Enactment_Tender` (TenderID) -> VND.Tender (TenderID)
- **FK** `FK_Enactment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Enactment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Enactment_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Enactment_DocumentVerificationPath` (DocumentVerificationPathID) -> VND.DocumentVerificationPath (DocumentVerificationPathID)

### VND.FinalEvaluation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FinalEvaluationID | int | N |  | identity |
| 2 | TenderID | int | Y |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | PurchasePlanningID | int | Y |  |  |
| 9 | BaseType | tinyint | N | ((1)) |  |
| 10 | Status | tinyint | N | ((1)) |  |
| 11 | Date | datetime | N | (getdate()) |  |
| 12 | MeetingMinutes | nvarchar(MAX) | Y |  |  |
| 13 | Number | int | N |  |  |

- **Primary key:** FinalEvaluationID
- **FK** `FK_FinalEvaluation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FinalEvaluation_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FinalEvaluation_Tender` (TenderID) -> VND.Tender (TenderID)
- **FK** `FK_FinalEvaluation_PurchasePlanning` (PurchasePlanningID) -> VND.PurchasePlanning (PurchasePlanningID)
- **Referenced by:** VND.FinalEvaluationItem (FinalEvaluationID)

### VND.FinalEvaluationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | FinalEvaluationItemID | int | N |  | identity |
| 2 | FinalEvaluationID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | Score | decimal(5,2) | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | IsConfirm | bit | Y |  |  |
| 12 | Description2 | nvarchar(MAX) | Y |  |  |

- **Primary key:** FinalEvaluationItemID
- **FK** `FK_FinalEvaluationItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_FinalEvaluationItem_EditorUser` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_FinalEvaluationItem_FinalEvaluation` (FinalEvaluationID) -> VND.FinalEvaluation (FinalEvaluationID) on delete CASCADE
- **FK** `FK_FinalEvaluationItem_Party` (PartyID) -> CFG.Party (PartyID)

### VND.Indicator

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | IndicatorID | int | N |  | identity |
| 2 | CriteriaID | int | N |  |  |
| 3 | Title | nvarchar(255) | N |  |  |
| 4 | Title2 | nvarchar(255) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** IndicatorID
- **FK** `FK_Indicator_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_Indicator_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.InqueryPermission

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InqueryPermissionID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | BranchID | int | Y |  |  |
| 5 | PurchasePlanningID | int | Y |  |  |
| 6 | Status | tinyint | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** InqueryPermissionID
- **FK** `FK_InqueryPermission_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_InqueryPermission_PurchasePlanning` (PurchasePlanningID) -> VND.PurchasePlanning (PurchasePlanningID)
- **FK** `FK_InqueryPermission_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InqueryPermission_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** VND.InqueryPermissionItem (InqueryPermissionID)

### VND.InqueryPermissionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InqueryPermissionItemID | int | N |  | identity |
| 2 | InqueryPermissionID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PartyID | bigint | Y |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** InqueryPermissionItemID
- **FK** `FK_InqueryPermissionItem_InqueryPermission` (InqueryPermissionID) -> VND.InqueryPermission (InqueryPermissionID) on delete CASCADE
- **FK** `FK_InqueryPermissionItem_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_InqueryPermissionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InqueryPermissionItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### VND.PorcumentGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PorcumentGroupID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PorcumentGroupID
- **FK** `FK_PorcumentGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PorcumentGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PorcumentGroup_Parent` (ParentID) -> VND.PorcumentGroup (PorcumentGroupID)
- **Referenced by:** STF.StuffDetail (PorcumentGroupID); VND.PorcumentGroup (ParentID); VND.PorcumentGroupItem (PorcumentGroupID); VND.PurchasePlanning (PorcumentGroupID)

### VND.PorcumentGroupItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PorcumentGroupItemID | int | N |  | identity |
| 2 | PorcumentGroupID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PartyID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PorcumentGroupItemID
- **FK** `FK_PorcumentGroupItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PorcumentGroupItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PorcumentGroupItem_PorcumentGroup` (PorcumentGroupID) -> VND.PorcumentGroup (PorcumentGroupID) on delete CASCADE
- **FK** `FK_PorcumentGroupItem_Party` (PartyID) -> CFG.Party (PartyID)

### VND.Proposal

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProposalID | int | N |  | identity |
| 2 | PartyID | bigint | N |  | تامین کننده |
| 3 | BranchID | int | N |  |  |
| 4 | FinancialPeriodID | int | N |  |  |
| 5 | QuotationNumber | nvarchar(100) | Y |  |  |
| 6 | QuotationDate | date | Y |  | تاریخ فاکتور |
| 7 | ExpireDate | date | Y |  |  |
| 8 | Number | int | N |  |  |
| 9 | Date | date | N |  | تاریخ |
| 10 | CurrencyID | int | N |  |  |
| 11 | TotalPrice | decimal(30,4) | N |  |  |
| 12 | TotalDiscount | decimal(30,4) | N |  |  |
| 13 | TotalTax | decimal(30,4) | N |  | مالیات |
| 14 | TotalDuty | decimal(30,4) | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | BaseDocument | tinyint | N | ((1)) |  |
| 21 | Status | tinyint | N |  |  |

- **Primary key:** ProposalID
- **FK** `FK_Proposal_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Proposal_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Proposal_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_Proposal_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Proposal_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Proposal_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** CFG.DebitCreditNoteItem (ProposalID); FIN.PaymentSubject (ProposalID); FIN.PettyCashCostItem (ProposalID); VND.ProposalItem (ProposalID)

### VND.ProposalCommission

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProposalCommissionID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | PurchaseRequestID | int | Y |  |  |
| 6 | Description | nvarchar(MAX) | Y |  |  |
| 7 | Description2 | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | Status | tinyint | Y |  |  |
| 14 | BranchID | int | N | ((-1)) |  |
| 15 | PurchaseplanningID | int | Y |  |  |

- **Primary key:** ProposalCommissionID
- **FK** `FK_ProposalCommission_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ProposalCommission_Purchaseplanning` (PurchaseplanningID) -> VND.PurchasePlanning (PurchasePlanningID)
- **FK** `FK_ProposalCommission_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProposalCommission_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ProposalCommission_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProposalCommission_PurchaseRequest` (PurchaseRequestID) -> REQ.PurchaseRequest (PurchaseRequestID)
- **Referenced by:** VND.ProposalCommissionItem (ProposalCommissionID)

### VND.ProposalCommissionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProposalCommissionItemID | int | N |  | identity |
| 2 | ProposalCommissionID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | ProposalItemID | int | N |  |  |
| 5 | Chosen | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Description | nvarchar(500) | Y |  |  |

- **Primary key:** ProposalCommissionItemID
- **FK** `FK_ProposalCommissionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProposalCommissionItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProposalCommissionItem_ProposalCommission` (ProposalCommissionID) -> VND.ProposalCommission (ProposalCommissionID) on delete CASCADE
- **FK** `FK_ProposalCommissionItem_ProposalItemID` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)

### VND.ProposalItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProposalItemID | int | N |  | identity |
| 2 | ProposalID | int | N |  |  |
| 3 | RowIndex | smallint | N |  | ردیف |
| 4 | PurchaseRequestItemID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(30,4) | N |  | مقدار اصلی |
| 7 | SubQuantity | decimal(30,4) | Y |  | مقدار فرعی |
| 8 | Fee | decimal(36,10) | Y |  | فی |
| 9 | Price | decimal(30,4) | N |  | مبلغ |
| 10 | Discount | decimal(30,4) | N |  | تخفیف |
| 11 | Tax | decimal(30,4) | N |  | مالیات |
| 12 | Duty | decimal(30,4) | N |  | عوارض |
| 13 | Description | nvarchar(MAX) | Y |  |  |
| 14 | Description2 | nvarchar(MAX) | Y |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | PurchasePlanningItemID | int | Y |  |  |

- **Primary key:** ProposalItemID
- **FK** `FK_ProposalItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ProposalItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ProposalItem_Proposal` (ProposalID) -> VND.Proposal (ProposalID) on delete CASCADE
- **FK** `FK_ProposalItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_ProposalItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ProposalItem_PurchasePlanningItem` (PurchasePlanningItemID) -> VND.PurchasePlanningItem (PurchasePlanningItemID)
- **Referenced by:** FOS.ProformaInvoiceItem (ProposalItemID); STC.JustificationInputItem (ProposalItemID); STC.StockReceiptItem (ProposalItemID); STC.TemporaryStockReceiptItem (ProposalItemID); VND.ProposalCommissionItem (ProposalItemID); VND.PurchaseContractItem (ProposalItemID); VND.PurchaseInvoiceItem (ProposalItemID)

### VND.PurchaseContract

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseContractID | int | N |  | identity |
| 2 | BaseType | tinyint | N |  |  |
| 3 | DlID | bigint | N |  |  |
| 4 | BranchID | int | N |  |  |
| 5 | FinancialPeriodID | int | N |  |  |
| 6 | Type | tinyint | N |  |  |
| 7 | InvoiceNumber | nvarchar(100) | Y |  |  |
| 8 | InvoiceDate | date | Y |  |  |
| 9 | Number | int | N |  |  |
| 10 | Date | date | N |  |  |
| 11 | CurrencyID | int | N |  |  |
| 12 | TotalPrice | decimal(30,4) | N |  |  |
| 13 | TotalDiscount | decimal(30,4) | N |  |  |
| 14 | TotalTax | decimal(30,4) | N |  |  |
| 15 | TotalDuty | decimal(30,4) | N |  |  |
| 16 | TotalNetPrice | decimal(30,4) | N |  |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | Version | int | N |  |  |
| 22 | Status | tinyint | N |  |  |
| 23 | PurchaseOrderDlID | bigint | Y |  |  |

- **Primary key:** PurchaseContractID
- **FK** `FK_PurchaseContract_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PurchaseContract_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseContract_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PurchaseContract_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PurchaseContract_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PurchaseContract_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseContract_PurchaseType` (Type) -> VND.PurchaseType (PurchaseTypeID)
- **FK** `FK_PurchaseContract_PurchaseOrderDL` (PurchaseOrderDlID) -> ACC.DL (DLID)
- **Referenced by:** CFG.DebitCreditNoteItem (PurchaseContractID); FIN.PaymentSubject (PurchaseContractID); FIN.PettyCashCostItem (PurchaseContractID); FIN.ReceiveCommitment (PurchaseContractID); VND.PurchaseContractItem (PurchaseContractID)

### VND.PurchaseContractItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseContractItemID | int | N |  | identity |
| 2 | PurchaseContractID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PurchaseRequestItemID | int | Y |  |  |
| 5 | StuffRequestItemID | int | Y |  |  |
| 6 | ProposalItemID | int | Y |  |  |
| 7 | StuffID | int | N |  |  |
| 8 | MainQuantity | decimal(30,4) | N |  |  |
| 9 | SubQuantity | decimal(30,4) | Y |  |  |
| 10 | Fee | decimal(36,10) | Y |  |  |
| 11 | Price | decimal(30,4) | N |  |  |
| 12 | Discount | decimal(30,4) | N |  |  |
| 13 | Tax | decimal(30,4) | N |  |  |
| 14 | Duty | decimal(30,4) | N |  |  |
| 15 | CostOfBuying | decimal(30,4) | N |  |  |
| 16 | Net | decimal(30,4) | N |  |  |
| 17 | Description | nvarchar(MAX) | Y |  |  |
| 18 | Description2 | nvarchar(MAX) | Y |  |  |
| 19 | Creator | int | N |  |  |
| 20 | CreationDate | datetime | N |  |  |
| 21 | LastEditor | int | N |  |  |
| 22 | LastEditionDate | datetime | N |  |  |
| 23 | Version | int | N |  |  |

- **Primary key:** PurchaseContractItemID
- **FK** `FK_PurchaseContractItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseContractItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseContractItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_PurchaseContractItem_PurchaseContract` (PurchaseContractID) -> VND.PurchaseContract (PurchaseContractID) on delete CASCADE
- **FK** `FK_PurchaseContractItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_PurchaseContractItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_PurchaseContractItem_StuffRequestItem` (StuffRequestItemID) -> REQ.StuffRequestItem (StuffRequestItemID)
- **Referenced by:** FOS.ProformaInvoiceItem (PurchaseContractItemID); STC.JustificationInputItem (PurchaseContractItemID); STC.StockReceiptItem (PurchaseContractItemID); STC.TemporaryStockReceiptItem (PurchaseContractItemID); VND.DeliveryJustificationItem (PurchaseContractItemID); VND.PurchaseInvoiceItem (PurchaseContractItemID)

### VND.PurchaseInvoice

Rows: 16006 | فاکتور خرید

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |  | identity |
| 2 | BaseType | tinyint | N |  |  |
| 3 | DlID | bigint | N |  | تامین کننده |
| 4 | BranchID | int | N |  |  |
| 5 | FinancialPeriodID | int | N |  |  |
| 6 | Type | tinyint | N |  | نوع فاکتور خرید :پ 0 - خرید داخلی 1- خرید وارداتی |
| 7 | InvoiceNumber | nvarchar(100) | Y |  |  |
| 8 | InvoiceDate | date | Y |  | تاریخ فاکتور |
| 9 | Number | int | N |  |  |
| 10 | Date | date | N |  | تاریخ |
| 11 | CurrencyID | int | N |  |  |
| 12 | CurrencyRate | decimal(20,10) | N |  |  |
| 13 | TotalPrice | decimal(36,10) | Y |  |  |
| 14 | TotalDiscount | decimal(36,10) | Y |  |  |
| 15 | TotalTax | decimal(36,10) | Y |  | مالیات |
| 16 | TotalDuty | decimal(36,10) | Y |  |  |
| 17 | TotalNetPrice | decimal(36,10) | Y |  | خالص |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | Version | int | N |  |  |
| 23 | PreVoucherID | int | Y |  |  |
| 24 | ExchangeManner | tinyint | Y |  |  |
| 25 | Status | tinyint | Y | ((1)) |  |

- **Primary key:** PurchaseInvoiceID
- **index** `IX_PURCHASENVOICE_FINANCE` (FinancialPeriodID)
- **FK** `FK_PurchaseInvoice_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PurchaseInvoice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseInvoice_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_PurchaseInvoice_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_PurchaseInvoice_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_PurchaseInvoice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseInvoice_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_PurchaseInvoice_PurchaseType` (Type) -> VND.PurchaseType (PurchaseTypeID)
- **Referenced by:** CFG.DebitCreditNoteItem (PurchaseInvoiceID); CFG.ManualReceipt (PurchaseInvoiceID); CNT.ConfirmStatementItem (PurchaseInvoiceID); FIN.PaymentSubject (PurchaseInvoiceID); FIN.PettyCashCostItem (PurchaseInvoiceID); FIN.ReceiveSubject (PurchaseInvoiceID); FOS.CreditAllocationItem (PurchaseInvoiceID); VND.ConfirmPurchaseInvoice (PurchaseInvoiceID); VND.PurchaseInvoiceItem (PurchaseInvoiceID); VND.PurchaseInvoicePrePayment (PurchaseInvoiceID)

### VND.PurchaseInvoiceItem

Rows: 48665

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseInvoiceItemID | int | N |  | identity |
| 2 | PurchaseInvoiceID | int | N |  |  |
| 3 | RowIndex | smallint | N |  | ردیف |
| 4 | PurchaseRequestItemID | int | Y |  |  |
| 5 | ContractSubjectID | int | Y |  |  |
| 6 | ProposalItemID | int | Y |  |  |
| 7 | StuffID | int | N |  |  |
| 8 | MainQuantity | decimal(36,10) | Y |  | مقدار اصلی |
| 9 | SubQuantity | decimal(36,10) | Y |  | مقدار فرعی |
| 10 | Fee | decimal(36,10) | Y |  | فی |
| 11 | Price | decimal(36,10) | Y |  | مبلغ |
| 12 | Discount | decimal(36,10) | Y |  | تخفیف |
| 13 | Tax | decimal(36,10) | Y |  | مالیات |
| 14 | Duty | decimal(36,10) | Y |  | عوارض |
| 15 | Net | decimal(36,10) | Y |  | خالص |
| 16 | Description | nvarchar(MAX) | Y |  |  |
| 17 | Description2 | nvarchar(MAX) | Y |  |  |
| 18 | Creator | int | N |  |  |
| 19 | CreationDate | datetime | N |  |  |
| 20 | LastEditor | int | N |  |  |
| 21 | LastEditionDate | datetime | N |  |  |
| 22 | Version | int | N |  |  |
| 23 | StockReceiptItemID | int | Y |  |  |
| 24 | PurchaseContractItemID | int | Y |  |  |
| 25 | AllocationSharingAmount | decimal(36,10) | Y |  |  |
| 26 | ProformaInvoiceItemID | int | Y |  |  |
| 27 | IsVatPartOfCost | bit | N | ((0)) |  |
| 28 | CostOfBuying | decimal(38,10) | Y |  | computed: (case when [IsVatPartOfCost]=(0) then [Price]-[Discount] when [IsVatPartOfCost]=(1) then (([Price]+[Tax])+[Duty])-[Discount] else (0) end) |
| 29 | AssetReceiptItemID | int | Y |  |  |

- **Primary key:** PurchaseInvoiceItemID
- **index** `IX_PurchaseContractItemID` (PurchaseContractItemID) include (MainQuantity, SubQuantity)
- **FK** `FK_PurchaseInvoiceItem_AssetReceiptItem` (AssetReceiptItemID) -> AST.AssetReceiptItem (AssetReceiptItemID)
- **FK** `FK_PurchaseInvoiceItem_ContractSubject` (ContractSubjectID) -> CNT.ContractSubject (ContractSubjectID)
- **FK** `FK_PurchaseInvoiceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseInvoiceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseInvoiceItem_ProformaInvoiceItem` (ProformaInvoiceItemID) -> FOS.ProformaInvoiceItem (ProformaInvoiceItemID)
- **FK** `FK_PurchaseInvoiceItem_ProposalItem` (ProposalItemID) -> VND.ProposalItem (ProposalItemID)
- **FK** `FK_PurchaseInvoiceItem_PurchaseContractItem` (PurchaseContractItemID) -> VND.PurchaseContractItem (PurchaseContractItemID)
- **FK** `FK_PurchaseInvoiceItem_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID) on delete CASCADE
- **FK** `FK_PurchaseInvoiceItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_PurchaseInvoiceItem_StockReceiptItem` (StockReceiptItemID) -> STC.StockReceiptItem (StockReceiptItemID)
- **FK** `FK_PurchaseInvoiceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** AST.AssetReceiptItem (PurchaseInvoiceItemID); AST.AssetReceiptUtilizationCost (PurchaseInvoiceItemID); AST.Creation (PurchaseInvoiceItemID); AST.Insurance (PurchaseInvoiceItemID); AST.RepairServiceCost (PurchaseInvoiceItemID); AST.RepairStuffCost (PurchaseInvoiceItemID); AST.UtilizationCost (PurchaseInvoiceItemID); FOS.BillOfLading (PurchaseInvoiceItemID); FOS.BillOfLadingItem (PurchaseInvoiceItemID); FOS.CostOfOrderItem (PurchaseInvoiceItemID); FOS.ShippingInsurance (PurchaseInvoiceItemID); STC.ReceiptCost (PurchaseInvoiceItemID); STC.StockReceiptItem (PurchaseInvoiceItemID); STC.TemporaryStockReceiptItem (PurchaseInvoiceItemID); VND.ReturnInvoiceItem (PurchaseInvoiceItemID)

### VND.PurchaseInvoicePrePayment

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseInvoicePrePaymentID | int | N |  | identity |
| 2 | PurchaseInvoiceID | int | N |  |  |
| 3 | PaymentSubjectID | int | Y |  |  |
| 4 | Price | decimal(30,4) | N |  |  |
| 5 | LastEditionDate | datetime | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | DebitCreditNoteItemID | int | Y |  |  |
| 11 | PettyCashCostItemID | int | Y |  |  |
| 12 | CurrencyExchangePAL | decimal(30,4) | N |  |  |

- **Primary key:** PurchaseInvoicePrePaymentID
- **FK** `FK_PurchaseInvoicePrePayment_DebitCreditNoteItem` (DebitCreditNoteItemID) -> CFG.DebitCreditNoteItem (DebitCreditNoteItemID)
- **FK** `FK_PurchaseInvoicePrePayment_PaymentSubject` (PaymentSubjectID) -> FIN.PaymentSubject (PaymentSubjectID)
- **FK** `FK_PurchaseInvoicePrePayment_PettyCashCostItem` (PettyCashCostItemID) -> FIN.PettyCashCostItem (PettyCashCostItemID)
- **FK** `FK_PurchaseInvoicePrePayment_PurchaseInvoice` (PurchaseInvoiceID) -> VND.PurchaseInvoice (PurchaseInvoiceID) on delete CASCADE
- **Referenced by:** NOC.CashDataCollection (PurchaseInvoicePrePaymentID)

### VND.PurchasePlanning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchasePlanningID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | BranchID | int | N | ((-1)) |  |
| 5 | PurchaseExpertUserID | int | N |  |  |
| 6 | PorcumentGroupID | int | N |  |  |
| 7 | PurchaseSubject | nvarchar(MAX) | N |  |  |
| 8 | PurchaseSubject2 | nvarchar(MAX) | N |  |  |
| 9 | DocumentVerificationPathID | int | Y |  |  |
| 10 | PartyID | bigint | Y |  |  |
| 11 | Status | tinyint | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |
| 17 | Description | nvarchar(MAX) | Y |  |  |
| 18 | Description2 | nvarchar(MAX) | Y |  |  |
| 19 | Urgency | tinyint | N |  |  |
| 20 | CurrencyID | int | N |  |  |

- **Primary key:** PurchasePlanningID
- **FK** `FK_PurchasePlanning_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_PurchasePlanning_PurchaseExpertUser` (PurchaseExpertUserID) -> CFG.User (UserID)
- **FK** `FK_PurchasePlanning_PorcumentGroup` (PorcumentGroupID) -> VND.PorcumentGroup (PorcumentGroupID)
- **FK** `FK_PurchasePlanning_DocumentVerificationPath` (DocumentVerificationPathID) -> VND.DocumentVerificationPath (DocumentVerificationPathID)
- **FK** `FK_PurchasePlanning_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_PurchasePlanning_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchasePlanning_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchasePlanning_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **Referenced by:** VND.FinalEvaluation (PurchasePlanningID); VND.InqueryPermission (PurchasePlanningID); VND.ProposalCommission (PurchaseplanningID); VND.PurchasePlanningItem (PurchasePlanningID)

### VND.PurchasePlanningItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchasePlanningItemID | int | N |  | identity |
| 2 | PurchasePlanningID | int | N |  |  |
| 3 | PurchaseRequestItemID | int | N |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | MainQuantity | decimal(30,4) | N |  |  |
| 6 | SubQuantity | decimal(30,4) | Y |  |  |
| 7 | EstimatedPrice | decimal(36,10) | N |  |  |
| 8 | Description | nvarchar(MAX) | Y |  |  |
| 9 | Description2 | nvarchar(MAX) | Y |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | Version | int | N |  |  |
| 15 | RowIndex | smallint | N |  |  |

- **Primary key:** PurchasePlanningItemID
- **FK** `FK_PurchasePlanningItem_PurchasePlanning` (PurchasePlanningID) -> VND.PurchasePlanning (PurchasePlanningID) on delete CASCADE
- **FK** `FK_PurchasePlanningItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_PurchasePlaningItem_PurchaseRequestItem` (PurchaseRequestItemID) -> REQ.PurchaseRequestItem (PurchaseRequestItemID)
- **FK** `FK_PurchasePlanningItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchasePlanningItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** VND.ProposalItem (PurchasePlanningItemID)

### VND.PurchaseType

Rows: 8

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PurchaseTypeID | tinyint | N |  | identity |
| 2 | Type | bit | N | ((0)) |  |
| 3 | Code | int | N |  |  |
| 4 | Title | nvarchar(50) | N |  |  |
| 5 | Title2 | nvarchar(50) | N |  |  |
| 6 | SlID | int | N |  |  |
| 7 | IsActive | bit | N | ((0)) |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |
| 13 | TaxSlId | int | N |  |  |
| 14 | DutySlId | int | N |  |  |
| 15 | IsRepresentative | bit | Y |  |  |
| 16 | PartyID | bigint | Y |  |  |
| 17 | HasConfirmStatement | bit | N | ((0)) |  |

- **Primary key:** PurchaseTypeID
- **unique index** `IX_PurchaseType_Code` (Code)
- **FK** `FK_PurchaseType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PurchaseType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PurchaseType_SL` (SlID) -> ACC.SL (SlID)
- **FK** `FK_PurchaseType_TaxSL` (TaxSlId) -> ACC.SL (SlID)
- **FK** `FK_PurchaseType_DutySL` (DutySlId) -> ACC.SL (SlID)
- **Referenced by:** STF.StuffAccountGroupPurchaseType (PurchaseTypeID); VND.PurchaseContract (Type); VND.PurchaseInvoice (Type); VND.ReturnInvoice (Type)

### VND.ReturnInvoice

Rows: 5

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnInvoiceID | int | N |  | identity |
| 2 | DlID | bigint | N |  | تامین کننده |
| 3 | BranchID | int | N |  |  |
| 4 | FinancialPeriodID | int | N |  |  |
| 5 | Type | tinyint | N |  | نوع فاکتور خرید :پ 0 - خرید داخلی 1- خرید وارداتی |
| 6 | Number | int | N |  |  |
| 7 | Date | date | N |  | تاریخ فاکتور |
| 8 | CurrencyID | int | N |  |  |
| 9 | CurrencyRate | decimal(20,10) | N |  |  |
| 10 | TotalPrice | decimal(36,10) | Y |  |  |
| 11 | TotalTax | decimal(36,10) | Y |  | مالیات و عوارض |
| 12 | TotalDuty | decimal(36,10) | Y |  |  |
| 13 | TotalNetPrice | decimal(36,10) | Y |  | خالص |
| 14 | Non_Received | decimal(36,10) | Y |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | Version | int | N |  |  |
| 20 | PreVoucherID | int | Y |  |  |
| 21 | BaseType | tinyint | Y |  |  |

- **Primary key:** ReturnInvoiceID
- **index** `IX_RETURN_INVOICE_FINANCE` (FinancialPeriodID)
- **FK** `FK_ReturnInvoice_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReturnInvoice_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnInvoice_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_ReturnInvoice_DL` (DlID) -> ACC.DL (DLID)
- **FK** `FK_ReturnInvoice_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReturnInvoice_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnInvoice_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ReturnInvoice_PurchaseType` (Type) -> VND.PurchaseType (PurchaseTypeID)
- **Referenced by:** CFG.DebitCreditNoteItem (ReturnInvoiceID); CFG.ManualReceipt (ReturnInvoiceID); FIN.ReceiveSubject (ReturnInvoiceID); VND.ReturnInvoiceItem (ReturnInvoiceID)

### VND.ReturnInvoiceItem

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReturnInvoiceItemID | int | N |  | identity |
| 2 | ReturnInvoiceID | int | N |  |  |
| 3 | PurchaseInvoiceItemID | int | Y |  | قلم فاکتور خرید مبنا |
| 4 | ReturnStockReceiptItemID | int | Y |  | قلم برگشت به رسید مبنا |
| 5 | RowIndex | smallint | N |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | Y |  | مقدار اصلی |
| 8 | SubQuantity | decimal(36,10) | Y |  | مقدار فرعی |
| 9 | Fee | decimal(36,10) | Y |  |  |
| 10 | Price | decimal(36,10) | Y |  | مبلغ |
| 11 | Discount | decimal(36,10) | Y |  |  |
| 12 | Tax | decimal(36,10) | Y |  | مالیات |
| 13 | Duty | decimal(36,10) | Y |  | عوارض |
| 14 | Net | decimal(36,10) | Y |  | خالص |
| 15 | Description | nvarchar(MAX) | Y |  |  |
| 16 | Description2 | nvarchar(MAX) | Y |  |  |
| 17 | Creator | int | N |  |  |
| 18 | CreationDate | datetime | N |  |  |
| 19 | LastEditor | int | N |  |  |
| 20 | LastEditionDate | datetime | N |  |  |
| 21 | Version | int | N |  |  |

- **Primary key:** ReturnInvoiceItemID
- **index** `IX_returnINVOICE_ParentID` (ReturnInvoiceID)
- **FK** `FK_ReturnInvoiceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReturnInvoiceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReturnInvoiceItem_ReturnInvoice` (ReturnInvoiceID) -> VND.ReturnInvoice (ReturnInvoiceID) on delete CASCADE
- **FK** `FK_ReturnInvoiceItem_ReturnStockReciptItem` (ReturnStockReceiptItemID) -> STC.ReturnStockReceiptItem (ReturnStockReceiptItemID)
- **FK** `FK_ReturnInvoiceItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_ReturnInvoiceItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)

### VND.Tender

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderID | int | N |  | identity |
| 2 | Number | varchar(100) | Y |  |  |
| 3 | Date | date | N |  |  |
| 4 | TimeOut | date | N |  |  |
| 5 | Title | nvarchar(500) | N |  |  |
| 6 | Title2 | nvarchar(500) | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | TenderRequestID | int | Y |  |  |
| 13 | TechnicalRating | decimal(5,2) | Y |  |  |
| 14 | Type | tinyint | Y |  |  |
| 15 | Description | nvarchar(MAX) | Y |  |  |
| 16 | Method | tinyint | N | ((1)) |  |

- **Primary key:** TenderID
- **FK** `FK_Tender_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Tender_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** FIN.PaymentCommitment (TenderID); FIN.ReceiveCommitment (TenderID); VND.Enactment (TenderID); VND.FinalEvaluation (TenderID); VND.TenderCommission (TenderID); VND.TenderDocument (TenderID); VND.TenderParticipate (TenderID)

### VND.TenderCommission

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderCommissionID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | TenderID | int | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** TenderCommissionID
- **FK** `FK_TenderCommission_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderCommission_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TenderCommission_Tender` (TenderID) -> VND.Tender (TenderID)
- **Referenced by:** VND.TenderCommissionItem (TenderCommissionID)

### VND.TenderCommissionItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderCommissionItemID | int | N |  | identity |
| 2 | TenderCommissionID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | PartyID | bigint | Y |  |  |

- **Primary key:** TenderCommissionItemID
- **FK** `FK_TenderCommissionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderCommissionItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TenderCommissionItem_TenderCommission` (TenderCommissionID) -> VND.TenderCommission (TenderCommissionID) on delete CASCADE

### VND.TenderCriteria

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderCriteriaID | int | N |  | identity |
| 2 | TenderID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderCriteriaID
- **FK** `FK_TenderCriteria_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderCriteria_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderCriteriaItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderCriteriaItemID | int | N |  | identity |
| 2 | TenderCriteriaID | int | N |  |  |
| 3 | CriteriaID | int | N |  |  |
| 4 | Weight | decimal(5,2) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderCriteriaItemID
- **FK** `FK_TenderCriteriaItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderCriteriaItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderDocument

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderDocumentID | int | N |  | identity |
| 2 | TenderDocumentTypeID | int | N |  |  |
| 3 | TenderID | int | N |  |  |
| 4 | DocumentID | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** TenderDocumentID
- **FK** `FK_TenderDocument_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderDocument_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TenderDocument_Tender` (TenderID) -> VND.Tender (TenderID)
- **FK** `FK_TenderDocument_TenderDocumentType` (TenderDocumentTypeID) -> VND.TenderDocumentType (TenderDocumentTypeID)
- **FK** `FK_TenderDocument_Document` (DocumentID) -> DMS.Document (DocumentID) on delete CASCADE

### VND.TenderDocumentType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderDocumentTypeID | int | N |  | identity |
| 2 | Code | nvarchar(64) | N |  |  |
| 3 | Title | nvarchar(128) | N |  |  |
| 4 | Title2 | nvarchar(128) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** TenderDocumentTypeID
- **FK** `FK_TenderDocumentType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderDocumentType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** VND.TenderDocument (TenderDocumentTypeID)

### VND.TenderEvaluation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderEvaluationID | int | N |  | identity |
| 2 | TenderID | int | N |  |  |
| 3 | CriteriaID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | PartyID | bigint | Y |  |  |

- **Primary key:** TenderEvaluationID
- **FK** `FK_TenderEvaluation_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderEvaluation_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderEvaluationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderEvaluationItemID | int | N |  | identity |
| 2 | TenderEvaluationID | int | N |  |  |
| 3 | IndicatorID | int | N |  |  |
| 4 | Score | decimal(5,2) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderEvaluationItemID
- **FK** `FK_TenderEvaluationItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderEvaluationItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderIndicator

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderIndicatorID | int | N |  | identity |
| 2 | TenderID | int | N |  |  |
| 3 | CriteriaID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderIndicatorID
- **FK** `FK_TenderIndicator_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderIndicator_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderIndicatorItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderIndicatorItemID | int | N |  | identity |
| 2 | TenderIndicatorID | int | N |  |  |
| 3 | IndicatorID | int | N |  |  |
| 4 | Weight | decimal(5,2) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderIndicatorItemID
- **FK** `FK_TenderIndicatorItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderIndicatorItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderParticipate

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderParticipateID | int | N |  | identity |
| 2 | TenderID | int | N |  |  |
| 3 | SecretariatNumber | nvarchar(150) | N |  |  |
| 4 | SecretariatDate | date | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderParticipateID
- **FK** `FK_TenderParticipate_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderParticipate_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TenderParticipate_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_TenderParticipate_Tender` (TenderID) -> VND.Tender (TenderID)
- **Referenced by:** FIN.ReceiveCommitment (TenderParticipateID)

### VND.TenderVendorList

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderVendorListID | int | N |  | identity |
| 2 | TenderID | int | N |  |  |
| 3 | Version | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderVendorListID
- **FK** `FK_TenderVendorList_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderVendorList_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.TenderVendorListItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TenderVendorListItemID | int | N |  | identity |
| 2 | TenderVendorListID | int | N |  |  |
| 3 | PartyID | bigint | N |  |  |
| 4 | Description | nvarchar(MAX) | Y |  |  |
| 5 | Description2 | nvarchar(MAX) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TenderVendorListItemID
- **FK** `FK_TenderVendorListItem_CreatorUser` (Creator) -> CFG.User (UserID)
- **FK** `FK_TenderVendorListItem_EditorUser` (LastEditor) -> CFG.User (UserID)

### VND.VendorOpeningBalance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | VendorOpeningBalanceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | VendorID | bigint | N |  |  |
| 5 | CurrencyID | int | N |  |  |
| 6 | CurrencyRate | decimal(20,10) | N |  |  |
| 7 | OpeningBalance | decimal(30,4) | N |  |  |
| 8 | BalanceType | tinyint | N |  |  |
| 9 | AutoGenerated | bit | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** VendorOpeningBalanceID
- **FK** `FK_VendorOpeningBalance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_VendorOpeningBalance_Currency` (CurrencyID) -> CFG.Currency (CurrencyID)
- **FK** `FK_VendorOpeningBalance_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_VendorOpeningBalance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_VendorOpeningBalance_Vendor` (VendorID) -> CFG.Party (PartyID)

## Views

### VND.DeliveryJustification_Remains

Definition: `programmability/views/VND.DeliveryJustification_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DeliveryJustificationItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | NonSub | decimal(38,4) | Y |

### VND.Proposal_JustificationInput

Definition: `programmability/views/VND.Proposal_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | JustificationInputItemID | int | N |

### VND.Proposal_Non_JustificationInput

Definition: `programmability/views/VND.Proposal_Non_JustificationInput.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### VND.Proposal_Non_PurchaseInvoice

Definition: `programmability/views/VND.Proposal_Non_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### VND.Proposal_Non_StockReceipt

Definition: `programmability/views/VND.Proposal_Non_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### VND.Proposal_Non_TemporaryStockReceipt

Definition: `programmability/views/VND.Proposal_Non_TemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainQuantity | decimal(38,4) | Y |
| 3 | SubQuantity | decimal(38,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### VND.Proposal_NonPaymented

Definition: `programmability/views/VND.Proposal_NonPaymented.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalID | int | N |
| 2 | NonPaymented | decimal(38,4) | Y |

### VND.Proposal_NonRequested

Definition: `programmability/views/VND.Proposal_NonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalID | int | N |
| 2 | NonRequested | decimal(38,4) | Y |

### VND.Proposal_PurchaseContract

Definition: `programmability/views/VND.Proposal_PurchaseContract.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | PurchaseContractItemID | int | N |

### VND.Proposal_PurchaseInvoice

Definition: `programmability/views/VND.Proposal_PurchaseInvoice.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | PurchaseInvoiceItemID | int | N |

### VND.Proposal_Remains

Definition: `programmability/views/VND.Proposal_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | NonSub | decimal(38,4) | Y |

### VND.Proposal_ReturnedTemporaryStockReceipt

Definition: `programmability/views/VND.Proposal_ReturnedTemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | ReturnedTemporaryStockReceiptItemID | int | N |

### VND.Proposal_ReturnRequest

Definition: `programmability/views/VND.Proposal_ReturnRequest.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | ReturnRequestItemID | int | N |

### VND.Proposal_StockReceipt

Definition: `programmability/views/VND.Proposal_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | StockReceiptItemID | int | N |

### VND.Proposal_TemporaryStockReceipt

Definition: `programmability/views/VND.Proposal_TemporaryStockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | Y |
| 2 | TemporaryStockReceiptItemID | int | N |

### VND.ProposalItem_NotImplementedRemain

Definition: `programmability/views/VND.ProposalItem_NotImplementedRemain.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProposalItemID | int | N |
| 2 | MainRemain | decimal(38,4) | Y |
| 3 | SubRemain | decimal(38,4) | Y |

### VND.PurchaseContract_Non_StockReceipt

Definition: `programmability/views/VND.PurchaseContract_Non_StockReceipt.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseContractItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | SubQuantity | decimal(30,4) | Y |
| 4 | DoMainQuantity | decimal(38,4) | Y |
| 5 | DoSubQuantity | decimal(38,4) | Y |
| 6 | Non | decimal(38,4) | Y |
| 7 | SubNon | decimal(38,4) | Y |

### VND.PurchaseContract_NonPaymented

Definition: `programmability/views/VND.PurchaseContract_NonPaymented.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseContractID | int | N |
| 2 | NonPaymented | decimal(38,4) | Y |

### VND.PurchaseContract_NonRequested

Definition: `programmability/views/VND.PurchaseContract_NonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseContractID | int | N |
| 2 | NonRequested | decimal(38,10) | Y |

### VND.PurchaseContract_Remains

Definition: `programmability/views/VND.PurchaseContract_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseContractItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,4) | Y |
| 4 | DoSubQuantity | decimal(38,4) | Y |
| 5 | Non | decimal(38,4) | Y |
| 6 | NonSub | decimal(38,4) | Y |

### VND.PurchaseInvoice_NonPaymented

Definition: `programmability/views/VND.PurchaseInvoice_NonPaymented.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |
| 2 | Net | decimal(37,10) | Y |
| 3 | Done | decimal(38,4) | N |
| 4 | NonPaymented | decimal(38,4) | Y |

### VND.PurchaseInvoice_PriceRemains

Definition: `programmability/views/VND.PurchaseInvoice_PriceRemains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceItemID | int | N |
| 2 | Price | decimal(38,6) | Y |
| 3 | DoPrice | decimal(38,6) | Y |
| 4 | Non | decimal(38,6) | Y |
| 5 | PricedQuantity | decimal(38,10) | N |
| 6 | NonPricedQuantity | decimal(38,10) | Y |

### VND.PurchaseInvoice_Remains

Definition: `programmability/views/VND.PurchaseInvoice_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceItemID | int | N |
| 2 | MainQuantity | decimal(36,10) | Y |
| 3 | SubQuantity | decimal(36,10) | Y |
| 4 | DoMainQuantity | decimal(38,10) | N |
| 5 | DoSubQuantity | decimal(38,10) | N |
| 6 | Non | decimal(38,10) | Y |
| 7 | NonSub | decimal(38,10) | Y |

### VND.ReturnInvoice_NonReceived

Definition: `programmability/views/VND.ReturnInvoice_NonReceived.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ReturnInvoiceID | int | N |
| 2 | NonReceived | decimal(38,4) | Y |

### VND.VWConfirmPurchaseInvoiceItemNonePayment

Definition: `programmability/views/VND.VWConfirmPurchaseInvoiceItemNonePayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceItemID | int | N |
| 2 | AdditionDeductionTypeID | int | Y |
| 3 | PurchaseInvoiceID | int | N |
| 4 | Net | decimal(31,4) | Y |
| 5 | Done | decimal(38,10) | N |
| 6 | NonPayment | decimal(38,10) | Y |

### VND.VWConfirmPurchaseInvoiceNonePayment

Definition: `programmability/views/VND.VWConfirmPurchaseInvoiceNonePayment.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ConfirmPurchaseInvoiceID | int | N |
| 2 | PurchaseInvoiceID | int | N |
| 3 | Net | decimal(38,4) | Y |
| 4 | Done | decimal(38,10) | N |
| 5 | NonPayment | decimal(38,4) | Y |
| 6 | RequestedTotal | decimal(38,10) | N |
| 7 | PaidByRequest | decimal(38,10) | N |
| 8 | PaidDirect | decimal(38,10) | Y |
| 9 | RequestedUnpaid | decimal(38,10) | Y |
| 10 | NonRequested | decimal(38,4) | Y |
| 11 | Requestable | decimal(38,4) | Y |
| 12 | DirectPayable | decimal(38,4) | Y |

### VND.vwPurchaseContractFlow

Definition: `programmability/views/VND.vwPurchaseContractFlow.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseContractID | int | N |
| 2 | Date | date | N |
| 3 | PurchaseTypeID | tinyint | N |
| 4 | DlID | bigint | N |
| 5 | BranchID | int | N |
| 6 | PurchaseContractItemID | int | N |
| 7 | StuffID | int | N |
| 8 | TemporaryStockReceiptItemID | int | Y |
| 9 | JustificationInputItemID | int | Y |
| 10 | StockReceiptItemID | int | Y |
| 11 | PurchaseInvoiceItemID | int | Y |
| 12 | TemporaryStockReceiptQuantity | decimal(36,10) | Y |
| 13 | JustificationInputQuantity | decimal(36,10) | Y |
| 14 | StockReceiptQuantity | decimal(36,10) | Y |
| 15 | PurchaseInvoiceQuantity | decimal(36,10) | Y |

### VND.vwPurchaseInvoice_NonRequested

Definition: `programmability/views/VND.vwPurchaseInvoice_NonRequested.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | PurchaseInvoiceID | int | N |
| 2 | Net | decimal(36,10) | Y |
| 3 | Done | decimal(38,10) | N |
| 4 | NonRequested | decimal(38,4) | Y |

### VND.vwPurchaseInvoicePaymentReviewDataSource

Definition: `programmability/views/VND.vwPurchaseInvoicePaymentReviewDataSource.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | BranchID | int | N |
| 2 | DLID | bigint | N |
| 3 | CurrencyID | int | N |
| 4 | CurrencyRate | decimal(20,10) | N |
| 5 | Amount | decimal(36,10) | Y |
| 6 | PaidAmount | numeric(36,10) | Y |
| 7 | DocumentID | int | N |
| 8 | Document | varchar(18) | N |
| 9 | DocumentItemID | int | N |
| 10 | BaseDocumentID | int | N |
| 11 | DocumentDate | date | N |
| 12 | BaseDocumentDate | date | N |
| 13 | DocumentNumber | int | N |

