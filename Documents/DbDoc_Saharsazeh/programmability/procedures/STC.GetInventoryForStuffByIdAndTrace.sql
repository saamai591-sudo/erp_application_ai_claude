
------------------------------------- START #7101
CREATE    PROCEDURE [STC].GetInventoryForStuffByIdAndTrace
    (
        @FinancialPeriodId INT ,
        @StuffId INT = NULL ,
        @StockId INT ,
        @Traces NVARCHAR(MAX) = NULL ,
        @BranchId INT = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN
        DECLARE @Columns NVARCHAR(MAX) ,
                @Query NVARCHAR(MAX) ,
                @TableName1 NVARCHAR(30) ,
                @WhereClause NVARCHAR(MAX) ,
                @Culture VARCHAR(10) ,
                @CultureNo TINYINT ,
                @UserID INT;


        SELECT CFG.GetStringPart(VALUE, 1) TraceId ,
               CFG.GetStringPart(VALUE, 2) VALUE
        INTO   #TraceItems
        FROM   CFG.R_FnStr2TableBySplitor(@Traces, '#');
        
        
        SELECT * into #vwStuff
        FROM stf.VWStuff AS v
        WHERE v.StuffID = @StuffId


		declare @Date date 

		select @Date =   EndDate from cfg.FinancialPeriod
		where FinancialPeriodID = @FinancialPeriodId


        SELECT @WhereClause = STUFF(
        (   SELECT DISTINCT '  AND '
                            + QUOTENAME(
                                  CAST(#TraceItems.TraceId AS NVARCHAR(5)))
                            + '= N'
                            + QUOTENAME(CAST(VALUE AS NVARCHAR(500)), '''')
            FROM   #TraceItems
                   INNER JOIN STF.Trace AS t ON t.TraceID = #TraceItems.TraceId
            WHERE  t.CheckInventory = 1
            FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF @WhereClause IS NULL
            SET @WhereClause = '';

        SET @TableName1 = CFG.getTempTableName(1);

        SELECT @Columns = STUFF(
        (   SELECT DISTINCT ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
            FROM   STF.Trace
            WHERE  CheckInventory = 1
            FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF ( @Columns IS NULL )
            SET @Columns = '[-1] NVARCHAR(256)';


exec stc.spGetInventoryInDate
    @StuffId  =   @StuffId,
    @stockID =    @StockId,
	@ToDate =	  @Date,
	@FinalTable = @TableName1
	
	SELECT SUM(vrs.Non)             Reserved,vrs.StuffID
	INTO   #Reserved
	FROM   cfg.vwReservedStuffs  AS vrs
	WHERE  vrs.StuffID = @StuffId
	GROUP BY vrs.StuffID
	
	


	
        SET @UserID = CFG.GetuserID();
        SET @Culture = CFG.GetuserCulture();

        SELECT @CultureNo = CultureNo
        FROM   CFG.CultureInfo
        WHERE  Culture = @Culture;

        IF @StockId IS NOT NULL
            BEGIN
                SET @Query = '
			SELECT		ISNULL(SUM(MainQuantity),0) Value, 
						ISNULL(SUM(SubQuantity),0) Value1  ,
						StuffID
						INTO #InventoryRes
			FROM  ' + @TableName1 + ' as t
			 WHERE  StockID = ' + CAST(@StockId AS NVARCHAR(30))
                             + @WhereClause
                             + '
			GROUP BY t.StuffID


			select	Value,
					Value1,
			' + CASE WHEN @CultureNo = 1 THEN 's.MainMeasureUnit'
                                 WHEN @CultureNo = 2 THEN 's.MainMeasureUnit2'
                            END
                             + ' AS Value2,
						 ' + CASE WHEN @CultureNo = 1 THEN 's.SubMeasureUnit'
                                 WHEN @CultureNo = 2 THEN 's.SubMeasureUnit2'
                            END
                             + ' AS Value3,isnull(value,0) - isnull(r.Reserved,0) Value4
			 from #InventoryRes t			 
					 left join #Reserved r on t.StuffID = r.StuffID
					 JOIN #VWStuff AS s ON s.StuffID = t.StuffID

							 ';

            --PRINT @Query
            END;
        ELSE IF @BranchId IS NOT NULL
                 BEGIN
                     SET @Query = '
					 SELECT ISNULL(SUM(MainQuantity),0) Value, 
							ISNULL(SUM(SubQuantity),0) Value1 ,
							StuffID
							 INTO #InventoryRes
					 FROM  '
                            + @TableName1
                            + ' t
							JOIN STF.Stock s ON t.stockId = s.StockID 
					WHERE  BranchID = '
                            + CAST(@BranchId AS NVARCHAR(30))
                            + @WhereClause
                             + '
					GROUP BY t.StuffID

							select	Value,
							Value1,
					' + CASE WHEN @CultureNo = 1 THEN 's.MainMeasureUnit'
										 WHEN @CultureNo = 2 THEN 's.MainMeasureUnit2'
									END
									 + ' AS Value2,
								 ' + CASE WHEN @CultureNo = 1 THEN 's.SubMeasureUnit'
										 WHEN @CultureNo = 2 THEN 's.SubMeasureUnit2'
									END
									 + ' AS Value3,ISNULL(Value,0) - isnull(r.Reserved,0) Value4
					 from #InventoryRes t
					 left join #Reserved r on t.StuffID = r.StuffID
							 JOIN #vwStuff AS s ON s.StuffID = t.StuffID 
							 ';

                 --PRINT @Query;
                 END;
        ELSE
                 BEGIN
                     SET @Query = 'select 0.0000 Value,0.0000 Value1, '''' AS Value2, '''' AS Value3,0.000 Value4';
                 END;


        PRINT @Query;

        EXEC ( @Query );
    END;
