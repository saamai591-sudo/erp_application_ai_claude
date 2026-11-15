# Schema `FLW`

## Tables

### FLW.WfActivityInstance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | ProcessInstanceID | int | N |  |  |
| 3 | AppName | nvarchar(50) | N |  |  |
| 4 | AppInstanceID | varchar(250) | Y |  |  |
| 5 | ProcessGUID | varchar(250) | Y |  |  |
| 6 | ActivityGUID | varchar(250) | Y |  |  |
| 7 | ActivityName | nvarchar(MAX) | N |  |  |
| 8 | ActivityType | smallint | N |  |  |
| 9 | ActivityState | smallint | N | ((0)) |  |
| 10 | WorkItemType | smallint | N | ((0)) |  |
| 11 | AssignedToUserIDs | nvarchar(1000) | Y |  |  |
| 12 | AssignedToUserNames | nvarchar(2000) | Y |  |  |
| 13 | BackwardType | smallint | Y |  |  |
| 14 | BackSrcActivityInstanceID | int | Y |  |  |
| 15 | GatewayDirectionTypeID | smallint | Y |  |  |
| 16 | CanRenewInstance | tinyint | N | ((0)) |  |
| 17 | TokensRequired | int | N | ((1)) |  |
| 18 | TokensHad | int | N |  |  |
| 19 | ComplexType | smallint | Y |  |  |
| 20 | MergeType | smallint | Y |  |  |
| 21 | MIHostActivityInstanceID | int | Y |  |  |
| 22 | CompareType | smallint | Y |  |  |
| 23 | CompleteOrder | float | Y |  |  |
| 24 | SignForwardType | smallint | Y |  |  |
| 25 | CreatedByUserID | varchar(250) | Y |  |  |
| 26 | CreatedByUserName | nvarchar(250) | Y |  |  |
| 27 | CreatedDateTime | datetime | N | (getdate()) |  |
| 28 | LastUpdatedByUserID | varchar(250) | Y |  |  |
| 29 | LastUpdatedByUserName | nvarchar(250) | Y |  |  |
| 30 | LastUpdatedDateTime | datetime | Y |  |  |
| 31 | EndedDateTime | datetime | Y |  |  |
| 32 | EndedByUserID | varchar(250) | Y |  |  |
| 33 | EndedByUserName | nvarchar(250) | Y |  |  |
| 34 | RecordStatusInvalid | tinyint | N | ((0)) |  |
| 35 | RowVersionID | timestamp | Y |  |  |
| 36 | SenderComment | nvarchar(1000) | Y |  |  |

- **Primary key:** ID
- **FK** `FK_WfActivityInstance_ProcessInstanceID` (ProcessInstanceID) -> FLW.WfProcessInstance (ID)
- **Referenced by:** FLW.WfTasks (ActivityInstanceID)

### FLW.WfLog

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | EventTypeID | int | N |  |  |
| 3 | Priority | int | N |  |  |
| 4 | Severity | nvarchar(250) | Y |  |  |
| 5 | Title | nvarchar(256) | N |  |  |
| 6 | Message | nvarchar(500) | Y |  |  |
| 7 | StackTrace | nvarchar(4000) | Y |  |  |
| 8 | InnerStackTrace | nvarchar(4000) | Y |  |  |
| 9 | RequestData | nvarchar(2000) | Y |  |  |
| 10 | Timestamp | datetime | N |  |  |

- **Primary key:** ID

### FLW.WfProcess

Rows: 2

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | ProcessGUID | varchar(250) | Y |  |  |
| 3 | ProcessName | nvarchar(250) | Y |  |  |
| 4 | Version | nvarchar(20) | N | ((1)) |  |
| 5 | IsUsing | tinyint | N | ((0)) |  |
| 6 | AppType | varchar(250) | Y |  |  |
| 7 | PageUrl | nvarchar(250) | Y |  |  |
| 8 | XmlFileName | nvarchar(250) | Y |  |  |
| 9 | XmlFilePath | nvarchar(250) | Y |  |  |
| 10 | XmlContent | nvarchar(MAX) | Y |  |  |
| 11 | Description | nvarchar(1000) | Y |  |  |
| 12 | CreatedDateTime | datetime | N | (getdate()) |  |
| 13 | LastUpdatedDateTime | datetime | Y |  |  |
| 14 | RowVersionID | timestamp | Y |  |  |
| 15 | AbstractInfo | nvarchar(MAX) | Y |  |  |
| 16 | PublishStatus | nvarchar(250) | Y |  |  |
| 17 | ProcessType | nvarchar(250) | Y |  |  |
| 18 | ModuleKey | nvarchar(250) | Y |  |  |
| 19 | IsOneTimeProcess | bit | Y | ('FALSE') |  |
| 20 | HasPreDescription | bit | Y |  |  |
| 21 | Creator | int | N | ((-1)) |  |
| 22 | CreationDate | datetime | N | (getdate()) |  |
| 23 | LastEditor | int | N | ((-1)) |  |
| 24 | LastEditionDate | datetime | N | (getdate()) |  |
| 25 | IsSingleRunProcess | bit | Y |  |  |
| 26 | InitialEntityID | int | Y |  |  |
| 27 | DefaultTitle | nvarchar(512) | Y |  |  |
| 28 | VersionTitle | nvarchar(200) | Y |  |  |
| 29 | ExecutionDate | datetime | Y |  |  |

