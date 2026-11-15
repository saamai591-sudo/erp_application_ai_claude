-----------------------------------------------------------------------------------------------------------------
CREATE   PROC [SLE].[GetJustificationFromBaseForm]
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
    WHERE dnt.EngName = 'Justification';

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
				-1 AS JustificationID,
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
        SELECT CAST(-i.RowIndex AS INT) AS JustificationItemID,
				-1 AS JustificationID,
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
               GETDATE() CreationDate
        FROM #items AS i;

        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS JustificationItemTraceID,
               CAST(-i.RowIndex AS INT) AS JustificationItemID,
               tr.TraceID,
               tr.DlID,
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
				LEFT JOIN STF.TraceItem AS ti2 ON ti2.TraceItemID = tr.TraceItemID
        WHERE tr.OrderItemID IN
              (
                  SELECT i.OrderItemID FROM #items AS i
              );
    END;
END;
