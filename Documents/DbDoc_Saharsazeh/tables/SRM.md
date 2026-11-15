# Schema `SRM`

## Tables

### SRM.Activity

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | ActivityTypeID | int | N |  |  |
| 5 | PartyID | bigint | N |  | اگر مخاطب دارای طرف حساب باشد فیلد طرف حساب فعالیت با طرف حساب مخاطب پر خواهد شد و غیر قابل ویرایش خواهد بود در غیر اینصورت کاربر مقدار طرف حساب را وارد خواهد کرد و انتخاب آن اجباریست.   |
| 6 | ContactID | int | N |  |  |
| 7 | EndDate | datetime | Y |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ActivityID
- **FK** `FK_Activity_ActivityType` (ActivityTypeID) -> SRM.ActivityType (ActivityTypeID)
- **FK** `FK_Activity_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_Activity_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Activity_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Activity_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** SRM.ActivityLevelHistory (ActivityID); SRM.ItemRelatedActivity (ActivityID)

### SRM.ActivityLevelHistory

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityLevelHistoryID | int | N |  | identity |
| 2 | ActivityID | int | N |  |  |
| 3 | ActivityTypeLevelID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ActivityLevelHistoryID
- **FK** `FK_ActivityLevelHistory_Activity` (ActivityID) -> SRM.Activity (ActivityID)
- **FK** `FK_ActivityLevelHistory_ActivityTypeLevel` (ActivityTypeLevelID) -> SRM.ActivityTypeLevel (ActivityTypeLevelID)
- **FK** `FK_ActivityLevelHistory_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ActivityLevelHistory_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.ActivityType

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityTypeID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Title2 | nvarchar(256) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** ActivityTypeID
- **FK** `FK_ActivityType_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ActivityType_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** SRM.Activity (ActivityTypeID); SRM.ActivityTypeLevel (ActivityTypeID)

### SRM.ActivityTypeLevel

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ActivityTypeLevelID | int | N |  | identity |
| 2 | ActivityTypeID | int | N |  |  |
| 3 | Title | nvarchar(256) | N |  |  |
| 4 | Title2 | nvarchar(256) | N |  |  |
| 5 | LevelOrder | int | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ActivityTypeLevelID
- **FK** `FK_ActivityTypeLevel_ActivityType` (ActivityTypeID) -> SRM.ActivityType (ActivityTypeID) on delete CASCADE
- **FK** `FK_ActivityTypeLevel_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ActivityTypeLevel_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** SRM.ActivityLevelHistory (ActivityTypeLevelID)

### SRM.Call

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | CallID | int | N |  | identity |
| 2 | ContactID | int | Y |  |  |
| 3 | Description | nvarchar(MAX) | Y |  |  |
| 4 | Number | varchar(50) | N |  |  |
| 5 | CallDate | datetime | Y |  |  |
| 6 | IsIncoming | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** CallID
- **FK** `FK_Call_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_Call_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Call_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.Contact

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContactID | int | N |  | identity |
| 2 | Name | nvarchar(256) | N |  |  |
| 3 | PhoneNumber | nvarchar(50) | N |  |  |
| 4 | JobPosition | nvarchar(256) | Y |  |  |
| 5 | Email | varchar(50) | Y |  |  |
| 6 | PartyID | bigint | Y |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** ContactID
- **FK** `FK_Contact_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Contact_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_Contact_Party` (PartyID) -> CFG.Party (PartyID)
- **Referenced by:** SRM.Activity (ContactID); SRM.Call (ContactID); SRM.ContactNumber (ContactID); SRM.ExternalSrmItem (ContactID); SRM.MeetingContact (ContactID); SRM.Note (ContactID); SRM.SentReciveEmail (ContactID); SRM.SentReciveFax (ContactID); SRM.SentReciveSms (ContactID)

### SRM.ContactNumber

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ContactNumberID | int | N |  | identity |
| 2 | ContactID | int | N |  |  |
| 3 | Number | varchar(50) | N |  |  |
| 4 | NumberType | tinyint | N |  | 3-Fix 4-Call 5-Sms |
| 5 | IsLastUsed | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** ContactNumberID
- **FK** `FK_ContactNumber_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_ContactNumber_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ContactNumber_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.ExternalSrmItem

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ExternalSrmItemID | int | N |  | identity |
| 2 | ItemType | tinyint | N |  |  |
| 3 | ActionDate | datetime | N |  |  |
| 4 | ContactID | int | Y |  |  |
| 5 | Description | nvarchar(MAX) | N |  |  |
| 6 | IsIncoming | bit | N |  |  |
| 7 | ActionTime | time(7) | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** ExternalSrmItemID
- **FK** `FK_ExternalSrmItem_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_ExternalSrmItem_User` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_ExternalSrmItem_User1` (Creator) -> CFG.User (UserID)

### SRM.ItemRelatedActivity

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | ItemRelatedActivityID | int | N |  | identity |
| 2 | ItemID | int | N |  |  |
| 3 | ItemType | tinyint | N |  | 1-Note 2-SendEmail 3-SentFax 4-call 5-SMS 6-Task 7-Meeting 8-ExternalItem |
| 4 | ActivityID | int | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** ItemRelatedActivityID
- **FK** `FK_ItemRelatedActivity_Activity` (ActivityID) -> SRM.Activity (ActivityID)
- **FK** `FK_ItemRelatedActivity_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_ItemRelatedActivity_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.Meeting

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MeetingID | int | N |  | identity |
| 2 | Subject | nvarchar(512) | N |  |  |
| 3 | Description | nvarchar(MAX) | N |  |  |
| 4 | StartDate | date | N |  |  |
| 5 | StartTime | time(7) | N |  |  |
| 6 | CancelDate | datetime | Y |  |  |
| 7 | EstimateDuration | int | N |  |  |
| 8 | Creator | int | N |  |  |
| 9 | CreationDate | datetime | N |  |  |
| 10 | LastEditor | int | N |  |  |
| 11 | LastEditionDate | datetime | N |  |  |
| 12 | Version | int | N |  |  |