- **Primary key:** ID
- **FK** `FK_WfProcess_InitialEntity` (InitialEntityID) -> MDT.DmdEntity (ID)
- **FK** `FK_WfProcess_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_WfProcess_LastEditor` (LastEditor) -> CFG.User (UserID)

### FLW.WfProcessInstance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | ProcessGUID | varchar(250) | Y |  |  |
| 3 | ProcessName | nvarchar(512) | N |  |  |
| 4 | Version | nvarchar(20) | N | ((1)) |  |
| 5 | AppInstanceID | varchar(250) | Y |  |  |
| 6 | AppName | nvarchar(250) | Y |  |  |
| 7 | AppInstanceCode | nvarchar(250) | Y |  |  |
| 8 | ProcessState | smallint | N | ((0)) |  |
| 9 | ParentProcessInstanceID | int | Y | ((0)) |  |
| 10 | ParentProcessGUID | varchar(250) | Y |  |  |
| 11 | InvokedActivityInstanceID | int | Y | ((0)) |  |
| 12 | InvokedActivityGUID | varchar(250) | Y |  |  |
| 13 | CreatedDateTime | datetime | N | (getdate()) |  |
| 14 | CreatedByUserID | varchar(250) | Y |  |  |
| 15 | CreatedByUserName | nvarchar(250) | Y |  |  |
| 16 | OverdueDateTime | datetime | Y |  |  |
| 17 | OverdueTreatedDateTime | datetime | Y |  |  |
| 18 | LastUpdatedDateTime | datetime | Y |  |  |
| 19 | LastUpdatedByUserID | varchar(250) | Y |  |  |
| 20 | LastUpdatedByUserName | nvarchar(250) | Y |  |  |
| 21 | EndedDateTime | datetime | Y |  |  |
| 22 | EndedByUserID | varchar(250) | Y |  |  |
| 23 | EndedByUserName | nvarchar(250) | Y |  |  |
| 24 | RecordStatusInvalid | tinyint | N | ((0)) |  |
| 25 | RowVersionID | timestamp | Y |  |  |
| 26 | ProcessVariables | nvarchar(2000) | Y |  |  |
| 27 | ParentActivityInstanceId | int | Y |  |  |

- **Primary key:** ID
- **Referenced by:** FLW.WfActivityInstance (ProcessInstanceID)

### FLW.WfTasks

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | ActivityInstanceID | int | N |  |  |
| 3 | ProcessInstanceID | int | N |  |  |
| 4 | AppName | nvarchar(250) | Y |  |  |
| 5 | AppInstanceID | varchar(250) | Y |  |  |
| 6 | ProcessGUID | varchar(250) | Y |  |  |
| 7 | ActivityGUID | varchar(250) | Y |  |  |
| 8 | ActivityName | nvarchar(250) | Y |  |  |
| 9 | TaskType | smallint | N |  |  |
| 10 | TaskState | smallint | N | ((0)) |  |
| 11 | EntrustedTaskID | int | Y |  |  |
| 12 | AssignedToUserID | varchar(250) | Y |  |  |
| 13 | AssignedToUserName | nvarchar(250) | Y |  |  |
| 14 | CreatedByUserID | varchar(250) | Y |  |  |
| 15 | CreatedByUserName | nvarchar(250) | Y |  |  |
| 16 | CreatedDateTime | datetime | N | (getdate()) |  |
| 17 | LastUpdatedDateTime | datetime | Y |  |  |
| 18 | LastUpdatedByUserID | varchar(250) | Y |  |  |
| 19 | LastUpdatedByUserName | nvarchar(250) | Y |  |  |
| 20 | EndedByUserID | varchar(250) | Y |  |  |
| 21 | EndedByUserName | nvarchar(250) | Y |  |  |
| 22 | EndedDateTime | datetime | Y |  |  |
| 23 | RecordStatusInvalid | tinyint | N | ((0)) |  |
| 24 | RowVersionID | timestamp | Y |  |  |
| 25 | TaskStatus | int | Y |  |  |

- **Primary key:** ID
- **FK** `FK_WfTasks_ActivityInstanceID` (ActivityInstanceID) -> FLW.WfActivityInstance (ID)

