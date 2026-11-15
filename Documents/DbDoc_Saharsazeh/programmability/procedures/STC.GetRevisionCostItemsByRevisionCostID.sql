CREATE     PROC [STC].[GetRevisionCostItemsByRevisionCostID]
(@RevisionCostID INT)
--With Encryption 
AS
DECLARE @Type TINYINT;
SELECT @Type = [Type]
FROM STC.RevisionCost
WHERE RevisionCostID = @RevisionCostID;

SELECT rci.RevisionCostItemID,
       rci.RevisionCostID,
       rci.StockReceiptItemID,
       rci.ReturnStockReceiptItemID,
       rci.ReturnedOutgoingItemID,
       rci.OutgoingItemID,
       rci.RevisionFee,
       rci.RevisionPrice,
       rci.Deference,
       rci.Description,
       rci.Description2,
       rci.Version,
       rci.Creator,
       rci.CreationDate,
       rci.LastEditor,
       rci.LastEditionDate,
       isnull(rci.PosInvoiceItemID,0)+isnull(rci.PosReturnInvoiceItemID,0) PosInvoiceItemID,
       rci.PosReturnInvoiceItemID
FROM STC.RevisionCostItem rci
WHERE RevisionCostID = @RevisionCostID;

SELECT rci.RevisionCostItemID,
       ro.Number AS ReturnOutgoingBaseNumber,
       o.Number AS OutgoingBaseNumber,
       sr.Number AS ReceiptBaseNumber,
       rsr.Number AS ReturnReceiptBaseNumber,
       CASE
           WHEN @Type = 0 THEN
               ari.StuffID
           WHEN @Type = 1 THEN
               aroi.StuffID
           WHEN @Type = 2 THEN
               rari.StuffID
           WHEN @Type = 3 THEN
               oi.StuffID
           WHEN @Type = 4
                OR @Type = 5 THEN
               pii.StuffID
       END StuffID,
       CASE
           WHEN @Type = 0 THEN
               ari.MainQuantity
           WHEN @Type = 1 THEN
               aroi.MainQuantity
           WHEN @Type = 2 THEN
               rari.MainQuantity
           WHEN @Type = 3 THEN
               oi.MainQuantity
           WHEN @Type = 4
                OR @Type = 5 THEN
               pii.MainQuantity
       END MainQuantity,
       CASE
           WHEN @Type = 0
                AND ari.EstimatedFee > 0 THEN
               ari.EstimatedFee
           WHEN @Type = 0
                AND ari.EstimatedFee = 0 THEN
               ari.Fee
           WHEN @Type = 1 THEN
               aroi.Fee
           WHEN @Type = 2 THEN
               rari.Fee
           WHEN @Type = 3 THEN
               oi.Fee
           WHEN @Type = 4
                OR @Type = 5 THEN
               pii.Fee
       END Fee,
       CASE
           WHEN @Type = 0 THEN
               ari.Price
           WHEN @Type = 1 THEN
               aroi.Price
           WHEN @Type = 2 THEN
               rari.Price
           WHEN @Type = 3 THEN
               oi.Price
           WHEN @Type = 4
                OR @Type = 5 THEN
               pii.Price
       END Price,
       pi.Number AS PosInvoiceBaseNumber,
       pi.Number AS PosReturnInvoiceBaseNumber
FROM STC.RevisionCostItem rci
    LEFT JOIN STC.StockReceiptItem ari
        ON ari.StockReceiptItemID = rci.StockReceiptItemID
    LEFT JOIN STC.StockReceipt sr
        ON sr.StockReceiptID = ari.StockReceiptID
    LEFT JOIN STC.ReturnedOutgoingItem aroi
        ON aroi.ReturnedOutgoingItemID = rci.ReturnedOutgoingItemID
    LEFT JOIN STC.ReturnedOutgoing ro
        ON ro.ReturnedOutgoingID = aroi.ReturnedOutgoingID
    LEFT JOIN STC.ReturnStockReceiptItem rari
        ON rari.ReturnStockReceiptItemID = rci.ReturnStockReceiptItemID
    LEFT JOIN STC.ReturnStockReceipt rsr
        ON rsr.ReturnStockReceiptID = rari.ReturnStockReceiptID
    LEFT JOIN STC.OutgoingItem oi
        ON oi.OutgoingItemID = rci.OutgoingItemID
    LEFT JOIN STC.Outgoing o
        ON o.OutgoingID = oi.OutgoingID
    LEFT JOIN POS.PosInvoiceItem AS pii
        ON pii.PosInvoiceItemID = ISNULL(rci.PosInvoiceItemID,0)+ISNULL(rci.PosReturnInvoiceItemID,0)
    LEFT JOIN POS.PosInvoice AS pi
        ON pi.PosInvoiceID = pii.PosInvoiceID
    LEFT JOIN CFG.[User] Creator
        ON Creator.UserID = rci.Creator
    LEFT JOIN CFG.[User] Editor
        ON Editor.UserID = rci.LastEditor
