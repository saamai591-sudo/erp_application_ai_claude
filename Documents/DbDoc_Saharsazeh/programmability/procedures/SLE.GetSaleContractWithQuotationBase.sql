-------------------------------------
CREATE   PROCEDURE [SLE].[GetSaleContractWithQuotationBase] @entityId INT
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @PrecisionCount INT,
            @CultureNo INT;

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = CFG.GetuserCulture();


    SELECT @PrecisionCount = c.PrecisionCount
    FROM SLE.Quotation AS q
        JOIN CFG.Currency AS c
            ON c.CurrencyID = q.CurrencyID
    WHERE q.QuotationID = @entityId;

    SELECT DISTINCT
           tdnt.TraceID
    INTO #TraceIds
    FROM STF.StuffTraceDocumentNum AS stdn
        JOIN STF.TraceDocumentNumType AS tdnt
            ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
        JOIN CFG.DocumentNumType AS dnt
            ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
    WHERE dnt.EngName = 'Quotation';

    SELECT qi.QuotationItemID,
           qi.SaleModelID,
           CAST(ROW_NUMBER() OVER (ORDER BY qi.RowIndex) AS SMALLINT) RowIndex,
           qi.StuffID,
           qno.Non AS MainQuantity,
           qno.NonSub AS SubQuantity,
           CASE
               WHEN qno.Non = qni.Non THEN
                   qni.NonPrice / qno.Non
               ELSE
                   ROUND((qni.NonPrice / qni.MainQuantity), @PrecisionCount)
           END AS Fee,
           CASE
               WHEN qno.Non = qni.Non THEN
                   qni.NonPrice
               ELSE
                   ROUND((qni.NonPrice / qni.MainQuantity) * qno.Non, @PrecisionCount)
           END AS Price,
           CASE
               WHEN qno.Non = qni.Non THEN
                   qni.NonDiscount
               ELSE
                   ROUND((qni.NonDiscount / qni.MainQuantity) * qno.Non, @PrecisionCount)
           END AS Discount,
           s.Code AS StuffCode,
           s.Title AS StuffTitle,
           sd.Barcode AS BarCode,
           sd.IranCode,
           mu.Title MainUnit,
           q.Number QuotationNumber,
           qi.[Description],
           qi.Description2
    INTO #items
    FROM SLE.QuotationItem AS qi
        JOIN SLE.Quotation AS q
            ON q.QuotationID = qi.QuotationID
        JOIN SLE.Quotation_Remains AS qno
            ON qno.QuotationItemID = qi.QuotationItemID
        LEFT JOIN
        (
            SELECT qi3.QuotationItemID,
                   qi3.MainQuantity,
                   qi3.MainQuantity - ISNULL(used1.MainQuantity, 0) AS Non,
                   ISNULL(qi3.SubQuantity, 0) - ISNULL(used1.SubQuantity, 0) AS NonSub,
                   qi3.Price - ISNULL(used1.Price, 0) AS NonPrice,
                   qi3.Discount - ISNULL(used1.Discount, 0) AS NonDiscount
            FROM SLE.QuotationItem qi3
                LEFT JOIN
                (
                    SELECT sci.QuotationItemID,
                           SUM(sci.MainQuantity) AS MainQuantity,
                           SUM(sci.SubQuantity) AS SubQuantity,
                           SUM(sci.Price) AS Price,
                           SUM(sci.Discount) AS Discount
                    FROM SLE.SaleContractItem AS sci
                    WHERE sci.QuotationItemID IS NOT NULL
                    GROUP BY sci.QuotationItemID
                ) used1
                    ON used1.QuotationItemID = qi3.QuotationItemID
        ) AS qni
            ON qni.QuotationItemID = qi.QuotationItemID
        JOIN STF.VWStuff AS s
            ON s.StuffID = qi.StuffID
        JOIN STF.StuffDetail AS sd
            ON sd.StuffID = s.StuffID
        JOIN STF.MeasureUnit AS mu
            ON mu.MeasureUnitID = s.MainMeasureUnitID
    WHERE qi.QuotationID = @entityId
          AND qno.Non > 0
          AND
          (
              qno.NonSub IS NULL
              OR qno.NonSub > 0
          );

    SELECT q.FinancialPeriodID,
			-1 AS SaleContractID,
           q.Date,
           CAST(4 AS TINYINT) BaseDocument,
           q.SaleTypeID AS SaleTypeId,
           q.SaleAreaID AS SaleAreaId,
           q.BranchID,
           q.CustomerID,
           q.CurrencyID
    FROM SLE.Quotation AS q
    WHERE q.QuotationID = @entityId;

    SELECT CAST(-i.RowIndex AS INT) AS SaleContractItemID,
			-1 AS SaleContractID,
           i.RowIndex,
           i.QuotationItemID,
           i.SaleModelID,
           CASE @CultureNo
               WHEN 2 THEN
                   sm.Title2
               ELSE
                   sm.Title
           END AS SaleModelTitle,
           i.StuffID,
           i.StuffCode,
           i.StuffTitle,
           i.BarCode,
           i.IranCode,
           i.MainUnit,
           i.Price,
           i.Discount,
           i.Fee,
           CASE
               WHEN i.Fee = 0 THEN CAST(0 AS BIT)
               ELSE CAST(1 AS BIT)
           END AS PricedFromBase,
           i.QuotationNumber,
           i.MainQuantity,
           i.SubQuantity,
           i.MainQuantity OrgMainQuantity,
           i.SubQuantity OrgSubQuantity,
           GETDATE() CreationDate,
           i.[Description],
           i.Description2
    FROM #items AS i
        JOIN SLE.SaleModel AS sm
            ON sm.SaleModelID = i.SaleModelID;

    SELECT CAST(-1 * ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS INT) AS SaleContractItemTraceID,
           CAST(-i.RowIndex AS INT) AS SaleContractItemID,
           qit.TraceID,
           qit.DlID,
           CASE
               WHEN qit.TraceItemID IS NOT NULL THEN
                   CASE
                       WHEN @CultureNo = 2 THEN
                           ti2.Item2
                       ELSE
                           ti2.Item
                   END
               ELSE
                   qit.Value
           END Value,
           qit.Version,
           qit.Creator,
           qit.CreationDate,
           qit.LastEditor,
           qit.LastEditionDate,
           qit.TraceItemID
    FROM SLE.QuotationItemTrace AS qit
        JOIN #items AS i
            ON i.QuotationItemID = qit.QuotationItemID
        JOIN #TraceIds AS ti
            ON ti.TraceID = qit.TraceID
        LEFT JOIN STF.TraceItem AS ti2
            ON ti2.TraceItemID = qit.TraceItemID
    WHERE qit.QuotationItemID IN
          (
              SELECT i.QuotationItemID FROM #items AS i
          );
END;