- **Primary key:** MeetingID
- **FK** `FK_Meeting_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Meeting_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** SRM.MeetingContact (MeetingID); SRM.MeetingUser (MeetingID)

### SRM.MeetingContact

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MeetingContactID | int | N |  | identity |
| 2 | MeetingID | int | N |  |  |
| 3 | ContactID | int | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** MeetingContactID
- **FK** `FK_MettingContact_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_MettingContact_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MettingContact_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MettingContact_Meeting` (MeetingID) -> SRM.Meeting (MeetingID) on delete CASCADE

### SRM.MeetingUser

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | MeetingUserID | int | N |  | identity |
| 2 | MeetingID | int | N |  |  |
| 3 | UserID | int | N |  |  |
| 4 | IsOrganizer | bit | N |  |  |
| 5 | Creator | int | N |  |  |
| 6 | CreationDate | datetime | N |  |  |
| 7 | LastEditor | int | N |  |  |
| 8 | LastEditionDate | datetime | N |  |  |
| 9 | Version | int | N |  |  |

- **Primary key:** MeetingUserID
- **FK** `FK_MeetingUser_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_MeetingUser_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_MeetingUser_Meeting` (MeetingID) -> SRM.Meeting (MeetingID) on delete CASCADE

### SRM.Note

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | NoteID | int | N |  | identity |
| 2 | ContactID | int | Y |  |  |
| 3 | NoteContent | nvarchar(MAX) | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |

- **Primary key:** NoteID
- **FK** `FK_Note_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_Note_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Note_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.SentReciveEmail

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SentReciveEmailID | int | N |  | identity |
| 2 | UserEmailID | int | N |  |  |
| 3 | ContactEmail | varchar(50) | N |  |  |
| 4 | ContactID | int | Y |  |  |
| 5 | EmailContent | nvarchar(MAX) | N |  |  |
| 6 | UserSignatureID | int | Y |  |  |
| 7 | Subject | nvarchar(512) | N |  |  |
| 8 | ActionDate | datetime | Y |  |  |
| 9 | IsIncoming | bit | N |  |  |
| 10 | CC | varchar(1024) | Y |  |  |
| 11 | BCC | varchar(1024) | Y |  |  |
| 12 | Creator | int | N |  |  |
| 13 | CreationDate | datetime | N |  |  |
| 14 | LastEditor | int | N |  |  |
| 15 | LastEditionDate | datetime | N |  |  |
| 16 | Version | int | N |  |  |

- **Primary key:** SentReciveEmailID
- **FK** `FK_SentReciveEmail_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_SentReciveEmail_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SentReciveEmail_LastEditor` (LastEditor) -> CFG.User (UserID)
- **FK** `FK_SentReciveEmail_UserEmail` (UserEmailID) -> SRM.UserEmail (UserEmailID)
- **FK** `FK_SentReciveEmail_UserSignature` (UserSignatureID) -> CFG.UserSignature (UserSignatureID)

