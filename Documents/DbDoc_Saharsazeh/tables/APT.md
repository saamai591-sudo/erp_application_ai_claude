# Schema `APT`

## Tables

### APT.ApportionAccounting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionAccountingID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | PortionerGroupID | int | N |  |  |
| 4 | PortionedToGroupID | int | N |  |  |
| 5 | SlType | tinyint | N |  |  |
| 6 | SlID | int | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** ApportionAccountingID
- **unique index** `IX_Date_ApportionGroupIDs` (Date, PortionerGroupID, PortionedToGroupID)
- **FK** `FK_ApportionAccounting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionAccounting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionAccounting_PortionedToGroup` (PortionedToGroupID) -> APT.ApportionGroup (ApportionGroupID)
- **FK** `FK_ApportionAccounting_PortionerGroup` (PortionerGroupID) -> APT.ApportionGroup (ApportionGroupID)
- **FK** `FK_ApportionAccounting_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** APT.ApportionAccountingAccountLevel (ApportionAccountingID)

### APT.ApportionAccountingAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionAccountingAccountLevelID | int | N |  | identity |
| 2 | ApportionAccountingID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | Type | tinyint | N |  |  |
| 5 | DLID | bigint | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ApportionAccountingAccountLevelID
- **FK** `FK_ApportionAccountingAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_ApportionAccountingAccountLevel_ApportionAccounting` (ApportionAccountingID) -> APT.ApportionAccounting (ApportionAccountingID) on delete CASCADE
- **FK** `FK_ApportionAccountingAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionAccountingAccountLevel_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_ApportionAccountingAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)

### APT.ApportionBase

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionBaseID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ApportionBaseID
- **unique index** `IX_ApportionBase_Code` (Code)
- **unique index** `IX_ApportionBase_Title` (Title)
- **unique index** `IX_ApportionBase_Title2` (Title2)
- **FK** `FK_ApportionBase_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionBase_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** APT.ApportionBaseValue (ApportionBaseID); APT.PortionerItem (ApportionBaseID)

### APT.ApportionBaseValue

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionBaseValueID | int | N |  | identity |
| 2 | ApportionPeriodID | int | N |  |  |
| 3 | PortionedToID | int | N |  |  |
| 4 | ApportionBaseID | int | N |  |  |
| 5 | Value | decimal(30,10) | Y |  |  |
| 6 | Expression | varchar(MAX) | Y |  |  |
| 7 | SQLExpression | nvarchar(MAX) | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ApportionBaseValueID
- **unique index** `IX_ApportionPeriodID_PortionedToID_ApportionBaseID` (ApportionPeriodID, PortionedToID, ApportionBaseID)
- **FK** `FK_ApportionBaseValue_ApportionBase` (ApportionBaseID) -> APT.ApportionBase (ApportionBaseID)
- **FK** `FK_ApportionBaseValue_ApportionPeriod` (ApportionPeriodID) -> APT.ApportionPeriod (ApportionPeriodID)
- **FK** `FK_ApportionBaseValue_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionBaseValue_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionBaseValue_PortionedTo` (PortionedToID) -> APT.PortionedTo (PortionedToID)

### APT.ApportionCalculation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionCalculationID | int | N |  | identity |
| 2 | ApportionPeriodCalculationID | int | N |  |  |
| 3 | PortionerItemID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ApportionCalculationID
- **FK** `FK_ApportionCalculation_ApportionPeriodCalculation` (ApportionPeriodCalculationID) -> APT.ApportionPeriodCalculation (ApportionPeriodCalculationID) on delete CASCADE
- **FK** `FK_ApportionCalculation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculation_PortionerItem` (PortionerItemID) -> APT.PortionerItem (PortionerItemID)
- **Referenced by:** APT.ApportionCalculationAccountLevel (ApportionCalculationID); APT.ApportionCalculationItem (ApportionCalculationID)

### APT.ApportionCalculationAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionCalculationAccountLevelID | int | N |  | identity |
| 2 | ApportionCalculationID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | DLID | bigint | Y |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ApportionCalculationAccountLevelID
- **FK** `FK_ApportionCalculationAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculationAccountLevel_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_ApportionCalculationAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculationAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_ApportionCalculationAccountLevel_ApportionCalculation` (ApportionCalculationID) -> APT.ApportionCalculation (ApportionCalculationID) on delete CASCADE

### APT.ApportionCalculationItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionCalculationItemID | int | N |  | identity |
| 2 | ApportionCalculationID | int | N |  |  |
| 3 | PortionedToID | int | N |  |  |
| 4 | Amount | decimal(30,4) | N |  |  |
| 5 | Degree | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ApportionCalculationItemID
- **FK** `FK_ApportionCalculationItem_ApportionCalculation` (ApportionCalculationID) -> APT.ApportionCalculation (ApportionCalculationID) on delete CASCADE
- **FK** `FK_ApportionCalculationItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculationItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionCalculationItem_PortionedTo` (PortionedToID) -> APT.PortionedTo (PortionedToID)

### APT.ApportionGroup

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionGroupID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | Type | tinyint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ApportionGroupID
- **unique index** `IX_ApportionGroup_Code` (Code)
- **unique index** `IX_ApportionGroup_Title` (Title)
- **unique index** `IX_ApportionGroup_Title2` (Title2)
- **FK** `FK_ApportionGroup_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionGroup_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** APT.ApportionAccounting (PortionedToGroupID); APT.ApportionAccounting (PortionerGroupID); APT.PortionedTo (ApportionGroupID); APT.Portioner (ApportionGroupID)

