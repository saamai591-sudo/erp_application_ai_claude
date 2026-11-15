------------------------------------------------------------------------------------------------------------------
CREATE   FUNCTION [STC].[StockDocumentTypeDlTypeHasFlow]
(
    @entityId INT
)
RETURNS BIT
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @Result BIT;

    --StockReceiptDl
    IF EXISTS
    (
        SELECT 1
        FROM STC.StockReceipt AS  sr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        JOIN STC.StockReceiptDl AS srd
            ON srd.StockReceiptID = sr.StockReceiptID
        JOIN STC.StockDocumentTypeDlType AS sdtdt
            ON sdtdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
               AND sdtdt.DlTypeID = srd.DlTypeID
        WHERE sdtdt.StockDocumentTypeDlTypeID = @entityId
    )
        SET @Result = 1;

    --OutgoingDl
    IF (
           @Result IS NULL
           OR @Result = 0
       )
       AND EXISTS
    (
        SELECT 1
        FROM STC.Outgoing AS o
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.OutgoingDl AS od
                ON od.OutgoingID = o.OutgoingID
            JOIN STC.StockDocumentTypeDlType AS sdtdt
                ON sdtdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                   AND sdtdt.DlTypeID = od.DlTypeID
        WHERE sdtdt.StockDocumentTypeDlTypeID = @entityId
    )
        SET @Result = 1;

    --ReturnedOutgoingDl
    IF (
           @Result IS NULL
           OR @Result = 0
       )
       AND EXISTS
    (
        SELECT 1
        FROM STC.ReturnedOutgoing AS ro
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON ro.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.ReturnedOutgoingDl AS rod
                ON rod.ReturnedOutgoingID = ro.ReturnedOutgoingID
            JOIN STC.StockDocumentTypeDlType AS sdtdt
                ON sdtdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                   AND sdtdt.DlTypeID = rod.DlTypeID
        WHERE sdtdt.StockDocumentTypeDlTypeID = @entityId
    )
        SET @Result = 1;


    IF (
           @Result IS NULL
           OR @Result = 0
       )
       AND EXISTS
    (
        SELECT 1
        FROM STC.ReturnStockReceipt AS rsr
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON rsr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.ReturnStockReceiptDl AS rsrd
                ON rsrd.ReturnStockReceiptID = rsr.ReturnStockReceiptID
            JOIN STC.StockDocumentTypeDlType AS sdtdt
                ON sdtdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                   AND sdtdt.DlTypeID = rsrd.DlTypeID
        WHERE sdtdt.StockDocumentTypeDlTypeID = @entityId
    )
        SET @Result = 1;
		
    RETURN ISNULL(@Result, 0);
END;

