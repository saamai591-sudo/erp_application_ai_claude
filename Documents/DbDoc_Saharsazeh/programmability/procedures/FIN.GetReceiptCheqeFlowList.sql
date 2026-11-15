
---------Start of #8032
CREATE   PROCEDURE [FIN].GetReceiptCheqeFlowList(
	@FinancialPeriodID INT,
	@Type TINYINT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Submit NVARCHAR(100),
			@Voucher NVARCHAR(100),
			@PreVoucher NVARCHAR(100),			
			@BankViewRelatedToUser INT,
			@BankViewRelatedToOthers NVARCHAR(MAX),				
			@DeliverViewRelatedToUser INT,
			@DeliverViewRelatedToOthers NVARCHAR(MAX),				
			@ReceivedChequeViewRelatedToUser INT,
			@ReceivedChequeViewRelatedToOthers NVARCHAR(MAX),				
			@DrawBackReceivedViewRelatedToUser INT,
			@DrawBackReceivedViewRelatedToOthers NVARCHAR(MAX),				
			@Culture VARCHAR(5),
			@CultureNo tinyint,
			@UnauthorizedUsersForDeliverToSupplier NVARCHAR(MAX),
			@UnauthorizedUsersForBankOperation NVARCHAR(MAX),
			@UnauthorizedUsersForReceivedCheqeCashing NVARCHAR(MAX),
			@UnauthorizedUsersForDrawBackReceivedCheqe NVARCHAR(MAX)


	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	
	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
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

	--BankOperation
	SELECT @BankViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BankOperation'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @BankViewRelatedToOthers = UserID,
		   @UnauthorizedUsersForBankOperation = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BankOperation'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	--DeliverToSupplier	
	SELECT @DeliverViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DeliverToSupplier'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @DeliverViewRelatedToOthers = UserID,
		   @UnauthorizedUsersForDeliverToSupplier = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DeliverToSupplier'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
		
	--ReceivedChequeCashing
	SELECT @ReceivedChequeViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ReceivedCheqeCashing'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ReceivedChequeViewRelatedToOthers = UserID,
		   @UnauthorizedUsersForReceivedCheqeCashing = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ReceivedCheqeCashing'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
	
	--DrawBackReceived	
	SELECT @DrawBackReceivedViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DrawBackReceivedCheqe'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;


	SELECT @DrawBackReceivedViewRelatedToOthers = UserID,
		   @UnauthorizedUsersForDrawBackReceivedCheqe = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'DrawBackReceivedCheqe'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
				
	SELECT * into #vwEnums
	FROM cfg.VwEnums AS ve
	WHERE ve.Enum IN ('CheqeOperationTypeInReceive','CheqeStateInReceive')
	
	select @Voucher = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'PreVoucherStatuses'
	and L.Item = 'Voucher'
	and LV.Culture = CFG.GetuserCulture()
		
	select @PreVoucher = LV.Value
	from cfg.LocalizeEnum L
	join cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
	where L.Enum = 'PreVoucherStatuses'
	and L.Item = 'PreVoucher'
	and LV.Culture = CFG.GetuserCulture()
	
	
	IF @Sort IS NULL OR @Sort=''
		SET @Sort=' InnerNumber '
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    '
			select * 
			into #vwBranchAccess 
			from cfg.vwBranchAccess

			select *
			into #Voucher
			from acc.vwVoucherPrevoucher
			where engname = ''ReceiptCheqeFlow''
			and FinancialPeriodID = @FinancialPeriodID

	    ;WITH Query_Result 
			(ReceiptCheqeFlowID,
			FinancialPeriodID,
			[Type],
			BranchID,
			Number,
			[Date],
			BankAccountID,
			CashID,
			PartyID,
			PreVoucherID,
			[Status], 
			InnerNumber,
			[Version], 
			Creator,
			CreationDate,
			BranchCode,
			BranchName,
			PartyCode,
			LastEditor,
			LastEditionDate,
			PartyName,
			BankAccountCode,
			BankAccountName,
			CashCode,
			CashName,
			TypeString,			            
			Date_Date,
			CreateDateString,
			EditionDateString,
			CreatorUserName,
			EditorName,
			VoucherID,
			VoucherNumber,
			VoucherDate,
			Date_VoucherDate,
			StatusString)
			
			AS (SELECT *,
        CAST(CASE WHEN T.VoucherID IS NOT NULL THEN @Voucher
                  WHEN T.PreVoucherID IS NOT NULL THEN @PreVoucher
                  ELSE @Submit END AS NVARCHAR(512))AS StatusString
                 
		FROM 
		(        
		SELECT  r.ReceiptCheqeFlowID,
				r.FinancialPeriodID,
				r.[Type],
				r.BranchID,
				r.Number,
				r.[Date],
				r.BankAccountID,
				r.CashID,
				r.PartyID,
				r.PreVoucherID,
				r.[Status],
				r.InnerNumber, 
				r.[Version], 
				r.Creator,
				r.CreationDate,
				b.Code AS BranchCode,
				case when @CultureNo = 1 then b.Title
	                 when @CultureNo = 2 then b.Title2
	            end as BranchName,				
				d.Code PartyCode,
				r.LastEditor,
				r.LastEditionDate,
				case when @CultureNo  = 1 then d.Title
	                 when @CultureNo  = 2 then d.Title2
	            end as PartyName,			
				dl.Code AS BankAccountCode,
				case when @CultureNo  = 1 then dl.Title
	                 when @CultureNo  = 2 then dl.Title2
	            end as BankAccountName,				
				cashdl.Code AS CashCode,
				case when @CultureNo  = 1 then c.Title
	                 when @CultureNo  = 2 then c.Title2
	            end as CashName,	
				CAST(ve.Value AS NVARCHAR(512))AS TypeString,			            
				CFG.GetCLRSaturnDate(r.[Date], @DateFormat  , 0, @DateType) AS Date_Date,
				CFG.GetCLRSaturnDate(r.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(r.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
				u.[Name] AS CreatorUserName,
				u2.[Name] AS EditorName,
				vp.VoucherID AS VoucherID,
				vp.ReferenceNumber AS VoucherNumber,
				vp.[Date] VoucherDate,
				CFG.GetCLRSaturnDate(vp.[Date], @DateFormat  ,0, @DateType) AS Date_VoucherDate     
                      
			FROM  FIN.ReceiptCheqeFlow AS r
			 join #vwEnums ve on r.Type = ve.KeyValue and ve.Enum = ''CheqeOperationTypeInReceive''
			LEFT JOIN cfg.Branch b ON b.BranchID = r.BranchID
			LEFT JOIN cfg.BankAccount ba ON ba.BankAccountID = r.BankAccountID
			LEFT JOIN cfg.Cash c ON c.CashID = r.CashID
			LEFT JOIN cfg.Party p ON p.PartyID = r.PartyID
			JOIN cfg.[User] u ON u.UserID = r.Creator
			JOIN cfg.[User] u2 ON u2.UserID = r.LastEditor
			LEFT JOIN acc.DL d ON d.DLID = p.DlID
			LEFT JOIN acc.DL dl ON dl.DLID = ba.DlID
			LEFT JOIN acc.DL cashdl ON cashdl.DLID = c.DlID
			left join #Voucher vp on vp.PrevoucherID = r.PreVoucherID
		    INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = r.BranchID
			WHERE (r.FinancialPeriodID = @FinancialPeriodID)
			AND(
				(@Type = 1 AND r.[Type] IN (0,5,7,8,10)
				and(@UserID = -1 
						or (@BankViewRelatedToUser is not null and r.Creator = @UserID)
						or (@BankViewRelatedToOthers IS not NULL and r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsersForBankOperation) AS rfcst))))
				OR  (@Type = 2 AND r.[Type] IN (6)
					and(@UserID = -1 
						or (@DeliverViewRelatedToUser is not null and r.Creator = @UserID)
						or (@DeliverViewRelatedToOthers IS not NULL and r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsersForDeliverToSupplier) AS rfcst))))
				OR  (@Type = 3 AND r.[Type] IN (2,3)
					and(@UserID = -1 
						or (@ReceivedChequeViewRelatedToUser is not null and r.Creator = @UserID)
						or (@ReceivedChequeViewRelatedToOthers IS not NULL and r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsersForReceivedCheqeCashing) AS rfcst))))
				OR  (@Type = 4 AND r.[Type] IN (1,4,11)
							and(@UserID = -1 
						or (@DrawBackReceivedViewRelatedToUser is not null and r.Creator = @UserID)
						or (@DrawBackReceivedViewRelatedToOthers IS not NULL and r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsersForDrawBackReceivedCheqe) AS rfcst))))
				OR  (@Type = 5 AND r.[Type] IN (0,1,2,3,4,5,6,7,8,9)))
			)T
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
		N'
		@FinancialPeriodID INT,
		@Type TINYINT,
		@UserID INT,
		@DateType TINYINT,
		@DateFormat VARCHAR(10),
		@Submit NVARCHAR(100),
		@Voucher NVARCHAR(100),
		@PreVoucher NVARCHAR(100),			
		@BankViewRelatedToUser INT,
		@BankViewRelatedToOthers NVARCHAR(MAX),
		@DeliverViewRelatedToUser INT,
		@DeliverViewRelatedToOthers NVARCHAR(MAX),				
		@ReceivedChequeViewRelatedToUser INT,
		@ReceivedChequeViewRelatedToOthers NVARCHAR(MAX),
		@DrawBackReceivedViewRelatedToUser INT,
		@DrawBackReceivedViewRelatedToOthers NVARCHAR(MAX),
		@Culture VARCHAR(25),
		@UnauthorizedUsersForDeliverToSupplier NVARCHAR(MAX),
		@UnauthorizedUsersForBankOperation NVARCHAR(MAX),
		@UnauthorizedUsersForReceivedCheqeCashing NVARCHAR(MAX),
		@UnauthorizedUsersForDrawBackReceivedCheqe NVARCHAR(MAX),
		@CultureNo tinyint
		',
		@FinancialPeriodID = @FinancialPeriodID,
	    @Type = @Type,
		@UserID = @UserID,
		@DateType = @DateType,
		@DateFormat = @DateFormat,
		@Submit = @Submit,
		@Voucher = @Voucher,
		@PreVoucher = @PreVoucher,	
		@BankViewRelatedToUser = @BankViewRelatedToUser,
		@BankViewRelatedToOthers = @BankViewRelatedToOthers,				
		@DeliverViewRelatedToUser = @DeliverViewRelatedToUser,
		@DeliverViewRelatedToOthers = @DeliverViewRelatedToOthers,				
		@ReceivedChequeViewRelatedToUser = @ReceivedChequeViewRelatedToUser,
		@ReceivedChequeViewRelatedToOthers = @ReceivedChequeViewRelatedToOthers,				
		@DrawBackReceivedViewRelatedToUser = @DrawBackReceivedViewRelatedToUser,
		@DrawBackReceivedViewRelatedToOthers = @DrawBackReceivedViewRelatedToOthers,				
		@Culture = @Culture	,
		@UnauthorizedUsersForDeliverToSupplier = @UnauthorizedUsersForDeliverToSupplier,
		@UnauthorizedUsersForBankOperation = @UnauthorizedUsersForBankOperation,
		@UnauthorizedUsersForReceivedCheqeCashing = @UnauthorizedUsersForReceivedCheqeCashing,
		@UnauthorizedUsersForDrawBackReceivedCheqe = @UnauthorizedUsersForDrawBackReceivedCheqe,
		@CultureNo = @CultureNo
	
	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName +' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
