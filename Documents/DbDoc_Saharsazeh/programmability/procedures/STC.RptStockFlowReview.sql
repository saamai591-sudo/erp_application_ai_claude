
------------------------------------- START #8324
Create   PROC [STC].RptStockFlowReview
(
    @FromDate						DATETIME = NULL,
    @ToDate							DATETIME = NULL,
    @SelectedStuffs					NVARCHAR(MAX) = NULL,
    @SelectedStocks					NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace				NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup		NVARCHAR(MAX) = NULL,
    @SelectedDl						NVARCHAR(MAX) = NULL,
    @SelectedStockDocumentType		NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup				NVARCHAR(MAX) = NULL,
    @ReviewType						INT, ----1 Quantity   ------ 2   Amount
	@RemainedInLine BIT
)
--WITH ENCRYPTION 
AS
BEGIN
	DECLARE @Columns                  NVARCHAR(MAX),
	        @query                    NVARCHAR(MAX),
	        @param                    NVARCHAR(MAX),
	        @CodeAndTitleColumn       NVARCHAR(MAX),
	        @LeftJoin                 NVARCHAR(MAX),
	        @ColumnsInCreateTable     NVARCHAR(MAX),
	        @CodeAndTitleColumnInCreateTable NVARCHAR(MAX),
	        @UserID                   INT,
	        @DateType                 NVARCHAR(10),
	        @DateFormat               NVARCHAR(10),
	        @Culture                  NVARCHAR(10),
	        @FinancialPeriod          INT;
	
	SELECT @FinancialPeriod = FinancialPeriodID
	FROM   CFG.FinancialPeriod
	WHERE  @FromDate
	       BETWEEN StartDate AND EndDate;
	
	SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
	
	DECLARE @CultureNo TINYINT;
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	   	
	DECLARE @TableName      NVARCHAR(255),
	        @IndexName      NVARCHAR(255),
	        @TableName1     NVARCHAR(255),
	        @StuffInfo           NVARCHAR(MAX);
	
	SET @TableName = CFG.getTempTableName(1);
	SET @TableName1 = CFG.getTempTableName(1);
	SET @StuffInfo = CFG.getTempTableName(1);
	SET @IndexName = CFG.getTempTableName(0);
	
