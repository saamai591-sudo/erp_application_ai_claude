


CREATE   PROCEDURE [SLE].SaleRelationChildItemReview
(
    @BaseTypeId INT,
    @TypeId INT,
    @ShowSubmit BIT,
    @ShowConfirm BIT,
    @Fromdate DATE,
    @ToDate DATE,
    @BranchIds VARCHAR(MAX) = NULL,
    @DlIds VARCHAR(MAX) = NULL,
    @StuffIds NVARCHAR(MAX) = NULL,
    @SaleTypeIds VARCHAR(MAX) = NULL,
    @SaleModelIds VARCHAR(MAX) = NULL,
    @SaleGroupIds VARCHAR(MAX) = NULL,
    @StuffGroupIds VARCHAR(MAX) = NULL,
    @DocumentIds VARCHAR(MAX) = NULL,
    @ItemIds VARCHAR(MAX) = NULL,
    @SaleAreaIds VARCHAR(MAX) = NULL
)
AS
CREATE TABLE #Stuffs
(
    [value] BIGINT
);

INSERT INTO #Stuffs
SELECT Value FROM CFG.R_FnCommaStr2Table(@StuffIds)


--SELECT   * FROM APS.DimSaleItem
--WHERE Id IN (
--SELECT  [Value] FROM #Stuffs)


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


SELECT rfcst.[value]
INTO #items
FROM CFG.R_FnCommaStr2Table(@ItemIds) AS rfcst;
---------------------------------

DECLARE @Columns NVARCHAR(MAX),
        @query NVARCHAR(MAX),
        @selectColumns NVARCHAR(MAX),
        @CodeAndTitleColumn NVARCHAR(MAX),
        @LeftJoin NVARCHAR(MAX),
        @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @Culture VARCHAR(10),
        @CultureNo TINYINT;

SET @Culture = CFG.GetuserCulture();

SET @UserID = CFG.GetuserID();

SELECT @CultureNo = CultureNo
FROM CFG.CultureInfo
WHERE Culture = @Culture;

SELECT @DateType = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END;

SELECT @DateFormat = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

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

---------------------------------





SET @query
    = N'
		SELECT dsi.Number ,
			   dsi.HeaderID,
			   dsi.ItemId AS ItemID ,
			   dsi.ItemRowIndex ,
			   dsi.[Date],
			   CFG.GetCLRSaturnDate(dsi.[Date], @dateFormat, 0, @dateType) AS [Date_Date] ,
			   s.Code AS StuffCode ,
			   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then s.Title
	                when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then s.Title2
	           end as StuffTitle,
			   d.Code AS DlCode ,
			   case when ' + CAST(@CultureNo AS CHAR(1)) + N' = 1 then d.Title
	                when ' + CAST(@CultureNo AS CHAR(1))
      + N' = 2 then d.Title2
	           end as DlTitle,
			   T1.MainQuantity ,
			   T1.SubQuantity ,
			   T1.ChildId as ParentId,' + @selectColumns + @CodeAndTitleColumn
      + N'
		FROM   (   SELECT   ChildId ,
							SUM(CASE WHEN ChildId IS NULL THEN 0
									 ELSE MainQuantity
								END) AS MainQuantity ,
							SUM(CASE WHEN ChildId IS NULL THEN 0
									 ELSE SubQuantity
								END) AS SubQuantity
								,' + @Columns
      + N'
				   FROM     (   SELECT BranchID ,
									   fsi.MainQuantity ,
									   fsi.SubQuantity ,
									   Parent.Id AS ParentId ,
									   Child.Id AS ChildId ,
									   ROW_NUMBER() OVER ( PARTITION BY Parent.Id
														   ORDER BY Parent.Id ) AS Rno
														   ,' + @Columns
      + N'
								FROM   (   SELECT ItemId ,
												  Id 
												
										   FROM   APS.DimSaleItem dsi
												  INNER JOIN STF.[Stuff] AS s ON s.StuffID = dsi.StuffID
												  INNER JOIN STF.StuffDetail AS sd ON sd.StuffID = s.StuffID
												  LEFT JOIN #Branches AS b ON b.value = dsi.BranchID
												  LEFT JOIN #SaleAreas AS sa ON sa.value = dsi.SaleAreaID
												  LEFT JOIN #Dls AS b1 ON b1.value = dsi.DlID
												  LEFT JOIN #Stuffs AS b2 ON b2.value = dsi.ID
												  LEFT JOIN #SaleTypes AS b3 ON b3.value = dsi.SaleTypeID
												  LEFT JOIN #SaleModels AS b4 ON b4.value = dsi.SaleModel
												  LEFT JOIN #SaleGroups AS b5 ON b5.value = sd.SalesGroupID
												  LEFT JOIN #StuffGroups AS b6 ON b6.value = s.StuffGroupID
												  LEFT JOIN #Documents AS b7 ON b7.value = dsi.DocumentID
												  LEFT JOIN #Items AS b8 ON b8.value = dsi.Id
										   WHERE  ItemType = @BaseTypeId
												  --AND [Date] BETWEEN @Fromdate AND @ToDate
												  AND (@BranchIds IS NULL OR b.value IS NOT NULL )
												  AND (@DlIds IS NULL  OR b1.value IS NOT NULL )
												  AND (@StuffIds IS NULL OR b2.value IS NOT NULL )
												  AND (@SaleTypeIds IS NULL OR b3.value IS NOT NULL )
												  AND (@SaleAreaIds IS NULL OR b3.value IS NOT NULL )
												  AND (@SaleModelIds IS NULL  OR b4.value IS NOT NULL )
												  AND (@SaleGroupIds IS NULL OR b5.value IS NOT NULL )
												  AND (@StuffGroupIds IS NULL OR b6.value IS NOT NULL )
												  AND (@DocumentIds IS NULL OR b7.value IS NOT NULL )
												 AND (@ItemIds IS NULL OR b8.value IS NOT NULL )
												  AND (dsi.[Status] IS NULL 
														OR (@ShowSubmit = 1 AND dsi.[Status] = 1 )
														OR (   @ShowConfirm = 1 AND dsi.[Status] = 3 )
												  
												  )
								
								) Parent
									   INNER JOIN APS.FactSaleItem AS fsi ON fsi.ParentId = Parent.Id
									   LEFT JOIN (   SELECT APS.DimSaleItem.ItemId ,
															APS.DimSaleItem.Id,
															BranchID
													 FROM   APS.DimSaleItem
													 WHERE  ItemType = @TypeId 
									   ) Child ON Child.Id = fsi.ChildId 
									 Left JOIN (   SELECT dsit.DimSaleItemId ,
													dsit.TraceID ,
													CASE WHEN dsit.DlID IS NOT NULL THEN
															 CAST(dsit.DlID AS NVARCHAR(100))
														 ELSE Cast(dsit.[Value] as NVARCHAR(100))
													END AS [Value]
											 FROM   APS.DimSaleItemTrace AS dsit ) x
							   PIVOT (   MAX([Value])
										 FOR TraceID IN ( ' + @Columns
      + N' )) AS pv ON pv.DimSaleItemId = Child.Id
				) T
				   GROUP BY ChildId,' + @Columns
      + N' ) T1
		INNER JOIN APS.DimSaleItem AS dsi ON dsi.Id = T1.ChildId
		INNER JOIN STF.[Stuff] AS s ON s.StuffID = dsi.StuffID
		INNER JOIN ACC.DL AS d ON d.DLID = dsi.DlID
	' + @LeftJoin;

PRINT @query;
EXEC sp_executesql @query,
                   N'
		@BaseTypeId		INT ,
        @TypeId			INT ,
        @ShowSubmit		BIT ,
        @ShowConfirm	BIT ,
        @Fromdate		DATE ,
        @ToDate			DATE ,
        @BranchIds		VARCHAR(MAX),
        @DlIds			VARCHAR(MAX),
        @StuffIds		VARCHAR(MAX),
        @SaleTypeIds	VARCHAR(MAX),
        @SaleModelIds	VARCHAR(MAX),
        @SaleGroupIds	VARCHAR(MAX),
        @StuffGroupIds	VARCHAR(MAX),
        @DocumentIds	VARCHAR(MAX),
        @SaleAreaIds	VARCHAR(MAX),
        @ItemIds	VARCHAR(MAX),
		@DateType		TINYINT,
		@DateFormat		VARCHAR(10)
	 ',
                   @BaseTypeId = @BaseTypeId,
                   @TypeId = @TypeId,
                   @ShowSubmit = @ShowSubmit,
                   @ShowConfirm = @ShowConfirm,
                   @Fromdate = @Fromdate,
                   @ToDate = @ToDate,
                   @BranchIds = @BranchIds,
                   @DlIds = @DlIds,
                   @StuffIds = @StuffIds,
                   @SaleTypeIds = @SaleTypeIds,
                   @SaleModelIds = @SaleModelIds,
                   @SaleGroupIds = @SaleGroupIds,
                   @StuffGroupIds = @StuffGroupIds,
                   @DocumentIds = @DocumentIds,
				   @SaleAreaIds = @SaleAreaIds,
                   @ItemIds = @ItemIds,
                   @DateType = @DateType,
                   @DateFormat = @DateFormat;
------------------End of #9262

