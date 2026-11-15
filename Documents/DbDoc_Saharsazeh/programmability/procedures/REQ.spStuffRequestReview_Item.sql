    
-------------------------------------
CREATE   PROC REQ.spStuffRequestReview_Item
(@FromDate DATE,
@ToDate DATE)
as

    DECLARE @Culture        NVARCHAR(20),
            @cultureNo      INT,
            @DateType       TINYINT,
            @DateFormat     VARCHAR(10);
 
SET @Culture = CFG.GetuserCulture();
 
SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture
 
SELECT @CultureNo = CultureNo
FROM   CFG.CultureInfo
WHERE  Culture = @Culture
 
SET @DateFormat = cfg.GetCurrentUserDateFormat()
SET @DateType = cfg.GetCurrentUserDateType()

SELECT *
INTO   #vwEnums
FROM   cfg.VwEnums AS ve
WHERE  ve.Enum IN ('RequestStates')
 
 

SELECT vsrrds.StuffRequestItemID,
	   SUM(ISNULL(vsrrds.PurchaseRequestQuantity,0)) PurchaseRequestQuantity,
       SUM(ISNULL(vsrrds.PurchaseContractQuantity,0)) PurchaseContractQuantity,
       SUM(ISNULL(vsrrds.TemporaryStockReceiptQuantity,0)) TemporaryStockReceiptQuantity,
       SUM(ISNULL(vsrrds.StockReceiptQuantity,0))     StockReceiptQuantity,
       SUM(ISNULL(vsrrds.OutgoingQuantity,0))         OutgoingQuantity
INTO   #Source
FROM   req.vwStuffRequestReviewDataSource AS vsrrds
WHERE  vsrrds.StuffRequestDate between @FromDate and @ToDate
GROUP BY
       vsrrds.StuffRequestItemID
       
   

SELECT sri.StuffRequestItemID ,sr.StuffRequestNumber,
       cfg.GetCLRSaturnDate(sr.StuffRequestDate, @DateFormat, 0, @dateType) StuffRequestDate,
       ve.[Value]                    StuffRequestStatus,
       CASE 
            WHEN @cultureNo = 1 THEN ou.Title
            ELSE ou.Title2
       END                           OrganizationUnitTitle,
       b.Code BranchCode,
       CASE 
            WHEN @cultureNo = 1 THEN b.Title
            ELSE b.Title2
       END                           BranchTitle,
       v.code StuffCode,
       CASE 
            WHEN @cultureNo = 1 THEN v.Title
            ELSE v.Title2    END   StuffTitle,
       sri.MainQuantity              RequestedQuantity,
       sri.AcceptRequestMainMeasureQuantity,
       src.PurchaseRequestQuantity,
       src.PurchaseContractQuantity,
       src.TemporaryStockReceiptQuantity,
       src.StockReceiptQuantity,
       src.OutgoingQuantity,
       sri.AcceptRequestMainMeasureQuantity - ISNULL(src.OutgoingQuantity, 0) NonOutgoing,
       sri.AcceptRequestMainMeasureQuantity - ISNULL(src.TemporaryStockReceiptQuantity, 0) - ISNULL(src.StockReceiptQuantity, 0)
       -ISNULL(src.PurchaseContractQuantity, 0) - ISNULL(src.PurchaseRequestQuantity,0) NonPurchaseFlow,
       'StuffRequest' as Document,
       sr.StuffRequestID As DocumentID
FROM   req.StuffRequestItem       AS sri
       JOIN req.StuffRequest      AS sr
            ON  sr.StuffRequestID = sri.StuffRequestID
       JOIN stf.VWStuff           AS v
            ON  v.StuffID = sri.StuffID
       JOIN cfg.OrganizationUnit  AS ou
            ON  sr.OrganizationUnitID = ou.OrganizationUnitID
       JOIN #vwEnums              AS ve
            ON  sr.StuffRequestState = ve.KeyValue
            AND ve.Enum = 'RequestStates'
       JOIN cfg.Branch            AS b
            ON  sr.BranchID = b.BranchID
       left JOIN #Source src
            ON  sri.StuffRequestItemID = src.StuffRequestItemID
WHERE sr.StuffRequestDate between @FromDate and @ToDate
