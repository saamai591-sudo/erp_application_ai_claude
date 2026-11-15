CREATE   PROC PRM.spCostCalculationRemove
(@CostCalculationPeriodID INT)
AS 
SET NOCOUNT ON

	if not exists (
	select 1 from PRM.CostCalculation
	where CostCalculationPeriodID = @CostCalculationPeriodID
	)
	begin
		raiserror('دوره انتخاب شده فاقد محاسبه بهای تمام شده است.',16,12)
		return
	end

		if  exists (
	select 1 from PRM.CostCalculation
	where CostCalculationPeriodID = @CostCalculationPeriodID
	and VoucherID is not null
	)
	begin
		raiserror('دوره انتخاب شده دارای سند حسابداری است.',16,12)
		return
	end



	DECLARE @Query NVARCHAR(MAX),
			@Columns NVARCHAR(MAX),
			@ConditionalInnerJoin NVARCHAR(MAX),
			@PricingType TINYINT,
			@FinancialPeriodID int,
			@EndDate Date,
			@StartDate Date,
			@ValidationDesc VARCHAR(MAX)

	select  @FinancialPeriodID = FinancialPeriodID,
			@EndDate = EndDate,
			@StartDate = StartDate
	from prm.CostCalculationPeriod
	where CostCalculationPeriodID = @CostCalculationPeriodID

	if exists(select 1 from PRM.CostCalculation c
	          join PRM.CostCalculationPeriod p on c.CostCalculationPeriodID = p.CostCalculationPeriodID
	          where FinancialPeriodID = @FinancialPeriodID and EndDate > @EndDate          
			 )
	begin
		raiserror('DeleteCalculationOnlyPossibleForLastCalculatedFinancialYear',16,12)
		return
	end

		SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(al.TraceID)
					   FROM   stf.Trace  al where IsEffectiveInProduceCost = 1 and PricingBase = 1           
					   FOR XML PATH(''),TYPE).value('.', 'NVARCHAR(MAX)'),1,1,'')
	                      
		IF(@Columns is null)								   
			SET @Columns = '[-1]'	

	select @ConditionalInnerJoin  =  STUFF((SELECT  distinct ' AND (Selected.'+ QUOTENAME(TraceID)+' is null or M.' +
													QUOTENAME(TraceID)+'= Selected.' + QUOTENAME(TraceID)+')'
											FROM STF.Trace where IsEffectiveInProduceCost = 1 and PricingBase = 1           
									FOR XML PATH(''), TYPE
									).value('.', 'NVARCHAR(MAX)'),1,1,'')
								   
	if(@ConditionalInnerJoin is null)
	set @ConditionalInnerJoin =   ''

	IF OBJECT_ID('Temp') IS Not NULL
	DROP TABLE Temp
	
	create TABLE  Temp
	(
		Position INT,
		ID INT	
	) 

	set @Query = N'
	INSERT INTO Temp(Position,ID)
	SELECT Selected.PeriodProductionID Position,M.PricingItemID 
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
		WHERE  [LastPricingDate] between 	@StartDate and @EndDate
	) x
	pivot 
	(
		 max(Value)
		for TraceID in (' + @Columns + ')
	) M 	
	join [PRM].[PeriodProduction] Selected on Selected.stuffid = M.stuffid
	  '+@ConditionalInnerJoin+'
	join stf.stuffdetail stfd on stfd.stuffid = Selected.stuffid
	JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = stfd.StuffAccountGroupID
	where [CostCalculationPeriodID] = @CostCalculationPeriodID 
	and SAG.StuffDetailType = 2'

	EXECUTE sp_executeSQL     
			@Query,
			N'@CostCalculationPeriodID INT,@StartDate Date, @EndDate Date',
			@CostCalculationPeriodID = @CostCalculationPeriodID,
			@StartDate = @StartDate,
			@EndDate = @EndDate

	if exists (select * from Temp)
	begin
	raiserror('ابتدا قیمت گذاری محصولات تولیدی برگشت داده شود.',16,13)
	return
	end


	select sri.StockReceiptItemID,StockID,sri.StuffID,sag.StuffDetailType,PreVoucherID
	into #Temp1
	from stc.StockReceipt sr
	join stc.StockReceiptItem sri on sr.StockReceiptID = sri.StockReceiptID
	join stf.stuffDetail sd on sd.StuffID = sri.StuffID
	JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
	join cfg.CostCenter cc on cc.DlID = sr.DeliverDlID
	join prm.PeriodProduction pp on pp.CostCenterId = cc.CostCenterID and sri.stuffid = pp.stuffid
	where sr.Date between @StartDate and @EndDate

	if exists (select * from #Temp1 where PreVoucherID is not null)
	begin
	raiserror('سند و پیش نویس رسیدهای تولید را حذف نمایید.',16,12)
	return
	end

	 declare @selItems varchar(max)

	 SELECT @selItems = STUFF(
			(
				SELECT '|'+cast(StuffID as varchar(100))+'$'+cast(StockID as varchar(100))+'#null'
				from
				(
				select StuffID
				from #Temp1
				where StuffDetailType = 1
				group by StuffID
				)a
				cross join stf.stock
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');
	select @selItems

	if @selItems is not null
	begin
		set @ValidationDesc = null
		Exec STC.sp_UndoPricingValidation @StartDate,@selItems,@FinancialPeriodID

		IF @ValidationDesc is null
		begin
			BEGIN TRY  
			Exec STC.sp_UndoPricing @StartDate,@selItems,@FinancialPeriodID
						END TRY  
			BEGIN CATCH  
					DECLARE @ErrorMessage NVARCHAR(4000)
							,@ErrorSeverity INT
							, @ErrorState INT;

					SELECT 
						@ErrorMessage = ERROR_MESSAGE(),
						@ErrorSeverity = ERROR_SEVERITY(),
						@ErrorState = ERROR_STATE();

	
					RAISERROR (@ErrorMessage, -- Message text.
								   @ErrorSeverity, -- Severity.
								   @ErrorState -- State.
								   );
					RETURN;
			END CATCH  
		end
		else 
		begin
			
			set @ValidationDesc = 'برگشت قیمت گذاری اسناد انبار برای برخی از نیمه‌ساخته‌ها دارای اشکالات زیر است:'+
								  char(13)+char(10) + @ValidationDesc
			raiserror(@ValidationDesc,16,13)
			return;
		end
	end

	update sri
	set Fee = 0, 
		Price = 0
	from stc.StockReceiptItem sri
	join #temp1 t on t.StockReceiptItemID = sri.StockReceiptItemID

	; with c as
	(select StockReceiptID,sum(sri.Price) TotalPrice
	from stc.StockReceiptItem sri
	join #temp1 t on t.StockReceiptItemID = sri.StockReceiptItemID
	group by StockReceiptID
	)
	update a
	set TotalInvoicePrice = c.TotalPrice
	from stc.StockReceipt a
	join c on a.StockReceiptID = c.StockReceiptID

	delete a 
	from prm.[PeriodProductionOtherCost] a
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from prm.OtherCost 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption_ProductionDelivery] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption_LastWorkingInventory] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption_ReturnedOutgoing] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption_Outgoing] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	delete from [PRM].[Consumption_FirstWorkingInventory] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID


	delete a from [PRM].[PeriodProductionBOM] a
	where [CostCalculationPeriodID] = @CostCalculationPeriodID 

	delete from [PRM].[PeriodProduction] 
	where [CostCalculationPeriodID] = @CostCalculationPeriodID

	update wii
	set price = 0
	from PRM.WorkingInventoryItem wii
	join PRM.WorkingInventory wi on wi.WorkingInventoryID = wii.WorkingInventoryID
	join stf.StuffDetail sd on sd.StuffId = wii.StuffID
	JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
	where wi.CostCalculationPeriodID = @CostCalculationPeriodID
	and wi.[Type] = 1
	and SAG.StuffDetailType in (0,1)


	delete from PRM.CostCalculation
	where CostCalculationPeriodID = @CostCalculationPeriodID
