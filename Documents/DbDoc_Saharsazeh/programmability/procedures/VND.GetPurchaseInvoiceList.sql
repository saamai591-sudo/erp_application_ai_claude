
CREATE   PROCEDURE [VND].GetPurchaseInvoiceList
    (
        @FinancialPeriodId INT ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN
        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Submit NVARCHAR(100) ,
                @Confirmed NVARCHAR(100) ,
                @Voucher NVARCHAR(100) ,
                @PreVoucher NVARCHAR(100) ,
                @Internal NVARCHAR(100) ,
                @ViewRelatedToUser INT ,
                @ViewRelatedToOthers NVARCHAR(MAX) ,
                @Importable NVARCHAR(100) ,
                @Culture VARCHAR(10) ,
                @WithOutbase NVARCHAR(100) ,
                @PurchaseRequest NVARCHAR(100) ,
                @Contract NVARCHAR(100) ,
                @ContractStatement NVARCHAR(100) ,
                @Proposal NVARCHAR(100) ,
                @StockReceipt NVARCHAR(100),
                @Proforma  NVARCHAR(100),
		        @purchaseContract  NVARCHAR(100),
                @QuantityAssetReceipt NVARCHAR(100),
                @UnauthorizedUsers NVARCHAR(MAX);

        SET @UserID = cfg.GetuserID();
        SET @Culture = CFG.GetuserCulture();

        SELECT @WithOutbase = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'WithOutbase'
               AND LV.Culture = @Culture;

        SELECT @purchaseContract = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'PurchaseContract'
               AND LV.Culture = @Culture;

        SELECT @PurchaseRequest = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'PurchaseRequest'
               AND LV.Culture = @Culture;

        SELECT @Contract = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'Contract'
               AND LV.Culture = @Culture;

        SELECT @ContractStatement = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'ContractStatement'
               AND LV.Culture = @Culture;

        SELECT @Proposal = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'Proposal'
               AND LV.Culture = @Culture;

        SELECT @StockReceipt = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'StockReceipt'
               AND LV.Culture = @Culture;

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

			
		SELECT @Proforma = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'Proforma'
               AND LV.Culture = @Culture;

        SELECT @QuantityAssetReceipt = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'PurchaseDocumentBases'
               AND L.Item = 'QuantityAssetReceipt'
               AND LV.Culture = @Culture;

        SELECT @Submit = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'Statuses'
               AND L.Item = 'Submit'
               AND LV.Culture = @Culture;
			   
        SELECT @Confirmed = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'Statuses'
               AND L.Item = 'Confirmed'
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

        SELECT @Internal = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TradeType'
               AND L.Item = 'Internal'
               AND LV.Culture = @Culture;

        SELECT @Importable = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'TradeType'
               AND L.Item = 'Import'
               AND LV.Culture = @Culture;

	    SELECT @ViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'PurchaseInvoice'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;

	    SELECT @ViewRelatedToOthers = UserID ,
               @UnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'PurchaseInvoice'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;


        select * into #vwBranchAccess
        from cfg.vwBranchAccess

        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';
			
        DECLARE @Query NVARCHAR(MAX);

        SET @Query = '
		select * 
		into #VWVoucherPrevoucher
		from acc.VWVoucherPrevoucher
		where engname = ''PurchaseInvoice''
		and FinancialPeriodID = @FinancialPeriodID

		SELECT   pipp.PurchaseInvoiceID ,
					SUM(pipp.Price) AS PrePayment
		into #PurchaseInvoicePrePayment
		FROM     VND.PurchaseInvoicePrePayment AS pipp
		GROUP BY pipp.PurchaseInvoiceID

			;WITH Query_Result 
			AS
			(
				SELECT *,				
				CAST( CASE WHEN T.VoucherID IS not null  THEN @Voucher 
							WHEN T.PreVoucherID IS not null  THEN @PreVoucher
							WHEN Status = 2 then @Confirmed
							ELSE @Submit END AS NVARCHAR(512))AS StateString,
				CAST( CASE t.BaseType WHEN 1  THEN @WithOutbase 
									  WHEN 2  THEN @PurchaseRequest
									  WHEN 3  THEN @Contract
									  WHEN 4  THEN @ContractStatement
									  WHEN 5  THEN @Proposal
									  WHEN 6  THEN @StockReceipt
									  WHEN 8 THEN @purchaseContract
									  WHEN 9 THEN @Proforma
									  WHEN 18 THEN @QuantityAssetReceipt
					   END AS NVARCHAR(512))AS BaseTypeString 
				FROM(SELECT	p.PurchaseInvoiceID,
							p.DlID,
							p.BranchID,
							p.[DATE],					
							p.FinancialPeriodID,
							p.[Type],
							p.InvoiceNumber,
							p.InvoiceDate,
							p.Number,
							p.CurrencyID,
							p.CurrencyRate,
							p.TotalPrice,
							p.TotalDiscount,
							p.TotalTax,
							p.TotalDuty,
							p.TotalNetPrice,					
							p.PreVoucherID,					
							p.[Version],
							p.Creator,
							p.CreationDate,				
							CFG.GetCLRSaturnDate(p.[Date], @DateFormat  , 0, @DateType) AS Date_Date,	
							CFG.GetCLRSaturnDate(p.InvoiceDate, @DateFormat  , 0, @DateType) AS Date_InvoiceDate,			
							CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
							CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat , 1, @DateType) AS EditionDateString, 				
							u.Name AS CreatorUserName, 
							u2.Name AS EditorName,
							b.Code AS BranchCode,
							b.Title AS BranchTitle,
							b.Title2 AS BranchTitle2,
							d.Code AS VendorCode,
							d.Title AS VendorTitle,
							d.Title2 AS VendorTitle2,
							c.Title AS CurrencyTitle,
							c.Title2 AS CurrencyTitle2,					
							vp.VoucherID AS VoucherID,
							vp.ReferenceNumber AS VoucherNumber,
							vp.[Date] AS VoucherDate,
							CFG.GetCLRSaturnDate(vp.[Date], @DateFormat  ,0, @DateType) AS Date_VoucherDate,
							pt.Title TypeString,
							pt.Title2 TypeString2,
							BaseType,
							ISNULL(ppr.PrePayment,0) as PrePayment,
							p.LastEditionDate,
							Status
						FROM VND.PurchaseInvoice p
						    JOIN VND.PurchaseType AS pt ON pt.PurchaseTypeID = p.[Type]
						    LEFT JOIN #PurchaseInvoicePrePayment ppr on ppr.PurchaseInvoiceID = p.PurchaseInvoiceID
						    JOIN CFG.[User] AS u ON u.UserID = p.Creator 
						    JOIN CFG.[User] AS u2 ON u2.UserID = p.LastEditor
						    JOIN CFG.Branch b ON b.BranchID = p.BranchID
						    JOIN CFG.Currency c ON c.CurrencyID = p.CurrencyID
						    JOIN ACC.DL d ON d.DLID = p.DlID
						    left join #VWVoucherPrevoucher vp on vp.PrevoucherID = p.PreVoucherID
						    INNER JOIN #vwBranchAccess AS vba ON vba.BranchID =  p.BranchID
					WHERE (p.FinancialPeriodID = @financialPeriodId)
						and (@UserID = -1 
						    or  (@ViewRelatedToUser is not null   and p.Creator = @UserID)
						    or  (@ViewRelatedToOthers IS NOT NULL AND p.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst))
                        )
					)T	
			)
		';

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
        PRINT @Query;

        EXECUTE sp_executesql @Query ,
                              N'
			@UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@Submit NVARCHAR(100),
			@Confirmed NVARCHAR(100),
			@Voucher NVARCHAR(100),
			@PreVoucher NVARCHAR(100),
			@Internal NVARCHAR(100),
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers NVARCHAR(MAX),
			@UnauthorizedUsers   NVARCHAR(MAX),
			@Importable NVARCHAR(100),
			@Culture varchar(10),
			@WithOutbase NVARCHAR(100),
			@PurchaseRequest  NVARCHAR(100),
			@Contract   NVARCHAR(100),
			@ContractStatement    NVARCHAR(100),
			@Proposal	 NVARCHAR(100),
			@FinancialPeriodId INT,
			@StockReceipt NVARCHAR(100),
			@Proforma NVARCHAR(100),
			@purchaseContract NVARCHAR(100),
			@QuantityAssetReceipt NVARCHAR(100)
	       ' ,
                              @UserID = @UserID ,
                              @DateType = @DateType ,
                              @DateFormat = @DateFormat ,
                              @Submit = @Submit ,
                              @Voucher = @Voucher ,
                              @PreVoucher = @PreVoucher ,
                              @Internal = @Internal ,
                              @ViewRelatedToUser = @ViewRelatedToUser ,
                              @ViewRelatedToOthers = @ViewRelatedToOthers ,
                              @UnauthorizedUsers = @UnauthorizedUsers ,
                              @Importable = @Importable ,
                              @Culture = @Culture ,
                              @WithOutbase = @WithOutbase ,
                              @PurchaseRequest = @PurchaseRequest ,
                              @Contract = @Contract ,
                              @ContractStatement = @ContractStatement ,
                              @Proposal = @Proposal ,
                              @FinancialPeriodId = @FinancialPeriodId ,
                              @StockReceipt = @StockReceipt,
							  @Proforma = @Proforma,
							  @purchaseContract = @purchaseContract,
							  @QuantityAssetReceipt = @QuantityAssetReceipt,
							  @Confirmed = @Confirmed

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);

    END;


