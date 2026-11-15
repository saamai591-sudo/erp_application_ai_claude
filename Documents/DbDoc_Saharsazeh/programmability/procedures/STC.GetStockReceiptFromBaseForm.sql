
CREATE   PROC [STC].GetStockReceiptFromBaseForm
(
    @entityId INT,
    @engName NVARCHAR(MAX), 
    @financePeriodId INT
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
    WHERE dnt.EngName = 'StockReceipt';

    DECLARE @Culture NVARCHAR(5),	
			@StockDocumentTypeBaseEntityID INT,
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF @engName = 'JustificationInput'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS SMALLINT) RowIndex,
               i.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS MainUnit,
               s.IsStuffSerializable,
               ----------------------------------
               i.JustificationInputItemID,
               h.Number JustificationInputNumber,
               r.Non AS MainQuantity,
               r.NonSub AS SubQuantity
        INTO #JustificationInputItems
        FROM STC.JustificationInputItem AS i
            JOIN STC.JustificationInput AS h
                ON h.JustificationInputID = i.JustificationInputID
            JOIN STC.JustificationInput_Remains AS r
                ON r.JustificationInputItemID = i.JustificationInputItemID
            JOIN STF.VwStuff AS s
                ON s.StuffID = i.StuffID
        WHERE i.JustificationInputID = @entityId
              AND r.Non > 0
              AND
              (
                  r.NonSub IS NULL
                  OR r.NonSub > 0
              )
              AND s.[Type] = 0;

        --HEADER

		select @StockDocumentTypeBaseEntityID =  sdtb2.StockDocumentTypeBaseEntityID
		FROM STC.JustificationInput AS ji
        JOIN STC.StockDocumentTypeBaseEntity sdtb
            ON ji.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		JOIN STC.StockDocumentTypeBaseEntity sdtb2
            ON sdtb.StockDocumentTypeID = sdtb2.StockDocumentTypeID
        WHERE ji.JustificationInputID = @entityId
		AND sdtb2.BaseEntity = 6 -- مجوز ورود
		AND sdtb2.Entity = 1 -- رسید انبار

        SELECT @StockDocumentTypeBaseEntityID StockDocumentTypeBaseEntityID,
				-1 AS StockReceiptID,
               pin.DeliverDlID,
               pin.Date,
               pin.FinancialPeriodID,
               GETDATE() CreationDate,
               pin.StockID
        FROM STC.JustificationInput AS pin
        WHERE pin.JustificationInputID = @entityId;

        -- ITEMS
        SELECT CAST(-i.RowIndex AS INT) AS StockReceiptItemID,
			   -1 AS StockReceiptID,
               i.RowIndex,
               i.JustificationInputItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.JustificationInputNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #JustificationInputItems AS i;

        -- TRACES
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS StockReceiptItemTraceID,
               CAST(-i.RowIndex AS INT) AS StockReceiptItemID,
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
        FROM STC.JustificationInputItemTrace AS tr
            JOIN #JustificationInputItems AS i
                ON i.JustificationInputItemID = tr.JustificationInputItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = tr.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = tr.DlID
				LEFT JOIN STF.TraceItem AS ti2 ON ti2.TraceItemID = tr.TraceItemID;
    END;
    ELSE IF @engName = 'ProductionStatistic'
    BEGIN
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.ProductionStatisticItemID) AS SMALLINT) RowIndex,
               i.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               s.Barcode AS BarCode,
               s.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS MainUnit,
               s.IsStuffSerializable,
               i.ProductionStatisticItemID,
               h.Number ProductionStatisticNumber,
               r.MainRemain AS MainQuantity,
               r.SubRemain AS SubQuantity
        INTO #ProductionStatisticItems
        FROM prm.ProductionStatisticItem AS i
            JOIN prm.ProductionStatistic AS h
                ON h.ProductionStatisticID = i.ProductionStatisticID
            JOIN prm.VWProductionStatisticItemRemain AS r
                ON r.ProductionStatisticItemID = i.ProductionStatisticItemID
            JOIN STF.VwStuff AS s
                ON s.StuffID = i.StuffID
        WHERE i.ProductionStatisticID = @entityId
              AND r.MainRemain > 0

	        --HEADER
        SELECT 13 BaseEntity,
			   -1 AS StockReceiptID,
               b.DlID DeliverDlID,
               Date,
               FinancialPeriodID,
               GETDATE() CreationDate
        FROM prm.ProductionStatistic a
		join cfg.CostCenter b on a.CostCenterId = b.CostCenterID
        WHERE ProductionStatisticID = @entityId;

        -- ITEMS
        SELECT CAST(-i.RowIndex AS INT) AS StockReceiptItemID,
				-1 AS StockReceiptID,
               i.RowIndex,
               i.ProductionStatisticItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.IsStuffSerializable,
               i.ProductionStatisticNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.MainQuantity OrgMainQuantity,
               GETDATE() CreationDate,
               i.SubQuantity OrgSubQuantity
        FROM #ProductionStatisticItems AS i;

        -- TRACES
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS StockReceiptItemTraceID,
               CAST(-i.RowIndex AS INT) AS StockReceiptItemID,
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
        FROM prm.ProductionStatisticItemTrace AS tr
            JOIN #ProductionStatisticItems AS i
                ON i.ProductionStatisticItemID = tr.ProductionStatisticItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = tr.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = tr.DlID
			LEFT JOIN STF.TraceItem AS ti2 
				ON ti2.TraceItemID = tr.TraceItemID;
    END;    
    ELSE IF @engName = 'PurchaseContract'
	BEGIN
			DECLARE @PrecisionCount INT

		    SELECT @PrecisionCount = c.PrecisionCount
			FROM VND.PurchaseContract AS pc
			    JOIN CFG.Currency AS c
			        ON c.CurrencyID = pc.CurrencyID
			WHERE pc.PurchaseContractID = @entityId;

			SELECT ROW_NUMBER() OVER (ORDER BY pci.RowIndex) AS RowIndex,
			       pci.PurchaseContractItemID,
			       pc.Number AS PurchaseContractItemNumber,
			       CAST(0 AS decimal) AS Fee,
			       pci.Discount,
			       pcr.Non AS MainQuantity,
			       pcr.NonSub AS SubQuantity,
			       sd.IranCode,
			       sd.Barcode AS BarCode,
			       pci.StuffID,
			       CASE @CultureNo
			           WHEN 1 THEN
			               s.Title
			           WHEN 2 THEN
			               s.Title2
			       END AS StuffTitle,
			       s.Code AS StuffCode,
			       CASE @CultureNo
			           WHEN 1 THEN
			               mu.Title
			           WHEN 2 THEN
			               mu.Title2
			       END AS MainUnit,
                   s.IsStuffSerializable,
			       CAST(0 AS decimal) AS Price,
			       CAST(0 AS decimal) AS NetPrice
			INTO #StockReceiptItems
			FROM VND.PurchaseContractItem AS pci
			    JOIN VND.PurchaseContract AS pc
			        ON pci.PurchaseContractID = pc.PurchaseContractID
			    JOIN [VND].[PurchaseContract_Remains] AS pcr
			        ON pci.PurchaseContractItemID = pcr.PurchaseContractItemID
			    JOIN STF.[VWStuff] AS s
			        ON s.StuffID = pci.StuffID
			    JOIN STF.StuffDetail AS sd
			        ON sd.StuffID = s.StuffID
			    JOIN STF.MeasureUnit AS mu
			        ON mu.MeasureUnitID = s.MainMeasureUnitID
			WHERE pc.PurchaseContractID = @entityId
			      AND pcr.Non > 0
			      AND
			      (
			          pcr.NonSub IS NULL
			          OR pcr.NonSub > 0
			      )
		    --header
			SELECT pc.FinancialPeriodID,
			       -1 AS StockReceiptID,				   
			       CAST(8 AS TINYINT) AS BaseEntity,
			       pc.[Date],
				   pc.Number,
			       pc.BranchID,
			       pc.DlID AS DeliverDlID,			   
			       GETDATE() CreationDate
			FROM VND.PurchaseContract AS pc
			JOIN acc.dl d ON pc.Dlid = d.DlID	 

			WHERE pc.PurchaseContractID = @entityId;

			-- items
			SELECT CAST(-1 * t.RowIndex AS INT) AS StockReceiptItemID,
				   -1 AS StockReceiptID,
			       CAST(t.RowIndex AS TINYINT) RowIndex,
			       t.PurchaseContractItemID,
				   t.PurchaseContractItemNumber,
			       t.Fee,
			       t.Discount,
			       t.MainQuantity,
			       t.SubQuantity,
			       t.IranCode,
			       t.BarCode,
			       t.StuffID,
			       t.StuffTitle,
			       t.StuffCode,
			       t.MainUnit,
                   t.IsStuffSerializable,
			       t.Price
			FROM #StockReceiptItems AS t;
	END;   
    ELSE IF @engName = 'DeliveryJustification'
	BEGIN

			SELECT ROW_NUMBER() OVER (ORDER BY dji.RowIndex) AS RowIndex,
			       dji.DeliveryJustificationItemID,
			       dj.Number AS DeliveryJustificationItemNumber,
			       djr.Non AS MainQuantity,
			       djr.NonSub AS SubQuantity,
			       sd.IranCode,
			       sd.Barcode AS BarCode,
			       dji.StuffID,
			       CASE @CultureNo
			           WHEN 1 THEN
			               s.Title
			           WHEN 2 THEN
			               s.Title2
			       END AS StuffTitle,
			       s.Code AS StuffCode,
			       CASE @CultureNo
			           WHEN 1 THEN
			               mu.Title
			           WHEN 2 THEN
			               mu.Title2
			       END AS MainUnit,
                   s.IsStuffSerializable
			INTO #DeliveryJustificationItems

			FROM VND.DeliveryJustificationItem AS dji
			    JOIN VND.DeliveryJustification AS dj
			        ON dji.DeliveryJustificationID = dj.DeliveryJustificationID
			    JOIN [VND].[DeliveryJustification_Remains] AS djr
			        ON dji.DeliveryJustificationItemID = djr.DeliveryJustificationItemID
			    JOIN STF.[VWStuff] AS s
			        ON s.StuffID = dji.StuffID
			    JOIN STF.StuffDetail AS sd
			        ON sd.StuffID = s.StuffID
			    JOIN STF.MeasureUnit AS mu
			        ON mu.MeasureUnitID = s.MainMeasureUnitID
			WHERE dj.DeliveryJustificationID = @entityId
			      AND djr.Non > 0
			      AND
			      (
			          djr.NonSub IS NULL
			          OR djr.NonSub > 0
			      )
		    --header
			SELECT @financePeriodId AS FinancialPeriodID,
                   -1 AS StockReceiptID,				   
			       CAST(15 AS TINYINT) AS BaseEntity,
			       dj.[Date],
				   dj.Number,
			       dj.BranchID,
			       p.DlID AS DeliverDlID,			   
			       GETDATE() CreationDate
			FROM VND.DeliveryJustification AS dj
            JOIN CFG.Party p ON p.PartyID = dj.PartyID
			JOIN acc.dl d ON p.DlID = d.DlID	 

			WHERE dj.DeliveryJustificationID = @entityId;

			-- items
			SELECT CAST(-1 * t.RowIndex AS INT) AS StockReceiptItemID,
				   -1 AS StockReceiptID,
			       CAST(t.RowIndex AS TINYINT) RowIndex,
			       t.DeliveryJustificationItemID,
				   t.DeliveryJustificationItemNumber,
			       t.MainQuantity,
			       t.SubQuantity,
			       t.IranCode,
			       t.BarCode,
			       t.StuffID,
			       t.StuffTitle,
			       t.StuffCode,
			       t.MainUnit,
                   t.IsStuffSerializable
			FROM #DeliveryJustificationItems AS t;
	END;
END;

