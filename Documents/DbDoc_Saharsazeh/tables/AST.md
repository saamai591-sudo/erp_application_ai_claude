# Schema `AST`

## Tables

### AST.Adjustment

Rows: 1 | تغییر بها

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdjustmentID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Description | nvarchar(1050) | Y |  |  |
| 6 | Description2 | nvarchar(1050) | Y |  |  |
| 7 | PreVoucherID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | BranchID | int | N | ((-1)) |  |

- **Primary key:** AdjustmentID
- **FK** `FK_Adjustment_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Adjustment_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Adjustment_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Adjustment_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Adjustment_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.AdjustmentItem (AdjustmentID)

### AST.AdjustmentItem

Rows: 1 | آیتم تغییر بها

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AdjustmentItemID | int | N |  | identity |
| 2 | AdjustmentID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | BaseDocumentType | tinyint | Y |  |  |
| 11 | BaseDocumentID | int | Y |  |  |

- **Primary key:** AdjustmentItemID
- **FK** `FK_AdjustmentItem_Adjustment` (AdjustmentID) -> AST.Adjustment (AdjustmentID) on delete CASCADE
- **FK** `FK_AdjustmentItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_AdjustmentItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AdjustmentItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.Depreciation (AdjustmentItemID)

### AST.Asset

Rows: 5917 | دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetID | int | N |  | identity |
| 2 | CreationID | int | Y |  |  |
| 3 | Plaque | varchar(50) | Y |  |  |
| 4 | Title | nvarchar(500) | N |  |  |
| 5 | Title2 | nvarchar(500) | N |  |  |
| 6 | AssetType | tinyint | N |  |  |
| 7 | AssetCategoryID | int | Y |  |  |
| 8 | BaseValue | decimal(30,4) | N |  |  |
| 9 | AccumulatedDepreciation | decimal(30,4) | N |  |  |
| 10 | SalvageValue | decimal(30,4) | N |  |  |
| 11 | HeadAssetID | int | Y |  |  |
| 12 | Status | tinyint | N |  |  |
| 13 | Version | int | N |  |  |
| 14 | Creator | int | N |  |  |
| 15 | CreationDate | datetime | N |  |  |
| 16 | LastEditor | int | N |  |  |
| 17 | LastEditionDate | datetime | N |  |  |
| 18 | DuringDepreciation | decimal(36,10) | Y |  |  |
| 19 | UtilizationDate | date | Y |  |  |
| 20 | AssetReceiptID | int | Y |  |  |
| 21 | Nature | tinyint | N |  |  |
| 22 | BranchID | int | N |  |  |
| 23 | AssetCreationDate | date | N |  |  |
| 24 | StuffID | int | Y |  |  |
| 25 | DepreciationMethod | tinyint | Y |  |  |
| 26 | DepreciationRate | decimal(5,2) | Y |  |  |
| 27 | CostValue | decimal(30,4) | Y |  |  |
| 28 | ReceivedFromBranchItemID | int | Y |  |  |
| 29 | AccountingStatus | tinyint | N | ((1)) |  |

- **Primary key:** AssetID
- **FK** `FK_Asset_AssetReceipt` (AssetReceiptID) -> AST.AssetReceipt (AssetReceiptID)
- **FK** `FK_Asset_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Asset_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_Asset_Creation` (CreationID) -> AST.Creation (CreationID) on delete CASCADE
- **FK** `FK_Asset_AssetCategory` (AssetCategoryID) -> AST.AssetCategory (AssetCategoryID)
- **FK** `FK_Asset_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Asset_HeadAsset` (HeadAssetID) -> AST.Asset (AssetID)
- **FK** `FK_Asset_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Asset_ReceivedFromBranchItem` (ReceivedFromBranchItemID) -> AST.ReceivedFromBranchItem (ReceivedFromBranchItemID)
- **Referenced by:** AST.AdjustmentItem (AssetID); AST.Asset (HeadAssetID); AST.AssetCapacity (AssetID); AST.AssetCertificate (AssetID); AST.AssetItem (AssetID); AST.AssetSetting (AssetID); AST.ChangeCategoryItem (AssetID); AST.ChangePlauqe (AssetID); AST.Depreciation (AssetID); AST.DestructionItem (AssetID); AST.InsuranceItem (AssetID); AST.ReceivedFromBranchItem (AssetID); AST.Repair (AssetID); AST.RevaluationItem (AssetID); AST.SaleItem (AssetID); AST.SalvageItem (AssetID); AST.StatementItem (AssetID); AST.TransferItem (AssetID)

### AST.AssetCapacity

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetCapacityID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | Type | tinyint | N |  |  |
| 5 | EffectiveDate | date | Y |  |  |
| 6 | Value | decimal(36,10) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetCapacityID
- **FK** `FK_AssetCapacity_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetCapacity_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_AssetCapacity_Creator` (Creator) -> CFG.User (UserID)

### AST.AssetCategory

Rows: 272 | گروه دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetCategoryID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Level | tinyint | N |  |  |
| 4 | ParentCode | varchar(50) | Y |  |  |
| 5 | Code | varchar(10) | Y |  |  |
| 6 | Title | nvarchar(250) | N |  |  |
| 7 | Title2 | nvarchar(250) | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetCategoryID
- **FK** `FK_AssetCategory_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetCategory_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetCategory_Parent` (ParentID) -> AST.AssetCategory (AssetCategoryID)
- **Referenced by:** AST.Asset (AssetCategoryID); AST.AssetCategory (ParentID); AST.AssetCategorySpecification (AssetCategoryID); AST.CategoryAccount (AssetCategoryID); AST.ChangeCategory (AssetCategoryID); AST.ChangeCategoryItem (PreviousCategoryID); AST.Creation (AssetCategoryID)

