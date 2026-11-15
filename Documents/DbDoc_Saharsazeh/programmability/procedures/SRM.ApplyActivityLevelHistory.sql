/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 6/18/2018 11:09:50 AM
 ************************************************************/



CREATE PROCEDURE [SRM].[ApplyActivityLevelHistory](@ActivityId INT, @levelId INT)
AS
	DELETE Srm.ActivityLevelHistory
	WHERE  ActivityID = @ActivityId
	
	DECLARE @ActivityTypeId     INT,
	        @Order              INT,
	        @UserId             INT
	
	
	SELECT @UserId = cfg.GetuserID()
	
	SELECT @ActivityTypeId = atl.ActivityTypeID,
	       @Order = atl.LevelOrder
	FROM   Srm.ActivityTypeLevel AS atl
	WHERE  atl.ActivityTypeLevelID = @levelId
	
	
	
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
	SELECT @ActivityId,
	       atl.ActivityTypeLevelID,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE(),
	       1
	FROM   Srm.ActivityTypeLevel AS atl
	WHERE  atl.ActivityTypeID = @ActivityTypeId
	       AND atl.LevelOrder <= @Order
