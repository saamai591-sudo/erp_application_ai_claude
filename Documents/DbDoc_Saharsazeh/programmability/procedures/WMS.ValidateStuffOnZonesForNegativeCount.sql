CREATE PROCEDURE WMS.ValidateStuffOnZonesForNegativeCount
(
    @stuffIds NVARCHAR(MAX),
    @FinancialPeriodID INT,
    @stockId INT
)
AS
BEGIN

    DECLARE @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @TableName1 NVARCHAR(250);

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID) + ' NVARCHAR(256)'
        FROM STF.Trace
        WHERE CheckInventory = 1
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1] NVARCHAR(256)';

    SET @TableName1 = CFG.getTempTableName(1);

    SET @Query
        = N'create table ' + @TableName1 + N'
(	
	RowIndex int,
	[Date]	Date,
	StockID int,
	StuffID int,
	'            + @Columns
          + N'
	,MainQuantity Decimal(36,10),
	SubQuantity Decimal(36,10),
	MainInLine Decimal(36,10),
	SubInLine Decimal(36,10)
) ' ;

    --PRINT @Query;

    EXEC (@Query);

    SET @Query
        = N'INSERT INTO ' + @TableName1
          + N' EXEC STC.InventorySummary @FinancialPeriodID = @FinancialPeriodID,
                          @stockID = @stockId,
                          @StuffId = @stuffIds;';

    EXEC sys.sp_executesql @Query,
                           N'@FinancialPeriodID	INT, 
						    @StockId			INT,
						    @stuffIds			NVARCHAR(MAX)',
                           @FinancialPeriodID = @FinancialPeriodID,
                           @stockId = @stockId,
                           @stuffIds = @stuffIds;

    DECLARE @allStuffInfos TABLE
    (
        StuffID INT NOT NULL,
        MainQuantity DECIMAL(36, 10) NOT NULL,
        SubQuantity DECIMAL(36, 10) NULL
    );

    SET @Query
        = N'
	SELECT zi.StuffID,
			-1 * zi.MainQuantity AS MainQuantity,
			CASE
				WHEN zi.SubQuantity IS NULL THEN
					NULL
				ELSE
					-1 * zi.SubQuantity
			END AS SubQuantity
	FROM WMS.ZoneInventory AS zi
		JOIN
		(
			SELECT rfcst.value AS StuffID
			FROM CFG.R_FnCommaStr2Table(@stuffIds) AS rfcst
		) AS src
			ON src.StuffID = zi.StuffID

	UNION ALL 
						
	SELECT s.StuffID, 
		s.MainQuantity, 
		s.SubQuantity  
	FROM ' + @TableName1 + N' as s';

    INSERT @allStuffInfos
    EXEC sys.sp_executesql @Query,
                           N'@stuffIds NVARCHAR(MAX)',
                           @stuffIds = @stuffIds;

    SELECT asi.StuffID,
           SUM(ISNULL(asi.MainQuantity, 0)) AS TotalMainQuantity,
           SUM(ISNULL(asi.SubQuantity, 0)) AS TotalSubQuantity
    INTO #stuffsInfo
    FROM @allStuffInfos AS asi
    GROUP BY asi.StuffID;

	 SELECT *
        FROM #stuffsInfo AS si
        WHERE si.TotalMainQuantity < 0
              OR si.TotalSubQuantity < 0

    IF EXISTS
    (
        SELECT 1
        FROM #stuffsInfo AS si
        WHERE si.TotalMainQuantity < 0
              OR si.TotalSubQuantity < 0
    )
    BEGIN
        RAISERROR('WarehouseManagement.Messages.StuffGetNegativeForZone', 16, 10);
    END;

END;
