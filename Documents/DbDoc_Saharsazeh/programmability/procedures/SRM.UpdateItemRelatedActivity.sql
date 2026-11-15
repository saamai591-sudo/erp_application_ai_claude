/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 6/19/2018 11:47:56 AM
 ************************************************************/

CREATE PROCEDURE [SRM].[UpdateItemRelatedActivity](
    @ItemId       INT,
    @ItemType     INT,
    @Info         VARCHAR(MAX),
    @TaskId       INT = NULL
)
AS
	DECLARE @UserId INT
	SET @UserId = cfg.GetuserID()
	DELETE Srm.ItemRelatedActivity
	WHERE  ItemID = @ItemId
	       AND ItemType = @ItemType
	
	
	SELECT cfg.GetStringPartBySpliter(VALUE, 1, '#') AS ActivityId,
	       cfg.GetStringPartBySpliter(VALUE, 2, '#') AS LastLevel,
	       cfg.GetStringPartBySpliter(VALUE, 3, '#') AS Ended,
	       atl.LevelOrder
	INTO   #T
	FROM   cfg.R_FnCommaStr2Table(@Info) AS rfcst
	       LEFT JOIN Srm.ActivityTypeLevel AS atl
	            ON  atl.ActivityTypeLevelID = cfg.GetStringPartBySpliter(VALUE, 2, '#')
	
	
	
	INSERT INTO SRm.ItemRelatedActivity
	  (
	    -- ItemRelatedActivityID -- this column value is auto-generated
	    ItemID,
	    ItemType,
	    ActivityID,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT @ItemId,
	       @ItemType,
	       ActivityId,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       1
	FROM   #T
	
	
	IF @TaskId IS NOT null
	INSERT INTO SRm.ItemRelatedActivity
	  (
	    -- ItemRelatedActivityID -- this column value is auto-generated
	    ItemID,
	    ItemType,
	    ActivityID,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT @taskId,
	       6,
	       ActivityId,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       1
	FROM   #T
	
	
	UPDATE SRM.Activity
	SET    EndDate = GETDATE()
	FROM   SRM.Activity
	       INNER JOIN #T
	            ON  SRM.Activity.ActivityID = #T.ActivityID
	WHERE  #T.Ended = 1
	
	
	DELETE Srm.ActivityLevelHistory
	FROM   Srm.ActivityLevelHistory
	       INNER JOIN #T
	            ON  Srm.ActivityLevelHistory.ActivityID = #T.ActivityId
	WHERE  lastLevel <> -1
	
	
	INSERT INTO SRm.ActivityLevelHistory
	  (
	    ActivityID,
	    ActivityTypeLevelID,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate,
	    Version
	  )
	SELECT a.ActivityID,
	       atl.ActivityTypeLevelID,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       1
	FROM   #T
	       INNER JOIN Srm.Activity      AS a
	            ON  a.ActivityID = #T.ActivityID
	       INNER JOIN SRM.ActivityType  AS at
	            ON  at.ActivityTypeID = a.ActivityTypeID
	       INNER JOIN Srm.ActivityTypeLevel AS atl
	            ON  at.ActivityTypeID = atl.ActivityTypeID
	            AND atl.LevelOrder <= #t.LevelOrder
	WHERE  #T.LastLevel <> -1
	
	
	
	
	
