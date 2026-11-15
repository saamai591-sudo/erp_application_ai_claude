------------------------------------- START #8589 
CREATE   PROC [SLE].RptSale_Item
(
    @FromDate DATE,
    @EndDate DATE,
    @DocType VARCHAR(100) = NULL,
    @DocID VARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    
	DECLARE @Columns NVARCHAR(MAX),
            @ColumnsInSelectList NVARCHAR(MAX),
            @ColumnsInCreateTable NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @param NVARCHAR(MAX),
            @CodeAndTitleColumn NVARCHAR(MAX),
            @CodeAndTitleColumnInCreateTable NVARCHAR(MAX),
            @LeftJoin NVARCHAR(MAX);
			
    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SELECT @ColumnsInSelectList = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS VARCHAR(10))
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                       );

	IF @DocType = ''
		SET @DocType = NULL
	IF @DocID = ''
		SET @DocID = NULL

    IF (@ColumnsInSelectList IS NULL)
        SET @ColumnsInSelectList = N'[-1]';

    SELECT @ColumnsInCreateTable = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID) + ' NVARCHAR(MAX)'
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                        );

    IF (@ColumnsInCreateTable IS NULL)
        SET @ColumnsInCreateTable = N'[-1] NVARCHAR(MAX)';

    SELECT @CodeAndTitleColumn
        = STUFF(
    (
        SELECT ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS [T' + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title AS [T' + CAST(TraceID AS VARCHAR(10)) + 'Title]'
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );

    IF (@CodeAndTitleColumn IS NULL)
        SET @CodeAndTitleColumn = N'';



    SELECT @LeftJoin
        = STUFF(
    (
        SELECT ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10))
               + '.DlID = A.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
               );
    IF (@LeftJoin IS NULL)
        SET @LeftJoin = N'';

    DECLARE @WithOutbase NVARCHAR(100),
            @Order NVARCHAR(100),
            @Remittance NVARCHAR(100),
            @Justification NVARCHAR(100),
            @Quotation NVARCHAR(100),
            @Outgoing NVARCHAR(100),
            @Invoice NVARCHAR(100),
            @ReturnedSaleJustification NVARCHAR(100),
            @ReturnedSaleInvoice NVARCHAR(100),
            @Internal NVARCHAR(100),
            @Export NVARCHAR(100),
            @Culture VARCHAR(10),
            @userid INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;

    SET @userid = CFG.GetuserID();

    SET @Culture = CFG.GetuserCulture();


    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @ReturnedSaleInvoice = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'ReturnedSaleInvoice'
          AND lev.Culture = @Culture;

    SELECT @ReturnedSaleJustification = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'ReturnedSaleJustification'
          AND lev.Culture = @Culture;

    SELECT @Invoice = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Invoice'
          AND lev.Culture = @Culture;

    SELECT @WithOutbase = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'WithOutbase'
          AND lev.Culture = @Culture;

    SELECT @Order = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Order'
          AND lev.Culture = @Culture;

    SELECT @Remittance = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Remittance'
          AND lev.Culture = @Culture;

    SELECT @Outgoing = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Outgoing'
          AND lev.Culture = @Culture;

    SELECT @Quotation = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Quotation'
          AND lev.Culture = @Culture;

    SELECT @Justification = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'SaleDocumentBases'
          AND le.Item = 'Justification'
          AND lev.Culture = @Culture;

    SELECT @Internal = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'TradeType'
          AND le.Item = 'Internal'
          AND lev.Culture = @Culture;

    SELECT @Export = N'''' + lev.[Value] + N''''
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'TradeType'
          AND le.Item = 'Export'
          AND lev.Culture = @Culture;

    SET @param = N'@pFromDate date, @pEndDate date ,@pDocType nvarchar(max),@pDocID nvarchar(max), @pUserid int';
    
    SELECT * INTO #vwStockAccess
    FROM cfg.vwStockAccess AS vsa
    
    SELECT * INTO #vwBranchAccess
    FROM cfg.vwBranchAccess AS vba


    DECLARE @DocReviewTableName NVARCHAR(30) = CFG.getTempTableName(1);

      SET @query
        = N'CREATE TABLE ' + @DocReviewTableName
          + N'
			(
	    	DocType             varchar(100),
	    	DocName         nvarchar(150),
	    	DocID           int,
			ItemID			int,
	    	Number		 int,
	    	CurrencyID int,
	    	CurrencyRate             decimal(30,4),
	    	Date         Date,
	    	StuffID int, ' + @ColumnsInCreateTable
          + N',
	    	MainQuantity   decimal(30,4),
	    	SubQuantity               decimal(30,4),
	    	Fee  decimal(30,4),
	    	Price decimal(30,4),
	    	Discount  decimal(30,4),
	    	Tax   decimal(30,4),
	    	Duty    decimal(30,4),
	    	NetPrice     decimal(30,4),
	    	SaleModelID int,
	    	SaleType nvarchar(256),
	    	NotQuotation decimal(30,4),
	    	SubNotQuotation decimal(30,4),
	    	NotInvoice decimal(30,4),
	    	SubNotInvoice decimal(30,4),
	    	NotRemittance decimal(30,4),
	    	SubNotRemittance decimal(30,4),
	    	NotOutgoing decimal(30,4),
	    	SubNotOutgoing decimal(30,4))';
    EXEC (@query);

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
	select ''Outgoing'' AS DocType,
		'        + @Outgoing
          + N' AS DocName,
		i.OutgoingID DocID,
		ii.OutgoingItemID ItemID,
		i.Number,
		-1,
		1,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		ii.Fee,
		ii.Price,
		0 ,
		0,
		0,
		ii.Price,
		null,
		null,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		oni.Non AS NotInvoice,
		oni.SubNon AS SubNotInvoice,
		0 AS NotRemittance,
		0 AS SubNotRemittance,
		0 AS NotOutgoing,
		0 AS SubNotOutgoing
		
from stc.outgoing i 
INNER JOIN stc.outgoingitem ii on i.outgoingID = ii.outgoingID
INNER JOIN sle.Outgoing_Non_Invoice AS oni
ON oni.OutgoingItemID = ii.OutgoingItemID
INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = i.StockID
LEFT JOIN 
(
select outgoingItemID,iit.TraceID,case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from stc.outgoingItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.outgoingItemID = ii.outgoingItemID 
WHERE i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''Outgoing'')
AND (@pDocID is null or i.OutgoingID in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
';

    IF (@DocType IS NULL OR @DocType = 'Outgoing')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
	select ''Invoice'' AS DocType,
		'        + @Invoice
          + N' AS DocName,
		i.InvoiceID DocID,
		ii.InvoiceItemID ItemID,
		i.Number,
		i.CurrencyID,
		i.CurrencyRate,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		ii.Fee,
		ii.Price,
		-ii.Discount ,
		ii.Tax,
		ii.Duty,
		ii.NetPrice,
		ii.SaleModelID,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		0 AS NotInvoice,
		0 AS SubNotInvoice,
		inr.Non AS NotRemittance,
		inr.SubNon AS SubNotRemittance,
		inog.Non AS NotOutgoing,
		inog.SubNon AS SubNotOutgoing
		
from sle.Invoice i
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId 
INNER JOIN sle.InvoiceItem ii on i.InvoiceID = ii.InvoiceID
INNER JOIN sle.Invoice_Non_Remittance AS inr
ON inr.InvoiceItemID = ii.InvoiceItemID
INNER JOIN sle.Invoice_Non_OutGoing AS inog
ON inog.InvoiceItemID = ii.InvoiceItemID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select InvoiceItemID,iit.TraceID,case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								  when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.InvoiceItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.InvoiceItemID = ii.InvoiceItemID 
WHERE i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''Invoice'')
AND (@pDocID is null or i.InvoiceID in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
';

    IF (@DocType IS NULL OR @DocType = 'Invoice')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
		select ''ReturnedSaleInvoice'' AS DocType,
		'        + @ReturnedSaleInvoice
          + N' AS DocName,
		i.ReturnedSaleInvoiceID DocID,
		ii.ReturnedSaleInvoiceItemID ItemID,
		i.Number,
		i.CurrencyID,
		i.CurrencyRate,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		ii.Fee,
		ii.Price,
		-ii.Discount ,
		ii.Tax,
		ii.Duty,
		ii.NetPrice,
		ii.SaleModelID,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		0 AS NotInvoice,
		0 AS SubNotInvoice,
		0 AS NotRemittance,
		0 AS SubNotRemittance,
		0 AS NotOutgoing,
		0 AS SubNotOutgoing
from sle.ReturnedSaleInvoice i 
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId
INNER JOIN sle.ReturnedSaleInvoiceItem ii on i.ReturnedSaleInvoiceID = ii.ReturnedSaleInvoiceID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select ReturnedSaleInvoiceItemID,iit.TraceID,
								  case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								       when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.ReturnedSaleInvoiceItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.ReturnedSaleInvoiceItemID = ii.ReturnedSaleInvoiceItemID
where i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''ReturnedSaleInvoice'')
AND (@pDocID is null or i.ReturnedSaleInvoiceID  in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))';

    IF (@DocType IS NULL OR @DocType = 'ReturnedSaleInvoice')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
		select ''Justification'' AS DocType,
		'        + @Justification
          + N' AS DocName,
		i.JustificationID DocID,
		ii.JustificationItemID ItemID,
		i.Number,
		i.CurrencyID,
		null,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		ii.Fee,
		ii.Price,
		-ii.Discount ,
		0,
		0,
		ii.NetPrice,
		ii.SaleModelID,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		jnq.Non AS NotQuotation,
		jnq.SubNon AS SubNotQuotation,
		jni.Non AS NotInvoice,
		jni.SubNon AS SubNotInvoice,
		jnr.Non AS NotRemittance,
		jnr.SubNon AS SubNotRemittance,
		jno.Non AS NotOutgoing,
		jno.SubNon AS SubNotOutgoing
