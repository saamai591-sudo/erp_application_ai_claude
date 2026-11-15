# Schema `DMS`

## Tables

### DMS.Document

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | StreamID | uniqueidentifier | Y |  |  |
| 4 | Description | nvarchar(2048) | Y |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** DocumentID
- **FK** `FK_Document_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Document_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** DMS.DocumentStoreChange (DocumentID); VND.TenderDocument (DocumentID)

### DMS.DocumentStore

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | stream_id | uniqueidentifier | N | (newsequentialid()) |  |
| 2 | file_stream | varbinary(MAX) | Y |  |  |
| 3 | name | nvarchar(255) | N |  |  |
| 4 | path_locator | hierarchyid | N | (convert(hierarchyid, '/' +     convert(varchar(20), convert(bigint, substring(convert(binary(16), newid()), 1, 6))) + '.' +     convert(varchar(20), convert(bigint, substring(convert(binary(16), newid()), 7, 6))) + '.' +     convert(varchar(20), convert(bigint, substring(convert(binary(16), newid()), 13, 4))) + '/')) |  |
| 5 | parent_path_locator | hierarchyid | Y |  | computed: (case when [path_locator].[GetLevel]()=(1) then NULL else [path_locator].[GetAncestor]((1)) end) |
| 6 | file_type | nvarchar(255) | Y |  | computed: (getfileextension([name])) |
| 7 | cached_file_size | bigint | Y |  | computed: (datalength(file_stream)) |
| 8 | creation_time | datetimeoffset(7) | N | (sysdatetimeoffset()) |  |
| 9 | last_write_time | datetimeoffset(7) | N | (sysdatetimeoffset()) |  |
| 10 | last_access_time | datetimeoffset(7) | Y | (sysdatetimeoffset()) |  |
| 11 | is_directory | bit | N | ((0)) |  |
| 12 | is_offline | bit | N | ((0)) |  |
| 13 | is_hidden | bit | N | ((0)) |  |
| 14 | is_readonly | bit | N | ((0)) |  |
| 15 | is_archive | bit | N | ((1)) |  |
| 16 | is_system | bit | N | ((0)) |  |
| 17 | is_temporary | bit | N | ((0)) |  |

- **Primary key:** path_locator
- **unique constraint** `UQ__Document__9DD95BAF1CE4FAC1` (stream_id)
- **unique constraint** `UQ__Document__A236CBB32A7F8B62` (parent_path_locator, name)
- **FK** `FK__DocumentS__paren__6ECF56E7` (parent_path_locator) -> DMS.DocumentStore (path_locator)
- **Referenced by:** DMS.DocumentStore (parent_path_locator)
- **check** `CK__DocumentStore__6DDB32AE`: /*LockAllDescendants*/ (filetable_lock_all_descendants((1731081503),(1747081560),[name],CONVERT([varbinary](892),[path_locator],0))=(1))
- **check** `CK__DocumentStore__6CE70E75`: /*ParentsAreDirectories*/ (filetable_parents_are_directories((1731081503),CONVERT([varbinary](892),[path_locator],0),[is_directory])=(1))
- **check** `CK__DocumentStore__6AFEC603`: /*IsFilenameValid*/ (isfilenamevalid([name])=(1))
- **check** `CK__DocumentStore__6BF2EA3C`: /*CheckValidAttributes*/ (filetable_check_valid_attributes(CONVERT([varbinary](892),[path_locator],0),[is_directory],case when [file_stream] IS NULL then (1) else (0) end)=(1))

### DMS.DocumentStoreChange

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | DocumentStoreChangeID | int | N |  | identity |
| 2 | DocumentID | int | N |  |  |
| 3 | UserID | int | N |  |  |
| 4 | Date | datetime | N |  |  |
| 5 | ChangeStreamID | uniqueidentifier | Y |  |  |
| 6 | Comment | nvarchar(MAX) | Y |  |  |
| 7 | ChangeSize | bigint | N |  |  |

- **Primary key:** DocumentStoreChangeID
- **FK** `FK_DocumentStoreChange_User` (UserID) -> CFG.User (UserID)
- **FK** `FK_DocumentStoreChange_Document` (DocumentID) -> DMS.Document (DocumentID) on delete CASCADE

### DMS.DocumentStoreChange_Temp

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | DocumentID | int | N |  |  |
| 3 | Info | nvarchar(256) | N |  |  |

- **Primary key:** ID

### DMS.DocumentStoreChangeStream

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | stream_id | uniqueidentifier | N |  |  |
| 2 | file_stream | varbinary(MAX) | N |  |  |

- **unique constraint** `UQ__Document__9DD95BAFDAABE981` (stream_id)

