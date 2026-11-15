
------------------------------------- 
CREATE   PROC REQ.spStuffRequestReview_Flow
(@StuffRequestItemID INT,
@Document    NVARCHAR(250))
as

 DECLARE	@DateType       TINYINT,
            @DateFormat     VARCHAR(10);

SET @DateFormat = cfg.GetCurrentUserDateFormat()
SET @DateType = cfg.GetCurrentUserDateType()
    
SELECT vsrrds.[Document],
       vsrrds.DocumentID,
       vsrrds.DocumentNumber,
       cfg.GetCLRSaturnDate (vsrrds.DocumentDate,@DateFormat,0,@dateType) DocumentDate,
       ISNULL(vsrrds.PurchaseRequestQuantity, 0) +
       ISNULL(vsrrds.PurchaseContractQuantity, 0) + ISNULL(vsrrds.TemporaryStockReceiptQuantity, 0)+
       ISNULL(vsrrds.StockReceiptQuantity, 0) + ISNULL(vsrrds.OutgoingQuantity, 0) Quantity
FROM   req.vwStuffRequestReviewDataSource AS vsrrds
WHERE  vsrrds.StuffRequestItemID = @StuffRequestItemID
       AND vsrrds.[Document] = @Document
