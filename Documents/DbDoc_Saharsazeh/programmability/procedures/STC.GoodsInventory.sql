---------------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[GoodsInventory]
(
    @StuffId NVARCHAR(MAX) = NULL,
    @stockID INT = NULL,
    @StartDate DATE = NULL
)
--WITH ENCRYPTION ,RECOMPILE
AS

      DECLARE 
        @OpeningStockDocumentTypeBaseEntityID INT,
        @FirstFinancialPeriodEndDate DATE
        
        
        SELECT @FirstFinancialPeriodEndDate = 
        fp.EndDate FROM cfg.FinancialPeriod AS fp
        WHERE fp.StartDate = @StartDate
        
		SELECT @OpeningStockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		FROM stc.StockDocumentType AS sdt
		JOIN stc.StockDocumentTypeBaseEntity sdtb 
			ON  sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID 
		WHERE sdt.[Type] = 1 AND sdt.DocumentType = 7;    
        
   

	create table #GoodsInventoryTemp
		(	
			[Date]	Date,
			StockID int,
			StuffID int,
			MainQuantity Decimal(36,10),
			SubQuantity Decimal(36,10)
		) 


	insert into #GoodsInventoryTemp
	select o.date,StockID,StuffID,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity		 	
	from stc.Outgoing o 
	INNER JOIN stc.OutgoingItem oi on o.OutgoingID = oi.OutgoingID
	where (@StartDate is null or o.Date >= @StartDate)
	and (@StuffId IS NULL or StuffID in ( SELECT value FROM cfg.R_FnCommaStr2Table(@StuffId) ))
	and (@stockID IS NULL or StockID = @stockID)
	
	group by o.date,StockID,StuffID

    insert into #GoodsInventoryTemp
	select o.date,StockID,StuffID,-sum(MainQuantity) MainQuantity,-sum(isnull(SubQuantity,0)) SubQuantity
	from stc.ReturnStockReceipt o 
	INNER JOIN stc.ReturnStockReceiptItem oi on o.ReturnStockReceiptID = oi.ReturnStockReceiptID
	where ( @StartDate is null or o.Date >= @StartDate )
	and (@StuffId IS NULL or StuffID in ( SELECT value FROM cfg.R_FnCommaStr2Table(@StuffId) ))
	and (@stockID IS NULL or StockID = @stockID)
	group by o.date,StockID,StuffID

    insert into #GoodsInventoryTemp
	select o.date,StockID,StuffID,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
	from stc.ReturnedOutgoing o 
	INNER JOIN stc.ReturnedOutgoingItem oi on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
	where ( @StartDate is null or o.Date >= @StartDate )
			and (@StuffId IS NULL or StuffID in ( SELECT value FROM cfg.R_FnCommaStr2Table(@StuffId) ))
			and (@stockID IS NULL or StockID = @stockID)
	group by o.date,StockID,StuffID

    insert into #GoodsInventoryTemp
	select o.date,StockID,StuffID,sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity
	from stc.StockReceipt o 
	INNER JOIN stc.StockReceiptItem oi on o.StockReceiptID = oi.StockReceiptID
	where ( @StartDate is null or o.Date >= @StartDate )
			and (@StuffId IS NULL or StuffID in ( SELECT value FROM cfg.R_FnCommaStr2Table(@StuffId) ))
			and (@stockID IS NULL or StockID = @stockID)
			AND (o.StockDocumentTypeBaseEntityID <> @OpeningStockDocumentTypeBaseEntityID OR o.[Date] BETWEEN @StartDate AND @FirstFinancialPeriodEndDate)
	group by o.date,StockID,StuffID


    insert into #GoodsInventoryTemp
	SELECT  o.Date ,
			StockID ,
			oi.StuffID ,
			sum(case when IsReturnInvoice=0 then -MainQuantity else MainQuantity END) MainQuantity,
			sum(isnull(case when IsReturnInvoice=0 then -SubQuantity else SubQuantity END,0)) SubQuantity	
	FROM    POS.PosInvoice o
			INNER JOIN POS.PosInvoiceItem oi ON oi.PosInvoiceID = o.PosInvoiceID
			INNER JOIN stf.stuff stf on stf.stuffid = oi.stuffid
	where stf.type = 0 
		AND o.Status <> 3
		AND ( @StartDate is null or o.Date >= @StartDate )
	and (@StuffId IS NULL or oi.StuffID in ( SELECT value FROM cfg.R_FnCommaStr2Table(@StuffId) ))
	and (@stockID IS NULL or StockID = @stockID)
		group by o.Date ,StockID ,oi.StuffID


	select [Date],StockID,StuffID,Sum(MainQuantity) MainQuantity,sum(isnull(SubQuantity,0)) SubQuantity 
	from #GoodsInventoryTemp
	group by  [Date],StockID,StuffID
