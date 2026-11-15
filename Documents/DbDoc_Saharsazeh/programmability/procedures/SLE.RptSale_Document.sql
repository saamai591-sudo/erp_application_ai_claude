-------------------------------------
CREATE   PROC [SLE].RptSale_Document
(
    @FromDate DATE,
    @EndDate DATE,
    @Branch NVARCHAR(MAX) = NULL,
    @Customer NVARCHAR(MAX) = NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
	@Source TinyInt				= 1
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat NVARCHAR(10),
            @Culture VARCHAR(10),
            @CultureNo TINYINT,
            @tableName NVARCHAR(255),
            @tableName1 NVARCHAR(255),
            @Query NVARCHAR(MAX);


    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = N'YY/MM/DD';



    SET @tableName = CFG.getTempTableName(1);
    SET @tableName1 = CFG.getTempTableName(1);



    EXEC [SLE].[RptSaleReviewDataSource] @FromDate = @FromDate,
                                         @ToDate = @EndDate,
                                         @TableName = @tableName,
                                         @SelectedStuff = @SelectedStuffs,
                                         @SelectedCustomer = @Customer,
                                         @SelectedSaleModels = @SelectedSaleModels,
                                         @SelectedSaleGroup = @SelectedSaleGroup,
                                         @SelectedCustomerGroup = @SelectedCustomerGroup,
                                         @SelectedStuffGroup = @SelectedStuffGroup,
                                         @SelectedSaleType = @SelectedSaleType,
                                         @selectedBranch = @Branch,
                                         @SelectedSaleArea = @SelectedSaleArea,
                                         @Source = 1,
										 @SelectedStuffAccountGroup = @SelectedStuffAccountGroup;




    SET @Query
        = N'Select 
			sum(ISNULL(Sale.PriceInBaseCurrency , 0)) Price,
			sum(ISNULL(Sale.PriceInBaseCurrency, 0)  - ISNULL(Sale.DiscountInBaseCurrency, 0)) Net,
			sum( ISNULL(Sale.DiscountInBaseCurrency, 0)) Discount,
			sum( ISNULL(Sale.TaxInBaseCurrency, 0))  Tax,
			sum( ISNULL(Sale.DutyInBaseCurrency, 0)) Duty,
			sum( ISNULL(Sale.MainQuantity, 0)) SaleMainQuantity,
			sum(  ISNULL(Sale.SubQuantity, 0)) SaleSubQuantity,
			Sale.Type DocumentType,Sale.HeaderID DocumentID,
			sale.IsReturned'+Case when @Source = 3 then N'
		 ,sale.CurrencyID SourceCurrencyID,
		  sum(ISNULL(case when sale.IsReturned = 0 then  Sale.Price else 0 end, 0)) CurrencySalePrice,
          sum( ISNULL(case when sale.IsReturned = 1 then   Sale.Price else 0 end, 0)) CurrencyReturnedPrice,
           sum(ISNULL(Sale.Price, 0)  + ISNULL(Sale.Discount, 0)) CurrencyNet,
          sum( ISNULL(Sale.Discount, 0)) CurrencyDiscount,
          sum( ISNULL(Sale.Tax, 0))  CurrencyTax,
          sum( ISNULL(Sale.Duty, 0)) CurrencyDuty' else '' end+N'
			into ' + @tableName1 + N'
			from ' + @tableName
          + N' as Sale 
			join cfg.party p on sale.customerid=p.PartyID
			join stf.stuff s on sale.StuffID=S.StuffID
			join stf.stuffDetail SD on Sale.stuffid=SD.stuffid
			Group by Sale.Type,Sale.HeaderID,Sale.IsReturned'+case when @Source = 3 then N',sale.CurrencyID ' else '' end;

    EXEC sp_executesql @Query;

    PRINT 564;
    SET @Query
        = N'
SELECT 
			A.ID,
			A.Name,
			A.Number,
			A.[Date],
			CFG.GetCLRSaturnDate(A.[Date], @DateFormat, 0, @DateType) Date_Date,
			CASE WHEN @CultureNo = 1 THEN c.Title WHEN @CultureNo = 2 THEN c.Title2 END AS CurrencyTitle,
			d.Code DlCode,
			CASE WHEN @CultureNo = 1 THEN p.Title + '' '' + ISNULL(p.LastName, '''') WHEN @CultureNo = 2 THEN p.Title2 + '' '' + ISNULL(p.LastName2, '''') END AS PartyTitle,
			d2.Code AgentDlCode,
			CASE WHEN @CultureNo = 1 THEN ISNULL(p2.Title, '''') + '' '' + ISNULL(p2.LastName, '''') WHEN @CultureNo = 2 THEN	ISNULL(p2.Title2, '''') + '' '' + ISNULL(p2.LastName2, '''') END AS AgentPartyTitle,
			CASE WHEN p.Type = 0 THEN p.IdentificationCode ELSE	p.NationalID END NationalCode,
			v.Number VoucherNumber,
			v.[Date] VoucherDate,
			CFG.GetCLRSaturnDate(v.[Date], @DateFormat, 0, @DateType) Date_VoucherDate,
			A.Price,
			A.Discount,
			A.Price + A.Discount SaleNet,
			A.Tax,
			A.Duty,
			'+Case When @Source = 3 then  N'
			A.CurrencySalePrice,
			A.CurrencyDiscount,
			A.CurrencyTax,
			A.CurrencyDuty,
			A.CurrencyReturnedPrice,
			a.CurrencyNet,' Else '' End+N'
			A.Price + A.Discount + A.Tax + A.Duty Net,
			ad.[Address]
			FROM
				(SELECT ''I'' + CAST(i.InvoiceID AS VARCHAR(50)) ID,
				i.CurrencyID,
				i.Date,
				i.Number,
				i.CustomerID,
				i.PreVoucherID,
				i.SaleAgentID,				
				''فاکتور'' Name,
				ii.*
				FROM SLE.Invoice i
				JOIN ' + @tableName1
          + N' as ii
				ON i.InvoiceID = ii.DocumentID and ii.IsReturned=0
				JOIN CFG.Party p
				ON p.PartyID = i.CustomerID
				JOIN CFG.Currency AS c
				ON c.CurrencyID = i.CurrencyID  
					UNION ALL
				SELECT ''R'' + CAST(i.ReturnedSaleInvoiceID AS VARCHAR(50)) ID,
				i.CurrencyID,
				i.Date,
				i.Number,
				i.CustomerID,
				i.PreVoucherID,
				'' '' as SaleAgentID,				
				''برگشت فروش'' Name,
				ii.*
				FROM SLE.ReturnedSaleInvoice i
				JOIN ' + @tableName1
          + N' as ii
				ON i.ReturnedSaleInvoiceID = ii.DocumentID and ii.IsReturned=1
				JOIN CFG.Party p
				ON p.PartyID = i.CustomerID
				JOIN CFG.Currency AS c
				ON c.CurrencyID = i.CurrencyID) A
				JOIN CFG.Party p
						ON A.CustomerID = p.PartyID
					LEFT JOIN ACC.DL d
						ON d.DLID = p.DlID
					LEFT JOIN SLE.SaleAgent AS sa
						ON sa.SaleAgentID = A.SaleAgentID
					LEFT JOIN CFG.Party p2
						ON p2.PartyID = sa.PartyID
					LEFT JOIN ACC.DL d2
						ON d2.DLID = p2.DlID
					JOIN CFG.Currency c
						ON c.CurrencyID = A.CurrencyID
					LEFT JOIN
					(SELECT PartyID, [Address] FROM CFG.[Address] WHERE IsMain = 1) ad
						ON ad.PartyID = p.PartyID
					LEFT JOIN
					(
						SELECT PrevoucherID,
							   VoucherID
						FROM ACC.VoucherPrevoucher
						GROUP BY PrevoucherID,
								 VoucherID
					) vp
						ON vp.PrevoucherID = A.PreVoucherID
					LEFT JOIN ACC.Voucher v
						ON v.VoucherID = vp.VoucherID ';

    EXEC sp_executesql @Query,
                       N'@DateFormat NVARCHAR(10),
	       @DateType TINYINT,
	       @Culture VARCHAR(10),
            @CultureNo TINYINT ',
                       @DateFormat = @DateFormat,
                       @DateType = @DateType,
                       @Culture = @Culture,
                       @CultureNo = @CultureNo;

END;

