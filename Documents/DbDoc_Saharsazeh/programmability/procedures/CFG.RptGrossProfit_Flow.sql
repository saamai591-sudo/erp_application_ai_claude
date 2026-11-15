
CREATE    PROC [CFG].RptGrossProfit_Flow
    (
        @FromDate DATE ,
        @EndDate DATE ,
        @Branch NVARCHAR(MAX) = NULL ,
        @Customer NVARCHAR(MAX) = NULL ,
        @SelectedStuff NVARCHAR(MAX) = NULL ,
        @SelectedSaleModels NVARCHAR(MAX) = NULL ,
        @SelectedSaleGroup NVARCHAR(MAX) = NULL ,
        @SelectedIds NVARCHAR(MAX) = NULL ,
        @SelectedCustomerGroup NVARCHAR(MAX) = NULL ,
        @SelectedStuffGroup NVARCHAR(MAX) = NULL ,
        @CostOfBuyingType TINYINT = 1,
		@SelectedSaleArea NVARCHAR(MAX) = NULL 
    )
--WITH ENCRYPTION
AS
    DECLARE @Columns NVARCHAR(MAX) ,
            @ColumnsInSelectList NVARCHAR(MAX) ,
            @query NVARCHAR(MAX) ,
            @param NVARCHAR(MAX) ,
            @CodeAndTitleColumn NVARCHAR(MAX) ,
            @LeftJoin NVARCHAR(MAX) ,
            @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

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


    SELECT RIGHT(value, LEN(value) - 1) VALUE
    INTO   #Invoice
    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
    WHERE  LEFT(VALUE, 1) = 'I';

    SELECT RIGHT(value, LEN(value) - 1) VALUE
    INTO   #ReturnedInvoice
    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
    WHERE  LEFT(VALUE, 1) = 'R';

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(TraceID)
        FROM   STF.Trace
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]';

    DECLARE @CultureNo INT;
    SELECT @CultureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = CFG.GetuserCulture();

	    SELECT @ColumnsInSelectList = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(TraceID) + ' AS T'
                        + CAST(TraceID AS VARCHAR(10)) +
						CASE
                     WHEN AccountLevelTypeID = 6 THEN
                         ',' + QUOTENAME('Tri' + CAST(TraceID AS NVARCHAR(10))) + +'.Item' + CASE @CultureNo
                                                                           WHEN 2 THEN
                                                                               '2'
                                                                           ELSE
                                                                               ''
                                                                       END + ' As '
                         + QUOTENAME('T' + CAST(TraceID AS NVARCHAR(10))+'Title')
                     ELSE
                         ''
                 END
        FROM   STF.Trace
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @ColumnsInSelectList IS NULL )
        SET @ColumnsInSelectList = '[-1]';

    SELECT @CodeAndTitleColumn = STUFF(
    (   SELECT DISTINCT ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS [T'
                        + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
                        + CAST(TraceID AS VARCHAR(10)) + '.Title AS [T'
                        + CAST(TraceID AS VARCHAR(10)) + 'Title]'
        FROM   STF.Trace
        WHERE  DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE       ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @CodeAndTitleColumn IS NULL )
        SET @CodeAndTitleColumn = '';


    SELECT @LeftJoin = STUFF(
    (   SELECT DISTINCT ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10))
                        + ' on d' + CAST(TraceID AS VARCHAR(10))
                        + '.DlID = A.' + QUOTENAME(TraceID)
        FROM   STF.Trace
        WHERE  DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @LeftJoin IS NULL )
        SET @LeftJoin = '';

		
    IF ( @CodeAndTitleColumn IS NULL )
        SET @CodeAndTitleColumn = '';

	DECLARE @ListLeftJoin NVARCHAR(MAX)
	
    SELECT @ListLeftJoin = STUFF(
    (   SELECT DISTINCT ' Left Join STF.TraceItem TrI' + CAST(TraceID AS VARCHAR(10))
                        + ' on TrI' + CAST(TraceID AS VARCHAR(10))
                        + '.TraceItemID = A.' + QUOTENAME(TraceID)
        FROM   STF.Trace
        WHERE  AccountLevelTypeID = 6
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @ListLeftJoin IS NULL )
        SET @ListLeftJoin = '';


    DECLARE @Invoice NVARCHAR(100) ,
            @ReturnedSaleInvoice NVARCHAR(100) ,
            @PosInvoice NVARCHAR(100),
            @ReturnPosInvoice NVARCHAR(100),
            @Internal NVARCHAR(100) ,
            @Export NVARCHAR(100);

    SELECT @ReturnedSaleInvoice = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'SaleDocumentBases'
           AND le.Item = 'ReturnedSaleInvoice'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Invoice = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'SaleDocumentBases'
           AND le.Item = 'Invoice'
           AND lev.Culture = CFG.GetuserCulture();
           
    SELECT @PosInvoice = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RevisionCostType'
           AND le.Item = 'PosInvoice'
           AND lev.Culture = CFG.GetuserCulture();    
           
    SELECT @ReturnPosInvoice = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RevisionCostType'
           AND le.Item = 'ReturnPosInvoice'
           AND lev.Culture = CFG.GetuserCulture();
                         


    SELECT @Internal = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'TradeType'
           AND le.Item = 'Internal'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Export = '''' + lev.[Value] + ''''
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'TradeType'
           AND le.Item = 'Export'
           AND lev.Culture = CFG.GetuserCulture();
           
		   
DECLARE @TableName1     NVARCHAR(MAX),
		@TableName2 NVARCHAR(MAX)
        
	SET @TableName1 = cfg.getTempTableName(1)

	SET @TableName2=cfg.getTempTableName(2)


EXEC SLE.RptSaleReviewDataSource
	@FromDate = @FromDate,
	@ToDate = @EndDate,
	@TableName = @TableName1,
	@SelectedStuff = @SelectedStuff,
	@SelectedCustomer = @Customer,
	@SelectedSaleModels = @SelectedSaleModels,
	@SelectedSaleGroup = @SelectedSaleGroup,
	@SelectedIds = @SelectedIds,
	@SelectedCustomerGroup = @SelectedCustomerGroup,
	@SelectedStuffGroup = @SelectedStuffGroup,
	@SelectedSaleType = NULL,
	@selectedBranch = @Branch,
	@SelectedSaleArea = @SelectedSaleArea,
	@CostOfBuyingType = @CostOfBuyingType,
	@Source = 2

    DECLARE @basePrecision INT = CFG.GetBaseCurrencyPrecision();

    DECLARE @tableName NVARCHAR(15) = CFG.getTempTableName(1);
    DECLARE @createTableTrace NVARCHAR(MAX);
    SELECT @createTableTrace = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(TraceID) + ' NVARCHAR(MAX)'
        FROM   STF.Trace
        FOR XML PATH(''), TYPE     ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    0   ,
    ''  );

    IF ( @createTableTrace IS NULL )
        SET @createTableTrace = ',[-1] NVARCHAR(MAX)';

    SET @query = '
CREATE TABLE ' + @tableName
                 + '
    (
        DocName NVARCHAR(100) ,
        DocType NVARCHAR(100) ,
        DocID INT ,
        Number INT ,
        [Date] DATE ,
        StuffID INT ,
        MainQuantity DECIMAL(30, 4) ,
        SubQuantity DECIMAL(30, 4) ,
        FeeInBaseCurrency DECIMAL(30, 4) ,
        PriceInBaseCurrency DECIMAL(30, 4) ,
        DiscountInBaseCurrency DECIMAL(30, 4) ,
        NetPriceInBaseCurrency DECIMAL(30, 4) ,
        Zarib INT ,
        SaleModelID SMALLINT ,
        SaleTypeID INT ,
        BranchID INT ,
        CustomerID BIGINT ,
        CostOfBuying DECIMAL(30, 4) 
		' + @createTableTrace + '
    );
'   ;

    EXEC ( @query );
    SET @query = N'INSERT ' + @tableName + N'
	SELECT '	+ @Invoice
				+ N' DocName,
				''invoice'' as DocType,
				i.HeaderID DocID,
				i.Number,
				i.Date,
				i.StuffID ,
				i.MainQuantity,
				i.SubQuantity,
				i.PriceInBaseCurrency/i.MainQuantity FeeInBaseCurrency,
				i.PriceInBaseCurrency   PriceInBaseCurrency,
				i.DiscountInBaseCurrency   as DiscountInBaseCurrency,
				i.PriceInBaseCurrency+i.DiscountInBaseCurrency   NetPriceInBaseCurrency,
				1 as Zarib,
				i.SaleModelID,
				i.SaleTypeID,
				i.BranchID , 
				i.CustomerID,
				i.CostOfBuying,
'                + @Columns
                 + '
		FROM   '+@TableName1 +N' i
				
		LEFT JOIN 
		(
		select InvoiceItemID,iit.TraceID,
                case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
                     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
                     when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
					 else Value 
                end value
		from sle.InvoiceItemTrace iit
		join stf.trace t on t.traceid = iit.traceid
		)x pivot
		(
		max(value)
		for traceid in (' + @Columns
                 + ')
		)p on p.InvoiceItemID = i.ItemID
	where i.Type=''Invoice'''   ;

    EXEC sp_executesql @query ,
                       N'	@DateType					TINYINT,
							@DateFormat					VARCHAR(10),
							@CostOfBuyingType			tinyint,
							@basePrecision				INT' ,
                       @DateFormat = @DateFormat ,
                       @DateType = @DateType ,
                       @CostOfBuyingType = @CostOfBuyingType ,
                       @basePrecision = @basePrecision;
                       
                       
                       
    

  SET @query = N'INSERT ' + @tableName + N'
	SELECT '     + @ReturnedSaleInvoice
                 + N' DocName,
				 ''Returninvoice'' as DocType,
				 i.HeaderID DocID,
				 i.Number,
				 i.Date,
				 i.StuffID ,
				 i.MainQuantity,
				 i.SubQuantity,
				i.PriceInBaseCurrency/i.MainQuantity FeeInBaseCurrency,
				i.PriceInBaseCurrency   PriceInBaseCurrency,
				i.DiscountInBaseCurrency   as DiscountInBaseCurrency,
				i.PriceInBaseCurrency+i.DiscountInBaseCurrency   NetPriceInBaseCurrency,
				1 as Zarib,
				i.SaleModelID,
				i.SaleTypeID,
				i.BranchID , 
				i.CustomerID,
				i.CostOfBuying,
'                + @Columns
                 + '
		FROM   '+@TableName1 +N' i
				
		LEFT JOIN 
		(
		select ReturnedSaleInvoiceItemID,iit.TraceID,
                case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
                     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
                     when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
					 else Value 
                end value
		from sle.ReturnedSaleInvoiceItemTrace iit
		join stf.trace t on t.traceid = iit.traceid
		)x pivot
		(
		max(value)
		for traceid in (' + @Columns
                 + ')
		)p on p.ReturnedSaleInvoiceItemID = i.ItemID 
	where  i.Type=''ReturnInvoice''

' 


    EXEC sp_executesql @query ,
                       N'	@DateType					TINYINT,
							@DateFormat					VARCHAR(10),
							@CostOfBuyingType			tinyint,
							@basePrecision				INT' ,
                       @DateFormat = @DateFormat ,
                       @DateType = @DateType ,
                       @CostOfBuyingType = @CostOfBuyingType ,
                       @basePrecision = @basePrecision;
                       

                       
 SET @query = N'INSERT ' + @tableName + N'
	SELECT ' + @PosInvoice+ N'  DocName,
				 ''PoseInvoice'' as DocType,
				 i.HeaderID DocID,
				 i.Number,
				 i.Date,
				 i.StuffID ,
				 i.MainQuantity,
				 i.SubQuantity,
				i.PriceInBaseCurrency/i.MainQuantity FeeInBaseCurrency,
				i.PriceInBaseCurrency   PriceInBaseCurrency,
				i.DiscountInBaseCurrency   as DiscountInBaseCurrency,
				i.PriceInBaseCurrency+i.DiscountInBaseCurrency   NetPriceInBaseCurrency,
				1 as Zarib,
				i.SaleModelID,
				i.SaleTypeID,
				i.BranchID , 
				i.CustomerID,
				i.CostOfBuying,
'                + @Columns
                 + '
		FROM   '+@TableName1 +N' i
		LEFT JOIN 
		(
		select PosInvoiceItemID,iit.TraceID,
                case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
                     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
                     when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
					 else Value 
                end value
		from Pos.PosInvoiceItemTrace iit
		join stf.trace t on t.traceid = iit.traceid
		)x pivot
		(
		max(value)
		for traceid in (' + @Columns
                 + ')
		)p on p.PosInvoiceItemID = i.ItemID 
	where i.Type=''PosInvoice''

' 
    EXEC sp_executesql @query ,
                       N'	@DateType					TINYINT,
							@DateFormat					VARCHAR(10),
							@CostOfBuyingType			tinyint,
							@basePrecision				INT' ,
                       @DateFormat = @DateFormat ,
                       @DateType = @DateType ,
                       @CostOfBuyingType = @CostOfBuyingType ,
                       @basePrecision = @basePrecision;         
                   
SET @query = N'INSERT ' + @tableName + N'
	SELECT '+@ReturnPosInvoice+N' DocName,
				''PoseInvoice'' as DocType,
				i.HeaderID DocID,
				i.Number,
				i.Date,
				i.StuffID ,
				i.MainQuantity,
				i.SubQuantity,
				i.PriceInBaseCurrency/i.MainQuantity FeeInBaseCurrency,
				i.PriceInBaseCurrency   PriceInBaseCurrency,
				i.DiscountInBaseCurrency   as DiscountInBaseCurrency,
				i.PriceInBaseCurrency+i.DiscountInBaseCurrency   NetPriceInBaseCurrency,
				1 as Zarib,
				i.SaleModelID,
				i.SaleTypeID,
				i.BranchID , 
				i.CustomerID,
				i.CostOfBuying,
'                + @Columns
                 + '
		FROM   '+@TableName1 +N' i
		LEFT JOIN 
		(
		select PosInvoiceItemID,iit.TraceID,
                case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
                     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
                     when AccountLevelTypeID = 5 then  CFG.GetClrSaturnDate(value, @DateFormat, 0, @DateType)
					 else Value 
                end value
		from Pos.PosInvoiceItemTrace iit
		join stf.trace t on t.traceid = iit.traceid
		)x pivot
		(
		max(value)
		for traceid in (' + @Columns
                 + ')
		)p on p.PosInvoiceItemID = i.ItemID 
	where i.Type=''PosReturnInvoice''

' 

    EXEC sp_executesql @query ,
                       N'	@DateType					TINYINT,
							@DateFormat					VARCHAR(10),
							@CostOfBuyingType			tinyint,
							@basePrecision				INT' ,
                       @DateFormat = @DateFormat ,
                       @DateType = @DateType ,
                       @CostOfBuyingType = @CostOfBuyingType ,
                       @basePrecision = @basePrecision;                                
                       

    SET @query = N' SELECT a.*,
	case when NetPriceInBaseCurrency=0 then 0.0 
	ELSE ROUND(( (a.NetPriceInBaseCurrency+a.CostOfBuying)/NetPriceInBaseCurrency)*100,2) END 
	AS ProfitAndLossPercent,
	a.PriceInBaseCurrency+a.DiscountInBaseCurrency as NetSaleInBaseCurrency
,ROW_NUMBER() over (order by DocName,DocID) RowID,
	   A.DocName, A.DocType, A.DocID, A.Number,  A.Date, CFG.GetClrSaturnDate(A.Date, @DateFormat, 0, @DateType) Date_Date, 
	   stf.Title StuffTitle,
	   stf.Code StuffCode,' + @ColumnsInSelectList
                 + ', A.MainQuantity,A.SubQuantity,A.FeeInBaseCurrency, A.PriceInBaseCurrency,A.DiscountInBaseCurrency,A.NetPriceInBaseCurrency, 
	   case WHEN A.PriceInBaseCurrency= 0 then 0 else  ABS((A.DiscountInBaseCurrency/A.PriceInBaseCurrency)*100)  end as DiscountPercent, 
	   sm.Code SaleModelCode, sm.Title SaleModelTitle,  sty.Title [TYPE] ' + @CodeAndTitleColumn
                 + ',
		b.Code BranchCode, b.Title BranchTitle, p.CustomerCode,
		ISNULL(p.Title,'''') + '' '' + ISNULL(p.LastName,'''') CustomerName,
		IsNull(CostOfBuying * -1* zarib,0) as CostOfBuying, 
		(NetPriceInBaseCurrency +isnull(CostOfBuying,0)) as ProfitAndLoss
from ' + @tableName + ' A
left join SLE.SaleType sty on A.SaleTypeID  =  sty.SaleTypeID
left JOIN stf.Stuff stf on stf.StuffID = A.StuffID
left JOIN sle.SaleModel sm on sm.SaleModelID = A.SaleModelID
left JOIN CFG.Branch b ON b.BranchID = A.BranchID
left JOIN CFG.Party p ON p.PartyID = A.CustomerID ' + @LeftJoin + ' ' +@ListLeftJoin+N' ';
    --Remove BY Shahram  Confirm
    --where  A.PriceInBaseCurrency > 0

   
    SET @param = N'
		@pFromDate					date, 
		@pEndDate					date ,
		@pCustomer					nvarchar(max),
		@pBranch					nvarchar(max),
		@pSelectedStuff				nvarchar(max) ,
		@pSelectedSaleModels		nvarchar(max),
		@pSelectedSaleGroup			nvarchar(max),
		@pSelectedIds				nvarchar(max),
		@DateType					TINYINT,
	    @DateFormat					VARCHAR(10),
	    @CostOfBuyingType			tinyint,
		@basePrecision				INT';

    EXECUTE sp_executesql @query ,
                          @param ,
                          @pFromDate = @FromDate ,
                          @pEndDate = @EndDate ,
                          @pCustomer = @Customer ,
                          @pBranch = @Branch ,
                          @pSelectedStuff = @SelectedStuff ,
                          @pSelectedSaleModels = @SelectedSaleModels ,
                          @pSelectedSaleGroup = @SelectedSaleGroup ,
                          @pSelectedIds = @SelectedIds ,
                          @DateType = @DateType ,
                          @DateFormat = @DateFormat ,
                          @CostOfBuyingType = @CostOfBuyingType ,
                          @basePrecision = @basePrecision;

    IF OBJECT_ID('tempdb..' + @tableName) IS NOT NULL
    BEGIN
        EXEC ( 'drop table ' + @tableName );

    END;
