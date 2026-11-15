/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 7/10/2018 3:17:39 PM
 ************************************************************/

CREATE PROCEDURE [SRM].[CompleteMeetingInfo]
(@id INT, @users VARCHAR(1024), @contacts VARCHAR(1024))
AS
	DECLARE @userId INT
	SET @userId = cfg.GetuserID()
	
	DELETE srm.MeetingUser
	WHERE  MeetingID = @id
	
	DELETE srm.MeetingContact
	WHERE  MeetingID = @id
	
	INSERT INTO srm.MeetingUser
	  (
	    -- MeetingUserID -- this column value is auto-generated
	    MeetingID,
	    UserID,
	    IsOrganizer,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT @id,
	       rfcst.[value],
	       1,
	       @userId,
	       GETDATE(),
	       @userId,
	       GETDATE(),
	       1
	FROM   cfg.R_FnCommaStr2Table(@users) AS rfcst
	
	
	
	INSERT INTO srm.MeetingContact
	  (
	    -- MeetingContactID -- this column value is auto-generated
	    MeetingID,
	    ContactID,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT @id,
	       rfcst.[value],
	       @userId,
	       GETDATE(),
	       @userId,
	       GETDATE(),
	       1
	FROM   cfg.R_FnCommaStr2Table(@contacts) AS rfcst
	
	
	
	IF EXISTS (
	       SELECT 1
	       FROM   (
	                  SELECT CAST(m.StartDate AS DATETIME) + CAST(m.StartTime AS DATETIME) AS Start1,
	                         CAST(m2.StartDate AS DATETIME) + CAST(m2.StartTime AS DATETIME) AS Start2,
	                         DATEADD(
	                             mi,
	                             m.EstimateDuration,
	                             CAST(m.StartDate AS DATETIME) +
	                             CAST(m.StartTime AS DATETIME)
	                         )            AS End1,
	                         DATEADD(
	                             mi,
	                             m2.EstimateDuration,
	                             CAST(m2.StartDate AS DATETIME) +
	                             CAST(m2.StartTime AS DATETIME)
	                         )            AS End2
	                  FROM   Srm.Meeting  AS m
	                         INNER JOIN srm.MeetingUser AS mu
	                              ON  mu.MeetingID = m.MeetingID
	                         INNER JOIN srm.MeetingUser AS mu2
	                              ON  mu2.UserID = mu.UserID
	                         INNER JOIN srm.Meeting AS m2
	                              ON  m2.MeetingID = mu2.MeetingID
	                  WHERE  m.MeetingID = @id
	                         AND m2.MeetingID <> @id
	              )T
	       WHERE  (
	                  (End2 >= Start1 AND Start2 <= End1)
	                 -- OR (End1 >= Start2 AND Start1 <= End2)
	              )
	   )
	BEGIN
	    RAISERROR(
	        'StrategicRelationshipManagement.Meeting_Overlap',
	        16,
	        12
	    );
	    RETURN
	END