### APT.ApportionPeriod

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionPeriodID | int | N |  | identity |
| 2 | FinancialPeriodID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | StartDate | date | N |  |  |
| 6 | EndDate | date | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** ApportionPeriodID
- **FK** `FK_ApportionPeriod_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionPeriod_FinancialPeriod` (FinancialPeriodID) -> CFG.FinancialPeriod (FinancialPeriodID)
- **FK** `FK_ApportionPeriod_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** APT.ApportionBaseValue (ApportionPeriodID); APT.ApportionPeriodCalculation (ApportionPeriodID)

### APT.ApportionPeriodCalculation

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ApportionPeriodCalculationID | int | N |  | identity |
| 2 | ApportionPeriodID | int | N |  |  |
| 3 | VoucherID | int | Y |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ApportionPeriodCalculationID
- **FK** `FK_ApportionPeriodCalculation_ApportionPeriod` (ApportionPeriodID) -> APT.ApportionPeriod (ApportionPeriodID)
- **FK** `FK_ApportionPeriodCalculation_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ApportionPeriodCalculation_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ApportionPeriodCalculation_Voucher` (VoucherID) -> ACC.Voucher (VoucherID) on delete SET_NULL
- **Referenced by:** APT.ApportionCalculation (ApportionPeriodCalculationID)

### APT.PortionedTo

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortionedToID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | ApportionGroupID | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PortionedToID
- **FK** `FK_PortionedTo_ApportionGroup` (ApportionGroupID) -> APT.ApportionGroup (ApportionGroupID)
- **FK** `FK_PortionedTo_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortionedTo_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** APT.ApportionBaseValue (PortionedToID); APT.ApportionCalculationItem (PortionedToID); APT.PortionedToDl (PortionedToID); APT.PortioningItem (PortionedToID)

### APT.PortionedToDl

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortionedToDlID | int | N |  | identity |
| 2 | PortionedToID | int | N |  |  |
| 3 | DlTypeID | int | N |  |  |
| 4 | DLID | bigint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** PortionedToDlID
- **FK** `FK_PortionedToDl_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortionedToDl_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_PortionedToDl_DlType` (DlTypeID) -> ACC.DlType (DlTypeID)
- **FK** `FK_PortionedToDl_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PortionedToDl_PortionedTo` (PortionedToID) -> APT.PortionedTo (PortionedToID) on delete CASCADE

### APT.Portioner

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortionerID | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | ApportionGroupID | int | N |  |  |
| 6 | ImportanceLevel | decimal(20,10) | N |  |  |
| 7 | Priority | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** PortionerID
- **unique index** `IX_Portioner_Code` (Code)
- **unique index** `IX_Portioner_Title` (Title)
- **unique index** `IX_Portioner_Title2` (Title2)
- **FK** `FK_Portioner_ApportionGroup` (ApportionGroupID) -> APT.ApportionGroup (ApportionGroupID)
- **FK** `FK_Portioner_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Portioner_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** APT.PortionerAccountLevel (PortionerID); APT.PortionerItem (PortionerID); APT.Portioning (PortionerID)

### APT.PortionerAccountLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortionerAccountLevelID | int | N |  | identity |
| 2 | PortionerID | int | N |  |  |
| 3 | AccountLevelID | int | N |  |  |
| 4 | Type | tinyint | N |  |  |
| 5 | DLID | bigint | Y |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PortionerAccountLevelID
- **FK** `FK_PortionerAccountLevel_AccountLevel` (AccountLevelID) -> ACC.AccountLevel (AccountLevelID)
- **FK** `FK_PortionerAccountLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortionerAccountLevel_DL` (DLID) -> ACC.DL (DLID)
- **FK** `FK_PortionerAccountLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PortionerAccountLevel_Portioner` (PortionerID) -> APT.Portioner (PortionerID) on delete CASCADE

### APT.PortionerItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortionerItemID | int | N |  | identity |
| 2 | PortionerID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | SlID | int | N |  |  |
| 5 | ApportionBaseID | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PortionerItemID
- **FK** `FK_PortionerItem_ApportionBase` (ApportionBaseID) -> APT.ApportionBase (ApportionBaseID)
- **FK** `FK_PortionerItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortionerItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PortionerItem_Portioner` (PortionerID) -> APT.Portioner (PortionerID) on delete CASCADE
- **FK** `FK_PortionerItem_SL` (SlID) -> ACC.SL (SlID)
- **Referenced by:** APT.ApportionCalculation (PortionerItemID)

### APT.Portioning

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortioningID | int | N |  | identity |
| 2 | Date | date | N |  |  |
| 3 | PortionerID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** PortioningID
- **unique index** `IX_Date_PortionerID` (Date, PortionerID)
- **FK** `FK_Portioning_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Portioning_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Portioning_Portioner` (PortionerID) -> APT.Portioner (PortionerID)
- **Referenced by:** APT.PortioningItem (PortioningID)

### APT.PortioningItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortioningItemID | int | N |  | identity |
| 2 | PortioningID | int | N |  |  |
| 3 | RowIndex | smallint | N |  |  |
| 4 | PortionedToID | int | N |  |  |
| 5 | LessImportant | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** PortioningItemID
- **FK** `FK_PortioningItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortioningItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PortioningItem_PortionedTo` (PortionedToID) -> APT.PortionedTo (PortionedToID)
- **FK** `FK_PortioningItem_Portioning` (PortioningID) -> APT.Portioning (PortioningID) on delete CASCADE

## Views

### APT.VWApportionAccounting

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SlID | int | Y |
| 2 | AccountLevelID | int | Y |
| 3 | DLID | bigint | Y |
| 4 | Amount | decimal(30,4) | N |
| 5 | degree | int | N |
| 6 | ApportionPeriodID | int | N |
| 7 | ApportionCalculationID | int | N |
| 8 | ApportionCalculationItemID | int | N |

