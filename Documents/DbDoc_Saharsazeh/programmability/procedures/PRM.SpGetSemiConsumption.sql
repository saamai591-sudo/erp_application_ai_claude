
-------------------------------------
CREATE   proc [PRM].SpGetSemiConsumption
(
	@CostCalculationPeriodID INT,
	@StuffIds  VARCHAR(MAX),
	@LoopNumber TINYINT
)
--WITH ENCRYPTION
WITH RECOMPILE
AS 
begin 

	DECLARE @error TABLE (
        [Message] NVARCHAR(MAX) ,
        IsDetail BIT
    )

		DECLARE @query NVARCHAR(MAX),
				@Columns NVARCHAR(MAX),
				@StartDate Date,
				@EndDate Date,
				@PreCostCalculationPeriodID		int,
				@SelectColumns NVARCHAR(MAX),
				@Message NVARCHAR(MAX),
				@Detail NVARCHAR(MAX)

		select @StartDate = StartDate,
			   @EndDate = EndDate
		from prm.CostCalculationPeriod
		where CostCalculationPeriodID = @CostCalculationPeriodID

		select  top 1 
				@PreCostCalculationPeriodID = CostCalculationPeriodID
		from prm.CostCalculationPeriod
		where EndDate < @StartDate
		order by EndDate desc

		SELECT @Columns = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(TraceID)
			FROM STF.Trace t
			where t.IsEffectiveInConsumeCost = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

		IF (@Columns IS NULL)
			SET @Columns = N'[-1]';


		SELECT @SelectColumns = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(TraceID)
			FROM STF.Trace  t
			where t.IsEffectiveInConsumeCost = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

		IF (@SelectColumns IS NULL)
			SET @SelectColumns = N'';

		SELECT VALUE StuffID
		into #StuffIds
		FROM   CFG.R_FnCommaStr2Table(@StuffIds)

			set @query = N'
			insert into PRM.Consumption_FirstWorkingInventory ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+@SelectColumns+')
			select  @CostCalculationPeriodID,wi.CostCenterId,wii.StuffID,Price,MainQuantity,1'+@SelectColumns+'
			from prm.WorkingInventory wi
			join prm.WorkingInventoryItem wii
				on wi.WorkingInventoryID = wii.WorkingInventoryID
			join #StuffIds s on s.StuffID = wii.StuffID
			join stf.StuffDetail sd on sd.StuffId = wii.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			left join 
				(
					select  WorkingInventoryItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
					From prm.WorkingInventoryItemTrace iit
					join stf.trace t on t.traceid = iit.traceid
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
				)wiit
				on wii.WorkingInventoryItemID = wiit.WorkingInventoryItemID
			where wi.CostCalculationPeriodID = @PreCostCalculationPeriodID
			and wi.[Type] = 1
			and SAG.StuffDetailType = 1
			'
			EXECUTE sp_executesql @Query,
									N'@PreCostCalculationPeriodID int,
									@CostCalculationPeriodID int',
									@PreCostCalculationPeriodID =  @PreCostCalculationPeriodID,
									@CostCalculationPeriodID = @CostCalculationPeriodID;

			set @query = N'
			insert into PRM.Consumption_Outgoing ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+@SelectColumns+')
			select  @CostCalculationPeriodID,cct.CostCenterID,oi.stuffID,Price,MainQuantity,1'+@SelectColumns+'
			from STC.Outgoing o
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			join STC.OutgoingItem oi
				on o.OutgoingID = oi.OutgoingID
			join #StuffIds s on s.StuffID = oi.StuffID
			join stf.StuffDetail sd on sd.StuffId = oi.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			join stc.StockDocumentType sdt
				on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
			left join 
				(
					select  OutgoingItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
					From STC.OutgoingItemTrace iit
					join stf.trace t on t.traceid = iit.traceid
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
				)oit
				on oi.OutgoingItemID = oit.OutgoingItemID
			join cfg.costcenter cct
				on cct.dlid = o.DeliverDlID 
			where o.Date between @StartDate and 	@EndDate
			and sdt.DocumentType = 16
			and SAG.StuffDetailType = 1
			and CostCenterType = 1'
			
			EXECUTE sp_executesql @Query,
								  N'@StartDate Date,
									@EndDate   Date,
									@CostCalculationPeriodID int',
									@StartDate =  @StartDate,
									@EndDate = @EndDate,
									@CostCalculationPeriodID = @CostCalculationPeriodID;

			set @query = N'
			insert into PRM.Consumption_ReturnedOutgoing ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+@SelectColumns+')
			select  @CostCalculationPeriodID,CostCenterID,oi.StuffID,-Price,-MainQuantity,1'+@SelectColumns+'
			from STC.ReturnedOutgoing o
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			join STC.ReturnedOutgoingItem oi
				on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
			join #StuffIds s on s.StuffID = oi.StuffID
			join stf.StuffDetail sd on sd.StuffId = oi.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			join stc.StockDocumentType sdt
				on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
			left join 
			(
				select  ReturnedOutgoingItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
				From STC.ReturnedOutgoingItemTrace  iit
				join stf.trace t on t.traceid = iit.traceid
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
			) oit
				on oi.ReturnedOutgoingItemID = oit.ReturnedOutgoingItemID
			join cfg.costcenter cct
				on cct.DlID = o.DlDeliverID
			where o.Date between @StartDate and 	@EndDate
			and sdt.DocumentType = 16
			and SAG.StuffDetailType = 1
			and CostCenterType = 1'

			EXECUTE sp_executesql @Query,
									N'@StartDate Date,
									@EndDate   Date,
									@CostCalculationPeriodID int',
									@StartDate =  @StartDate,
									@EndDate = @EndDate,
									@CostCalculationPeriodID = @CostCalculationPeriodID;
			set @query = N'
			insert INTO  PRM.Consumption_LastWorkingInventory ([CostCalculationPeriodID],[WorkingInventoryItemID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+@SelectColumns+')
			select  @CostCalculationPeriodID,wii.WorkingInventoryItemID,CostCenterID,wii.StuffID,-Price,-MainQuantity,1'+ @SelectColumns+'
			from prm.WorkingInventory wi
			join prm.WorkingInventoryItem wii
				on wi.WorkingInventoryID = wii.WorkingInventoryID
			join #StuffIds s on s.StuffID = wii.StuffID
			join stf.StuffDetail sd on sd.StuffId = wii.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			left join 
			(
					select  WorkingInventoryItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
			From prm.WorkingInventoryItemTrace  iit
					join stf.trace t on t.traceid = iit.traceid
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
			)wiit
				on wii.WorkingInventoryItemID = wiit.WorkingInventoryItemID
			where wi.CostCalculationPeriodID = @CostCalculationPeriodID
			and wi.[Type] = 1
			and SAG.StuffDetailType = 1'
			EXECUTE sp_executesql @Query,
									N'@CostCalculationPeriodID int',
									@CostCalculationPeriodID =  @CostCalculationPeriodID;

			DROP TABLE IF EXISTS #InLastWorkingNotInDuration

			create table #InLastWorkingNotInDuration
			( 
				StuffID int,
				CostCenterId int
			)
			
			insert into #InLastWorkingNotInDuration
			select  lw.StuffID,lw.CostCenterId
			from PRM.Consumption_LastWorkingInventory lw
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.[Consumption_Outgoing]
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)o on lw.CostCenterId = o.CostCenterId and lw.StuffID = o.StuffID
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.[Consumption_ReturnedOutgoing]
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)ou on lw.CostCenterId = ou.CostCenterId and lw.StuffID = ou.StuffID
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.Consumption_FirstWorkingInventory
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)fw on lw.CostCenterId = fw.CostCenterId and lw.StuffID = fw.StuffID
			where lw.CostCalculationPeriodID = @CostCalculationPeriodID
			and isnull(o.MainQuantity,0) + isnull(ou.MainQuantity,0) + isnull(fw.MainQuantity,0) = 0

			if exists (select 1 from #InLastWorkingNotInDuration)
			begin
				INSERT @error
				SELECT 'ProductionManagement.Messages.SomeStuffsWithPeriodEndDataWithoutConsumeOrFirstPeriod', 0

				INSERT @error
				SELECT  N'ProductionManagement.Messages.StuffInCostCenter^' + b.code + ',' + c.title,1
				from #InLastWorkingNotInDuration a
					join stf.vwstuff b on a.stuffid = b.stuffid
					join cfg.costcenter c on c.CostCenterID = a.CostCenterId
					where b.StuffDetailType = 1

				SELECT * FROM @error
				RETURN 
			end

			select  lw.WorkingInventoryItemID,
					(isnull(o.Price,0)+isnull(ou.Price,0)+isnull(fw.Price,0))
					/
					(isnull(o.MainQuantity,0) + isnull(ou.MainQuantity,0) + isnull(fw.MainQuantity,0)) * lw.[MainQuantity] [Price]
			into #Temp_LastWorkingInventory
			from PRM.Consumption_LastWorkingInventory lw
			join stf.StuffDetail sd on sd.StuffId = lw.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.[Consumption_Outgoing]
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)o on lw.CostCenterId = o.CostCenterId and lw.StuffID = o.StuffID
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.[Consumption_ReturnedOutgoing]
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)ou on lw.CostCenterId = ou.CostCenterId and lw.StuffID = ou.StuffID
			left join
			(
			select CostCenterId,StuffId,sum([MainQuantity]) [MainQuantity],SUM([Price]) [Price]
			from prm.Consumption_FirstWorkingInventory
			where [CostCalculationPeriodID] = @CostCalculationPeriodID
			group by CostCenterId,StuffId
			)fw on lw.CostCenterId = fw.CostCenterId and lw.StuffID = fw.StuffID
			where lw.CostCalculationPeriodID = @CostCalculationPeriodID
			and SAG.StuffDetailType = 1

			update a
			set [Price] =   ROUND(b.[Price],0)
			from PRM.Consumption_LastWorkingInventory a
			join #Temp_LastWorkingInventory b on a.WorkingInventoryItemID = b.WorkingInventoryItemID

			update a
			set [Price] = -1 *  ROUND(b.[Price],0)
			from PRM.WorkingInventoryItem a
			join #Temp_LastWorkingInventory b on a.WorkingInventoryItemID = b.WorkingInventoryItemID

			set @query = N'
			insert INTO  PRM.Consumption_ProductionDelivery
			select  @CostCalculationPeriodID,DeliverCostCenterId,pdi.StuffID,Price,MainQuantity'+ @SelectColumns+'	
			from prm.ProductionDelivery pd
			join prm.ProductionDeliveryItem pdi
				on pd.ProductionDeliveryID = pdi.ProductionDeliveryID
			join #StuffIds s on s.StuffID = pdi.StuffID
			left join 
			(
					select  ProductionDeliveryItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
			from prm.ProductionDeliveryItemTrace   iit
					join stf.trace t on t.traceid = iit.traceid
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
			)pdit
				on pdi.ProductionDeliveryItemID = pdit.ProductionDeliveryItemID
			where pd.Date between @StartDate and 	@EndDate'

			EXECUTE sp_executesql @Query,
								  N'@StartDate Date,
									@EndDate   Date,
									@CostCalculationPeriodID int',
									@StartDate =  @StartDate,
									@EndDate = @EndDate,
									@CostCalculationPeriodID =  @CostCalculationPeriodID;

		
			declare @CGroupByColumns nvarchar(max)
			SELECT @CGroupByColumns = STUFF(
			(
				SELECT DISTINCT
					   ',' + QUOTENAME(TraceID)
				FROM STF.Trace  t
			where t.IsEffectiveInConsumeCost = 1
				FOR XML PATH(''), TYPE
			).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

			IF (@CGroupByColumns IS NULL)
				SET @CGroupByColumns = N'';

			set @query = N'
			insert into PRM.Consumption (CostCalculationPeriodID,CostCenterID,StuffID,Price,MainQuantity,[ConsumptionRate],DeviationQuantity,DeviationCost,LoopNumber,[StuffDetailType]'+ @CGroupByColumns+')
			select  @CostCalculationPeriodID,
					CostCenterID,
					A.StuffID,
					Sum(Price) Price,
					SUM(MainQuantity) MainQuantity,
					Sum(Price) / SUM(MainQuantity),
					0,
					0,
					@LoopNumber,
					1'+ @CGroupByColumns+'
			from
			(
			select  CostCenterID,StuffID'+ @SelectColumns+',Price,MainQuantity	
			from  [PRM].[Consumption_FirstWorkingInventory]
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID'+ @SelectColumns+',Price,MainQuantity	
			from [PRM].[Consumption_Outgoing]
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID'+ @SelectColumns+',Price,MainQuantity	
			from [PRM].[Consumption_ReturnedOutgoing]
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID'+ @SelectColumns+',Price,MainQuantity	
			from [PRM].[Consumption_LastWorkingInventory]
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID'+ @SelectColumns+',Price,MainQuantity	
			from [PRM].[Consumption_ProductionDelivery]
			where CostCalculationPeriodID = @CostCalculationPeriodID
			)A
			join stf.StuffDetail sd on sd.StuffId = A.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			join #StuffIds s on s.StuffID = a.StuffID
			and SAG.StuffDetailType = 1
			group by CostCenterID,A.StuffID'+ @CGroupByColumns+'
			having SUM(MainQuantity) <> 0
			'
			
			EXECUTE sp_executesql @Query,
								  N'@CostCalculationPeriodID int,
								  @LoopNumber TinyInt',
								  @CostCalculationPeriodID =  @CostCalculationPeriodID,
								  @LoopNumber = @LoopNumber;

			;with CTE as
			(
				select  Consumption.CostCenterId,
						Consumption.StuffID,
						BOM.Quantity - Consumption.MainQuantity DeviationQuantity
				from PRM.Consumption 
				join 
				(
				select CostCenterId,StuffID,sum(Quantity) Quantity
				from PRM.PeriodProductionBOM
				where StuffDetailType = 1
				and CostCalculationPeriodID = @CostCalculationPeriodID
				group by CostCenterId,StuffID
				) BOM on Consumption.CostCenterId = BOM.CostCenterId
					 and Consumption.StuffID = BOM.StuffID
				where Consumption.CostCalculationPeriodID = @CostCalculationPeriodID
			)
			update Consumption
			set DeviationQuantity = CTE.DeviationQuantity,
				DeviationCost = ROUND(CTE.DeviationQuantity*ConsumptionRate , 0)
			from PRM.Consumption 
			join CTE on CTE.CostCenterId = Consumption.CostCenterId 
					and CTE.StuffID = Consumption.StuffID

		IF @Detail IS NOT NULL
		BEGIN

			INSERT @error
			SELECT 'ProductionManagement.Messages.SomeStuffsConsumeDifferenceByStandardConsume', 0

			INSERT @error
			SELECT  N'ProductionManagement.Messages.StuffInCostCenter^' + v.code + ',' + cc.title
			from #NotBalancedInSemi a
				join STF.VWStuff v
					on a.StuffID = v.StuffID
				left join cfg.CostCenter cc
					on cc.CostCenterID = a.CostCenterId	

			SELECT * FROM @error
			RETURN 
		END
		
		SELECT * FROM @error
end
