
------------------------------[STM].spInventoryInRecountingStage-----------------------------------------------------------------------------------------
CREATE    PROC [STM].[spInventoryInRecountingStage] 
    @RecountingInventoryID varchar(max)
	--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	BEGIN TRY
	
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp')DROP TABLE ##RecountingInventoryItemTemp
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp1')DROP TABLE ##RecountingInventoryItemTemp1

		
		DECLARE @RecountingInventoryTagID INT, 
				@StockID INT, 
				@Date DATETIME, 
				@FinancialPeriodID INT, 
				@ItemID INT,
				@Query nvarchar(max),
				@Columns nvarchar(max),
				@ConditionalInnerJoin nvarchar(max),
				@Params nvarchar(max),
				@TableName1 nvarchar(max),
				@StockTitle  nvarchar(max),
				@BranchTitle nvarchar(max),
				@InventoryMethod nvarchar(max),
				@Supervisor  nvarchar(max),
				@StockCode int
		
		select  @RecountingInventoryTagID = RecountingInventoryTagID
		 from STC.RecountingInventory 
		where RecountingInventoryID = @RecountingInventoryID 
		

	select  @StockID = rip.StockID, 
			@Date = rip.Date,
			@FinancialPeriodID = rip.FinancialPeriodID,
			@InventoryMethod = im.Title
		from STC.RecountingInventoryTag a
		join STC.RecountingInventoryPeriod rip
			on a.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID 
		join stc.InventoryMethod im
			on rip.InventoryMethodID = im.InventoryMethodID
		where a.RecountingInventoryTagID = @RecountingInventoryTagID

	select @StockTitle = a.title ,
		   @BranchTitle = b.title,
		   @Supervisor = a.Supervisor,
		   @StockCode = a.Code
	from stf.stock a
	join cfg.Branch b on a.BranchID = b.BranchID
	where stockid = @StockID

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

	declare @SelectList varchar(max)
	SELECT @SelectList = STUFF((SELECT DISTINCT ',' + QUOTENAME(TraceID) +' as T_'+cast(TraceID as varchar(50))
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,0,'')
if @SelectList is null set @SelectList = ''
	set @Query = N'select o.RecountingInventoryID,oi.RecountingInventoryTagItemid,oi.StuffID,MainQuantity,oi.TagNumber,
					SubQuantity,o.[Type] RecountingStage'+@SelectList+'
					into ##RecountingInventoryItemTemp1
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
					WHERE o.RecountingInventoryID = @pRecountingInventoryID'

	SET @Params = N'@pRecountingInventoryID int'

	EXECUTE sp_executeSQL     
            @Query,
            @Params,
            @pRecountingInventoryID= @RecountingInventoryID 


	set @Query = N'
					select *
					into ##RecountingInventoryItemTemp
					from 
					(select * from ##RecountingInventoryItemTemp1 ) x
					pivot 
					(
						max(MainQuantity)
						for RecountingStage in ([1],[2],[3])
					) p'

	SET @Params = N'@pRecountingInventoryID int'
	
	EXECUTE sp_executeSQL     
            @Query,
            @Params,
            @pRecountingInventoryID= @RecountingInventoryID 



	select @ConditionalInnerJoin  =  STUFF((SELECT distinct ' AND (source.T_'+ cast(TraceID as varchar(50))+' is null or target.' +
						 QUOTENAME(TraceID)+'= source.T_' + cast(TraceID as varchar(50))+')'
								FROM STF.Trace
								FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,'')								   


	if(@ConditionalInnerJoin is null)						   
	set @ConditionalInnerJoin = ''	


	IF OBJECT_ID('DifferThanInventoryTemp') IS Not NULL
	DROP TABLE DifferThanInventoryTemp
	
	CREATE TABLE  DifferThanInventoryTemp
	( 
	RecountingInventoryID int,
	TagNumber INT ,
	StuffID INT ,
	FirstRecounted  Decimal(30,4),
	SecondRecounted  Decimal(30,4),
	ThirdRecounted  Decimal(30,4),
	InventoryMainQuantity  Decimal(30,4),	
	InventorySubQuantity  Decimal(30,4)
	)


	set @Query = 'insert into DifferThanInventoryTemp
					SELECT RecountingInventoryID,TagNumber,source.StuffID,source.[1],source.[2],source.[3],MainInLine,SubInLine
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
							  (Rno is null or Rno = 1)'

							  					  	
	SET @Params = N'@pStockID INT,@pDate Date'
	EXECUTE sp_executeSQL     
				@Query,
				@Params,
				@pStockID = @StockID,
				@pDate = @Date	


select StuffID,Code,Title,MainMeasureUnit MeasureUnit
into #Stuff
from  stf.vwStuff 

	select RecountingInventoryID,
		   TagNumber,
	       s.Code,
		   s.Title,
		   d.FirstRecounted,
		   d.SecondRecounted,
		   d.ThirdRecounted,
		   d.InventoryMainQuantity,
		   d.InventorySubQuantity,
		   @StockTitle StockTitle,
		   cfg.GetSaturnDate(@Date,0) date,
		   @InventoryMethod InventoryMethod,
		   MeasureUnit,
		   @BranchTitle Branch,
		   @Supervisor Supervisor,
		   @StockCode StockCode
	from DifferThanInventoryTemp d
	join #Stuff s on s.StuffID = d.StuffID
		
	IF OBJECT_ID('DifferThanInventoryTemp') IS Not NULL
	DROP TABLE DifferThanInventoryTemp



	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp')DROP TABLE ##RecountingInventoryItemTemp
	IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp1')DROP TABLE ##RecountingInventoryItemTemp1
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
		IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##RecountingInventoryItemTemp1')DROP TABLE ##RecountingInventoryItemTemp1
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
