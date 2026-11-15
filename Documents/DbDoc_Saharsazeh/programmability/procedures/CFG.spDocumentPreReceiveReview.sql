
CREATE   PROC [CFG].[spDocumentPreReceiveReview]
	(   @FromDate DATE,
		@ToDate DATE,
		@SelectedBranchs NVARCHAR(MAX),
		@SelectedParties NVARCHAR(MAX))
AS 
BEGIN
	DECLARE @TableName      NVARCHAR(MAX),
	        @TableName1     NVARCHAR(MAX),
	        @Query          NVARCHAR(MAX),
	        @DateType       TINYINT,
	        @DateFormat     NVARCHAR(10),
	        @UserID         INT,
	        @Culture        VARCHAR(5),
	        @CultureNo      TINYINT ;	
	
	SET @TableName = CFG.getTempTableName(1)
	SET @TableName1 = CFG.getTempTableName(1)
	SET @UserID = cfg.GetuserID()
	
	SET @Culture = CFG.GetuserCulture()
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID;
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END;
	
	SELECT @DateFormat = UPPER(us.SettingValue)
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID;
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD';
	
	EXEC cfg.spPreReceiveDataSource
	     @TableName = @TableName,
	     @FromDate = @FromDate,
	     @ToDate = @ToDate,
	     @SelectedBranchs=@SelectedBranchs ,
		@SelectedParties =@SelectedParties,
		@SelectedDocuments =Null
	
	SET @Query = N'
	select  
	a.ItemID,
	 a.Number,
	 a.Date,
	 a.Type,
	 a.DlID,
	 a.BranchID,
	 a.CurrencyID,
	 sum(PreReciveAmount) PreReciveAmount,
	 sum(DepreciatedAmount) DepreciatedAmount into ' + @TableName1 + 
	    N' 
	 from ' + @TableName + 
	    N' a
	             
	             group by a.Number,a.Date,a.ItemID,a.CurrencyID,a.Type,a.dlid,a.BranchID

	             '
	
	EXEC (@Query)
	
	
	
	SET @Query = 
	    N'Select 
	    d.Code DlCode,
	    case when @CultureNo=1 then  d.Title else D.Title2 end DlTitle,
		case when @CultureNo=1 then b.Title else b.Title2 end BranchTitle,
		case when @CultureNo=1 then c.Title else c.Title2 end CurrencyTitle
		,cfg.getclrSaturnDate(a.Date,@DateFormat,0,@DateType) as Date,
		a.Number,
		a.PreReciveAmount,
		a.DepreciatedAmount,
		a.PreReciveAmount-a.DepreciatedAmount as NonDepreciated,
		a.Type
             from ' + @TableName1 + 
	    N' a
		join acc.Dl d on a.DlID=d.DlID
		join Cfg.Currency c on a.CurrencyID=c.CurrencyID
		join cfg.Branch b on a.BranchID=b.BranchID
             


'
	
	EXEC sp_executesql @Query,
	 N'	@DateType TINYINT ,
		@DateFormat NVARCHAR(10),
		@CultureNo TinyInt',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @CultureNo = @CultureNo
END