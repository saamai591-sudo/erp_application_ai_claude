-------------------------------------
CREATE   PROC [SLE].[GetQuotationFromBaseForm]
(
    @entityId INT,
    @engName NVARCHAR(MAX)
)
--WITH ENCRYPTION
AS
BEGIN
    SELECT DISTINCT
           tdnt.TraceID
    INTO #TraceIds
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE dnt.EngName = 'Quotation';

    DECLARE @itemType BIT,
            @StockDocumentTypeID INT,
            @Culture NVARCHAR(5),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF (@engName = 'Order')
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS SMALLINT) RowIndex,
               i.OrderItemID,
               i.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               h.Number OrderNumber,
               n.Non AS MainQuantity,
               n.NonSub AS SubQuantity,
               SAG.StuffDetailType
        INTO #items
        FROM CTM.OrderItem AS i
            JOIN CTM.[Order] AS h
                ON h.OrderID = i.OrderID
            JOIN SLE.Order_Remains AS n
                ON n.OrderItemID = i.OrderItemID
            JOIN STF.VWStuff AS s
                ON s.StuffID = i.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE h.OrderID = @entityId
              AND h.[Status] <> 2
              AND n.Non > 0
              AND
              (
                  n.NonSub IS NULL
                  OR n.NonSub > 0
              );

        --header
        SELECT h.FinancialPeriodID,
				-1000 AS QuotationID,
               CAST(2 AS TINYINT) AS BaseDocument,
               h.SaleTypeID AS SaleTypeId,
               h.SaleAreaID AS SaleAreaId,
               h.BranchID,
               h.CustomerID,
               h.AddressID,
               h.[Date],
               GETDATE() CreationDate
        FROM CTM.[Order] AS h
        WHERE h.OrderID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS QuotationItemID,
				-1000 AS QuotationID,
               i.RowIndex,
               i.StuffID,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AS OrgMainQuantity,
               i.SubQuantity AS OrgSubQuantity,
               i.OrderItemID,
               i.OrderNumber,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               CAST(0 AS BIT) AS PricedFromBase,
               GETDATE() CreationDate
        FROM #items AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS QuotationItemTraceID,
               CAST(-i.RowIndex AS INT) AS QuotationItemID,
               tr.TraceID,
               tr.DlID,
               d.Code DlCode,
                CASE
                   WHEN tr.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       tr.Value
               END Value,
               tr.Version,
               tr.Creator,
               tr.CreationDate,
               tr.LastEditor,
               tr.LastEditionDate,
			   tr.TraceItemID
        FROM CTM.OrderItemTrace AS tr
            JOIN #items AS i
                ON i.OrderItemID = tr.OrderItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = tr.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = tr.DlID
				
				 LEFT JOIN STF.TraceItem AS ti2 ON ti2.TraceItemID = tr.TraceItemID;
    END;
    IF (@engName = 'Justification')
    BEGIN
        DECLARE @basePrecisionCount INT;

        SELECT @basePrecisionCount = c.PrecisionCount
        FROM SLE.Justification AS j
            JOIN CFG.Currency AS c
                ON c.CurrencyID = j.CurrencyID
        WHERE j.JustificationID = @entityId;

        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS SMALLINT) RowIndex,
               i.JustificationItemID,
               i.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               h.Number JustificationNumber,
               n.Non AS MainQuantity,
               n.NonSub AS SubQuantity,
               i.SaleModelID,
               SAG.StuffDetailType,
               CASE
                   WHEN JNI.Non = n.Non THEN
                       JNI.NonPrice
                   ELSE
                       ROUND((JNI.Price / JNI.MainQuantity) * n.Non, @basePrecisionCount)
               END AS Price,
               CASE
                   WHEN JNI.Non = n.Non THEN
                       JNI.NonDiscount
                   ELSE
                       ROUND((JNI.Discount / JNI.MainQuantity) * n.Non, @basePrecisionCount)
               END AS Discount,
               CASE
                   WHEN JNI.Non = n.Non THEN
                       i.Fee
                   ELSE
                       ROUND((JNI.Price / JNI.MainQuantity), @basePrecisionCount)
               END AS Fee
        INTO #JustificationItems
        FROM SLE.JustificationItem AS i
            JOIN SLE.[Justification] AS h
                ON h.JustificationID = i.JustificationID
            JOIN SLE.Justification_Remains AS n
                ON n.JustificationItemID = i.JustificationItemID
            LEFT JOIN SLE.Justification_Non_Invoice JNI
                ON JNI.JustificationItemID = i.JustificationItemID
            JOIN STF.VWStuff AS s
                ON s.StuffID = i.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
        WHERE h.JustificationID = @entityId
              AND h.[Status] <> 2
              AND n.Non > 0
              AND
              (
                  n.NonSub IS NULL
                  OR n.NonSub > 0
              );

        --header
        SELECT h.FinancialPeriodID,
				-1000 AS QuotationID,
               CAST(3 AS TINYINT) AS BaseDocument,
               h.SaleTypeID AS SaleTypeId,
               h.SaleAreaID AS SaleAreaId,
               h.BranchID,
               h.CurrencyID,
               h.CustomerID,
               h.AddressID,
               h.[Date],
               GETDATE() CreationDate
        FROM SLE.[Justification] AS h
        WHERE h.JustificationID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS QuotationItemID,
				-1000 AS QuotationID,
               i.RowIndex,
               i.StuffID,
               i.SaleModelID,
               CASE @CultureNo
                   WHEN 1 THEN
                       sm.Title
                   WHEN 2 THEN
                       sm.Title2
               END AS SaleModelTitle,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity AS OrgMainQuantity,
               i.SubQuantity AS OrgSubQuantity,
               i.JustificationItemID,
               i.JustificationNumber,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               GETDATE() CreationDate,
               i.Price,
               i.Discount,
               i.Fee,
               CASE
                   WHEN i.Fee = 0 THEN CAST(0 AS BIT)
                   ELSE CAST(1 AS BIT)
               END AS PricedFromBase
        FROM #JustificationItems AS i
            JOIN SLE.SaleModel AS sm
                ON sm.SaleModelID = i.SaleModelID;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS QuotationItemTraceID,
               CAST(-i.RowIndex AS INT) AS QuotationItemID,
               tr.TraceID,
               tr.DlID,
               d.Code DlCode,
                CASE
                   WHEN tr.TraceItemID IS NOT NULL THEN
                       CASE
                           WHEN @CultureNo = 2 THEN
                               ti2.Item2
                           ELSE
                               ti2.Item
                       END
                   ELSE
                       tr.Value
               END Value,
               tr.Version,
               tr.Creator,
               tr.CreationDate,
               tr.LastEditor,
               tr.LastEditionDate,
			   tr.TraceItemID
        FROM SLE.JustificationItemTrace AS tr
            JOIN #JustificationItems AS i
                ON i.JustificationItemID = tr.JustificationItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = tr.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = tr.DlID
				 LEFT JOIN STF.TraceItem AS ti2 ON ti2.TraceItemID = tr.TraceItemID;
    END;
END;
