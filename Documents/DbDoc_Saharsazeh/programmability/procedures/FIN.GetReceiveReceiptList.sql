
-------------------------------------
Create   PROCEDURE [FIN].GetReceiveReceiptList
    (
        @FinancialPeriodID INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Submit NVARCHAR(100) ,
            @Voucher NVARCHAR(100) ,
            @PreVoucher NVARCHAR(100) ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers NVARCHAR(MAX) ,
            @Initial NVARCHAR(100) ,
            @Culture VARCHAR(25),
            @UnauthorizedUsers NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT @Submit = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'Statuses'
           AND L.Item = 'Submit'
           AND LV.Culture = @Culture;

    SELECT @Voucher = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PreVoucherStatuses'
           AND L.Item = 'Voucher'
           AND LV.Culture = @Culture;

    SELECT @PreVoucher = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'PreVoucherStatuses'
           AND L.Item = 'PreVoucher'
           AND LV.Culture = @Culture;

    SELECT @Initial = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'StatusOfReceipt'
           AND L.Item = 'Initial'
           AND LV.Culture = @Culture;

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ReceiveReceipt'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ReceiveReceipt'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    DECLARE @BaseCurrencyPrecision INT;
    SET @BaseCurrencyPrecision = CFG.GetBaseCurrencyPrecision();

    SELECT   i.ReceiveReceiptID ,
             SUM(i.ReceiptAmountInBaseCurrency) ReceiptAmountInBaseCurrency
    INTO     #items
    FROM     (   SELECT a.ReceiveReceiptID ,
                        CASE WHEN c.IsBaseCurrencyBasis = 0 THEN
                                 ROUND(
                                     a.Amount * a.CurrencyRate / c.ExchangeUnit ,
                                     @BaseCurrencyPrecision)
                             WHEN c.IsBaseCurrencyBasis = 1 THEN
                                 ROUND(
                                     a.Amount * c.ExchangeUnit / a.CurrencyRate ,
                                     @BaseCurrencyPrecision)
                        END AS ReceiptAmountInBaseCurrency
                 FROM   (   SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedBankDraft
                            UNION ALL
                            SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedCheqe
                            UNION ALL
                            SELECT ReceiveReceiptID ,
                                   CurrencyID ,
                                   CurrencyRate ,
                                   Amount
                            FROM   FIN.ReceivedCash ) a
                        JOIN CFG.Currency c ON a.CurrencyID = c.CurrencyID ) i
    GROUP BY i.ReceiveReceiptID;




    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number';
    DECLARE @Query NVARCHAR(MAX);
    SET @Query = '   
	select * 
	into #vwBranchAccess
	from cfg.vwBranchAccess

	select *
	into #vwVoucherPrevoucher
	from acc.vwVoucherPrevoucher
	where engname = ''ReceiveReceipt''
	and FinancialPeriodID = @FinancialPeriodID

	    ;WITH Query_Result 
			AS (
        SELECT r.ReceiveReceiptID,
				r.FinancialPeriodID,
				r.BranchID, 
				b.Code BranchCode,
				b.Title BranchName,
				r.Number,
				r.[Date],
				r.PartyID,
				d.Code PartyCode,
				CAST(CASE WHEN p.[Type] in( 1,2,4) THEN p.Title
						  WHEN p.[Type] = 0 THEN p.Title+'' ''+p.LastName
				END AS NVARCHAR(512))AS PartyName,
				i.ReceiptAmountInBaseCurrency,
				r.[Description],
				r.Description2,
				r.PreVoucherID,
				r.[Status],
				r.[Version], 
				r.Creator,
				r.CreationDate,							
				r.LastEditor,
				r.LastEditionDate,				
				CFG.GetCLRSaturnDate(r.[Date], @DateFormat , 0, @DateType) AS Date_Date,
				CFG.GetCLRSaturnDate(r.CreationDate, @DateFormat , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(r.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString,
				u.[Name] AS CreatorUserName,
				u2.[Name] AS EditorName,
				v.VoucherID AS VoucherID,
				v.ReferenceNumber AS VoucherNumber,
				v.[Date] VoucherDate,
				CFG.GetCLRSaturnDate(v.[Date], @DateFormat ,0, @DateType) AS Date_VoucherDate,				
				CAST(case when crs.CardReaderSettlementID is not null then 1
                          else 0 
		             end AS bit) IssuedFromCardReaderSettlement,
				CAST(CASE WHEN r.[Status] = 1 THEN @Initial
                          WHEN v.VoucherID IS NOT NULL THEN @Voucher
                          WHEN r.PreVoucherID IS NOT NULL THEN @PreVoucher
                          ELSE @Submit 
					 END AS NVARCHAR(512)) AS StatusString                        
                      
		FROM FIN.ReceiveReceipt AS r
		JOIN cfg.Branch b ON b.BranchID = r.BranchID
		JOIN cfg.Party p ON p.PartyID = r.PartyID
		LEFT JOIN acc.DL d ON d.DLID = p.DlID
		JOIN cfg.[User] u ON u.UserID = r.Creator
		JOIN cfg.[User] u2 ON u2.UserID = r.LastEditor
		left JOIN (   SELECT  rs.ReceiveReceiptID ,
                          max( rs.CardReaderSettlementID) as CardReaderSettlementID
                    FROM   FIN.ReceiveSubject AS rs group by rs.ReceiveReceiptID) AS crs ON crs.ReceiveReceiptID = r.ReceiveReceiptID
		join #items i on r.ReceiveReceiptID = i.ReceiveReceiptID
		INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = r.BranchID
		LEFT JOIN #vwVoucherPrevoucher v ON v.PrevoucherID = r.PreVoucherID
		WHERE r.FinancialPeriodID = @FinancialPeriodID 
		 and		
		      (@UserID = -1 or  
			  (@ViewRelatedToUser is not null and r.Creator = @UserID) or 
			  (@ViewRelatedToOthers IS NOT NULL AND r.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)))
		)';

    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(
                     @tableName ,
                     @Query ,
                     @PageNumber ,
                     @RowspPage ,
                     @Filter ,
                     @Sort);

    EXECUTE sp_executesql @Query , N'@dateFormat varchar(10),
		   @dateType int,
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers   NVARCHAR(MAX),
		   @FinancialPeriodID int,
           @UserID int,
		   @ViewRelatedToUser int,
		   @Submit NVARCHAR(100),
		   @Voucher NVARCHAR(100),
		   @PreVoucher NVARCHAR(100),
		   @Initial NVARCHAR(100),
		   @Culture varchar(25)' ,
            @Submit = @Submit ,
            @Voucher = @Voucher ,
            @PreVoucher = @PreVoucher ,
            @Initial = @Initial ,
            @Culture = @Culture ,
            @DateType = @DateType ,
            @FinancialPeriodID = @FinancialPeriodID ,
            @DateFormat = @DateFormat ,
            @ViewRelatedToUser = @ViewRelatedToUser ,
            @ViewRelatedToOthers = @ViewRelatedToOthers,
            @UnauthorizedUsers = @UnauthorizedUsers,
            @UserID = @UserID;

    DECLARE @Count INT;

    EXEC ( 'select * from ' + @tableName + ' ORDER BY _RN' );

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query ,
                          N'@count int out' ,
                          @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
