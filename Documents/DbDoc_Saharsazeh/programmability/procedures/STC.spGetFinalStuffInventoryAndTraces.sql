
---------------------------------[STC].spGetFinalStuffInventoryAndTraces----------------------------------
CREATE    PROC [STC].spGetFinalStuffInventoryAndTraces
   ( @RecountingInventoryPeriodID INT, 
    @FinancialPeriodID INT,
    @CreatorId NVARCHAR(255))
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

DECLARE @stockId INT,
        @date DATE,
        @minquantity DECIMAL(16, 4),
        @inventoryMethodId INT;

SELECT @stockId = rip.StockID,
       @minquantity = im.MinQuantity,
       @date = rip.[Date],
       @inventoryMethodId = im.InventoryMethodID
FROM STC.RecountingInventoryPeriod rip
    JOIN STC.InventoryMethod im
        ON im.InventoryMethodID = rip.InventoryMethodID
WHERE rip.RecountingInventoryPeriodID = @RecountingInventoryPeriodID;

-- validate RecountingInventoryTag
IF (Exists (SELECT 1 FROM [STC].StockClosingOperation WHERE FinancialPeriodID = @FinancialPeriodID and StockID=@StockID )) 
BEGIN	
	RAISERROR('STC_SpFinalStuffInventory_1',16,13)
	RETURN 0
END	

IF (Exists (SELECT 1 FROM [STC].[RecountingInventoryTag] rit
				JOIN [STC].[RecountingInventoryPeriod] rip
					ON rit.RecountingInventoryPeriodID = rip.RecountingInventoryPeriodID
				WHERE rip.FinancialPeriodID = @FinancialPeriodID AND rip.StockID=@StockID
                AND rit.Status = 0)) 
BEGIN	
	RAISERROR('STC_spRecountingInventoryTagInsert_2',16,13)
	RETURN 0		
END

DECLARE @Columns AS NVARCHAR(MAX),
		@ColumnsForCreateTable NVARCHAR(MAX),
        @Query AS NVARCHAR(MAX),
        @MaxRecountingInventoryTagItemID INT,
        @Creator INT,
        @TableName1 NVARCHAR(250),
        @TableName2 NVARCHAR(250),
		@TableName3 NVARCHAR(250),
        @TableName4 NVARCHAR(250),
		@InventoryTable NVARCHAR(250);

SET @Creator = cfg.GetuserID();
SET @TableName1 =	  CFG.getTempTableName(1);
SET @TableName2 =	  CFG.getTempTableName(1);
SET @TableName3 =	  CFG.getTempTableName(1);
SET @TableName4 =	  CFG.getTempTableName(1);
SET @InventoryTable = CFG.getTempTableName(1);

