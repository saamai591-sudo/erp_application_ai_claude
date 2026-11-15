CREATE PROCEDURE ACC.DeleteDcNote ( @Numbers VARCHAR(MAX) )
AS
    DECLARE @UserID INT ,
        @DeleteRelatedToUser INT ,
        @DeleteRelatedToOthers NVARCHAR(MAX),
		@UnauthorizedUsers NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();


    SELECT @DeleteRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DcNote'
		  AND AccessKey = 'DeleteRelatedToUser'
		  AND UserID = @UserID;

	SELECT @DeleteRelatedToOthers = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DcNote'
		  AND AccessKey = 'DeleteRelatedToOthers'
		  AND UserID = @UserID;

	SELECT @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DcNote'
		  AND AccessKey = 'DeleteRelatedToOthers'
		  AND UserID = @UserID;

    
		  
    IF @UserID <> -1
        AND EXISTS ( SELECT 1
                     FROM   ACC.DCNote
                            INNER JOIN CFG.R_FnCommaStr2Table(@Numbers) t ON t.value = Number
                     WHERE  NOT ( ( @DeleteRelatedToUser IS NOT NULL
                                    AND ACC.DCNote.Creator = @UserID
                                  )
                                  OR ( @DeleteRelatedToOthers IS not NULL and ACC.DCNote.Creator NOT IN ( SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst ))
                                ) )
        BEGIN
             RAISERROR('_شما به برخی از اعلامیه های انتخاب شده دسترسی ندارید.', 16, 12)
			 RETURN;
        END;
  

    DELETE  ACC.DCNote
    WHERE   Number IN ( SELECT  value
                        FROM    CFG.R_FnCommaStr2Table(@Numbers) );