### AST.AssetCategorySpecification

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetCategorySpecificationID | int | N |  | identity |
| 2 | AssetCategoryID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | BaseType | tinyint | Y |  |  |
| 7 | CustomTypeID | int | Y |  |  |
| 8 | Arrangement | tinyint | N |  |  |
| 9 | Required | bit | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetCategorySpecificationID
- **FK** `FK_AssetCategorySpecification_AssetCategory` (AssetCategoryID) -> AST.AssetCategory (AssetCategoryID) on delete CASCADE
- **FK** `FK_AssetCategorySpecification_CustomType` (CustomTypeID) -> CFG.LookupData (LookupDataID)
- **FK** `FK_AssetCategorySpecification_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetCategorySpecification_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.AssetCertificate (AssetCategorySpecificationID)

### AST.AssetCertificate

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetCertificateID | int | N |  | identity |
| 2 | AssetID | int | N |  |  |
| 3 | AssetCategorySpecificationID | int | N |  |  |
| 4 | Value | nvarchar(MAX) | Y |  |  |
| 5 | LookupDataItemID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetCertificateID
- **FK** `FK_AssetCertificate_Asset` (AssetID) -> AST.Asset (AssetID) on delete CASCADE
- **FK** `FK_AssetCertificate_AssetCategorySpecification` (AssetCategorySpecificationID) -> AST.AssetCategorySpecification (AssetCategorySpecificationID)
- **FK** `FK_AssetCertificate_LookupDataItem` (LookupDataItemID) -> CFG.LookupDataItem (LookupDataItemID)
- **FK** `FK_AssetCertificate_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetCertificate_LastEditor` (LastEditor) -> CFG.User (UserID)

### AST.AssetClosingOperation

Rows: 92 | پایان دوره دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetClosingOperationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Creator | int | N |  |  |
| 4 | CreationDate | datetime | N |  |  |
| 5 | LastEditor | int | N |  |  |
| 6 | LastEditionDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | BranchID | int | N | ((-1)) |  |

- **Primary key:** AssetClosingOperationID
- **FK** `FK_AssetClosingOperation_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_AssetClosingOperation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetClosingOperation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_AssetClosingOperation_LastEditor` (LastEditor) -> CFG.User (UserID)

### AST.AssetItem

Rows: 3898

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetItemID | int | N |  | identity |
| 2 | AssetID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | AssetReceiptItemID | int | Y |  |  |
| 5 | StuffID | int | N |  |  |
| 6 | MainQuantity | decimal(30,4) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | CostValue | decimal(30,4) | Y |  |  |

- **Primary key:** AssetItemID
- **FK** `FK_AssetItem_Asset` (AssetID) -> AST.Asset (AssetID) on delete CASCADE
- **FK** `FK_AssetItem_AssetReceiptItem` (AssetReceiptItemID) -> AST.AssetReceiptItem (AssetReceiptItemID)
- **FK** `FK_AssetItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_AssetItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetItem_LastEditor` (LastEditor) -> CFG.User (UserID)

### AST.AssetReceipt

Rows: 1716

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetReceiptID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | CreationType | tinyint | N |  |  |
| 6 | BaseType | tinyint | N |  |  |
| 7 | FinancialPeriodID | int | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | Status | tinyint | N |  |  |
| 14 | PreVoucherID | int | Y |  |  |

- **Primary key:** AssetReceiptID
- **FK** `FK_AssetReceipt_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_AssetReceipt_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_AssetReceipt_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetReceipt_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetReceipt_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Asset (AssetReceiptID); AST.AssetReceiptItem (AssetReceiptID); AST.AssetReceiptUtilizationCost (AssetReceiptID)

### AST.AssetReceiptItem

Rows: 1716

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetReceiptItemID | int | N |  | identity |
| 2 | AssetReceiptID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | PurchaseInvoiceItemID | int | Y |  |  |
| 5 | DeliveryJustificationItemID | int | Y |  |  |
| 6 | OutgoingItemID | int | Y |  |  |
| 7 | StuffID | int | N |  |  |
| 8 | MainQuantity | decimal(30,4) | N |  |  |
| 9 | Description | nvarchar(250) | Y |  |  |
| 10 | Description2 | nvarchar(250) | Y |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | BaseValue | decimal(30,4) | Y |  |  |
| 17 | ShareOfCosts | decimal(30,4) | Y |  |  |
| 18 | CostValue | decimal(30,4) | Y |  |  |

- **Primary key:** AssetReceiptItemID
- **FK** `FK_AssetReceiptItem_AssetReceipt` (AssetReceiptID) -> AST.AssetReceipt (AssetReceiptID) on delete CASCADE
- **FK** `FK_AssetReceiptItem_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **FK** `FK_AssetReceiptItem_DeliveryJustificationItem` (DeliveryJustificationItemID) -> VND.DeliveryJustificationItem (DeliveryJustificationItemID)
- **FK** `FK_AssetReceiptItem_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_AssetReceiptItem_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_AssetReceiptItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetReceiptItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.AssetItem (AssetReceiptItemID); VND.PurchaseInvoiceItem (AssetReceiptItemID)

### AST.AssetReceiptUtilizationCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetReceiptUtilizationCostID | int | N |  | identity |
| 2 | AssetReceiptID | int | N |  |  |
| 3 | BaseType | tinyint | N | ((1)) |  |
| 4 | PurchaseInvoiceItemID | int | Y |  |  |
| 5 | OutgoingItemID | int | Y |  |  |
| 6 | StuffID | int | N |  |  |
| 7 | MainQuantity | decimal(36,10) | N |  |  |
| 8 | SubQuantity | decimal(36,10) | Y |  |  |
| 9 | Price | decimal(30,4) | N |  |  |
| 10 | ShareDividingBase | tinyint | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetReceiptUtilizationCostID
- **FK** `FK_AssetReceiptUtilizationCost_AssetReceipt` (AssetReceiptID) -> AST.AssetReceipt (AssetReceiptID) on delete CASCADE
- **FK** `FK_AssetReceiptUtilizationCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetReceiptUtilizationCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetReceiptUtilizationCost_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **FK** `FK_AssetReceiptUtilizationCost_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_AssetReceiptUtilizationCost_Stuff` (StuffID) -> STF.Stuff (StuffID)

### AST.AssetSetting

Rows: 7502 | موقعیت دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetSettingID | int | N |  | identity |
| 2 | AssetID | int | N |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | Date | date | N |  |  |
| 5 | Responsible | bigint | Y |  |  |
| 6 | Deliverer | bigint | Y |  |  |
| 7 | DeployPlaceID | int | Y |  |  |
| 8 | Status | tinyint | N |  | شامل: در حال استفاده = 1 بلااستفاده = 2 |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | ChangePositionID | int | Y |  |  |
| 15 | RowIndex | int | Y |  |  |

- **Primary key:** AssetSettingID
- **unique index** `IX_AssetSetting` (AssetID, Date)
- **FK** `FK_AssetSetting_Asset` (AssetID) -> AST.Asset (AssetID) on delete CASCADE
- **FK** `FK_AssetSetting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetSetting_Deliverer` (Deliverer) -> CFG.Party (PartyID)
- **FK** `FK_AssetSetting_DeployPlace` (DeployPlaceID) -> AST.DeployPlace (DeployPlaceID)
- **FK** `FK_AssetSetting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetSetting_Parent` (ParentID) -> AST.AssetSetting (AssetSettingID)
- **FK** `FK_AssetSetting_Responsible` (Responsible) -> CFG.Party (PartyID)
- **FK** `FK_AssetSetting_ChangePosition` (ChangePositionID) -> AST.ChangePosition (ChangePositionID) on delete CASCADE
- **Referenced by:** AST.AssetSetting (ParentID); AST.AssetSettingDl (AssetSettingID); AST.AssetSettingPerformance (AssetSettingID); AST.Depreciation (AssetSettingID); AST.InsuranceSharing (AssetSettingID)

### AST.AssetSettingDl

Rows: 3301 | تفصیلهای دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetSettingDlID | int | N |  | identity |
| 2 | AssetSettingID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetSettingDlID
- **unique index** `IX_AssetSettingDl` (AssetSettingID, DlTypeID)
- **FK** `FK_AssetSettingDl_AssetSetting` (AssetSettingID) -> AST.AssetSetting (AssetSettingID) on delete CASCADE
- **FK** `FK_AssetSettingDl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetSettingDl_Dl` (DlID) -> ACC.DL (DLID)
- **FK** `FK_AssetSettingDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_AssetSettingDl_LastEditor` (LastEditor) -> CFG.User (UserID)

### AST.AssetSettingPerformance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetSettingPerformanceID | int | N |  | identity |
| 2 | RowIndex | int | N |  |  |
| 3 | AssetSettingID | int | N |  |  |
| 4 | FromDate | date | N |  |  |
| 5 | EndDate | date | N |  |  |
| 6 | Value | decimal(36,10) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** AssetSettingPerformanceID
- **FK** `FK_AssetSettingPerformance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_AssetSettingPerformance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_AssetSettingPerformance_AssetSetting` (AssetSettingID) -> AST.AssetSetting (AssetSettingID) on delete CASCADE

### AST.CategoryAccount

Rows: 10 | معین گروه دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetCategoryID | int | N |  |  |
| 2 | FixAsset | int | Y |  |  |
| 3 | CompletingAsset | int | Y |  |  |
| 4 | IncomeFromSale | int | Y |  |  |
| 5 | IncomeFromRevaluation | int | Y |  |  |
| 6 | IncomeFromInsurance | int | Y |  |  |
| 7 | DepreciationCost | int | Y |  |  |
| 8 | AccumulatedDepreciation | int | Y |  |  |
| 9 | LossOfStopWorking | int | Y |  |  |
| 10 | RepairCost | int | Y |  |  |
| 11 | GiftCost | int | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | TransfersBetweenBranches | int | Y |  |  |
| 18 | AdjustmentSLID | int | Y |  |  |

- **Primary key:** AssetCategoryID
- **FK** `FK_CategoryAccount_AccumulatedDepreciation` (AccumulatedDepreciation) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_AssetCategory` (AssetCategoryID) -> AST.AssetCategory (AssetCategoryID) on delete CASCADE
- **FK** `FK_CategoryAccount_CompletingAsset` (CompletingAsset) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_CategoryAccount_DepreciationCost` (DepreciationCost) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_FixAsset` (FixAsset) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_GiftCost` (GiftCost) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_IncomeFromInsurance` (IncomeFromInsurance) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_IncomeFromRevaluation` (IncomeFromRevaluation) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_IncomeFromSale` (IncomeFromSale) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_CategoryAccount_LossOfStopWorking` (LossOfStopWorking) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_RepairCost` (RepairCost) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_TransfersBetweenBranches` (TransfersBetweenBranches) -> ACC.SL (SlID)
- **FK** `FK_CategoryAccount_AdjustmentSLID` (AdjustmentSLID) -> ACC.SL (SlID)

### AST.ChangeCategory

Rows: 127 | تغییر گروه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ChangeCategoryID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | AssetCategoryID | int | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | PreVoucherID | int | Y |  |  |
| 14 | BranchID | int | N | ((-1)) |  |
| 15 | Status | tinyint | N |  |  |

- **Primary key:** ChangeCategoryID
- **FK** `FK_ChangeCategory_AssetCategory` (AssetCategoryID) -> AST.AssetCategory (AssetCategoryID)
- **FK** `FK_ChangeCategory_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ChangeCategory_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ChangeCategory_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ChangeCategory_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ChangeCategory_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.ChangeCategoryItem (ChangeCategoryID); AST.Depreciation (ChangeCategoryID)

