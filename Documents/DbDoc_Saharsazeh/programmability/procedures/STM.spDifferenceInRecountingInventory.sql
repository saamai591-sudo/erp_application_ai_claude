
------------------------------[STM].spDifferenceInRecountingInventory--------------------------------------------------------------------------------------
CREATE   PROC [STM].[spDifferenceInRecountingInventory] 
    (
    @RecountingInventoryID varchar(max), 
    @CountingTurns TINYINT
    )
	--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
BEGIN TRY
    DROP TABLE IF EXISTS ##RecountingInventoryItemTemp
		
	DECLARE @RecountingInventoryTagID INT, 
			@StockID INT, 
			@Date DATETIME, 
			@FinancialPeriodID INT, 
			@ItemID INT,
			@Query nvarchar(max),
			@Columns nvarchar(max),
			@ConditionalInnerJoin nvarchar(max),
			@Params nvarchar(max),
			@TableName1 nvarchar(max)
		
	select  @RecountingInventoryTagID = RecountingInventoryTagID
		from STC.RecountingInventory 
	where RecountingInventoryID = @RecountingInventoryID 

	select  @StockID = rip.StockID, 
			@Date = rip.Date,
			@FinancialPeriodID = rip.FinancialPeriodID
		from STC.RecountingInventoryTag rit
		join STC.RecountingInventoryPeriod rip
			on rit.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
		where rit.RecountingInventoryTagID = @RecountingInventoryTagID 

	SET @TableName1 = cfg.getTempTableName(1)

	set @Query = N' IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '''+@TableName1+''')DROP TABLE '+@TableName1
	exec(@Query)


	SELECT @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)+' NVARCHAR(256)'
							FROM STF.Trace 
							FOR XML PATH(''), TYPE
							).value('.', 'NVARCHAR(MAX)'),1,1,'')

	IF(@Columns is null)								   
	SET @Columns = '[-1] NVARCHAR(256)'

	set @Query = N'create table '+@TableName1+'
	(	
		RowIndex int,
		[Date]	Date,
		StockID int,
		StuffID int,
		'+@Columns+'
		,MainQuantity Decimal(30,4),
		SubQuantity Decimal(30,4),
		MainInLine Decimal(30,4),
		SubInLine Decimal(30,4)
	) '

	exec(@Query)

	set @Query = N'insert into '+@TableName1+'
					exec [STC].[InventorySummaryBeforeCurrentRecountingInventory] '+cast(@FinancialPeriodID as varchar(20)) + ',' +cast(@RecountingInventoryID as varchar(20))
	exec(@Query)
	
	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

	IF(@Columns is null)								   
	SET @Columns = '[-1]'

	set @Query = N'
					select o.RecountingInventoryID,oi.RecountingInventoryTagItemid,StuffID,MainQuantity,SubQuantity,p.*
					into ##RecountingInventoryItemTemp
					from stc.RecountingInventoryItem o 
					INNER JOIN stc.RecountingInventoryTagItem oi on o.RecountingInventoryTagItemid = oi.RecountingInventoryTagItemid
					LEFT JOIN(select RecountingInventoryTagItemid id,TraceID,Case When DLID IS NOT NULL 
																 THEN cast (DLID as nvarchar(max)) else Value end Value
								from stc.RecountingInventoryTagItemTrace ) x
					pivot 
					(
						max(Value)
						for TraceID in ( ' + @Columns + ')
					) p on oi.RecountingInventoryTagItemid = p.id
					WHERE o.RecountingInventoryID = @pRecountingInventoryID
					AND o.[Type] = @pCountingTurns'

	SET @Params = N'@pRecountingInventoryID int,@pCountingTurns int'

	EXECUTE sp_executeSQL     
            @Query,
            @Params,
            @pRecountingInventoryID= @RecountingInventoryID ,
			@pCountingTurns = @CountingTurns


	select @ConditionalInnerJoin  =  STUFF((SELECT distinct ' AND (source.'+ QUOTENAME(TraceID)+' is null or target.' +
						 QUOTENAME(TraceID)+'= source.' + QUOTENAME(TraceID)+')'
								FROM STF.Trace
								FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,'')								   

	if(@ConditionalInnerJoin is null)						   
	    set @ConditionalInnerJoin = ''	

	IF OBJECT_ID('DifferThanInventoryTemp') IS Not NULL
	DROP TABLE DifferThanInventoryTemp
	
	CREATE TABLE  DifferThanInventoryTemp
	( 
	    ID INT ,
	    RecountingInventoryID INT,
	    RecountingInventoryTagItemID INT,
	    RecountedMainQuantity  Decimal(30,4),
	    RecountedSubQuantity  Decimal(30,4),
	    InventoryMainQuantity  Decimal(30,4),
	    InventorySubQuantity  Decimal(30,4),	
	    CONSTRAINT [PK_LessThanInventoryTemp] PRIMARY KEY CLUSTERED 
	    (
		    ID ASC
	    )WITH (PAD_INDEX  = OFF, STATISTICS_NORECOMPUTE  = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS  = ON, ALLOW_PAGE_LOCKS  = ON) ON [PRIMARY]
	) ON [PRIMARY]

		
	set @Query = 'insert into DifferThanInventoryTemp
					SELECT ROW_NUMBER() OVER (ORDER BY RecountingInventoryTagItemID),RecountingInventoryID,
						 RecountingInventoryTagItemid,source.MainQuantity,source.SubQuantity,MainInLine,SubInLine
					from ##RecountingInventoryItemTemp source
					left join 
					(
						SELECT row_number() over(partition by Stuffid ,'+@Columns+' order by RowIndex DESC ) Rno,*
						FROM '+@TableName1+'
						WHERE StockID = @pStockID
						and date <= @pDate
					) target on source.stuffid = target.stuffid
							  '+@ConditionalInnerJoin+'
							  where 
							  source.MainQuantity <> isnull(MainInLine,0)
							  and 
							  (Rno is null or Rno = 1)'

							  					  	
	SET @Params = N'@pStockID INT,@pDate Date'
	EXECUTE sp_executeSQL     
				@Query,
				@Params,
				@pStockID = @StockID,
				@pDate = @Date	

	select t.TagNumber,
	       s.Code,
		   s.Title,
		   d.RecountedMainQuantity,
		   d.RecountedSubQuantity,
		   d.InventoryMainQuantity,
		   d.InventorySubQuantity,
		   d.RecountingInventoryID,
		   s2.Title StockTitle,
		   s2.Code StockCode,
		   s2.Supervisor,
		   cfg.GetSaturnDate(rip.date,0) date,
		   im.Title InventoryMethod,
		   MainMeasureUnit MeasureUnit,
		   B.Title Branch,
		   rip.Number
	from DifferThanInventoryTemp d
	join stc.RecountingInventoryTagItem t on d.RecountingInventoryTagItemID = t.RecountingInventoryTagItemID
	join stf.vwStuff s on s.StuffID = t.StuffID
	join stc.RecountingInventoryTag h on h.RecountingInventoryTagID = t.RecountingInventoryTagID
	join STC.RecountingInventoryPeriod rip on h.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
	join stc.InventoryMethod im on im.InventoryMethodID = rip.InventoryMethodID
	join stf.Stock s2 on s2.StockID = rip.StockID
	JOIN CFG.Branch B ON B.BranchID = S2.BranchID
		
	IF OBJECT_ID('DifferThanInventoryTemp') IS Not NULL
	DROP TABLE DifferThanInventoryTemp

	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp')DROP TABLE ##RecountingInventoryItemTemp
		set @Query = N' IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '''+@TableName1+''')DROP TABLE '+@TableName1
	exec(@Query)

	END TRY
	BEGIN CATCH
		IF CURSOR_STATUS('global','db_cursor') >= -1
		BEGIN
		 DEALLOCATE db_cursor
		END

		IF OBJECT_ID('DifferThanInventoryTemp') IS Not NULL
		DROP TABLE DifferThanInventoryTemp

		IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp')DROP TABLE ##RecountingInventoryItemTemp
			set @Query = N' IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '''+@TableName1+''')DROP TABLE '+@TableName1
	exec(@Query)

		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();
		
		RAISERROR (@ErrorMessage, -- Message text.
				   @ErrorSeverity, -- Severity.
				   @ErrorState -- State.
				   );
	END CATCH;
