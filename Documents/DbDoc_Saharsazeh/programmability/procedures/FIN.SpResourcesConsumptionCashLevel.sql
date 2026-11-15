
---------------------------------------------------------------------------------------
CREATE   proc FIN.SpResourcesConsumptionCashLevel
(
@FromDate DATE,
@ToDate DATE,
@CashLevelOrder int,
@SelectedBranches VARCHAR(max) = NULL,
@SelectedCashStructures nvarchar(max) = null --N'L1#ID1,ID2|L2#ID5,ID6'
)
as

	declare @FilterCategoryIDs nvarchar(max) 

	  IF OBJECT_ID('tempdb..#FilterCategory') IS Not NULL
	 DROP TABLE #FilterCategory

	SELECT VALUE BranchID into #SelectedBranch
	FROM CFG.R_FnCommaStr2Table(@SelectedBranches)
			
	SELECT * into #vwBranchAccess
	FROM cfg.vwBranchAccess AS vba
		
	 SELECT vba.* into #BranchAccess
	 FROM #vwBranchAccess AS vba
	 left join #SelectedBranch AS sb on vba.BranchID = sb.BranchID
	 WHERE (@SelectedBranches is NULL or sb.BranchID is NOT NULL) 
	 
	 create table #FilterCategory
	 (
	 [level] int
	 )

	 insert into #FilterCategory
	 select [CFG].[GetStringPartBySpliter](value,1,'#')
	 from [CFG].[Split] (@SelectedCashStructures,'|')

	select @FilterCategoryIDs = STUFF(
										(SELECT DISTINCT ',' +  [CFG].[GetStringPartBySpliter](value,2,'#') 
										 from [CFG].[Split] (@SelectedCashStructures,'|')
										 FOR XML PATH(''), TYPE
										).value('.', 'NVARCHAR(MAX)'),1,1,''
									 )

	 IF OBJECT_ID('tempdb..#FilterCategoryIDs') IS Not NULL
	 DROP TABLE #FilterCategoryIDs

	 create table #FilterCategoryIDs
	 (
	 CashStructureID int
	 )


	 insert into #FilterCategoryIDs
	 select value
	 from [CFG].[Split] (@FilterCategoryIDs,',')

	if OBJECT_ID('tempdb..#CashStructure') is not null  drop table #CashStructure
	if OBJECT_ID('tempdb..##CashStructureTemp1') is not null  drop table ##CashStructureTemp1
	if OBJECT_ID('tempdb..##CashStructureTemp') is not null  drop table ##CashStructureTemp
	if OBJECT_ID('tempdb..#ResourcesConsumption') is not null  drop table #ResourcesConsumption


	
	select CashStructureID
	into #CashStructure
	from
	(
		select CashStructureID 
		from fin.ReceiptType
		where CashStructureID is not null
		union all
		select CashStructureID 
		from fin.PaymentType
		where CashStructureID is not null
	)a
	group by CashStructureID

	declare @Columns nvarchar(max),
			@Query   nvarchar(max)
	select @Columns = STUFF(
							(SELECT DISTINCT ',' +  QUOTENAME([Order])
								from fin.CashLevel
								FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,''
							)
	set @Query = N'
	;WITH cte
	AS (
		select  b.CashStructureID,
				b.ParentID,
				a.CashStructureID LastNode,
				c.[Order]
		from #CashStructure a
		join fin.CashStructure b on a.CashStructureID = b.CashStructureID
		join fin.CashLevel c on c.CashLevelID = b.CashLevelID
		union all
		select  b.CashStructureID,
				b.ParentID,
				a.LastNode,
				c.[Order]
		from cte a
		join fin.CashStructure b on a.ParentID = b.CashStructureID
		join fin.CashLevel c on c.CashLevelID = b.CashLevelID
	   )
	   select * 
	   into ##CashStructureTemp1
	   from
	   (select LastNode,
			   CashStructureID,
			   [Order]
	   from cte a
		)x
		pivot
		(
		max(CashStructureID)
		for [Order] in ('+@Columns+')
		)p
		'
		exec(@Query)
		print @Query
	declare @i int ,@WhereClose nvarchar(max)
	select @i = max([order])
	from fin.CashLevel

	while @i >= 1
	begin
		set @WhereClose = N'  ('+cast(@i as varchar(10))+' not in (select level from #FilterCategory) or p.'+QUOTENAME(@i)+
							   ' in (select CashStructureID from #FilterCategoryIDs)) and'
		set @i = @i - 1
	end
	set @WhereClose = STUFF(@WhereClose,len(@WhereClose)-2, 3, '')
	set @Query = N'
	select LastNode,p.'+QUOTENAME(@CashLevelOrder)+' CashStructureID
	into ##CashStructureTemp
	from ##CashStructureTemp1 p
	where '+ @WhereClose

	exec(@Query)

		
	select  CashStructureID,
			SUM(case when AmountInBaseCurrency > 0 then AmountInBaseCurrency else 0 end) [Receive],
			SUM(case when AmountInBaseCurrency < 0 then AmountInBaseCurrency else 0 end) [Payment],
			SUM(AmountInBaseCurrency) Net
	into #ResourcesConsumption
	from [FIN].VWResourcesConsumption vrc
	join #BranchAccess vba on vrc.BranchID = vba.BranchID
	where Date BETWEEN @FromDate AND @ToDate
	group by CashStructureID

	select 
		b.CashLevelID,
		b.CashStructureID,
		b.Code,
		b.Title,
		a.[Receive],
		a.Payment,
		a.Net
	from
	(
	select b.CashStructureID,SUM([Receive]) [Receive],SUM([Payment]) [Payment],SUM(Net) Net
	from #ResourcesConsumption a
	join ##CashStructureTemp b on a.CashStructureID = b.LastNode
	group by b.CashStructureID
	)a
	join fin.CashStructure b on a.CashStructureID = b.CashStructureID;
