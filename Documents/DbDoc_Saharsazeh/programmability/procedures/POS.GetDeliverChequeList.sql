
-------------------------------------
CREATE   PROCEDURE POS.GetDeliverChequeList
(
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
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
	WHERE  EntityName = 'DeliverCheque'
		   AND AccessKey = 'ViewRelatedToUser'
	       AND UserID = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'DeliverCheque'
		   AND AccessKey = 'ViewRelatedToOthers'
	       AND UserID = @UserID
	
	IF @Sort IS NULL  OR @Sort = ''
	    SET @Sort = 'Number Desc'
	
	SET @Sort=REPLACE(@Sort,'CreateDateString','[CreationDate]')
	SET @Sort=REPLACE(@Sort,'EditionDateString','[LastEditionDate]')
	SET @Sort=REPLACE(@Sort,'DateString','[Date]')

	DECLARE @Submit  NVARCHAR(MAX)   
	select @Submit = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'Statuses'
	and L.Item = 'Submit'
	and LV.Culture = CFG.GetuserCulture()

	DECLARE @ReceiveReceipt  NVARCHAR(MAX)   
	select @ReceiveReceipt = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'DocumentNumTypes'
	and L.Item = 'ReceiveReceipt'
	and LV.Culture = CFG.GetuserCulture()

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = N'WITH Query_Result As 
		(SELECT 
			   v.DeliverChequeID, 
			   v.Number, 
			   v.[Date], 
			   v.Creator, 
			   v.CreationDate, 
			   v.LastEditionDate,
			   v.[Version],
			   case when '+@CultureNo+' = 1 then dl.Title else dl.Title2 end CashTitle , 
			   dl.code CashCode,
			   CFG.GetCLRSaturnDate(v.[Date],@DateFormat  , 0,@DateType)AS DateString,
			   CFG.GetCLRSaturnDate(v.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
			   CFG.GetCLRSaturnDate(v.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
			   u.Name AS CreatorUserName, 
			   u2.Name AS EditorName ,
			   case when '+@CultureNo+' = 1 then s.Title+'' ''+ss.Title else s.Title2+'' ''+ss.Title2 end StationShiftTitle,
			   case 
					when exists (
						select 1 
						from fin.ReceiveReceipt rr 
						where rr.DeliverChequeID = v.DeliverChequeID
					) 
					then cast(1 as bit)
					else cast(0 as bit)
				end as HasReceiveReceipt,
				case 
					when exists (
						select 1 
						from fin.ReceiveReceipt rr 
						where rr.DeliverChequeID = v.DeliverChequeID
					) 
					then @ReceiveReceipt 
					else @Submit 
				end as StateString

		FROM pos.DeliverCheque v
			JOIN CFG.[User] AS u ON u.UserID = v.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = v.LastEditor
			Join cfg.Cash c on c.cashid = v.Cashid
			join acc.dl on dl.dlid = c.dlid
			join pos.StationShift ss on ss.StationShiftID = v.StationShiftID
			join pos.Station s on s.StationID = ss.StationID
		WHERE  (@UserID = -1 
			or  (@ViewRelatedToUser is not null and v.Creator = @UserID)
			or  (@ViewRelatedToOthers IS NOT NULL AND v.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)))	
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
			@ViewRelatedToUser int,
			@ReceiveReceipt NVARCHAR(MAX),
			@Submit NVARCHAR(MAX)',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @UserID = @UserID,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
		 @ReceiveReceipt = @ReceiveReceipt,
		 @Submit = @Submit
	
	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' order by _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
