
--------------------------------------------------------------
CREATE   PROC [FOS].GetRegistrationList
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
			@Query NVARCHAR(MAX),
            @UnauthorizedUsers NVARCHAR(MAX),
			@CultureNo TINYINT;
	
	
	SET @UserID = cfg.GetuserID()
	SET @Culture = CFG.GetuserCulture()

	SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

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
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'

	if object_id('tempdb..#ProformaInvoiceItem') is not null
		drop table #ProformaInvoiceItem


	if object_id('tempdb..#Voucher') is not null
		drop table #Voucher

	if object_id('tempdb..#Prices') is not null
		drop table #Prices

	select ProformaInvoiceID,
	       sum(Price) Amount
	into #ProformaInvoiceItem
	from FOS.ProformaInvoiceItem 
	group by ProformaInvoiceID

	select e.ProformaInvoiceID
	into #Prices
	from FOS.OrderPricing a 
	join FOS.ClearanceItem b on a.ClearanceID = b.ClearanceID
	join FOS.BillOfLadingItem c on b.BillOfLadingItemID = c.BillOfLadingItemID
	join VND.PurchaseInvoiceItem d on c.PurchaseInvoiceItemID = d.PurchaseInvoiceItemID
	join FOS.ProformaInvoiceItem e on d.ProformaInvoiceItemID = e.ProformaInvoiceItemID
	group by e.ProformaInvoiceID

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
	WHERE EntityName = 'Registration'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Registration'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	
	IF @Sort IS NULL OR @Sort=''
		SET @Sort=' Number '

	SET @Query = N'
	
				select *
				into #Voucher
				from acc.vwVoucherPrevoucher
				where engname = ''Registration''
				and FinancialPeriodID = @FinancialPeriodID
	
				select *
				into #vwBranchAccess
				from cfg.vwBranchAccess

				;with Query_Result as (
				select 
						RegistrationID,
						CFG.GetCLRSaturnDate(r.[RegistrationDate], @DateFormat, 0, @DateType) Date_RegistrationDate,
						CFG.GetCLRSaturnDate(r.CreditDate, @DateFormat, 0, @DateType) Date_CreditDate,
						RegistrationNumber,
						r.[RegistrationDate],
						r.CreditDate,
						r.FinancialPeriodID,
						r.BranchID,
						b.code BranchCode,
						b.title BranchName,
						b.title2 BranchName2,
						r.Number,
						r.[Date],
						CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_Date,
						r.ProformaInvoiceID,
						p.Number ProformaInvoiceNumber,
						CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) ProformaInvoiceDate,
						pa.Title+'' ''+isnull(pa.LastName,'' '') ProformaInvoiceVendor,
						c.Title ProformaInvoiceCurrency,
						i.Amount ProformaInvoiceAmount,
						p.CurrencyID,
						WageRate,
						WageRateManner,
						r.CurrencyRate,
						WageAmount,
						Description,
						Description2,
						r.PreVoucherID,
						p.CreationDate,
						p.LastEditionDate,
						CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
						CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
						u1.Name CreatorUserName,
						u2.Name EditorName,
						case when #Voucher.voucherid is not null then @voucher
							 when r.prevoucherid is not null then @prevoucher
							 else @submit end StateString,
						#Voucher.VoucherID VoucherID,
						#Voucher.ReferenceNumber VoucherNumber,
						#Voucher.Date VoucherDate,
						CFG.GetCLRSaturnDate(#Voucher.Date, @DateFormat, 0, @DateType) Date_VoucherDate,
						r.Version,
						cast(case when pr.ProformaInvoiceID is not null then 1	                 
					              else 0
	                         end as bit) as ProformaInvoicePriced,
						r.PartyID,
						CASE WHEN @CultureNo = 1 THEN party.Title + '' '' + ISNULL(party.LastName, '''') WHEN @CultureNo = 2 THEN party.Title2 + '' '' + ISNULL(party.LastName2, '''') END AS PartyTitle,
						d.Code as PartyCode
				from fos.Registration r
					join cfg.branch b on b.branchid = r.branchid
					join fos.ProformaInvoice p on p.ProformaInvoiceID = r.ProformaInvoiceID
					join #ProformaInvoiceItem i on i.ProformaInvoiceID = p.ProformaInvoiceID
					join cfg.Party pa on pa.PartyID = p.Vendor
					join cfg.Currency c on c.CurrencyID = p.CurrencyID
					join cfg.[user] u1 on u1.UserID = r.Creator
					join cfg.[user] u2 on u2.UserID = r.LastEditor
					left join #Prices pr on r.ProformaInvoiceID = pr.ProformaInvoiceID
					INNER JOIN #vwBranchAccess AS vba ON vba.BranchID =  r.BranchID
					left join #Voucher on #Voucher.prevoucherid = r.prevoucherid
					left join cfg.Party as party on party.PartyID=r.PartyID
					LEFT JOIN ACC.DL d on party.DlID = d.DLID
				where r.FinancialPeriodID = @FinancialPeriodID                
					AND (@UserID = -1
					OR (@ViewRelatedToUser IS NOT NULL AND r.Creator = @UserID)
					OR (@ViewRelatedToOthers IS NOT NULL AND r.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
				)
			))'
	      
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

		print @Query
	EXECUTE sp_executesql @Query,
	     N'@dateFormat varchar(10),
		   @dateType int,
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers	NVARCHAR(MAX),
		   @FinancialPeriodID int,
		   @UserID int,
		   @ViewRelatedToUser int,
	       @Voucher                 NVARCHAR(150),
	       @PreVoucher              NVARCHAR(150),
	       @Submit                NVARCHAR(150),
		   @CultureNo TINYINT',
	     @Voucher = @Voucher,
	     @PreVoucher = @PreVoucher,
	     @Submit = @Submit,
	     @DateType = @DateType,
	     @FinancialPeriodID = @FinancialPeriodID,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID,
		@CultureNo=@CultureNo
		
	DECLARE @Count INT

	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT

	if object_id('tempdb..#ProformaInvoiceItem') is not null
		drop table #ProformaInvoiceItem

	
	if object_id('tempdb..#Voucher') is not null
		drop table #Voucher

	if object_id('tempdb..#Prices') is not null
		drop table #Prices
	
	RETURN ISNULL(@Count, 0);
