
CREATE   PROC PRM.spCostCalculation	(
	@CostCalculationPeriodID INT
)
--WITH ENCRYPTION, 	RECOMPILE
AS 
BEGIN
	SET NOCOUNT ON
    
	DECLARE @Message NVARCHAR(200),
	@PricingValidationTable NVARCHAR(MAX)
	DECLARE @error TABLE (
        [Message] NVARCHAR(MAX) ,
        IsDetail BIT
	)
	
	
	set @PricingValidationTable = cfg.getTempTableName(1)

	IF (SELECT ConfigValue FROM cfg.Configuration WHERE ConfigKey = 'CostCalculationIsRunning') = 1
	BEGIN
		SET @message = N'ProductionManagement.Messages.WaitUntilEndOtherCalculation';
		INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
		SELECT * from @error;
		RETURN;
	END 

	BEGIN TRY
		UPDATE CFG.Configuration 
		SET ConfigValue = 1
		WHERE ConfigKey = 'CostCalculationIsRunning'

		IF EXISTS (SELECT 1 FROM  [PRM].CostCalculation 
			WHERE CostCalculationPeriodID = @CostCalculationPeriodID)
		BEGIN
			SET @message = N'ProductionManagement.Messages.CalculationIssued';
			INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
			SELECT * FROM @error;
			RETURN;
		END


		IF EXISTS (
select 1 from PRM.vwSlInCostCalculationPeriod

where CostCalculationPeriodID =@CostCalculationPeriodID
group by slid
having count (*)>1) 
		BEGIN
			SET @message = N'ProductionManagement.Messages.DuplicateSlsInDefferentStructures';
			INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
			
			INSERT @error ([Message] , IsDetail) 
			select 'ProductionManagement.Messages.DuplicateSlsInDefferentStructures^'+va.SlCode+N' '+va.SlTitle,1 from PRM.vwSlInCostCalculationPeriod a
			join acc.vwaccounts va on a.SlID = va.slid
			where CostCalculationPeriodID =@CostCalculationPeriodID
			group by va.SlCode,va.SlTitle
			having count (*)>1;

			SELECT * FROM @error;
			RETURN;
		END




		DECLARE @FinancialPeriodID int,
				@EndDate Date,
				@StartDate Date,
				@ErrorMessage NVARCHAR(4000),
				@ErrorSeverity INT,
				@ErrorState INT,
				@Detail NVARCHAR(MAX)

			SELECT  @FinancialPeriodID = FinancialPeriodID,
					@EndDate = EndDate,
					@StartDate = StartDate
			FROM  prm.CostCalculationPeriod
			WHERE CostCalculationPeriodID = @CostCalculationPeriodID

			exec PRM.SpCreateDataStructureForCostCalculation

			INSERT INTO @error
			exec PRM.SpGetPeriodProduction @CostCalculationPeriodID

			if EXISTS ( SELECT 1 FROM @error )
			BEGIN
				SELECT * FROM @error
				RETURN;
			END
		
			exec PRM.SpGetPeriodProductionBOM @CostCalculationPeriodID

			-- =====================================================================================
			-- کنترل: کالاهای نیمه‌ساخته‌ای (StuffDetailType=1) که طی PRM.ProductionDelivery
			-- به یک مرکز هزینه تحویل داده شده‌اند، ولی هیچ ردیفی در فرمول تولید (BOM) همان
			-- مرکز هزینه برای مصرف آن کالا وجود ندارد. بدون این کنترل، هزینه‌ی این تحویل هیچ‌وقت
			-- در PeriodProductionBOM لحاظ نمی‌شود چون UPDATE داخل SpGetSemiConsumption بر پایه‌ی
			-- JOIN با ردیف موجود BOM است و برای این کالاها ردیفی برای JOIN شدن وجود ندارد.
			-- =====================================================================================
			DROP TABLE IF EXISTS #OrphanDeliveries

			CREATE TABLE #OrphanDeliveries
			(
				StuffID INT,
				CostCenterId INT
			)

			INSERT INTO #OrphanDeliveries
			SELECT DISTINCT pdi.StuffID, pd.DeliverCostCenterId
			FROM PRM.ProductionDelivery pd
			JOIN PRM.ProductionDeliveryItem pdi ON pd.ProductionDeliveryID = pdi.ProductionDeliveryID
			JOIN stf.StuffDetail sd ON sd.StuffID = pdi.StuffID
			JOIN stf.StuffAccountGroup sag ON sag.StuffAccountGroupID = sd.StuffAccountGroupID
			WHERE pd.Date BETWEEN @StartDate AND @EndDate
			  AND sag.StuffDetailType = 1
			  AND NOT EXISTS (
				  SELECT 1 FROM PRM.PeriodProductionBOM bom
				  WHERE bom.CostCalculationPeriodID = @CostCalculationPeriodID
					AND bom.StuffID = pdi.StuffID
					AND bom.CostCenterId = pd.DeliverCostCenterId
			  )

			IF EXISTS (SELECT 1 FROM #OrphanDeliveries)
			BEGIN
				SET @message = N'ProductionManagement.Messages.SemiStuffDeliveredWithoutConsumingFormula';
				INSERT @error ([Message], IsDetail) VALUES (@message, 0);

				INSERT @error ([Message], IsDetail)
				SELECT N'ProductionManagement.Messages.StuffInCostCenter^' + b.code + N',' + c.Title, 1
				FROM #OrphanDeliveries a
					JOIN stf.vwstuff b ON a.stuffid = b.stuffid
					JOIN cfg.costcenter c ON c.CostCenterID = a.CostCenterId

				SELECT * FROM @error;
				RETURN;
			END
			-- =====================================================================================
			-- پایان کنترل
			-- =====================================================================================
						
			INSERT @error
			exec PRM.spGetOtherCost @CostCalculationPeriodID
			
			IF EXISTS(SELECT 1 FROM @error)
			BEGIN
				SELECT * FROM @error
				RETURN 
			END 

			INSERT @error
			exec PRM.SpGetMaterialConsumption @CostCalculationPeriodID

			IF EXISTS(SELECT 1 FROM @error)
			BEGIN
				SELECT * FROM @error
				RETURN 
			END 
			
			DECLARE @query NVARCHAR(MAX),
					@PjoinColumns nvarchar(max),
					@CjoinColumns nvarchar(max),
					@Columns NVARCHAR(MAX),
					@SelectColumns NVARCHAR(MAX),
					@CGroupByColumns NVARCHAR(MAX)

			SELECT @CjoinColumns = STUFF(
						(
							SELECT ' AND ISNULL($.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(@.' + QUOTENAME(t.TraceID) + ', 0) '
							FROM   STF.Trace AS t
							where IsEffectiveInProduceCost = 1
							ORDER BY
									t.TraceID
									FOR XML PATH('')
						),1,0,'');

			IF @CjoinColumns IS NULL
				SET @CjoinColumns = N'';

			SELECT @PjoinColumns = STUFF(
						(
							SELECT ' AND ISNULL($.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(@.' + QUOTENAME(t.TraceID) + ', 0) '
							FROM   STF.Trace AS t
							where IsEffectiveInProduceCost = 1
							ORDER BY
									t.TraceID
									FOR XML PATH('')
						),1,0,'');

			IF @PjoinColumns IS NULL
				SET @PjoinColumns = N'';

			SELECT @Columns = STUFF(
			(
				SELECT DISTINCT
						',' + QUOTENAME(TraceID)
				FROM STF.Trace
				where IsEffectiveInProduceCost = 1
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,1  ,'');

			IF (@Columns IS NULL)
				SET @Columns = N'[-1]';

			SELECT @SelectColumns = STUFF(
			(
				SELECT DISTINCT
					   ',@.' + QUOTENAME(TraceID)
				FROM STF.Trace
				where IsEffectiveInProduceCost = 1
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

			IF (@SelectColumns IS NULL)
				SET @SelectColumns = N'';

			SELECT @CGroupByColumns = STUFF(
			(
				SELECT DISTINCT
					   ',@.' + QUOTENAME(TraceID)
				FROM STF.Trace
				where IsEffectiveInConsumeCost = 1
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

			IF (@CGroupByColumns IS NULL)
				SET @CGroupByColumns = N'';

			DROP TABLE IF EXISTS #NoStockPricing

			create table #NoStockPricing
			( 
				StuffID int,
				CostCenterId int
			)

			insert into #NoStockPricing
			select a.StuffID,a.CostCenterId
			from(
				select StuffID,CostCenterId from prm.Consumption_Outgoing 
				where Price = 0 and StuffDetailType <> 9
				and CostCalculationPeriodID = @CostCalculationPeriodID
				union all
				select StuffID,CostCenterId from prm.Consumption_ReturnedOutgoing 
				where Price = 0 and StuffDetailType <> 9
				and CostCalculationPeriodID = @CostCalculationPeriodID
				)a
				group by StuffID,CostCenterId

			IF EXISTS (SELECT 1 FROM #NOSTOCKPRICING)
			BEGIN
				SET @message = N'ProductionManagement.Messages.SomeStuffsWithoutPricing';
				INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

				INSERT @error ([Message] , IsDetail)
				select N'ProductionManagement.Messages.StuffInCostCenter^'+b.code+N','+c.Title , 1
				from #NoStockPricing a
					join stf.vwstuff b on a.stuffid = b.stuffid
					join cfg.costcenter c on c.CostCenterID = a.CostCenterId
				SELECT * from @error;
				RETURN;
			END

			select @query = N'
				with CTE as
				(
				select  PeriodProductionBOMID,
						Quantity * ConsumptionRate StandardCost,
						convert (float ,Quantity) / convert (float ,sum(Quantity) over(partition by BOM.CostCenterId,BOM.StuffID'+REPLACE(@CGroupByColumns,'@','BOM')+') )
							* Consumption.DeviationCost [DeviationShare]
				from PRM.PeriodProductionBOM BOM
				join 
				(select *
				from PRM.Consumption a
				where a.CostCalculationPeriodID = @CostCalculationPeriodID
				)Consumption on Consumption.CostCenterId = BOM.CostCenterId
									and Consumption.StuffID = BOM.StuffID
									'+REPLACE(REPLACE(@CjoinColumns,N'@',N'Consumption'),N'$',N'BOM')+'
				where BOM.CostCalculationPeriodID = @CostCalculationPeriodID
				)
				update BOM
				set [StandardCost] = ROUND(CTE.StandardCost,0),
					[DeviationShare] = ROUND(CTE.DeviationShare,0)
				from PRM.PeriodProductionBOM BOM
				join CTE on CTE.PeriodProductionBOMID = BOM.PeriodProductionBOMID
				'
			EXECUTE sp_executesql   @Query,
								  N'@CostCalculationPeriodID int',
									@CostCalculationPeriodID =  @CostCalculationPeriodID;

			update c 
			set DeviationShare = c.DeviationShare - diff
				from
				(
					select  ROW_NUMBER() over(Partition By CostCenterId,StuffID order by DeviationShare desc) Rno,
							PeriodProductionBOMID,
							CostCenterId,
							StuffID
					from [PRM].PeriodProductionBOM
					where CostCalculationPeriodID = @CostCalculationPeriodID
				)a
				join
				(
					select a.StuffID,a.CostCenterId,b.Cost,a.Price - b.Cost diff 
					from prm.Consumption a
					join(
						select StuffID,CostCenterId,sum(Cost) Cost
						from [PRM].PeriodProductionBOM
						where CostCalculationPeriodID = @CostCalculationPeriodID
						group by StuffID,CostCenterId
						)b
					on a.CostCenterId = b.CostCenterId and a.StuffID = b.StuffID
					where CostCalculationPeriodID = @CostCalculationPeriodID
				)b on a.StuffID = b.StuffID and a.CostCenterId = b.CostCenterId
				join [PRM].PeriodProductionBOM c on c.PeriodProductionBOMID = a.PeriodProductionBOMID
				where a.Rno = 1
				and b.diff <> 0

			declare @AlterTable nvarchar(max)
			SELECT @AlterTable = STUFF(
			(
				SELECT DISTINCT
						' alter table @ add ' + QUOTENAME(TraceID)+' nvarchar(1024)'
				FROM STF.Trace
				where IsEffectiveInProduceCost = 1
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,0  ,'');

			CREATE TABLE #RedeayToCalculateFee
			(
				PeriodProductionID int,
				CostCenterId int,
				StuffID int
			);

			CREATE TABLE #RedeayToCalculateAverage
			(
				CostCenterId int,
				StuffID int,
				Total Decimal(36,10),
				Average Decimal(36,10)
			);

			CREATE TABLE #CostCalculationDiff
			(
				CostCenterId int,
				StuffID int,
				Diff Decimal(36,10)			
			)

			IF (@AlterTable IS NOT NULL)
			BEGIN
				SET @query = replace(@AlterTable,N'@',N'#RedeayToCalculateFee')
				EXEC(@query);

				SET @query = replace(@AlterTable,N'@',N'#RedeayToCalculateAverage')
				EXEC(@query);
			END

			CREATE TABLE #RedeayToUpdateDocuments
			(
				ID int identity(1,1) not null,
				DocumentName varchar(256),
				DocumentID int,
				Price Decimal(36,10),
				StockID int,
				CostCenterID int,
				StuffID int,
				StuffDetailType TinyInt
			);

			Declare @LoopNumber int = 0
	
			while exists (
							select PeriodProductionID
							from PRM.PeriodProduction pp
							where pp.CostCalculationPeriodID = @CostCalculationPeriodID
							and pp.Fee = 0
						 )
			begin

			set @LoopNumber = @LoopNumber + 1
			--print '@LoopNumber = '
			--print @LoopNumber

			truncate table #RedeayToCalculateFee;
			truncate table #RedeayToCalculateAverage
			truncate table #RedeayToUpdateDocuments

			set @query = N'
			insert into #RedeayToCalculateFee
			select PeriodProductionID,CostCenterId,stuffid'+ REPLACE(@SelectColumns,N'@',N'pp')+'
			from PRM.PeriodProduction pp
			where pp.PeriodProductionID not in
										(
										select PeriodProductionID
										from PRM.PeriodProductionBOM BOM
										where Cost = 0 and StuffDetailType = 1
										and BOM.CostCalculationPeriodID = @CostCalculationPeriodID
										group by PeriodProductionID
										)
			and pp.CostCalculationPeriodID = @CostCalculationPeriodID
			and pp.Fee = 0'

			EXECUTE sp_executesql @Query,
								N'@CostCalculationPeriodID int',
									@CostCalculationPeriodID =  @CostCalculationPeriodID
			
			IF NOT EXISTS (SELECT 1 FROM #RedeayToCalculateFee)
			BEGIN
				SET @message = N'ProductionManagement.Messages.StuffsFormulaProblem';
				INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

				INSERT @error ([Message] , IsDetail)
				select N'ProductionManagement.Messages.StuffInCostCenterWithBom^'+b.code+N','+c.Title +N','+b1.code, 1
				from PRM.PeriodProduction a
					join stf.vwstuff b on a.stuffid = b.stuffid
					join cfg.costcenter c on c.CostCenterID = a.CostCenterId
					join prm.PeriodProductionBOM bom on bom.PeriodProductionID = a.PeriodProductionID
					join stf.vwstuff b1 on bom.stuffid = b1.stuffid
				where a.CostCalculationPeriodID = @CostCalculationPeriodID
					and a.Fee = 0
					and bom.cost = 0
					and bom.StuffDetailType <> 9
				SELECT * from @error;
				RETURN;
			END

			IF OBJECT_ID('tempdb..#NoConsumptionNoOtherCost') IS Not NULL
			DROP TABLE #NoConsumptionNoOtherCost
			
			create table #NoConsumptionNoOtherCost
			( 
			StuffID int,
			CostCenterId int
			)

			insert into #NoConsumptionNoOtherCost
			select pp.StuffID,pp.CostCenterId
			from PRM.PeriodProduction pp
			join #RedeayToCalculateFee t on t.PeriodProductionID = pp.PeriodProductionID
			left join
			(
			select PeriodProductionID,SUM(Cost) Cost
			from PRM.PeriodProductionBOM
			where CostCalculationPeriodID = @CostCalculationPeriodID
			group by PeriodProductionID
			)bom on bom.PeriodProductionID = pp.PeriodProductionID
			left join
			(
			select PeriodProductionID,SUM(ShareOfCost) Cost
			from PRM.[PeriodProductionOtherCost]
			group by PeriodProductionID
			)oc on oc.PeriodProductionID = pp.PeriodProductionID
			where isnull(bom.Cost,0) = 0 and  isnull(oc.Cost,0) = 0

			IF EXISTS (SELECT 1 FROM #NoConsumptionNoOtherCost)
			BEGIN
				SET @message = N'ProductionManagement.Messages.ProducedWithoutConsumeAndShareExpense';
				INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

				INSERT @error ([Message] , IsDetail)
				select N'ProductionManagement.Messages.StuffInCostCenter^'+b.code+N','+c.Title +N','+b.code, 1
				from #NoConsumptionNoOtherCost a
					join stf.vwstuff b on a.stuffid = b.stuffid
					join cfg.costcenter c on c.CostCenterID = a.CostCenterId

				SELECT * from @error;
				RETURN;
			end

			update pp
			set pp.Fee = (isnull(bom.Cost,0) + isnull(oc.Cost,0)) 
			from PRM.PeriodProduction pp
			join #RedeayToCalculateFee t on t.PeriodProductionID = pp.PeriodProductionID
			left join
			(
			select PeriodProductionID,SUM(Cost) Cost
			from PRM.PeriodProductionBOM
			where CostCalculationPeriodID = @CostCalculationPeriodID
			group by PeriodProductionID
			)bom on bom.PeriodProductionID = pp.PeriodProductionID
			left join
			(
			select PeriodProductionID,SUM(ShareOfCost) Cost
			from PRM.[PeriodProductionOtherCost]
			group by PeriodProductionID
			)oc on oc.PeriodProductionID = pp.PeriodProductionID

			set @query = N'
			insert into #RedeayToCalculateAverage
			select  CostCenterID,
					StuffID,
					Sum(Price),
					cast(Sum(Price) as float)/ cast(SUM(MainQuantity) as float)
					'+ REPLACE(@SelectColumns,N'@',N'A')+'
			from
			('+
			case when @LoopNumber = 1 then
			N'
				select  first.CostCenterID,first.StuffID'+ REPLACE(@SelectColumns,N'@',N'first')+',Price,MainQuantity	
				from  [PRM].[Production_FirstWorkingInventory] first
				left join 
				(
				select * 
				from PRM.PeriodProduction
				where CostCalculationPeriodID = @CostCalculationPeriodID
				)pp on  first.CostCenterID = pp.CostCenterID 
					and first.StuffID = pp.StuffID 
					'+REPLACE(REPLACE(@PjoinColumns,N'@',N'pp'),N'$',N'first')+'
				where first.CostCalculationPeriodID = @CostCalculationPeriodID
				and pp.PeriodProductionID is null

				union all
				'
				else N'' end+
				N'
				select  first.CostCenterID,first.StuffID'+ REPLACE(@SelectColumns,N'@',N'first')+',Price,MainQuantity	
				from  [PRM].[Production_FirstWorkingInventory] first
				join #RedeayToCalculateFee t on t.CostCenterID = first.CostCenterID 
											and t.StuffID = first.StuffID 
											'+REPLACE(REPLACE(@PjoinColumns,N'@',N't'),N'$',N'first')+'
				where CostCalculationPeriodID = @CostCalculationPeriodID

				union all

				select  pp.CostCenterID,pp.StuffID'+ REPLACE(@SelectColumns,N'@',N'pp')+',pp.Fee Price,Quantity MainQuantity	
				from [PRM].[PeriodProduction] pp
				join #RedeayToCalculateFee t on t.PeriodProductionID = pp.PeriodProductionID
				where CostCalculationPeriodID = @CostCalculationPeriodID
			)A
			group by CostCenterID,StuffID'+ REPLACE(@SelectColumns,N'@',N'A')
			
			EXECUTE sp_executesql @Query,
								  N'@CostCalculationPeriodID int',
								  @CostCalculationPeriodID =  @CostCalculationPeriodID;

			set @query = N'
			insert into #RedeayToUpdateDocuments(DocumentName,DocumentID,Price,StockID,CostCenterID,StuffID,StuffDetailType)
			select ''WorkingInventoryItem'',wii.WorkingInventoryItemID,  Round(rtca.Average * wii.mainquantity , 0),null,rtca.CostCenterID ,rtca.StuffID,null
			from PRM.WorkingInventory wi
			join PRM.WorkingInventoryItem wii on wi.WorkingInventoryID = wii.WorkingInventoryID
			LEFT JOIN (
						select WorkingInventoryItemID,iit.TraceID,
						case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
								when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
								else Value end value
						from prm.WorkingInventoryItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
					)x 
					pivot
					(
					max(value)
					for traceid in (' + @Columns+ N')
					)wiit on wiit.WorkingInventoryItemID = wii.WorkingInventoryItemID
			join #RedeayToCalculateAverage rtca on wi.CostCenterID = rtca.CostCenterID 
											and wii.StuffID = rtca.StuffID 
											'+REPLACE(REPLACE(@PjoinColumns,N'@',N'rtca'),N'$',N'wiit')+'
			where wi.CostCalculationPeriodID = @CostCalculationPeriodID
			and wi.[Type] = 2'

			EXECUTE sp_executesql @Query,
								N'@CostCalculationPeriodID int' ,
								  @CostCalculationPeriodID = @CostCalculationPeriodID

			set @query = N'
			insert into #RedeayToUpdateDocuments(DocumentName,DocumentID,Price,StockID,CostCenterID,StuffID,StuffDetailType)
			select ''ProductionDeliveryItem'',pdi.ProductionDeliveryItemID, round(rtca.Average * pdi.mainquantity , 0),null,rtca.CostCenterID ,rtca.StuffID,null
			from PRM.ProductionDelivery pd
			join PRM.ProductionDeliveryItem pdi on pd.ProductionDeliveryID = pdi.ProductionDeliveryID
			LEFT JOIN (
						select ProductionDeliveryItemID,iit.TraceID,
						case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
								when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
								else Value end value
						from prm.ProductionDeliveryItemTrace iit
						join stf.trace t on t.traceid = iit.traceid
					)x 
					pivot
					(
					max(value)
					for traceid in (' + @Columns+ N')
					)pdit on pdit.ProductionDeliveryItemID = pdi.ProductionDeliveryItemID
			join #RedeayToCalculateAverage rtca on pd.CostCenterID = rtca.CostCenterID 
											and pdi.StuffID = rtca.StuffID 
											'+REPLACE(REPLACE(@PjoinColumns,N'@',N'rtca'),N'$',N'pdit')+'
			where pd.Date between @StartDate and @EndDate'

			EXECUTE sp_executesql @Query,
								N'@StartDate Date,
								  @EndDate Date' ,
								  @StartDate = @StartDate,
							      @EndDate =  @EndDate

			set @query = N'
			insert into #RedeayToUpdateDocuments(DocumentName,DocumentID,Price,StockID,CostCenterID,StuffID,StuffDetailType)
			select ''StockReceiptItem'',sri.StockReceiptItemID,round(sri.MainQuantity * rtca.Average,0),StockID,rtca.CostCenterID ,sri.StuffID,sag.StuffDetailType
			from stc.StockReceipt sr
			join stc.StockReceiptItem sri on sr.StockReceiptID = sri.StockReceiptID
			join stf.stuffDetail sd on sd.StuffID = sri.StuffID
			join stf.StuffAccountGroup sag on sd.StuffAccountGroupID = sag.StuffAccountGroupID
			join cfg.CostCenter cc on cc.DlID = sr.DeliverDlID
			LEFT JOIN (
						select StockReceiptItemID,srit.TraceID,
						case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
								when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
								else Value end value
						from stc.StockReceiptItemTrace srit
						join stf.trace t on t.traceid = srit.traceid
					)x 
					pivot
					(
					max(value)
					for traceid in (' + @Columns+ N')
					)srit on srit.StockReceiptItemID = sri.StockReceiptItemID
			join #RedeayToCalculateAverage rtca on cc.CostCenterID = rtca.CostCenterID 
												and sri.StuffID = rtca.StuffID 
											'+REPLACE(REPLACE(@PjoinColumns,N'@',N'rtca'),N'$',N'srit')+'
			where sr.Date between @StartDate and @EndDate'

			EXECUTE sp_executesql @Query,
								N'@StartDate Date,
								  @EndDate Date' ,
								  @StartDate = @StartDate,
							      @EndDate =  @EndDate
			

			truncate table #CostCalculationDiff
			insert into #CostCalculationDiff
			select a.CostCenterId,a.StuffID,a.Total - b.Price Diff
			from #RedeayToCalculateAverage a
			join
			( 
				select CostCenterID,StuffID,sum(Price) Price
				from #RedeayToUpdateDocuments
				group by CostCenterID,StuffID
			) b
				on a.CostCenterId = b.CostCenterID
				and a.StuffID = b.StuffID
			where a.Total <> b.Price

			update c
			set c.Price = c.Price + a.Diff
			from #CostCalculationDiff a
			join 
			(
				select ROW_NUMBER() over(partition by CostCenterID,StuffID order by id)Rno,
				id,
				CostCenterID,
				StuffID
				from #RedeayToUpdateDocuments
			) b on a.CostCenterId = b.CostCenterID 
				and a.StuffID = b.StuffID
				and b.Rno = 1
			join #RedeayToUpdateDocuments c
				on c.ID = b.ID

			update wii
			set Price = t.Price
			from PRM.WorkingInventoryItem wii
			join #RedeayToUpdateDocuments t on t.DocumentName = 'WorkingInventoryItem' and t.DocumentID = wii.WorkingInventoryItemID

			update pdi
			set Price = t.Price
			from PRM.ProductionDeliveryItem pdi
			join #RedeayToUpdateDocuments t on t.DocumentName = 'ProductionDeliveryItem' and t.DocumentID = pdi.ProductionDeliveryItemID

			update sri
			set Fee   = t.Price / sri.MainQuantity, 
				Price = t.Price
			from stc.StockReceiptItem sri
			join #RedeayToUpdateDocuments t on t.DocumentName = 'StockReceiptItem' and t.DocumentID = sri.StockReceiptItemID

			;with c as
			(select StockReceiptID,sum(sri.Price) TotalPrice
			from stc.StockReceiptItem sri
			join #RedeayToUpdateDocuments t on t.DocumentName = 'StockReceiptItem' and t.DocumentID = sri.StockReceiptItemID
			group by StockReceiptID
			)
			update a
			set TotalInvoicePrice = c.TotalPrice, Version = Version + 1
			from stc.StockReceipt a
			join c on a.StockReceiptID = c.StockReceiptID
		
			 declare @selItems varchar(max),
					 @StuffIds varchar(max)

			 SELECT @selItems = STUFF(
					(
						SELECT '|'+cast(a.StuffID as varchar(100))+'$'+cast(StockID as varchar(100))+'#null'
						from
						(
						select StuffID
						from #RedeayToUpdateDocuments a
						where DocumentName = 'StockReceiptItem'
						and StuffDetailType = 1
						group by a.StuffID
						)a
						cross join stf.stock
						FOR XML PATH(''), TYPE
					).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

			if @selItems is not null
			begin
				

					
					EXEC stc.spPricingValidationSource
					     @PricingDate = @EndDate,
					     @selItems = @selItems,
					     @FinancialPeriodID = @FinancialPeriodID,
					     @TableName = @PricingValidationTable
					    
CREATE TABLE #PricingValidationDescription
(
	ValidationNo       NVARCHAR(MAX),
	ValidationDesc     NVARCHAR(MAX)
)

set @query = N'insert into #PricingValidationDescription
	(ValidationNo,ValidationDesc)
	select ValidationNo,ValidationDesc from '+@PricingValidationTable 
	EXEC (@query)
	
	
			
IF EXISTS (SELECT 1 FROM #PricingValidationDescription)
BEGIN
				INSERT @error 
				SELECT N'ProductionManagement.Messages.SomeStockVoucherIncludeSemiManufactureProblem',0
				
				INSERT @error 
				SELECT ValidationDesc , 1 FROM #PricingValidationDescription

				SELECT * FROM @error
				RETURN;
END	

				BEGIN TRY  
						Exec STC.sp_DoPricing @EndDate,@selItems,@FinancialPeriodID,@UserName = ''
				END TRY  
				BEGIN CATCH 
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

			SELECT @StuffIds = STUFF(
					(
						SELECT ','+cast(a.StuffID as varchar(100))
						from #RedeayToCalculateAverage a
						join stf.StuffDetail b on a.StuffID = b.StuffID
						join stf.StuffAccountGroup sag on b.StuffAccountGroupID = sag.StuffAccountGroupID
						where sag.StuffDetailType = 1
						group by a.StuffID
						FOR XML PATH(''), TYPE
					).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');
			
			if @StuffIds is not null
			begin

				INSERT INTO @error
				exec PRM.SpGetSemiConsumption @CostCalculationPeriodID,@StuffIds,@LoopNumber
				
				IF EXISTS(SELECT 1 FROM @error)
				BEGIN
					SELECT * FROM @error
					RETURN;
				END 

				select @query = N'
								with CTE as
								(
								select  PeriodProductionBOMID,
										Quantity * ConsumptionRate StandardCost,
										convert (float ,Quantity) / convert (float ,sum(Quantity) over(partition by BOM.CostCenterId,BOM.StuffID'+REPLACE(@CGroupByColumns,'@','BOM')+') )
											* Consumption.DeviationCost [DeviationShare]
								from PRM.PeriodProductionBOM BOM
								join (
									SELECT VALUE
									FROM   CFG.R_FnCommaStr2Table(@StuffIds)
									 )s on s.VALUE = BOM.StuffID
								join 
								(select *
								from PRM.Consumption a
								where  a.CostCalculationPeriodID = @CostCalculationPeriodID
								)Consumption
								on Consumption.CostCenterId = BOM.CostCenterId
													and Consumption.StuffID = BOM.StuffID
															'+REPLACE(REPLACE(@CjoinColumns,N'@',N'Consumption'),N'$',N'BOM')+'
								where BOM.StuffDetailType = 1
								and BOM.CostCalculationPeriodID = @CostCalculationPeriodID
								)
								update BOM
								set [StandardCost] = ROUND(CTE.StandardCost,0),
									[DeviationShare] = ROUND(CTE.DeviationShare,0)
								from PRM.PeriodProductionBOM BOM
								join CTE on CTE.PeriodProductionBOMID = BOM.PeriodProductionBOMID
								'
				EXECUTE sp_executesql @Query,
									N'@CostCalculationPeriodID int,
									  @StuffIds varchar(max)',
									  @CostCalculationPeriodID =  @CostCalculationPeriodID,
									  @StuffIds = @StuffIds;
									  

				update c set DeviationShare = c.DeviationShare - diff
				from
				(
					select  ROW_NUMBER() over(Partition By CostCenterId,StuffID order by DeviationShare Desc) Rno,
							PeriodProductionBOMID,
							CostCenterId,
							StuffID
					from [PRM].PeriodProductionBOM
					where CostCalculationPeriodID = @CostCalculationPeriodID
				)a
				join
				(
					select a.StuffID,a.CostCenterId,b.Cost,a.Price - b.Cost diff 
					from prm.Consumption a
					join(
						select StuffID,CostCenterId,sum(Cost) Cost
						from [PRM].PeriodProductionBOM
						where CostCalculationPeriodID = @CostCalculationPeriodID
						group by StuffID,CostCenterId
						)b
					on a.CostCenterId = b.CostCenterId and a.StuffID = b.StuffID
					where CostCalculationPeriodID = @CostCalculationPeriodID
				)b on a.StuffID = b.StuffID and a.CostCenterId = b.CostCenterId
				join [PRM].PeriodProductionBOM c on c.PeriodProductionBOMID = a.PeriodProductionBOMID
				where a.Rno = 1
				and b.diff <> 0
	
				
			end
			END
		

		DECLARE @User INT
        
		SET @User = cfg.GetuserID();
		INSERT INTO prm.CostCalculation
		  (
			-- CostCalculationID -- this column value is auto-generated
			CostCalculationPeriodID,
			Version,
			Creator,
			CreationDate,
			LastEditor,
			LastEditionDate
		  )
		SELECT @CostCalculationPeriodID,
			   0,
			   @User,
			   GETDATE(),
			   @User,
			   GETDATE()

		 update cfg.Configuration 
		 set ConfigValue = 0
		 where ConfigKey = 'CostCalculationIsRunning'

		 SELECT * FROM @error

	END TRY
	BEGIN CATCH
		update cfg.Configuration 
		set ConfigValue = 0
		where ConfigKey = 'CostCalculationIsRunning'

		SELECT @ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, -- Message text.
			@ErrorSeverity, -- Severity.
			@ErrorState -- State.
		);			   
	END CATCH
END ;

