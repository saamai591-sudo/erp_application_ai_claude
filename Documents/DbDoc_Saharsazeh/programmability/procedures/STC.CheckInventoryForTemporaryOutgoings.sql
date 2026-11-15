CREATE   proc STC.CheckInventoryForTemporaryOutgoings
(
@id int
)
--WITH ENCRYPTION 
as

declare @Query  AS NVARCHAR(MAX),
		@Columns AS NVARCHAR(MAX),
		@ColumnsForCreateTable AS NVARCHAR(MAX),
		@WhereClose AS NVARCHAR(MAX),
		@TableName2 Nvarchar(250),
		@FinancialPeriodID int,
		@Stuffid int,
		@stockid int,
		@date  date,
		@MainQuantity decimal(30,4),
		@NegativeInventoryMustBeChecked bit = 0

 
	SET @TableName2 = cfg.getTempTableName(1);

	
	SELECT @Columns = STUFF((SELECT DISTINCT ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									WHERE CheckInventory =1
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

	IF(@Columns is null)								   
	SET @Columns = '[-1]'

        SELECT @ColumnsForCreateTable = STUFF(
        (
            SELECT ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
            FROM STF.Trace
            WHERE CheckInventory = 1
            ORDER BY TraceID
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

        IF (@ColumnsForCreateTable IS NULL)
            SET @ColumnsForCreateTable = N'[-1] NVARCHAR(256)';

	set @Query = N'	select oi.TemporaryOutgoingItemID as ParentId,StuffID,StockID,[DATE],
						   FinancialPeriodID,MainQuantity,SubQuantity,p.*
					into ##SourceTemp
					from stc.TemporaryOutgoing o 
					INNER JOIN stc.TemporaryOutgoingItem oi on o.TemporaryOutgoingID = oi.TemporaryOutgoingID
					LEFT JOIN(select TemporaryOutgoingItemID,TraceID,Case When DLID IS NOT NULL 
					THEN cast (DLID as nvarchar(max))  when TraceItemID is not null then cast (TraceItemID as nvarchar(max)) else Value end Value
								from stc.TemporaryOutgoingItemTrace ) x
					pivot 
					(
							max(Value)
						for TraceID in ( ' + @Columns + ')
					) p on oi.TemporaryOutgoingItemID = p.TemporaryOutgoingItemID
					Where oi.TemporaryOutgoingItemID = @pID '

	EXECUTE sp_executeSQL     
				@Query,
				N'@pID INT',
				@pID= @ID 



		select  @FinancialPeriodID = FinancialPeriodID,
				@stockid = stockid,
				@Stuffid = stuffid,
				@date = date,
				@MainQuantity = MainQuantity
		from ##SourceTemp




        
	SELECT @WhereClose  =  STUFF((SELECT distinct '  AND ISNULL(' + 
	QUOTENAME(TraceID)+',0)= ISNULL( (Select ' + QUOTENAME(TraceID)+' from ##SourceTemp),0) '
				FROM STF.Trace
				WHERE CheckInventory =1
				FOR XML PATH(''), TYPE
				).value('.', 'NVARCHAR(MAX)'),1,1,'')
		   
	IF(@WhereClose is null)						   
	SET @WhereClose = ''

		set @Query = N'	select sum(Non) Non_Returned
					into ##TemporaryOutgoingTemp
					from stc.TemporaryOutgoing o 
					INNER JOIN stc.TemporaryOutgoingItem oi on o.TemporaryOutgoingID = oi.TemporaryOutgoingID
					JOIN STC.TemporaryOutgoing_Remain tor ON tor.TemporaryOutgoingItemID = oi.TemporaryOutgoingItemID
					LEFT JOIN(select TemporaryOutgoingItemID,TraceID,Case When DLID IS NOT NULL 
					THEN cast (DLID as nvarchar(max)) else Value end Value
								from stc.TemporaryOutgoingItemTrace ) x
					pivot 
					(
							max(Value)
						for TraceID in ( ' + @Columns + ')
					) p on oi.TemporaryOutgoingItemID = p.TemporaryOutgoingItemID
					where StuffID = @pStuffID
					And StockID = @pStockID
					and date <= @pDate and oi.TemporaryOutgoingItemID <> @pID ' + @WhereClose 

		EXECUTE sp_executeSQL     
		@Query,
		N'@pStuffID INT,@pStockID INT,@pDate date,@pID INT'	,
		@pStuffID = @StuffID,
		@pStockID = @StockID   ,
		@pDate = @Date,
		@pID= @ID 



        DECLARE @StartDate DATE;

        SELECT TOP (1)
                @StartDate = DATEADD(DAY, 1, a.EndDate)
        FROM CFG.FinancialPeriod a
        JOIN STC.StockClosingOperation b
            ON a.FinancialPeriodID = b.FinancialPeriodID
        WHERE b.StockID = @StockID
        ORDER BY a.EndDate DESC;

        IF @StartDate IS NULL
        BEGIN
            SELECT top 1 @StartDate = StartDate
            FROM CFG.FinancialPeriod
            ORDER BY StartDate ;
        END;

EXEC stc.spGetInventoryInDate
     @StuffId = Null,
     @stockID = @stockid,
     @ToDate = @date,
     @FinalTable = @TableName2


		set @Query = 'SELECT top 1 *	
						into ##TargetTemp 
					  from '+@TableName2+'						
					  where 1 = 1 ' + @WhereClose 
						
EXEC (@Query)

		declare @Non_Returned decimal(30,4)

		set @Non_Returned = isnull((select Non_Returned from ##TemporaryOutgoingTemp ),0)


		IF ( SELECT s.NegativeInventoryChecking FROM STF.Stock as s WHERE s.StockID = @StockID ) = 1
			SET @NegativeInventoryMustBeChecked = 1;

		IF  @NegativeInventoryMustBeChecked = 1
			AND
			(
				NOT EXISTS (SELECT * FROM ##TargetTemp )
				OR
					EXISTS (SELECT * FROM ##TargetTemp WHERE  MainQuantity < @MainQuantity)
				OR
					(SELECT MainQuantity FROM ##TargetTemp) - @Non_Returned < @MainQuantity
			)
		BEGIN
			DECLARE @Message nvarchar(max),@StuffTitle nvarchar(max)
			SELECT @StuffTitle = title FROM stf.stuff WHERE stuffid = (select top 1 stuffid from ##SourceTemp)
			
			SET @Message = 'کالای '+@StuffTitle+' فاقد موجودی است.'
			
			RAISERROR(@Message,16,13)
		END
			

IF object_id('tempdb..##SourceTemp','U') is not null
 DROP TABLE ##SourceTemp


IF object_id('tempdb..##TemporaryOutgoingTemp','U') is not null
 DROP TABLE ##TemporaryOutgoingTemp

IF object_id('tempdb..##TargetTemp','U') is not null
 DROP TABLE ##TargetTemp

