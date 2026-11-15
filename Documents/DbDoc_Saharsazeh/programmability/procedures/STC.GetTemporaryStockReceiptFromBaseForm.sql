
---------------------------------------------------------
CREATE   PROC [STC].GetTemporaryStockReceiptFromBaseForm
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
    WHERE dnt.EngName = 'TemporaryStockReceipt';

    DECLARE @Culture NVARCHAR(5),	
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF @engName = 'DeliveryJustification'
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
			       END AS MainUnit
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
                   -1 AS TemporaryStockReceiptID,				   
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
			SELECT CAST(-1 * t.RowIndex AS INT) AS TemporaryStockReceiptItemID,
				   -1 AS TemporaryStockReceiptID,
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
			       t.MainUnit
			FROM #DeliveryJustificationItems AS t;
	END;

	IF @engName = 'PurchaseContract'
	BEGIN

			SELECT ROW_NUMBER() OVER (ORDER BY pci.RowIndex) AS RowIndex,
			       pci.PurchaseContractItemID,
			       pc.Number AS PurchaseContractItemNumber,
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
			       END AS MainUnit
			INTO #PurchaseContractItems

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
			SELECT @financePeriodId AS FinancialPeriodID,
                   -1 AS TemporaryStockReceiptID,				   
			       CAST(15 AS TINYINT) AS BaseEntity,
			       pc.[Date],
				   pc.Number,
			       pc.BranchID,
			       pc.DlID AS DeliverDlID,			   
			       GETDATE() CreationDate
			FROM VND.PurchaseContract AS pc
			JOIN acc.dl d ON pc.DlID = d.DlID	 

			WHERE pc.PurchaseContractID = @entityId;

			-- items
			SELECT CAST(-1 * t.RowIndex AS INT) AS TemporaryStockReceiptItemID,
				   -1 AS TemporaryStockReceiptID,
			       CAST(t.RowIndex AS TINYINT) RowIndex,
			       t.PurchaseContractItemID,
				   t.PurchaseContractItemNumber,
			       t.MainQuantity,
			       t.SubQuantity,
			       t.IranCode,
			       t.BarCode,
			       t.StuffID,
			       t.StuffTitle,
			       t.StuffCode,
			       t.MainUnit
			FROM #PurchaseContractItems AS t;
	END;
END;
