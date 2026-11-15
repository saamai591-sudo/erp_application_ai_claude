
CREATE   PROCEDURE [STC].spPricingValidationSource
(
    @PricingDate        Date,
    @selItems           NVARCHAR(MAX),
    @FinancialPeriodID  INT,
    @TableName NVARCHAR(MAX)
)
--WITH ENCRYPTION
WITH RECOMPILE
AS
set NOCOUNT ON
	if (select ConfigValue from cfg.Configuration where ConfigKey = 'DoPricing') = 0
	begin

	DECLARE 
	        @Columns NVARCHAR(MAX),
	        @Query NVARCHAR(MAX),
	        @ParmDefinition NVARCHAR(MAX),
	        @ConditionalInnerJoin NVARCHAR(MAX),
	        @Position INT,
	        @Message NVARCHAR(MAX)
	        

	SELECT @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)+' NVARCHAR(256)'
							FROM STF.Trace
							WHERE CheckInventory = 1
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')

	IF(@Columns is null)								   
	SET @Columns = '[-1] NVARCHAR(256)'


	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
	               FROM   stf.Trace  al where CheckInventory = 1	               
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
	IF(@Columns is null)								   
		SET @Columns = '[-1]'	



	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
	               FROM   stf.Trace  al where PricingBase = 1	               
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
	IF(@Columns is null)								   
		SET @Columns = '[-1]'			
	
	IF OBJECT_ID('ValidationTemp') IS Not NULL
	DROP TABLE ValidationTemp
	
	create TABLE  ValidationTemp
	(
	ValidationNo NVARCHAR(MAX),
	ValidationDesc NVARCHAR(MAX)	
	) 
	
	IF OBJECT_ID('PricingValidationBaseTemp') IS Not NULL
	DROP TABLE PricingValidationBaseTemp
	
	create TABLE  PricingValidationBaseTemp
	(
		Position INT,
		ID INT	,
		StuffID int
	) 	
	
	IF OBJECT_ID('tempdb..##Selected') IS Not NULL
	DROP TABLE ##Selected
	
	EXEC cfg.TableFromIStuffTraceString @selItems,
	     '##Selected'	,1
	     
		 declare @Stocks nvarchar(max)

		SELECT @Stocks = STUFF((SELECT DISTINCT ' , ' + stock.Title
		 from ##Selected a
		 join stf.stock on stock.StockID = a.StockID
		 left join stc.StockClosePeriod  b on a.StockID = b.stockid and b.Date >= @PricingDate
		 where b.StockClosePeriodID is null
		 group by stock.Title              
	               FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,3,'')

		 if @Stocks is not null
		BEGIN
			INSERT INTO ValidationTemp 			
			SELECT DISTINCT id, N'ابتدا انبارهای مورد نظر را تا این تاریخ ببندید: '
			 from ##Selected a
			 left join stc.StockClosePeriod  b on a.StockID = b.stockid and b.Date >= @PricingDate
			 where b.StockClosePeriodID is null

	
		END

		if exists
		(select *
		from ##Selected a
		left join stf.StuffDetail b
			on a.stuffid = b.StuffID
		where b.StuffAccountGroupID is null)
		BEGIN
			INSERT INTO ValidationTemp 			
			SELECT DISTINCT id, 'PricingValidation:13'
			from ##Selected a
			left join stf.StuffDetail b
				on a.stuffid = b.StuffID
			where b.StuffAccountGroupID is null

			
		END



	select @ConditionalInnerJoin  =  'join ##Selected Selected on Selected.stuffid = M.stuffid  AND Selected.StockID = M.StockID 
									  join stf.stuffdetail stfd on stfd.stuffid = Selected.stuffid 
									  JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = stfd.StuffAccountGroupID
																and SAG.StuffDetailType <> 3 '
					 + STUFF((SELECT distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or M.' +
					 QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
							FROM STF.Trace where PricingBase = 1
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')


								   
	if(@ConditionalInnerJoin is null)
	set @ConditionalInnerJoin =   'join ##Selected Selected on Selected.stuffid = M.stuffid AND Selected.StockID = M.StockID 
								   join stf.stuffdetail stfd on stfd.stuffid = Selected.stuffid 
								   JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = stfd.StuffAccountGroupID
																and SAG.StuffDetailType <> 3 '


							  
	--** Check Validations	
	--**  کنترل عمليات پايان دوره مالی جاری

		
	IF EXISTS
	(SELECT StockClosingOperationID
	 FROM stc.StockClosingOperation sco
	 WHERE sco.FinancialPeriodID = @FinancialPeriodID
	 AND sco.[Status] = 2)
		BEGIN	
	
			INSERT INTO ValidationTemp				
			--SELECT DISTINCT position,'در اين انبار عمليات پايان دوره انجام شده است.'				
			SELECT DISTINCT id, 'STC_SpFinalStuffInventory_2'
			 from  ##Selected 
			 JOIN stc.StockClosingOperation sco ON ##Selected.StockID = sco.StockID
			 WHERE sco.FinancialPeriodID = @FinancialPeriodID
				AND sco.[Status] = 2
		END
	
	--** کنترل اين نکته که قبلا براي اين عامل در اين تاريخ قيمت گذاري انجام نشده باشد.
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp(Position,ID)
	SELECT Selected.id Position,M.PricingItemID 
	from (
	select  TraceID,
			Case 
				When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
				When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max)) 
				else Value 
			end Value,
			i.stockid,i.PricingItemID,i.stuffID
			from stc.PricingItem i
			left join 	 stc.PricingItemTrace tr  on tr.PricingItemID = i.PricingItemID
			WHERE  [LastPricingDate] >= @pPricingDate	
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M 
	
	  '+@ConditionalInnerJoin
	
	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
		  
	EXECUTE sp_executeSQL     
			@Query,
			@ParmDefinition,
			@pFinancialPeriodID = @FinancialPeriodID,
			@pPricingDate = @PricingDate
	INSERT INTO ValidationTemp	
	SELECT DISTINCT position, 'PricingValidation:2'	 from PricingValidationBaseTemp
	
	
	TRUNCATE TABLE PricingValidationBaseTemp


		
	--** رسيد انبارهاي ريالي نشده
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp(Position,ID,StuffID)
	select Selected.id Position,M.[Type] ,M.StuffID
	From(
			SELECT  sdt.DocumentType AS Type ,
				StockID ,
				StuffID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value,
				itm.StockReceiptItemID
			FROM    STC.StockReceipt hdr
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON hdr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
			INNER JOIN STC.StockReceiptItem itm ON hdr.StockReceiptID = itm.StockReceiptID
			LEFT JOIN STC.StockReceiptItemTrace tr ON tr.StockReceiptItemID = itm.StockReceiptItemID
			WHERE   Fee = 0
					AND EstimatedFee = 0
					AND FinancialPeriodID = @pFinancialPeriodID
					AND [Date] <= @pPricingDate ) x
	pivot 
	(
		 max(Value)
		for TraceID in ( ' + @Columns + ')
	) M '+@ConditionalInnerJoin						

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'			
	EXECUTE sp_executeSQL     
			@Query,
			@ParmDefinition,
			@pFinancialPeriodID = @FinancialPeriodID,
			@pPricingDate = @PricingDate

	INSERT INTO ValidationTemp		
	select distinct position, 'PricingValidation:4' 
	from PricingValidationBaseTemp
	WHERE ID not in (5,8,9,10)

		     
	TRUNCATE TABLE PricingValidationBaseTemp

	--** حواله انتقالي هاي تحويل نشده
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp(Position,ID)
	select Selected.id Position,M.OutgoingItemID 
		from 
		(
			SELECT  itm.OutgoingItemID ,
					itm.StuffID ,
					hdr.StockID ,
					sdt.DocumentType AS Type ,
					TraceID ,
					CASE 
						WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
						WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
						ELSE Value
					END Value
			FROM    STC.Outgoing hdr
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON hdr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					INNER JOIN STC.OutgoingItem itm ON itm.OutgoingID = hdr.OutgoingID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					LEFT JOIN STC.OutgoingItemTrace tr ON tr.OutgoingItemID = itm.OutgoingItemID
			WHERE   sdt.DocumentType = 4
					AND itm.OutgoingItemID NOT IN ( SELECT  OutgoingItemID
													FROM    STC.StockReceiptItem )
					AND hdr.FinancialPeriodID = @pFinancialPeriodID
					AND hdr.[Date] <= @pPricingDate
		 ) x
		pivot 
		(
			 max(Value)
			for TraceID in ( ' + @Columns + ')
		) M 
		 '+@ConditionalInnerJoin
						 
	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'						  										
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate

	INSERT INTO ValidationTemp		
	select distinct position,  'PricingValidation:5' from PricingValidationBaseTemp		
      
	TRUNCATE TABLE PricingValidationBaseTemp
		
   
	--** برگشت رسيد تعدادي از نوع اماني که فاقد برگشت رسيد در حسابداري انبار است.
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp(Position,ID)
	SELECT Selected.id Position,M.ReturnStockReceiptItemID 
	from
	 (
			 SELECT  h.StockID ,
					i.ReturnStockReceiptItemID ,
					i.StuffID ,
					TraceID ,
					CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
						 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
						 ELSE Value
					END Value
			FROM    STC.ReturnStockReceiptItem i
					JOIN STC.ReturnStockReceipt h ON h.ReturnStockReceiptID = i.ReturnStockReceiptID
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
					LEFT JOIN STC.ReturnStockReceiptItemTrace tr ON tr.ReturnStockReceiptItemID = i.ReturnStockReceiptItemID
			WHERE   FinancialPeriodID = @pFinancialPeriodID
					AND [Date] <= @pPricingDate
					AND sdt.DocumentType = 2
					AND i.StockReceiptItemID IS NULL
	 )x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M 
	 
	  '+@ConditionalInnerJoin	
	  
	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'					  										
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
    
	INSERT INTO ValidationTemp		
	select distinct position, 'PricingValidation:7' from PricingValidationBaseTemp		
    
	
    TRUNCATE TABLE PricingValidationBaseTemp  

    --** حواله های انبار از نوع فروش که  فاکتور نشده اند
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.OutgoingItemID 
	from
	(
		SELECT  i.OutgoingItemID ,
				i.StuffID ,
				h.StockID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value
		FROM   [SLE].[Outgoing_Non_Invoice] gg
				join STC.OutgoingItem i on gg.outgoingitemid = i.outgoingitemid
				JOIN STC.Outgoing h ON h.OutgoingID = i.OutgoingID
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				LEFT JOIN STC.OutgoingItemTrace tr ON i.OutgoingItemID = tr.OutgoingItemID
		WHERE   FinancialPeriodID = @pFinancialPeriodID
				AND [Date] <= @pPricingDate
				AND Non > 0
				AND sdt.DocumentType = 1
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M	  '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:8'  from PricingValidationBaseTemp
    
	
	TRUNCATE TABLE PricingValidationBaseTemp  	
		

     --** برگشت حواله های انبار از نوع فروش که  برگشت فروش  ندارند
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.ReturnedOutgoingItemID 
	from
    (
		SELECT  i.ReturnedOutgoingItemID ,
				i.StuffID ,
				h.StockID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value
		FROM    STC.ReturnedOutgoingItem i
				JOIN STC.ReturnedOutgoing h ON h.ReturnedOutgoingID = i.ReturnedOutgoingID
				JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
					ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
				JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
				LEFT JOIN STC.ReturnedOutgoingItemTrace tr ON i.ReturnedOutgoingItemID = tr.ReturnedOutgoingItemID
		WHERE   FinancialPeriodID = @pFinancialPeriodID
				AND [Date] <= @pPricingDate
				AND i.ReturnedSaleInvoiceItemID is null
				AND i.ReturnedOutgoingItemID NOT IN (
				SELECT  ISNULL(ReturnedOutgoingItemID, 0)
				FROM    SLE.ReturnedSaleInvoiceItem )
				AND sdt.DocumentType = 1
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M	  '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:9'  from PricingValidationBaseTemp
    
	
	TRUNCATE TABLE PricingValidationBaseTemp  
	
    --** حواله های انبار از نوع تبدیل که  رسید نشده اند
	drop table IF EXISTS  ##T 

	set @Query = N'
	SELECT M.*
	into ##T
	from
	(
		SELECT  oi.OutgoingItemID ,
				oi.StuffID ,
				o.StockID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value
			from stc.Outgoing o
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			inner join stc.StockDocumentType sdt
				on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
			inner join stc.OutgoingItem oi
				on o.OutgoingID = oi.OutgoingID
			LEFT JOIN STC.OutgoingItemTrace tr 
				ON oi.OutgoingItemID = tr.OutgoingItemID
			left join stc.ConvertSpecification cs
				on cs.OutgoingItemID = oi.OutgoingItemID
			left join stc.StockReceiptItem si
				on si.ConvertSpecificationID = cs.ConvertSpecificationID
		WHERE   FinancialPeriodID = @pFinancialPeriodID
				AND [Date] <= @pPricingDate
				AND DocumentType = 9
				and si.StockReceiptItemID is null
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M	  '

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate


	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.OutgoingItemID  from ##T M	  '+@ConditionalInnerJoin	
	
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:11'  from PricingValidationBaseTemp
    
	
	TRUNCATE TABLE PricingValidationBaseTemp  

    --** رسید های انبار از نوع ترکیب که  حواله نشده اند
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.StockReceiptItemID
	from
	(
		SELECT  Si.StockReceiptItemID ,
				si.StuffID ,
				s.StockID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value
			from stc.StockReceipt s
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			inner join stc.StockDocumentType sdt
				on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
			inner join stc.StockReceiptItem si
				on s.StockReceiptID = si.StockReceiptID
			LEFT JOIN STC.StockReceiptItemTrace tr 
				ON si.StockReceiptItemID = tr.StockReceiptItemID
			left join stc.StuffComposition sc
				on sc.StockReceiptItemID = si.StockReceiptItemID
			left join stc.OutgoingItem oi
				on oi.StuffCompositionID = sc.StuffCompositionID
		WHERE   FinancialPeriodID = @pFinancialPeriodID
				AND [Date] <= @pPricingDate
				AND DocumentType = 9
				and oi.OutgoingItemID is null
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M	  '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:12'  from PricingValidationBaseTemp
	
   
	TRUNCATE TABLE PricingValidationBaseTemp  


    --** رسید های انبار از نوع کارمزدی که  حواله آنها مشخص نشده اند
	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.StockReceiptItemID
	from
	(
		SELECT  Si.StockReceiptItemID ,
				si.StuffID ,
				s.StockID ,
				TraceID ,
				CASE WHEN DlID IS NOT NULL THEN CAST (DlID AS NVARCHAR(MAX))
					 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
					 ELSE Value
				END Value
			from stc.StockReceipt s
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			    ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			inner join stc.StockDocumentType sdt
				on sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
			inner join stc.StockReceiptItem si
				on s.StockReceiptID = si.StockReceiptID
			LEFT JOIN STC.StockReceiptItemTrace tr 
				ON si.StockReceiptItemID = tr.StockReceiptItemID
			left join stc.[StockReceiptChargingService] sc
				on sc.StockReceiptItemID = si.StockReceiptItemID
		WHERE   FinancialPeriodID = @pFinancialPeriodID
				AND [Date] <= @pPricingDate
				AND DocumentType = 10
				and sc.OutgoingItemID is null
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M	  '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
            
	INSERT INTO ValidationTemp				
	select distinct position, 'PricingValidation:15'  from PricingValidationBaseTemp
	
    
	TRUNCATE TABLE PricingValidationBaseTemp  

    --** فاکتور فروشهايي که  حواله نشده اند
	select @ConditionalInnerJoin  =  'join ##Selected Selected on Selected.stuffid = M.stuffid '
					 + STUFF((SELECT distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or M.' +
					 QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
							FROM STF.Trace where PricingBase = 1
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')


								   
	if(@ConditionalInnerJoin is null)
	set @ConditionalInnerJoin =   'join ##Selected Selected on Selected.stuffid = M.stuffid'


		SET @ConditionalInnerJoin = @ConditionalInnerJoin + ' join stf.stock on Selected.StockID = stock.StockID 
		where stock.BranchID = m.BranchID'


	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.InvoiceItemID 
	from
	 (select ii.InvoiceItemID,ii.stuffID,TraceID,
		Case When DLID IS NOT NULL  THEN cast (DLID as nvarchar(max)) 
			 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
			else Value 
		end Value,h.BranchID
	FROM sle.Invoice_Non_OutGoing AS inog
	JOIN sle.InvoiceItem AS ii ON ii.InvoiceItemID = inog.InvoiceItemID
	join sle.Invoice h on h.InvoiceID=iI.InvoiceID
	left join sle.InvoiceItemTrace iit on iit.InvoiceItemID = ii.InvoiceItemID
	  WHERE FinancialPeriodID =    @pFinancialPeriodID              
        AND SaleInvoiceStatus <> 2          
		AND	 [Date] <= @pPricingDate
		and Non> 0
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M   '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate
            
	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:10'  from PricingValidationBaseTemp		

	
	TRUNCATE TABLE PricingValidationBaseTemp
    
	--**برگشت فروشهايي که برگشت حواله صادر نشده است   
	select @ConditionalInnerJoin  =  'join ##Selected Selected on Selected.stuffid = M.stuffid '
					 + STUFF((SELECT distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or M.' +
					 QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
							FROM STF.Trace where PricingBase = 1
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')


								   
	if(@ConditionalInnerJoin is null)
	set @ConditionalInnerJoin =   'join ##Selected Selected on Selected.stuffid = M.stuffid'


	set @Query = N'
	INSERT INTO PricingValidationBaseTemp (Position,ID)
	SELECT Selected.id Position,M.ReturnedSaleInvoiceItemID 
	from
	 (select ii.ReturnedSaleInvoiceItemID,ii.stuffID,TraceID,
		Case When DLID IS NOT NULL  THEN cast (DLID as nvarchar(max)) 
			 WHEN TraceItemID IS NOT NULL THEN CAST (TraceItemID AS NVARCHAR(MAX))
			else Value 
		end Value
	FROM sle.ReturnedSaleInvoiceItem AS ii 
	join sle.ReturnedSaleInvoice h on h.ReturnedSaleInvoiceID=iI.ReturnedSaleInvoiceID
	left join sle.ReturnedSaleInvoiceItemTrace iit on iit.ReturnedSaleInvoiceItemID = ii.ReturnedSaleInvoiceItemID
	left join
	(
	select ReturnedSaleInvoiceItemID,sum(MainQuantity) MainQuantity
	from stc.ReturnedOutgoingItem
	where ReturnedSaleInvoiceItemID is not null
	group by ReturnedSaleInvoiceItemID
	)roi on roi.ReturnedSaleInvoiceItemID = ii.ReturnedSaleInvoiceItemID
	  WHERE FinancialPeriodID =    @pFinancialPeriodID              
		AND	 [Date] <= @pPricingDate
		and roi.MainQuantity <> ii.MainQuantity
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M   '+@ConditionalInnerJoin	

	SET @ParmDefinition = N'@pFinancialPeriodID INT,@pPricingDate Date'
	EXECUTE sp_executeSQL     
            @Query,
            @ParmDefinition,
            @pFinancialPeriodID = @FinancialPeriodID,
            @pPricingDate = @PricingDate

	INSERT INTO ValidationTemp			
	select distinct position, 'PricingValidation:14'  from PricingValidationBaseTemp		

	
	set @Query = N'Create Table '+@TableName+N'
	(ValidationNo  NVarchar(MAX),
	ValidationDesc NVarchar(MAX))'
	
	EXEC (@Query)
	
	
	
	set @Query = N'insert into '+@TableName+N'
	(ValidationNo,ValidationDesc)
	
	SELECT ValidationNo,ValidationDesc FROM ValidationTemp'

	EXEC (@Query)
	

	IF OBJECT_ID('tempdb..##Selected') IS Not NULL
	DROP TABLE ##Selected

	IF OBJECT_ID('ValidationTemp') IS Not NULL
	DROP TABLE ValidationTemp

	IF OBJECT_ID('PricingValidationBaseTemp') IS Not NULL
	DROP TABLE PricingValidationBaseTemp

	end
	else
	raiserror('صبرنمایید تا پروسه در حال اجرای قیمت گذاری اجرا شود سپس اقدام نمایید.',16,13)
