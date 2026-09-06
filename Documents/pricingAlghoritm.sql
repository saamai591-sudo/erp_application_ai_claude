
CREATE 
 PROCEDURE [STC].[sp_DoPricing]
	(
		@PricingDate        Date,
		@selItems           NVARCHAR(MAX),
		@FinancialPeriodID  INT,
		@UserName           NVARCHAR(512)
	)

	--WITH ENCRYPTION 	, RECOMPILE
		 AS 

		 SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
		 set nocount on;
		 if (select ConfigValue from cfg.Configuration where ConfigKey = 'DoPricing') = 0
		 begin

		 update cfg.Configuration 
		 set ConfigValue = 1
		 where ConfigKey = 'DoPricing'

		truncate TABLE STC.PricingStage


		DECLARE @userID               INT,
				@Query NVARCHAR(MAX),
				@Param NVARCHAR(MAX),
				@Columns NVARCHAR(MAX),
				@ColumnsInSelectList NVARCHAR(MAX),	        
				@ConditionalInnerJoin NVARCHAR(MAX),
				@RevisionCostNumber INT,
				@CurrentDate DateTime = GETDATE(),
				@Message NVARCHAR(MAX),
				@RevisionCostID int,
				@PrecitionCount int = CFG.GetBaseCurrencyPrecision(),
				@PricingItemTemp_Update VARCHAR(256),
				@Selected VARCHAR(256),
				@Position INT,
				@TableName VARCHAR(250),
				@RowIndex int,
				@Description nvarchar(1024),
				@TypeInFee TINYINT,
				@MaxRowIndex int,
				@LoopNumber VARCHAR(10) = 1,
				@DocumentType TinyInt,
				@OutgoingItemID int,
				@StockReceiptItemID int,
				@PricingType tinyint,
				@CardexFee decimal(36,10);
				
		SET @Message  =  'شروع پروسه قیمت گذاری ... زمان: ' +cast(SYSDATETIME() as varchar(30))
		print @Message
		insert into STC.PricingStage select 'شروع پروسه قیمت گذاری', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
		insert into STC.PricingStage select 'تا تاریخ '+cast(@PricingDate as varchar(25)), CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
		insert into STC.PricingStage select @selItems, CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
		insert into STC.PricingStage select 'دوره مالی '+cast(@FinancialPeriodID as varchar(10)), CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
		insert into STC.PricingStage select @UserName, CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	        
		SET @PricingItemTemp_Update = CFG.getTempTableName(1);
		SET @Selected = CFG.getTempTableName(1);
		set @userID = cfg.GetuserID()

	
		SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
					   FROM   stf.Trace  al where PricingBase = 1	               
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
		IF(@Columns is null)								   
			SET @Columns = '[-1]'	
		
		SELECT @ColumnsInSelectList = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.traceID)
			   FROM   stf.Trace  al where PricingBase = 1	               
			   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')
	                      
		IF(@ColumnsInSelectList is null)								   
			SET @ColumnsInSelectList = ''
		
		create table #ConvertSpecificationTemp
		(
		Rno int,
		OutgoingItemID int,
		ConvertSpecificationID int,
		Amount decimal(36,10),
		Rate decimal(36,10),
		ShareOfAmount decimal(36,10)
		)
				
		BEGIN TRY
		
		EXEC cfg.TableFromIStuffTraceString @selItems,
			 @Selected,1		


		set @Query = N'alter table '+@Selected+' add LastPricingDate Date'
		EXEC (@Query)

					
		set @ConditionalInnerJoin =   ' join '+@Selected+' Selected on Selected.stuffid = p.stuffid AND Selected.StockID = p.StockID'

		select @ConditionalInnerJoin  = @ConditionalInnerJoin + isnull (STUFF((SELECT distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or p.' +
							 QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
									FROM STF.Trace where PricingBase = 1
									FOR XML PATH(''), TYPE
									).value('.', 'NVARCHAR(MAX)'),1,0,'') , '')
								   
		set @ConditionalInnerJoin = @ConditionalInnerJoin + '  join stf.stuffdetail stfd on stfd.stuffid = Selected.stuffid 
															  JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = stfd.StuffAccountGroupID
															 and SAG.StuffDetailType <> 3'

											

		set @Query = N'
		update '+@Selected+'
		set LastPricingDate = p.LastPricingDate
		from (
		select  LastPricingDate,
				Case When DLID IS NOT NULL THEN cast (DLID as nvarchar(max)) 
					 When TraceItemID IS NOT NULL THEN cast (TraceItemID as nvarchar(max))
					 else Value end Value,
				TraceID,
				stuffid,
				stockid

		from stc.PricingItem i
		left join 	 stc.PricingItemTrace tr  on tr.PricingItemID = i.PricingItemID
		) x
		pivot 
		(
			 max(Value)
			for TraceID in (' + @Columns + ')
		) p
	
		  '+@ConditionalInnerJoin

		EXECUTE sp_executeSQL     
				@Query

		
		--***TypeInFee 1 = في ورودي
		--***TypeInFee 2 = في محاسباتي
		--***TypeInFee 3 = في با مبنا

		CREATE TABLE #PricingTempItems
		(
			Position INT,
			LastPricingDate date,
			MainQuantity DECIMAL(36,10),
			Fee DECIMAL(36,10),
			Amount DECIMAL(36,10),
			TableName VARCHAR(300),
			ID INT,
			[Date] Date,
			[Nature] TINYINT,
			TypeInFee TINYINT,
			StuffID int,
			StockID int,
			ModifiedTable VARCHAR(300),
			ModifiedRow int,
			Description nvarchar(1024),
			MaxRevisionDate Date,
			MaxReturnDate Date,
			ShareOfCosts decimal(36,10),
			DocumentType TinyInt,
			ReturnStockReceiptItemID int
		)
			
	begin

	SET @Message  =  'جمع آوری اطلاعات ... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'جمع آوری اطلاعات', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

	SET @Param = N'@pFinancialPeriodID INT,@pDate Date,@PrecitionCount int'
		
	SET @Message  =  'جمع آوری اطلاعات رسید انبار... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'جمع آوری اطلاعات رسید انبار', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	 --**	 رسيد 

	 SET @Query =
	N'insert into #PricingTempItems(Position,LastPricingDate,MainQuantity,Fee,Amount,TableName,ID,[Date],[Nature],TypeInFee,StuffID,StockID,ModifiedTable,ModifiedRow,MaxRevisionDate,MaxReturnDate,ShareOfCosts,DocumentType)
	SELECT  Selected.Position,Selected.LastPricingDate ,MainQuantity,p.Fee,Amount,''stc.StockReceiptItem'',p.ID,p.Date,1,p.TypeInFee,p.StuffID,p.StockID,
			case when OutgoingItemID is not null then ''stc.OutgoingItem'' else null end,OutgoingItemID,MaxRevisionDate,MaxReturnDate,ShareOfCosts,DocumentType
	FROM (
			SELECT  I.MainQuantity ,
					CASE WHEN Revision.RevisionFee is not null then Revision.RevisionFee 
						else
							(case when I.EstimatedPrice > 0 then I.EstimatedPrice else I.Price end + I.ShareOfCosts) / I.MainQuantity  
						end Fee,
					CASE WHEN Revision.RevisionPrice is not null then Revision.RevisionPrice 
						 else
							case when I.EstimatedPrice > 0 then I.EstimatedPrice else I.Price end  + I.ShareOfCosts end Amount,
					 I.OutgoingItemID,
					 I.StockReceiptItemID AS ID,
					 H.Date,
					 CASE WHEN DocumentType in (5,8,9,10,12) then 3 else 1 end TypeInFee,
					 TraceID,
					 Case When IT.DLID IS NOT NULL THEN cast (IT.DLID as nvarchar(max)) 
						 When IT.TraceItemID IS NOT NULL THEN cast (IT.TraceItemID as nvarchar(max))
						 else IT.Value end Value,
					 I.stuffid,
					 H.StockID,
					 Revision.Date MaxRevisionDate,
					 Returned.Date MaxReturnDate,
					 I.ShareOfCosts,
					 DocumentType
		FROM stc.StockReceiptItem I
		JOIN stc.StockReceipt H on I.StockReceiptID = H.StockReceiptID
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON H.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeid = sdtb.StockDocumentTypeid
		left join
		(
			select StockReceiptItemID,sum(MainQuantity) MainQuantity,max(h.date) date
			from stc.ReturnStockReceiptItem I
			JOIN stc.ReturnStockReceipt H on I.ReturnStockReceiptID = H.ReturnStockReceiptID
			WHERE i.StockReceiptItemID IS NOT NULL
			AND H.DATE <= @pDate
			group by StockReceiptItemID
		) Returned on Returned.StockReceiptItemID = I.StockReceiptItemID
		LEFT JOIN stc.StockReceiptItemTrace IT on IT.StockReceiptItemID = I.StockReceiptItemID
		LEFT JOIN 
		(
			select  ROW_NUMBER() over(partition by StockReceiptItemID order by number desc) Rno,
					StockReceiptItemID,RevisionFee,RevisionPrice,h.date
			from stc.RevisionCost h
			join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
			where StockReceiptItemID is not null 
			and FinancialPeriodID = @pFinancialPeriodID
			AND h.Date <= @pDate
		) Revision on Rno = 1 and Revision.StockReceiptItemID = I.StockReceiptItemID
		WHERE FinancialPeriodID = @pFinancialPeriodID
		AND h.Date <= @pDate
		 ) x
		pivot 
		( max(Value)
			for TraceID in ( ' + @Columns + ')
		) p  '+@ConditionalInnerJoin
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pFinancialPeriodID = @FinancialPeriodID,
				@pDate = @PricingDate  	,
				@PrecitionCount = @PrecitionCount

	SET @Message  =  'جمع آوری اطلاعات برگشت رسید... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'جمع آوری اطلاعات برگشت رسید', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	--**	برگشت رسيد 
	SET @Query = 
	N'insert into #PricingTempItems(Position,LastPricingDate,MainQuantity,Fee,Amount,TableName,ID,[Date],[Nature],TypeInFee,StuffID,StockID,ModifiedTable,ModifiedRow,Description)
	  SELECT  Selected.Position,Selected.LastPricingDate ,
			  p.MainQuantity,p.Fee,Amount,''stc.ReturnStockReceiptItem'',p.ID,p.Date,2,case when StockReceiptItemID is null then 2 else 3 end,p.StuffID,p.StockID,
			  case when StockReceiptItemID is null then null else ''stc.StockReceiptItem'' end,
			  case when StockReceiptItemID is null then null else StockReceiptItemID end,
			  case when StockReceiptItemID is null then null else ''بابت برگشت رسید شماره  ''+cast(Number as varchar(100)) end
	  FROM (
			SELECT  MainQuantity,
					StockReceiptItemID,
					Number,
					case when Revision.RevisionFee is not null then Revision.RevisionFee else I.fee end AS Fee ,
					case when Revision.RevisionPrice is not null then Revision.RevisionPrice else I.price end AS Amount,
					I.ReturnStockReceiptItemID AS ID,
					H.Date,
					TraceID,
					Case 
						When IT.DLID IS NOT NULL THEN cast (IT.DLID as nvarchar(max)) 
						When IT.TraceItemID IS NOT NULL THEN cast (IT.TraceItemID as nvarchar(max)) 
					else Value end Value,
					I.stuffid,
					H.StockID
			from stc.ReturnStockReceiptItem I
			JOIN stc.ReturnStockReceipt H on I.ReturnStockReceiptID = H.ReturnStockReceiptID
			LEFT JOIN stc.ReturnStockReceiptItemTrace IT on I.ReturnStockReceiptItemID = IT.ReturnStockReceiptItemID 
			LEFT JOIN 
			(
				select  ROW_NUMBER() over(partition by ReturnStockReceiptItemID order by number desc) Rno,
						ReturnStockReceiptItemID,RevisionFee,RevisionPrice from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where ReturnStockReceiptItemID is not null 
				and FinancialPeriodID = @pFinancialPeriodID
				AND Date <= @pDate
			) Revision on Rno = 1 and Revision.ReturnStockReceiptItemID = I.ReturnStockReceiptItemID
			 where FinancialPeriodID = @pFinancialPeriodID
				AND Date <= @pDate
				) x
				pivot 
				( max(Value)
					for TraceID in ( ' + @Columns + ')
				) p  '+@ConditionalInnerJoin

	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pFinancialPeriodID = @FinancialPeriodID,
				@pDate = @PricingDate  ,
				@PrecitionCount = @PrecitionCount
 	
	SET @Message  =  'جمع آوری اطلاعات حواله انبار... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'جمع آوری اطلاعات حواله انبار', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	--**	 حواله
	SET @Query = 
	N'insert into #PricingTempItems(Position,LastPricingDate,MainQuantity,Fee,Amount,TableName,ID,[Date],[Nature],TypeInFee,StuffID,StockID,ModifiedTable,ModifiedRow,MaxReturnDate,documenttype)
		SELECT Selected.Position,Selected.LastPricingDate ,p.MainQuantity,p.fee,p.Amount,
			   ''stc.OutgoingItem'',p.ID,p.Date,2,2,p.StuffID,p.StockID,null,null,MaxReturnDate,documenttype
		FROM (
			SELECT  I.MainQuantity ,
					case when Revision.RevisionFee is not null then Revision.RevisionFee else I.fee end AS Fee ,
					case when Revision.RevisionPrice is not null then Revision.RevisionPrice else I.price end AS Amount,
					I.OutgoingItemID AS ID,
					H.Date,
					documenttype,
					TraceID,	
					Case When IT.DLID IS NOT NULL THEN cast (IT.DLID as nvarchar(max)) 
						When IT.TraceItemID IS NOT NULL THEN cast (IT.TraceItemID as nvarchar(max))
					else Value end Value,
					I.stuffid,
					H.StockID,
					Returned.OutgoingItemid baseid,
					Returned.Date MaxReturnDate
			from stc.OutgoingItem	I
			join stc.Outgoing H on H.OutgoingID = I.OutgoingID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			join stc.stockdocumenttype sdt on sdtb.stockdocumenttypeid = sdt.stockdocumenttypeid
			left join 
			(
				select OutgoingItemid,sum(MainQuantity) MainQuantity,max(h.date) date
				from stc.ReturnedOutgoingItem i
				join stc.ReturnedOutgoing h on h.ReturnedOutgoingid = i.ReturnedOutgoingid
				where OutgoingItemid is not null
				and h.date <= @pDate
				group by OutgoingItemid
			)Returned on Returned.OutgoingItemid = i.OutgoingItemid
			LEFT JOIN 
			(
				select  ROW_NUMBER() over(partition by OutgoingItemID order by number desc) Rno,
						OutgoingItemID,RevisionFee,RevisionPrice from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where OutgoingItemID is not null 
				and FinancialPeriodID = @pFinancialPeriodID
				AND Date <= @pDate
			) Revision on Rno = 1 and Revision.OutgoingItemID = I.OutgoingItemID
			LEFT JOIN stc.OutgoingItemTrace IT	on I.OutgoingItemID = IT.OutgoingItemID
			where  h.FinancialPeriodID = @pFinancialPeriodID
			AND h.Date <= @pDate
			) x
				pivot 
				( max(Value)
					for TraceID in ( ' + @Columns + ')
				) p  '+@ConditionalInnerJoin

	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pFinancialPeriodID = @FinancialPeriodID,
				@pDate = @PricingDate  ,
				@PrecitionCount = @PrecitionCount
            

	SET @Message  =  'جمع آوری اطلاعات برگشت حواله... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message	
	insert into STC.PricingStage select 'جمع آوری اطلاعات برگشت حواله', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	--**	برگشت حواله
	SET @Query = 
	N'insert into #PricingTempItems(Position,LastPricingDate,MainQuantity,Fee,Amount,TableName,ID,[Date],[Nature],TypeInFee,StuffID,StockID,ModifiedTable,ModifiedRow,Description,MaxRevisionDate,documenttype)
	SELECT  Selected.Position,Selected.LastPricingDate ,
			MainQuantity,p.Fee,Amount,''stc.ReturnedOutgoingItem'',p.ID,p.Date,
			1,p.TypeInFee,p.StuffID,p.StockID,
			case when OutgoingItemID is null then null else ''stc.OutgoingItem'' end,
			case when OutgoingItemID is null then null else OutgoingItemID end,
			case when OutgoingItemID is null then null else	''بابت برگشت حواله با مبنا به شماره  '' + cast(Number as varchar(100)) end,MaxRevisionDate,documenttype
		FROM (
			SELECT  MainQuantity ,
					h.number,
					case when Revision.RevisionFee is not null then Revision.RevisionFee else Fee end Fee ,
					case when Revision.RevisionPrice is not null then Revision.RevisionPrice else I.price end  AS Amount,
					I.ReturnedOutgoingItemID AS ID,
					H.Date,
					i.OutgoingItemID,
					case when  I.OutgoingItemID is null and I.price > 0 then 1 when  I.OutgoingItemID is null and I.price = 0 then 2 when I.OutgoingItemID is not null then 3  end AS TypeInFee,
					TraceID,
					Case When IT.DLID IS NOT NULL THEN cast (IT.DLID as nvarchar(max)) 
						When IT.TraceItemID IS NOT NULL THEN cast (IT.TraceItemID as nvarchar(max))
					else Value end Value,
					I.stuffid,
					H.StockID,
					Revision.Date	 MaxRevisionDate,
					documenttype
			from stc.ReturnedOutgoingItem I
			join stc.ReturnedOutgoing H on I.ReturnedOutgoingID = H.ReturnedOutgoingID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON H.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			join stc.stockdocumenttype sdt on sdtb.stockdocumenttypeid = sdt.stockdocumenttypeid
			LEFT JOIN  stc.ReturnedOutgoingItemTrace IT on I.ReturnedOutgoingItemID = IT.ReturnedOutgoingItemID
			LEFT JOIN (
					select  ROW_NUMBER() over(partition by ReturnedOutgoingItemID order by number desc) Rno,
							ReturnedOutgoingItemID,RevisionFee,RevisionPrice,h.Date
					from stc.RevisionCost h
					join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
					where ReturnedOutgoingItemID is not null 
					and FinancialPeriodID = @pFinancialPeriodID
					AND h.Date <= @pDate
				  ) Revision on Rno = 1 and Revision.ReturnedOutgoingItemID = I.ReturnedOutgoingItemID
			where h.FinancialPeriodID = @pFinancialPeriodID
			AND h.Date <= @pDate
			 ) x
				pivot 
				(max(Value)
					for TraceID in ( ' + @Columns + ')
				) p  '+@ConditionalInnerJoin

	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pFinancialPeriodID = @FinancialPeriodID,
				@pDate = @PricingDate ,
				@PrecitionCount = @PrecitionCount
	
	end

	create table #PrevoiusLoop
	(
		IdKey int,
		Amount DECIMAL(36,10)
		,TableName varchar(50),ID int
	)
		-- شکستن رسیدهای برگشت داده شده
		begin
				drop table if exists #Returned_Quantity

				select ModifiedRow,sum(MainQuantity) SumQuantity
				into #Returned_Quantity
				from #PricingTempItems
				where TableName = 'stc.ReturnStockReceiptItem' 
				and ModifiedRow is not null
				group by ModifiedRow

				drop table if exists #mainStockreceipt

				select a.id , a.Amount
				into #mainStockreceipt
				from #PricingTempItems a
				join #Returned_Quantity b on a.ID = b.ModifiedRow
				where a.TableName = 'stc.StockReceiptItem' 

				update a
				set MainQuantity = MainQuantity - SumQuantity,
					Amount = round((MainQuantity - SumQuantity)*Fee ,@PrecitionCount)
				from #PricingTempItems a
				join #Returned_Quantity b on a.ID = b.ModifiedRow
				where a.TableName = 'stc.StockReceiptItem' 
				--and a.MainQuantity > SumQuantity

				insert into #PricingTempItems (Position,LastPricingDate,MainQuantity,Fee,Amount,TableName,ID,[Date],TypeInFee,StuffID,StockID,ModifiedTable,ModifiedRow,Description,MaxRevisionDate,MaxReturnDate,ShareOfCosts,DocumentType,ReturnStockReceiptItemID)	
				select b.Position,b.LastPricingDate,a.MainQuantity,b.Fee,round(a.MainQuantity * b.Fee,@PrecitionCount),b.TableName,b.ID,b.[Date],b.TypeInFee,b.StuffID,b.StockID,b.ModifiedTable,b.ModifiedRow,b.Description,b.MaxRevisionDate,b.MaxReturnDate,b.ShareOfCosts,b.DocumentType,a.ID
				from #PricingTempItems a 
				join #PricingTempItems b on a.ModifiedTable = b.TableName
									   and a.ModifiedRow = b.ID
				where a.TableName = 'stc.ReturnStockReceiptItem' 


				drop table if exists #Returned_Amount

				select ID,sum(Amount) SumAmount
				into #Returned_Amount
				from
				(
					select ID,Amount
					from #PricingTempItems
					where ReturnStockReceiptItemID is not null

					union all
				
					select a.id,Amount 
					from #PricingTempItems a
					join #Returned_Quantity b on a.ID = b.ModifiedRow
					where a.TableName = 'stc.StockReceiptItem' 
					and ReturnStockReceiptItemID is null
				)a
				group by ID

				drop table if exists #diff

				select a.ID, a.Amount - b.SumAmount Diff
				into #diff
				from #mainStockreceipt a
				join #Returned_Amount b on a.ID = b.ID
				where  a.Amount <> b.SumAmount

				drop table if exists #Rno

				select *
				into #Rno
				from
				(
				select ReturnStockReceiptItemID,b.Diff,ROW_NUMBER() over(partition by a.id order by  ReturnStockReceiptItemID) Rno
				from #PricingTempItems a
				join #diff b on a.ID = b.ID
				where a.TableName = 'stc.StockReceiptItem' 
				and ReturnStockReceiptItemID is not null
				)a where Rno = 1

				update a
				set Amount = Amount + Diff
				from #PricingTempItems a
				join #Rno b on a.ReturnStockReceiptItemID = b.ReturnStockReceiptItemID

				delete a
				from #PricingTempItems a
				join #Returned_Quantity b on a.ID = b.ModifiedRow
				where a.TableName = 'stc.StockReceiptItem' 
				and a.MainQuantity = 0

	end

		SELECT  Row_Number() over(order by Date,case when TypeInFee = 1 then TypeInFee else [Nature] end) IdKey,Position,
				MainQuantity,Amount,TableName,ID,Date,[Nature],TypeInFee ,StuffID,StockID,
				ModifiedTable,ModifiedRow,Description,LastPricingDate,MaxRevisionDate,MaxReturnDate,ShareOfCosts,DocumentType,
				0 CalculatedRightNow,ReturnStockReceiptItemID
				into #BasePricingTemp
		from #PricingTempItems

		create TABLE  #PricingTemp
		( 
		IdKey int ,
		position int,
		RowIndex  BIGINT NOT null,
		MainQuantity  DECIMAL(36,10),
		ModifiedQuantity  DECIMAL(36,10),
		Amount  DECIMAL(36,10),
		TableName  VARCHAR(200),
		ID  INT,
		[Date]  DATE,
		TypeInFee  TINYINT,
		QuantityInLine  DECIMAL(36,10),
		StuffID int	,	
		StockID int,
		Description nvarchar(1024),
		Calcable bit,
		LastPricingDate Date,
		ModifiedTable VARCHAR(300),
		ModifiedRow int,
		PlaceCanBeChanged	tinyint,
		InputRemain  DECIMAL(36,10),
		PricingType tinyint,
		MaxRevisionDate Date,
		MaxReturnDate Date,
		[Sign] int,
		DocumentType TinyInt,
		ShareOfCosts DECIMAL(36,10),
		ReturnStockReceiptItemID int
		)

	SET @Message  =  'بررسی اطلاعات ... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'بررسی اطلاعات', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

	IF OBJECT_ID('tempdb..#DependentReceipt') IS Not NULL
	DROP TABLE #DependentReceipt
	create table #DependentReceipt
	(
	 StockReceiptItemid int,
	 OutgoingItemid int
	)
	insert into #DependentReceipt
	select StockReceiptItemid,OutgoingItemid 
	from #BasePricingTemp a
	join [STC].[StockReceiptChargingService] b on a.TableName = 'stc.StockReceiptItem' and a.id = b.StockReceiptItemID and DocumentType = 10

	insert into #DependentReceipt
	select StockReceiptItemid,OutgoingItemid 
	from stc.StuffComposition a
	join stc.OutgoingItem b on a.StuffCompositionid = b.StuffCompositionID
	join #BasePricingTemp c on c.TableName = 'stc.StockReceiptItem' and c.id = a.StockReceiptItemID and DocumentType = 9

	insert into #DependentReceipt
	select StockReceiptItemid,a.OutgoingItemid 
	from stc.ConvertSpecification a
	join stc.StockReceiptItem b on a.ConvertSpecificationID = b.ConvertSpecificationID
	join #BasePricingTemp c on c.TableName = 'stc.StockReceiptItem' and c.id = b.StockReceiptItemID and DocumentType = 8


	IF OBJECT_ID('tempdb..#DiferentPosition') IS Not NULL
	DROP TABLE #DiferentPosition
	create table #DiferentPosition
	([Type] Tinyint,Position int,IdKey int)

	IF OBJECT_ID('tempdb..#MinCalcableRowIndex') IS Not NULL
	DROP TABLE #MinCalcableRowIndex
	create table #MinCalcableRowIndex
	(Position int,MinRowIndex int,[Date] Date)


	IF OBJECT_ID('tempdb..#PositionsNeedToLoop') IS Not NULL
	DROP TABLE #PositionsNeedToLoop
	create table #PositionsNeedToLoop
	(Position int)

	DECLARE @checkWhile BIT = 1

	WHILE @checkWhile=1	
	begin

	SET @Message  =  'شروع محاسبات مرتبه شمارش : ' + @LoopNumber + ' زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'شروع محاسبات مرتبه شمارش : ' + @LoopNumber, CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())



	truncate table #PrevoiusLoop
	insert into #PrevoiusLoop
	select IdKey,Amount,TableName,ID
	from #BasePricingTemp

	   BEGIN 	

			truncate table #PositionsNeedToLoop
			insert into #PositionsNeedToLoop
			select Position
			from #BasePricingTemp a 
			where Amount - isnull(ShareOfCosts,0) = 0 
			and CalculatedRightNow = 1
			group by Position
			union 
			select Position 
			from #DiferentPosition 
			group by Position
			
			truncate table #PricingTemp
			insert into #PricingTemp (IdKey,position,RowIndex,MainQuantity,ModifiedQuantity,Amount,TableName,ID,[Date],TypeInFee,StuffID,StockID,Description,LastPricingDate,ModifiedTable,ModifiedRow,PlaceCanBeChanged,InputRemain,PricingType,MaxRevisionDate,MaxReturnDate,[sign],DocumentType,ShareOfCosts,ReturnStockReceiptItemID)	
			SELECT  IdKey,position,Row_Number() over(partition by position order by IdKey),MainQuantity,
					case when ReturnStockReceiptItemID is not null or (TableName = 'stc.ReturnStockReceiptItem' and ModifiedRow is not null) then 0 else MainQuantity end,
					Amount,TableName,ID,[Date],TypeInFee,a.StuffID,StockID,Description,LastPricingDate,ModifiedTable,ModifiedRow,1,
					CASE WHEN    TableName = 'stc.StockReceiptItem'
							OR   TableName = 'stc.ReturnedOutgoingItem'  
								 then MainQuantity
								   else 0 end,
					c.PricingType,MaxRevisionDate,MaxReturnDate,
					CASE WHEN    TableName = 'stc.StockReceiptItem'
							OR   TableName = 'stc.ReturnedOutgoingItem'  
								 then 1
								   else -1 end,DocumentType,
					ShareOfCosts,ReturnStockReceiptItemID
			from #BasePricingTemp a
			join stf.StuffDetail b
					on a.StuffID = b.StuffID
			join stf.StuffAccountGroup c
					on c.StuffAccountGroupID = b.StuffAccountGroupID
			where @LoopNumber = 1 
				or
				(Position in (select Position from #PositionsNeedToLoop))



			if @LoopNumber = 1
			update #PricingTemp
			set Calcable = 1		   
			where 
				(
					LastPricingDate is null
					or
					Date > LastPricingDate
					or
					(MaxRevisionDate is not null and MaxRevisionDate > LastPricingDate)
					or
					(MaxReturnDate is not null and MaxReturnDate > LastPricingDate)
				)


			if @LoopNumber > 1 and 
			exists (select a.Position
					from #BasePricingTemp a 
					left join (	select Position from #DiferentPosition  group by Position) b on a.Position = b.Position
					where Amount - isnull(ShareOfCosts,0) = 0 
					and CalculatedRightNow = 1
					and b.Position is null
					group by a.Position)
			update a
			set Calcable = 1		   
			from #PricingTemp a
			where Position in (select a.Position
								from #BasePricingTemp a 
								left join (	select Position from #DiferentPosition  group by Position) b on a.Position = b.Position
								where Amount - isnull(ShareOfCosts,0) = 0 
								and CalculatedRightNow = 1
								and b.Position is null
								group by a.Position)




			if @LoopNumber > 1 and 
			exists (select Position from #DiferentPosition where Type in (1,2) group by Position )
			update #PricingTemp
			set Calcable = 1		   
			where Position in (	select Position from #DiferentPosition where Type in (1,2) group by Position)



			if @LoopNumber > 1 and 
			exists (select Position from #DiferentPosition where Type = 3 group by Position )
			update a
			set Calcable = 1		 
			from #PricingTemp a
			join (	select Position,min(IdKey) IdKey from #DiferentPosition where Type=3 group by Position) b
				on a.position = b.Position
			where  a.IdKey >=  b.IdKey



			truncate table #MinCalcableRowIndex
			insert into #MinCalcableRowIndex
			select  position, min(RowIndex) ,min([Date])
			from #PricingTemp 
			where Calcable = 1
			group by position;

			update a
			set Calcable = 1
			from #PricingTemp a
			join #MinCalcableRowIndex b on a.position = b.position and (a.RowIndex > b.MinRowIndex or a.Date = b.Date)

			insert into STC.PricingStage select 'Calcable_Update', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
			
			if exists (select 1 from #PricingTemp where Calcable = 1)
			BEGIN


				;with temp as (
							select IdKey,
							sum([sign]*ModifiedQuantity) over(partition by position order by RowIndex) Quantity_RunningTotal
							FROM   #PricingTemp 
							   )
				update v
				set QuantityInLine = vi.Quantity_RunningTotal
				from #PricingTemp v
				join temp vi  on v.IdKey = vi.IdKey


				select @maxrowindex = max(rowindex) from #PricingTemp

				IF OBJECT_ID('tempdb..#T') IS NOT NULL DROP TABLE #T
				create Table #T
				(
					RowIndex int,stockid int,IdKey int,id int,TableName varchar(250)
				)

				IF OBJECT_ID('tempdb..#T2') IS NOT NULL DROP TABLE #T2
				create Table #T2
				(
					Rno int,PlusIdKey int,PlusRowIndex int,MinusRowIndex int,MinusIdKey int
				)
	
			insert into #T
			SELECT TOP 1 RowIndex,stockid,IdKey,id,TableName
			from(
				select ROW_NUMBER() over(partition by position order by RowIndex) Rno,*
				from #PricingTemp
				where QuantityInLine < 0
				)A where rno = 1		



			DELETE #T2
			insert into #T2
			select  ROW_NUMBER() over(order by #PricingTemp.RowIndex) Rno,
					#PricingTemp.IdKey PlusIdKey,#PricingTemp.RowIndex PlusRowIndex,#T.RowIndex MinusRowIndex,#T.IdKey MinusIdKey
			from #PricingTemp
			inner join  #T on #PricingTemp.RowIndex > #T.RowIndex
							and #PricingTemp.TableName in( 'stc.StockReceiptItem','stc.ReturnedOutgoingItem')


			WHILE  (select count(*) from #T2) <> 0 
			BEGIN
						update v
						set RowIndex = -1 * vi.MinusRowIndex
						from #PricingTemp v
						join #T2 vi  on v.IdKey = vi.PlusIdKey and vi.Rno = 1

	
						update #PricingTemp
						set RowIndex = RowIndex + 1
						where RowIndex >= (select MinusRowIndex from #T2 where Rno = 1)


						update #PricingTemp
						set RowIndex = abs(RowIndex)


						;with temp as (
									select IdKey,
									sum([sign]*ModifiedQuantity) over(partition by position order by RowIndex) Quantity_RunningTotal
									FROM   #PricingTemp 
									   )
						update v
						set QuantityInLine = vi.Quantity_RunningTotal
						from #PricingTemp v
						join temp vi  on v.IdKey = vi.IdKey


						truncate table #T
						insert into #T
						SELECT TOP 1 RowIndex,stockid,IdKey,id,TableName
						from(
							select ROW_NUMBER() over(partition by position order by RowIndex) Rno,*
							from #PricingTemp
							where QuantityInLine<0
							)A where rno = 1
		


						truncate table #T2		
						insert into #T2
						select  ROW_NUMBER() over(order by #PricingTemp.RowIndex) Rno,
								#PricingTemp.IdKey PlusIdKey,#PricingTemp.RowIndex PlusRowIndex,#T.RowIndex MinusRowIndex,#T.IdKey MinusIdKey
						from #PricingTemp
						inner join  #T on #PricingTemp.RowIndex > #T.RowIndex
										and #PricingTemp.TableName in( 'stc.StockReceiptItem','stc.ReturnedOutgoingItem')
				

			END
			insert into STC.PricingStage select 'QuantityInLine_WHILE', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())


				DECLARE @ID int
				DECLARE RowIndex_Cursor CURSOR FORWARD_ONLY FAST_FORWARD FOR
				SELECT position,RowIndex,DocumentType,ID,TypeInFee,PricingType,TableName
				FROM #PricingTemp
				where Calcable = 1 
				and TypeInFee in (2,3)
				order by RowIndex

				OPEN RowIndex_Cursor;
				FETCH NEXT FROM RowIndex_Cursor INTO @Position,@RowIndex,@DocumentType,@ID,@TypeInFee,@PricingType,@TableName;
				WHILE @@FETCH_STATUS = 0
				   BEGIN 
	   
				IF @TypeInFee = 2
					BEGIN
			
					--average
					if @PricingType = 1
						begin

							UPDATE #PricingTemp
							SET Amount = 
										case 
										when
											--(select sum([sign]*MainQuantity)
											-- from #PricingTemp 
											-- where  Position = @Position
											-- and StockID = p.StockID  
											-- and RowIndex <= p.RowIndex) = 0
											QuantityInLine = 0
											 then 
											(select sum([sign]* case when ReturnStockReceiptItemID is not null or (TableName = 'stc.ReturnStockReceiptItem' and ModifiedRow is not null) then 0 else Amount end)
											 from #PricingTemp 
											 where  Position = @Position
											 and StockID = p.StockID  
											 and RowIndex < p.RowIndex )
										when 
											 	 (select sum([sign]*  ModifiedQuantity) --MainQuantity
												 from #PricingTemp 
												 where Position = @Position
												 and StockID = p.StockID  
												 and RowIndex < p.RowIndex
												) > 0
												then
										(
											(
												(select sum([sign]* case when ReturnStockReceiptItemID is not null or (TableName = 'stc.ReturnStockReceiptItem' and ModifiedRow is not null) then 0 else Amount end)
												 from #PricingTemp 
												 where Position = @Position
												 and StockID = p.StockID  
												 and RowIndex < p.RowIndex 
												 )

											 )
													/  
											(
												(select sum([sign]*ModifiedQuantity) --MainQuantity
												 from #PricingTemp 
												 where Position = @Position
												 and StockID = p.StockID  
												 and RowIndex < p.RowIndex
												)

											 )
										) 
										*
										MainQuantity 
										else 0
										end
									
							FROM   #PricingTemp P
							where Position = @Position and RowIndex = @RowIndex 

							if @TableName = 'stc.ReturnedOutgoingItem' 
							begin
							UPDATE #PricingTemp
							set Amount = (select top 1 Amount / MainQuantity
											FROM   #PricingTemp 
											where Position = @Position
											and stockid = p.StockID 
											and TableName = 'stc.StockReceiptItem' 
											and RowIndex < @RowIndex
											order by RowIndex desc) * p.MainQuantity
							FROM   #PricingTemp P
							where Position = @Position
							and RowIndex = @RowIndex 
							and TableName = 'stc.ReturnedOutgoingItem' 
							and isnull(Amount,0) = 0

							UPDATE #PricingTemp
							set Amount = (select top 1 i.Price / MainQuantity
											from stc.StockReceipt h
											join stc.StockReceiptItem i on h.StockReceiptID = i.StockReceiptID
											where h.Date < p.Date
											and h.StockID = p.StockID
											and i.StuffID = p.StuffID
											order by h.Date desc) * p.MainQuantity
							FROM   #PricingTemp P
							where Position = @Position
							and RowIndex = @RowIndex 
							and TableName = 'stc.ReturnedOutgoingItem' 
							and isnull(Amount,0) = 0
							end

							UPDATE #PricingTemp
							SET Amount =  ROUND(Amount , @PrecitionCount)
							FROM   #PricingTemp P
							where Position = @Position and RowIndex = @RowIndex 

						end


					END
				else IF @TypeInFee = 3
					BEGIN		


						if @TableName = 'stc.ReturnedOutgoingItem'
						UPDATE P
						set Amount = ROUND( case when T.ID is not null and (T.Amount / T.MainQuantity) > 0 then (T.Amount / T.MainQuantity) 
														 else oi.Fee end * P.MainQuantity , @PrecitionCount)
						from #PricingTemp P
						left join #PricingTemp T 
							on P.ModifiedTable = T.TableName 
							and P.ModifiedRow = T.ID
						left join STC.vwReturnOutgoing_Outgoing vw
							on vw.ReturnedOutgoingItemID = P.ID
						left join stc.OutgoingItem oi 
							ON oi.OutgoingItemID = vw.OutgoingItemID
						where p.Position = @Position
						and p.RowIndex = @RowIndex 
						and p.TableName in ('stc.ReturnedOutgoingItem') 

						if @TableName = 'stc.ReturnStockReceiptItem'
						UPDATE p
						SET Amount = case when p.MainQuantity = si.MainQuantity then  si.NetPrice else ROUND(p.MainQuantity * si.NetPrice / si.MainQuantity , @PrecitionCount) end
						FROM   #PricingTemp p
						join stc.StockReceiptItem si on si.StockReceiptItemID = p.ModifiedRow
						where Position = @Position 
						and p.RowIndex = @RowIndex 
						and TableName = 'stc.ReturnStockReceiptItem' 

			/*قبلا فی رو بدست می آوردیم ولی از اونجا که ممکنه مبلغ مبدا روند شده باشه و دچار اختلاف بشیم تصمیم گرفتیم مبلغ رو بدست بیاریم */
					--انتقالی
					if @DocumentType = 5 or @DocumentType = 12
					begin

						select top 1 @CardexFee = amount / MainQuantity
						from #PricingTemp
						where Position = @Position 
						and RowIndex < @RowIndex 
						order by RowIndex desc

						--UPDATE p
						--SET Amount = si.ShareOfCosts + (SELECT case when pt.id is null then oi.Price 
						--											when isnull(pt.Amount,0) <> 0 then pt.Amount
						--											else isnull(@CardexFee,1)*si.MainQuantity end
						--								FROM STC.OutgoingItem oi
						--								left join #PricingTemp pt on oi.OutgoingItemID = pt.ID 
						--														and pt.TableName = 'stc.OutgoingItem'
						--								WHERE oi.OutgoingItemID = si.OutgoingItemID)
						--FROM   #PricingTemp p
						--join stc.StockReceiptItem si on si.StockReceiptItemID = p.id
						--where Position = @Position 
						--and p.RowIndex = @RowIndex 
						--and TableName = 'stc.StockReceiptItem' 
						--and p.documenttype =  5


						UPDATE p
						SET Amount = si.ShareOfCosts + COALESCE(pt.Amount, oi.Price, ISNULL(@CardexFee, 1) * si.MainQuantity)
						FROM #PricingTemp p
						JOIN stc.StockReceiptItem si ON si.StockReceiptItemID = p.id
						LEFT JOIN STC.OutgoingItem oi ON oi.OutgoingItemID = si.OutgoingItemID
						LEFT JOIN #PricingTemp pt ON oi.OutgoingItemID = pt.ID AND pt.TableName = 'stc.OutgoingItem'
						WHERE p.Position = @Position 
						AND p.RowIndex = @RowIndex 
						AND p.TableName = 'stc.StockReceiptItem' 
						AND p.documenttype in (5,12)



					end
					--تبدیل
					if @DocumentType = 8
					begin

					select  @OutgoingItemID = cs.OutgoingItemID,
							@StockReceiptItemID = si.StockReceiptItemID
					FROM   #PricingTemp p
					join stc.StockReceiptItem si on si.StockReceiptItemID = p.id
					join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					join stc.StockDocumentType sd on sd.StockDocumentTypeID = sdtb.StockDocumentTypeID
					join stc.ConvertSpecification cs on cs.ConvertSpecificationID = si.ConvertSpecificationID
					where Position = @Position
					and p.RowIndex = @RowIndex 
					and TableName = 'stc.StockReceiptItem' and sd.documenttype =  8

					truncate table #ConvertSpecificationTemp
					insert into #ConvertSpecificationTemp
					select  
							ROW_NUMBER() over(partition by oi.OutgoingItemID order by cs.ConvertSpecificationID) Rno,
							oi.OutgoingItemID,
							ConvertSpecificationID,
							case when pt.id is null then oi.Price 
								 else isnull(pt.Amount,0)
								 --when isnull(pt.Amount,0) <> 0 then pt.Amount 
								 --else isnull(@CardexFee,1)*cs.MainQuantity  
								 end Amount,
							cs.Rate,
							0 ShareOfAmount
					FROM   stc.OutgoingItem oi
					left join #BasePricingTemp pt on oi.OutgoingItemID = pt.ID and pt.TableName = 'stc.OutgoingItem'
					join stc.ConvertSpecification cs on cs.OutgoingItemID = oi.OutgoingItemID
					where oi.OutgoingItemID = @OutgoingItemID

					update #ConvertSpecificationTemp
					set ShareOfAmount = round(Rate * Amount / 100,0)


					update b
					set ShareOfAmount = b.ShareOfAmount  + ( b.Amount - a.SumShareOfAmount)
					from 
					(
					select OutgoingItemID,
						   sum(ShareOfAmount) SumShareOfAmount
					from #ConvertSpecificationTemp
					group by OutgoingItemID
					)a 
					join #ConvertSpecificationTemp b on a.OutgoingItemID = b.OutgoingItemID and b.Rno = 1
				
					UPDATE p
					SET Amount = si.ShareOfCosts +  ShareOfAmount
					FROM   #PricingTemp p
					join stc.StockReceiptItem si on si.StockReceiptItemID = p.id
					join #ConvertSpecificationTemp cs on cs.ConvertSpecificationID = si.ConvertSpecificationID
					where Position = @Position
					and p.RowIndex = @RowIndex
					and TableName = 'stc.StockReceiptItem' 
					and si.StockReceiptItemID = @StockReceiptItemID

					end
					--ترکیب
					if @DocumentType = 9
					UPDATE p
					SET Amount = si.ShareOfCosts +   case when exists (SELECT 1
															FROM STC.OutgoingItem oi
															join stc.StuffComposition sc
																on oi.StuffCompositionID = sc.StuffCompositionID 
															left join #BasePricingTemp pt on oi.OutgoingItemID = pt.ID 
																					and pt.TableName = 'stc.OutgoingItem'
															WHERE sc.StockReceiptItemID = si.StockReceiptItemID
															and (case when pt.Amount is not null then pt.Amount else oi.Price end) = 0)
										then 0--isnull(@CardexFee,1)*si.MainQuantity
										else 
										 (SELECT sum(case when pt.Amount is not null then pt.Amount else oi.Price end)
															FROM STC.OutgoingItem oi
															join stc.StuffComposition sc
																on oi.StuffCompositionID = sc.StuffCompositionID 
															left join #BasePricingTemp pt on oi.OutgoingItemID = pt.ID 
																					and pt.TableName = 'stc.OutgoingItem'
															WHERE sc.StockReceiptItemID = si.StockReceiptItemID)
															end
					FROM   #PricingTemp p
					join stc.StockReceiptItem si on si.StockReceiptItemID = p.id
					join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID
					JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
						ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
					join stc.StockDocumentType sd on sd.StockDocumentTypeID = sdtb.StockDocumentTypeID
					where Position = @Position
					and p.RowIndex = @RowIndex 
					and TableName = 'stc.StockReceiptItem' 
					and sd.documenttype =  9

					--دریافت از پیمانکار
					if @DocumentType = 10
					begin

						UPDATE p
						SET Amount =  si.ShareOfCosts +  case when oi1.StockReceiptItemID is not null then 0 else oi.Price end
						FROM   #PricingTemp p
						join stc.StockReceiptItem si on si.StockReceiptItemID = p.id
						join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID
						JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
							ON s.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
						join stc.StockDocumentType sd on sd.StockDocumentTypeID = sdtb.StockDocumentTypeID
						join
						(
							select srcs.StockReceiptItemID,sum(round(isnull(case when pt.Amount is not null then pt.Amount 
														   else oi.Price end,0) * srcs.MainQuantity / oi.MainQuantity , @PrecitionCount)) Price
							FROM [STC].[StockReceiptChargingService] srcs
							join STC.OutgoingItem oi on srcs.OutgoingItemID = oi.OutgoingItemID
							left join #BasePricingTemp pt on oi.OutgoingItemID = pt.ID 
													and pt.TableName = 'stc.OutgoingItem'
							group by srcs.StockReceiptItemID
						)oi on oi.StockReceiptItemID = si.StockReceiptItemID
						left join
						(
							select srcs.StockReceiptItemID
							FROM [STC].[StockReceiptChargingService] srcs
							join STC.OutgoingItem oi on srcs.OutgoingItemID = oi.OutgoingItemID
							left join #BasePricingTemp pt on oi.OutgoingItemID = pt.ID 
													and pt.TableName = 'stc.OutgoingItem'
							where isnull(case when pt.Amount is not null then pt.Amount else oi.Price end,0) = 0				
							group by srcs.StockReceiptItemID
						)oi1 on oi1.StockReceiptItemID = si.StockReceiptItemID
						where Position = @Position
						and p.RowIndex = @RowIndex
						and TableName = 'stc.StockReceiptItem' and sd.documenttype =  10


					end
					END
	
				   FETCH NEXT FROM RowIndex_Cursor  INTO @Position,@RowIndex,@documentType,@ID,@TypeInFee,@PricingType,@TableName;
				   END;
				CLOSE RowIndex_Cursor;
				DEALLOCATE RowIndex_Cursor;



				insert into STC.PricingStage select 'RowIndex_Cursor', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())			
			end

				update a 
				set Amount = case when b.Amount > 0 then b.Amount else 0 end,
					CalculatedRightNow = case when CalculatedRightNow = 1 then 1 else isnull(b.Calcable,0) end
				from #BasePricingTemp a
				join #PricingTemp b on a.IdKey = b.IdKey
				where isnull(b.Calcable,0) = 1

		end

	SET @Message  =  'پایان محاسبات مرتبه شمارش : ' + @LoopNumber
	print @Message
	insert into STC.PricingStage select @Message, CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())


	insert into STC.PricingStage select 'Start of insert into #DiferentPosition', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

	truncate table #DiferentPosition

	insert into #DiferentPosition
	select 1,Position,a.IdKey
	from #BasePricingTemp a
	left join #PrevoiusLoop b on a.IdKey = b.IdKey
	where a.Amount<>isnull(b.Amount,0)
	and isnull(b.Amount,0) <> 0
	and CalculatedRightNow = 1
	group by Position,a.IdKey
	
	insert into #DiferentPosition
	select 2,a.Position,a.IdKey
	from #BasePricingTemp a
	join #DependentReceipt b on a.id = b.StockReceiptItemID
	join #PrevoiusLoop c on c.TableName = 'stc.OutgoingItem' and c.ID = b.OutgoingItemID
	join #BasePricingTemp d on c.IdKey = d.IdKey
	where isnull(d.Amount,0)<>isnull(c.Amount,0)
	and a.TableName = 'stc.StockReceiptItem' 
	and a.TypeInFee = 3
	and a.CalculatedRightNow = 1
	group by a.Position,a.IdKey

	insert into #DiferentPosition
	select 3,a.Position,a.IdKey
	from #BasePricingTemp a
	join #BasePricingTemp b on a.ModifiedTable = b.TableName
							and a.ModifiedRow = b.ID
	where (isnull(a.Amount,0) = 0 or isnull(b.Amount,0) = 0 or isnull(a.Amount,0)<>isnull(b.Amount,0))
	and a.TableName = 'stc.StockReceiptItem' 
	and a.TypeInFee = 3
	and a.DocumentType = 5
	and a.CalculatedRightNow = 1
	group by a.Position,a.IdKey

	insert into STC.PricingStage select 'End of insert into #DiferentPosition', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())


	--select 
	--	@LoopNumber LoopNumber,Position,IdKey,RowIndex,stuffid,stockid,date,TypeInFee,DocumentType,TableName,Calcable,
	--	MainQuantity * [Sign] SignedQuantity,
	--	ModifiedQuantity * [Sign] SignedModifiedQuantity,
	--	[Sign]*Amount SignedAmount,
	--	QuantityInLine,ID,ModifiedTable,ModifiedRow,ReturnStockReceiptItemID
	--from #PricingTemp 
	--order by RowIndex


	set @LoopNumber = @LoopNumber + 1;
	SELECT @checkWhile= CASE WHEN  @LoopNumber < 100
									and
									(
										(exists (select top 1 1 from #BasePricingTemp a 
																 where Amount - isnull(ShareOfCosts,0) = 0 
																 and CalculatedRightNow = 1))
										or
										(exists (select top 1 1 from #DiferentPosition))
									)
							THEN 1 
							ELSE 0
							 END

	end
	
	--select * from #BasePricingTemp
	--return

	/*Validations*/
	begin

	SET @Message  =  'اعتبار سنجی محاسبات ... '  + ' زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'اعتبار سنجی محاسبات', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

				set @Message = null
		/*کنترل اینکه کالاهای تبدیل شده، خودشان در لیست  قیمت گذاری هستند*/
		
				SELECT @Message = STUFF((SELECT DISTINCT ',' + QUOTENAME(stf.GetStuffCode(oi.stuffid))
				FROM   #BasePricingTemp p
				join stc.StockReceiptItem si on si.StockReceiptItemID = p.id				
				join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID
				join stc.ConvertSpecification cs on cs.ConvertSpecificationID = si.ConvertSpecificationID
				join stc.OutgoingItem oi on oi.OutgoingItemID = cs.OutgoingItemID
				left join  #BasePricingTemp p2 on p2.TableName = 'stc.OutgoingItem' and p2.id = oi.OutgoingItemID
				where  p.TableName = 'stc.StockReceiptItem' 
				and p.typeinfee = 3
				and oi.Price = 0 
				and p.Amount = 0
				and isnull(p2.Amount,0) = 0
								   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

				if @Message is not null
				begin

					set @Message = 'لازم است کالاهای تبدیل شده زیر را قیمت گذاری نمایید:'+char(13)+char(10)+@Message
					raiserror(@Message,16,13)

				end

				set @Message = null
		/*کنترل اینکه کالاهای ترکیب شده، خودشان در لیست  قیمت گذاری هستند*/
		
				SELECT @Message = STUFF((SELECT DISTINCT ',' + QUOTENAME(stf.GetStuffCode(oi.stuffid))
				FROM   #BasePricingTemp p
				join stc.StockReceiptItem si on si.StockReceiptItemID = p.id				
				join stc.StockReceipt s on s.StockReceiptID = si.StockReceiptID
				join stc.StuffComposition sc on sc.StockReceiptItemID = si.StockReceiptItemID
				join stc.OutgoingItem oi on oi.StuffCompositionID = sc.StuffCompositionID
				left join  #BasePricingTemp p2 on p2.TableName = 'stc.OutgoingItem' and p2.id = oi.OutgoingItemID
				where  p.TableName = 'stc.StockReceiptItem' 
				and p.typeinfee = 3
				and oi.Price = 0 
				and p.Amount = 0
				and isnull(p2.Amount,0) = 0
								   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

				if @Message is not null
				begin

					set @Message = 'لازم است کالاهای ترکیب شده زیر را قیمت گذاری نمایید:'+char(13)+char(10)+@Message
					raiserror(@Message,16,13)

				end

				SET @Message = NULL;
				SELECT @Message = STUFF((SELECT DISTINCT ',برگشت حواله شماره: ' + cast(h.Number as varchar(25)) + ' کد کالا: ' + stf.GetStuffCode(a.StuffID)
					FROM   #BasePricingTemp p
					join stc.ReturnedOutgoingItem a on p.TableName = 'stc.ReturnedOutgoingItem' and p.id = a.ReturnedOutgoingItemID
					join stc.ReturnedOutgoing h on a.ReturnedOutgoingID = h.ReturnedOutgoingID
					where isnull(Amount,0) = 0   and TypeInFee <> 3		 
								FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

				if @Message IS NOT NULL
					begin

						set @Message = 'قیمت کالا در برگشت حواله‌های زیر را مشخص نمایید: '+char(13)+char(10)+@Message
						raiserror(@Message,16,13)
					end

				if exists (
					select * 
					FROM   #BasePricingTemp p
					where  isnull(p.Amount,0) - ISNULL(p.ShareOfCosts,0) = 0 
					and TypeInFee = 3  and TableName <> 'stc.ReturnedOutgoingItem'
						  )
					begin

							select p.DocumentType,p.id StockReceiptItemID,p.StuffID
							into #TempOfAlarmTable
							FROM   #BasePricingTemp p
							where isnull(p.Amount,0) - ISNULL(p.ShareOfCosts,0) = 0 
							and TypeInFee = 3   
							and TableName = 'stc.StockReceiptItem'

							SELECT @Message =
							'لازم است کالاهای زیر در تاریخهای مشخص شده قیمت گذاری شوند:'+char(13)+char(10)
							+
							STUFF((
							select distinct stf.GetStuffCode(c.StuffID) + ' - ' + cfg.GetCLRSaturnDate(d.Date,'YY-MM-DD',0,0)+char(13)+char(10)
							from #TempOfAlarmTable a
							join stc.StuffComposition b on a.StockReceiptItemID = b.StockReceiptItemID
							join stc.OutgoingItem c on c.StuffCompositionID = b.StuffCompositionID
							join stc.Outgoing d on d.OutgoingID = c.OutgoingID
							left join #BasePricingTemp pt on c.OutgoingItemID = pt.ID and pt.TableName = 'stc.OutgoingItem'
							where (case when pt.Amount is not null then pt.Amount else c.Price end) = 0           
							FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')	

							if @Message IS NOT NULL
								raiserror(@Message,16,13)

							SELECT @Message =
							'لازم است کالاهای زیر در تاریخهای مشخص شده قیمت گذاری شوند:'+char(13)+char(10)
							+
							STUFF((
							select distinct stf.GetStuffCode(c.StuffID) + ' - ' + cfg.GetCLRSaturnDate(d.Date,'YY-MM-DD',0,0)+char(13)+char(10)
							from #TempOfAlarmTable a
							join stc.StockReceiptChargingService b on a.StockReceiptItemID = b.StockReceiptItemID
							join stc.OutgoingItem c on c.OutgoingItemID = b.OutgoingItemID
							join stc.Outgoing d on d.OutgoingID = c.OutgoingID
							left join #BasePricingTemp pt on c.OutgoingItemID = pt.ID and pt.TableName = 'stc.OutgoingItem'
							where (case when pt.Amount is not null then pt.Amount else c.Price end) = 0           
							FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,0,'')	

							if @Message IS NOT NULL
								raiserror(@Message,16,13)

							SELECT @Message = 
							'کالاهای زیر دارای رسید انتقالی است. انبار مبدا را نیز انتخاب نمایید.'+char(13)+char(10)
							+
							STUFF((SELECT DISTINCT ',' + QUOTENAME(stf.GetStuffCode(p.StuffID))
								FROM   #TempOfAlarmTable p
								where   DocumentType = 5  
							FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')		   	

							if @Message IS NOT NULL
								raiserror(@Message,16,13)


							SELECT @Message = 'اشکال' +char(13) +char(10) +
							STUFF((SELECT DISTINCT ',' + QUOTENAME(stf.GetStuffCode(p.StuffID))
								FROM   #TempOfAlarmTable p
								join stf.StuffDetail s2 on s2.StuffID = p.StuffID
								JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = s2.StuffAccountGroupID
								where   DocumentType <> 10 or SAG.StuffDetailType <> 3
							FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')		   	

							if @Message IS NOT NULL
								raiserror(@Message,16,13)
					end

				SET @Message = NULL;
				SELECT @Message = STUFF((SELECT DISTINCT ',' + QUOTENAME(stf.GetStuffCode(p.StuffID))
											FROM   #BasePricingTemp p
											where isnull(Amount,0) = 0  
											and CalculatedRightNow = 1
											and date between LastPricingDate and @PricingDate
								  FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')	

				if @Message IS NOT NULL
					begin

						set @Message = ' کاردکس کالاهای زیر دارای اشکال است.'+char(13)+char(10)+@Message
						raiserror(@Message,16,13)
					end
	end


	/* اعمال محاسبات بدست آمده در جداول مربوطه		*/
	BEGIN

			--** رسيد
			begin

			SET @Message  =  'اعمال محاسبات رسید ...'  + ' زمان: ' + cast(SYSDATETIME() as varchar(30)) 
			print @Message
			insert into STC.PricingStage select 'اعمال محاسبات رسید', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

			select  s.StockReceiptID,
					s.StockReceiptItemID,
					(P.Amount - s.ShareOfCosts) / s.mainquantity Fee,
					P.Amount - s.ShareOfCosts	 Price
			into #StockReceiptItem
			from stc.StockReceiptItem S
			join stc.StockReceipt h on h.StockReceiptID = s.StockReceiptID
			join #BasePricingTemp P ON P.TableName = 'stc.StockReceiptItem' AND S.StockReceiptItemID = P.ID  
			where P.TypeInFee = 3 
			and  s.Fee = 0 
			and h.FinancialPeriodID = @FinancialPeriodID
			and CalculatedRightNow = 1

			UPDATE s 
			set Fee =  t.Fee ,
				Price =  t.Price	
			from stc.StockReceiptItem S
			join #StockReceiptItem t on t.StockReceiptItemID = s.StockReceiptItemID
		

			;with temp as (
							SELECT s.StockReceiptID, SUM(t.Price) Price,SUM(NetPrice) NetPrice
							FROM stc.StockReceiptItem s
							join #StockReceiptItem t on t.StockReceiptItemID = s.StockReceiptItemID
							group by s.StockReceiptID 
						  )

			update v
			set TotalInvoicePrice = vi.Price,
				TotalNetPrice = vi.NetPrice
			from stc.StockReceipt v
			join temp vi  on v.StockReceiptID = vi.StockReceiptID

		
			IF EXISTS (
						select s.StockReceiptItemID
						from stc.StockReceiptItem S
						join stc.StockReceipt h on h.StockReceiptID = s.StockReceiptID
						join #BasePricingTemp P ON P.TableName = 'stc.StockReceiptItem' AND S.StockReceiptItemID = P.ID  
						LEFT JOIN (
									select  ROW_NUMBER() over(partition by StockReceiptItemID order by number desc) Rno,
											StockReceiptItemID,RevisionPrice from stc.RevisionCost h
									join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
									where StockReceiptItemID is not null and FinancialPeriodID = @FinancialPeriodID
								  ) Revision on Rno = 1 and Revision.StockReceiptItemID = s.StockReceiptItemID
						where P.TypeInFee = 3 and s.fee > 0 
							and 
							(
								(Revision.RevisionPrice is not null and Revision.RevisionPrice <> p.Amount) 
								or
								(Revision.RevisionPrice is  null and s.NetPrice > 0 and s.NetPrice <> p.Amount)
							)
							and h.FinancialPeriodID = @FinancialPeriodID
							and CalculatedRightNow = 1
							and h.Date <= p.LastPricingDate
						)
			BEGIN
	 
 					SET @RevisionCostNumber = ISNULL(
							(
								SELECT MAX(Number) 
								FROM   [STC].[RevisionCost]
								WHERE FinancialPeriodID = @FinancialPeriodID
							),
							0
						)			
 					SET @RevisionCostID = ISNULL(
							(
								SELECT MAX(RevisionCostID) 
								FROM   [STC].[RevisionCost]
							),
							0
						)		
					IF OBJECT_ID('tempdb..#RevisionCostItem1') IS NOT NULL
					drop table 	#RevisionCostItem1

					SELECT  DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostID AS [RevisionCostID],
							DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostNumber AS Number,st.branchid,
							ID,(p.Amount / p.MainQuantity) Fee,Amount,p.Description,
							Amount - case when Revision.RevisionPrice is not null then Revision.RevisionPrice else s.NetPrice end [Deference]
					into #RevisionCostItem1
					FROM stc.StockReceiptItem S
					join stc.StockReceipt h on h.StockReceiptID = s.StockReceiptID
					join stf.stock st on st.StockID = h.StockID
					join #BasePricingTemp P ON P.TableName = 'stc.StockReceiptItem' AND S.StockReceiptItemID = P.ID 
					LEFT JOIN (
								select  ROW_NUMBER() over(partition by StockReceiptItemID order by number desc) Rno,
										StockReceiptItemID,RevisionPrice from stc.RevisionCost h
								join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
								where StockReceiptItemID is not null and FinancialPeriodID = @FinancialPeriodID
							  ) Revision on Rno = 1 and Revision.StockReceiptItemID = s.StockReceiptItemID 
					where P.TypeInFee = 3  and p.Amount > 0 
						and 
						((Revision.RevisionPrice is not null and Revision.RevisionPrice <> P.Amount) 
						or
						(Revision.RevisionPrice is  null and s.NetPrice > 0 and s.NetPrice <> P.Amount))
						and h.FinancialPeriodID = @FinancialPeriodID
						and CalculatedRightNow = 1
						and h.Date <= p.LastPricingDate

					set identity_insert [STC].[RevisionCost] on
					INSERT INTO [STC].[RevisionCost] ([RevisionCostID],[Number], [Date], [AutoGenerated], [PreVoucherID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Type],[branchid])
					SELECT [RevisionCostID],Number, @PricingDate, 1, null, @FinancialPeriodID, 0, @userID, @CurrentDate, @userID, @CurrentDate, 0 , branchid
					from #RevisionCostItem1
					group by [RevisionCostID],branchid,Number
					set identity_insert [STC].[RevisionCost] off

					INSERT INTO [STC].[RevisionCostItem]
							   ([RevisionCostID]
							   ,[StockReceiptItemID]
							   ,[ReturnStockReceiptItemID]
							   ,[ReturnedOutgoingItemID]
							   ,[OutgoingItemID]
							   ,[RevisionFee]
							   ,[RevisionPrice]
							   ,[Deference]
							   ,[Description]
							   ,[Description2]
							   ,[Version]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate])  
					SELECT  RevisionCostID,
							ID,
							null,
							null,
							null,
							p.Fee,
							Amount,
							p.Deference,
							p.Description,
							p.Description,
							0,
							@userID,
							@CurrentDate,
							@userID,
							@CurrentDate
					FROM #RevisionCostItem1 p
	   
			END		
		
			end
	
			--** برگشت رسيد	
			begin

			SET @Message  =  'اعمال محاسبات برگشت رسید ...'  + ' زمان: ' + cast(SYSDATETIME() as varchar(30))
			print @Message
			insert into STC.PricingStage select 'اعمال محاسبات برگشت رسید', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

			UPDATE S
			SET Fee = (p.Amount / p.MainQuantity) ,
				Price = P.Amount
			FROM stc.ReturnStockReceiptItem S
			join #BasePricingTemp P ON P.TableName = 'stc.ReturnStockReceiptItem' AND S.ReturnStockReceiptItemID = P.ID
			where s.Fee = 0 
			and CalculatedRightNow = 1


			;with temp as 
			(
			SELECT i.ReturnStockReceiptID, SUM(Price) Price
			FROM stc.ReturnStockReceiptItem i
			JOIN stc.ReturnStockReceipt h ON h.ReturnStockReceiptID = i.ReturnStockReceiptID
			WHERE h.FinancialPeriodID = @FinancialPeriodID
			group by i.ReturnStockReceiptID 
			)

			update v
			set TotalInvoicePrice = vi.Price
			from stc.ReturnStockReceipt v
			join temp vi  on v.ReturnStockReceiptID = vi.ReturnStockReceiptID


			IF EXISTS (
					select s.ReturnStockReceiptItemID
					from stc.ReturnStockReceiptItem S
					join stc.ReturnStockReceipt h on h.ReturnStockReceiptID = s.ReturnStockReceiptID
					join #BasePricingTemp P ON P.TableName = 'stc.ReturnStockReceiptItem' AND S.ReturnStockReceiptItemID = P.ID  
					LEFT JOIN (
							select  ROW_NUMBER() over(partition by ReturnStockReceiptItemID order by number desc) Rno,
									ReturnStockReceiptItemID,RevisionPrice from stc.RevisionCost h
							join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
							where ReturnStockReceiptItemID is not null and FinancialPeriodID = @FinancialPeriodID
							) Revision on Rno = 1 and Revision.ReturnStockReceiptItemID = s.ReturnStockReceiptItemID
					where S.Fee <> 0 
						and 
						(
							(Revision.RevisionPrice is not null and Revision.RevisionPrice <> P.Amount) 
							or
							(Revision.RevisionPrice is  null and s.Price <> P.Amount)
						)
						and h.FinancialPeriodID = @FinancialPeriodID
						and CalculatedRightNow = 1
						and h.Date <= p.LastPricingDate
				)
			BEGIN
	 
 					SET @RevisionCostNumber = ISNULL(
							(
								SELECT MAX(Number) 
								FROM   [STC].[RevisionCost]
								WHERE FinancialPeriodID = @FinancialPeriodID
							),
							0
						)			
 					SET @RevisionCostID = ISNULL(
							(
								SELECT MAX(RevisionCostID) 
								FROM   [STC].[RevisionCost]
							),
							0
						)
					
					IF OBJECT_ID('tempdb..#RevisionCostItem2') IS NOT NULL
					drop table 	#RevisionCostItem2

					SELECT  DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostID AS [RevisionCostID],
							DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostNumber AS Number,st.branchid,
							ID,s.Fee,Amount,p.Description,
							Amount - case when Revision.RevisionPrice is not null then Revision.RevisionPrice else s.Price end [Deference]
						into #RevisionCostItem2	
					FROM stc.ReturnStockReceiptItem S
					join stc.ReturnStockReceipt h on h.ReturnStockReceiptID = s.ReturnStockReceiptID
					join stf.stock st on st.StockID = h.StockID
					join #BasePricingTemp P ON P.TableName = 'stc.ReturnStockReceiptItem' AND S.ReturnStockReceiptItemID = P.ID  
					LEFT JOIN (
							select  ROW_NUMBER() over(partition by ReturnStockReceiptItemID order by number desc) Rno,
									ReturnStockReceiptItemID,RevisionPrice from stc.RevisionCost h
							join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
							where ReturnStockReceiptItemID is not null and FinancialPeriodID = @FinancialPeriodID
							) Revision on Rno = 1 and Revision.ReturnStockReceiptItemID = s.ReturnStockReceiptItemID
					where S.Fee <> 0 
						and 
						((Revision.RevisionPrice is not null and Revision.RevisionPrice <> P.Amount) 
						or
						(Revision.RevisionPrice is  null and s.Price <> P.Amount))
						and h.FinancialPeriodID = @FinancialPeriodID
						and CalculatedRightNow = 1
						and h.Date <= p.LastPricingDate

					set identity_insert [STC].[RevisionCost] on
					INSERT INTO [STC].[RevisionCost] ([RevisionCostID],[Number], [Date], [AutoGenerated], [PreVoucherID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Type],BranchID)
					SELECT [RevisionCostID],Number, @PricingDate, 1, null, @FinancialPeriodID, 0, @userID, @CurrentDate, @userID, @CurrentDate, 2 ,branchid
					from #RevisionCostItem2
					group by [RevisionCostID],branchid,Number
					set identity_insert [STC].[RevisionCost] off


					INSERT INTO [STC].[RevisionCostItem]
							   ([RevisionCostID]
							   ,[StockReceiptItemID]
							   ,ReturnStockReceiptItemID
							   ,[ReturnedOutgoingItemID]
							   ,[OutgoingItemID]
							   ,[RevisionFee]
							   ,[RevisionPrice]
							   ,[Deference]
							   ,[Description]
							   ,[Description2]
							   ,[Version]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate])  
					SELECT  RevisionCostID,
							null,
							ID,
							null,
							null,
							p.Fee,
							Amount,
							Deference,
							p.Description,
							p.Description,
							0,
							@userID,
							@CurrentDate,
							@userID,
							@CurrentDate
					from #RevisionCostItem2 p

			END	
			end

			--** حواله
			begin	

			SET @Message  =  'اعمال محاسبات حواله ...'  + ' زمان: ' + cast(SYSDATETIME() as varchar(30))
			print @Message
			insert into STC.PricingStage select 'اعمال محاسبات حواله', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

			update stc.OutgoingItem
			set Fee   = (p.Amount / p.MainQuantity) ,
				Price = P.Amount
			from stc.OutgoingItem S
			join stc.Outgoing o on o.OutgoingID = s.OutgoingID
			join #BasePricingTemp P ON P.TableName = 'stc.OutgoingItem' AND S.OutgoingItemID = P.ID  
			WHERE  s.Fee = 0 
			and o.FinancialPeriodID = @FinancialPeriodID
			and CalculatedRightNow = 1
	
			;with temp as (
			SELECT i.OutgoingID, SUM(Price) Price
			FROM stc.OutgoingItem i
			JOIN stc.Outgoing h ON h.OutgoingID = i.OutgoingID
			WHERE h.FinancialPeriodID = @FinancialPeriodID
				group by i.OutgoingID )

			update v
			set TotalPrice = vi.Price
			from stc.Outgoing v
			join temp vi  on v.OutgoingID = vi.OutgoingID
	
			IF EXISTS (select s.OutgoingItemID
			from stc.OutgoingItem S
			join stc.Outgoing o on o.OutgoingID = s.OutgoingID
			join #BasePricingTemp P ON P.TableName = 'stc.OutgoingItem' AND S.OutgoingItemID = P.ID  
			LEFT JOIN (
				select  ROW_NUMBER() over(partition by OutgoingItemID order by number desc) Rno,
						OutgoingItemID,RevisionPrice from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where OutgoingItemID is not null and FinancialPeriodID = @FinancialPeriodID
				) Revision on Rno = 1 and Revision.OutgoingItemID = s.OutgoingItemID
			where  S.Fee > 0 
				and 
				((Revision.RevisionPrice is not null and Revision.RevisionPrice <> P.Amount) 
				or
				(Revision.RevisionPrice is  null and s.Price <> P.Amount))
				and o.FinancialPeriodID = @FinancialPeriodID
				and CalculatedRightNow = 1
				and o.Date <= LastPricingDate

				)
			BEGIN
	 
 					SET @RevisionCostNumber = ISNULL(
							(
								SELECT MAX(Number) 
								FROM   [STC].[RevisionCost]
								WHERE FinancialPeriodID = @FinancialPeriodID
							),
							0
						)			
 					SET @RevisionCostID = ISNULL(
							(
								SELECT MAX(RevisionCostID) 
								FROM   [STC].[RevisionCost]
							),
							0
						)
					
					IF OBJECT_ID('tempdb..#RevisionCostItem3') IS NOT NULL
					drop table 	#RevisionCostItem3				
		
					SELECT  DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostID AS [RevisionCostID],
							DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostNumber AS Number,st.branchid,
							ID,(p.Amount / p.MainQuantity) Fee,Amount,p.Description,
							Amount - case when Revision.RevisionPrice is not null then Revision.RevisionPrice else s.Price end [Deference]			
					into #RevisionCostItem3
					FROM stc.OutgoingItem S
					join stc.Outgoing o on o.OutgoingID = s.OutgoingID
					join stf.stock st on st.StockID = o.StockID
					join #BasePricingTemp P ON P.TableName = 'stc.OutgoingItem' AND S.OutgoingItemID = P.ID  
					LEFT JOIN (
							select  ROW_NUMBER() over(partition by OutgoingItemID order by number desc) Rno,
									OutgoingItemID,RevisionPrice from stc.RevisionCost h
							join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
							where OutgoingItemID is not null and FinancialPeriodID = @FinancialPeriodID
							  ) Revision on Rno = 1 and Revision.OutgoingItemID = s.OutgoingItemID
					where  S.Fee > 0 
						and 
						((Revision.RevisionPrice is not null and Revision.RevisionPrice <> P.Amount) 
						or
						(Revision.RevisionPrice is  null and s.Price <> P.Amount))
						and o.FinancialPeriodID = @FinancialPeriodID
						and CalculatedRightNow = 1
						and o.Date <= LastPricingDate

					set identity_insert [STC].[RevisionCost] on
					INSERT INTO [STC].[RevisionCost] ([RevisionCostID],[Number], [Date], [AutoGenerated], [PreVoucherID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Type],BranchID)
					SELECT [RevisionCostID],Number, @PricingDate, 1, null, @FinancialPeriodID, 0, @userID, @CurrentDate, @userID, @CurrentDate, 3 ,branchid
					from #RevisionCostItem3
					group by [RevisionCostID],branchid,Number
					set identity_insert [STC].[RevisionCost] off
	

					INSERT INTO [STC].[RevisionCostItem]
							   ([RevisionCostID]
							   ,[StockReceiptItemID]
							   ,[ReturnStockReceiptItemID]
							   ,[ReturnedOutgoingItemID]
							   ,[OutgoingItemID]
							   ,[RevisionFee]
							   ,[RevisionPrice]
							   ,[Deference]
							   ,[Description]
							   ,[Description2]
							   ,[Version]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate])  
					SELECT  RevisionCostID,
							null,
							null,
							null,
							ID,
							P.Fee,
							Amount,
							Deference,
							p.Description,
							p.Description,
							0,
							@userID,
							@CurrentDate,
							@userID,
							@CurrentDate
					from #RevisionCostItem3 p
	  
			END




			end

			--** برگشت حواله
			begin

			SET @Message  =  'اعمال محاسبات برگشت حواله ...'  + ' زمان: ' + cast(SYSDATETIME() as varchar(30))
			print @Message
			insert into STC.PricingStage select 'اعمال محاسبات برگشت حواله', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())

			update s
			set Fee = P.Amount / P.MainQuantity,
				Price = P.Amount,
				[AutoPriced] = 1
			from stc.ReturnedOutgoingItem S
			join #BasePricingTemp P ON P.TableName = 'stc.ReturnedOutgoingItem' 
									AND S.ReturnedOutgoingItemID = P.ID  
			where p.TypeInFee <> 1 
			and S.Fee = 0 
			and CalculatedRightNow = 1


			;with temp as (
			SELECT i.ReturnedOutgoingID, SUM(Price) Price
			FROM stc.ReturnedOutgoingItem i
			JOIN stc.ReturnedOutgoing h ON h.ReturnedOutgoingID = i.ReturnedOutgoingID
			WHERE h.FinancialPeriodID = @FinancialPeriodID
				group by i.ReturnedOutgoingID )

			update v
			set TotalPrice = vi.Price
			from stc.ReturnedOutgoing v
			join temp vi  on v.ReturnedOutgoingID = vi.ReturnedOutgoingID

			IF EXISTS (
					select s.ReturnedOutgoingItemID
					from stc.ReturnedOutgoingItem S
					join stc.ReturnedOutgoing h on h.ReturnedOutgoingID = s.ReturnedOutgoingID
					join #BasePricingTemp P ON P.TableName = 'stc.ReturnedOutgoingItem' AND S.ReturnedOutgoingItemID = P.ID  
					LEFT JOIN (
								select  ROW_NUMBER() over(partition by ReturnedOutgoingItemID order by number desc) Rno,
										ReturnedOutgoingItemID,RevisionPrice from stc.RevisionCost h
								join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
								where ReturnedOutgoingItemID is not null and FinancialPeriodID = @FinancialPeriodID
							  ) Revision on Rno = 1 and Revision.ReturnedOutgoingItemID = s.ReturnedOutgoingItemID
					where p.TypeInFee <> 1 
						and S.Fee <> 0 
						and 
						(
							(Revision.RevisionPrice is not null and Revision.RevisionPrice <> Amount) 
							or
							(Revision.RevisionPrice is  null and s.Price <> Amount)
						)
						and CalculatedRightNow = 1
						and h.Date <= LastPricingDate
				)
			BEGIN
	
 					SET @RevisionCostNumber = ISNULL(
							(
								SELECT MAX(Number) 
								FROM   [STC].[RevisionCost]
								WHERE FinancialPeriodID = @FinancialPeriodID
							),
							0
						)			
 					SET @RevisionCostID = ISNULL(
							(
								SELECT MAX(RevisionCostID) 
								FROM   [STC].[RevisionCost]
							),
							0
						)
					
					IF OBJECT_ID('tempdb..#RevisionCostItem4') IS NOT NULL
					drop table 	#RevisionCostItem4				
		
					SELECT  DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostID AS [RevisionCostID],
							DENSE_RANK() OVER (ORDER BY st.branchid)+@RevisionCostNumber AS Number,		st.branchid,
							s.ReturnedOutgoingItemID,(p.Amount / p.MainQuantity) Fee,Amount,p.Description,
							Amount -  case when Revision.RevisionPrice is not null then Revision.RevisionPrice else s.Price end [Deference]
					into #RevisionCostItem4
					FROM stc.ReturnedOutgoingItem S
					join stc.ReturnedOutgoing h on h.ReturnedOutgoingID = s.ReturnedOutgoingID
					join stf.stock st on st.StockID = h.StockID
					join #BasePricingTemp P ON P.TableName = 'stc.ReturnedOutgoingItem' AND S.ReturnedOutgoingItemID = P.ID  
					LEFT JOIN (
						select  ROW_NUMBER() over(partition by ReturnedOutgoingItemID order by number desc) Rno,
								ReturnedOutgoingItemID,RevisionPrice from stc.RevisionCost h
						join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
						where ReturnedOutgoingItemID is not null and FinancialPeriodID = @FinancialPeriodID
							  ) Revision on Rno = 1 and Revision.ReturnedOutgoingItemID = s.ReturnedOutgoingItemID
					where p.TypeInFee <> 1 
						and S.Fee <> 0
						and 
						(
							(Revision.RevisionPrice is not null and Revision.RevisionPrice <> Amount) 
							or
							(Revision.RevisionPrice is  null and s.Price <> Amount)
						)
						and CalculatedRightNow = 1
						and h.Date <= LastPricingDate
			

					set identity_insert [STC].[RevisionCost] on
					INSERT INTO [STC].[RevisionCost] ([RevisionCostID],[Number], [Date], [AutoGenerated], [PreVoucherID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Type],BranchID)
					SELECT [RevisionCostID],Number, @PricingDate, 1, null, @FinancialPeriodID, 0, @userID, @CurrentDate, @userID, @CurrentDate, 1,branchid
					from #RevisionCostItem4
					group by [RevisionCostID],branchid,Number
					set identity_insert [STC].[RevisionCost] off

					INSERT INTO [STC].[RevisionCostItem]
							   ([RevisionCostID]
							   ,[StockReceiptItemID]
							   ,[ReturnStockReceiptItemID]
							   ,[ReturnedOutgoingItemID]
							   ,[OutgoingItemID]
							   ,[RevisionFee]
							   ,[RevisionPrice]
							   ,[Deference]
							   ,[Description]
							   ,[Description2]
							   ,[Version]
							   ,[Creator]
							   ,[CreationDate]
							   ,[LastEditor]
							   ,[LastEditionDate])  
					SELECT  RevisionCostID,
							null,
							null,
							ReturnedOutgoingItemID,
							null,
							p.Fee,
							Amount,
							Deference,
							p.Description,
							p.Description,
							0,
							@userID,
							@CurrentDate,
							@userID,
							@CurrentDate
					from #RevisionCostItem4 p

			END


			end


		END

	/*بروز رسانی تاریخچه*/
	begin

	SET @Message  =  'بروز رسانی تاریخچه قیمت گذاری ... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'بروز رسانی تاریخچه قیمت گذاری', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())


	select @ConditionalInnerJoin  =  ' on Selected.stuffid = p.stuffid AND Selected.StockID = p.StockID '
						 + STUFF((SELECT distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or p.' +
						 QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
								FROM STF.Trace where PricingBase = 1
								FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   

	if(@ConditionalInnerJoin is null)						   
	set @ConditionalInnerJoin = ' on Selected.stuffid = p.stuffid  AND Selected.StockID = p.StockID ' 	

 
		set @Query = N'select Selected.id,isnull(PricingItemID , 0) PricingItemID into '+@PricingItemTemp_Update+'
						from  '+@Selected+' Selected left join (select  i.PricingItemID,
										Case When DLID IS NOT NULL  THEN cast (DLID as nvarchar(max))
											 When TraceItemID IS NOT NULL  THEN cast (TraceItemID as nvarchar(max))
											 else Value end Value,
										TraceID,stuffid,stockid
								from stc.PricingItem i
								left join 	 stc.PricingItemTrace tr  on tr.PricingItemID = i.PricingItemID
								) x
								pivot 
								(
									 max(Value)
									for TraceID in (' + @Columns + ')
								) p '+@ConditionalInnerJoin

	EXECUTE sp_executeSQL     
				@Query
			
			SET @Query = N'
	update p
	set LastPricingDate = @pPricingDate,LastEditionDate = GETDATE(),version = version + 1
	from stc.PricingItem p 
	join '+@PricingItemTemp_Update+' T on p.PricingItemID = T.PricingItemID'
	SET @Param = N'@pPricingDate Date'
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pPricingDate = @PricingDate

	IF EXISTS (SELECT traceid FROM stf.Trace t WHERE t.PricingBase = 1)
	BEGIN
		DECLARE @MaxPricingItemID INT;
		SET @MaxPricingItemID =ISNULL((SELECT MAX(PricingItemID)
									FROM stc.PricingItem ),0)
	
		IF OBJECT_ID('PricingItemTemporary') IS Not NULL
		DROP TABLE PricingItemTemporary
		
		create TABLE PricingItemTemporary
		(
		PricingItemID INT,
		STUFFID INT,
		StockId INT
		)
	
		create TABLE #PricingItemTraceTemporary
		(
			PricingItemID INT,
			TraceID INT,
			DlIDorValue NVARCHAR(MAX),
			DLID INT,
			Value NVARCHAR(MAX),
			TraceItemID INT	
		)


		SET @Query = N'
	INSERT INTO PricingItemTemporary (PricingItemID,STUFFID,StockId)
	SELECT  @pMaxPricingItemID + s.id,
			s.STUFFID,
			[StockID] 
	FROM '+@Selected+' s 
	left join  '+@PricingItemTemp_Update+' T on T.id = s.id
	where T.PricingItemID is null or T.PricingItemID = 0
	'
	SET @Param = N'@pMaxPricingItemID int'
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pMaxPricingItemID = @MaxPricingItemID

	SET @Query=N'
	INSERT INTO  #PricingItemTraceTemporary (PricingItemID,TraceID,DlIDorValue)
	SELECT @pMaxPricingItemID + id,TraceID,DlIDorValue FROM 
	(
		SELECT s.id '+@ColumnsInSelectList+' 
	FROM '+@Selected+' s 
	left join '+@PricingItemTemp_Update+' T on T.id = s.id
	where T.PricingItemID is null or T.PricingItemID = 0
	) p UNPIVOT
	(	
		DlIDorValue FOR TraceID IN ('+@Columns+')
	)AS unpvt'



	SET @Param = N'@pMaxPricingItemID INT'
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pMaxPricingItemID = @MaxPricingItemID
           

	UPDATE #PricingItemTraceTemporary
	SET DLID = CASE WHEN t.DlTypeID IS NOT NULL AND  t.AccountLevelTypeID = 1 THEN DlIDorValue ELSE NULL END,
		VALUE = CASE WHEN t.DlTypeID IS NOT NULL AND  t.AccountLevelTypeID = 6 AND  t.AccountLevelTypeID = 1 THEN NULL ELSE DlIDorValue END,
		TraceItemID = CASE WHEN t.AccountLevelTypeID = 6 THEN DlIDorValue ELSE NULL END 
	FROM #PricingItemTraceTemporary p
	left JOIN stf.Trace t ON p.TraceID = t.TraceID

	
	  SET IDENTITY_INSERT [STC].[PricingItem] ON  
  
	  INSERT INTO [STC].[PricingItem]
			   (PricingItemID
			   ,[StuffID]
			   ,[StockID]
			   ,[LastPricingDate]
			   ,[Creator]
			   ,[CreationDate]
			   ,[LastEditor]
			   ,[LastEditionDate]
			   ,[version])
	SELECT PricingItemID,[StuffID],[StockID],@PricingDate,@userID,@CurrentDate,@userID,@CurrentDate,0 
	FROM PricingItemTemporary


	  SET IDENTITY_INSERT [STC].[PricingItem] OFF  
	
		INSERT INTO [STC].[PricingItemTrace]
			   ([PricingItemID]
			   ,[TraceID]
			   ,[Value]
			   ,[DlID]
			   ,[Creator]
			   ,[CreationDate]
			   ,[LastEditor]
			   ,[LastEditionDate]
			   ,[version],
			   [TraceItemID])
	   SELECT PricingItemID,TraceID,Value,DlID,@userID,@CurrentDate,@userID,@CurrentDate,0 ,TraceItemID
		FROM #PricingItemTraceTemporary        
	END
	ELSE
	BEGIN

	SET @Query = N'
		INSERT INTO [STC].[PricingItem]
		   ([StuffID]
		   ,[StockID]
		   ,[LastPricingDate]
		   ,[Creator]
		   ,[CreationDate]
		   ,[LastEditor]
		   ,[LastEditionDate]
		   ,[version])
		SELECT  [StuffID],
				[StockID],
				@pPricingDate,
				@puserID,
				@pCurrentDate,
				@puserID,
				@pCurrentDate,
				0 
		FROM '+@Selected+' s 
	left join '+@PricingItemTemp_Update+' T on T.id = s.id
	where T.PricingItemID is null or T.PricingItemID = 0'

	SET @Param = N'@pPricingDate Date,@puserID int,@pCurrentDate Date'
	EXECUTE sp_executeSQL     
				@Query,
				@Param,
				@pPricingDate = @PricingDate,
				@puserID = @userID,
				@pCurrentDate = @CurrentDate

	END


	end

	/*قیمت گذاری رسید دارایی*/
	begin

	update b set BaseValue = a.Amount
	from #BasePricingTemp a
	join ast.Creation b on a.TableName = 'stc.OutgoingItem' and a.ID = b.OutgoingItemID
	where 	b.BaseValue = 0




	end

		 update cfg.Configuration 
		 set ConfigValue = 0
		 where ConfigKey = 'DoPricing'

	SET @Message  =  'پایان پروسه قیمت گذاری ... زمان: ' + cast(SYSDATETIME() as varchar(30))
	print @Message
	insert into STC.PricingStage select 'پایان پروسه قیمت گذاری', CONVERT (DATE, SYSDATETIME ()), CONVERT (Time, SYSDATETIME ())
	END TRY
	BEGIN CATCH

		 update cfg.Configuration 
		 set ConfigValue = 0
		 where ConfigKey = 'DoPricing'

			DECLARE @ErrorMessage NVARCHAR(4000)
					,@ErrorSeverity INT
					, @ErrorState INT;

			SELECT 
				@ErrorMessage = ERROR_MESSAGE(),
				@ErrorSeverity = ERROR_SEVERITY(),
				@ErrorState = ERROR_STATE();

	
		RAISERROR ( @ErrorMessage, 
					@ErrorSeverity, 
					@ErrorState
				  );
				   
				   
	END CATCH
	end
	else
	raiserror('صبرنمایید تا پروسه در حال اجرای قیمت گذاری اجرا شود سپس اقدام نمایید.',16,13)
