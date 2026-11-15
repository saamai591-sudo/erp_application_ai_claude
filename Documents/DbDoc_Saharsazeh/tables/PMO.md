# Schema `PMO`

## Tables

### PMO.Project

Rows: 11

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProjectID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | DlID | bigint | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | HasProjectControl | bit | N | ((0)) |  |
| 11 | IsActive | bit | N | ((0)) |  |

- **Primary key:** ProjectID
- **FK** `FK_Project_DL` (DlID) -> ACC.DL (DLID) on delete CASCADE
- **Referenced by:** PMO.WorkBreakdown (ProjectID); REQ.StuffRequestItem (ProjectID)

### PMO.ProjectActivity

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ProjectActivityID | int | N |  | identity |
| 2 | StuffID | int | N |  |  |
| 3 | Life | int | N |  |  |
| 4 | StartDate | datetime | N |  |  |
| 5 | EndDate | datetime | N |  |  |
| 6 | WorkBreakdownID | int | N |  |  |
| 7 | ProgressRate | decimal(5,2) | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |
| 11 | LastEditor | int | N |  |  |
| 12 | LastEditionDate | datetime | N |  |  |

- **Primary key:** ProjectActivityID
- **FK** `FK_ProjectActivity_WorkBreakdown` (WorkBreakdownID) -> PMO.WorkBreakdown (WorkBreakdownID)
- **FK** `FK_ProjectActivity_Stuff` (StuffID) -> STF.Stuff (StuffID)
- **Referenced by:** CNT.ActivityAssign (ProjectActivityID)

### PMO.WorkBreakdown

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | WorkBreakdownID | int | N |  | identity |
| 2 | ProjectID | int | Y |  |  |
| 3 | ParentID | int | Y |  |  |
| 4 | Code | nvarchar(256) | Y |  |  |
| 5 | Title | nvarchar(256) | Y |  |  |
| 6 | Title2 | nvarchar(256) | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | RootParentID | int | Y |  |  |

- **Primary key:** WorkBreakdownID
- **FK** `FK_Project_Project` (ParentID) -> PMO.WorkBreakdown (WorkBreakdownID)
- **FK** `FK_WorkBreakdown_Project` (ProjectID) -> PMO.Project (ProjectID)
- **FK** `FK_Project_Project_Root` (RootParentID) -> PMO.WorkBreakdown (WorkBreakdownID)
- **Referenced by:** PMO.ProjectActivity (WorkBreakdownID); PMO.WorkBreakdown (ParentID); PMO.WorkBreakdown (RootParentID)

