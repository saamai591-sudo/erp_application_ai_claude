
CREATE   PROCEDURE [STC].[GetStockReceiptItemsForReturnStockReceipt]
(
    @StockDocumentTypeBaseEntityID INT,
    @Financial INT,
    @StuffID INT,
    @Date DATE,
    @StockID INT,
    @DlID BIGINT,
    @DeliverStockID INT
)
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @Culture NVARCHAR(100),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    DECLARE @isPurchase BIT = 0,
            @isTrust BIT = 0;

    IF EXISTS
    (
        SELECT 1
        FROM STC.StockDocumentType sdt
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        WHERE StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
              AND DocumentType = 1
              AND [Type] = 1
    )
        SET @isPurchase = 1;

    IF EXISTS
    (
        SELECT 1
        FROM STC.StockDocumentType sdt
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        WHERE StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
              AND DocumentType = 2
              AND [Type] = 1
    )
        SET @isTrust = 1;
    SELECT ari.StockReceiptItemID,
           ari.StockReceiptID,
           ari.RowIndex,
           ari.StuffID,
           ari.MainQuantity - ISNULL(R.MainQuantity, 0) Non,
           ari.SubQuantity - ISNULL(R.SubQuantity, 0) NonSub,
           CASE
               WHEN Revision.RevisionFee IS NOT NULL THEN
                   Revision.RevisionFee
               ELSE
                   CASE
                       WHEN ari.Price <> 0 THEN
                           ROUND((ari.Price + ari.ShareOfCosts) / ari.MainQuantity, 4)
                       ELSE
                           ROUND((ari.EstimatedPrice + ari.ShareOfCosts) / ari.MainQuantity, 4)
                   END
           END LastRevesionedCost,
           ari.MainQuantity,
           ari.SubQuantity,
           ari.Fee,
           sdt.DocumentType StockReceiptType,
           sr.Number,
           CASE
               WHEN sr.DeliverStockID IS NOT NULL THEN
                   CAST(s.Code AS VARCHAR(150))
               WHEN sr.DeliverDlID IS NOT NULL THEN
                   d.Code
           END AS DeliverCode,
           CASE
               WHEN sr.DeliverStockID IS NOT NULL THEN
                   s.Title
               WHEN sr.DeliverDlID IS NOT NULL THEN
                   d.Title
           END AS DeliverTitle,
           stf.Code AS StuffCode,
           CASE @CultureNo
               WHEN 1 THEN
                   stf.Title
               WHEN 2 THEN
                   stf.Title2
           END AS StuffTitle,
           stf.StuffDetailType,
           stf.IsStuffSerializable,
           CFG.GetCLRSaturnDate(sr.Date, 'YY/MM/DD', 0, 0) AS DateString,
		   sdtb.StockDocumentTypeBaseEntityID,
           ari.Price
    INTO #StockReceiptItem
    FROM STC.StockReceiptItem ari
        JOIN STC.StockReceipt sr
            ON sr.StockReceiptID = ari.StockReceiptID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
        JOIN STF.VWStuff stf
            ON stf.StuffID = ari.StuffID
        LEFT JOIN
        (
            SELECT ROW_NUMBER() OVER (PARTITION BY StockReceiptItemID ORDER BY h.Number DESC) Rno,
                   i.StockReceiptItemID,
                   RevisionPrice,
                   RevisionFee
            FROM STC.RevisionCost h
                JOIN STC.RevisionCostItem i
                    ON h.RevisionCostID = i.RevisionCostID
            WHERE StockReceiptItemID IS NOT NULL
        ) Revision
            ON Rno = 1
               AND Revision.StockReceiptItemID = ari.StockReceiptItemID
        LEFT JOIN STF.Stock s
            ON s.StockID = sr.StockID
        LEFT JOIN ACC.DL d
            ON d.DLID = sr.DeliverDlID
        LEFT JOIN
        (
            SELECT StockReceiptItemID,
                   SUM(MainQuantity) MainQuantity,
                   SUM(SubQuantity) SubQuantity
            FROM STC.ReturnStockReceiptItem
            GROUP BY StockReceiptItemID
        ) R
            ON R.StockReceiptItemID = ari.StockReceiptItemID
    WHERE sr.FinancialPeriodID = @Financial
          AND sr.Date <= @Date
          AND sr.StockID = @StockID
          AND
          (
              @StuffID = 0
              OR ari.StuffID = @StuffID
          )
          AND
          (
              DeliverDlID = @DlID
              OR sr.DeliverStockID = @DeliverStockID
          )
          AND ISNULL(R.MainQuantity, 0) <> ari.MainQuantity;

    IF @isPurchase = 0
       AND @isTrust = 0
    BEGIN
        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        INTO #StockReceiptItemTemp
        FROM #StockReceiptItem
        WHERE StockDocumentTypeBaseEntityID in(
													select sdtb2.StockDocumentTypeBaseEntityID
													FROM STC.StockDocumentTypeBaseEntity sdtb
													JOIN STC.StockDocumentTypeBaseEntity sdtb2
														ON sdtb.StockDocumentTypeID = sdtb2.StockDocumentTypeID
													WHERE sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
													AND sdtb2.Entity = 1 -- رسید انبار
												);

        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        FROM #StockReceiptItemTemp;

        SELECT t.StockReceiptItemTraceID,
               t.StockReceiptItemID,
               t.TraceID,
               t.DlID,
				CASE WHEN tri.TraceItemID IS NOT NULL 
					THEN
						CASE @CultureNo
						WHEN 1 THEN
							tri.Item
						WHEN 2 THEN
							tri.Item2
						END			  
			    ELSE  t.Value END Value,
               t.Version,
               t.Creator,
               t.CreationDate,
               t.LastEditor,
               t.LastEditionDate,
			   t.TraceItemID
        FROM STC.StockReceiptItemTrace t
            JOIN #StockReceiptItemTemp ari
                ON t.StockReceiptItemID = ari.StockReceiptItemID
			LEFT JOIN STF.TraceItem tri 
				ON tri.TraceItemID = t.TraceItemID ;
    END;
    ELSE IF @isPurchase = 1
    BEGIN
        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        INTO #StockReceiptItemTemp1
        FROM #StockReceiptItem
        WHERE StockDocumentTypeBaseEntityID in(
													select sdtb2.StockDocumentTypeBaseEntityID
													FROM STC.StockDocumentTypeBaseEntity sdtb
													JOIN STC.StockDocumentTypeBaseEntity sdtb2
														ON sdtb.StockDocumentTypeID = sdtb2.StockDocumentTypeID
													WHERE sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
													AND sdtb2.Entity = 1 -- رسید انبار
												)
              OR
              (
                  StockReceiptType = 2
                  AND Price > 0
              );

        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        FROM #StockReceiptItemTemp1;

        SELECT t.StockReceiptItemTraceID,
               t.StockReceiptItemID,
               t.TraceID,
               t.DlID,
				CASE WHEN tri.TraceItemID IS NOT NULL 
					THEN
						CASE @CultureNo
						WHEN 1 THEN
							tri.Item
						WHEN 2 THEN
							tri.Item2
						END			  
			    ELSE  t.Value END Value,
               t.Version,
               t.Creator,
               t.CreationDate,
               t.LastEditor,
               t.LastEditionDate,
			   t.TraceItemID
        FROM STC.StockReceiptItemTrace t
            JOIN #StockReceiptItemTemp1 ari
                ON t.StockReceiptItemID = ari.StockReceiptItemID
			LEFT JOIN STF.TraceItem tri 
				ON tri.TraceItemID = t.TraceItemID ;
    END;

    ELSE IF @isTrust = 1
    BEGIN
        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        INTO #StockReceiptItemTemp2
        FROM #StockReceiptItem
        WHERE StockDocumentTypeBaseEntityID in(
													select sdtb2.StockDocumentTypeBaseEntityID
													FROM STC.StockDocumentTypeBaseEntity sdtb
													JOIN STC.StockDocumentTypeBaseEntity sdtb2
														ON sdtb.StockDocumentTypeID = sdtb2.StockDocumentTypeID
													WHERE sdtb.StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
													AND sdtb2.Entity = 1 -- رسید انبار
												)
              AND StockReceiptType = 2
              AND Price = 0;

        SELECT StockReceiptItemID,
               StockReceiptID,
               RowIndex,
               StuffID,
               IsStuffSerializable,
               Non,
               NonSub,
               LastRevesionedCost,
               MainQuantity,
               SubQuantity,
               Fee,
               StockReceiptType,
               Number,
               DeliverCode,
               DeliverTitle,
               StuffCode,
               StuffTitle,
               StuffDetailType,
               DateString
        FROM #StockReceiptItemTemp2;

        SELECT t.StockReceiptItemTraceID,
               t.StockReceiptItemID,
               t.TraceID,
               t.DlID,
				CASE WHEN tri.TraceItemID IS NOT NULL 
					THEN
						CASE @CultureNo
						WHEN 1 THEN
							tri.Item
						WHEN 2 THEN
							tri.Item2
						END			  
			    ELSE  t.Value END Value,
               t.Version,
               t.Creator,
               t.CreationDate,
               t.LastEditor,
               t.LastEditionDate,
			   t.TraceItemID
        FROM STC.StockReceiptItemTrace t
            JOIN #StockReceiptItemTemp2 ari
                ON t.StockReceiptItemID = ari.StockReceiptItemID
			LEFT JOIN STF.TraceItem tri 
				ON tri.TraceItemID = t.TraceItemID ;
    END;
	
END;

