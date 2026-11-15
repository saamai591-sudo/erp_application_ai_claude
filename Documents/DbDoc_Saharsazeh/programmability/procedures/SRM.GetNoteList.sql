/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 7/25/2018 1:39:29 PM
 ************************************************************/

CREATE PROCEDURE [SRM].[GetNoteList](@ContactId INT, @PartyId INT, @ActivityId INT)
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
	
	

	
	SELECT sre.NoteID,
	       sre.NoteContent,
	       SUBSTRING(sre.NoteContent, 1, 100) AS NoteContentSmall,
	       u.Name                 AS UserTitle,
	       CFG.GetCLRSaturnDate(sre.CreationDate, @DateFormat, 1, @DateType) AS ActionDateString
	FROM   Srm.Note               AS sre
	       INNER JOIN CFG.[User]  AS u
	            ON  u.UserID = sre.Creator
	WHERE  (
	           ( (@ContactId IS NULL OR sre.ContactID = @ContactId)
	            AND @PartyId IS null)
	           OR EXISTS (
	                  SELECT 1
	                  FROM   Srm.ItemRelatedActivity AS ira
	                         INNER JOIN SRM.Activity AS a
	                              ON  a.ActivityID = ira.ActivityID
	                  WHERE  ira.ItemType = 1
	                         AND ira.ItemID = sre.NoteID
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
	                              WHERE  ira.ItemType = 1
	                                     AND ira.ItemID = sre.NoteID
	                          )
	                  )
	               OR EXISTS (
	                      SELECT 1
	                      FROM   Srm.ItemRelatedActivity AS ira
	                      WHERE  ira.ItemType = 1
	                             AND ira.ItemID = sre.NoteID
	                             AND ira.ActivityID = @ActivityId
	                  )
	           )
	
