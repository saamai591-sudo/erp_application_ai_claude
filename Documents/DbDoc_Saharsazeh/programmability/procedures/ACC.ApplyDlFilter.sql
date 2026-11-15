
CREATE   PROCEDURE [ACC].[ApplyDlFilter]
(
    @SelectedDl VARCHAR(MAX),
    @IsCurrency BIT = 0
)
AS
BEGIN
    DECLARE @constValue DECIMAL(30, 0);
    DECLARE @DlReview INT;

    IF @SelectedDl IS NULL
       OR @SelectedDl = ''
        RETURN;

    SET @constValue = 1000000000000000;
    CREATE TABLE #Selecteddl
    (
        LEVEL INT,
        id INT,
        currency INT
    );

    INSERT INTO #Selecteddl
    SELECT CFG.GetStringPart(value, 1),
           CFG.GetStringPart(value, 2),
           CFG.GetStringPart(value, 3)
    FROM CFG.Split(@SelectedDl, '|');

    SET @DlReview =
    (
        SELECT TOP 1 LEVEL FROM #Selecteddl
    );

    IF @DlReview = -1
    BEGIN
        IF @IsCurrency = 0
            INSERT INTO #VoucherItemIds
            SELECT vi.VoucherItemID
            FROM #V
                INNER JOIN ACC.VoucherItem AS vi
                    ON vi.VoucherID = #V.VoucherID
                INNER JOIN ACC.AccountLevelVoucherItem AS alvi
                    ON alvi.VoucherItemID = vi.VoucherItemID
                INNER JOIN #Selecteddl
                    ON #Selecteddl.id = alvi.DlID;
        --WHERE  alvi.DlID IN (SELECT id
        --                     FROM   #Selecteddl)
        ELSE
            INSERT INTO #VoucherItemIds
            SELECT vi.VoucherItemID
            FROM #V
                INNER JOIN ACC.VoucherItem AS vi
                    ON vi.VoucherID = #V.VoucherID
                INNER JOIN ACC.AccountLevelVoucherItem AS alvi
                    ON alvi.VoucherItemID = vi.VoucherItemID
            WHERE vi.CurrencyID * @constValue + alvi.DlID IN
                  (
                      SELECT currency * @constValue + id FROM #Selecteddl
                  );

        RETURN;
    END;
    ELSE
    BEGIN
        DECLARE @Columns VARCHAR(MAX),
                @SelectQuery NVARCHAR(MAX),
                @Query NVARCHAR(MAX),
                @WhereQuery VARCHAR(MAX);

        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                   ',' + QUOTENAME(al.AccountLevelID)
            FROM ACC.AccountLevel al
            WHERE al.AccountLevelTypeID = 1
                  AND al.AccountLevelID IN
        (
            SELECT LEVEL FROM #Selecteddl
        )
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                               );

        SELECT @SelectQuery = STUFF(
        (
            SELECT ',dl' + CAST(AccountLevelID AS VARCHAR(10))
            FROM ACC.AccountLevel
            WHERE AccountLevelTypeID = 1
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        0   ,
        ''
                                   );

        IF @IsCurrency = 1
        BEGIN
            SELECT @WhereQuery
                = STUFF(
            (
                SELECT DISTINCT
                       'AND  ' + ' CurrencyID ' + ' * ' + CAST(@constValue AS VARCHAR(50)) + ' + ['
                       + CAST(LEVEL AS VARCHAR(10)) + '] in (select currency *' + CAST(@constValue AS VARCHAR(50))
                       + '+id from #Selecteddl where level=' + CAST(LEVEL AS VARCHAR(10)) + ') '
                FROM #Selecteddl
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            4   ,
            ''
                       );
        END;
        ELSE
        BEGIN
            SELECT @WhereQuery
                = STUFF(
            (
                SELECT DISTINCT
                       'AND  ' + '  [' + CAST(LEVEL AS VARCHAR(10)) + '] in (select id from #Selecteddl where level='
                       + CAST(LEVEL AS VARCHAR(10)) + ') '
                FROM #Selecteddl
                FOR XML PATH(''), TYPE
            ).value('.', 'NVARCHAR(MAX)'),
            1   ,
            4   ,
            ''
                       );
        END;

        IF (@SelectQuery IS NULL)
            SET @SelectQuery = N'';

        SET @Query
            = N'
			SELECT  vi.VoucherItemID,DlId,AccountLevelID,currencyId 
			INTO #my_data
			FROM #V
			INNER JOIN acc.VoucherItem AS vi
				ON vi.VoucherID=#V.voucherid
			INNER JOIN ACC.AccountLevelVoucherItem AS alvi
				ON alvi.VoucherItemID = vi.VoucherItemID
			
			insert into #VoucherItemIds 
			select VoucherItemID  from #my_data T
		          	PIVOT(
					MAX(DlId)
					FOR AccountLevelID IN (' + @Columns + N')) vial where ' + @WhereQuery + N' group by VoucherItemID';

        PRINT @Query;
        --  PRINT 100000
        --  PRINT sysdatetime()
        EXEC (@Query);
    --  PRINT sysdatetime()
    END;

END;
