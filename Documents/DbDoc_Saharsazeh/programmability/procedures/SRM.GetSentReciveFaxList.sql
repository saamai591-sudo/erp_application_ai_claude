
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 7/18/2018 3:45:40 PM
 ************************************************************/

CREATE PROCEDURE [SRM].[GetSentReciveFaxList](@ContactId INT, @PartyId INT, @ActivityId INT)
AS
	DECLARE @UserID         INT,
	        @DateType       TINYINT,
	        @DateFormat     VARCHAR(10)
	
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
	
	
	SELECT sre.SentReciveFaxID    AS ViewModelId,
	       sre.Number,
	       3                      AS ItemType,
	       sre.SentReciveFaxID,
	       sre.IsIncoming,
	       CAST(0 AS BIT)         AS IsExternallItem,
	       u.Name                 AS UserTitle,
	       CFG.GetCLRSaturnDate(sre.ActionDate, @DateFormat, 1, @DateType) AS ActionDateString,
	       sre.Creator,
	       sre.Version
	FROM   Srm.SentReciveFax      AS sre
	       INNER JOIN CFG.[User]  AS u
	            ON  u.UserID = sre.Creator
	WHERE  (
	           (
	               (@ContactId IS NULL OR sre.ContactID = @ContactId)
	               AND @PartyId IS NULL
	           )
	           OR EXISTS (
	                  SELECT 1
	                  FROM   Srm.ItemRelatedActivity AS ira
	                         INNER JOIN SRM.Activity AS a
	                              ON  a.ActivityID = ira.ActivityID
	                  WHERE  ira.ItemType = 3
	                         AND ira.ItemID = sre.SentReciveFaxID
	                         AND (a.ContactID = @ContactId OR a.PartyID = @PartyId)
	              )
	       )
	       AND (
	               (@ActivityId = 0 OR @ActivityId = NULL)
	               OR (
	                      @ActivityId = -1
	                      AND NOT EXISTS (
	                              SELECT 1
	                              FROM   Srm.ItemRelatedActivity AS ira
	                              WHERE  ira.ItemType = 3
	                                     AND ira.ItemID = sre.SentReciveFaxID
	                          )
	                  )
	               OR EXISTS (
	                      SELECT 1
	                      FROM   Srm.ItemRelatedActivity AS ira
	                      WHERE  ira.ItemType = 3
	                             AND ira.ItemID = sre.SentReciveFaxID
	                             AND ira.ActivityID = @ActivityId
	                  )
	           )
	UNION
	SELECT esi.ExternalSrmItemID,
	       esi.[Description],
	       3,
	       esi.ExternalSrmItemID,
	       esi.IsIncoming,
	       CAST(1 AS BIT)         AS IsExternallItem,
	       u.Name                 AS UserTitle,
	       CFG.GetCLRSaturnDate(
	           CAST(esi.ActionDate AS DATETIME) + CAST(esi.ActionTime AS DATETIME),
	           @DateFormat,
	           1,
	           @DateType
	       ),
	       esi.Creator,
	       esi.Version
	FROM   srm.ExternalSrmItem    AS esi
	       INNER JOIN CFG.[User]  AS u
	            ON  u.UserID = esi.Creator
	WHERE  ContactID = @ContactId
	       AND esi.ItemType = 3
	       AND (
	               (@ActivityId = 0 OR @ActivityId = NULL)
	               OR (
	                      @ActivityId = -1
	                      AND NOT EXISTS (
	                              SELECT 1
	                              FROM   Srm.ItemRelatedActivity AS ira
	                              WHERE  ira.ItemType = 3
	                                     AND ira.ItemID = esi.ExternalSrmItemID
	                          )
	                  )
	               OR EXISTS (
	                      SELECT 1
	                      FROM   Srm.ItemRelatedActivity AS ira
	                      WHERE  ira.ItemType = 3
	                             AND ira.ItemID = esi.ExternalSrmItemID
	                             AND ira.ActivityID = @ActivityId
	                  )
	           )