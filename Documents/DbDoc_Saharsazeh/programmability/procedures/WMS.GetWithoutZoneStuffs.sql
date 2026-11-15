CREATE PROCEDURE WMS.GetWithoutZoneStuffs
(
    @FinancialPeriodID INT,
    @stockID INT
)
AS
BEGIN
    DECLARE @cultureNo INT,
            @culture NVARCHAR(20),
            @Query NVARCHAR(MAX),
            @Columns NVARCHAR(MAX),
            @TableName1 NVARCHAR(250);

    SET @culture = CFG.GetuserCulture();

    SELECT @cultureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = @culture;

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
        SET @Columns = '[-1] NVARCHAR(256)';

    SET @TableName1 = CFG.getTempTableName(1);

    SET @Query
        = N'create table ' + @TableName1
          + N'
		(	
			RowIndex int,
			[Date]	Date,
			StockID int,
			StuffID int,
			'    + @Columns
          + N'
			,MainQuantity Decimal(36,10),
			SubQuantity Decimal(36,10),
			MainInLine Decimal(36,10),
			SubInLine Decimal(36,10)
		) ';

		PRINT @Query

    EXEC (@Query);

    SET @Query
        = N'INSERT INTO ' + @TableName1
          + N' EXEC STC.InventorySummary @FinancialPeriodID = @FinancialPeriodID, @StockId = @stockID';

    EXEC sys.sp_executesql @Query,
                           N'@FinancialPeriodID INT, 
							  @StockId   INT',
                           @FinancialPeriodID = @FinancialPeriodID,
                           @stockID = @stockID;
    SET @Query
        = N'SELECT  src.StuffID, 
					src.MainQuantity,
					src.SubQuantity
			INTO #stuffsInInventory
			FROM(
				SELECT ROW_NUMBER() OVER (PARTITION BY  t.StuffID ORDER BY  t.RowIndex desc ) rn,
					   t.StuffID,
					   t.MainInLine AS MainQuantity,
					   t.SubInLine AS SubQuantity
				FROM ' + @TableName1
			  + ' AS t) as src
			WHERE src.rn = 1
			
			SELECT zi.StuffID,
				   z.StockID,
				   SUM(zi.MainQuantity) AS MainQuantity,
				   SUM(zi.SubQuantity) AS SubQuantity
			INTO #ZoneInventoryStuffs
			FROM WMS.ZoneInventory AS zi
				JOIN
				(
					SELECT CASE
							   WHEN z2.ZoneID IS NOT NULL THEN
								   z2.StockID
							   ELSE
								   z.StockID
						   END AS StockID,
						   z.ZoneID
					FROM WMS.Zone AS z
						LEFT JOIN WMS.Zone AS z2
							ON z.RootParentID = z2.ZoneID
				) AS z
					ON z.ZoneID = zi.ZoneID
			WHERE z.StockID = @stockID
			GROUP BY zi.StuffID,
					 z.StockID

			SELECT sii.StuffID,
				   sii.MainQuantity - ISNULL(zis.MainQuantity, 0) AS RemainMainQuantity,
				   CASE
					   WHEN sii.SubQuantity IS NULL THEN
						   NULL
					   ELSE
						   sii.SubQuantity - ISNULL(zis.SubQuantity, 0)
				   END AS RemainSubQuntity
			INTO #MainStuffInventory
			FROM #stuffsInInventory AS sii
				LEFT JOIN #ZoneInventoryStuffs AS zis
					ON zis.StuffID = sii.StuffID;

			SELECT msi.StuffID,
				   vs.code AS StuffCode,
				   CASE @cultureNo
					   WHEN 2 THEN
						   vs.Title2
					   ELSE
						   vs.Title
				   END AS StuffTitle,
				   msi.RemainMainQuantity AS MainQuantity,
				   msi.RemainSubQuntity AS SubQuantity,
				   w.ZoneID,
				   z2.Code AS ZoneCode,
				   CASE @cultureNo
					   WHEN 2 THEN
						   z2.Title2
					   ELSE
						   z2.Title
				   END AS ZoneTitle
			FROM #MainStuffInventory AS msi
				JOIN STF.VWStuff AS vs
					ON vs.StuffID = msi.StuffID
				LEFT JOIN
				(
					SELECT w.StuffID,
						   MAX(w.ZoneID) AS ZoneID
					FROM WMS.Warehousing AS w
						JOIN
						(
							SELECT z.ZoneID,
								   CASE
									   WHEN z2.ZoneID IS NULL THEN
										   z.StockID
									   ELSE
										   z2.StockID
								   END StockID
							FROM WMS.Zone AS z
								LEFT JOIN WMS.Zone AS z2
									ON z2.ZoneID = z.RootParentID
						) z3
							ON z3.ZoneID = w.ZoneID
					WHERE z3.StockID = 1
					GROUP BY w.StuffID
					HAVING COUNT(1) = 1
				) AS w
					ON w.StuffID = msi.StuffID
				LEFT JOIN WMS.Zone AS z2
					ON z2.ZoneID = w.ZoneID
			WHERE msi.RemainMainQuantity > 0;
	';


	PRINT @Query

    EXEC sys.sp_executesql @Query,
                           N'@cultureNo int, @stockID int',
                           @cultureNo = @cultureNo,
                           @stockID = @stockID;

    SET @Query = 'DROP TABLE IF EXISTS  ' + @TableName1;
    EXEC (@Query);

END;