### AST.ChangeCategoryItem

Rows: 3359 | آیتم تغییر گروه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ChangeCategoryItemID | int | N |  | identity |
| 2 | ChangeCategoryID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | PreviousCategoryID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ChangeCategoryItemID
- **FK** `FK_ChangeCategoryItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_ChangeCategoryItem_ChangeCategory` (ChangeCategoryID) -> AST.ChangeCategory (ChangeCategoryID) on delete CASCADE
- **FK** `FK_ChangeCategoryItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ChangeCategoryItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ChangeCategoryItem_PreviousCategory` (PreviousCategoryID) -> AST.AssetCategory (AssetCategoryID)

### AST.ChangePlauqe

Rows: 1748 | تغییر پلاک

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ChangePlauqeID | int | N |  | identity |
| 2 | AssetID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | OldPlauqe | nvarchar(500) | N |  |  |
| 5 | NewPlauqe | nvarchar(500) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ChangePlauqeID
- **FK** `FK_ChangePlauqe_Asset` (AssetID) -> AST.Asset (AssetID) on delete CASCADE
- **FK** `FK_ChangePlauqe_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ChangePlauqe_LastEditor` (LastEditor) -> CFG.User (UserID)

### AST.ChangePosition

Rows: 4

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ChangePositionID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ChangePositionID
- **FK** `FK_ChangePosition_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ChangePosition_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ChangePosition_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.AssetSetting (ChangePositionID)

### AST.Creation

Rows: 3734 | ایجاد دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CreationID | int | N |  | identity |
| 2 | BranchID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | CreationType | tinyint | N |  |  |
| 6 | PurchaseInvoiceItemID | int | Y |  |  |
| 7 | OutgoingItemID | int | Y |  |  |
| 8 | DestructionItemID | int | Y |  |  |
| 9 | BaseValue | decimal(30,4) | N |  |  |
| 10 | AccumulatedDepreciation | decimal(30,4) | N |  |  |
| 11 | Quantity | smallint | N |  |  |
| 12 | FinancialPeriodID | int | N |  |  |
| 13 | PreVoucherID | int | Y |  |  |
| 14 | Version | int | N |  |  |
| 15 | Creator | int | N |  |  |
| 16 | CreationDate | datetime | N |  |  |
| 17 | LastEditor | int | N |  |  |
| 18 | LastEditionDate | datetime | N |  |  |
| 19 | TransferItemID | int | Y |  |  |
| 20 | StuffID | int | Y |  |  |
| 21 | AssetTitle | nvarchar(500) | N |  |  |
| 22 | AssetTitle2 | nvarchar(500) | N |  |  |
| 23 | AccountingDate | date | Y |  |  |
| 24 | AssetType | tinyint | Y |  |  |
| 25 | AssetCategoryID | int | Y |  |  |
| 26 | SalvageValue | decimal(30,4) | N |  |  |
| 27 | UsageDate | date | N |  |  |
| 28 | DuringDepreciation | decimal(36,10) | Y |  |  |

- **Primary key:** CreationID
- **index** `IX_Creation` (Number)
- **FK** `FK_Creation_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_Creation_AssetCategory` (AssetCategoryID) -> AST.AssetCategory (AssetCategoryID)
- **FK** `FK_Creation_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **FK** `FK_Creation_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Creation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Creation_DestructionItem` (DestructionItemID) -> AST.DestructionItem (DestructionItemID)
- **FK** `FK_Creation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Creation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Creation_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_Creation_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Creation_TransferItem` (TransferItemID) -> AST.TransferItem (TransferItemID)
- **Referenced by:** AST.Asset (CreationID); AST.UtilizationCost (CreationID)

### AST.Creation_AssetReceipt

Rows: 1715

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CreationID | int | Y |  |  |
| 2 | AssetReceiptID | int | Y |  |  |


### AST.DeployPlace

Rows: 10 | محل استقرار

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DeployPlaceID | int | N |  | identity |
| 2 | ParentID | int | Y |  |  |
| 3 | Code | varchar(MAX) | Y |  |  |
| 4 | Title | nvarchar(250) | Y |  |  |
| 5 | Title2 | nvarchar(250) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DeployPlaceID
- **FK** `FK_DeployPlace_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DeployPlace_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DeployPlace_Parent` (ParentID) -> AST.DeployPlace (DeployPlaceID)
- **Referenced by:** AST.AssetSetting (DeployPlaceID); AST.DeployPlace (ParentID)

### AST.Depreciation

Rows: 30313 | استهلاک

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DepreciationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | AssetID | int | N |  |  |
| 5 | AssetSettingID | int | N |  |  |
| 6 | RepairID | int | Y |  |  |
| 7 | AdjustmentItemID | int | Y |  |  |
| 8 | RevaluationItemID | int | Y |  |  |
| 9 | Value | decimal(30,4) | N |  |  |
| 10 | DepreciationType | tinyint | N |  | 1 = عادی 2 = تعمیر 3 = تغییر بهاء  4 = مازاد ناشی از تجدید ارزیابی |
| 11 | VoucherID | int | Y |  |  |
| 12 | Version | int | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Formul | nvarchar(MAX) | Y |  |  |
| 18 | IsAutoGenerated | bit | N | ((0)) |  |
| 19 | DepreciationCalculationID | int | Y |  |  |
| 20 | Document | nvarchar(250) | Y |  |  |
| 21 | DocumentID | int | Y |  |  |
| 22 | DestructionID | int | Y |  |  |
| 23 | SalvageID | int | Y |  |  |
| 24 | SaleID | int | Y |  |  |
| 25 | TransferID | int | Y |  |  |
| 26 | ChangeCategoryID | int | Y |  |  |
| 27 | RevaluationID | int | Y |  |  |

