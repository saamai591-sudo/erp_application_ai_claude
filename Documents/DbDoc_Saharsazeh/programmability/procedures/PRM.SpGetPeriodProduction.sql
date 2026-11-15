
CREATE   PROC [PRM].SpGetPeriodProduction
(
	@CostCalculationPeriodID int
)
AS
BEGIN
	DECLARE @query NVARCHAR(MAX),
			@Columns NVARCHAR(MAX),
			@SelectColumns NVARCHAR(MAX),
			@StartDate Date,
			@EndDate Date,
			@joinColumns nvarchar(max),
			@PreCostCalculationPeriodID		int,
			@Message NVARCHAR(MAX),
			@Detail NVARCHAR(MAX)

					
	DECLARE @error TABLE (
		[Message] NVARCHAR(100) ,
		IsDetail BIT
	)

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
		where t.IsEffectiveInProduceCost = 1
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

	IF (@Columns IS NULL)
		SET @Columns = N'[-1]';

	SELECT @SelectColumns = STUFF(
	(
		SELECT DISTINCT
				',' + QUOTENAME(TraceID)
		FROM STF.Trace t
		where t.IsEffectiveInProduceCost = 1
		FOR XML PATH(''), TYPE
	).value('.', 'NVARCHAR(MAX)'),1   ,0  ,'');

	IF (@SelectColumns IS NULL)
		SET @SelectColumns = N'';

	delete from PRM.PeriodProduction where CostCalculationPeriodID = @CostCalculationPeriodID
	delete from PRM.Production_FirstWorkingInventory where CostCalculationPeriodID = @CostCalculationPeriodID

	set @query = N' insert INTO  PRM.PeriodProduction
						(CostCalculationPeriodID,
							CostCenterId,
							StuffID,
							Quantity,
							Fee,
							ProductionFormulaItemID
							'+@SelectColumns+N'
							)
					select  @CostCalculationPeriodID,
							CostCenterId,
							StuffID,
							SUM(Quantity),
							0,
							ProductionFormulaItemID
							'+@SelectColumns+'
					from
					(
						select CostCenterId,StuffID,'+@Columns+',psi.ProductionFormulaItemID,
								Sum(MainQuantity) Quantity
						from prm.ProductionStatistic ps
						join prm.ProductionStatisticItem psi
							on ps.ProductionStatisticID = psi.ProductionStatisticID
						LEFT JOIN (
									select ProductionStatisticItemID,iit.TraceID,
									case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
											when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
											else Value end value
									from prm.ProductionStatisticItemTrace iit
									join stf.trace t on t.traceid = iit.traceid
								)x 
								pivot
								(
								max(value)
								for traceid in (' + @Columns+ N')
								)p on p.ProductionStatisticItemID = psi.ProductionStatisticItemID
						where 	ps.Date between @StartDate and 	@EndDate
						group by CostCenterId,StuffID,psi.ProductionFormulaItemID,'+@Columns+'
					)A
					group by CostCenterId,StuffID,ProductionFormulaItemID,'+@Columns+'
					having SUM(Quantity) <> 0 '

	EXECUTE sp_executesql @query,
							N'@StartDate datetime,
							@EndDate datetime,
							@CostCalculationPeriodID int',
							@StartDate = @StartDate,
							@EndDate = @EndDate,
							@CostCalculationPeriodID = @CostCalculationPeriodID

	IF NOT EXISTS (SELECT * FROM  [PRM].[PeriodProduction] WHERE CostCalculationPeriodID = @CostCalculationPeriodID)
	BEGIN
		--RAISERROR('برای این دوره هیچ تولیدی ثبت نشده است.',16,13)
		SET @message = N'ProductionManagement.Messages.PeriodWithoutProduce';
		INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
		SELECT * from @error;
		RETURN;
	END

	IF  EXISTS (SELECT * FROM  [PRM].[PeriodProduction] WHERE CostCalculationPeriodID = @CostCalculationPeriodID AND Quantity < 0)
	BEGIN
		--RAISERROR('آمار تولید ثبت شده دارای اشکال است.',16,13)		
		SET @message = N'ProductionManagement.Messages.ProductionStatisticsHasIssue';
		INSERT @error ([Message] , IsDetail) VALUES (@message , 0);
		SELECT * from @error;
		RETURN;
	END
	
	set @query = N'
	insert into PRM.Production_FirstWorkingInventory
	select  @CostCalculationPeriodID,wi.CostCenterId,wii.StuffID,Price,MainQuantity'+@SelectColumns+'
	from prm.WorkingInventory wi
	join prm.WorkingInventoryItem wii
		on wi.WorkingInventoryID = wii.WorkingInventoryID
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
	where wi.CostCalculationPeriodID = @PreCostCalculationPeriodID
	and wi.[Type] = 2'
					
	EXECUTE sp_executesql @Query,
							N'@PreCostCalculationPeriodID int,
							@CostCalculationPeriodID int',
							@PreCostCalculationPeriodID =  @PreCostCalculationPeriodID,
							@CostCalculationPeriodID = @CostCalculationPeriodID;

	SELECT @joinColumns = STUFF(
				(
					SELECT ' AND ISNULL(#A.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(#B.' + QUOTENAME(t.TraceID) + ', 0) '
					FROM   STF.Trace AS t
					where t.IsEffectiveInProduceCost = 1
					ORDER BY
							t.TraceID
					FOR XML PATH('')
				),1,0,'');

	IF @joinColumns IS NULL
		SET @joinColumns = N'';

	declare @GroupByColumn nvarchar(max)
	SELECT @GroupByColumn = STUFF(
				(
					SELECT ',' + QUOTENAME(t.TraceID)
					FROM   STF.Trace AS t
					where t.IsEffectiveInProduceCost = 1
					ORDER BY
							t.TraceID
							FOR XML PATH('')
				),1,0,'');

	IF @GroupByColumn IS NULL
		SET @GroupByColumn = N'';

	DROP TABLE IF EXISTS #NotBalanced

	create table #NotBalanced
	( 
	CostCenterId int,
	StuffID int
	)

	set @query = N'
		select  CostCenterID,
				StuffID
				'+@GroupByColumn+',
				sum(MainQuantity) MainQuantity
			into #A
		from
		(
			select  CostCenterID,StuffID'+ @SelectColumns+',MainQuantity	
			from  [PRM].[Production_FirstWorkingInventory] 
			where CostCalculationPeriodID = @CostCalculationPeriodID

			union all

			select  CostCenterID,StuffID'+ @SelectColumns+',Quantity MainQuantity	
			from [PRM].[PeriodProduction] 
			where CostCalculationPeriodID = @CostCalculationPeriodID
		)A
		group by CostCenterID,StuffID'+ @GroupByColumn+'
				
		select  CostCenterID,
				StuffID
				'+@GroupByColumn+',
				sum(MainQuantity) MainQuantity
			into #B
		from
		(
			select  CostCenterID,StuffID'+ @SelectColumns+',MainQuantity	
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
			where CostCalculationPeriodID = @CostCalculationPeriodID
			and wi.[Type] = 2

			union all

			select  CostCenterID,StuffID'+ @SelectColumns+',MainQuantity	
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
			where pd.Date between @StartDate and @EndDate

			union all

			select  CostCenterID,StuffID'+ @SelectColumns+',MainQuantity	
			from stc.StockReceipt sr
			join stc.StockReceiptItem sri on sr.StockReceiptID = sri.StockReceiptID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
				ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
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
			where sr.Date between @StartDate and @EndDate
			and sdt.DocumentType = 0
		)A
		group by CostCenterID,StuffID'+ @GroupByColumn+'		
				
		insert into #NotBalanced
		select CostCenterID,StuffID
		from
		(
		select isnull(#A.StuffID,#B.StuffID)  StuffID,isnull(#A.CostCenterID,#B.CostCenterID) CostCenterID
		from #A
		full outer join #B on #A.CostCenterID = #B.CostCenterID
							and #A.StuffID = #B.StuffID
							'+@joinColumns+'
		where isnull(#A.MainQuantity,0) <> isnull(#B.MainQuantity,0)
		)T group by CostCenterID,StuffID

	'
	EXECUTE sp_executesql @Query,
							N'@CostCalculationPeriodID int,
							@StartDate Date,
							@EndDate Date' ,
							@CostCalculationPeriodID =  @CostCalculationPeriodID,
							@StartDate = @StartDate,
							@EndDate = @EndDate;


	IF EXISTS (SELECT 1 FROM #NotBalanced)
	BEGIN
		SET @message = N'ProductionManagement.Messages.IssueOnProduceAndWageReport';
		INSERT @error ([Message] , IsDetail) VALUES (@message , 0);

		INSERT @error ([Message] , IsDetail)
		select N'ProductionManagement.Messages.StuffInCostCenter^'+b.code+N','+ c.Title , 1
		from #NotBalanced a
			join stf.vwstuff b on a.stuffid = b.stuffid
			join cfg.costcenter c on c.CostCenterID = a.CostCenterId
		SELECT * from @error;
		RETURN;
	END

	SELECT * FROM @error
END;