set @DateType = cfg.GetCurrentUserDateType()	
set @DateFormat = cfg.GetCurrentUserDateFormat()
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@Columns IS NULL)
	    SET @Columns = N'[-1]';
	
	SELECT @CodeAndTitleColumn = STUFF(
	           (
	               SELECT DISTINCT
	                      ' ,d' + CAST(TraceID AS NVARCHAR(10)) + '.Code [' + CAST(TraceID AS NVARCHAR(10)) + 'Code],d'
	                      + CAST(TraceID AS NVARCHAR(10)) + '.Title [' + CAST(TraceID AS NVARCHAR(10)) + 'Title]'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@CodeAndTitleColumn IS NULL)
	    SET @CodeAndTitleColumn = N'';
	
	SELECT @LeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join acc.dl d' + CAST(TraceID AS NVARCHAR(10)) + ' on d' + CAST(TraceID AS NVARCHAR(10))
	                      + '.DlID = A.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@LeftJoin IS NULL)
	    SET @LeftJoin = N'';
	
	DECLARE @listLeftJoin NVARCHAR(MAX);
	SELECT @listLeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join STF.TraceItem d' + CAST(TraceID AS NVARCHAR(10)) + ' on d' + CAST(TraceID AS NVARCHAR(10))
	                      + '.TraceItemID = A.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  AccountLevelTypeID = 6
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@listLeftJoin IS NULL)
	    SET @listLeftJoin = N'';
	SELECT @ColumnsInCreateTable = STUFF(
	           (
	               SELECT DISTINCT
	                      'T' + CAST(TraceID AS NVARCHAR(10)) + ' NVARCHAR(MAX),'
	                      + CASE 
	                             WHEN AccountLevelTypeID = 6 THEN 'T' + CAST(TraceID AS NVARCHAR(10)) + 
	                                  'Title NVARCHAR(MAX),'
	                             ELSE ''
	                        END
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       );
	
	IF (@ColumnsInCreateTable IS NULL)
	    SET @ColumnsInCreateTable = N'[-1] int,';
	
	SELECT @CodeAndTitleColumnInCreateTable = STUFF(
	           (
	               SELECT DISTINCT
	                      ',[T' + CAST(TraceID AS NVARCHAR(10)) + 'Code] NVARCHAR(MAX), ' + '[T' + CAST(TraceID AS NVARCHAR(10))
	                      + 'Title] NVARCHAR(MAX)'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       );
	
	IF (@CodeAndTitleColumnInCreateTable IS NULL)
	    SET @CodeAndTitleColumnInCreateTable = N'';
	
	SET @query = N'CREATE TABLE ' + @TableName
	    + 
	    N'
			(
			ResItemID               INT,
			RowIndex				INT,
	    	DocName             nvarchar(max),
	    	[Description] nvarchar(MAX),
	    	Description2  nvarchar(MAX),
	    	DocType				tinyint,
	    	HeaderID         int,
			ItemID			 int,
	    	Number           int,
	    	Type		 nvarchar(255),
	    	CodeType             INT,
	    	MainMeasureUnit        nvarchar(max),
	    	SubMeasureUnit         nvarchar(max),
	    	Date  Date,
	    	Date_Date  nvarchar(255),
	    	StuffTitle   nvarchar(Max),
	    	StuffCode               nvarchar(max),
	    	StuffGroupCode nvarchar(max) ,
	    	GroupTitle  nvarchar(max),
	    	AccountGroup  nvarchar(max),
	    	StuffType  nvarchar(max),
	    	StockCode int,
	    	StockTitle nvarchar(max),
	    	DeliverCode nvarchar(max),
	    	DeliverTitle  nvarchar(max), ' + @ColumnsInCreateTable + 
	    N'
			BaseDoc nvarchar(max),
			BaseDocNumber int,
			MainQuantity decimal(36,10),
			SubQuantity decimal(36,10),' +
	    CASE 
	         WHEN @ReviewType = 2 THEN 
	              N'Fee decimal(36,10),
			PrimaryPrice decimal(36,10),
			SumRevision decimal(36,10),
			Price decimal(36,10),
			InLine decimal(36,10),'
	         ELSE ''
	    END + N'
			SubInline decimal(36,10),
			QuantityInLine decimal(36,10),
			InvoiceNumber INT' + @CodeAndTitleColumnInCreateTable + N',
			CONSTRAINT [' + @IndexName
	    + 
	    N'] PRIMARY KEY CLUSTERED 
		([ResItemID] ASC
		)WITH (PAD_INDEX  = OFF, STATISTICS_NORECOMPUTE  = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS  = ON, ALLOW_PAGE_LOCKS  = ON) ON [PRIMARY]
		) ON [PRIMARY]';
	
	EXEC (@query);
	
	DECLARE @Receipt             NVARCHAR(100),
	        @ReturnReceipt       NVARCHAR(100);
	
	SELECT @Receipt = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'StockReceipt'
	       AND lev.Culture = @Culture;
		   	
	SELECT @ReturnReceipt = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'ReturnStockReceipt'
	       AND lev.Culture = @Culture;
	
	
	
	--------------------------
	DECLARE @Outgoing                    NVARCHAR(100),
	        @ReturnedOutgoing            NVARCHAR(100),
	        @PosInvoiceStockDocumentType INT;
	
	SELECT @Outgoing = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'Outgoing'
	       AND lev.Culture = @Culture;
	
	SELECT @ReturnedOutgoing = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'ReturnedOutgoing'
	       AND lev.Culture = @Culture;
	
select * into #vwEnums 
from cfg.VwEnums
where Enum in ('StuffDetailTypes','SaleDocumentBases')
---------------------------------------
	
	DECLARE @Justification     NVARCHAR(100),
	        @Quotation         NVARCHAR(100),
	        @Remittance        NVARCHAR(100),
	        @Invoice           NVARCHAR(100),
	        @StuffRequest      NVARCHAR(100);
	
	SELECT @Justification = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Justification'
	       AND lev.Culture = @Culture;
	
	SELECT @Quotation = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Quotation'
	       AND lev.Culture = @Culture;
	
	SELECT @Remittance = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Remittance'
	       AND lev.Culture = @Culture;
	
	SELECT @Invoice = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'SaleDocumentBases'
	       AND le.Item = 'Invoice'
	       AND lev.Culture = @Culture;
	
	SELECT @StuffRequest = N'''' + lev.[Value] + N''''
	FROM   CFG.LocalizeEnum le
	       JOIN CFG.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'DocumentNumTypes'
	       AND le.Item = 'StuffRequest'
	       AND lev.Culture = @Culture;
	
	DECLARE @PrecisionDigit NVARCHAR;
	
	SET @PrecisionDigit = CFG.GetBaseCurrencyPrecision();
	
	---------------------------------------	
	
	SELECT @ColumnsInCreateTable = STUFF(
	           (
	               SELECT DISTINCT
	                      QUOTENAME(TraceID) + ' NVARCHAR(MAX),'
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           0,
	           ''
	       );
	
	
	SELECT VALUE StockID 
		INTO #SelectedStocks
		FROM      CFG.R_FnCommaStr2Table(@SelectedStocks)  
		group by VALUE
	
		SELECT s.* 
		INTO #vwStockAccess
		FROM cfg.vwStockAccess AS s 
		LEFT JOIN #SelectedStocks ss ON s.StockID = ss.StockID
		WHERE (@SelectedStocks IS NULL OR ss.StockID IS NOT NULL)
		
		SELECT VALUE DlID
		INTO   #SelectedDl
		FROM   CFG.R_FnCommaStr2Table(@SelectedDl)

		SELECT VALUE StuffTraceID
		INTO   #SelectedStuffTrace
		FROM   CFG.R_FnCommaStr2Table(@SelectedStuffTrace)
		group by VALUE

		SELECT VALUE StuffAccountGroupID
		INTO   #SelectedStuffAccountGroup
		FROM   CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup)
		group by VALUE

		SELECT VALUE StuffGroupID
		INTO   #SelectedStuffGroup
		FROM   CFG.R_FnCommaStr2Table(@SelectedStuffGroup)
		group by VALUE

		SELECT VALUE StuffID
		INTO   #SelectedStuff
		FROM   CFG.R_FnCommaStr2Table(@SelectedStuffs)          
		group by VALUE
		
		-------------------------------------StockDocumentType
		SELECT VALUE StockDocumentTypeID
		INTO   #SelectedStockDocumentType
		FROM   CFG.R_FnCommaStr2Table(@SelectedStockDocumentType)  
		GROUP BY [value]
		
		SELECT sdt.* INTO #StockDocument
		FROM stc.StockDocumentType AS sdt 
		JOIN cfg.vwStockDocumentsAccess AS vsda ON vsda.StockDocumentTypeID = sdt.StockDocumentTypeID
		LEFT JOIN #SelectedStockDocumentType ssdt ON sdt.StockDocumentTypeID = ssdt.StockDocumentTypeID
		WHERE (@SelectedStockDocumentType IS NULL OR ssdt.StockDocumentTypeID IS NOT NULL)
		--StockDocumentTypeEnd------------------------------------
	
		---------------------------------Find PosInvoiceStockDocumentType
		SELECT @PosInvoiceStockDocumentType = StockDocumentTypeID
		FROM   #StockDocument AS sdt
		WHERE  sdt.[Type] = 2
       AND sdt.DocumentType = 17
		-- End of Find PosInvoiceStockDocumentType-----------------------
	
	set @query = N'
		select a.StuffID,a.Type,a.StuffGroupID,b.StuffAccountGroupID,sag.StuffDetailType
		into '+@stuffInfo+N'
		from stf.stuff a 
		join stf.StuffDetail b on a.StuffID = b.StuffID
		join stf.StuffAccountGroup sag on b.StuffAccountGroupID = sag.StuffAccountGroupID
		left join #SelectedStuffAccountGroup ssag on ssag.StuffAccountGroupID = b.StuffAccountGroupID
		left join #SelectedStuffGroup ssg on ssg.StuffGroupID = a.StuffGroupID
		left join #SelectedStuff ss on ss.StuffID = a.StuffID
		where (@SelectedStuffAccountGroup IS NULL OR ssag.StuffAccountGroupID is not null)
		AND   (@SelectedStuffGroup IS NULL OR ssg.StuffGroupID is not null)
		AND (@SelectedStuff IS NULL OR ss.StuffID is not null )'
			
	EXECUTE sp_executesql @query,
			N'    @SelectedStuffAccountGroup    NVARCHAR(MAX),
					@SelectedStuffGroup           NVARCHAR(MAX),
					@SelectedStuff				NVARCHAR(MAX)',
					@SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
					@SelectedStuffGroup = @SelectedStuffGroup,
					@SelectedStuff = @SelectedStuffs
	
	IF @ReviewType = 2
	BEGIN
	    SELECT ri.StockReceiptItemID,
	           ri.ReturnStockReceiptItemID,
	           ri.OutgoingItemID,
	           ri.ReturnedOutgoingItemID,
	           SUM(Deference) RevisionPrice
	    INTO   #RevisionCost
	    FROM   STC.RevisionCost h
	           JOIN STC.RevisionCostItem ri
	                ON  h.RevisionCostID = ri.RevisionCostID
	    WHERE  FinancialPeriodID = @FinancialPeriod
	    GROUP BY
	           ri.StockReceiptItemID,
	           ri.ReturnStockReceiptItemID,
	           ri.OutgoingItemID,
	           ri.ReturnedOutgoingItemID
	END                                        
	
	IF (@ColumnsInCreateTable IS NULL)
	    SET @ColumnsInCreateTable = N'[-1] int,';
	
	SET @query = N'CREATE TABLE ' + @TableName1
	    + 
	    N' (
			RowIndex		INT,
			DocType			tinyint,
			[Description] nvarchar(MAX),
	    	Description2  nvarchar(MAX),
			DocName             nvarchar(255),
			HeaderID         int,
			ItemID			 int,
	    	Number           int,
	    	Type		 nvarchar(255),
	    	CodeType             INT,
	    	Date  nvarchar(255),
	    	StuffID             INT,
	    	StockID        INT,
	    	DeliverDlID         bigint,
			DeliverStockID int,
	    	BaseDoc nvarchar(255),
			BaseDocNumber int,' + @ColumnsInCreateTable +    N'
			MainQuantity decimal(36,10),
			SubQuantity decimal(36,10),' + CASE 
	                                     WHEN @ReviewType = 2 THEN 
	    N'  Fee decimal(36,10),
			PrimaryPrice decimal(36,10),
			SumRevision decimal(36,10),
			Price decimal(36,10),			
			InLine decimal(36,10),' ELSE '' END +N'
			PurchaseInvoiceItemID INT)';
	
	EXEC (@query);
	
	SET @param = 
	    N' @pFromDate date, 
				 	@pEndDate date ,
					@pSelectedStocks nvarchar(max),
					@pFinicialPeriodID int,
				    @pSelectedStuffs nvarchar(max), 
					@SelectedStuffTrace nvarchar(max),
					@SelectedStuffAccountGroup nvarchar(max) ,
					@SelectedStuffGroup nvarchar(max),
					@PosInvoiceStockDocumentType int = Null,
					@SelectedDl nvarchar(max)  = Null';
	
	SET @query = N'insert into ' + @TableName1 + 
	    N' select ii.RowIndex, 1 DocType,ii.[Description],ii.Description2, N' + @Receipt
	    + N' DocName,i.StockReceiptID HeaderID, ii.StockReceiptItemID ItemID,
					 i.Number,
					 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sdt.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
	    + 
	    N' = 2 then sdt.Title2
	                 end,
					 sdt.DocumentType,i.Date,ii.StuffID ,i.StockID,
	DeliverDlID,DeliverStockID,NULL AS BaseDoc,NULL AS BaseDocNumber,' + @Columns
	    + N',ii.MainQuantity,ii.SubQuantity,' + CASE 
	                                                 WHEN @ReviewType = 2 THEN 
	                                                      N'
	CASE WHEN ii.Price <> 0 THEN  ROUND((ii.Price +ii.ShareOfCosts+isnull(Revision.RevisionPrice,0)) /ii.MainQuantity ,4) 
	ELSE ROUND((ii.EstimatedPrice  +ii.ShareOfCosts+isnull(Revision.RevisionPrice,0)) /ii.MainQuantity ,4) end  AS Fee,
	ii.NetPrice PrimaryPrice,
	isnull(Revision.RevisionPrice,0) SumRevision,
	 ii.netprice + isnull(Revision.RevisionPrice,0)  AS Price,
	0 as InLine, '
	                                                 ELSE ''
	                                            END + 
	    N'
	case when ii.PurchaseInvoiceItemID is not null then ii.PurchaseInvoiceItemID
	when otherRelItem.StockReceiptItemID is not null then otherRelItem.PurchaseInvoiceItemID
	else null
	end PurchaseInvoiceItemID
from STC.StockReceipt i 
INNER JOIN STC.StockReceiptItem ii on i.StockReceiptID = ii.StockReceiptID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
JOIN '+@StuffInfo +N' s ON s.StuffID = ii.StuffID
INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
LEFT JOIN VND.PurchaseInvoiceItem otherRelItem ON otherRelItem.StockReceiptItemID = ii.StockReceiptItemID' + CASE 
WHEN @ReviewType = 2 THEN                                                                       
N' LEFT JOIN #RevisionCost Revision on  Revision.StockReceiptItemID = ii.StockReceiptItemID'  ELSE '' END + 
N' 
LEFT JOIN 
(
select StockReceiptItemID,iit.TraceID,
		case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  		     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
  		     when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType
	    + 
	    N''')
								  else Value end value
								 from STC.StockReceiptItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
	    + 
	    N')
)p on p.StockReceiptItemID = ii.StockReceiptItemID 
where	i.date between @pFromDate AND @pEndDate'+CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		and s.StuffDetailType<>9
		' ELSE N'' END +N'
		and sdt.DocumentType = 7
		and i.financialperiodid = @pFinicialPeriodID
		AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + 
N'))
		AND (@pSelectedStocks is null or i.StockID in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pSelectedStocks)))' ;
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @SelectedDl = @SelectedDl;
		
	SET @query = N'insert into ' + @TableName1 + 
	    N'
	select ii.RowIndex,1 DocType,ii.[Description],ii.Description2, N' + @Receipt
	    + N' DocName,i.StockReceiptID HeaderID, ii.StockReceiptItemID ItemID,
					 i.Number,
					 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sdt.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
	    + 
	    N' = 2 then sdt.Title2
	                 end,
					 sdt.DocumentType,i.Date,ii.StuffID ,i.StockID,
	DeliverDlID,DeliverStockID,NULL AS BaseDoc,NULL AS BaseDocNumber,' + @Columns
	    + N',ii.MainQuantity,ii.SubQuantity,' + CASE 
	                                                 WHEN @ReviewType = 2 THEN 
	                                                      N' 
	CASE WHEN ii.Price <> 0 THEN  ROUND((ii.Price +ii.ShareOfCosts+isnull(Revision.RevisionPrice,0)) /ii.MainQuantity ,4) 
	ELSE ROUND((ii.EstimatedPrice  +ii.ShareOfCosts+isnull(Revision.RevisionPrice,0)) /ii.MainQuantity ,4) end  AS Fee,
	ii.NetPrice PrimaryPrice,
	isnull(Revision.RevisionPrice,0) SumRevision,
	 ii.netprice + isnull(Revision.RevisionPrice,0)  AS Price,
	0 as InLine,'
	ELSE '' END +  N'
	
	case when ii.PurchaseInvoiceItemID is not null then ii.PurchaseInvoiceItemID
	when otherRelItem.StockReceiptItemID is not null then otherRelItem.PurchaseInvoiceItemID
	else null
	end PurchaseInvoiceItemID

from STC.StockReceipt i 
INNER JOIN STC.StockReceiptItem ii on i.StockReceiptID = ii.StockReceiptID
JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
JOIN  '+@StuffInfo +N' s ON s.StuffID = ii.StuffID
INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
LEFT JOIN VND.PurchaseInvoiceItem otherRelItem ON otherRelItem.StockReceiptItemID = ii.StockReceiptItemID
JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID' + 
CASE  WHEN @ReviewType = 2 THEN 
	N'	LEFT JOIN #RevisionCost Revision on  Revision.StockReceiptItemID = ii.StockReceiptItemID '
ELSE '' END + 
	    N'
LEFT JOIN 
(
select StockReceiptItemID,iit.TraceID,
		case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  		     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
			 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType
	    + 
	    N''')
								  else Value end value
								 from STC.StockReceiptItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
	    + 
	    N')
)p on p.StockReceiptItemID = ii.StockReceiptItemID 
where i.date between @pFromDate AND @pEndDate
	AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + N'))
	AND sdt.DocumentType <> 7
'+CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		AND s.StuffDetailType<>9
		' ELSE N'' END  ;

	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @SelectedDl = @SelectedDl;
		 	
	SET @query = N'INSERT INTO ' + @TableName1 + 
	    N'
		SELECT ii.RowIndex,
			   4 DocType,
			   ii.[Description],
			   ii.Description2, N' + @ReturnReceipt + 
	    N' DocName,
			   i.ReturnStockReceiptID HeaderID,
               ii.ReturnStockReceiptItemID ItemID,
			   i.Number,
			   CASE 
					WHEN ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sdt.Title
			        WHEN ' + CAST(@CultureNo AS CHAR(1)) + 
	    N' = 2 then sdt.Title2	  
			   END,	 
               sdt.DocumentType,
			   i.Date,ii.StuffID,
			   i.StockID,
	           DeliverDlID,
			   DeliverStockID,
			   CASE 
				    WHEN ii.StockReceiptItemID IS NULL THEN NULL 
					ELSE N' + @Receipt + 
	    N'   
			   END AS BaseDoc,
			   CASE 
					WHEN ii.StockReceiptItemID IS NULL THEN NULL 
			   ELSE (
			   		SELECT top 1 rr.Number 
			   		FROM STC.StockReceipt rr
			   			 JOIN STC.StockReceiptItem rri ON rr.StockReceiptID = rri.StockReceiptID
			   		WHERE rri.StockReceiptItemID = ii.StockReceiptItemID
			   )
			   END AS BaseDocNumber,' + @Columns + N',
			   -ii.MainQuantity,
			   -ii.SubQuantity,' + CASE 
	                              WHEN @ReviewType = 2 THEN 
	                                   N' 
			   (-1) * (ii.Price + isnull(Revision.RevisionPrice,0))/ii.MainQuantity AS Fee,
               (-1) * ii.Price as PrimaryPrice,
			   (-1) * isnull(Revision.RevisionPrice,0) SumRevision,
			   (-1) * (ii.Price+isnull(Revision.RevisionPrice,0)),
			   0 as InLine,'
	                              ELSE ''
	                         END + 
	    N'0
		FROM STC.ReturnStockReceipt i 
			 INNER JOIN STC.ReturnStockReceiptItem ii ON i.ReturnStockReceiptID = ii.ReturnStockReceiptID
			 JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			 join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
			 JOIN  '+@StuffInfo +N'  s ON s.StuffID = ii.StuffID
			 JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID 
			 INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID' + CASE 
	                                                                                             WHEN @ReviewType = 2 THEN 
	                                                                                                  N'
			 LEFT JOIN #RevisionCost Revision ON Revision.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID'
	                                                                                             ELSE ''
	                                                                                        END + 
	    N' 	
			 LEFT JOIN  (
				SELECT  ReturnStockReceiptItemID,iit.TraceID,
						CASE WHEN AccountLevelTypeID = 1 then  cast (DLID as nvarchar(MAX))
				  		     WHEN AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(MAX))
							 WHEN AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + 
	    N'''  , 0,''' + @DateType + 
	    N''')
				        ELSE Value 
						END value 								  
				FROM STC.ReturnStockReceiptItemTrace iit
					 JOIN stf.trace t ON t.traceid = iit.traceid
			 ) x pivot
			 (
				MAX(value)
				for traceid in (' + @Columns + 
	    N')      
             )p ON p.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID 
		WHERE i.date between @pFromDate AND @pEndDate
		AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + N'))
			  '+CASE WHEN @ReviewType = 2 THEN N'
				AND s.StuffDetailType <> 3		
				and s.StuffDetailType<>9
			' ELSE N'' END ;
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @SelectedDl = @SelectedDl;
	
	SET @query = N'insert into ' + @TableName1 + 
	    N' select ii.RowIndex,3 DocType,ii.[Description],ii.Description2, N' + @Outgoing
	    + N' DocName,i.OutgoingID HeaderID,ii.OutgoingItemID ItemID,
					 i.Number,
					 case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sdt.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))   + 
	    N' = 2 then sdt.Title2
	                 end,
					 sdt.DocumentType,i.Date,ii.StuffID ,i.StockID,
	DeliverDlID,DeliverStockID,
	CASE  WHEN sbd.Enum is not null then sbd.Value
		  WHEN sdt.DocumentType = 2 AND ii.StuffRequestItemID IS NOT NULL THEN N' + @StuffRequest
	    + 
	    N'
		  ELSE NULL END AS BaseDoc,
	CASE  WHEN sdtb.BaseEntity = 3 THEN (SELECT TOP 1 j.Number
		                                    FROM sle.Justification j 
		                                    JOIN sle.JustificationItem ji ON j.JustificationID = ji.JustificationID
		                                    WHERE ji.JustificationItemID = ii.JustificationItemID)
		  WHEN sdtb.BaseEntity = 4 THEN (SELECT TOP 1 q.Number
							                FROM sle.Quotation q 
											JOIN sle.QuotationItem qi ON q.QuotationID = qi.QuotationID
							                WHERE qi.QuotationItemID = ii.QuotationItemID)
		  WHEN sdtb.BaseEntity = 5 THEN (SELECT TOP 1 r.Number
							                FROM sle.Remittance r
											JOIN sle.RemittanceItem ri ON r.RemittanceID = ri.RemittanceID
							                WHERE ri.RemittanceItemID = ii.RemittanceItemID)
		  WHEN sdtb.BaseEntity = 6 THEN (SELECT TOP 1 i2.Number
							                FROM sle.Invoice i2
											JOIN sle.InvoiceItem ii2 ON i2.InvoiceID = ii2.InvoiceID
							                WHERE ii2.InvoiceItemID = ii.InvoiceItemID)
		  WHEN sdt.DocumentType = 2 AND ii.StuffRequestItemID IS NOT NULL 
								 THEN(SELECT TOP 1 sr.StuffRequestNumber
							                FROM req.StuffRequest sr
											JOIN req.StuffRequestItem sri ON sr.StuffRequestID = sri.StuffRequestID
							                WHERE sri.StuffRequestItemID = ii.StuffRequestItemID)
		ELSE NULL END AS BaseDocNumber,' + @Columns
	    + N',-ii.MainQuantity,-ii.SubQuantity,' + CASE WHEN @ReviewType = 2 THEN 
	                                                        N'
			(-1) * (ii.Price + isnull(Revision.RevisionPrice,0))/ii.MainQuantity AS Fee,
			(-1) * ii.Price as PrimaryPrice,
			(-1) * isnull(Revision.RevisionPrice,0) SumRevision,
			(-1) * (ii.Price + isnull(revision.RevisionPrice,0)),
	0 as InLine,'
	 ELSE ''  END +  N'0
	from STC.Outgoing i 
	JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
		ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		left join #vwEnums sbd on sbd.KeyValue = sdtb.BaseEntity and sbd.Enum = ''SaleDocumentBases''
	     INNER JOIN STC.OutgoingItem ii on i.OutgoingID = ii.OutgoingID
		 join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
	     JOIN  '+@StuffInfo +N'  s ON s.StuffID = ii.StuffID
	     JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
		 JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		 INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID' + CASE  WHEN @ReviewType = 2 THEN 
	          N' LEFT JOIN #RevisionCost Revision on  Revision.OutgoingItemID = ii.OutgoingItemID'
			ELSE ''  END + 
	    N' 
	     LEFT JOIN (
	                 select OutgoingItemID,
					        iit.TraceID,
					        case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					             when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					        	 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + 
	    N'''  , 0,''' + @DateType + 
	    N''')
					        else Value end value  
					 from STC.OutgoingItemTrace iit			  
					       join stf.trace t on t.traceid = iit.traceid				 
									
         ) x pivot
	     (
	       max(value)
	       for traceid in (' + @Columns + 
	    N')
	     )p on p.OutgoingItemID = ii.OutgoingItemID 
	WHERE i.Date between @pFromDate AND @pEndDate
		AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) +N'))
		'+CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		and s.StuffDetailType<>9
		' ELSE N'' END  ;
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @SelectedDl = @SelectedDl;

	SET @query = N'insert into ' + @TableName1 + 
	    N'
	select ii.RowIndex,
		   2 DocType,
		   ii.[Description],
		   ii.Description2,
		   N' + @ReturnedOutgoing + 
	    N' DocName,
		   i.ReturnedOutgoingID HeaderID,
		   ii.ReturnedOutgoingItemID ItemID,i.Number,			 
		   case 
		   	when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sdt.Title
		       when ' + CAST(@CultureNo AS CHAR(1)) + 
	    N' = 2 then sdt.Title2
		   end,
		   sdt.DocumentType,
		   i.Date,ii.StuffID ,
		   i.StockID,
		   i.DlDeliverID as DeliverDlID,
		   i.StockDeliverID as DeliverStockID,
		   NULL AS BaseDoc,
		   NULL AS BaseDocNumber,' + @Columns + N',
		   ii.MainQuantity,
		   ii.SubQuantity,' + CASE   WHEN @ReviewType = 2 THEN 
	    N' (ii.Price + isnull(Revision.RevisionPrice,0))/ii.MainQuantity AS Fee,      
		   ii.Price as PrimaryPrice,		 	 
		   ISNULL(Revision.RevisionPrice,0) SumRevision,
		   ii.Price + isnull(Revision.RevisionPrice,0),
		   0 as InLine,' ELSE '' END + 
	    N'0
     from STC.ReturnedOutgoing i 
		  JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		  INNER JOIN STC.ReturnedOutgoingItem ii on i.ReturnedOutgoingID = ii.ReturnedOutgoingID		  
		  join #StockDocument sdt on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
		  JOIN  '+@StuffInfo +N'  s ON s.StuffID = ii.StuffID
		  JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID
		  JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		  INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID' + CASE  WHEN @ReviewType = 2 THEN 
	                                                                                                  N'
	      LEFT JOIN #RevisionCost Revision on Revision.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID'
	                                                                                             ELSE ''
	                                                                                        END + 
	    N'
          LEFT JOIN 
          (
	      	select ReturnedOutgoingItemID,iit.TraceID,
	      			case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
	      	  		     when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
	      				 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' 
	    + @DateType + 
	    N''')
	      	        else Value end value  
	      			from STC.ReturnedOutgoingItemTrace iit						  
	      				 join stf.trace t on t.traceid = iit.traceid						 
	       )x pivot								 						
          (
	  		max(value)
	  	    for traceid in (' + @Columns + 
	    N')          
          )p on p.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID 
     where i.date between @pFromDate   AND @pEndDate
     AND (@SelectedDl IS NULL OR i.DlDeliverID IN (' + ISNULL(@SelectedDl, 0) + N'))' 
	 + CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		and s.StuffDetailType<>9
		' ELSE N'' END  ;
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @SelectedDl = @SelectedDl;
	
	---------------------- store sale ----------------------
	SELECT a.PosInvoiceID,
	       a.Date,
	       a.StockID,
	       IsReturnInvoice,
	       a.CustomerID,
	       a.FinancialPeriodID,
	       a.Number,
	       p.DlID AS DeliverDlID
	INTO   #FreePosInvoice
	FROM   pos.PosInvoice a
	JOIN cfg.Party AS p ON p.PartyID = a.CustomerID
	WHERE  deliverd = 0
	       AND a.date BETWEEN @FromDate AND @todate
	       AND a.Status = 1
	
	DECLARE @posInvoice           NVARCHAR(MAX),
	        @posReturnInvoice     NVARCHAR(MAX);
	
	SELECT @posInvoice = N'''' + [lsq].[Value] + N''''
	FROM   CFG.LocalizationSQLMessage ls
	       JOIN CFG.LocalizationSQLMessageValue lsq
	            ON  lsq.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
	WHERE  SQLMessageCode = 'PosInvoice'
	       AND lsq.Culture = CFG.GetuserCulture();
	
	SELECT @posReturnInvoice = N'''' + [lsq].[Value] + N''''
	FROM   CFG.LocalizationSQLMessage ls
	       JOIN CFG.LocalizationSQLMessageValue lsq
	            ON  lsq.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
	WHERE  SQLMessageCode = 'PosReturnInvoice'
	       AND lsq.Culture = CFG.GetuserCulture();
	
	SET @query = N'insert into ' + @TableName1 + N'
		SELECT ii.RowIndex,10 DocType ,
				'''' ,
				'''' ,
				N' + @posInvoice + 
	    N' DocName ,
				i.PosInvoiceID HeaderID ,
				ii.PosInvoiceItemID ItemID ,
				i.Number ,
				'''' ,
				NULL ,
				i.Date ,
				ii.StuffID ,
				i.StockID ,
				pa.DlID DeliverDlID ,
				NULL ,
				NULL AS BaseDoc ,
				NULL AS BaseDocNumber ,
				' + @Columns + N' ,
				-ii.MainQuantity ,
				-ii.SubQuantity ,' + CASE 
	                             WHEN @ReviewType = 2 THEN 
	                                  N'
				ROUND( isnull(ii.Cost / ii.MainQuantity,0), 4) AS Fee ,
				0,
				0,
				(-1) * isnull(ii.Cost,0) AS Price ,
				0 AS InLine ,'
	                             ELSE ''
	                        END + 
	    N' 
				0 PurchaseInvoiceItemID
		 FROM   #FreePosInvoice i
				INNER JOIN POS.PosInvoiceItem ii ON ii.PosInvoiceID = i.PosInvoiceID
				join #StockDocument sdt on @PosInvoiceStockDocumentType = sdt.StockDocumentTypeID
				JOIN CFG.Party  pa ON pa.PartyID = i.CustomerID
				JOIN  '+@StuffInfo +N' s ON s.StuffID = ii.StuffID
				JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID 
				JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			    INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
				LEFT JOIN ( SELECT  iit.PosInvoiceItemID ,
									iit.TraceID ,
									CASE WHEN AccountLevelTypeID = 1 THEN CAST (DlID AS NVARCHAR(MAX))
										 WHEN AccountLevelTypeID = 6 THEN CAST (TraceItemID AS NVARCHAR(MAX))
										 WHEN AccountLevelTypeID = 5 THEN CFG.GetCLRSaturnDate(Value, ''' + @DateFormat + 
	    N'''  , 0,''' + @DateType + 
	    N''')
										 ELSE Value
									END value
							FROM    POS.PosInvoiceItemTrace iit
									JOIN STF.Trace t ON t.TraceID = iit.TraceID
						  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns + 
	    N')
         
		        ) p ON p.PosInvoiceItemID = ii.PosInvoiceItemID
		WHERE  s.Type = 0
		'+CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		and s.StuffDetailType<>9
		' ELSE N'' END +N'
               AND i.IsReturnInvoice = 0
               AND i.Date BETWEEN @pFromDate AND @pEndDate
               AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + N'))';
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @PosInvoiceStockDocumentType = @PosInvoiceStockDocumentType,
	     @SelectedDl = @SelectedDl;

	SET @query = N'insert into ' + @TableName1 + N'
		SELECT ii.RowIndex,11 DocType ,
				'''' ,
				'''' ,
				N' + @posReturnInvoice
	    + 
	    N' DocName ,
				i.PosInvoiceID HeaderID ,
				ii.PosInvoiceItemID ItemID ,
				i.Number ,
				'''' ,
				NULL ,
				i.Date ,
				ii.StuffID ,
				i.StockID ,
				pa.DlID DeliverDlID ,
				NULL ,
				NULL AS BaseDoc ,
				NULL AS BaseDocNumber ,
				' + @Columns
	    + 
	    N' ,
				ii.MainQuantity ,
				ii.SubQuantity ,'+CASE WHEN @ReviewType = 2 THEN N'
				ROUND( isnull(ii.Cost / ii.MainQuantity,0), 4) AS Fee ,
				0,
				0,
				isnull(ii.Cost,0) AS Price ,
				0 AS InLine ,' ELSE '' END +N'
				0  PurchaseInvoiceItemID
		 FROM   #FreePosInvoice i
				INNER JOIN POS.PosInvoiceItem ii ON ii.PosInvoiceID = i.PosInvoiceID
				join #StockDocument sdt on @PosInvoiceStockDocumentType = sdt.StockDocumentTypeID
				JOIN CFG.Party  pa ON pa.PartyID = i.CustomerID
				JOIN  '+@StuffInfo +N'  s ON s.StuffID = ii.StuffID
				JOIN STF.StuffDetail sd ON sd.StuffID = ii.StuffID 
				JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
				INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
				LEFT JOIN ( SELECT  iit.PosInvoiceItemID ,
									iit.TraceID ,
									CASE WHEN AccountLevelTypeID = 1 THEN CAST (DlID AS NVARCHAR(MAX))
										 WHEN AccountLevelTypeID = 6 THEN CAST (TraceItemID AS NVARCHAR(MAX))
										 WHEN AccountLevelTypeID = 5
										 THEN CFG.GetCLRSaturnDate(Value, ''' + @DateFormat + N'''  , 0,''' + @DateType 
	    + 
	    N''')
										 ELSE Value
									END value
							FROM    POS.PosInvoiceItemTrace iit
									JOIN STF.Trace t ON t.TraceID = iit.TraceID
						  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns
	    + 
	    N')
		) p ON p.PosInvoiceItemID = ii.PosInvoiceItemID
		WHERE  i.IsReturnInvoice = 1
		AND s.Type = 0
		'+CASE WHEN @ReviewType = 2 THEN N'
		AND s.StuffDetailType <> 3
		and s.StuffDetailType<>9
		' ELSE N'' END +N'
        AND i.Date BETWEEN @pFromDate AND @pEndDate
        AND (@SelectedDl IS NULL OR i.DeliverDlID IN (' + ISNULL(@SelectedDl, 0) + 
N'))';
	
	EXECUTE sp_executesql @query,
	     @param,
	     @pFromDate = @FromDate,
	     @pEndDate = @ToDate,
	     @pSelectedStocks = @SelectedStocks,
	     @pFinicialPeriodID = @FinancialPeriod,
	     @pSelectedStuffs = @SelectedStuffs,
	     @SelectedStuffTrace = @SelectedStuffTrace,
	     @SelectedStuffAccountGroup = @SelectedStuffAccountGroup,
	     @SelectedStuffGroup = @SelectedStuffGroup,
	     @PosInvoiceStockDocumentType = @PosInvoiceStockDocumentType,
	     @SelectedDl = @selecteddl;
	
	DECLARE @stuffTraceTableName     NVARCHAR(15),
	        @joinColumns             NVARCHAR(MAX);
	
	SET @stuffTraceTableName = CFG.getTempTableName(1);
	EXEC STC.GetStuffTraceFilterForReview 
		@stuffTraceTableName = @stuffTraceTableName,
	    @SelectedStuffTrace = @SelectedStuffTrace; 
		
	SELECT @joinColumns = STUFF(
	           (
	               SELECT ' AND ISNULL(st.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(a.' + QUOTENAME(t.TraceID) + ', 0) '
	               FROM   STF.Trace AS t
	               WHERE  t.CheckInventory = 1
	               ORDER BY
	                      t.TraceID
	                      FOR XML PATH('')
	           ),
	           1,
	           0,
	           ''
	       );
	
	IF @joinColumns IS NULL
	    SET @joinColumns = N'AND 1 = 1';
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT ',A.' + QUOTENAME(TraceID)
	                      + CASE 
	                             WHEN AccountLevelTypeID = 6 THEN ',d' + 
								 CAST(TraceID AS NVARCHAR(10)) + '.Item' + CASE 
	                                WHEN  @CultureNo  =  2 THEN  '2' ELSE   ''
	                            END + 
	                                  ' AS T' + CAST(TraceID AS NVARCHAR(5)) + 'Title'
	                             ELSE ''
	                        END
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@Columns IS NULL)
	    SET @Columns = N'A.[-1]';
	
	SELECT StuffGroupID,
	       [STF].[StuffGroupFullCode](StuffGroupID) AS FullCode
	INTO   #StuffGroup
	FROM   STF.StuffGroup;
	
	DECLARE @StuffFullInfo NVARCHAR(MAX)
	SET @StuffFullInfo = cfg.getTempTableName(1)
	
	SET @query = 
	    N'SELECT v.StuffID,v.code,v.Title,v.Title2,v.MainMeasureUnit,v.MainMeasureUnit2,v.SubMeasureUnit,v.SubMeasureUnit2,v.StuffDetailType,
			v.StuffGroupTitle,v.StuffGroupTitle2,v.StuffGroupCode,v.StuffAccountGroupTitle,v.StuffAccountGroupTitle2 
			INTO ' + @StuffFullInfo + N' FROM stf.VWStuff AS v
			JOIN ' + @StuffInfo + N' s ON v.StuffID = s.StuffID'
	
	EXEC (@query)

		SET @query = N'
insert into ' + @TableName + 
N' SELECT  ROW_NUMBER() over (order by A.Date,A.DocType,A.Number) ResItemID,A.RowIndex,
		A.DocName,A.[Description],A.Description2,A.DocType,A.HeaderID,A.ItemId,A.Number,
		A.Type,A.CodeType,		
		case when @CultureNo = 1 then stf.MainMeasureUnit
	         when @CultureNo = 2 then stf.MainMeasureUnit2
	    end as MainMeasureUnit,		
		case when @CultureNo = 1 then stf.SubMeasureUnit
	         when @CultureNo = 2 then stf.SubMeasureUnit2
	    end as SubMeasureUnit,
		A.[Date],
		CFG.GetCLRSaturnDate(A.[Date],''' + @DateFormat + N'''  , 0,''' + @DateType + 
	    N''') Date_Date,		
		case when @CultureNo = 1 then stf.Title
	         when @CultureNo = 2 then stf.Title2
	    end as StuffTitle,
		stf.Code StuffCode,
		stf.StuffGroupCode as StuffGroupCode,
		case when @CultureNo = 1 then stf.StuffGroupTitle
	         when @CultureNo = 2 then stf.StuffGroupTitle2
	    end as GroupTitle,
		case when @CultureNo = 1 then stf.StuffAccountGroupTitle
	         when @CultureNo = 2 then stf.StuffAccountGroupTitle2
	    end as AccountGroup,sdtype.Value  StuffType,
		stc.Code as StockCode,
		case when @CultureNo = 1 then stc.Title
	         when @CultureNo = 2 then stc.Title2
	    end as StockTitle,
		case when DeliverDlID is NULL then cast(stcd.Code  as nvarchar(255)) else cast( dl.Code   as nvarchar(255)) end as DeliverCode,
		case when @CultureNo = 1 then
				case when DeliverDlID is null  then stcd.Title else dl.Title end 
			when @CultureNo = 2  then
				case when DeliverDlID is null  then stcd.Title2 else dl.Title2 end 
		END	as DeliverTitle , ' + @Columns
	    + 
	    N',
		BaseDoc,BaseDocNumber,A.MainQuantity,A.SubQuantity,'+CASE WHEN @ReviewType = 2 THEN N'
		A.Fee,PrimaryPrice,
			SumRevision,A.Price,A.InLine,' ELSE '' END +N' 0 ,0 as QuantityInLine,
		
		pin.Number   InvoiceNumber' + @CodeAndTitleColumn + N'
 FROM ' + @TableName1 + N' A
	LEFT JOIN ' + @stuffTraceTableName + N' AS st on st.StuffID = a.StuffID ' + @joinColumns  + N'
	INNER JOIN  '+@StuffFullInfo +N'  stf on stf.StuffID = A.StuffID
 join #vwEnums sdtype on stf.StuffDetailType = sdtype.KeyValue and sdtype.Enum = ''StuffDetailTypes''
	LEFT JOIN VND.PurchaseInvoiceItem pii ON A.PurchaseInvoiceItemID = pii.PurchaseInvoiceItemID
	LEFT JOIN VND.PurchaseInvoice pin ON pin.PurchaseInvoiceID = pii.PurchaseInvoiceID
	LEFT JOIN STF.Stock stcd on stcd.StockID = A.DeliverStockID 
	LEFT JOIN ACC.DL dl on dl.DLID = A.DeliverDlID 
	LEFT JOIN STF.Stock stc on A.StockID = stc.StockID ' + @LeftJoin + N' ' + @listLeftJoin+ 
	N' WHERE @SelectedStuffTrace IS NULL OR st.StuffID is not null AND stf.StuffDetailType <> 9';
	
	EXECUTE sp_executesql @query,
	     N'@SelectedStuffTrace NVARCHAR(MAX), @CultureNo INT',
	     @SelectedStuffTrace = @SelectedStuffTrace,
		 @CultureNo = @CultureNo;

if @RemainedInLine = 1
BEGIN	
	SET @query = 
	    N' DECLARE '+ CASE WHEN @ReviewType = 2 THEN N' @InLine DECIMAL(36,10) = 0,' ELSE '' END +N'
			@quantityInLine DECIMAL(36,10) = 0,
			@subInLine DECIMAL(36,10) = 0

UPDATE ' + @TableName
	    + 
	    N'
SET    '+CASE WHEN @ReviewType = 2 THEN N' @InLine = @InLine + Price,
       inline = @InLine,' ELSE '' END +N' 
	   @quantityInLine = @quantityInLine + MainQuantity,
	   QuantityInLine = @quantityInLine,
		@subInLine = @subInLine + isnull(SubQuantity,0),
		SubInline = @subInLine
FROM   ' + @TableName + N'
       WITH (INDEX(' + @IndexName + N')) ';
EXEC (@query);	
END

EXEC ( N'SELECT *
FROM   ' + @TableName + N'
ORDER BY
       ResItemID')
END;
