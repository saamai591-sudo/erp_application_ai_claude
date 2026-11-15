---------Start of #7707
CREATE   PROC STC.DoPricingClearanceReceipt
    (
        @stockReceiptId INT
    )
--WITH ENCRYPTION
AS
    IF EXISTS (   SELECT 1
                  FROM   STC.StockReceiptItem AS sri
                  WHERE  sri.StockReceiptID = @stockReceiptId
                         AND sri.Price <> 0 )
        BEGIN
            RAISERROR(N'قبلا قیمت گذاری انجام شده است', 16, 12);
			RETURN
        END;

    IF EXISTS (   SELECT sri.StockReceiptItemID
                  FROM   STC.StockReceiptItem AS sri
                         LEFT JOIN FOS.OrderPricingItem AS opi ON opi.ClearanceItemID = sri.ClearanceItemID
                  WHERE  opi.OrderPricingItemID IS NULL
                         AND sri.StockReceiptID = @stockReceiptId )
        BEGIN
            RAISERROR(
                N'برای تمام آیتم های رسید عملیات قیمت گذاری سفارش انجام نشده است.' ,
                16 ,
                12);
				RETURN
        END;

    DECLARE @precicionCount INT;
    SET @precicionCount = CFG.GetBaseCurrencyPrecision();


	;with cte
	as
	(   
		SELECT opi.ClearanceItemID ,
			   opi.Share + p.Price Cost 
		FROM   
		(
			select ClearanceItemID,sum(Share) Share
			from FOS.OrderPricingItem
			where PurchaseInvoiceItemID is  null
			group by ClearanceItemID	
		)opi
		join 
		(
			select ClearanceItemID,sum(Share) Price
			from FOS.OrderPricingItem
			where PurchaseInvoiceItemID is not null
			group by ClearanceItemID	
		)p on p.ClearanceItemID = opi.ClearanceItemID
	),
	cte2
	as ( SELECT SUM(sri.MainQuantity) PricedMain,SUM(sri.Price) PricedPrice,ci.ClearanceItemID
		FROM   STC.StockReceiptItem AS sri
		JOIN FOS.ClearanceItem AS ci ON ci.ClearanceItemID = sri.ClearanceItemID
	     WHERE sri.Price >0
	     GROUP BY ci.ClearanceItemID) ,
	
	cte1
	as
	(
		SELECT sri.StockReceiptItemID ,
		ROUND(cast(sri.MainQuantity as float) / cast(b.MainQuantity - ISNULL(cte2.PricedMain,0) as float) * (cte.cost - ISNULL(cte2.PricedPrice,0))  ,@precicionCount) Price
		FROM   STC.StockReceiptItem AS sri
		JOIN FOS.ClearanceItem AS ci ON ci.ClearanceItemID = sri.ClearanceItemID
		join FOS.BillOfLadingItem b on ci.BillOfLadingItemID = b.BillOfLadingItemID
		JOIN cte ON cte.ClearanceItemID = ci.ClearanceItemID
		left join cte2 on ci.ClearanceItemID = cte2.ClearanceItemID
		WHERE  sri.StockReceiptID = @stockReceiptId
	)



    UPDATE sri
    SET    sri.Price = cte1.Price ,
           sri.Fee = cast(cte1.Price as float) / cast(sri.MainQuantity as float)
    FROM   STC.StockReceiptItem AS sri
    JOIN cte1 ON cte1.StockReceiptItemID = sri.StockReceiptItemID;


    UPDATE STC.StockReceipt
    SET    TotalCosts = (   SELECT SUM(ShareOfCosts)
                            FROM   STC.StockReceiptItem
                            WHERE  StockReceiptID = @stockReceiptId ) ,
           TotalInvoicePrice = (   SELECT SUM(Price)
                                   FROM   STC.StockReceiptItem
                                   WHERE  StockReceiptID = @stockReceiptId ) ,
           TotalNetPrice = (   SELECT SUM(NetPrice)
                               FROM   STC.StockReceiptItem
                               WHERE  StockReceiptID = @stockReceiptId ) ,
           TotalEstimatedPrice = (   SELECT SUM(EstimatedPrice)
                                     FROM   STC.StockReceiptItem
                                     WHERE  StockReceiptID = @stockReceiptId )
    WHERE  StockReceiptID = @stockReceiptId;

    IF OBJECT_ID('tempdb..#t') IS NOT NULL
        DROP TABLE #t;

    SELECT sri.StockReceiptItemID
    INTO   #t
    FROM   STC.StockReceiptItem AS sri
    WHERE  sri.StockReceiptID = @stockReceiptId
           AND sri.EstimatedPrice <> 0;

    IF EXISTS (   SELECT 1
                  FROM   #t )
        BEGIN

            DECLARE @items ArrayInput;

            INSERT @items ( Val )
                   SELECT StockReceiptItemID
                   FROM   #t;

            DECLARE @RevisionCost INT;
            EXEC STC.IssueRevisionCostForStockReceipt @purchaseInvoiceId = 0 ,
                                                      @stockReceiptItemId = @items ,
                                                      @RevisionCost = @RevisionCost OUTPUT;

            EXEC STC.CheckRevisionCostCanIssue @RevisionCostId = @RevisionCost;


        END;
