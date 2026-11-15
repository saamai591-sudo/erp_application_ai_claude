

CREATE  
 PROCEDURE [STC].GetQuantityReturnedOutgoingItem
(
    @date           DATE,
    @branchId       INT,
    @stuffId        INT = NULL,
    @dlId           INT,
    @ids            NVARCHAR(MAX),
    @saleTypeId     INT,
    @currencyId     INT,
    @saleAreaId     INT
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @dateFormat             VARCHAR(20),
	        @dateType               TINYINT,
	        @userId                 INT,
	        @DynamicColumns         NVARCHAR(MAX),
	        @SelectColumns          NVARCHAR(MAX),
	        @CodeAndTitleColumn     NVARCHAR(MAX),
	        @LeftJoin               NVARCHAR(MAX),
	        @query                  NVARCHAR(MAX),
	        @Culture                NVARCHAR(100),
	        @CultureNo              TINYINT;
	
	
	SET @userId = CFG.GetuserID();
	
	SET @Culture = CFG.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture;
	
	SELECT @dateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @userId;
	
	IF @dateType IS NULL
	    SET @dateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END;
	
	SELECT @dateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @userId;
	
	IF @dateFormat IS NULL
	    SET @dateFormat = 'YY/MM/DD';
	
	SELECT @DynamicColumns = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@DynamicColumns IS NULL)
	    SET @DynamicColumns = N'[-1]';
	
	SELECT @SelectColumns = STUFF(
	           (
	               SELECT DISTINCT
	                      CASE 
	                           WHEN AccountLevelTypeID <> 5 THEN ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + 
	                                ' AS TR' + CAST(TraceID AS VARCHAR(5))
	                                + CASE 
	                                       WHEN AccountLevelTypeID = 6 THEN ',tri' + CAST(TraceID AS VARCHAR(5)) + 
	                                            '.Item' + CASE @CultureNo
	                                                           WHEN 2 THEN '2'
	                                                           ELSE ''
	                                                      END + ' AS TRCode'
	                                            + CAST(TraceID AS VARCHAR(5))
	                                       ELSE ''
	                                  END
	                           ELSE ',Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5))) + ' AS TR' + CAST(TraceID AS VARCHAR(5))
	                                + ',CFG.GetCLRSaturnDate(Piv.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
	                                + ', @DateFormat, 0, @DateType) AS TRDate' + CAST(TraceID AS VARCHAR(5))
	                      END
	               FROM   STF.Trace
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF (@SelectColumns IS NULL)
	    SET @SelectColumns = N'[-1]';
	
	SELECT @CodeAndTitleColumn = STUFF(
	           (
	               SELECT DISTINCT
	                      ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code [TRCode' + CAST(TraceID AS VARCHAR(10)) + '],d'
	                      + CAST(TraceID AS VARCHAR(10)) + '.Title [TRTitle' + CAST(TraceID AS VARCHAR(10)) + ']'
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @CodeAndTitleColumn IS NULL
	    SET @CodeAndTitleColumn = N' ';
	
	SELECT @LeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join ACC.DL d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
	                      + '.DlID = piv.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  DlTypeID IS NOT NULL
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @LeftJoin IS NULL
	    SET @LeftJoin = N' ';
	
	DECLARE @listLeftJoin NVARCHAR(MAX);
	
	SELECT @listLeftJoin = STUFF(
	           (
	               SELECT DISTINCT
	                      ' Left Join STF.TraceItem tri' + CAST(TraceID AS VARCHAR(10)) + ' on tri' + CAST(TraceID AS VARCHAR(10))
	                      + '.TraceItemID = piv.' + QUOTENAME(TraceID)
	               FROM   STF.Trace
	               WHERE  AccountLevelTypeID = 6
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @listLeftJoin IS NULL
	    SET @listLeftJoin = N' ';
	
	
	SELECT [value] AS ReturnedOutgoingItemID
	INTO   #usedReturnedOutgoingItemID
	FROM   CFG.R_FnCommaStr2Table(@ids);
	
	
	SELECT *
	INTO   #vwReturnOutgoing_Invoice
	FROM   sle.vwReturnOutgoing_Invoice AS vroi
	WHERE  vroi.BranchID = @branchId
	       AND vroi.SaleAreaID = @saleAreaId
	       AND vroi.DlDeliverID = @dlId
	       AND vroi.ReturnDate <= @date 
	
	
	
	CREATE TABLE #Src
	(
		ReturnedOutgoingItemID     INT,
		ReturnedOutgoingID INT,
		CurrencyID                 INT,
		Price                      DECIMAL(36, 10),
		Discount                   DECIMAL(36, 10),
		MainQuantity               DECIMAL(36, 10),
		SaleModelID                SMALLINT,
		SaleModelTitle             NVARCHAR(250),
		SaleTypeID                 INT,
		SaleAreaID                 INT,
		InvoiceItemID              INT
	)
	

	
	--SELECT @branchId brid, @saleAreaId said,@dlId dlid,@saleTypeId stid,@date date
	
	INSERT INTO #Src(
	           ReturnedOutgoingItemID,
	           ReturnedOutgoingID,
	           CurrencyID,
	           Price,
	           Discount,
	           MainQuantity,
	           SaleModelID,
	           SaleModelTitle,
	           SaleTypeID,
	           SaleAreaID,
	           InvoiceItemID
	       )
	SELECT vroi.ReturnedOutgoingItemID,
	vroi.ReturnedOutgoingID,
	       vroi.CurrencyID,
	       vroi.Price,
	       vroi.Discount,
	       vroi.InvoiceMainQuantity,
	       vroi.SaleModelID,
	       sm.Title,
	       vroi.SaleTypeID,
	       vroi.SaleAreaID,
	       vroi.InvoiceItemID
	FROM   sle.vwReturnOutgoing_Invoice  AS vroi
	       JOIN sle.SaleType             AS st
	            ON  st.SaleTypeID = vroi.SaleTypeID
	       JOIN sle.SaleModel            AS sm
	            ON  vroi.SaleModelID = sm.SaleModelID
	WHERE  vroi.BranchID = @branchId
	       AND vroi.SaleAreaID = @saleAreaId
	       AND vroi.DlDeliverID = @dlId
	       AND vroi.SaleTypeID = @saleTypeId
	       AND vroi.ReturnDate <= @date
	       
	   
	       
	
	SELECT i.ReturnedOutgoingItemID,
	       i.ReturnedOutgoingID,
	       h.Number,
	       h.Date,
	       CFG.GetCLRSaturnDate(h.Date, @dateFormat, 0, @dateType) AS DateString,
	       s.Code                      AS StuffCode,
	       CASE @CultureNo
	            WHEN 1 THEN s.Title
	            WHEN 2 THEN s.Title2
	       END                         AS StuffTitle,
	       i.StuffID,
	       i.MainQuantity,
	       i.SubQuantity,
	       i.RowIndex,
	       CASE 
	            WHEN i.MainQuantity = directBase.MainQuantity THEN directBase.Price
	            ELSE (directBase.Price / directBase.MainQuantity) * i.MainQuantity
	       END                         AS InvoicePrice,
	       CASE 
	            WHEN i.MainQuantity = directBase.MainQuantity THEN directBase.Discount
	            ELSE (directBase.Discount / directBase.MainQuantity) * i.MainQuantity
	       END                         AS InvoiceDiscount,
	       CASE 
	            WHEN directBase.SaleModelID IS NOT NULL THEN directBase.SaleModelID
	            ELSE NULL
	       END                            SaleModelId,
	       CASE 
	            WHEN directBase.SaleModelID IS NOT NULL THEN directBase.SaleModelTitle
	            ELSE NULL
	       END                            SaleModelTitle
	INTO   #items
	FROM   STC.ReturnedOutgoingItem    AS i
	       JOIN STC.ReturnedOutgoing   AS h
	            ON  h.ReturnedOutgoingID = i.ReturnedOutgoingID
	       JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
	            ON  h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	       JOIN STF.Stock              AS st
	            ON  st.StockID = h.StockID
	       JOIN STF.[Stuff]            AS s
	            ON  s.StuffID = i.StuffID
	       JOIN STC.StockDocumentType  AS sdt
	            ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
	       LEFT JOIN (
	                SELECT ReturnedOutgoingItemID
	                FROM   SLE.ReturnedSaleInvoiceItem
	            )                      AS USED
	            ON  USED.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID
	       LEFT JOIN #usedReturnedOutgoingItemID u2
	            ON  u2.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID
	       LEFT JOIN #Src              AS directBase
	            ON  directBase.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID

    WHERE h.Date <= @date
          AND used.ReturnedOutgoingItemID IS NULL
          AND u2.ReturnedOutgoingItemID IS NULL
          AND st.BranchID = @branchId
          AND
          (
              @stuffId IS NULL
              OR i.StuffID = @stuffId
          )
          AND h.DlDeliverID = @dlId
          AND sdt.DocumentType IN ( 1, 10 )
          AND i.ReturnedSaleInvoiceItemID IS NULL
               

	
	SET @query = 
	    N'
SELECT ii.ReturnedOutgoingItemID ,
       ii.ReturnedOutgoingID ,
       ii.Number ,
       ii.Date ,
       ii.DateString ,
       ii.StuffCode ,
       ii.StuffTitle ,
       ii.StuffID ,
       ii.MainQuantity ,
       ii.SubQuantity ,
       ii.RowIndex ,
       ii.InvoicePrice/ii.MainQuantity InvoiceFee,
       ii.InvoicePrice ,
       ii.InvoiceDiscount ,
       ii.SaleModelId ,
       ii.SaleModelTitle,' + @SelectColumns + N',0' + @CodeAndTitleColumn
	    + 
	    N'	
FROM   #items AS ii
       LEFT JOIN (   SELECT tr.ReturnedOutgoingItemID ,
                            tr.TraceID ,
                            CASE WHEN tr.DlID IS NOT NULL THEN CAST(tr.DlID AS NVARCHAR(MAX))
                                 WHEN tr.TraceItemID IS NOT NULL THEN CAST(tr.TraceItemID AS NVARCHAR(MAX))
                                 ELSE tr.Value
                            END Value
                     FROM   STC.ReturnedOutgoingItemTrace AS tr ) x
       PIVOT (   MAX(Value)
                 FOR TraceID IN ( ' + @DynamicColumns
	    + N'
                 )) AS piv ON piv.ReturnedOutgoingItemID = ii.ReturnedOutgoingItemID ' + @LeftJoin + N' '
	    + @listLeftJoin
	;
	
	EXEC sys.sp_executesql @query,
	     N'@dateFormat VARCHAR(20),@dateType TINYINT',
	     @dateFormat = @dateFormat,
	     @dateType = @dateType;
END;

       
------------End of #9160