- **Primary key:** DepreciationID
- **FK** `FK_Depreciation_DepreciationCalculation` (DepreciationCalculationID) -> AST.DepreciationCalculation (DepreciationCalculationID)
- **FK** `FK_Depreciation_AdjustmentItem` (AdjustmentItemID) -> AST.AdjustmentItem (AdjustmentItemID)
- **FK** `FK_Depreciation_Destruction` (DestructionID) -> AST.Destruction (DestructionID)
- **FK** `FK_Depreciation_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_Depreciation_Salvage` (SalvageID) -> AST.Salvage (SalvageID)
- **FK** `FK_Depreciation_Revaluation` (RevaluationID) -> AST.Revaluation (RevaluationID)
- **FK** `FK_Depreciation_AssetSetting` (AssetSettingID) -> AST.AssetSetting (AssetSettingID)
- **FK** `FK_Depreciation_Sale` (SaleID) -> AST.Sale (SaleID)
- **FK** `FK_Depreciation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Depreciation_Transfer` (TransferID) -> AST.Transfer (TransferID)
- **FK** `FK_Depreciation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Depreciation_ChangeCategory` (ChangeCategoryID) -> AST.ChangeCategory (ChangeCategoryID)
- **FK** `FK_Depreciation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Depreciation_Repair` (RepairID) -> AST.Repair (RepairID)
- **FK** `FK_Depreciation_RevaluationItem` (RevaluationItemID) -> AST.RevaluationItem (RevaluationItemID)
- **FK** `FK_Depreciation_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete SET_NULL

### AST.Depreciation_Temp

Rows: 1445

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetID | int | N |  |  |
| 2 | Plaque | varchar(50) | Y |  |  |
| 3 | Title | nvarchar(500) | N |  |  |
| 4 | Title2 | nvarchar(500) | N |  |  |
| 5 | StartDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | BranchID | int | N |  |  |
| 8 | AssetSettingID | int | N |  |  |
| 9 | DepreciationMethod | tinyint | N |  |  |
| 10 | DepreciationRate | decimal(5,2) | N |  |  |
| 11 | Status | tinyint | N |  |  |
| 12 | BaseValue | decimal(30,4) | N |  |  |
| 13 | AccumulatedDepreciation | decimal(30,4) | N |  |  |
| 14 | RemainingLifeTime | int | Y |  |  |
| 15 | SalvageValue | decimal(30,4) | N |  |  |
| 16 | DepreciationType | tinyint | N |  | 1 = عادی 2 = تعمیر 3 = تغییر بهاء  4 = مازاد ناشی از تجدید ارزیابی |
| 17 | RepairID | int | Y |  |  |
| 18 | AdjustmentItemID | int | Y |  |  |
| 19 | RevaluationItemID | int | Y |  |  |
| 20 | Depreciation | decimal(30,4) | N |  |  |
| 21 | AssetsSettingLifeTime | int | Y |  |  |
| 22 | ID | int | N |  | identity |
| 23 | Formul | nvarchar(MAX) | Y |  |  |
| 24 | FullyDepreciate | bit | Y |  |  |


### AST.DepreciationCalculation

Rows: 1366

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DepreciationCalculationID | int | N |  | identity |
| 2 | DepreciationPeriodID | int | Y |  |  |
| 3 | BranchID | int | Y |  |  |
| 4 | VoucherID | int | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DepreciationCalculationID
- **unique index** `IX_DepreciationCalculation` (BranchID, DepreciationPeriodID, VoucherID)
- **FK** `FK_DepreciationCalculation_DepreciationPeriod` (DepreciationPeriodID) -> AST.DepreciationPeriod (DepreciationPeriodID)
- **FK** `FK_DepreciationCalculation_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_DepreciationCalculation_VoucherID` (VoucherID) -> ACC.Voucher (VoucherID)
- **Referenced by:** AST.Depreciation (DepreciationCalculationID)

### AST.DepreciationPeriod

Rows: 137

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DepreciationPeriodID | int | N |  | identity |
| 2 | FinancialPeriodID | int | Y |  |  |
| 3 | Title | nvarchar(1000) | Y |  |  |
| 4 | Title2 | nvarchar(1000) | Y |  |  |
| 5 | StartDate | date | Y |  |  |
| 6 | EndDate | date | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DepreciationPeriodID
- **FK** `FK_DepreciationPeriod_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_DepreciationPeriod_User` (Creator) -> CFG.User (UserID)
- **FK** `FK_DepreciationPeriod_User1` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.DepreciationCalculation (DepreciationPeriodID)

### AST.Destruction

Rows: 28 | امحاء دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DestructionID | int | N |  | identity |
| 2 | Number | int | N |  |  |
| 3 | Date | date | N |  |  |
| 4 | DestructionReasonID | int | N |  |  |
| 5 | Description | nvarchar(1024) | Y |  |  |
| 6 | Description2 | nvarchar(1024) | Y |  |  |
| 7 | FinancialPeriodID | int | N |  |  |
| 8 | PreVoucherID | int | Y |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | BranchID | int | N | ((-1)) |  |
| 15 | DestructionStatus | tinyint | N | ((1)) |  |

- **Primary key:** DestructionID
- **FK** `FK_Destruction_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Destruction_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Destruction_DestructionReason` (DestructionReasonID) -> AST.DestructionReason (DestructionReasonID)
- **FK** `FK_Destruction_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Destruction_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Destruction_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Depreciation (DestructionID); AST.DestructionItem (DestructionID)

### AST.DestructionItem

