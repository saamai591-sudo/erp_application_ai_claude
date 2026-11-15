CREATE     proc [FOS].[GetClearanceList]
(
    @FinancialPeriodID     INT,
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
as

	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Submit               NVARCHAR(150),
	        @Voucher                 NVARCHAR(150),
	        @PreVoucher              NVARCHAR(150),
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @Culture                 VARCHAR(25),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	
	SET @UserID = cfg.GetuserID()
	SET @Culture = CFG.GetuserCulture()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
						
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID

	if @DateFormat is null
	set @DateFormat = 'YYYY/MM/DD'

	SELECT @Voucher = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PreVoucherStatuses'
	       AND L.Item = 'Voucher'
	       AND LV.Culture = @Culture
	
	SELECT @PreVoucher = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PreVoucherStatuses'
	       AND L.Item = 'PreVoucher'
	       AND LV.Culture = @Culture
	
	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @Culture

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Clearance'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Clearance'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL OR @Sort=''
		SET @Sort='Number'

	DECLARE @Query NVARCHAR(MAX) 
	SET @Query = N'
	
				select *
				into #Voucher
				from acc.vwVoucherPrevoucher
				where engname = ''Clearance''
				and FinancialPeriodID = @FinancialPeriodID
	
				select *
				into #vwBranchAccess
				from cfg.vwBranchAccess	
	
		;with Query_Result as (
		select c.ClearanceID,
               c.FinancialPeriodID,
	           b.Code BranchCode,
	           b.Title BranchName,
			   b.Title2 BranchName2,
	           c.Number,
	           c.Date,
	           CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) Date_Date,
	           d.Code PartyCode,
	           case when p.Type = 1 or p.Type = 2 then p.Title
	                when p.Type = 0 then p.Title + '' '' + p.LastName
	           end as PartyName,
	           c.CotajNumber,
	           c.CotajDate,
	           CFG.GetCLRSaturnDate(c.CotajDate, @DateFormat, 0, @DateType) Date_CotajDate,
	           c.PreVoucherID,
	           c.Description,
	           c.Description2,
	           c.Creator,
	           c.CreationDate,
	           c.LastEditor,
	           c.LastEditionDate,
	           c.Version,
	           CFG.GetCLRSaturnDate(c.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
	           CFG.GetCLRSaturnDate(c.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
	           u1.Name CreatorUserName,
	           u2.Name EditorName,
			   #Voucher.VoucherID VoucherID,
			   #Voucher.ReferenceNumber VoucherNumber,
		       #Voucher.Date VoucherDate,
		       CFG.GetCLRSaturnDate(#Voucher.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
			   case when #Voucher.VoucherID is not null then @Voucher
					when c.PreVoucherID is not null then @PreVoucher
					else @submit 
			   end as [Status]
		from FOS.Clearance c
			join CFG.Branch b on c.BranchID = b.BranchID
			join CFG.Party p on c.PartyID = p.PartyID
			left join ACC.DL d on p.DlID = d.DLID
			join CFG.[user] u1 on u1.UserID = c.Creator
			join CFG.[user] u2 on u2.UserID = c.LastEditor
			INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID
			left join #Voucher on #Voucher.PrevoucherID = c.PreVoucherID
		where c.FinancialPeriodID = @FinancialPeriodID              
			AND (@UserID = -1
				OR (@ViewRelatedToUser IS NOT NULL AND c.Creator = @UserID)
				OR (@ViewRelatedToOthers IS NOT NULL AND c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			))
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

	EXECUTE sp_executesql @Query,
	     N'@FinancialPeriodID int,
		   @UserID int,
		   @dateType tinyint,
		   @dateFormat varchar(10),
		   @Submit NVARCHAR(150),
		   @Voucher NVARCHAR(150),
		   @PreVoucher NVARCHAR(150),
		   @ViewRelatedToUser int,
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers	NVARCHAR(MAX),
		   @Culture VARCHAR(25)',
		   @FinancialPeriodID = @FinancialPeriodID,
		   @UserID = @UserID,
		   @DateType = @DateType,
		   @DateFormat = @DateFormat,
		   @Submit = @Submit,
		   @Voucher = @Voucher,
		   @PreVoucher = @PreVoucher,
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
