
---------------------------------------------------------------
CREATE   PROCEDURE [STF].GetOutNonDlData
(
    @traceId INT,
    @Date DATETIME,
    @StockID INT,
    @StuffId INT,
    @Traces NVARCHAR(MAX)
)
--WITH ENCRYPTION 
AS
BEGIN
    DECLARE @tableNameSelected NVARCHAR(255),
            @tableNameres2 NVARCHAR(255),
            @TresTableName NVARCHAR(255),
            @TableName1 NVARCHAR(250),
            @joinTracesString NVARCHAR(MAX),
            @tableNameres NVARCHAR(250),
            @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @FinID NVARCHAR(20),
            @param NVARCHAR(MAX),
            @AccountLevelTypeID NVARCHAR(250);

    SELECT @AccountLevelTypeID = a.AccountLevelTypeID
    FROM STF.Trace a
    WHERE TraceID = @traceId;

    SET @tableNameSelected = CFG.getTempTableName(1);
    SET @tableNameres2 = CFG.getTempTableName(1);
    SET @TresTableName = CFG.getTempTableName(1);
    SET @TableName1 = CFG.getTempTableName(1);
    SET @tableNameres = CFG.getTempTableName(1);

    EXEC CFG.TableFromIStuffTraceString @Traces, @tableNameSelected;

    SELECT @FinID = fp.FinancialPeriodID
    FROM CFG.FinancialPeriod fp
    WHERE @Date
    BETWEEN fp.StartDate AND fp.EndDate;


    SELECT @Columns = STUFF(
    (
        SELECT   ',' + QUOTENAME(s.TraceID) + ' NVARCHAR(256)'
        FROM STF.Trace s
        WHERE CheckInventory = 1
		ORDER BY s.TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1] NVARCHAR(256)';

    DECLARE @stuffIds NVARCHAR(MAX);
    SET @stuffIds = CAST(@StuffId AS NVARCHAR(20));

	exec stc.spGetInventoryInDate
				 @StuffId  =   @stuffIds,
				 @stockID =    @StockID,
				 @ToDate =	  @Date,
				 @FinalTable = @TableName1
				 				 							  
    EXEC CFG.GetDocumentReservedData @StuffIDs = @stuffIds,       
                                     @branchID = NULL,            
                                     @financialPeriodID = NULL,   
                                     @tableName = @TresTableName; 

    SELECT @joinTracesString = STUFF(
    (
        SELECT DISTINCT
               'AND Isnull(T.' + QUOTENAME(t.TraceID) + ',-1)=Isnull(T1.' + QUOTENAME(t.TraceID) + ',-1)'
        FROM STF.Trace t
        WHERE t.OrderView <
    (
        SELECT OrderView FROM STF.Trace t2 WHERE t2.TraceID = @traceId
    )
              AND CheckInventory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    0   ,
    ''
                                    );

    IF @joinTracesString IS NULL
        SET @joinTracesString = N'';

    SELECT @Columns = STUFF(
    (
        SELECT ',T.' + QUOTENAME(TraceID)
        FROM STF.Trace
        WHERE CheckInventory = 1
		ORDER BY TraceID
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    SET @Query = N'select cast(T1.' + QUOTENAME(@traceId) + N' as nvarchar(max)) as ' + QUOTENAME(@traceId)+ N',
						  Sum(MainReserved) as MainInventory 
					into ' + @tableNameres2 + N' 
					from ' + @tableNameSelected + N' T 
					Left JOIN ' + @TresTableName + N' T1
						on T.StuffId= T1.StuffID ' + @joinTracesString + N' 
					Group By T1.' + QUOTENAME(@traceId);

    EXEC (@Query);

    SET @Query = N'select T200.*,
						  ISNULL(T201.MainInventory,0) as ReservedInventory 
					into ' + @tableNameres + N' 
				   from (
						select T1.' + QUOTENAME(@traceId) + N' as Title,
							   Sum(MainQuantity) as RealInventory,
							   Row_number()  over (Order By T1.' + QUOTENAME(@traceId)+ N' ) as ID 
						from (
								select T.* 
								from ' + @TableName1 + N' T
								join ' + @tableNameSelected + N' T1 
									on T.stuffid = T1.stuffid ' + @joinTracesString + N'
								where (@pstockid is null or @pstockid = 0 or stockid = @pstockid)																	  
							  )T1   
						group by  T1.' + QUOTENAME(@traceId) + N'
					)T200	
				Left join ' + @tableNameres2 + N' T201 on T201.' + QUOTENAME(@traceId) + N' = T200.Title';


    SET @param = N'@pDate date,@pstockid int';

    EXECUTE sp_executesql @Query,
                          @param,
                          @pDate = @Date,
                          @pstockid = @StockID;

    IF @AccountLevelTypeID = 5
        SET @Query = N' SELECT  Title AS Value, 
								CFG.GetSaturnDate(Title,0) AS Title,
								ID,
								RealInventory,
								ReservedInventory,
                                NULL TraceItemID
						FROM ' + @tableNameres;
    ELSE IF @AccountLevelTypeID = 6
    BEGIN
        SET @Query = N' SELECT  a.item Title, 
								a.item AS Value,' + 
								CAST(@traceId AS NVARCHAR(256))+ N'
								ID,
								isnull(RealInventory,0) RealInventory,
								isnull(ReservedInventory,0) ReservedInventory ,
								a.TraceItemID
						FROM stf.TraceItem a
						JOIN STF.TraceListType AS tlt ON tlt.TraceListTypeID = a.TraceListTypeID
						JOIN STF.StuffTrace AS st ON st.TraceListTypeID = tlt.TraceListTypeID
						left join ' + @tableNameres + N' b ON a.TraceItemID = b.title
						WHERE st.TraceID = ' + CAST(@traceId AS VARCHAR(100)) + N' AND st.StuffID = ' + CAST(@StuffId AS VARCHAR(100));

    END
    ELSE
        SET @Query = N' SELECT  Title, 
								Title AS Value,
								ID,
								RealInventory,
								ReservedInventory ,
                                NULL TraceItemID
						FROM  ' + @tableNameres;
    EXEC (@Query);
END;