SELECT @Columns = STUFF(
(
    SELECT ',' + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE CheckInventory = 1
	 ORDER BY TraceID
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

IF (@Columns IS NULL)
    SET @Columns = N'[-1]';

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
	
exec stc.spGetInventoryInDate
	@StuffId  =   null,
	@stockID =    @stockId,
	@ToDate =	  @date,
	@FinalTable = @TableName1

SET @Query = N' select
					StuffID,
					date,
					'+@Columns+',
					sum(MainQuantity) over(partition by Stockid,Stuffid,' + @Columns + ' order by date,MainQuantity DESC) MainInLine,
					sum(SubQuantity) over(partition by Stockid,Stuffid,' + @Columns + ' order by date,MainQuantity DESC) SubInLine
					into ' + @TableName2 + '
				from '+@TableName1+' t
				WHERE   t.date <= @Date'
EXECUTE sp_executesql @Query,
						N'@Date DATE',
						@Date = @Date

SET @MaxRecountingInventoryTagItemID = ISNULL(
                                (
                                    SELECT MAX(RecountingInventoryTagItemID)
                                    FROM STC.RecountingInventoryTagItem
                                ),
                                0
                                        );

SELECT Stuffid,Code StuffCode,StuffAccountGroupID
INTO #Stuff
FROM STF.vwStuff
WHERE isActive = 1

SET @Query =
    N'
	select 
	row_number() over(order by StuffCode) as TagNumber,
	row_number() over(order by StuffCode) + @pMaxRecountingInventoryTagItemID ID,
	StuffID,' + @Columns + N'		
	into ' + @TableName3 + N'
	from (
		SELECT row_number() over(partition by t.Stuffid ,' + @Columns + N' order by t.date DESC ) Rno,
		t.*,s.StuffCode
		FROM ' + @TableName2 + N' AS t
		join #Stuff s ON s.StuffID = t.StuffID
		)A where Rno = 1  AND maininline >= @minquantity';

EXECUTE sp_executesql @Query,
                      N'@pMaxRecountingInventoryTagItemID int,@inventoryMethodId int,@minquantity int',
                      @inventoryMethodId = @inventoryMethodId,
                      @minquantity = @minquantity,
                      @pMaxRecountingInventoryTagItemID = @MaxRecountingInventoryTagItemID;

SET @Query = N'
		select ID,TraceID,Value into ' + @TableName4 + N'  from
		( select ID,' + @Columns + N' from ' + @TableName3 + N'
		)x
		UNPIVOT
		(
		Value For TraceID  IN (' + @Columns + N')
		)A
		';
EXEC (@Query);

-- insert RecountingInventoryTag 
INSERT INTO [STC].[RecountingInventoryTag]
           ([Status]
           ,[Version]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[RecountingInventoryPeriodID])
	SELECT  3, 0, @Creator, GETDATE(), @Creator, GETDATE(), @RecountingInventoryPeriodID

DECLARE @RecountingInventoryTagID INT = SCOPE_IDENTITY()

-- insert RecountingInventoryTagItem
SET @Query = N'
		SET IDENTITY_INSERT [STC].[RecountingInventoryTagItem] ON;
			INSERT  INTO [STC].[RecountingInventoryTagItem]
						( [RecountingInventoryTagItemID] ,
						  [RecountingInventoryTagID] ,
						  [StuffID] ,
						  [Version] ,
						  [Creator] ,
						  [CreationDate] ,
						  [LastEditor] ,
						  [LastEditionDate] ,
						  [TagNumber]
						)
						SELECT  [ID] ,
								@RecountingInventoryTagID ,
								[StuffID] ,
								0 ,
								@Creator ,
								GETDATE() ,
								@Creator ,
								GETDATE() ,
								[TagNumber]
						FROM     ' + @TableName3+'
		SET IDENTITY_INSERT [STC].[RecountingInventoryTagItem] OFF;
				';

EXEC sp_executesql @Query, N'@Creator int,@RecountingInventoryTagID int', @Creator = @Creator,@RecountingInventoryTagID = @RecountingInventoryTagID;

-- INSERT Items Traces
SET @Query = N'
		INSERT INTO [STC].[RecountingInventoryTagItemTrace]
           ([RecountingInventoryTagItemID]
           ,[TraceID]
           ,[DlID]
           ,[Value]
           ,[Version]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate],
		   [TraceItemID])
		select [ID]
			   ,temp.[TraceID]
			   ,Case when T.AccountLevelTypeID = 1 then Value Else Null End
			   ,Case when T.AccountLevelTypeID <> 1 and T.AccountLevelTypeID <> 6   then Value Else Null End
			   , 0
			   ,@pCreator
			   ,GETDATE()
			   ,@pCreator
			   ,GETDATE(),
			   Case when T.AccountLevelTypeID = 6   then Value Else Null End
		from  ' + @TableName4 + N'  temp
		join stf.Trace T on T.TraceID = temp.TraceID';

EXECUTE sp_executesql @Query, N'@pCreator int', @pCreator = @Creator;

SELECT  @RecountingInventoryTagID AS Value
