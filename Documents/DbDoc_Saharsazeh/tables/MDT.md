# Schema `MDT`

## Tables

### MDT.DmdColumn

Rows: 12509

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | TableName | nvarchar(128) | N |  |  |
| 3 | TableSchema | nvarchar(8) | N |  |  |
| 4 | Name | nvarchar(128) | N |  |  |
| 5 | AllowNull | bit | N |  |  |
| 6 | DataType | nvarchar(32) | N |  |  |
| 7 | DefaultValue | nvarchar(512) | Y |  |  |
| 8 | IsCalculated | bit | N |  |  |
| 9 | IsKey | bit | N |  |  |

- **Primary key:** ID
- **index** `IX_DmdColumn_TableName_TableSchema_IsKey` (TableName, TableSchema, IsKey) include (Name)

### MDT.DmdEntity

Rows: 346

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | DmdModuleID | int | Y |  |  |
| 3 | Name | nvarchar(100) | N |  |  |
| 4 | Type | tinyint | Y |  |  |
| 5 | Attributes | nvarchar(MAX) | Y |  |  |

- **Primary key:** ID
- **FK** `FK_DmdEntity_DmdModule` (DmdModuleID) -> MDT.DmdModule (ID)
- **Referenced by:** CFG.FileAttachment (MetaDataEntityID); CFG.NumberingPatternItem (DmdEntityID); CFG.OriginDestinationSetting (DestinationID); CFG.OriginDestinationSetting (OriginID); FLW.WfProcess (InitialEntityID); MDT.DmdRelatedEntityTranslate (DmdEntityID); PUM.SurveyDesign (EntityID)

### MDT.DmdEntityRelationView

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Name | nvarchar(124) | N |  |  |
| 3 | Key | nvarchar(124) | N |  |  |
| 4 | IsMain | bit | N |  |  |
| 5 | Attribute | nvarchar(MAX) | N |  |  |

- **Primary key:** ID

### MDT.DmdEntityTableRelation

Rows: 528

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DmdEntityID | int | N |  |  |
| 2 | DmdTableID | int | N |  |  |
| 3 | RelationType | tinyint | N |  |  |


### MDT.DmdEntityView

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Name | nvarchar(124) | N |  |  |
| 3 | Key | nvarchar(124) | N |  |  |
| 4 | IsMain | bit | N |  |  |
| 5 | Attribute | nvarchar(MAX) | N |  |  |

- **Primary key:** ID

### MDT.DmdField

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Name | nvarchar(100) | N |  |  |
| 3 | Type | tinyint | N |  |  |
| 4 | Attributes | nvarchar(MAX) | Y |  |  |
| 5 | RelationPath | nvarchar(256) | Y |  |  |
| 6 | CalcExpr | nvarchar(256) | Y |  |  |

- **Primary key:** ID

### MDT.DmdModule

Rows: 29

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Name | nvarchar(100) | N |  |  |

- **Primary key:** ID
- **Referenced by:** MDT.DmdEntity (DmdModuleID); MDT.DmdRelatedModuleTranslate (DmdModuleID)

### MDT.DmdRelatedEntityTranslate

Rows: 676

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DmdEntityID | int | N |  |  |
| 2 | DmdTranslateItemID | int | N |  |  |

- **Primary key:** DmdEntityID, DmdTranslateItemID
- **FK** `FK_DmdRelatedEntityTranslate_DmdEntity` (DmdEntityID) -> MDT.DmdEntity (ID)
- **FK** `FK_DmdRelatedEntityTranslate_DmdTranslateItem` (DmdTranslateItemID) -> MDT.DmdTranslateItem (ID)

### MDT.DmdRelatedModuleTranslate

Rows: 58

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DmdModuleID | int | N |  |  |
| 2 | DmdTranslateItemID | int | N |  |  |

- **Primary key:** DmdModuleID, DmdTranslateItemID
- **FK** `FK_DmdRelatedModuleTranslate_DmdModule` (DmdModuleID) -> MDT.DmdModule (ID)
- **FK** `FK_DmdRelatedModuleTranslate_DmdTranslateItem` (DmdTranslateItemID) -> MDT.DmdTranslateItem (ID)

### MDT.DmdSaleItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NodeId | bigint | N |  | identity |
| 2 | ID | bigint | N |  |  |
| 3 | ItemType | tinyint | N |  |  |
| 4 | HeaderID | int | Y |  |  |

- **Primary key:** NodeId

### MDT.DmdSaleItemConnection

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | bigint | N |  | identity |
| 2 | FromID | bigint | N |  |  |
| 3 | ToID | bigint | N |  |  |
| 4 | ParentID | bigint | N |  |  |
| 5 | ChildID | bigint | N |  |  |

- **Primary key:** ID

### MDT.DmdTable

Rows: 1170

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Name | nvarchar(128) | N |  |  |
| 3 | Schema | nvarchar(8) | N |  |  |
| 4 | Type | tinyint | N |  |  |

- **Primary key:** ID
- **Referenced by:** CFG.JsonLog (TableId)

### MDT.DmdTableRelation

Rows: 3506

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | FromTableID | int | N |  |  |
| 3 | ToTableID | int | N |  |  |
| 4 | FromColumn | nvarchar(128) | N |  |  |
| 5 | ToColumn | nvarchar(128) | N |  |  |
| 6 | IsMain | bit | N |  |  |
| 7 | Name | nvarchar(128) | N |  |  |
| 8 | IsCascade | bit | N |  |  |

- **Primary key:** ID

### MDT.DmdTranslateItem

Rows: 719

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | Value | nvarchar(1024) | N |  |  |
| 3 | Lang | tinyint | N |  |  |
| 4 | Culture | varchar(25) | N |  |  |

- **Primary key:** ID
- **Referenced by:** MDT.DmdRelatedEntityTranslate (DmdTranslateItemID); MDT.DmdRelatedModuleTranslate (DmdTranslateItemID)

### MDT.SaleTableItem

Rows: 7

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | Id | int | N |  | identity |
| 2 | TableName | varchar(50) | N |  |  |
| 3 | Scheme | varchar(50) | N |  |  |
| 4 | ItemType | varchar(50) | N |  |  |
| 5 | ParentTableName | varchar(50) | Y |  |  |
| 6 | SaleTypeColumn | varchar(50) | Y |  |  |
| 7 | PartyColumn | varchar(50) | Y |  |  |
| 8 | DlColumn | varchar(50) | Y |  |  |
| 9 | BranchColumn | varchar(50) | Y |  |  |
| 10 | StatusColumn | varchar(50) | Y |  |  |
| 11 | SaleAreaColumn | nvarchar(50) | Y |  |  |
| 12 | SaleModelColumn | nvarchar(50) | Y |  |  |

- **Primary key:** Id

### MDT.SaleTableItemRelation

Rows: 18

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ParentId | int | N |  |  |
| 2 | ChildId | int | N |  |  |

- **Primary key:** ParentId, ChildId

## Views

### MDT.vwEntity

Definition: `programmability/views/MDT.vwEntity.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | DmdEntityID | int | N |
| 2 | DmdEntityName | nvarchar(100) | N |
| 3 | IDColumn | nvarchar(130) | N |
| 4 | TableName | nvarchar(517) | Y |
| 5 | FlowParams | nvarchar(MAX) | Y |

### MDT.VWEntityTranslate

Definition: `programmability/views/MDT.VWEntityTranslate.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | Name | nvarchar(100) | N |
| 2 | Culture | varchar(25) | N |
| 3 | Value | nvarchar(1024) | N |

