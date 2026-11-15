-------------------------------------
CREATE   PROC [SLE].RptSale_Flow
(
    @FromDate DATE,
    @EndDate DATE,
    @Branch NVARCHAR(MAX) = NULL,
    @Customer NVARCHAR(MAX) = NULL,
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedSaleModels NVARCHAR(MAX) = NULL,
    @SelectedSaleGroup NVARCHAR(MAX) = NULL,
    @SelectedIds NVARCHAR(MAX) = NULL,
    @SelectedCustomerGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL,
    @SelectedSaleType NVARCHAR(MAX) = NULL,
    @SelectedSaleArea NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
	@Source						TinyInt = 1
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @Columns                 NVARCHAR(MAX),
	        @ColumnsInSelectList     NVARCHAR(MAX),
	        @query                   NVARCHAR(MAX),
	        @param                   NVARCHAR(MAX),
	        @CodeAndTitleColumn      NVARCHAR(MAX),
	        @LeftJoin                NVARCHAR(MAX),
	        @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Culture                 VARCHAR(10),
	        @CultureNo               TINYINT,
	        @tableName               NVARCHAR(255),
	        @tableName1              NVARCHAR(255);
	
	SET @Culture = CFG.GetuserCulture();
	SET @UserID = CFG.GetuserID();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID;
	SET @tableName = CFG.getTempTableName(1);
	SET @tableName1 = CFG.getTempTableName(1);
	
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
	
	
	
	
	
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';
	
	DECLARE @Invoice                 NVARCHAR(100),
	        @ReturnedSaleInvoice     NVARCHAR(100),
	        @Internal                NVARCHAR(100),
	        @Export                  NVARCHAR(100);
	
	SELECT @ReturnedSaleInvoice = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'ReturnedSaleInvoice'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @Invoice = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Invoice'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @Internal = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'TradeType'
	       AND le.Item = 'Internal'
	       AND lev.Culture = CFG.GetuserCulture();
	
	SELECT @Export = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'TradeType'
	       AND le.Item = 'Export'
	       AND lev.Culture = CFG.GetuserCulture();
	
	EXEC [SLE].[RptSaleReviewDataSource] 
			@FromDate=@FromDate ,
			@ToDate=@EndDate ,
			@TableName =@tableName,
			@SelectedStuff = @SelectedStuff,
			@SelectedCustomer = @Customer,
			@SelectedSaleModels = @SelectedSaleModels,
			@SelectedSaleGroup =@SelectedSaleGroup,
			@SelectedCustomerGroup = @SelectedCustomerGroup ,
			@SelectedStuffGroup = @SelectedStuffGroup ,
			@SelectedSaleType = @SelectedSaleType,
			@selectedBranch = @Branch,
			@SelectedSaleArea = @SelectedSaleArea,
			@Source = @Source,
			@SelectedIds = @SelectedIds,
			@SelectedStuffAccountGroup = @SelectedStuffAccountGroup
	
		
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(TraceID)
	               FROM   STF.Trace t
	               WHERE  t.TraceID IN (SELECT tdnt.TraceID
	                                    FROM   stf.TraceDocumentNumType AS tdnt
	                                    WHERE  tdnt.DocumentNumTypeID
	                                           IN (SELECT dnt.DocumentNumTypeID
	                                               FROM   cfg.DocumentNumType AS dnt
	                                               WHERE  (
	                                                          dnt.EngName = 'Invoice'
	                                                          OR dnt.EngName = 'ReturnedSaleInvoice'
	                                                      )))
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';                           
	
	SELECT @ColumnsInSelectList = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS VARCHAR(10)) + CASE 
								WHEN 
								AccountLevelTypeID 
								= 6 THEN ',d' + 
								CAST(TraceID AS VARCHAR(10)) 
								+ '.Item' + CASE 
									WHEN 
										@CultureNo 
										= 
										2 THEN 
										'2'
									ELSE 
										''
								END 
								+ ' AS T' + CAST(TraceID AS NVARCHAR(5)) 
													+ 'Title'
												ELSE ''
											END
								FROM   STF.Trace t
	               WHERE  t.TraceID IN (SELECT tdnt.TraceID
	                                    FROM   stf.TraceDocumentNumType AS tdnt
	                                    WHERE  tdnt.DocumentNumTypeID
	                                           IN (SELECT dnt.DocumentNumTypeID
	                                               FROM   cfg.DocumentNumType AS dnt
	                                               WHERE  (
	                                                          dnt.EngName = 'Invoice'
	                                                          OR dnt.EngName = 'ReturnedSaleInvoice'
	                                                      )))
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@ColumnsInSelectList IS NULL)
	    SET @ColumnsInSelectList = N'[-1]';
	
	SELECT @CodeAndTitleColumn = STUFF(
	           (
	               SELECT DISTINCT
	                      ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS [T' + CAST(TraceID AS VARCHAR(10)) + 
	                      'Code],d'
	                      + CAST(TraceID AS VARCHAR(10)) + '.Title AS [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	DECLARE @listLeftJoin NVARCHAR(MAX)
	SELECT @listLeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join STF.TraceItem d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
	                      + '.TraceItemID = A.' + QUOTENAME(TraceID)
	               FROM   STF.Trace t
	               WHERE  t.TraceID IN (SELECT tdnt.TraceID
	                                    FROM   stf.TraceDocumentNumType AS tdnt
	                                    WHERE  tdnt.DocumentNumTypeID
	                                           IN (SELECT dnt.DocumentNumTypeID
	                                               FROM   cfg.DocumentNumType AS dnt
	                                               WHERE  (
	                                                          dnt.EngName = 'Invoice'
	                                                          OR dnt.EngName = 'ReturnedSaleInvoice'
	                                                      )))
	                      AND AccountLevelTypeID = 6
	                          FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	
	IF (@listLeftJoin IS NULL)
	    SET @listLeftJoin = N'';
	

	IF (@CodeAndTitleColumn IS NULL)
	    SET @CodeAndTitleColumn = N'';
	
	SELECT @LeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
	                      + '.DlID = A.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
				   WHERE  TraceID IN (SELECT tdnt.TraceID
	                                    FROM   stf.TraceDocumentNumType AS tdnt
	                                    WHERE  tdnt.DocumentNumTypeID
	                                           IN (SELECT dnt.DocumentNumTypeID
	                                               FROM   cfg.DocumentNumType AS dnt
	                                               WHERE  (
	                                                          dnt.EngName = 'Invoice'
	                                                          OR dnt.EngName = 'ReturnedSaleInvoice'
	                                                      )))
				   and 
				   DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@LeftJoin IS NULL)
	    SET @LeftJoin = N'';
	
	
	DECLARE @innerTraceCol NVARCHAR(MAX)
	
	
	SELECT @innerTraceCol = STUFF(
	           (
	               SELECT DISTINCT
	                      ', IIF (ritem.ReturnedSaleInvoiceItemID IS not NULL  ,RTrace.' + QUOTENAME(t.TraceID) + 
	                      ',ITrace.' + QUOTENAME(t.TraceID) + ') AS ' + QUOTENAME(t.TraceID)
	               FROM   STF.Trace t
	               WHERE  t.TraceID IN (SELECT tdnt.TraceID
	                                    FROM   stf.TraceDocumentNumType AS tdnt
	                                    WHERE  tdnt.DocumentNumTypeID
	                                           IN (SELECT dnt.DocumentNumTypeID
	                                               FROM   cfg.DocumentNumType AS dnt
	                                               WHERE  (
	                                                          dnt.EngName = 'Invoice'
	                                                          OR dnt.EngName = 'ReturnedSaleInvoice'
	                                                      )))
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @innerTraceCol IS NULL
	    SET @innerTraceCol = ' RTrace.[-1] '
	
	print @leftjoin
	print @listleftjoin
	
	SET @query = 
	    N'	select ROW_NUMBER() over (order by DocName,DocID) RowID,
		A.ItemID,A.DocName,A.DocType,A.DocID, A.Number,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then c.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
	    + 
	    N' = 2 then c.Title2
	   end as CurrencyTitle, 
	   A.Date,CFG.GetClrSaturnDate(A.Date, @DateFormat, 0, @DateType) Date_Date,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then stf.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
	    + N' = 2 then stf.Title2
	   end as StuffTitle,
	   [STF].[GetStuffCode](stf.StuffID) StuffCode,' + @ColumnsInSelectList + N',
        A.MainQuantity,
	   A.SubQuantity,
	   A.FeeInBaseCurrency,
	   A.PriceInBaseCurrency,
	   A.DiscountInBaseCurrency,
	   A.TaxInBaseCurrency,
	   A.DutyInBaseCurrency,
	   A.NetInBaseCurrency as NetPriceInBaseCurrency,
	   case WHEN A.PriceInBaseCurrency= 0 then 0
	   else 
	   ABS((A.DiscountInBaseCurrency/A.PriceInBaseCurrency)*100) 
	   end
	   as DiscountPercent,
	   sm.Code SaleModelCode,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sm.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
	    + 
	    N' = 2 then sm.Title2
	   end as SaleModelTitle,
	   A.SaleType AS [TYPE],

		b.Code BranchCode,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then b.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
	    + N' = 2 then b.Title2
	    end as BranchTitle,
		p.CustomerCode,		 
		case when ' + CAST(@CultureNo AS CHAR(1))
	    + N' = 1 then 
							ISNULL(p.Title,'''') + '' '' + ISNULL(p.LastName,'''')
	         when ' + CAST(@CultureNo AS CHAR(1))
	    + 
	    N' = 2 then 
							ISNULL(p.Title2,'''') + '' '' + ISNULL(p.LastName2,'''')
	    end as CustomerName,
		A.Description,
		A.Description2'+Case when @Source = 3 then N'
		 ,
		  A.CurrencySalePrice,
		  A.CurrencyNet,
		  A.CurrencyDiscount,
		  A.CurrencyTax,
		  A.CurrencyDuty' else '' end+N'		
        from (select 
       ii.ItemID, 
        
        case when IsReturned = 0 then ' + @Invoice + N' else ' + @ReturnedSaleInvoice + 
	    N' end as DocName,
        case when IsReturned = 0 then ''invoice'' else ''returnedsaleinvoice'' end as DocType,
        ii.HeaderID DocID,
        case when invoice.invoiceid is not null then invoice.Number else rsi.Number end Number,
        case when invoice.invoiceid is not null then invoice.Date else rsi.Date end Date,
        ii.CurrencyID,
		ii.StuffID ,
		ii.MainQuantity,ii.SubQuantity,ii.SaleModelID,ii.[SaleTypeId] ,ii.BranchID ,ii.CustomerID,
		
		isnull(CASE 
            WHEN c.CurrencyID <> -1 THEN CASE 
                                              WHEN c.IsBaseCurrencyBasis = 0 THEN item.Fee * invoice.CurrencyRate / 
                                                   c.ExchangeUnit
                                              ELSE item.Fee * c.ExchangeUnit / invoice.CurrencyRate
                                         END
            ELSE item.Fee
       END,0 ) +
       isnull(CASE 
            WHEN c.CurrencyID <> -1 THEN CASE 
                                              WHEN c.IsBaseCurrencyBasis = 0 THEN ritem.Fee * rsi.CurrencyRate / 
                                                   c.ExchangeUnit
                                              ELSE ritem.Fee * c.ExchangeUnit / rsi.CurrencyRate
                                         END
            ELSE ritem.Fee
       END,0)                                    FeeInBaseCurrency,
       
		ii.PriceInBaseCurrency,	ii.DiscountInBaseCurrency,ii.TaxInBaseCurrency,ii.DutyInBaseCurrency,
				isnull(CASE 
            WHEN c.CurrencyID <> -1 THEN CASE 
                                              WHEN c.IsBaseCurrencyBasis = 0 THEN item.NetPrice * invoice.CurrencyRate / 
                                                   c.ExchangeUnit
                                              ELSE item.NetPrice * c.ExchangeUnit / invoice.CurrencyRate
                                         END
            ELSE item.NetPrice
       END,0 ) -
       isnull(CASE 
            WHEN c.CurrencyID <> -1 THEN CASE 
                                              WHEN c.IsBaseCurrencyBasis = 0 THEN ritem.NetPrice * rsi.CurrencyRate / 
                                                   c.ExchangeUnit
                                              ELSE ritem.NetPrice * c.ExchangeUnit / rsi.CurrencyRate
                                         END
            ELSE ritem.NetPrice
       END,0)                                    NetInBaseCurrency
	   
	   '+Case when @Source = 3 then N'
		 , ii.Price											CurrencySalePrice,
           ISNULL(ii.Price, 0)  + ISNULL(ii.Discount, 0)	CurrencyNet,
          ISNULL(ii.Discount, 0)							CurrencyDiscount,
           ISNULL(ii.Tax, 0)								CurrencyTax,
           ISNULL(ii.Duty, 0)								CurrencyDuty			' else '' end+N',
		case when item.invoiceItemid is not null then item.Description else ritem.Description end Description, 
		case when item.invoiceItemid is not null then item.Description2 else ritem.Description2 end Description2, 
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sty.Title when ' + CAST(@CultureNo AS CHAR(1)) + 
	    N' = 2 then sty.Title2 end as SaleType,
		' + @innerTraceCol + '
		from  ' + @tableName + 
	    ' as ii
	    left  JOIN sle.InvoiceItem item on ii.ItemID=item.InvoiceItemID and ii.IsReturned=0
	    left join sle.Invoice invoice on item.invoiceid=invoice.InvoiceID
	    left join sle.ReturnedSaleInvoiceItem ritem on ritem.ReturnedSaleInvoiceItemID=ii.ItemID and ii.isReturned=1
	    left join sle.ReturnedSaleInvoice rsi on ritem.ReturnedSaleInvoiceID=rsi.ReturnedSaleInvoiceID
		INNER JOIN SLE.SaleType sty on sty.SaleTypeId = ii.SaleTypeId  
		INNER JOIN CFG.Currency AS c ON c.CurrencyID = ii.CurrencyID
		INNER JOIN [Stf].[stuff] s on s.StuffId = ii.stuffId
		inner join cfg.party p1 on p1.PartyID=ii.CustomerID
		LEFT JOIN 
				(
				select iit.InvoiceItemID,iit.TraceID,case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
													  when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
												  when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
												  else Value end value
												 from sle.InvoiceItemTrace iit
												 join stf.trace t on t.traceid = iit.traceid
												 )x pivot
				(
				max(value)
				for traceid in (' + @Columns
	    + 
	    N')
				)ITrace on ITrace.InvoiceItemID = ii.ItemID and ii.IsReturned = 0
				LEFT JOIN 
				(
				select iit.ReturnedSaleInvoiceItemID,iit.TraceID,case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
													  when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
												  when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
												  else Value end value
												 from sle.ReturnedSaleInvoiceItemTrace iit
												 join stf.trace t on t.traceid = iit.traceid
												 )x pivot
				(
				max(value)
				for traceid in (' + @Columns
	    + 
	    N')
				)RTrace on RTrace.ReturnedSaleInvoiceItemID = ii.ItemID and ii.IsReturned=1
				) A
INNER JOIN stf.Stuff stf on stf.StuffID = A.StuffID
INNER JOIN cfg.Currency c on c.CurrencyID = A.CurrencyID
INNER JOIN sle.SaleModel sm on sm.SaleModelID = A.SaleModelID
INNER JOIN CFG.Branch b ON b.BranchID = A.BranchID
INNER JOIN CFG.Party p ON p.PartyID = A.CustomerID ' + @LeftJoin + ' ' + @listLeftJoin;
	

	SET @param = 
	    N'
	  @DateType					TINYINT,
	  @DateFormat				VARCHAR(10)';
	EXECUTE sp_executesql
		 @query,
	     @param,
	     @DateType = @DateType,
	     @DateFormat = @DateFormat;
	   
END;

