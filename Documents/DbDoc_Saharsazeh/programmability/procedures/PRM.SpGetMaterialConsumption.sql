
-------------------------------------
CREATE   proc [PRM].SpGetMaterialConsumption
(
	@CostCalculationPeriodID INT
)
AS
BEGIN
		SET NOCOUNT ON
		DECLARE @query NVARCHAR(MAX),
				@Columns NVARCHAR(MAX),
				@SelectColumns NVARCHAR(MAX),
				@StartDate DATE,
				@EndDate DATE,
				@PreCostCalculationPeriodID		INT,
				@Message NVARCHAR(MAX),
				@Detail NVARCHAR(MAX)
	
		DECLARE @error TABLE (
			[Message] NVARCHAR(MAX) ,
			IsDetail BIT
		)

		SELECT @StartDate = StartDate,
			   @EndDate = EndDate
		FROM  prm.CostCalculationPeriod
		WHERE CostCalculationPeriodID = @CostCalculationPeriodID

		SELECT  TOP 1 
				@PreCostCalculationPeriodID = CostCalculationPeriodID
		FROM prm.CostCalculationPeriod
		WHERE EndDate < @StartDate
		ORDER BY EndDate DESC

		SELECT @Columns = STUFF(
		(
			SELECT DISTINCT
				   ',' + QUOTENAME(TraceID)
			FROM STF.Trace 
			WHERE IsEffectiveInConsumeCost = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

		IF (@Columns IS NULL)
			SET @Columns = N'[-1]';

		SELECT @SelectColumns = STUFF(
		(
			SELECT DISTINCT
				   ',@.' + QUOTENAME(TraceID)
			FROM STF.Trace 
			WHERE IsEffectiveInConsumeCost = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

		IF (@SelectColumns IS NULL)
			SET @SelectColumns = N'';

		
		delete PRM.Consumption_FirstWorkingInventory where CostCalculationPeriodID = @CostCalculationPeriodID 
		delete PRM.Consumption_Outgoing where CostCalculationPeriodID = @CostCalculationPeriodID 
		delete PRM.Consumption_ReturnedOutgoing where CostCalculationPeriodID = @CostCalculationPeriodID
		delete PRM.Consumption_LastWorkingInventory where CostCalculationPeriodID = @CostCalculationPeriodID 
		delete PRM.Consumption where CostCalculationPeriodID = @CostCalculationPeriodID 
		delete PRM.Consumption_ProductionDelivery where CostCalculationPeriodID = @CostCalculationPeriodID 
	
		set @query = N'
			insert into PRM.Consumption_FirstWorkingInventory ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+REPLACE(@SelectColumns,'@.','')+')
			select  @CostCalculationPeriodID,wi.CostCenterId,wii.StuffID,Price,MainQuantity,SAG.StuffDetailType'+REPLACE(@SelectColumns,'@','wiit')+'
			from prm.WorkingInventory wi
			join prm.WorkingInventoryItem wii
				on wi.WorkingInventoryID = wii.WorkingInventoryID
			join stf.StuffDetail sd on sd.StuffId = wii.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
			left join 
				(
					select  WorkingInventoryItemID,iit.TraceID,
							case when DLID is not null then cast (DLID as nvarchar(max))
								 when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
							else Value end value
					From prm.WorkingInventoryItemTrace iit
				)x 
				pivot
				(
					max(value)
					for traceid in (' + @Columns+ N')
				)wiit
				on wii.WorkingInventoryItemID = wiit.WorkingInventoryItemID
			left join 
			(select * from prm.periodproduction 
			where CostCalculationPeriodID = @CostCalculationPeriodID
			)pp on --pp.CostCenterId = wi.CostCenterId and 
					pp.StuffID = wii.StuffID
			where wi.CostCalculationPeriodID = @PreCostCalculationPeriodID
			and wi.[Type] = 1
			and (
					SAG.StuffDetailType = 0 
					or
					(SAG.StuffDetailType = 1 and pp.periodproductionid is null)
					or
					SAG.StuffDetailType = 9 
				)'
		EXECUTE sp_executesql @Query,
								N'@PreCostCalculationPeriodID int,
								@CostCalculationPeriodID int',
								@PreCostCalculationPeriodID =  @PreCostCalculationPeriodID,
								@CostCalculationPeriodID = @CostCalculationPeriodID;

		set @query = N'
		insert into PRM.Consumption_Outgoing ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+REPLACE(@SelectColumns,'@.','')+')
		select  @CostCalculationPeriodID,cct.CostCenterID,oi.stuffID,
				case when Revision.RevisionPrice is not null then Revision.RevisionPrice else oi.price end,
				MainQuantity,SAG.StuffDetailType'+REPLACE(@SelectColumns,'@','oit')+'
		from STC.Outgoing o
		join STC.OutgoingItem oi
			on o.OutgoingID = oi.OutgoingID
		join stf.StuffDetail sd on sd.StuffId = oi.StuffID
		JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt
			on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join 
			(
				select  OutgoingItemID,iit.TraceID,
						case when DLID is not null then cast (DLID as nvarchar(max))
								when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
						else Value end value
				From STC.OutgoingItemTrace iit
			)x 
			pivot
			(
				max(value)
				for traceid in (' + @Columns+ N')
			)oit
			on oi.OutgoingItemID = oit.OutgoingItemID
		join cfg.costcenter cct
			on cct.dlid = o.DeliverDlID 
		LEFT JOIN (
				select  ROW_NUMBER() over(partition by OutgoingItemID order by number desc) Rno,
						OutgoingItemID,RevisionFee,RevisionPrice 
				from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where OutgoingItemID is not null 
				) Revision on Rno = 1 and Revision.OutgoingItemID = oi.OutgoingItemID
		left join 
		(select * from prm.periodproduction 
		where CostCalculationPeriodID = @CostCalculationPeriodID
		)pp on --pp.CostCenterId = cct.CostCenterId and 
				pp.StuffID = oi.StuffID
		where o.Date between @StartDate and 	@EndDate
		and ( 
				(SAG.StuffDetailType = 0 and sdt.DocumentType = 2) 
				or 
				(SAG.StuffDetailType = 1 and sdt.DocumentType = 16 and pp.periodproductionid is null)
				or 
				(SAG.StuffDetailType = 9 and sdt.DocumentType = 18)
			)
		and CostCenterType = 1
		'
		EXECUTE sp_executesql @Query,
								N'@StartDate Date,
								@EndDate   Date,
								@CostCalculationPeriodID int',
								@StartDate =  @StartDate,
								@EndDate = @EndDate,
								@CostCalculationPeriodID = @CostCalculationPeriodID;

		set @query = N'
		insert into PRM.Consumption_ReturnedOutgoing ([CostCalculationPeriodID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+REPLACE(@SelectColumns,'@.','')+')
		select  @CostCalculationPeriodID,cct.CostCenterID,oi.StuffID,
				-case when Revision.RevisionPrice is not null then Revision.RevisionPrice else oi.price end ,
				-MainQuantity,SAG.StuffDetailType'+REPLACE(@SelectColumns,'@','oit')+'
		from STC.ReturnedOutgoing o
		join STC.ReturnedOutgoingItem oi
			on o.ReturnedOutgoingID = oi.ReturnedOutgoingID
		join stf.StuffDetail sd on sd.StuffId = oi.StuffID
		JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt
			on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join 
		(
			select  ReturnedOutgoingItemID,iit.TraceID,
						case when DLID is not null then cast (DLID as nvarchar(max))
								when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
						else Value end value
			From STC.ReturnedOutgoingItemTrace  iit
			)x 
			pivot
			(
				max(value)
				for traceid in (' + @Columns+ N')
		) oit
			on oi.ReturnedOutgoingItemID = oit.ReturnedOutgoingItemID
		join cfg.costcenter cct
			on cct.DlID = o.DlDeliverID
		LEFT JOIN (
				select  ROW_NUMBER() over(partition by ReturnedOutgoingItemID order by number desc) Rno,
						ReturnedOutgoingItemID,RevisionFee,RevisionPrice,h.Date
				from stc.RevisionCost h
				join stc.RevisionCostItem i on h.RevisionCostID = i.RevisionCostID
				where ReturnedOutgoingItemID is not null 
				) Revision on Rno = 1 and Revision.ReturnedOutgoingItemID = oi.ReturnedOutgoingItemID
		left join 
		(select * from prm.periodproduction 
		where CostCalculationPeriodID = @CostCalculationPeriodID
		)pp on --pp.CostCenterId = cct.CostCenterId and 
				pp.StuffID = oi.StuffID
		where o.Date between @StartDate and 	@EndDate
		and ( 
				(SAG.StuffDetailType = 0 and sdt.DocumentType = 2) 
				or 
				(SAG.StuffDetailType = 1 and sdt.DocumentType = 16 and pp.periodproductionid is null)
				or 
				(SAG.StuffDetailType = 9 and sdt.DocumentType = 18)
			)
		and CostCenterType = 1'
		EXECUTE sp_executesql @Query,
								N'@StartDate Date,
								@EndDate   Date,
								@CostCalculationPeriodID int',
								@StartDate =  @StartDate,
								@EndDate = @EndDate,
								@CostCalculationPeriodID = @CostCalculationPeriodID;
		
		set @query = N'
		insert INTO  PRM.Consumption_LastWorkingInventory  ([CostCalculationPeriodID],[WorkingInventoryItemID],[CostCenterId],[StuffID],[Price],[MainQuantity],[StuffDetailType]'+REPLACE(@SelectColumns,'@.','')+')
		select  @CostCalculationPeriodID,wii.WorkingInventoryItemID,wi.CostCenterID,wii.StuffID,-Price,-MainQuantity,SAG.StuffDetailType'+ REPLACE(@SelectColumns,'@','wiit')+'	
		from prm.WorkingInventory wi
		join prm.WorkingInventoryItem wii
			on wi.WorkingInventoryID = wii.WorkingInventoryID
		join stf.StuffDetail sd on sd.StuffId = wii.StuffID
		JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
		left join 
		(
		select  WorkingInventoryItemID,iit.TraceID,
						case when DLID is not null then cast (DLID as nvarchar(max))
								when TraceItemID is not null then cast (TraceItemID as nvarchar(max))
						else Value end value
		From prm.WorkingInventoryItemTrace  iit
		)x 
		pivot
		(
			max(value)
			for traceid in (' + @Columns+ N')
		)wiit
			on wii.WorkingInventoryItemID = wiit.WorkingInventoryItemID
		left join 
		(select * from prm.periodproduction 
		where CostCalculationPeriodID = @CostCalculationPeriodID
		)pp on --pp.CostCenterId = wi.CostCenterId and 
				pp.StuffID = wii.StuffID
		where wi.CostCalculationPeriodID = @CostCalculationPeriodID
		and wi.[Type] = 1
		and (
				SAG.StuffDetailType = 0 
				or 
				(SAG.StuffDetailType = 1 and pp.periodproductionid is null)
				or
				SAG.StuffDetailType = 9
			)'
		EXECUTE sp_executesql @Query,
								N'@CostCalculationPeriodID int',
								@CostCalculationPeriodID =  @CostCalculationPeriodID;

		select lw.CostCenterId,lw.StuffID
			into #InLastWorkingNotInConsuption
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
		AND isnull(o.MainQuantity,0) + isnull(ou.MainQuantity,0) + isnull(fw.MainQuantity,0) = 0
		group by lw.CostCenterId,lw.StuffID

		IF EXISTS(SELECT 1 FROM #InLastWorkingNotInConsuption)
		BEGIN
			INSERT @error
			SELECT 'ProductionManagement.Messages.SomeStuffsWithPeriodEndDataWithoutConsumeOrFirstPeriod', 0

			INSERT @error
			SELECT  N'ProductionManagement.Messages.StuffInCostCenter^' + b.code + ',' + cc.title,1
			FROM  #InLastWorkingNotInConsuption lw
				join stf.vwstuff b on lw.stuffid = b.stuffid
				join cfg.CostCenter cc on cc.CostCenterID = lw.CostCenterID

			SELECT * FROM @error
			RETURN 
		RETURN
		END
											
			select  lw.WorkingInventoryItemID,
					(isnull(o.Price,0)+isnull(ou.Price,0)+isnull(fw.Price,0))
					/
					(isnull(o.MainQuantity,0) + isnull(ou.MainQuantity,0) + isnull(fw.MainQuantity,0)) * lw.[MainQuantity] [Price]
			into #Temp_Consumption_LastWorkingInventory
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

			update a
			set [Price] =  ROUND(b.[Price],0)
			from PRM.Consumption_LastWorkingInventory a
			join #Temp_Consumption_LastWorkingInventory b on a.WorkingInventoryItemID = b.WorkingInventoryItemID

			update a
			set [Price] = -1 * ROUND(b.[Price],0)
			from PRM.WorkingInventoryItem a
			join #Temp_Consumption_LastWorkingInventory b on a.WorkingInventoryItemID = b.WorkingInventoryItemID

			set @query = N'
			insert INTO  PRM.Consumption_ProductionDelivery
			select  @CostCalculationPeriodID,DeliverCostCenterId,pdi.StuffID,Price,MainQuantity'+ REPLACE(@SelectColumns,'@','pdit')+'	
			from prm.ProductionDelivery pd
			join prm.ProductionDeliveryItem pdi
				on pd.ProductionDeliveryID = pdi.ProductionDeliveryID
			join stf.StuffDetail sd on sd.StuffId = pdi.StuffID
			JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
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
			left join 
			(select * from prm.periodproduction 
			where CostCalculationPeriodID = @CostCalculationPeriodID
			)pp on --pp.CostCenterId = pd.CostCenterId and 
					pp.StuffID = pdi.StuffID
			where pd.Date between @StartDate and 	@EndDate
			and (
					SAG.StuffDetailType = 0 
					or 
					(SAG.StuffDetailType = 1 and pp.periodproductionid is null)
				)'

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
			FROM STF.Trace t
			where t.IsEffectiveInConsumeCost = 1
			FOR XML PATH(''), TYPE
		).value('.', 'NVARCHAR(MAX)'),1   ,0   ,'');

		IF (@CGroupByColumns IS NULL)
			SET @CGroupByColumns = N'';

		DROP TABLE IF EXISTS #NegativeConsumption

		CREATE TABLE #NegativeConsumption
		( 
			StuffID int,
			CostCenterId int
		)

		set @query = N'
		insert into #NegativeConsumption
		select  StuffID,CostCenterID
		from
		(
		select  CostCenterID,StuffID'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
		from  [PRM].[Consumption_FirstWorkingInventory] A
		where CostCalculationPeriodID = @CostCalculationPeriodID
		union all
		select  CostCenterID,StuffID'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
		from [PRM].[Consumption_Outgoing] A
		where CostCalculationPeriodID = @CostCalculationPeriodID
		union all
		select  CostCenterID,StuffID'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
		from [PRM].[Consumption_ReturnedOutgoing] A
		where CostCalculationPeriodID = @CostCalculationPeriodID
		union all
		select  CostCenterID,StuffID'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
		from [PRM].[Consumption_LastWorkingInventory] A
		where CostCalculationPeriodID = @CostCalculationPeriodID
		union all
		select  CostCenterID,StuffID'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
		from [PRM].[Consumption_ProductionDelivery] A
		where CostCalculationPeriodID = @CostCalculationPeriodID
		)A
		group by CostCenterID,StuffID'+ @CGroupByColumns+'
		having sum(MainQuantity) = 0 and sum(Price) <> 0
		'
		EXECUTE sp_executesql @Query,
								N'@CostCalculationPeriodID int',
								@CostCalculationPeriodID =  @CostCalculationPeriodID;

		IF EXISTS (SELECT 1 FROM #NegativeConsumption)
		BEGIN
			INSERT @error
			SELECT 'ProductionManagement.Messages.SomeItemsWithNegativeConsume', 0
						
			INSERT @error
			select N'ProductionManagement.Messages.StuffInCostCenter^'+b.code+N','+c.Title, 1
			from #NegativeConsumption a
				join stf.vwstuff b on a.stuffid = b.stuffid
				join cfg.costcenter c on c.CostCenterID = a.CostCenterId
			RETURN
		END

		set @query = N'
			insert into PRM.Consumption (CostCalculationPeriodID,CostCenterID,StuffID,Price,MainQuantity,[ConsumptionRate],DeviationQuantity,DeviationCost,LoopNumber,[StuffDetailType]'+ @CGroupByColumns+')
			select  @CostCalculationPeriodID,CostCenterID,StuffID,
					Sum(Price) Price,
					SUM(MainQuantity) MainQuantity,
					Sum(Price) / SUM(MainQuantity),
					0,
					0,
					0,
					[StuffDetailType]'+ @CGroupByColumns+'
			from
			(
			select  CostCenterID,StuffID,[StuffDetailType]'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
			from  [PRM].[Consumption_FirstWorkingInventory] A
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID,[StuffDetailType]'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
			from [PRM].[Consumption_Outgoing] A
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID,[StuffDetailType]'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
			from [PRM].[Consumption_ReturnedOutgoing] A
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID,[StuffDetailType]'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
			from [PRM].[Consumption_LastWorkingInventory] A
			where CostCalculationPeriodID = @CostCalculationPeriodID
			union all
			select  CostCenterID,StuffID,1 [StuffDetailType]'+ replace(@SelectColumns,'@','A')+',Price,MainQuantity	
			from [PRM].[Consumption_ProductionDelivery] A
			where CostCalculationPeriodID = @CostCalculationPeriodID
			)A
			group by CostCenterID,StuffID,[StuffDetailType]'+ @CGroupByColumns+'
			having sum(MainQuantity) <> 0
			'
		EXECUTE sp_executesql @Query,
					N'@CostCalculationPeriodID int',
					@CostCalculationPeriodID =  @CostCalculationPeriodID;

		;WITH CTE AS
		(
			select  Consumption.CostCenterId,
					Consumption.StuffID,
					BOM.Quantity - Consumption.MainQuantity DeviationQuantity
			from PRM.Consumption 
			join 
			(
			select CostCenterId,StuffID,sum(Quantity) Quantity
			from PRM.PeriodProductionBOM
			where CostCalculationPeriodID = @CostCalculationPeriodID
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
						
		DECLARE @CjoinColumns NVARCHAR(MAX)
		SELECT @CjoinColumns = STUFF(
					(
						SELECT ' AND ISNULL($.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(@.' + QUOTENAME(t.TraceID) + ', 0) '
						FROM   STF.Trace t
						where t.IsEffectiveInConsumeCost = 1
						ORDER BY
								t.TraceID
								FOR XML PATH('')
					),1,0,'');

		IF @CjoinColumns IS NULL
			SET @CjoinColumns = N'';

		DROP TABLE IF EXISTS #InConsumptionNotINBOM

		create table #InConsumptionNotINBOM
		( 
			StuffID int,
			CostCenterId int
		)
		select @query = N'
			insert into #InConsumptionNotINBOM
			select  Consumption.StuffID,Consumption.CostCenterId
			from PRM.Consumption  Consumption
			left join 
			(select *
			from PRM.PeriodProductionBOM a
			where a.CostCalculationPeriodID = @CostCalculationPeriodID
			)BOM on Consumption.CostCenterId = BOM.CostCenterId
				and Consumption.StuffID = BOM.StuffID
				'+REPLACE(REPLACE(@CjoinColumns,N'@',N'Consumption'),N'$',N'BOM')+'
			where Consumption.CostCalculationPeriodID = @CostCalculationPeriodID
			and Consumption.StuffDetailType = 0 
			and BOM.PeriodProductionBOMID is null
			group by  Consumption.StuffID,Consumption.CostCenterId
			'
		EXECUTE sp_executesql   @Query,
								N'@CostCalculationPeriodID int',
								@CostCalculationPeriodID =  @CostCalculationPeriodID;

		IF EXISTS (SELECT 1 FROM #InConsumptionNotINBOM)
		BEGIN
			INSERT @error 
			SELECT N'ProductionManagement.Messages.ConsumesWithoutSubmitFormula', 0

			SELECT N'ProductionManagement.Messages.StuffInCostCenter^'+b.code+N','+c.Title, 1
			FROM #InConsumptionNotINBOM a
				join stf.vwstuff b on a.stuffid = b.stuffid
				join cfg.costcenter c on c.CostCenterID = a.CostCenterId

			SELECT * FROM @error
			RETURN
		END
		
		SELECT * FROM @error
END