### FLW.WfTransitionInstance

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ID | int | N |  | identity |
| 2 | TransitionGUID | varchar(250) | Y |  |  |
| 3 | AppName | nvarchar(250) | Y |  |  |
| 4 | AppInstanceID | varchar(250) | Y |  |  |
| 5 | ProcessInstanceID | int | N |  |  |
| 6 | ProcessGUID | varchar(250) | Y |  |  |
| 7 | TransitionType | tinyint | N |  |  |
| 8 | FlyingType | tinyint | N | ((0)) |  |
| 9 | FromActivityInstanceID | int | N |  |  |
| 10 | FromActivityGUID | varchar(250) | Y |  |  |
| 11 | FromActivityType | smallint | N |  |  |
| 12 | FromActivityName | nvarchar(MAX) | N |  |  |
| 13 | ToActivityInstanceID | int | N |  |  |
| 14 | ToActivityGUID | varchar(250) | Y |  |  |
| 15 | ToActivityType | smallint | N |  |  |
| 16 | ToActivityName | nvarchar(MAX) | N |  |  |
| 17 | ConditionParseResult | tinyint | N | ((0)) |  |
| 18 | CreatedByUserID | varchar(250) | Y |  |  |
| 19 | CreatedByUserName | nvarchar(250) | Y |  |  |
| 20 | CreatedDateTime | datetime | N | (getdate()) |  |
| 21 | RecordStatusInvalid | tinyint | N | ((0)) |  |
| 22 | RowVersionID | timestamp | Y |  |  |

- **Primary key:** ID

## Views

### FLW.Vw_Trans

Definition: `programmability/views/FLW.Vw_Trans.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | SPID | int | N |
| 2 | DatabaseName | nvarchar(128) | Y |
| 3 | LockedObjectName | sysname | N |
| 4 | LockedObjectId | int | N |
| 5 | LockedResource | nvarchar(60) | N |
| 6 | LockType | nvarchar(60) | N |
| 7 | SqlStatementText | nvarchar(MAX) | Y |
| 8 | LoginName | nvarchar(128) | N |
| 9 | HostName | nvarchar(128) | Y |
| 10 | IsUserTransaction | bit | N |
| 11 | TransactionName | nvarchar(32) | N |
| 12 | AuthenticationMethod | nvarchar(40) | N |

### FLW.VWFlowOfProcessInstance

Definition: `programmability/views/FLW.VWFlowOfProcessInstance.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | ProcessName | nvarchar(512) | N |
| 2 | ActivityName | nvarchar(250) | Y |
| 3 | CreatedDateTime | datetime | N |
| 4 | EndedDateTime | datetime | Y |
| 5 | AppName | nvarchar(250) | Y |
| 6 | AppInstanceID | varchar(250) | Y |
| 7 | ProcessInstanceID | int | N |
| 8 | ElapsedTime | varchar(15) | Y |
| 9 | SenderComment | nvarchar(1000) | Y |
| 10 | AppNameTitle | nvarchar(1024) | Y |
| 11 | PreviousUserID | int | Y |
| 12 | ActivityInstanceID | int | N |

### FLW.vwWfActivityInstanceTasks

Definition: `programmability/views/FLW.vwWfActivityInstanceTasks.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | TaskID | int | N |
| 2 | SenderComment | nvarchar(1000) | Y |
| 3 | AppName | nvarchar(50) | N |
| 4 | AppInstanceID | varchar(250) | Y |
| 5 | ProcessGUID | varchar(250) | Y |
| 6 | Version | nvarchar(20) | N |
| 7 | ProcessInstanceID | int | N |
| 8 | ActivityGUID | varchar(250) | Y |
| 9 | ActivityInstanceID | int | N |
| 10 | ActivityName | nvarchar(MAX) | N |
| 11 | ActivityType | smallint | N |
| 12 | WorkItemType | smallint | N |
| 13 | PreviousUserID | varchar(250) | Y |
| 14 | PreviousUserName | nvarchar(250) | Y |
| 15 | PreviousDateTime | datetime | N |
| 16 | TaskType | smallint | N |
| 17 | EntrustedTaskID | int | Y |
| 18 | AssignedToUserID | varchar(250) | Y |
| 19 | AssignedToUserName | nvarchar(250) | Y |
| 20 | Date_CreatedDate | nvarchar(MAX) | Y |
| 21 | CreatedDateTime | datetime | N |
| 22 | TaskStatus | int | N |
| 23 | LastUpdatedDateTime | datetime | Y |
| 24 | EndedDateTime | datetime | Y |
| 25 | EndedByUserID | varchar(250) | Y |
| 26 | EndedByUserName | nvarchar(250) | Y |
| 27 | TaskState | smallint | N |
| 28 | ActivityState | smallint | N |
| 29 | RecordStatusInvalid | tinyint | N |
| 30 | ProcessState | smallint | N |
| 31 | ComplexType | smallint | Y |
| 32 | MIHostActivityInstanceID | int | Y |
| 33 | AppInstanceCode | nvarchar(250) | Y |
| 34 | ProcessName | nvarchar(512) | N |
| 35 | CreatedByUserName | nvarchar(512) | Y |
| 36 | PCreatedDateTime | datetime | N |
| 37 | MiHostState | smallint | Y |
| 38 | Date_EndedDate | nvarchar(MAX) | Y |
| 39 | ElapsedTime | varchar(1) | N |
| 40 | AppNameTitle | nvarchar(1024) | Y |
| 41 | CreatorUserName | nvarchar(256) | Y |
| 42 | ParentProcessInstanceID | int | Y |

