----------------------------------------------
CREATE   PROCEDURE [HRM].GetConfirmationList
(
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION 
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @DateFormat              VARCHAR(10),
			@CultureInfo  VARCHAR(10),
			@CultureNo VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID = cfg.GetuserID()
	set @CultureInfo = cfg.GetuserCulture()

	select @CultureNo = CultureNo 
	from cfg.CultureInfo
	where Culture = @CultureInfo

	DROP TABLE IF EXISTS #vwEnum

	SELECT * into #vwEnum 
	FROM   cfg.VwEnums AS ve
	WHERE ve.Enum IN( 'Status')

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @CultureInfo
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
	
	SELECT @ViewRelatedToUser = UserID
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'Confirmation'
		   AND AccessKey = 'ViewRelatedToUser'
	       AND UserID = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'Confirmation'
		   AND AccessKey = 'ViewRelatedToOthers'
	       AND UserID = @UserID
	
	IF @Sort IS NULL OR @Sort = ''
	    SET @Sort = 'Number '
	
	SET @Sort=REPLACE(@Sort,'CreateDateString','[CreationDate]')
	SET @Sort=REPLACE(@Sort,'EditionDateString','[LastEditionDate]')
	SET @Sort=REPLACE(@Sort,'IssueDateString','[IssueDate]')
	SET @Sort=REPLACE(@Sort,'CloseDateString','[CloseDate]')

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = N'WITH Query_Result 
			As (
			SELECT
			   C.ConfirmationID, 
			   C.ConfirmationTypeID,
			   CASE WHEN '+@CultureNo+' = 1 THEN CF.Title ELSE CF.Title2 END ConfirmationFormTitle, 
			   CASE WHEN '+@CultureNo+' = 1 THEN CT.Title ELSE CT.Title2 END ConfirmationTypeTitle, 
			   P.Code PersonelCode,
			   CASE WHEN '+@CultureNo+' = 1 THEN PA.Title+'' ''+PA.LASTNAME ELSE PA.Title2+'' ''+PA.LASTNAME2 END PersonelName,
			   ves.Value AS ConfirmationStatusString,
			   C.ConfirmationRequestID,
			   CR.Number ConfirmationRequestNumber,
			   CAST(CASE WHEN C.ConfirmationRequestID IS NULL THEN 1 ELSE 2 END AS TINYINT) BaseType,
			   CASE WHEN C.ConfirmationRequestID IS NULL
			        THEN CASE WHEN '+@CultureNo+' = 1 THEN N''بدون مبنا'' ELSE N''Without Base'' END
			        ELSE CASE WHEN '+@CultureNo+' = 1 THEN N''درخواست صدور گواهی'' ELSE N''Confirmation Request'' END
			   END BaseTypeString,
			   C.Number, 
			   C.PersonelID, 
			   C.IssueDate, 
			   CFG.GetCLRSaturnDate(C.IssueDate,@DateFormat  , 0,@DateType)AS IssueDateString,
			   C.CloseDate, 
			   CFG.GetCLRSaturnDate(C.CloseDate,@DateFormat  , 0,@DateType)AS CloseDateString,
			   C.Reciver, 
			   C.ReciverPerson, 
			   C.[Description] , 
			   C.Creator, 
			   C.CreationDate, 
			   c.LastEditor,
			   C.LastEditionDate,
			   C.[Version],
			   C.Amount ,
			   c.InstallmentAmount,
			   c.Value1,
			   c.Value2,
			   c.Value3,
			   c.CloseType,
			   CFG.GetCLRSaturnDate(C.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
			   CFG.GetCLRSaturnDate(C.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
			   u.Name AS CreatorUserName, 
			   u2.Name AS EditorName        
		FROM hrm.Confirmation C
			JOIN HRM.ConfirmationType CT ON C.ConfirmationTypeID = CT.ConfirmationTypeID
			JOIN HRM.ConfirmationForm CF ON CF.ConfirmationFormID = CT.ConfirmationFormID
			LEFT JOIN REQ.ConfirmationRequest CR ON CR.ConfirmationRequestID = C.ConfirmationRequestID
			LEFT join #vwEnum ves on c.ConfirmationStatus = ves.KeyValue and ves.Enum= ''Status''
			JOIN HRM.Personel P ON P.PersonelID = C.PersonelID
			JOIN CFG.Party PA ON PA.PartyID = P.PartyID
			JOIN CFG.[User] AS u ON u.UserID = C.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = C.LastEditor
		WHERE  (@UserID = -1 
			or  (@ViewRelatedToUser is not null and C.Creator = @UserID)
			or  (@ViewRelatedToOthers IS NOT NULL AND C.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)))	
		)'
	
	
	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	
	
	SET @Query = Cfg.ApplyPaging (
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    )
	PRINT @Query
	
	EXECUTE sp_executesql @Query,
	     N' @dateFormat varchar(10),
			@dateType int,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers	 NVARCHAR(MAX),
			@UserID int,
			@ViewRelatedToUser int',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID

	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName + ' order by _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)


