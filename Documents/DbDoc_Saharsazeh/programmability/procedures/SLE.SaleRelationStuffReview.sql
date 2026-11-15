
---------Start of #9262
CREATE    PROCEDURE [SLE].SaleRelationStuffReview
(
    @BaseTypeId INT,
    @TypeId INT,
    @ShowSubmit BIT,
    @ShowConfirm BIT,
    @Fromdate DATE,
    @ToDate DATE,
    @BranchIds VARCHAR(MAX) = NULL,
    @DlIds VARCHAR(MAX) = NULL,
    @SaleTypeIds VARCHAR(MAX) = NULL,
    @SaleModelIds VARCHAR(MAX) = NULL,
    @SaleGroupIds VARCHAR(MAX) = NULL,
    @StuffGroupIds VARCHAR(MAX) = NULL,
    @DocumentIds VARCHAR(MAX) = NULL,
    @SaleAreaIds VARCHAR(MAX) = NULL
)
AS
DECLARE @Culture VARCHAR(25),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT rfcst.[value]
INTO #Branches
FROM CFG.R_FnCommaStr2Table(@BranchIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleAreas
FROM CFG.R_FnCommaStr2Table(@SaleAreaIds) AS rfcst;

SELECT rfcst.[value]
INTO #Dls
FROM CFG.R_FnCommaStr2Table(@DlIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleTypes
FROM CFG.R_FnCommaStr2Table(@SaleTypeIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleModels
FROM CFG.R_FnCommaStr2Table(@SaleModelIds) AS rfcst;

SELECT rfcst.[value]
INTO #SaleGroups
FROM CFG.R_FnCommaStr2Table(@SaleGroupIds) AS rfcst;

SELECT rfcst.[value]
INTO #StuffGroups
FROM CFG.R_FnCommaStr2Table(@StuffGroupIds) AS rfcst;

SELECT rfcst.[value]
INTO #Documents
FROM CFG.R_FnCommaStr2Table(@DocumentIds) AS rfcst;

DECLARE @Columns NVARCHAR(MAX),
        @query NVARCHAR(MAX),
        @selectColumns NVARCHAR(MAX),
        @CodeAndTitleColumn NVARCHAR(MAX),
        @LeftJoin NVARCHAR(MAX);

SELECT @Columns = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID)
    FROM STF.Trace
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                       );

IF @Columns IS NULL
    SET @Columns = N'[-1]';

SELECT @selectColumns = STUFF(
(
    SELECT DISTINCT
           ',' + QUOTENAME(TraceID) + ' AS T' + CAST(TraceID AS VARCHAR(10))
    FROM STF.Trace
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                             );

IF @selectColumns IS NULL
    SET @selectColumns = N'[-1]';

SELECT @CodeAndTitleColumn
    = STUFF(
(
    SELECT DISTINCT
           ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS T' + CAST(TraceID AS VARCHAR(10)) + 'Code,d'
           + CAST(TraceID AS VARCHAR(10)) + '.Title
					 AS T' + CAST(TraceID AS VARCHAR(10)) + 'Title'
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@CodeAndTitleColumn IS NULL)
    SET @CodeAndTitleColumn = N'';

SELECT @LeftJoin
    = STUFF(
(
    SELECT DISTINCT
           ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d' + CAST(TraceID AS VARCHAR(10)) + '.DlID = T1.'
           + QUOTENAME(TraceID)
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
           );

IF (@LeftJoin IS NULL)
    SET @LeftJoin = N'';

------------------------------
SET @query
    = N'
	SELECT b.StuffID,
	       b.Code,
	       b.Title,
		   b.Title2,
		   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then mu.Title
	            when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then mu.Title2
	       end as MainUnit,
		   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then mu2.Title
	            when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then mu2.Title2
	       end as SubUnit,
	       T1.BaseMainQuantity,
	       T1.BaseSubQuantity,
	       T1.MainQuantity,
	       T1.SubQuantity,
	       T1.BaseMainQuantity -ISNULL(mainQuantity, 0) AS MainRemain,
	       T1.BaseSubQuantity -ISNULL(SubQuantity, 0) AS SubRemain,
		   ' + @selectColumns + @CodeAndTitleColumn
      + N'
	FROM   (
			 SELECT StuffID,
					SUM(CASE WHEN Rno = 1 THEN BaseMainQuantity ELSE 0 END) AS BaseMainQuantity,
					SUM(CASE WHEN Rno = 1 THEN BaseSubQuantity ELSE 0 END) AS BaseSubQuantity,
					SUM(CASE WHEN ChildId IS NULL THEN 0 
							--WHEN T.ParentId IS NOT NULL THEN T.BaseMainQuantity
							ELSE MainQuantity END) AS MainQuantity,
					SUM(CASE WHEN ChildId IS NULL THEN 0 
							--WHEN T.ParentId IS NOT NULL THEN T.BaseSubQuantity
							ELSE SubQuantity END) AS SubQuantity,
					' + @Columns
      + N'
			FROM   (
						SELECT StuffID ,
							   fsi.BaseMainQuantity ,
							   fsi.BaseSubQuantity ,
							   fsi.MainQuantity ,
							   fsi.SubQuantity ,
							   Parent.Id AS ParentId ,
							   Child.Id AS ChildId ,
							   ROW_NUMBER() OVER ( PARTITION BY Parent.Id
												   ORDER BY Parent.Id ) AS Rno ,
							   ' + @Columns
      + N'
						FROM   (   SELECT ItemId ,
										  Id ,
										  dsi.StuffID
								   FROM   APS.DimSaleItem dsi
										  INNER JOIN STF.[Stuff] AS s ON s.StuffID = dsi.StuffID
										  INNER JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
										  LEFT JOIN #Branches AS b ON b.value = dsi.BranchID
										  LEFT JOIN #SaleAreas AS sa ON sa.value = dsi.SaleAreaID
										  LEFT JOIN #Dls AS b1 ON b1.value = dsi.DlID
										  LEFT JOIN #SaleTypes AS b3 ON b3.value = dsi.SaleTypeID
										  LEFT JOIN #SaleModels AS b4 ON b4.value = dsi.SaleModel
										  LEFT JOIN #SaleGroups AS b5 ON b5.value = sd.SalesGroupID
										  LEFT JOIN #StuffGroups AS b6 ON b6.value = s.StuffGroupID
										  LEFT JOIN #Documents AS b7 ON b7.value = dsi.DocumentID
								   WHERE  ItemType = @BaseTypeId
										  AND [Date] BETWEEN @Fromdate AND @ToDate
										  AND (   @BranchIds IS NULL OR b.value IS NOT NULL )
										  AND (   @DlIds IS NULL OR b1.value IS NOT NULL )
										  --  AND (@StuffIds IS NULL OR b2.Value IS NOT NULL)
										  AND (   @SaleTypeIds IS NULL OR b3.value IS NOT NULL )
										  AND (   @SaleAreaIds IS NULL OR sa.value IS NOT NULL )
										  AND (   @SaleModelIds IS NULL OR b4.value IS NOT NULL )
										  AND (   @SaleGroupIds IS NULL OR b5.value IS NOT NULL )
										  AND (   @StuffGroupIds IS NULL OR b6.value IS NOT NULL )
										  AND (   @DocumentIds IS NULL OR b7.value IS NOT NULL )
										  AND (   dsi.[Status] IS NULL
												  OR (   @ShowSubmit = 1 AND dsi.[Status] = 1 )
												  OR (   @ShowConfirm = 1 AND dsi.[Status] = 3 ))) Parent
							   INNER JOIN APS.FactSaleItem AS fsi ON fsi.ParentId = Parent.Id
							   LEFT JOIN (   SELECT APS.DimSaleItem.ItemId ,
													APS.DimSaleItem.Id
											 FROM   APS.DimSaleItem
											 WHERE  ItemType = @TypeId ) Child ON Child.Id = fsi.ChildId
							  LEFT JOIN (   SELECT dsit.DimSaleItemId ,
                     dsit.TraceID ,
                     CASE WHEN dsit.DlID IS NOT NULL THEN
                              CAST(dsit.DlID AS NVARCHAR(100))
                          ELSE CAST(dsit.[Value] AS NVARCHAR(100))
                     END AS [Value]
              FROM   APS.DimSaleItemTrace AS dsit ) x
							   PIVOT (   MAX([Value])
										 FOR TraceID IN ( ' + @Columns
      + N' )) AS pv ON pv.DimSaleItemId = Parent.Id
							 ) T
						   GROUP BY
								  StuffID,' + @Columns
      + N'
	       )T1
	       INNER JOIN Stf.Stuff        AS b
	            ON  b.StuffID = T1.StuffID
	       INNER JOIN stf.StuffDetail  AS sd
	            ON  sd.StuffID = b.StuffID
	       INNER JOIN STF.MeasureUnit  AS mu
	            ON  mu.MeasureUnitID = b.MainMeasureUnitID
	       LEFT JOIN stf.MeasureUnit   AS mu2
	            ON  mu2.MeasureUnitID = sd.MeasureSubUnitID
			 ' + @LeftJoin;

	

EXEC sp_executesql @query,
                   N'
				@BaseTypeId			INT, 
				@TypeId				INT,
				@SaleTypeIds		VARCHAR(MAX),
				@SaleModelIds		VARCHAR(MAX),
				@SaleAreaIds		VARCHAR(MAX),
				@SaleGroupIds		VARCHAR(MAX),
				@StuffGroupIds		VARCHAR(MAX),
				@DocumentIds		VARCHAR(MAX),
				@Fromdate			DATE,
				@ToDate				DATE,
				@BranchIds			VARCHAR(MAX),
				@DlIds				VARCHAR(MAX),
				@ShowSubmit			BIT,
				@ShowConfirm		BIT
			 ',
                   @SaleTypeIds = @SaleTypeIds,
                   @SaleModelIds = @SaleModelIds,
                   @SaleGroupIds = @SaleGroupIds,
                   @StuffGroupIds = @StuffGroupIds,
                   @DocumentIds = @DocumentIds,
                   @Fromdate = @Fromdate,
                   @ToDate = @ToDate,
                   @BranchIds = @BranchIds,
                   @DlIds = @DlIds,
                   @BaseTypeId = @BaseTypeId,
                   @TypeId = @TypeId,
                   @ShowSubmit = @ShowSubmit,
                   @SaleAreaIds = @SaleAreaIds,
                   @ShowConfirm = @ShowConfirm;
                   
