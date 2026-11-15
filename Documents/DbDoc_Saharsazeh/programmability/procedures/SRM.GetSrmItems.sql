
CREATE PROCEDURE [SRM].[GetSrmItems](@contactId INT, @PartyId INT, @ActivityId INT)
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10)
	
	SET @UserID = cfg.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE cfg.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'  
	
	
	SELECT *,
	       u.Name                 AS UserTitle,
	       CFG.GetCLRSaturnDate(t.CreationDate, @DateFormat, 0, @DateType) AS ItemDate,
	       CASE IsInComing
	            WHEN 0 THEN N'خروجی'
	            ELSE N'ورودی'
	       END                    AS IsIncomingTitle
	FROM   (
	           SELECT n.NoteID        AS Id,
	                  1               AS ItemType,
	                  CAST(N'یادداشت' AS NVARCHAR(256)) AS ItemTypeTitle,
	                  n.Creator,
	                  n.Version,
	                  CAST(0 AS BIT)  AS IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.Note        AS n
	           UNION
	           SELECT n.SentReciveEmailID,
	                  2,
	                  N'ایمیل',
	                  n.Creator,
	                  n.Version,
	                  n.IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.SentReciveEmail AS n
	           UNION
	           SELECT n.SentReciveFaxID,
	                  3,
	                  N'فاکس',
	                  n.Creator,
	                  n.Version,
	                  n.IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.SentReciveFax AS n
	           UNION
	           SELECT n.CallID,
	                  4,
	                  N'تماس',
	                  n.Creator,
	                  n.Version,
	                  n.IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.Call AS n
	           UNION
	           SELECT n.SentReciveSmsID,
	                  5,
	                  N'Sms',
	                  n.Creator,
	                  n.Version,
	                  n.IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.SentReciveSms AS n
	            UNION
	           SELECT n.ExternalSrmItemID,
	                  8,
	                  N'ثبت وقایع' + ' - ' + CASE n.ItemType WHEN 2 THEN N'ایمیل'
	                  
	                  WHEN 2 THEN N'ایمیل'
	                  WHEN 3 THEN N'فاکس'
	                  WHEN 4 THEN N'تماس'
	                  WHEN 5 THEN N'Sms'
	                   ELSE '' END ,
	                  n.Creator,
	                  n.Version,
	                  n.IsIncoming,
	                  n.CreationDate,
	                  n.ContactID
	           FROM   srm.ExternalSrmItem  AS n
	           
	       )T
	       INNER JOIN cfg.[User]  AS u
	            ON  u.UserID = T.Creator
	WHERE  ( ( (@ContactId IS NULL OR ContactID = @ContactId)
	            AND @PartyId IS null)
	  OR EXISTS (
	                  SELECT 1
	                  FROM   Srm.ItemRelatedActivity AS ira
	                         INNER JOIN SRM.Activity AS a
	                              ON  a.ActivityID = ira.ActivityID
	                  WHERE  ira.ItemType = T.ItemType
	                         AND ira.ItemID = T.Id
	                         AND (a.ContactID = @ContactId OR a.PartyID = @PartyId)
	              )
	)
	       AND (
	               @ActivityId = 0
	               OR @ActivityId IS NULL
	               OR (
	                      @ActivityId = -1
	                      AND NOT EXISTS (
	                              SELECT 1
	                              FROM   Srm.ItemRelatedActivity AS ira
	                              WHERE  ira.ItemType = T.ItemType
	                                     AND ira.ItemID = T.Id
	                          )
	                  )
	               OR (
	                      @ActivityId <> -1
	                      AND @ActivityId <> 0
	                      AND EXISTS (
	                              SELECT 1
	                              FROM   Srm.ItemRelatedActivity AS ira
	                              WHERE  ira.ItemType = T.ItemType
	                                     AND ira.ItemID = T.Id
	                                     AND ira.ActivityID = @ActivityId
	                          )
	                  )
	           )
	ORDER BY
	       T.CreationDate DESC
