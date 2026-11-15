
CREATE   PROC [NOC].RptDollarCartexDataSource
(
    @FromPeriod INT,
    @ToPeriod INT,
	@TableName1 VARCHAR(255),
    @SelectedStuff NVARCHAR(MAX) = NULL,
    @SelectedStocks NVARCHAR(MAX) = NULL,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL,
    @SelectedStuffAccountGroup NVARCHAR(MAX) = NULL,
    @SelectedStuffGroup NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @Columns NVARCHAR(MAX),
			@SelectColumns NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @param NVARCHAR(MAX),
            @ColumnsInCreateTable NVARCHAR(MAX),
			@stuffTraceTableName NVARCHAR(15),
			@joinColumns NVARCHAR(MAX),
            @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @FinancialPeriod INT,
			@CultureNo Char(1),
			@FromDate  Date,
			@ToDate    Date;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

	select @FromDate = StartDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @FromPeriod

	select @ToDate = EndDate
	from noc.ReportagePeriod
	where ReportagePeriodID = @ToPeriod

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
        SET @DateFormat = 'YY/MM/DD';


	SELECT VALUE StockID
	INTO   #SelectedStocks
	FROM   CFG.R_FnCommaStr2Table(@SelectedStocks)  

	SELECT s.StockID,st.StockTypeID
	INTO   #vwStockAccess
	FROM   cfg.vwStockAccess AS s
	join stf.Stock st on s.StockID = st.StockID
	LEFT JOIN #SelectedStocks ss
		ON  s.StockID = ss.StockID
	WHERE  (@SelectedStocks IS NULL OR ss.StockID IS NOT NULL)


	
	SELECT VALUE StuffTraceID
	INTO   #SelectedStuffTrace
	FROM   CFG.R_FnCommaStr2Table(@SelectedStuffTrace)


	SELECT StuffAccountGroupID,sag.StuffDetailType 
	INTO  #SelectedStuffAccountGroup
	FROM stf.StuffAccountGroup AS sag
	LEFT JOIN  CFG.R_FnCommaStr2Table(@SelectedStuffAccountGroup) a ON sag.StuffAccountGroupID = a.[value]
	WHERE (@SelectedStuffAccountGroup IS NULL OR a.[value] IS NOT NULL)


	SELECT VALUE StuffGroupID
	INTO   #SelectedStuffGroup
	FROM   CFG.R_FnCommaStr2Table(@SelectedStuffGroup)

	SELECT VALUE StuffID
	INTO   #SelectedStuff
	FROM   CFG.R_FnCommaStr2Table(@SelectedStuff) 

	select a.StuffID,a.StuffGroupID,b.StuffAccountGroupID,ssag.StuffDetailType
	into #VWStuff
	from stf.stuff a 
	join stf.StuffDetail b on a.StuffID = b.StuffID
	join #SelectedStuffAccountGroup ssag on ssag.StuffAccountGroupID = b.StuffAccountGroupID
	left join #SelectedStuffGroup ssg on ssg.StuffGroupID = a.StuffGroupID
	left join #SelectedStuff ss on ss.StuffID = a.StuffID
	where (@SelectedStuffGroup IS NULL OR ssg.StuffGroupID is not null)
	AND (@SelectedStuff IS NULL OR ss.StuffID is not null )
	AND (@SelectedStuffAccountGroup IS NULL OR ssag.StuffAccountGroupID is not null )
	and a.Type = 0 
	and ssag.StuffDetailType not in (3,9)

    SET @stuffTraceTableName = CFG.getTempTableName(1);
    EXEC STC.GetStuffTraceFilterForReview @stuffTraceTableName = @stuffTraceTableName, 
                                          @SelectedStuffTrace = @SelectedStuffTrace;   

    SELECT @Columns = STUFF(
								(
									SELECT DISTINCT
										   ',' + QUOTENAME(TraceID)
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,''
						   );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SELECT @SelectColumns = STUFF(
								(
									SELECT DISTINCT
										   ',p.' + QUOTENAME(TraceID)
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,''
						   );

    IF (@SelectColumns IS NULL)
        SET @SelectColumns = N'p.[-1]';


    SELECT @ColumnsInCreateTable = STUFF(
    (
        SELECT DISTINCT
               QUOTENAME(TraceID) + ' NVARCHAR(MAX),'
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

    IF (@ColumnsInCreateTable IS NULL)
        SET @ColumnsInCreateTable = N'[-1] int,';

		
    SET @query
        = N'CREATE TABLE ' + @TableName1
          + N'
			(
			Nature			tinyint,
			RowIndex		INT,
			DocType			tinyint,
			[Description] nvarchar(MAX),
			EntityName             nvarchar(255),
			HeaderID         int,
			ItemID			 int,
	    	Number           int,
	    	Type		 nvarchar(255),
	    	DocumentType             INT,
	    	Date  nvarchar(255),
	    	StuffID             INT,
	    	StockID        INT,
	    	DeliverDlID         bigint,
			DeliverStockID int,' 
			+ @ColumnsInCreateTable + 
			N'MainQuantity decimal(36,10),
			SubQuantity decimal(36,10),
			BaseCurrencyPrice decimal(36,10),
			ReportCurrencyRate decimal(36,10),
			Price decimal(36,10),
			StuffGroupID int,
			StuffAccountGroupID int,
			PreVoucherID int,
			InventorySlID int)';

    EXEC (@query);


    SET @param = N'@pFromDate date, @pEndDate date,@SelectedStuffTrace NVARCHAR(MAX)';
    SELECT @joinColumns
        = STUFF(
          (
              SELECT ' AND ISNULL(st.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(p.' + QUOTENAME(t.TraceID) + ', 0) '
              FROM STF.Trace AS t
			  where CheckInventory = 1
              ORDER BY t.TraceID
              FOR XML PATH('')
          ),1,0,'');

    IF @joinColumns IS NULL
        SET @joinColumns = N'AND 1 = 1';

    SET @query
        = N'insert into ' + @TableName1 + N'
					select  1,
							ii.RowIndex,
							1 DocType,					 
							case when ' + @CultureNo  + N' = 1 then ii.[Description] else ii.Description2 end, 
							''StockReceipt'',
							i.StockReceiptID HeaderID, 
							ii.StockReceiptItemID ItemID,
							i.Number,
							case when ' + @CultureNo  + N' = 1 then sdt.Title else sdt.Title2 end,
							sdt.DocumentType,
							i.Date,
							ii.StuffID ,
							i.StockID,
							DeliverDlID,
							DeliverStockID,'
							+ @SelectColumns +
							N',ii.MainQuantity,
							ii.SubQuantity,
							ii.netprice,
							[CFG].[GetReportCurrencyRate] (i.Date),
							ROUND(ii.netprice / [CFG].[GetReportCurrencyRate] (i.Date),2),
							StuffGroupID,
							S.StuffAccountGroupID,
							PreVoucherID,
							InventorySlID
					from STC.StockReceipt i 
					JOIN STC.StockReceiptItem ii on i.StockReceiptID = ii.StockReceiptID
					JOIN #VWStuff s ON s.StuffID = ii.StuffID
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					JOIN #vwStockAccess stock on stock.stockID = i.stockID
					join stf.StuffAccountGroupAccountSl sagas on sagas.StuffAccountGroupID = s.StuffAccountGroupID and sagas.StockTypeID = stock.StockTypeID
					LEFT JOIN 
					(
						select StockReceiptItemID,iit.TraceID,
								case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  									 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
									 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
									 else Value end value
						from STC.StockReceiptItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
					)x pivot
					(
					max(value)
					for traceid in (' + @Columns + N')
					)p on p.StockReceiptItemID = ii.StockReceiptItemID 
				    LEFT JOIN ' + @stuffTraceTableName + N' AS st 
						on st.StuffID = ii.StuffID ' + @joinColumns + N'
					where  sdt.DocumentType <> 7
					and i.date between @pFromDate and @pEndDate
					and (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'  ;
					
    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @ToDate,
						  @SelectedStuffTrace = @SelectedStuffTrace;

    SET @query
        = N'insert into ' + @TableName1 + N'
					select  1,
							ii.RowIndex,
							4 DocType,
							case when ' + @CultureNo  + N' = 1 then ii.[Description] else ii.Description2 end,
							''ReturnStockReceipt'',
							i.ReturnStockReceiptID HeaderID,
							ii.ReturnStockReceiptItemID ItemID,
							i.Number,
							case when ' + @CultureNo + N' = 1 then sdt.Title else sdt.Title2 end,
							sdt.DocumentType,
							i.Date,
							ii.StuffID ,
							i.StockID,
							DeliverDlID,
							DeliverStockID,'
							 + @SelectColumns + 
							 N',-ii.MainQuantity,
							 -ii.SubQuantity,
							(-1) * ii.price,
							[CFG].[GetReportCurrencyRate] (i.Date),
							(-1) * ROUND(ii.price / [CFG].[GetReportCurrencyRate] (i.date),2),
							StuffGroupID,
							S.StuffAccountGroupID,
							PreVoucherID,
							InventorySlID
						from STC.ReturnStockReceipt i 
						JOIN STC.ReturnStockReceiptItem ii on i.ReturnStockReceiptID = ii.ReturnStockReceiptID
						JOIN #VWStuff s ON s.StuffID = ii.StuffID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
						JOIN #vwStockAccess stock on stock.stockID = i.stockID
						join stf.StuffAccountGroupAccountSl sagas on sagas.StuffAccountGroupID = s.StuffAccountGroupID and sagas.StockTypeID = stock.StockTypeID
						LEFT JOIN 
						(
							select ReturnStockReceiptItemID,iit.TraceID,
								   case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  									 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
									 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
									else Value end value
							from STC.ReturnStockReceiptItemTrace iit
							join stf.trace t on t.traceid = iit.traceid
						)x pivot
						(
						max(value)
						for traceid in (' + @Columns + N')
						)p on p.ReturnStockReceiptItemID = ii.ReturnStockReceiptItemID 
						LEFT JOIN ' + @stuffTraceTableName + N' AS st 
							on st.StuffID = ii.StuffID ' + @joinColumns + N'
						where i.date between @pFromDate and @pEndDate
						and (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'   ;

    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @ToDate,
						  @SelectedStuffTrace = @SelectedStuffTrace;
    SET @query
        = N'insert into ' + @TableName1 + N'
					select  1,
							ii.RowIndex,
							3 DocType,
							case when ' + @CultureNo  + N' = 1 then ii.[Description] else ii.Description2 end, 
							''Outgoing'',
							i.OutgoingID HeaderID,
							ii.OutgoingItemID ItemID,
							i.Number,
							case when ' + @CultureNo  + N' = 1 then sdt.Title else sdt.Title2 end,
							sdt.DocumentType,
							i.Date,
							ii.StuffID ,
							i.StockID,
							DeliverDlID,
							DeliverStockID,'
							+ @SelectColumns +
							N',-ii.MainQuantity,
							-ii.SubQuantity,
							(-1) * ii.price,
							[CFG].[GetReportCurrencyRate] (i.Date),
							(-1) * ROUND(ii.price / [CFG].[GetReportCurrencyRate] (i.date),2),
							StuffGroupID,
							S.StuffAccountGroupID,
							PreVoucherID,
							InventorySlID
					from STC.Outgoing i 
					JOIN STC.OutgoingItem ii on i.OutgoingID = ii.OutgoingID
					JOIN #VWStuff s ON s.StuffID = ii.StuffID
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
						ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					JOIN #vwStockAccess stock on stock.stockID = i.stockID
					join stf.StuffAccountGroupAccountSl sagas on sagas.StuffAccountGroupID = s.StuffAccountGroupID and sagas.StockTypeID = stock.StockTypeID
					LEFT JOIN (
								select OutgoingItemID,iit.TraceID,
									case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  										 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
										 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType + N''')
										 else Value end value
								from STC.OutgoingItemTrace iit
								join stf.trace t on t.traceid = iit.traceid
							 )x pivot
					(
					max(value)
					for traceid in (' + @Columns + N')
					)p on p.OutgoingItemID = ii.OutgoingItemID 
				    LEFT JOIN ' + @stuffTraceTableName + N' AS st 
						on st.StuffID = ii.StuffID ' + @joinColumns + N'
					where i.date between @pFromDate and @pEndDate
					and (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'   ;

    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @ToDate,
						  @SelectedStuffTrace = @SelectedStuffTrace;

    SET @query
        = N'insert into ' + @TableName1 + N'
					select	1,
							ii.RowIndex,
							2 DocType,
							case when ' + @CultureNo  + N' = 1 then ii.[Description] else ii.Description2 end, 
							''ReturnedOutgoing'',
							i.ReturnedOutgoingID HeaderID,
							ii.ReturnedOutgoingItemID ItemID,
							i.Number,
							case when ' + @CultureNo  + N' = 1 then sdt.Title else sdt.Title2 end,
							sdt.DocumentType,
							i.Date,
							ii.StuffID ,
							i.StockID,
							i.DlDeliverID as DeliverDlID,
							i.StockDeliverID as DeliverStockID,' 
							+ @SelectColumns + 
							N',ii.MainQuantity,
							ii.SubQuantity,
							ii.Price,
							[CFG].[GetReportCurrencyRate] (i.Date),
							ROUND(ii.Price / [CFG].[GetReportCurrencyRate] (i.date),2),
							StuffGroupID,
							S.StuffAccountGroupID,
							PreVoucherID,
							InventorySlID
					from STC.ReturnedOutgoing i 
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
						ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.ReturnedOutgoingItem ii on i.ReturnedOutgoingID = ii.ReturnedOutgoingID
					JOIN #VWStuff s ON s.StuffID = ii.StuffID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					JOIN #vwStockAccess stock on stock.stockID = i.stockID
					join stf.StuffAccountGroupAccountSl sagas on sagas.StuffAccountGroupID = s.StuffAccountGroupID and sagas.StockTypeID = stock.StockTypeID
					LEFT JOIN 
					(
								select ReturnedOutgoingItemID,iit.TraceID,
										case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  											 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
											 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType + N''')
											else Value end value
								from STC.ReturnedOutgoingItemTrace iit
								join stf.trace t on t.traceid = iit.traceid
					)x pivot
					(
					max(value)
					for traceid in (' + @Columns + N')
					)p on p.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID 
				    LEFT JOIN ' + @stuffTraceTableName + N' AS st 
						on st.StuffID = ii.StuffID ' + @joinColumns + N'
					where i.date between @pFromDate and @pEndDate
					and (@SelectedStuffTrace IS NULL OR st.StuffID is not null)'   ;

    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @ToDate,
						  @SelectedStuffTrace = @SelectedStuffTrace;

    SET @query
        = N'insert into ' + @TableName1 + N'
					select	3,
							p.RowIndex,
							DocType,
							null, 
							null,
							null,
							null,
							Number,
							Type,
							DocumentType,
							Date,
							StuffID ,
							StockID,
							DeliverDlID,
							DeliverStockID,' 
							+ @SelectColumns + 
							N',MainQuantity,
							SubQuantity,
							0,
							0,
							b.Value * (convert (float ,p.price ) / convert (float ,sum(p.price) over(partition by p.PreVoucherID,p.InventorySlID))),
							StuffGroupID,
							StuffAccountGroupID,
							PreVoucherID,
							InventorySlID
					from ' + @TableName1 + N' p
					join noc.CurrencyExchange b
						on  p.PreVoucherID = b.AccruePreVoucherID
						and p.InventorySlID = b.SlID
					'   ;

    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @ToDate,
						  @SelectedStuffTrace = @SelectedStuffTrace;


END;