from sle.Justification i 
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId
INNER JOIN sle.JustificationItem ii on i.JustificationID = ii.JustificationID
INNER JOIN sle.Justification_Non_Invoice AS jni
ON jni.JustificationItemID = ii.JustificationItemID
INNER JOIN sle.Justification_Non_Remittance AS jnr
ON jnr.JustificationItemID = ii.JustificationItemID
INNER JOIN sle.Justification_Non_Outgoing AS jno
ON jno.JustificationItemID = ii.JustificationItemID
INNER JOIN sle.Justification_Non_Quotation AS jnq
ON jnq.JustificationItemID = ii.JustificationItemID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select JustificationItemID,iit.TraceID,
								  case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								       when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.JustificationItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.JustificationItemID = ii.JustificationItemID
where i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''Justification'')
AND (@pDocID is null or i.JustificationID  in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
';


    IF (@DocType IS NULL OR @DocType = 'Justification')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
		select ''Quotation'' AS DocType,
		'        + @Quotation
          + N' AS DocName,
		i.QuotationID DocID,
		ii.QuotationItemID ItemID,
		i.Number,
		i.CurrencyID,
		null,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		ii.Fee,
		ii.Price,
		-ii.Discount ,
		ii.Tax,
		ii.Duty,
		ii.NetPrice,
		ii.SaleModelID,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		qni.Non AS NotInvoice,
		qni.SubNon AS SubNotInvoice,
		qnr.Non AS NotRemittance,
		qnr.SubNon AS SubNotRemittance,
		qno.Non AS NotOutgoing,
		qno.SubNon AS SubNotOutgoing
from sle.Quotation i 
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId
INNER JOIN sle.QuotationItem ii on i.QuotationID = ii.QuotationID
INNER JOIN sle.Quotation_Non_Invoice AS qni
ON qni.QuotationItemID = ii.QuotationItemID
INNER JOIN sle.Quotation_Non_Remittance AS qnr
ON qnr.QuotationItemID = ii.QuotationItemID
INNER JOIN sle.Quotation_Non_Outgoing AS qno
ON qno.QuotationItemID = ii.QuotationItemID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select QuotationItemID,iit.TraceID,
								  case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								       when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.QuotationItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.QuotationItemID = ii.QuotationItemID
where i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''Quotation'')
AND (@pDocID is null or i.QuotationID  in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
'   ;
    IF (@DocType IS NULL OR @DocType = 'Quotation')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
		select ''Remittance'' AS DocType,
		'        + @Remittance
          + N' AS DocName,
		i.RemittanceID DocID,
		ii.RemittanceItemID ItemID,
		i.Number,
		Null,
		0,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		0,
		0,
		0,
		0,
		0,
		0,
		null,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		rni.Non AS NotInvoice,
		rni.SubNon AS SubNotInvoice,
		0 AS NotRemittance,
		0 AS SubNotRemittance,
		rno.Non AS NotOutgoing,
		rno.SubNon AS SubNotOutgoing
from sle.Remittance i 
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId
INNER JOIN sle.RemittanceItem ii on i.RemittanceID = ii.RemittanceID
INNER JOIN sle.Remittance_Non_Invoice AS rni
ON rni.RemittanceItemID = ii.RemittanceItemID
INNER JOIN sle.Remittance_Non_Outgoing AS rno
ON rno.RemittanceItemID = ii.RemittanceItemID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select RemittanceItemID,iit.TraceID,
								  case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								       when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.RemittanceItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.RemittanceItemID = ii.RemittanceItemID
where i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''Remittance'')
AND (@pDocID is null or i.RemittanceID  in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
'   ;

    IF (@DocType IS NULL OR @DocType = 'Remittance')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;

    SET @query
        = N'insert into ' + @DocReviewTableName + N'
		select ''ReturnedSaleJustification'' AS DocType,
		'        + @ReturnedSaleJustification
          + N' AS DocName,
		i.ReturnedSaleJustificationID DocID,
		ii.ReturnedSaleJustificationItemID ItemID,
		i.Number,
		Null,
		0,
		i.Date,
		ii.StuffID ,
		'        + @Columns
          + N',
		ii.MainQuantity,
		ii.SubQuantity,
		0,
		0,
		0,
		0,
		0,
		0,
		null,
		case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sly.Title
	         when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	    end as SaleType,
		0 AS NotQuotation,
		0 AS SubNotQuotation,
		0 AS NotInvoice,
		0 AS SubNotInvoice,
		0 AS NotRemittance,
		0 AS SubNotRemittance,
		0 AS NotOutgoing,
		0 AS SubNotOutgoing
from sle.ReturnedSaleJustification i 
join SLE.SaleType sly on sly.SaleTypeId = i.SaleTypeId
INNER JOIN sle.ReturnedSaleJustificationItem ii on i.ReturnedSaleJustificationID = ii.ReturnedSaleJustificationID
INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
LEFT JOIN 
(
select ReturnedSaleJustificationItemID,iit.TraceID,
								  case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
								       when AccountLevelTypeID = 5 then  CFG.GetSaturnDate(value,0)
								  else Value end value
								 from sle.ReturnedSaleJustificationItemTrace iit
								 join stf.trace t on t.traceid = iit.traceid
								 )x pivot
(
max(value)
for traceid in (' + @Columns
          + N')
)p on p.ReturnedSaleJustificationItemID = ii.ReturnedSaleJustificationItemID
where i.date between @pFromDate AND @pEndDate
AND (@pDocType is null or @pDocType = ''ReturnedSaleJustification'')
AND (@pDocID is null or i.ReturnedSaleJustificationID  in (SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pDocID)))
';

    IF (@DocType IS NULL OR @DocType = 'ReturnedSaleJustification')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;


    SET @query
        = N'insert into ' + @DocReviewTableName + N' ' + N'SELECT ''Order'' AS DocType ,
						' + @Order
          + N' AS DocName ,
						i.OrderID DocID ,
						ii.OrderItemID ItemID ,
						i.Number ,
						NULL ,
						NULL ,
						i.[Date] ,
						ii.StuffID ,
						' + @Columns
          + N',
						ii.MainQuantity ,
						ii.SubQuantity ,
						0 ,
						0 ,
						0 ,
						0 ,
						0 ,
						0 ,
						NULL ,
						case when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 1 then sly.Title
	                      when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sly.Title2
	                   end as SaleType,
						onq.Non AS NotQuotation ,
						onq.SubNon AS SubNotQuotation ,
						0 AS NotInvoice ,
						NULL AS SubNotInvoice ,
						0 AS NotRemittance ,
						NULL AS SubNotRemittance ,
						0 AS NotOutgoing ,
						NULL AS SubNotOutgoing
				 FROM   CTM.[Order] AS i
						JOIN SLE.SaleType sly ON sly.SaleTypeID = i.SaleTypeID
						INNER JOIN CTM.OrderItem AS ii ON ii.OrderID = i.OrderID
						INNER JOIN SLE.Order_Non_Quotation AS onq ON onq.OrderItemID = ii.OrderItemID
						INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID
						LEFT JOIN ( SELECT  iit.OrderItemID ,
											iit.TraceID ,
											CASE WHEN AccountLevelTypeID = 1
												 THEN CAST (DlID AS NVARCHAR(MAX))
												 WHEN AccountLevelTypeID = 5
												 THEN CFG.GetSaturnDate(Value, 0)
												 ELSE Value
											END value
									FROM    CTM.[OrderItemTrace] iit
											JOIN STF.Trace t ON t.TraceID = iit.TraceID
								  ) x PIVOT ( MAX(value) FOR TraceID IN ( ' + @Columns
          + N' ) ) p ON p.OrderItemID = ii.OrderItemID
				 WHERE  i.[Date] BETWEEN @pFromDate AND @pEndDate
						AND ( @pDocType IS NULL
							  OR @pDocType = ''Order''
							)
						AND ( @pDocID IS NULL
							  OR i.OrderID IN ( SELECT  value
												FROM    CFG.R_FnCommaStr2Table(@pDocID) )
							)
						
'   ;


    IF (@DocType IS NULL OR @DocType = 'Order')
        EXECUTE sp_executesql @query,
                              @param,
                              @pFromDate = @FromDate,
                              @pEndDate = @EndDate,
                              @pDocType = @DocType,
                              @pDocID = @DocID,
                              @pUserid = @userid;



    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userid;
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
          AND us.UserID = @userid;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SET @param = N'@pFromDate date, @pEndDate date ,@pDocType nvarchar(max),@pDocID nvarchar(max)';

    SET @query
        = N'
select ROW_NUMBER() over (order by DocName,DocID) RowID,
	   A.DocType,
	   A.DocName,
	   A.DocID,
	   A.ItemID,
	   A.Number,
	   A.CurrencyID,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then c.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then c.Title2
	   end as CurrencyTitle,
	   A.CurrencyRate,
	   A.[Date],
	   CFG.GetCLRSaturnDate(A.[Date], ''' + @DateFormat + N'''  , 0, ''' + CAST(@DateType AS VARCHAR(10))
          + N''') Date_Date,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then stf.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then stf.Title2
	   end as StuffTitle,
	   [STF].[GetStuffCode](stf.StuffID) StuffCode,' + @ColumnsInSelectList
          + N',
	   A.MainQuantity,
	   A.SubQuantity,
	   A.Fee,
	   A.Price,
	   A.Discount,
	   A.Tax,
	   A.Duty,
	   A.NetPrice,
	   sm.Code SaleModelCode,
	   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then sm.Title
	        when ' + CAST(@CultureNo AS CHAR(1))
          + N' = 2 then sm.Title2
	   end as SaleModelTitle,
	   A.SaleType [Type],
	   A.NotQuotation,
	   A.SubNotQuotation,
	   A.NotInvoice,
	   A.SubNotInvoice,
	   A.NotRemittance,
	   A.SubNotRemittance,
	   A.NotOutgoing,
	   A.SubNotOutgoing ' + @CodeAndTitleColumn + N'
from ' + @DocReviewTableName
          + N' AS  A
INNER JOIN stf.Stuff stf on stf.StuffID = A.StuffID
LEFT JOIN cfg.Currency c on c.CurrencyID = A.CurrencyID
LEFT JOIN sle.SaleModel sm on sm.SaleModelID = A.SaleModelID ' + @LeftJoin + N'
'   ;
print @query


    EXECUTE sp_executesql @query,
                          @param,
                          @pFromDate = @FromDate,
                          @pEndDate = @EndDate,
                          @pDocType = @DocType,
                          @pDocID = @DocID;
END;
