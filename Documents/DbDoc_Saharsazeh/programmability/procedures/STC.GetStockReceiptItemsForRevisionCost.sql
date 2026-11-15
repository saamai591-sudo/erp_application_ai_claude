------------------------------------- START #7277

CREATE   PROCEDURE [STC].[GetStockReceiptItemsForRevisionCost]
(
    @Financial INT,
    @Date DATE,
    @BranchId INT
)
--  WITH ENCRYPTION
AS
BEGIN


    DECLARE @Culture NVARCHAR(100),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT ari.StockReceiptItemID,
           ari.StockReceiptID,
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
           CASE
               WHEN Revision.RevisionPrice IS NOT NULL THEN
                   Revision.RevisionPrice + ISNULL(ari.ShareOfCosts, 0) 
               ELSE
                   ari.Price + ISNULL(ari.ShareOfCosts, 0) 
           END Price,
           ari.MainQuantity,
           ari.SubQuantity,
           ari.Fee,
           ari.ShareOfCosts,
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
           STF.GetStuffCode(ari.StuffID) AS StuffCode,
           CASE @CultureNo
               WHEN 1 THEN
                   stf.Title
               WHEN 2 THEN
                   stf.Title2
           END AS StuffTitle,
           CFG.GetCLRSaturnDate(sr.Date, 'YY/MM/DD', 0, 0) AS DateString
    INTO #StockReceiptItem
    FROM STC.StockReceiptItem ari
	join stc.StockReceipt_PurchaseInvoice sp on sp.StockReceiptItemID = ari.StockReceiptItemID
    JOIN STC.StockReceipt sr
        ON sr.StockReceiptID = ari.StockReceiptID 
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
        ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
    JOIN STC.StockDocumentType sdt
        ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
    JOIN STF.VWStuff stf
        ON stf.StuffID = ari.StuffID
    JOIN STF.Stock stc
        ON stc.StockID = sr.StockID
    LEFT JOIN
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY StockReceiptItemID ORDER BY Number DESC) Rno,
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
          AND ISNULL(R.MainQuantity, 0) <> ari.MainQuantity
          AND sr.Date <= @Date
          AND sdt.DocumentType IN ( 1, 2 )
          AND stc.BranchID = @BranchId;



    SELECT StockReceiptItemID,
           StockReceiptID,
           StuffID,
           Non,
           NonSub,
           LastRevesionedCost,
           Price,
           MainQuantity,
           SubQuantity,
           Fee,
           StockReceiptType,
           Number,
           DeliverCode,
           DeliverTitle,
           StuffCode,
           StuffTitle,
           DateString,
           ShareOfCosts
    FROM #StockReceiptItem;

    SELECT t.StockReceiptItemTraceID,
           t.StockReceiptItemID,
           t.TraceID,
           t.DlID,
           CASE
               WHEN t.TraceItemID IS NOT NULL THEN
                   CASE @CultureNo
                       WHEN 1 THEN
                           ti.Item
                       WHEN 2 THEN
                           ti.Item2
                       ELSE
                           ''
                   END
               ELSE
                   t.Value
           END AS [Value],
           t.Version,
           t.Creator,
           t.CreationDate,
           t.LastEditor,
           t.LastEditionDate,
           t.TraceItemID,
           d.Code DlCode
    FROM STC.StockReceiptItemTrace t
        JOIN StockReceiptItem ari
            ON t.StockReceiptItemID = ari.StockReceiptItemID
        LEFT JOIN ACC.DL d
            ON d.DLID = t.DlID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = t.TraceItemID;

END;
