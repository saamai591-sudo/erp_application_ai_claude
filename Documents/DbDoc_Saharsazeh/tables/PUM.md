# Schema `PUM`

## Tables

### PUM.InternalUser

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | InternalUserID | int | N |  | identity |
| 2 | PortalUserID | int | Y |  |  |
| 3 | ParentUserID | int | Y |  |  |
| 4 | Title | nvarchar(256) | N |  |  |
| 5 | MobileNumber | nvarchar(50) | Y |  |  |
| 6 | PhoneNumber | nvarchar(50) | Y |  |  |
| 7 | Email | nvarchar(320) | Y |  |  |
| 8 | Username | nvarchar(256) | N |  |  |
| 9 | Password | nvarchar(512) | N |  |  |
| 10 | DataHash | nvarchar(512) | N |  |  |
| 11 | IsActive | bit | N |  |  |
| 12 | CreationDate | datetime | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |
| 14 | InternalCallNumber | nvarchar(10) | Y |  |  |

- **Primary key:** InternalUserID
- **FK** `FK_InternalUser_PortalUser` (PortalUserID) -> PUM.PortalUser (PortalUserId)
- **Referenced by:** PUM.Ticket (Creator); PUM.Ticket (Terminator); PUM.TicketAnswer (InternalUserID)

### PUM.PortalUser

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | PortalUserId | int | N |  | identity |
| 2 | Username | nvarchar(256) | N |  |  |
| 3 | Password | nvarchar(512) | N |  |  |
| 4 | PartyID | bigint | N |  |  |
| 5 | Name | nvarchar(256) | N |  |  |
| 6 | Mobile | nvarchar(50) | N |  |  |
| 7 | DataHash | nvarchar(512) | N |  |  |
| 8 | IsActive | bit | N |  |  |
| 9 | Version | int | N |  |  |
| 10 | Creator | int | N |  |  |
| 11 | CreationDate | datetime | N |  |  |
| 12 | LastEditor | int | N |  |  |
| 13 | LastEditionDate | datetime | N |  |  |

- **Primary key:** PortalUserId
- **FK** `FK_PortalUser_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_PortalUser_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_PortalUser_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** PUM.InternalUser (PortalUserID)

### PUM.Survey

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SurveyID | int | N |  | identity |
| 2 | TicketID | int | N |  |  |
| 3 | Point | tinyint | N |  |  |
| 4 | Description | nvarchar(MAX) | Y |  |  |
| 5 | CreationDate | datetime | N |  |  |

- **Primary key:** SurveyID
- **FK** `FK_Survey_Ticket` (TicketID) -> PUM.Ticket (TicketID)
- **Referenced by:** PUM.SurveyAnswer (SurveyID)

### PUM.SurveyAnswer

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SurveyAnswerID | int | N |  | identity |
| 2 | SurveyID | int | N |  |  |
| 3 | SurveyDesignItemID | int | N |  |  |
| 4 | IsPositive | bit | Y |  |  |
| 5 | CreationDate | datetime | N |  |  |

- **Primary key:** SurveyAnswerID
- **FK** `FK_SurveyAnswer_Survey` (SurveyID) -> PUM.Survey (SurveyID)
- **FK** `FK_SurveyAnswer_SurveyDesignItem` (SurveyDesignItemID) -> PUM.SurveyDesignItem (SurveyDesignItemID)

### PUM.SurveyDesign

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SurveyDesignID | int | N |  | identity |
| 2 | EntityID | int | N |  |  |
| 3 | IsActive | bit | N |  |  |
| 4 | Version | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SurveyDesignID
- **FK** `FK_SurveyDesign_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SurveyDesign_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SurveyDesign_DMDEntity` (EntityID) -> MDT.DmdEntity (ID)
- **Referenced by:** PUM.SurveyDesignItem (SurveyDesignID)

### PUM.SurveyDesignItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SurveyDesignItemID | int | N |  | identity |
| 2 | SurveyDesignID | int | N |  |  |
| 3 | RowIndex | tinyint | N |  |  |
| 4 | Question1 | nvarchar(256) | N |  |  |
| 5 | Question2 | nvarchar(256) | N |  |  |
| 6 | Mandatory | bit | N |  |  |
| 7 | Version | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |

- **Primary key:** SurveyDesignItemID
- **FK** `FK_SurveyDesignItem_SurveyDesign` (SurveyDesignID) -> PUM.SurveyDesign (SurveyDesignID) on delete CASCADE
- **FK** `FK_SurveyDesignItem_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SurveyDesignItem_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PUM.SurveyAnswer (SurveyDesignItemID)