Rows: 2039 | آیتم امحاء دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DestructionItemID | int | N |  | identity |
| 2 | DestructionID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DestructionItemID
- **FK** `FK_DestructionItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DestructionItem_Destruction` (DestructionID) -> AST.Destruction (DestructionID) on delete CASCADE
- **FK** `FK_DestructionItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DestructionItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **Referenced by:** AST.Creation (DestructionItemID)

### AST.DestructionReason

Rows: 4 | دلایل امحاء

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DestructionReasonID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | LossFromDisaster | int | Y |  |  |

- **Primary key:** DestructionReasonID
- **FK** `FK_DestructionReason_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_DestructionReason_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_DestructionReason_LossFromDisaster` (LossFromDisaster) -> ACC.SL (SlID)
- **Referenced by:** AST.Destruction (DestructionReasonID)

### AST.Insurance

Rows: 0 | بیمه دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InsuranceID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | PrevoucherID | int | Y |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | InsuranceTypeID | int | N |  |  |
| 8 | FromDate | date | N |  |  |
| 9 | EndDate | date | N |  |  |
| 10 | Price | decimal(30,4) | N |  |  |
| 11 | Version | int | N |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | BranchID | int | N | ((-1)) |  |
| 17 | PurchaseInvoiceItemID | int | Y |  |  |

- **Primary key:** InsuranceID
- **FK** `FK_Insurance_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Insurance_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Insurance_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Insurance_InsuranceType` (InsuranceTypeID) -> AST.InsuranceType (InsuranceTypeID)
- **FK** `FK_Insurance_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Insurance_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Insurance_Prevoucher` (PrevoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Insurance_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)
- **Referenced by:** AST.InsuranceItem (InsuranceID)

### AST.InsuranceItem

Rows: 0 | آیتم بیمه دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InsuranceItemID | int | N |  | identity |
| 2 | InsuranceID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | EstimatedValue | decimal(30,4) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** InsuranceItemID
- **FK** `FK_InsuranceItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_InsuranceItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InsuranceItem_Insurance` (InsuranceID) -> AST.Insurance (InsuranceID) on delete CASCADE
- **FK** `FK_InsuranceItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.InsuranceSharing (InsuranceItemID)

### AST.InsuranceSharing

Rows: 0 | هزینه بیمه

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InsuranceSharingID | int | N |  | identity |
| 2 | InsuranceItemID | int | N |  |  |
| 3 | SharingValue | decimal(30,4) | N |  |  |
| 4 | AssetSettingID | int | N |  |  |
| 5 | FinancialPeriodID | int | N |  |  |
| 6 | Date | date | N |  |  |
| 7 | VoucherID | int | Y |  |  |
| 8 | IsAutoGenerated | bit | N | ((0)) |  |

- **Primary key:** InsuranceSharingID
- **FK** `FK_InsuranceSharing_AssetSetting` (AssetSettingID) -> AST.AssetSetting (AssetSettingID)
- **FK** `FK_InsuranceSharing_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_InsuranceSharing_InsuranceItem` (InsuranceItemID) -> AST.InsuranceItem (InsuranceItemID)
- **FK** `FK_InsuranceSharing_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete SET_NULL

### AST.InsuranceSharing_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | AssetID | int | N |  |  |
| 2 | InsuranceItemID | int | N |  |  |
| 3 | AssetSettingID | int | N |  |  |
| 4 | DateDiff | decimal(30,4) | N |  |  |
| 5 | Insurance | decimal(30,4) | N |  |  |
| 6 | TotalShare | decimal(30,4) | N |  |  |
| 7 | FromDate | date | N |  |  |
| 8 | EndDate | date | N |  |  |


### AST.InsuranceType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InsuranceTypeID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | InsuranceCost | int | Y |  |  |
| 10 | PrepaidInsurance | int | Y |  |  |

- **Primary key:** InsuranceTypeID
- **FK** `FK_InsuranceType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_InsuranceType_InsuranceCost` (InsuranceCost) -> ACC.SL (SlID)
- **FK** `FK_InsuranceType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_InsuranceType_PrepaidInsurance` (PrepaidInsurance) -> ACC.SL (SlID)
- **Referenced by:** AST.Insurance (InsuranceTypeID)

### AST.ReceivedFromBranch

Rows: 103

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivedFromBranchID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | SourceBranchID | int | N | ((-1)) |  |
| 6 | DestinationBranchID | int | N | ((-1)) |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | Status | tinyint | N | ((1)) |  |

- **Primary key:** ReceivedFromBranchID
- **FK** `FK_ReceivedFromBranch_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceivedFromBranch_DestinationBranch` (DestinationBranchID) -> CFG.Branch (BranchID)
- **FK** `FK_ReceivedFromBranch_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ReceivedFromBranch_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivedFromBranch_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_ReceivedFromBranch_SourceBranch` (SourceBranchID) -> CFG.Branch (BranchID)
- **Referenced by:** AST.ReceivedFromBranchItem (ReceivedFromBranchID)

### AST.ReceivedFromBranchItem

Rows: 1942

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ReceivedFromBranchItemID | int | N |  | identity |
| 2 | ReceivedFromBranchID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | AssetID | int | N |  |  |
| 5 | TransferItemID | int | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Description | nvarchar(250) | Y |  |  |
| 12 | Description2 | nvarchar(250) | Y |  |  |

- **Primary key:** ReceivedFromBranchItemID
- **FK** `FK_ReceivedFromBranchItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_ReceivedFromBranchItem_TransferItem` (TransferItemID) -> AST.TransferItem (TransferItemID)
- **FK** `FK_ReceivedFromBranchItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ReceivedFromBranchItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ReceivedFromBranchItem_Transfer` (ReceivedFromBranchID) -> AST.ReceivedFromBranch (ReceivedFromBranchID) on delete CASCADE
- **Referenced by:** AST.Asset (ReceivedFromBranchItemID)

### AST.Repair

Rows: 1 | تعمیر دارایی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairID | int | N |  | identity |
| 2 | Type | tinyint | N |  | جزئی= 1 اساسی = 2  |
| 3 | AssetID | int | N |  |  |
| 4 | Number | int | N |  |  |
| 5 | Date | date | N |  |  |
| 6 | Description | nvarchar(1050) | Y |  |  |
| 7 | Description2 | nvarchar(1050) | Y |  |  |
| 8 | FinancialPeriodID | int | N |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RepairID
- **FK** `FK_Repair_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_Repair_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Repair_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Repair_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Repair_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Depreciation (RepairID); AST.RepairServiceCost (RepairID); AST.RepairStuffCost (RepairID)