WHERE RevisionCostID = @RevisionCostID;


--**رسید 
IF (@Type = 0)
BEGIN

    SELECT art.StockReceiptItemID,
           art.StockReceiptID,
           art.RowIndex,
           art.OutgoingItemID,
           art.PurchaseInvoiceItemID,
           art.StuffID,
           art.MainQuantity,
           art.SubQuantity,
           art.Fee,
           art.Price,
           art.EstimatedFee,
           art.EstimatedPrice,
           art.ShareOfCosts,
           art.Description,
           art.Description2,
           art.Version,
           art.Creator,
           art.CreationDate,
           art.LastEditor,
           art.LastEditionDate,
           art.ProposalItemID,
           art.PurchaseRequestItemID,
           art.JustificationInputItemID,
           art.PurchaseContractItemID,
           art.NetPrice,
           art.ClearanceItemID,
           art.ConvertSpecificationID,
           art.ContractSubjectID,
		   art.ProductionPlanningItemID,
		   art.ProductionStatisticItemID
    FROM STC.RevisionCostItem rct
        JOIN STC.StockReceiptItem art
            ON rct.StockReceiptItemID = art.StockReceiptItemID
    WHERE rct.RevisionCostID = @RevisionCostID;

    SELECT arit.StockReceiptItemTraceID,
           arit.StockReceiptItemID,
           arit.TraceID,
           arit.DlID,
           CASE
               WHEN arit.TraceItemID IS NOT NULL THEN
                   ti.Item
               ELSE
                   arit.Value
           END Value,
           arit.Version,
           arit.Creator,
           arit.CreationDate,
           arit.LastEditor,
           arit.LastEditionDate,
           arit.TraceItemID,
           d.Code AS DlCode
    FROM STC.RevisionCostItem rct
        JOIN STC.StockReceiptItem art
            ON rct.StockReceiptItemID = art.StockReceiptItemID
        JOIN STC.StockReceiptItemTrace arit
            ON arit.StockReceiptItemID = art.StockReceiptItemID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = arit.TraceItemID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = arit.DlID
    WHERE rct.RevisionCostID = @RevisionCostID;
END;

--** برگشت حواله
IF (@Type = 1)
BEGIN

    SELECT art.ReturnedOutgoingItemID,
           art.ReturnedOutgoingID,
           art.RowIndex,
           art.OutgoingItemID,
           art.StuffID,
           art.MainQuantity,
           art.SubQuantity,
           art.Fee,
           art.Price,
           art.Description,
           art.Description2,
           art.Version,
           art.Creator,
           art.CreationDate,
           art.LastEditor,
           art.LastEditionDate,
		   art.ReturnedSaleInvoiceItemID
    FROM STC.RevisionCostItem rct
        JOIN STC.ReturnedOutgoingItem art
            ON rct.ReturnedOutgoingItemID = art.ReturnedOutgoingItemID
    WHERE rct.RevisionCostID = @RevisionCostID;

    SELECT arit.ReturnedOutgoingItemTraceID,
           arit.ReturnedOutgoingItemID,
           arit.TraceID,
           arit.DlID,
           CASE
               WHEN arit.TraceItemID IS NOT NULL THEN
                   ti.Item
               ELSE
                   arit.Value
           END Value,
           arit.Version,
           arit.Creator,
           arit.CreationDate,
           arit.LastEditor,
           arit.LastEditionDate,
           arit.TraceItemID,
           d.Code AS DlCode
    FROM STC.RevisionCostItem rct
        JOIN STC.ReturnedOutgoingItem art
            ON rct.ReturnedOutgoingItemID = art.ReturnedOutgoingItemID
        JOIN STC.ReturnedOutgoingItemTrace arit
            ON arit.ReturnedOutgoingItemID = art.ReturnedOutgoingItemID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = arit.TraceItemID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = arit.DlID
    WHERE rct.RevisionCostID = @RevisionCostID;
END;

