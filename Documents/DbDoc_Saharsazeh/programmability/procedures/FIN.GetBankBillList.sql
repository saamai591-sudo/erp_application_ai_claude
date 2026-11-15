
CREATE   PROCEDURE [FIN].GetBankBillList(
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),	
			@Normal NVARCHAR(100),
			@Initial NVARCHAR(100),	
	        @ViewRelatedToUser INT,
	        @ViewRelatedToOthers NVARCHAR(MAX),
	        @Culture VARCHAR(25),
			@CultureNo tinyint,
            @UnauthorizedUsers NVARCHAR(MAX);
	
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

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BankBill'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BankBill'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;


	select @Normal = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'BankBillStatuses'
	and L.Item = 'Normal'
	and LV.Culture = @Culture
	
	select @Initial = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'BankBillStatuses'
	and L.Item = 'Initial'
	and LV.Culture = @Culture
	
	SELECT * into #vwBankAccountAccess
	FROM cfg.vwBankAccountAccess AS vbaa
	
	IF @Sort IS NULL OR @Sort=''
		SET @Sort=' Number '
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    '
	    WITH Query_Result 
			(BankBillID,
			BankAccountID,
			BankAccountCode,
			BankAccountName,
			Number,
			Date,
			Date_Date,
			Status,
			StatusString,
			Amount,
			PreviousAmountRemain,
			IsLast,
			IsNotInFlow,
			[Version], 
			Creator,
			CreationDate,
			LastEditor,
			LastEditionDate,
			CreateDateString,
			EditionDateString,
			CreatorUserName,
			EditorName)
			
			AS (SELECT *
	         
	FROM(        
		SELECT bb.BankBillID,
			   bb.BankAccountID,
			   d.Code BankAccountCode,
			   case when '+ CAST(@CultureNo AS CHAR(1)) +' = 1 then d.Title
	                when '+ CAST(@CultureNo AS CHAR(1)) +' = 2 then d.Title2
	           end as BankAccountName,
			   bb.Number,
			   bb.Date,
			   CFG.GetCLRSaturnDate(bb.Date, @DateFormat , 0, @DateType) AS Date_Date,
			   bb.Status,
			   CAST(CASE WHEN bb.Status = 0 THEN @Normal
						 WHEN bb.Status = 1 THEN @Initial
			   END AS NVARCHAR(50))AS StatusString,
			   bb.Amount,
			   bb.Amount - (isnull(it.Deposite,0) - isnull(it.Withdraw,0)) PreviousAmountRemain,
			   CAST(CASE WHEN bb.BankBillID in (select MAX(BankBillID) from fin.BankBill group by BankAccountID) THEN 1		 
		                 ELSE 0
               END AS BIT) IsLast,
			   CAST(CASE WHEN bb.BankBillID not in (select BankBillID from FIN.Reconciliation) THEN 1		 
		                 ELSE 0
               END AS BIT) IsNotInFlow,	
			   bb.[Version],
			   bb.Creator,
			   bb.CreationDate,
			   bb.LastEditor,
			   bb.LastEditionDate,
			   CFG.GetCLRSaturnDate(bb.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString,
			   CFG.GetCLRSaturnDate(bb.LastEditionDate, @DateFormat  , 1, @DateType) AS EditionDateString,
			   u.[Name] AS CreatorUserName,
			   u2.[Name] AS EditorName       
	                      
			FROM FIN.BankBill AS bb
		    JOIN CFG.BankAccount b on bb.BankAccountID = b.BankAccountID
			JOIN #vwBankAccountAccess vbaa ON b.BankAccountID = vbaa.BankAccountID
			JOIN ACC.DL d on b.DlID = d.DLID
			JOIN cfg.[User] u ON u.UserID = bb.Creator
			JOIN cfg.[User] u2 ON u2.UserID = bb.LastEditor
			LEFT JOIN (select BankBillID,sum(Deposite) Deposite,sum(Withdraw) Withdraw from FIN.BankBillItem
                       group by BankBillID) it on bb.BankBillID = it.BankBillID
		
			WHERE @UserID = -1 
				or  (@ViewRelatedToUser is not null and bb.Creator = @UserID)
				or  (@ViewRelatedToOthers IS NOT NULL AND bb.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst))
		)T) '


	
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
	
	EXECUTE sp_executesql @Query,
	     N'
		 @UserID int,
		 @dateType int,
		 @dateFormat varchar(10),
		 @Normal NVARCHAR(100),
		 @Initial NVARCHAR(100),
		 @ViewRelatedToUser int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @Culture varchar(25)
		 ',
	     @UserID = @UserID,
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
		 @Normal = @Normal,
		 @Initial = @Initial,
		 @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
		 @Culture = @Culture
	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