### AST.RepairServiceCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairServiceCostID | int | N |  | identity |
| 2 | RepairID | int | N |  |  |
| 3 | PurchaseInvoiceItemID | int | Y |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | SlID | int | N |  |  |
| 6 | Price | decimal(30,4) | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** RepairServiceCostID
- **FK** `FK_RepairServiceCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairServiceCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RepairServiceCost_Repair` (RepairID) -> AST.Repair (RepairID) on delete CASCADE
- **FK** `FK_RepairServiceCost_Sl` (SlID) -> ACC.SL (SlID)
- **FK** `FK_RepairServiceCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_RepairServiceCost_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)

### AST.RepairStuffCost

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RepairStuffCostID | int | N |  | identity |
| 2 | RepairID | int | N |  |  |
| 3 | OutgoingItemID | int | Y |  |  |
| 4 | Price | decimal(30,4) | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Type | tinyint | N | ((2)) |  |
| 11 | PurchaseInvoiceItemID | int | Y |  |  |
| 12 | MainQuantity | decimal(30,4) | N | ((0)) |  |
| 13 | SubQuantity | decimal(30,4) | Y |  |  |

- **Primary key:** RepairStuffCostID
- **FK** `FK_RepairStuffCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RepairStuffCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RepairStuffCost_Repair` (RepairID) -> AST.Repair (RepairID) on delete CASCADE
- **FK** `FK_RepairStuffCost_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_RepairStuffCost_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)

### AST.Revaluation

Rows: 0 | تجدید ارزیابی

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RevaluationID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Description | nvarchar(MAX) | Y |  |  |
| 6 | Description2 | nvarchar(MAX) | Y |  |  |
| 7 | PreVoucherID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | BranchID | int | N | ((-1)) |  |
| 14 | Status | tinyint | N |  |  |

- **Primary key:** RevaluationID
- **FK** `FK_Revaluation_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Revaluation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Revaluation_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Revaluation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Revaluation_Prevoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Depreciation (RevaluationID); AST.RevaluationItem (RevaluationID)

### AST.RevaluationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | RevaluationItemID | int | N |  | identity |
| 2 | RevaluationID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | Value | decimal(30,4) | N |  |  |
| 5 | LifeTime | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | SalvageValue | decimal(30,4) | N |  |  |
| 12 | BookValue | decimal(30,4) | N |  |  |
| 13 | FairValue | decimal(30,4) | N |  |  |

- **Primary key:** RevaluationItemID
- **FK** `FK_RevaluationItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_RevaluationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_RevaluationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_RevaluationItem_Revaluation` (RevaluationID) -> AST.Revaluation (RevaluationID) on delete CASCADE
- **Referenced by:** AST.Depreciation (RevaluationItemID)

### AST.Sale

Rows: 6

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaleID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | PartyID | bigint | N |  |  |
| 7 | PrevoucherID | int | Y |  |  |
| 8 | Version | int | N |  |  |
| 9 | Creator | int | N |  |  |
| 10 | CreationDate | datetime | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |
| 13 | BranchID | int | N | ((-1)) |  |
| 14 | SaleStatus | tinyint | N | ((0)) |  |

- **Primary key:** SaleID
- **FK** `FK_Sale_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Sale_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Sale_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Sale_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Sale_Party` (PartyID) -> CFG.Party (PartyID)
- **FK** `FK_Sale_Prevoucher` (PrevoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Depreciation (SaleID); AST.SaleItem (SaleID)

### AST.SaleItem

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SaleItemID | int | N |  | identity |
| 2 | SaleID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | AssetID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SaleItemID
- **FK** `FK_SaleItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_SaleItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SaleItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SaleItem_Sale` (SaleID) -> AST.Sale (SaleID) on delete CASCADE
- **Referenced by:** SLE.InvoiceItem (SaleItemID)

### AST.Salvage

Rows: 10

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SalvageID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | PreVoucherID | int | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | BranchID | int | N | ((-1)) |  |
| 12 | SalvageStatus | tinyint | N | ((1)) |  |

- **Primary key:** SalvageID
- **FK** `FK_Salvage_Branch` (BranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Salvage_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Salvage_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Salvage_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Salvage_Prevoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **Referenced by:** AST.Depreciation (SalvageID); AST.SalvageItem (SalvageID)

### AST.SalvageItem

Rows: 318

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SalvageItemID | int | N |  | identity |
| 2 | SalvageID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | Description | nvarchar(1024) | Y |  |  |
| 5 | Description2 | nvarchar(1024) | Y |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SalvageItemID
- **FK** `FK_SalvageItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_SalvageItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SalvageItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SalvageItem_Salvage` (SalvageID) -> AST.Salvage (SalvageID) on delete CASCADE

### AST.Statement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StatementID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | PartyID | bigint | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StatementID
- **FK** `FK_Statement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Statement_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Statement_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Statement_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** AST.StatementItem (StatementID)

