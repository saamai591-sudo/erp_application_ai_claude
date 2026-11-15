
CREATE   PROC [SLE].GetReturnedSaleInvoiceFromBaseForm
(
    @entityId INT,
    @engName NVARCHAR(MAX)
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
    WHERE dnt.EngName = 'ReturnedSaleInvoice';

    DECLARE @itemType BIT,
            @StockDocumentTypeID INT,
            @Culture NVARCHAR(5),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;
    
    

    IF (@engName = 'ReturnedOutgoing')
    BEGIN
    	
   	
    	
    	CREATE TABLE #Src
    	(ReturnedOutgoingItemID int,
       CurrencyID int,
       Price  DECIMAL(36,10),
       Discount  DECIMAL(36,10),
       MainQuantity DECIMAL(36,10),
       SaleModelID SMALLINT,
       SaleModelTitle NVARCHAR(250), 
       SaleTypeID int,
       SaleAreaID int,
       InvoiceItemID int)
       
       
     INSERT INTO #Src
     (
     	ReturnedOutgoingItemID,
     	CurrencyID,
     	Price,
     	Discount,
     	MainQuantity,
     	SaleModelID,
     	SaleModelTitle,
     	SaleTypeID,
     	SaleAreaID,
     	InvoiceItemID
     )
    
    	           
SELECT roi.ReturnedOutgoingItemID,
       inv.CurrencyID,
       ii.Price,
       ii.Discount,
       ii.MainQuantity,
       ii.SaleModelID,
       sm.Title              AS SaleModelTitle,
       inv.SaleTypeID,
       inv.SaleAreaID,
       ii.InvoiceItemID
FROM   
stc.ReturnedOutgoingItem AS roi
join 
STC.OutgoingItem      AS oi on oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.Invoice_OutGoing inout
            ON  inout.OutgoingItemID = oi.OutgoingItemID
       JOIN SLE.InvoiceItem  AS ii
            ON  ii.InvoiceItemID = inout.InvoiceItemID
       JOIN SLE.Invoice      AS inv
            ON  inv.InvoiceID = ii.InvoiceID
       JOIN SLE.SaleModel    AS sm
            ON  sm.SaleModelID = ii.SaleModelID
WHERE roi.ReturnedOutgoingID = @entityId
UNION ALL
                        
SELECT 
roi.ReturnedOutgoingItemID,
i.CurrencyID,
       ii.Price,
       ii.Discount,
       ii.MainQuantity,
       ii.SaleModelID,
       sm.Title                     SaleModelTitle,
       i.SaleTypeID,
       i.SaleAreaID,
       ii.InvoiceItemID
FROM   stc.ReturnedOutgoingItem  AS roi
       JOIN sle.ReturnedSaleJustificationItem AS rsji
            ON  rsji.ReturnedSaleJustificationItemID = roi.ReturnedSaleJustificationItemID
       JOIN sle.InvoiceItem      AS ii
            ON  ii.InvoiceItemID = rsji.InvoiceItemID
       JOIN sle.Invoice          AS i
            ON  i.InvoiceID = ii.InvoiceID
       JOIN sle.SaleModel        AS sm
            ON  sm.SaleModelID = ii.SaleModelID    	
WHERE roi.ReturnedOutgoingID = @entityId
    	
    	  	
    	
        SELECT CAST(ROW_NUMBER() OVER (ORDER BY i.RowIndex) AS SMALLINT) RowIndex,
               i.ReturnedOutgoingItemID,
               i.StuffID,
               s.Code AS StuffCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       s.Title
                   WHEN 2 THEN
                       s.Title2
               END AS StuffTitle,
               sd.Barcode AS BarCode,
               sd.IranCode,
               CASE @CultureNo
                   WHEN 1 THEN
                       mu.Title
                   WHEN 2 THEN
                       mu.Title2
               END AS MainUnit,
               h.Number ReturnOutgoingNumber,
               SAG.StuffDetailType,
               st.BranchID,
               i.MainQuantity - ISNULL(non.MainQuantity,0) AS MainQuantity,
               i.SubQuantity - ISNULL(non.SubQuantity,0) AS SubQuantity,
              CASE WHEN  BaseInvoice.CurrencyID IS NOT NULL THEN  BaseInvoice.CurrencyID  
              END AS BaseCurrencyId,
                CASE WHEN  BaseInvoice.SaleTypeID IS NOT NULL THEN  BaseInvoice.SaleTypeID  
                END AS BaseSaleTypeId,
			   BaseInvoice.SaleAreaID,
                CASE
                    WHEN i.MainQuantity = BaseInvoice.MainQuantity THEN
                        BaseInvoice.Price
                    ELSE
                        (BaseInvoice.Price / BaseInvoice.MainQuantity) * i.MainQuantity
                END AS InvoicePrice,
                CASE
                    WHEN i.MainQuantity = BaseInvoice.MainQuantity THEN
                        BaseInvoice.Discount
                    ELSE
                        (BaseInvoice.Discount / BaseInvoice.MainQuantity) * i.MainQuantity
                END AS InvoiceDiscount,
               CASE
              WHEN BaseInvoice.SaleModelID IS NOT NULL THEN
                    BaseInvoice.SaleModelID    END  SaleModelId,
               CASE
                   WHEN BaseInvoice.SaleModelID IS NOT NULL THEN
                       BaseInvoice.SaleModelTitle
               END SaleModelTitle,
			   BaseInvoice.InvoiceItemID
			   
        INTO #items
        FROM STC.ReturnedOutgoingItem AS i
            JOIN STC.ReturnedOutgoing AS h
                ON h.ReturnedOutgoingID = i.ReturnedOutgoingID
            LEFT JOIN
            (
				SELECT ReturnedOutgoingItemID,
                        SUM(rsii.MainQuantity) MainQuantity,
                        SUM(rsii.SubQuantity) SubQuantity
                FROM SLE.ReturnedSaleInvoiceItem AS rsii
                GROUP BY rsii.ReturnedOutgoingItemID
            ) AS non
                ON non.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID
            JOIN STF.Stock AS st
                ON st.StockID = h.StockID
            JOIN STF.[Stuff] AS s
                ON s.StuffID = i.StuffID
            JOIN STF.StuffDetail AS sd
                ON sd.StuffID = s.StuffID
			JOIN STF.StuffAccountGroup SAG 
				ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
            JOIN STF.MeasureUnit AS mu
                ON mu.MeasureUnitID = s.MainMeasureUnitID
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType AS sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            LEFT JOIN #Src AS BaseInvoice
                ON BaseInvoice.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID                                                    
        WHERE i.ReturnedOutgoingID = @entityId
              AND i.MainQuantity - ISNULL(non.MainQuantity,0) > 0
              AND sdt.DocumentType = 1
			  and i.ReturnedSaleInvoiceItemID is null
			  
        DECLARE @baseCurrency INT,
				@SaleTypeID int,
				@SaleAreaID int

        SELECT TOP 1
               @baseCurrency = it.BaseCurrencyId
        FROM #items AS it;
        
		select BaseSaleTypeId INTO #Trrrr from #items group by BaseSaleTypeId

		if @@ROWCOUNT = 1
		SELECT TOP 1
               @SaleTypeID = it.BaseSaleTypeId
        FROM #items AS it;
        
  		select SaleAreaID INTO #Trrrr1 from #items group by SaleAreaID

		if @@ROWCOUNT = 1
		begin
		SELECT TOP 1
               @SaleAreaID = it.SaleAreaID
        FROM #items AS it;
		end
			
        --header
        SELECT h.FinancialPeriodID,
			   -1 AS ReturnedSaleInvoiceID,
               p.PartyID AS CustomerID,
               CASE @CultureNo
                   WHEN 1 THEN
                       p.Title +' ' + p.LastName
                   WHEN 2 THEN
                       p.Title2 +' ' + p.LastName2
               END AS CustomerName,
               d.Code AS CustomerDlCode,
               p.DlID AS CustomerDlId,
               s.BranchID,
               h.[Date],
               GETDATE() CreationDate,
			   @baseCurrency CurrencyID,
			   @SaleTypeID SaleTypeId,
			   @SaleAreaID SaleAreaId
        FROM STC.ReturnedOutgoing AS h
            JOIN CFG.Party AS p
                ON p.DlID = h.DlDeliverID
            JOIN ACC.DL AS d
                ON d.DLID = p.DlID
            JOIN STF.Stock AS s
                ON s.StockID = h.StockID
        WHERE h.ReturnedOutgoingID = @entityId;

        -- Items
        SELECT CAST(-i.RowIndex AS INT) AS ReturnedSaleInvoiceItemID,
			   -1 AS ReturnedSaleInvoiceID,
               i.RowIndex,
               i.ReturnedOutgoingItemID,
               i.StuffID,
               i.StuffCode,
               i.StuffTitle,
               i.BarCode,
               i.IranCode,
               i.MainUnit,
               i.ReturnOutgoingNumber,
               i.MainQuantity,
               i.SubQuantity,
               i.BaseCurrencyId,
               i.BaseSaleTypeId,
               i.InvoicePrice/i.MainQuantity AS Fee,
             CASE WHEN ISNULL(InvoicePrice,0)= 0 then  CAST( 0 as BIT) else CAST(1 as BIT) END  PricedFromBase,
               i.InvoicePrice AS Price,
               i.InvoiceDiscount AS Discount,
               i.SaleModelID AS SaleModelID,
               i.SaleModelTitle,
               GETDATE() CreationDate,
			   InvoiceItemID 
        FROM #items AS i;
        
     
        -- traces
        SELECT CAST(- (ROW_NUMBER() OVER (ORDER BY i.RowIndex)) AS INT) AS ReturnedSaleInvoiceItemTraceID,
               CAST(-i.RowIndex AS INT) AS ReturnedSaleInvoiceItemID,
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
        FROM STC.ReturnedOutgoingItemTrace AS tr
            JOIN #items AS i
                ON i.ReturnedOutgoingItemID = tr.ReturnedOutgoingItemID
            JOIN #TraceIds AS ti
                ON ti.TraceID = tr.TraceID
            LEFT JOIN ACC.DL AS d
                ON d.DLID = tr.DlID
            LEFT JOIN STF.TraceItem AS ti2
                ON ti2.TraceItemID = tr.TraceItemID;
    END;
END;

