
--------------------------------------------------------------------------
CREATE    PROCEDURE [ACC].GetSLs
--WITH ENCRYPTION
AS
	declare @Query  AS NVARCHAR(MAX),		
		    @Columns AS NVARCHAR(MAX),
		    @ColumnsInSelectList AS NVARCHAR(MAX),
		    @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Culture VARCHAR(10),
			@CultureNo tinyint
	
	SET  @UserID=cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'
		
		
	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(AccountLevelID) 
									FROM acc.AccountLevel
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
	if(@Columns is null)
	set @Columns = '[-1]'	
					   
	select @ColumnsInSelectList = STUFF((SELECT DISTINCT ',' 
									+ QUOTENAME(AccountLevelID) + ' AS T'+ CAST(AccountLevelID AS Varchar(10))
									FROM acc.AccountLevel where AccountLevelTypeID = 1
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,0,'')
	
	select @ColumnsInSelectList = @ColumnsInSelectList + isnull(STUFF((SELECT DISTINCT ',' +
									'case when '+ QUOTENAME(AccountLevelID) +' is null then cast(0 as bit) else cast(1 as bit) end'
									 + ' AS T'+ CAST(AccountLevelID AS Varchar(10))
									FROM acc.AccountLevel where AccountLevelTypeID <> 1
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,0,'') , '')
								   							   
	IF(@ColumnsInSelectList is null)
	SET @ColumnsInSelectList = ''							   
	
	SET @Query = N'
	
		SELECT			   v.GlCode,
						   case when @CultureNo = 1 then v.GlTitle else v.GlTitle2 end GlTitle,
						   v.SlCode,
						   case when @CultureNo = 1 then v.SlTitle else v.SlTitle2 end SlTitle,
						   v.SlID,
						   v.SlID AS ViewModelId,
						   v.PlCode,
						   case when @CultureNo = 1 then v.PlTitle else v.PlTitle2 end PlTitle,
						   s.HasCurrency,
						   s.HasCurrencyConversion,
						   CFG.GetCLRSaturnDate(s.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
						   CFG.GetCLRSaturnDate(s.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 	
						   b.Name  AS BalanceTypeName,
						   u.Name AS CreatorUserName, 
						   u2.Name AS EditorName '+@ColumnsInSelectList+'
	              
		FROM acc.vwaccounts v 
		JOIN acc.SL s ON  s.SlID = v.slid
		LEFT JOIN ACC.BalanceType b ON s.BalanceTypeID = b.BalanceTypeID
		JOIN CFG.[User] AS u ON u.UserID = s.Creator 
		JOIN CFG.[User] AS u2 ON u2.UserID = s.LastEditor 	              	
		left join 
		(
			select SlID, AccountLevelID,
				   Case When als.DlTypeID IS NOT NULL THEN case when @CultureNo = 1 then d.Title else d.Title2 end
						else ''true'' end Value
			from acc.AccountLevelSL als
			left join acc.DlType d on d.DlTypeID = als.DlTypeID
		) x
		pivot 
		(
			 max(Value)
			for AccountLevelID in (' + @Columns + ')
		) p on s.SlID = p.SlID'

	EXECUTE sp_executeSQL  
				@query,
				N'@DateType TINYINT,
			      @DateFormat VARCHAR(10),
				  @CultureNo tinyint',
				  @DateType = @DateType,
				  @DateFormat = @DateFormat,
				  @CultureNo = @CultureNo;