### PUM.Ticket

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TicketID | int | N |  | identity |
| 2 | TicketTypeID | int | N |  |  |
| 3 | Subject | nvarchar(150) | N |  |  |
| 4 | Description | nvarchar(MAX) | N |  |  |
| 5 | ExpertID | int | Y |  |  |
| 6 | Status | smallint | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | Terminator | int | Y |  |  |
| 10 | TerminationDate | datetime | Y |  |  |
| 11 | TicketStatusID | int | N |  |  |

- **Primary key:** TicketID
- **FK** `FK_Ticket_TicketStatus` (TicketStatusID) -> PUM.TicketStatus (TicketStatusId)
- **FK** `FK_Ticket_InternalUser_Creator` (Creator) -> PUM.InternalUser (InternalUserID)
- **FK** `FK_Ticket_InternalUser_Terminator` (Terminator) -> PUM.InternalUser (InternalUserID)
- **FK** `FK_Ticket_User` (ExpertID) -> CFG.User (UserID)
- **FK** `FK_Ticket_TicketType` (TicketTypeID) -> PUM.TicketType (TicketTypeId)
- **Referenced by:** PUM.Survey (TicketID); PUM.TicketAnswer (TicketID); PUM.TicketAssign (TicketID)

### PUM.TicketAnswer

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TicketAnswerID | int | N |  | identity |
| 2 | TicketID | int | N |  |  |
| 3 | Action | int | N |  |  |
| 4 | ExpertID | int | Y |  |  |
| 5 | InternalUserID | int | Y |  |  |
| 6 | Content | nvarchar(MAX) | N |  |  |
| 7 | CreationDate | datetime | N |  |  |

- **Primary key:** TicketAnswerID
- **FK** `FK_TicketAnswer_Ticket` (TicketID) -> PUM.Ticket (TicketID)
- **FK** `FK_TicketAnswer_User` (ExpertID) -> CFG.User (UserID)
- **FK** `FK_TicketAnswer_InternalUser` (InternalUserID) -> PUM.InternalUser (InternalUserID)

### PUM.TicketAssign

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TicketAssignID | int | N |  | identity |
| 2 | TicketID | int | N |  |  |
| 3 | Action | int | N |  |  |
| 4 | From | int | N |  |  |
| 5 | To | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |

- **Primary key:** TicketAssignID
- **FK** `FK_TicketAssign_Ticket` (TicketID) -> PUM.Ticket (TicketID)
- **FK** `FK_TicketAssign_User_From` (From) -> CFG.User (UserID)
- **FK** `FK_TicketAssign_User_To` (To) -> CFG.User (UserID)

### PUM.TicketStatus

Rows: 1

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TicketStatusId | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | IsActive | bit | N |  |  |
| 5 | Version | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TicketStatusId
- **FK** `FK_TicketStatus_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TicketStatus_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PUM.Ticket (TicketStatusID)

### PUM.TicketType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TicketTypeId | int | N |  | identity |
| 2 | Code | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(50) | N |  |  |
| 5 | IsActive | bit | N |  |  |
| 6 | Version | int | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |

- **Primary key:** TicketTypeId
- **FK** `FK_TicketType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_TicketType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** PUM.Ticket (TicketTypeID)

## Views

### PUM.vwTicketTypeAccess

Definition: `programmability/views/PUM.vwTicketTypeAccess.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserId | int | Y |
| 2 | TicketTypeId | int | N |

### PUM.vwTicketTypeExpert

Definition: `programmability/views/PUM.vwTicketTypeExpert.sql`

| # | Column | Type | Null |
|---|---|---|---|
| 1 | UserID | int | N |
| 2 | Name | nvarchar(512) | N |
| 3 | Name2 | nvarchar(512) | N |
| 4 | Username | nvarchar(256) | N |
| 5 | TicketTypeId | int | N |