### SRM.SentReciveFax

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SentReciveFaxID | int | N |  | identity |
| 2 | ContactID | int | Y |  |  |
| 3 | Description | nvarchar(MAX) | Y |  |  |
| 4 | Number | varchar(50) | N |  |  |
| 5 | ActionDate | datetime | Y |  |  |
| 6 | IsIncoming | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** SentReciveFaxID
- **FK** `FK_SentReciveFax_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_SentReciveFax_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SentReciveFax_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.SentReciveSms

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SentReciveSmsID | int | N |  | identity |
| 2 | ContactID | int | Y |  |  |
| 3 | Description | nvarchar(MAX) | Y |  |  |
| 4 | Number | varchar(50) | N |  |  |
| 5 | ActionDate | datetime | Y |  |  |
| 6 | IsIncoming | bit | N |  |  |
| 7 | Creator | int | N |  |  |
| 8 | CreationDate | datetime | N |  |  |
| 9 | LastEditor | int | N |  |  |
| 10 | LastEditionDate | datetime | N |  |  |
| 11 | Version | int | N |  |  |

- **Primary key:** SentReciveSmsID
- **FK** `FK_SentReciveSms_Contact` (ContactID) -> SRM.Contact (ContactID)
- **FK** `FK_SentReciveSms_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SentReciveSms_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.SrmDocAttachement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SrmDocAttachementID | int | N |  | identity |
| 2 | ItemID | int | N |  |  |
| 3 | ItemType | tinyint | N |  |  |
| 4 | EngName | varchar(50) | N |  |  |
| 5 | EntityId | bigint | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** SrmDocAttachementID
- **FK** `FK_SrmDocAttachement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SrmDocAttachement_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.SrmFileAttachement

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | SrmFileAttachementID | int | N |  | identity |
| 2 | ItemID | int | N |  |  |
| 3 | ItemType | tinyint | N |  |  |
| 4 | Creator | int | N |  |  |
| 5 | CreationDate | datetime | N |  |  |
| 6 | LastEditor | int | N |  |  |
| 7 | LastEditionDate | datetime | N |  |  |
| 8 | Version | int | N |  |  |
| 9 | FileItemID | int | N |  |  |

- **Primary key:** SrmFileAttachementID
- **FK** `FK_SrmFileAttachement_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_SrmFileAttachement_FileItem` (FileItemID) -> CFG.FileItem (FileItemID)
- **FK** `FK_SrmFileAttachement_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.Task

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | TaskID | int | N |  | identity |
| 2 | Title | nvarchar(256) | N |  |  |
| 3 | Description | nvarchar(MAX) | N |  |  |
| 4 | State | tinyint | N |  | 0-شروع نشده اند 1-در جریان هستند 2-متوقف شده اند 3-تکمیل شده اند 4-به آینده موکول شده اند |
| 5 | TaskType | tinyint | N |  | 1-اقدام 2-ایمیل 3-تماس |
| 6 | Assignee | int | N |  |  |
| 7 | TaskDate | date | N |  |  |
| 8 | TaskTime | time(7) | N |  |  |
| 9 | RemindDate | datetime | Y |  |  |
| 10 | RemindTime | time(7) | Y |  |  |
| 11 | RemindByEmail | bit | N |  |  |
| 12 | RemindBySms | bit | N |  |  |
| 13 | Creator | int | N |  |  |
| 14 | CreationDate | datetime | N |  |  |
| 15 | LastEditor | int | N |  |  |
| 16 | LastEditionDate | datetime | N |  |  |
| 17 | Version | int | N |  |  |

- **Primary key:** TaskID
- **FK** `FK_Task_AssigneeUser` (Assignee) -> CFG.User (UserID)
- **FK** `FK_Task_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_Task_LastEditor` (LastEditor) -> CFG.User (UserID)

### SRM.UserEmail

Rows: 0

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | UserEmailID | int | N |  | identity |
| 2 | UserID | int | N |  |  |
| 3 | Email | varchar(50) | N |  |  |
| 4 | EmailInfo | nvarchar(MAX) | Y |  |  |
| 5 | IsLastUsed | bit | N |  |  |
| 6 | Creator | int | N |  |  |
| 7 | CreationDate | datetime | N |  |  |
| 8 | LastEditor | int | N |  |  |
| 9 | LastEditionDate | datetime | N |  |  |
| 10 | Version | int | N |  |  |

- **Primary key:** UserEmailID
- **FK** `FK_UserEmail_Creator` (Creator) -> CFG.User (UserID)
- **FK** `FK_UserEmail_LastEditor` (LastEditor) -> CFG.User (UserID)
- **Referenced by:** SRM.SentReciveEmail (UserEmailID)

