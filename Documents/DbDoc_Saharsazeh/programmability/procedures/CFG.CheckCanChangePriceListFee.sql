
--------------------------------
CREATE   PROC [CFG].CheckCanChangePriceListFee
(
    @itemId INT,
    @docName NVARCHAR(500)
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @TraceObject NVARCHAR(MAX),
            @Stuff INT,
            @SaleModel INT,
            @Currency INT,
            @Date DATE,
            @MainQuantity DECIMAL(30, 4),
            @Fee DECIMAL(18, 0),
            @userId INT,
            @result BIT,
            @userName NVARCHAR(500),
            @StateShiftId INT,
            @CreationDate DATETIME,
            @itemCurrentFee DECIMAL(30, 4),
            @baseDoc TINYINT,
            @isReturnPosInvoice BIT,
            @PricedFromBase BIT;

    SET @userId = CFG.GetuserID();

    CREATE TABLE #formTraces
    (
        TraceID INT,
        [Value] NVARCHAR(MAX)
    );

    IF @docName = 'JustificationItem'
    BEGIN

        SELECT @Stuff = ji.StuffID,
               @SaleModel = ji.SaleModelID,
               @Currency = j.CurrencyID,
               @Date = j.[Date],
               @MainQuantity = ji.MainQuantity,
               @CreationDate = ji.CreationDate,
               @itemCurrentFee = ji.Fee,
               @baseDoc = j.BaseDocument,
               @PricedFromBase = 0
        FROM SLE.JustificationItem AS ji
            JOIN SLE.Justification AS j
                ON j.JustificationID = ji.JustificationID
        WHERE ji.JustificationItemID = @itemId;

        INSERT INTO #formTraces
        SELECT jit.TraceID,
               CASE
                   WHEN jit.DlID IS NOT NULL THEN
                       CAST(jit.DlID AS NVARCHAR(100))
                   WHEN jit.TraceItemID IS NOT NULL THEN
                       CAST(jit.TraceItemID AS NVARCHAR(100))
                   ELSE
                       jit.[Value]
               END AS [Value]
        FROM SLE.JustificationItemTrace AS jit
        WHERE jit.JustificationItemID = @itemId;

    END;
    ELSE IF @docName = 'QuotationItem'
    BEGIN

        SELECT @Stuff = i.StuffID,
               @SaleModel = i.SaleModelID,
               @Currency = h.CurrencyID,
               @Date = h.[Date],
               @MainQuantity = i.MainQuantity,
               @CreationDate = i.CreationDate,
               @itemCurrentFee = i.Fee,
               @baseDoc = h.BaseDocument,
               @PricedFromBase = i.PricedFromBase
        FROM SLE.QuotationItem AS i
            JOIN SLE.Quotation AS h
                ON h.QuotationID = i.QuotationID
        WHERE i.QuotationItemID = @itemId;


        INSERT INTO #formTraces
        SELECT jit.TraceID,
               CASE
                   WHEN jit.DlID IS NOT NULL THEN
                       CAST(jit.DlID AS NVARCHAR(100))
                   WHEN jit.TraceItemID IS NOT NULL THEN
                       CAST(jit.TraceItemID AS NVARCHAR(100))
                   ELSE
                       jit.[Value]
               END AS [Value]
        FROM SLE.QuotationItemTrace AS jit
        WHERE jit.QuotationItemID = @itemId;

    END;
    ELSE IF @docName = 'SaleContractItem'
    BEGIN

        SELECT @Stuff = i.StuffID,
               @SaleModel = i.SaleModelID,
               @Currency = h.CurrencyID,
               @Date = h.[Date],
               @MainQuantity = i.MainQuantity,
               @CreationDate = i.CreationDate,
               @itemCurrentFee = i.Fee,
               @baseDoc = h.BaseDocument,
               @PricedFromBase = i.PricedFromBase
        FROM SLE.SaleContractItem AS i
            JOIN SLE.SaleContract AS h
                ON h.SaleContractID = i.SaleContractID
        WHERE i.SaleContractItemID = @itemId;

        INSERT INTO #formTraces
        SELECT jit.TraceID,
               CASE
                   WHEN jit.DlID IS NOT NULL THEN
                       CAST(jit.DlID AS NVARCHAR(100))
                   WHEN jit.TraceItemID IS NOT NULL THEN
                       CAST(jit.TraceItemID AS NVARCHAR(100))
                   ELSE
                       jit.[Value]
               END AS [Value]
        FROM SLE.SaleContractItemTrace AS jit
        WHERE jit.SaleContractItemID = @itemId;

    END;

    ELSE IF @docName = 'InvoiceItem'
    BEGIN

        SELECT @Stuff = i.StuffID,
               @SaleModel = i.SaleModelID,
               @Currency = h.CurrencyID,
               @Date = h.[Date],
               @MainQuantity = i.MainQuantity,
               @CreationDate = i.CreationDate,
               @itemCurrentFee = i.Fee,
               @PricedFromBase = i.PricedFromBase,
               @baseDoc = case when  o.OutgoingID is not null then  
                    Case sdtb.BaseEntity 
                        when 1 then 1
                    else NULL END 
               else 
                    h.BaseDocument
                END 
        FROM SLE.InvoiceItem AS i
            JOIN SLE.Invoice AS h
                ON h.InvoiceID = i.InvoiceID
            LEFT JOIN STC.OutgoingItem oi on i.OutgoingItemId = oi.OutgoingItemID
            LEFT JOIN STC.Outgoing o on o.OutgoingId = oi.OutgoingID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID    
        WHERE i.InvoiceItemID = @itemId;

        INSERT INTO #formTraces
        SELECT jit.TraceID,
               CASE
                   WHEN jit.DlID IS NOT NULL THEN
                       CAST(jit.DlID AS NVARCHAR(100))
                   WHEN jit.TraceItemID IS NOT NULL THEN
                       CAST(jit.TraceItemID AS NVARCHAR(100))
                   ELSE
                       jit.[Value]
               END AS [Value]
        FROM SLE.InvoiceItemTrace AS jit
        WHERE jit.InvoiceItemID = @itemId;

    END;

    ELSE IF @docName = 'PosInvoiceItem'
    BEGIN

        SELECT @Stuff = i.StuffID,
               @SaleModel = i.SaleModelID,
               @Currency = -1,
               @Date = h.[Date],
               @MainQuantity = i.MainQuantity,
               @StateShiftId = h.StateShiftID,
               @CreationDate = i.CreationDate,
               @itemCurrentFee = i.Fee,
               @baseDoc = 1,
               @isReturnPosInvoice = h.IsReturnInvoice,
               @PricedFromBase = i.PricedFromBase
        FROM POS.PosInvoiceItem AS i
            JOIN POS.PosInvoice AS h
                ON h.PosInvoiceID = i.PosInvoiceID
        WHERE i.PosInvoiceItemID = @itemId;

        INSERT INTO #formTraces
        SELECT jit.TraceID,
               CASE
                   WHEN jit.DlID IS NOT NULL THEN
                       CAST(jit.DlID AS NVARCHAR(100))
                   WHEN jit.TraceItemID IS NOT NULL THEN
                       CAST(jit.TraceItemID AS NVARCHAR(100))
                   ELSE
                       jit.[Value]
               END AS [Value]
        FROM POS.PosInvoiceItemTrace AS jit
        WHERE jit.PosInvoiceItemID = @itemId;

    END;

    SELECT @TraceObject = STUFF(
    (
        SELECT CASE
                   WHEN tr.AccountLevelTypeID = 1 THEN
                       'TRDl'
                   ELSE
                       'TR'
               END + CAST(tr.TraceID AS NVARCHAR(20)) + ',' + CASE
                                                                  WHEN t1.Value IS NOT NULL THEN
                                                                      t1.Value
                                                                  ELSE
                                                                      'null'
                                                              END + '|'
        FROM
        (
            SELECT DISTINCT
                   st.TraceID,
                   t.AccountLevelTypeID
            FROM STF.StuffTraceDocumentNum AS stdn
                JOIN STF.StuffTrace AS st
                    ON st.StuffTraceID = stdn.StuffTraceID
                JOIN STF.Trace AS t
                    ON t.TraceID = st.TraceID
                JOIN STF.TraceDocumentNumType AS tdnt
                    ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
                JOIN CFG.DocumentNumType AS dnt
                    ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
            WHERE dnt.EngName = @docName
        ) AS tr
            LEFT JOIN #formTraces AS t1
                ON t1.TraceID = tr.TraceID
        ORDER BY tr.TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
                               );

    IF @TraceObject IS NULL
        SET @TraceObject = N'';

    DECLARE @IsAppropriateFeeEditable bit

    EXEC SLE.FindAppropriateFee @TraceObject = @TraceObject,   -- nvarchar(max)
                                @Stuff = @Stuff,               -- int
                                @SaleModel = @SaleModel,       -- int
                                @Currency = @Currency,         -- int
                                @Date = @Date,                 -- date
                                @EngName = @docName,           -- nvarchar(255)
                                @Fee = @Fee OUTPUT,            -- decimal(18, 0)
                                @IsAppropriateFeeEditable = @IsAppropriateFeeEditable OUTPUT,
                                @CreationDate = @CreationDate; -- bit

    IF @userId <> -1
       AND @baseDoc = 1
       AND @Fee IS NOT NULL
       AND @Fee <> @itemCurrentFee
       AND @isReturnPosInvoice <> 1 
       AND @PricedFromBase = 1
       AND @IsAppropriateFeeEditable = 0
    BEGIN
        SET @result = 0;
    END;

    ELSE
    BEGIN
        SET @result = 1;
    END;

    SELECT @result;
END;