--**برگشت رسید
IF (@Type = 2)
BEGIN

    SELECT art.ReturnStockReceiptItemID,
           art.ReturnStockReceiptID,
           art.RowIndex,
           art.StockReceiptItemID,
           art.ReturnRequestItemID,
           art.StuffID,
           art.MainQuantity,
           art.SubQuantity,
           art.Fee,
           art.Price,
           art.Description,
           art.Description2,
           art.Version,
           art.Creator,
           art.CreationDate,
           art.LastEditor,
           art.LastEditionDate,
		   art.ZoneID
    FROM STC.RevisionCostItem rct
        JOIN STC.ReturnStockReceiptItem art
            ON rct.ReturnStockReceiptItemID = art.ReturnStockReceiptItemID
    WHERE rct.RevisionCostID = @RevisionCostID;

    SELECT arit.ReturnStockReceiptItemTraceID,
           arit.ReturnStockReceiptItemID,
           arit.TraceID,
           arit.DlID,
           CASE
               WHEN arit.TraceItemID IS NOT NULL THEN
                   ti.Item
               ELSE
                   arit.Value
           END Value,
           arit.Version,
           arit.Creator,
           arit.CreationDate,
           arit.LastEditor,
           arit.LastEditionDate,
           arit.TraceItemID,
           d.Code AS DlCode
    FROM STC.RevisionCostItem rct
        JOIN STC.ReturnStockReceiptItem art
            ON rct.ReturnStockReceiptItemID = art.ReturnStockReceiptItemID
        JOIN STC.ReturnStockReceiptItemTrace arit
            ON arit.ReturnStockReceiptItemID = art.ReturnStockReceiptItemID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = arit.TraceItemID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = arit.DlID
    WHERE rct.RevisionCostID = @RevisionCostID;
END;

--**حواله
IF (@Type = 3)
BEGIN

    SELECT art.OutgoingItemID,
           art.OutgoingID,
           art.RowIndex,
           art.JustificationItemID,
           art.QuotationItemID,
           art.InvoiceItemID,
           art.RemittanceItemID,
           art.StuffRequestItemID,
           art.TemporaryOutgoingItemID,
           art.ReceptionID,
           art.StuffID,
           art.MainQuantity,
           art.SubQuantity,
           art.Fee,
           art.Price,
           art.Description,
           art.Description2,
           art.Version,
           art.Creator,
           art.CreationDate,
           art.LastEditor,
           art.LastEditionDate,
           art.SaleContractItemID,
           art.StuffCompositionID AS StuffCompositionId,
		   art.ZoneID 
    FROM STC.RevisionCostItem rct
        JOIN STC.OutgoingItem art
            ON rct.OutgoingItemID = art.OutgoingItemID
    WHERE rct.RevisionCostID = @RevisionCostID;

    SELECT arit.OutgoingItemTraceID,
           arit.OutgoingItemID,
           arit.TraceID,
           arit.DlID,
           CASE
               WHEN arit.TraceItemID IS NOT NULL THEN
                   ti.Item
               ELSE
                   arit.Value
           END Value,
           arit.Version,
           arit.Creator,
           arit.CreationDate,
           arit.LastEditor,
           arit.LastEditionDate,
           arit.TraceItemID,
           d.Code AS DlCode
    FROM STC.RevisionCostItem rct
        JOIN STC.OutgoingItem art
            ON rct.OutgoingItemID = art.OutgoingItemID
        JOIN STC.OutgoingItemTrace arit
            ON arit.OutgoingItemID = art.OutgoingItemID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = arit.TraceItemID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = arit.DlID
    WHERE rct.RevisionCostID = @RevisionCostID;
END;

--**فروش فروشگاهی
IF (@Type = 4 OR @Type = 5)
BEGIN

    SELECT art.PosInvoiceItemID,
           art.PosInvoiceID,
           art.SaleModelID,
           art.StuffID,
           art.MainQuantity,
           art.SubQuantity,
           art.Fee,
           art.Price,
           art.Discount,
           art.Tax,
           art.Duty,
           art.NetPrice,
           art.Version,
           art.Creator,
           art.CreationDate,
           art.LastEditor,
           art.LastEditionDate,
           art.Cost,
           art.ParentPosInvoiceItemID,
           art.RowIndex,
           art.OrderFoodItemID
    FROM STC.RevisionCostItem rct
        JOIN POS.PosInvoiceItem AS art
            ON ISNULL(rct.PosInvoiceItemID,0)+ISNULL(rct.PosReturnInvoiceItemID,0) = art.PosInvoiceItemID
    WHERE rct.RevisionCostID = @RevisionCostID;

    SELECT arit.PosInvoiceItemTraceID,
           arit.PosInvoiceItemID,
           arit.TraceID,
           arit.DlID,
           CASE
               WHEN arit.TraceItemID IS NOT NULL THEN
                   ti.Item
               ELSE
                   arit.Value
           END Value,
           arit.Version,
           arit.Creator,
           arit.CreationDate,
           arit.LastEditor,
           arit.LastEditionDate,
           arit.TraceItemID,
           d.Code AS DlCode
    FROM STC.RevisionCostItem rct
        JOIN POS.PosInvoiceItem art
            ON ISNULL(rct.PosInvoiceItemID,0)+ISNULL(rct.PosReturnInvoiceItemID,0) = art.PosInvoiceItemID
        JOIN POS.PosInvoiceItemTrace arit
            ON arit.PosInvoiceItemID = art.PosInvoiceItemID
        LEFT JOIN STF.TraceItem AS ti
            ON ti.TraceItemID = arit.TraceItemID
        LEFT JOIN ACC.DL AS d
            ON d.DLID = arit.DlID
    WHERE rct.RevisionCostID = @RevisionCostID;
END;