### AST.StatementItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | StatementItemID | int | N |  | identity |
| 2 | StatementID | int | N |  |  |
| 3 | AssetID | int | N |  |  |
| 4 | UtilizationStatusID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** StatementItemID
- **FK** `FK_StatementItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_StatementItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_StatementItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_StatementItem_Statement` (StatementID) -> AST.Statement (StatementID) on delete CASCADE
- **FK** `FK_StatementItem_UtilizationStatus` (UtilizationStatusID) -> AST.UtilizationStatus (UtilizationStatusID)

### AST.Transfer

Rows: 103

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TransferID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Number | int | N |  |  |
| 4 | Date | date | N |  |  |
| 5 | SourceBranchID | int | N | ((-1)) |  |
| 6 | DestinationBranchID | int | N | ((-1)) |  |
| 7 | Description | nvarchar(250) | Y |  |  |
| 8 | Description2 | nvarchar(250) | Y |  |  |
| 9 | PreVoucherID | int | Y |  |  |
| 10 | Version | int | N |  |  |
| 11 | Creator | int | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditor | int | N |  |  |
| 14 | LastEditionDate | datetime | N |  |  |
| 15 | TransferStatus | tinyint | N | ((1)) |  |

- **Primary key:** TransferID
- **FK** `FK_Transfer_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Transfer_DestinationBranch` (DestinationBranchID) -> CFG.Branch (BranchID)
- **FK** `FK_Transfer_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_Transfer_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Transfer_PreVoucher` (PreVoucherID) -> ACC.PreVoucher (PreVoucherID) on delete SET_NULL
- **FK** `FK_Transfer_SourceBranch` (SourceBranchID) -> CFG.Branch (BranchID)
- **Referenced by:** AST.Depreciation (TransferID); AST.TransferItem (TransferID)

### AST.TransferItem

Rows: 1942

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TransferItemID | int | N |  | identity |
| 2 | TransferID | int | N |  |  |
| 3 | RowIndex | int | N |  |  |
| 4 | AssetID | int | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Description | nvarchar(250) | Y |  |  |
| 11 | Description2 | nvarchar(250) | Y |  |  |

- **Primary key:** TransferItemID
- **FK** `FK_TransferItem_Asset` (AssetID) -> AST.Asset (AssetID)
- **FK** `FK_TransferItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TransferItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_TransferItem_Transfer` (TransferID) -> AST.Transfer (TransferID) on delete CASCADE
- **Referenced by:** AST.Creation (TransferItemID); AST.ReceivedFromBranchItem (TransferItemID)

### AST.UtilizationCost

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UtilizationCostID | int | N |  | identity |
| 2 | CreationID | int | N |  |  |
| 3 | PurchaseInvoiceItemID | int | Y |  |  |
| 4 | StuffID | int | N |  |  |
| 5 | Price | decimal(30,4) | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | BaseType | tinyint | N | ((1)) |  |
| 12 | OutgoingItemID | int | Y |  |  |
| 13 | MainQuantity | decimal(36,10) | N |  |  |
| 14 | SubQuantity | decimal(36,10) | Y |  |  |

- **Primary key:** UtilizationCostID
- **FK** `FK_UtilizationCost_OutgoingItem` (OutgoingItemID) -> STC.OutgoingItem (OutgoingItemID)
- **FK** `FK_UtilizationCost_Creation` (CreationID) -> AST.Creation (CreationID) on delete CASCADE
- **FK** `FK_UtilizationCost_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UtilizationCost_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_UtilizationCost_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **FK** `FK_UtilizationCost_PurchaseInvoiceItem` (PurchaseInvoiceItemID) -> VND.PurchaseInvoiceItem (PurchaseInvoiceItemID)

### AST.UtilizationStatus

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UtilizationStatusID | int | N |  | identity |
| 2 | Title | nvarchar(250) | N |  |  |
| 3 | Title2 | nvarchar(250) | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** UtilizationStatusID
- **FK** `FK_UtilizationStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UtilizationStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** AST.StatementItem (UtilizationStatusID)

## Views

### AST.AssetReceiptItem_PurchaseInvoice_Remains

Definition: `programmability/views/AST.AssetReceiptItem_PurchaseInvoice_Remains.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AssetReceiptItemID | int | N |
| 2 | MainQuantity | decimal(30,4) | N |
| 3 | DoMainQuantity | decimal(38,10) | N |
| 4 | Non | decimal(38,10) | Y |

### AST.vwAssetCategoryHistory

Definition: `programmability/views/AST.vwAssetCategoryHistory.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TYPE | varchar(15) | N |
| 2 | AssetFullID | nvarchar(754) | Y |
| 3 | AssetID | int | N |
| 4 | FromDate | date | N |
| 5 | ToDate | date | N |
| 6 | AssetCategoryID | int | Y |
| 7 | PreviousCategoryID | int | Y |

### AST.VWAssetDepreciation

Definition: `programmability/views/AST.VWAssetDepreciation.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AssetID | int | N |
| 2 | AssetCategoryID | int | Y |
| 3 | AssetFullID | nvarchar(754) | Y |
| 4 | Date | date | N |
| 5 | Value | decimal(38,10) | Y |
| 6 | ValueType | varchar(15) | N |

### AST.VWAssetDollarValue

Definition: `programmability/views/AST.VWAssetDollarValue.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AssetID | int | N |
| 2 | date | date | N |
| 3 | Value | decimal(38,8) | Y |

### AST.VWAssetValue

Definition: `programmability/views/AST.VWAssetValue.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AssetID | int | N |
| 2 | AssetCategoryID | int | Y |
| 3 | AssetFullID | nvarchar(754) | Y |
| 4 | Date | date | N |
| 5 | VALUE | decimal(38,10) | Y |
| 6 | EstablishmentValue | decimal(30,4) | N |
| 7 | ValueType | varchar(14) | N |

### AST.vwDepreciation

Definition: `programmability/views/AST.vwDepreciation.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | AssetID | int | N |
| 2 | Value | decimal(30,4) | N |

