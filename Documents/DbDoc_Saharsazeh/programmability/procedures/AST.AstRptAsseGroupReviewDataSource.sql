-------------------------------------
CREATE   PROCEDURE [AST].AstRptAsseGroupReviewDataSource
(
    @FromDate                 DATE,
    @EndDate                  DATE,
    @tableName                NVARCHAR(20),
    @SelectedCategories       VARCHAR(MAX) = null,
    @SelectedDlTypes          VARCHAR(MAX) = null,
    @SelectedAssets           VARCHAR(MAX) = null,
    @SelectedBranchs          VARCHAR(MAX) = null,
    @SelectedDeployPlaces     VARCHAR(MAX) = null,
    @Level                    INT = 0
)
--WITH ENCRYPTION
AS
set NOCOUNT on

--set @SelectedAssets = N'42921'

declare @AssetValueTable nvarchar(max)
	DECLARE @ConfigValue           TINYINT,
	        @i                     TINYINT,
	        @String                NVARCHAR(MAX) = '',
	        @query                 NVARCHAR(MAX),
	        @WhereClose            NVARCHAR(MAX) = '',
	        @FilterCategoryIDs     NVARCHAR(MAX) 

set @AssetValueTable = cfg.getTempTableName(1)

exec ast.spGetAssetValue 
@SelectedAssets = @SelectedAssets,
@Tablename = @AssetValueTable


	SELECT *
	INTO   #vwBranchAccess
	FROM   cfg.vwBranchAccess AS vba
	
	SELECT VALUE AssetID
	INTO   #SelectedAssets
	FROM   CFG.R_FnCommaStr2Table(@SelectedAssets)
	
	SELECT a.AssetID into #Asset
	FROM ast.Asset AS a
	left join #SelectedAssets sa on a.AssetID = sa.AssetID
	WHERE (@SelectedAssets is null or sa.AssetID is NOT NULL)
	

	select * into #vwAssetCategoryHistory
	from ast.vwAssetCategoryHistory

	-- Replaces ast.Creation: the creation data of an asset comes from ast.Asset (Nature = 3: received from another branch, the old CreationType = 7)
	-- AssetFullID is built the same way as in ast.spGetAssetValue / ast.vwAssetCategoryHistory
	SELECT a.AssetID,
	       a.BranchID,
	       a.AssetCreationDate AS [Date],
	       a.UtilizationDate AS UsageDate,
	       a.AssetCategoryID,
	       CASE WHEN a.Nature = 3 THEN 7 ELSE 1 END AS CreationType,
	       a.AccumulatedDepreciation,
	       a.DuringDepreciation,
	       CASE WHEN a.AssetReceiptID IS NOT NULL
	            THEN 'Ar' + CAST(a.AssetReceiptID AS NVARCHAR(250)) + '-' + CAST(a.AssetCategoryID AS NVARCHAR(250)) + '-' + CAST(a.AssetID AS NVARCHAR(250))
	            ELSE 'As-' + CAST(a.AssetCategoryID AS NVARCHAR(250)) + '-' + CAST(a.AssetID AS NVARCHAR(250))
	       END AS AssetFullID
	INTO   #AssetCreation
	FROM   ast.Asset a
	       JOIN #Asset s ON s.AssetID = a.AssetID	
	
	IF OBJECT_ID('tempdb..#FilteredDlTypes') IS NOT NULL
	    DROP TABLE #FilteredDlTypes
	
	CREATE TABLE #FilteredDlTypes
	(
		DlTypeID     INT,
		DlID         VARCHAR(MAX)
	)
	
	IF @SelectedDlTypes is NOT null
	   OR @SelectedDlTypes <> ''
	BEGIN
	    INSERT into #FilteredDlTypes
	    SELECT [CFG].[GetStringPartBySpliter](VALUE, 1, '#'),
	           [CFG].[GetStringPartBySpliter](VALUE, 2, '#')
	    FROM   [CFG].[Split] (@SelectedDlTypes, '|')
	END
	--Get Assets WithdrawnDuringPeriod
	SELECT AssetID,AssetFullID,WithDrawType
	INTO   #CurrentAssetsWithdrawn
	FROM   (
	           SELECT si.AssetID,vach.AssetFullID,'Sale' WithDrawType
	           FROM   ast.SaleItem si
	                  JOIN ast.Sale s
	                       ON  s.SaleID = si.SaleID
					join #vwAssetCategoryHistory vach on si.AssetID = vach.AssetID and s.Date between vach.FromDate and vach.ToDate

	           WHERE  s.Date between @FromDate and @EndDate
	           GROUP BY
	                  si.AssetID,vach.AssetFullID
	           UNION all
	           SELECT si.AssetID,vach.AssetFullID,'Destruction'
	           FROM   ast.DestructionItem si
	                  JOIN ast.Destruction s
	                       ON  s.DestructionID = si.DestructionID						   
					join #vwAssetCategoryHistory vach on si.AssetID = vach.AssetID and s.Date between vach.FromDate and vach.ToDate
	           WHERE  s.Date between @FromDate and @EndDate
	           GROUP BY
	                  si.AssetID,vach.AssetFullID
	           UNION all
	           SELECT si.AssetID,vach.AssetFullID,'Salvage'
	           FROM   ast.SalvageItem si
	                  JOIN ast.Salvage s
	                       ON  s.SalvageID = si.SalvageID
						   
					join #vwAssetCategoryHistory vach on si.AssetID = vach.AssetID and s.Date between vach.FromDate and vach.ToDate
	           WHERE  s.Date between @FromDate and @EndDate
	           GROUP BY
	                  si.AssetID,vach.AssetFullID
	           UNION all
	           SELECT si.AssetID,vach.AssetFullID,'Transfer'
	           FROM   ast.TransferItem si
	                  JOIN ast.Transfer s
	                       ON  s.TransferID = si.TransferID						   
			join #vwAssetCategoryHistory vach on si.AssetID = vach.AssetID and s.Date between vach.FromDate and vach.ToDate
	           WHERE  s.Date between @FromDate and @EndDate
			   group by si.AssetID,vach.AssetFullID
	       ) A
		   group by AssetID,AssetFullID,WithDrawType
	
	 --#PreviousAssetsWithdrawn
 select AssetID into #PreviousAssetsWithdrawn
 from (	
			 select si.AssetID
			  from ast.SaleItem si
			  join ast.Sale s on s.SaleID = si.SaleID
			  where s.Date < @FromDate 
			 group by si.AssetID

				union all

			 select si.AssetID
			  from ast.DestructionItem si
			  join ast.Destruction s on s.DestructionID = si.DestructionID
			  where s.Date < @FromDate 
			 group by si.AssetID

				union all

			 select si.AssetID
			  from ast.SalvageItem si
			  join ast.Salvage s on s.SalvageID = si.SalvageID
			  where s.Date < @FromDate
			 group by si.AssetID

				union all

			 select si.AssetID
			  from ast.TransferItem si
			  join ast.Transfer s on s.TransferID = si.TransferID
			  where s.Date < @FromDate

		) A

		
			
	-------Get Asset Values

			Create table #vwAssetValue
		(
	
		AssetID					int,
		AssetCategoryID			int,
		AssetValue				decimal(36,10),
		AssetFullID				Nvarchar(400),------Get Asset Values
		ValueType				Nvarchar(400),
		[Date]					Date,
		EstablishmentValue		decimal(36,10))

	set @query = N'insert into #vwAssetValue
	(AssetID				,
	 AssetCategoryID		,
	 AssetValue				,
	 AssetFullID			,
	 ValueType				,
	 [Date]					,
	 EstablishmentValue		 )

	SELECT vv.AssetID,
	       vv.AssetCategoryID,
	       vv.[value]        AssetValue,
	       vv.AssetFullID,
	       vv.ValueType,
	       vv.[Date],
	       vv.EstablishmentValue
	FROM   '+@AssetValueTable+N' AS vv
	WHERE  vv.[Date] <= @EndDate'

EXECUTE sp_executesql @query,
     N'    @EndDate Date',
    @EndDate = @EndDate

	

		--------------Get StartDate AssetValue and During Period AssetValue
	 SELECT ROW_NUMBER() OVER (PARTITION BY vach.AssetID ORDER BY vach.FromDate desc) rno,vach.AssetID,vach.AssetCategoryID 
	 into #StartingDateAssetCategory
			FROM #vwAssetCategoryHistory AS vach
			 join #Asset AS sa on vach.AssetID = sa.AssetID
			WHERE vach.FromDate <=@FromDate                                               
	 

	 
	 
	SELECT 
	c.CreationType,
	 	    vv.AssetID,
	 	    vv.AssetCategoryID,
	 	    vv.AssetFullID,
	 	    SUM(vv.AssetValue)            AssetValue
	 	    into  #AssetStartingValue
	FROM   #vwAssetValue vv
	join ast.Asset AS a on vv.AssetID = a.AssetID
	join #AssetCreation AS c on c.AssetID = a.AssetID
	 	    JOIN #StartingDateAssetCategory sac
	 	        ON  vv.AssetID = sac.AssetID
	 	        AND vv.AssetCategoryID = sac.AssetCategoryID
	 	        AND sac.rno = 1
	 	     JOIN #Asset  AS sa
	 	        ON  vv.AssetID = sa.AssetID
	WHERE  vv.[Date] < @FromDate
	GROUP BY
	 	    vv.AssetID,
	 	    vv.AssetCategoryID,
	 	    c.CreationType,
	 	    vv.AssetFullID
	 	    
	 	    
	 	    
	 	    

-------------ChangedCategoryAssetValues
			select *  
	       into #ChangedCategoryAssetValues
		   from (
			SELECT 
	
	        a.AssetID,
			vach.AssetCategoryID,	
			vv.AssetFullID ,
	    Sum(
	           CASE 
	                WHEN vv.ValueType IN ( 'ChangeCategory','BetweenBranch')
	                      THEN vv.AssetValue
	                    ELSE 0
	               END)         TransferedAmount
	      

	FROM   #vwAssetValue vv
	       JOIN #vwAssetCategoryHistory AS vach
	            ON  vv.AssetFullID = vach.AssetFullID     
			and vv.date between @FromDate and @EndDate
				and vv.ValueType IN ( 'ChangeCategory','BetweenBranch')
	       JOIN ast.Asset     AS a
	            ON  vv.AssetID = a.AssetID
	       JOIN #AssetCreation  AS c
	            ON  c.AssetID = a.AssetID
	WHERE vv.Date between @FromDate and @EndDate
	group by a.AssetID,vach.AssetCategoryID,vv.AssetFullID  ) src
		   
		  
	
	-------------GetAssetDuringValue
	SELECT 
	c.CreationType,
	        a.AssetID,
	       vv.AssetCategoryID,
	       vv.AssetFullID,
	       SUM(
	           CASE 
	                WHEN vv.ValueType NOT IN ( 'ChangeCategory' ,'BetweenBranch')
					and EstablishmentValue = 0
	                      THEN vv.AssetValue 
	                   ELSE 0
	              END
	       )                  AssetValue,
	       SUM(vv.EstablishmentValue)                  EstablishmentValue
	                  
	       into #DuringAssetValue

	FROM   #vwAssetValue vv
	        JOIN ast.Asset     AS a
	            ON  vv.AssetID = a.AssetID
	       JOIN #AssetCreation  AS c
	            ON  c.AssetID = a.AssetID
	WHERE vv.Date between @FromDate and @EndDate
	and vv.ValueType NOT IN ( 'ChangeCategory','BetweenBranch')
	GROUP BY
	       a.AssetID,
	       vv.AssetCategoryID,
	       c.CreationType,
	       c.CreationType,
	       vv.AssetFullID

		---------Select All Asset Values 


		           
		
		SELECT a.AssetFullID,
		           a.AssetID,a.AssetCategoryID
		into #AssetsSource
		FROM   (
		           SELECT AssetFullID,
		           AssetID,AssetCategoryID
		           FROM   #AssetStartingValue
		           UNION ALL
		           SELECT AssetFullID,
		           AssetID,AssetCategoryID
		           FROM   #DuringAssetValue
		           UNION ALL
		           SELECT AssetFullID,
		           AssetID,AssetCategoryID
		           FROM   #ChangedCategoryAssetValues
		       )
		       a
		GROUP BY
		       a.AssetFullID,a.AssetID,a.AssetCategoryID
	
		
		
	SELECT astsrc.AssetID AssetID,
	       astsrc.AssetCategoryID AssetCategoryID,
	       astsrc.AssetFullID,
	       ISNULL(asv.AssetValue,0) + ISNULL(dav.EstablishmentValue,0) StartingValue,
	       ISNULL(asv.CreationType, dav.CreationType) CreationType,
	       dav.AssetValue                DuringPeriodValue,
	       cca.TransferedAmount
	INTO   #AssetValues 
	FROM  #AssetsSource astsrc
	left join 	  #AssetStartingValue         AS asv on astsrc.AssetFullID = asv.AssetFullID
	left join     #DuringAssetValue dav on  astsrc.AssetFullID = dav.AssetFullID
	left join #ChangedCategoryAssetValues cca on  astsrc.AssetFullID = cca.AssetFullID
	

	-----Get Depreciation Info
	CREATE TABLE #Depreciation
	([Type] NVARCHAR(250),
		[Date]              DATE,
		AssetID             INT,
		AssetCategoryID     INT,
		AssetFullID      NVARCHAR(1000),
		[Value]             DECIMAL(36, 10)
	)

	INSERT INTO #Depreciation(
	           [Type],
	           [Date],
	           AssetID,
	           AssetCategoryID,
	           AssetFullID,
	           [Value]
	       )
	SELECT 'Establishment',
	       c.Date,
	       a.AssetID,
	       c.AssetCategoryID,
	       c.AssetFullID,
	       a.AccumulatedDepreciation + a.DuringDepreciation
	FROM   ast.Asset a
	       JOIN #Asset s
	            ON  a.AssetID = s.AssetId
	       JOIN #AssetCreation c
	            ON  c.AssetID = a.AssetID
	WHERE  ISNULL(a.AccumulatedDepreciation, 0) + ISNULL(a.DuringDepreciation, 0) > 0
	       AND (
	               c.Date < @FromDate
	               OR (
	                      c.[Date] between @FromDate and @EndDate
	                      AND c.CreationType <> 7
	                  )
	           )
	


	
		insert 	INTO   #Depreciation
	(		[Type] ,[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'BetweenBranch',c.Date,
	       a.AssetID,
	       c.AssetCategoryID,
	        c.AssetFullID,
	       a.AccumulatedDepreciation+a.DuringDepreciation
	FROM   ast.Asset a
	join #Asset s on a.AssetID = s.AssetId
	join #AssetCreation c on c.AssetID = a.AssetID
	WHERE ISNULL(a.AccumulatedDepreciation,0)+ISNULL(a.DuringDepreciation,0)>0
	and c.[Date] between @FromDate and @EndDate
	and c.CreationType = 7
	
		
	
	insert 	INTO   #Depreciation
	(		[Type] ,[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'Ordinary',d.[Date],
	       d.AssetID,
	       vach.AssetCategoryID,
	       vach.AssetFullID,
	       d.[Value]
	FROM   ast.Depreciation AS d
	join #Asset s on d.AssetID = s.AssetId
	       JOIN #vwAssetCategoryHistory AS vach
	            ON  d.AssetID = vach.AssetID
	            AND d.[Date] between vach.FromDate and vach.ToDate
	       left JOIN #Asset sa
	            ON  d.AssetID = sa.AssetID
	and d.[Date]<=@EndDate
	where d.Date <=@EndDate

		
		insert 	INTO   #Depreciation
	(		[Type] ,[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'ChangedCategory',vach.FromDate,
	       d.AssetID,
	       vach.AssetCategoryID,
	       vach.AssetFullID,
	       d.[Value]
	FROM   ast.Depreciation AS d
	join #Asset s on d.AssetID = s.AssetId
	       JOIN #vwAssetCategoryHistory AS vach
	            ON  d.AssetID = vach.AssetID
	            AND d.[Date] <vach.FromDate
	       left JOIN #Asset sa
	            ON  d.AssetID = sa.AssetID
	WHERE  vach.[TYPE] = 'ChangedCategory'
	          and d.[Date] <=@EndDate
	          
			insert 	INTO   #Depreciation
	(		[Type] ,[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'ChangedCategory',vach.FromDate,
	       d.AssetID,
	       vach.PreviousCategoryID,
	       vach2.AssetFullID,
	       -d.[Value]
	FROM   ast.Depreciation AS d
	join #Asset s on d.AssetID = s.AssetId
	       JOIN #vwAssetCategoryHistory AS vach
	         ON  d.AssetID = vach.AssetID
	            AND d.[Date] <vach.FromDate
	       join #vwAssetCategoryHistory AS vach2 on vach.AssetID = vach2.AssetID and vach.FromDate = DATEADD(DAY,1,vach2.ToDate)	          
	       left JOIN #Asset sa
	            ON  d.AssetID = sa.AssetID
	WHERE  vach.[TYPE] = 'ChangedCategory'  
	          and d.[Date]<=@EndDate
	          
	          
	          
			insert 	INTO   #Depreciation
	(		[Type] ,
			[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'ChangedCategory',
			vach.FromDate,
	       d.AssetID,
	       vach2.AssetCategoryID,
	       vach2.AssetFullID,
	       -isnull(c.AccumulatedDepreciation,0)-isnull(c.DuringDepreciation,0)
	FROM   ast.Asset AS d
	join #Asset s on d.AssetID = s.AssetId
	join #AssetCreation c on c.AssetID = d.AssetID
	       JOIN #vwAssetCategoryHistory AS vach
	            ON  d.AssetID = vach.AssetID
	            AND c.[Date] <vach.FromDate
	       join #vwAssetCategoryHistory AS vach2 on vach.AssetID = vach2.AssetID and vach.FromDate = DATEADD(DAY,1,vach2.ToDate)
	       JOIN #Asset sa
	            ON  d.AssetID = sa.AssetID
	WHERE  vach.[TYPE] = 'ChangedCategory'  
	          and c.[Date]<=@EndDate
			 and (-isnull(c.AccumulatedDepreciation,0)-isnull(c.DuringDepreciation,0))<>0




insert 	INTO   #Depreciation
	(		[Type] ,[Date]             	,
			AssetID            	,
			AssetCategoryID    	,
			AssetFullID,
			[Value]             )
			
	SELECT 'ChangedCategory',vach.FromDate,
	       d.AssetID,
	       vach.AssetCategoryID,
	       vach.AssetFullID,
	       isnull(c.AccumulatedDepreciation,0)+isnull(c.DuringDepreciation,0)
	FROM   ast.Asset AS d
	join #Asset s on d.AssetID = s.AssetId
	join #AssetCreation c on c.AssetID = d.AssetID
	       JOIN #vwAssetCategoryHistory AS vach
	            ON  d.AssetID = vach.AssetID
	            AND c.[Date] <vach.FromDate
	        JOIN #Asset sa
	            ON  d.AssetID = sa.AssetID
	WHERE  vach.[TYPE] = 'ChangedCategory'  
	          and c.[Date]<=@EndDate
	          and  isnull(c.AccumulatedDepreciation,0)+isnull(c.DuringDepreciation,0)<>0

	  --select * from #Depreciation d
	  --join #SelectedAssets sa on d.AssetID = sa.AssetID
	  
	SELECT AssetID,
	       AssetCategoryID,
	       AssetFullID,
	       SUM([Value]) Amount
	INTO   #StartDateDepreciation
	FROM   #Depreciation
	WHERE  ([Date] < @FromDate or (Type = 'Establishment' and [Date] between @FromDate and @EndDate))
	GROUP BY
	       AssetID,
	       AssetCategoryID,
	       AssetFullID

		  
		   
	---ChangeCategoryDepreciation
	SELECT AssetID,
	       AssetCategoryID,
	       AssetFullID,
	       SUM(CASE WHEN [Type] not in ( 'ChangedCategory','Establishment','BetweenBranch') then  [Value] else 0 end)                     DuringPeriodDepreciationAmount,
	       SUM(CASE WHEN [Type] IN ('ChangedCategory','BetweenBranch') then  -[Value] else 0 end)                     BetweenBranchDepreciationAmount
	INTO   #DuringDepreciation
	FROM   #Depreciation
	WHERE  [Date] between @FromDate and     @EndDate
	GROUP BY
	       AssetID,
	       AssetCategoryID,
	       AssetFullID

	
	SELECT *
	INTO   #LastAssetSettingTemp
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() over(PARTITION by assetid order by DATE desc) rownum
	           FROM   ast.AssetSetting
	       ) T
	WHERE  T.rownum = 1


----------GetFinalData
	
	SELECT vv.AssetCategoryID,
	       vv.assetid,
		   vv.AssetFullID,
	       c.UsageDate,
	       c.branchid,
	       ISNULL(vv.StartingValue,0)     BaseValue,
	       ISNULL(vv.DuringPeriodValue,0)    Created,
	       CASE 
	            WHEN t.AssetID is NOT NULL and t.WithDrawType <> 'Transfer' THEN 
	            	ISNULL(vv.StartingValue,0) + ISNULL(vv.DuringPeriodValue,0)+ isnull(vv.TransferedAmount,0)     ELSE 0
	       END	Minus,
	ISNULL(vv.TransferedAmount,0) - CASE 
	            WHEN t.AssetID is NOT NULL and t.WithDrawType = 'Transfer' THEN 
	            	ISNULL(vv.StartingValue,0) + ISNULL(vv.DuringPeriodValue,0)+ isnull(vv.TransferedAmount,0)     ELSE 0
	       END BetweenBranch,
	-- depreciation of an asset withdrawn by a transfer between branches is shown as transfer depreciation, not as withdrawn-asset depreciation
	ISNULL(d.BetweenBranchDepreciationAmount,0)
	+ CASE WHEN t.AssetID is NOT NULL and t.WithDrawType = 'Transfer'
	       THEN ISNULL(d.DuringPeriodDepreciationAmount,0) + ISNULL(sdd.Amount, 0) - ISNULL(d.BetweenBranchDepreciationAmount,0)
	       ELSE 0 END BetweenBranchDep,
	 ISNULL(sdd.Amount, 0) AccumulatedDepreciation,		
	CASE 
	     WHEN c.CreationType <> 7 and c.Date between @FromDate and @EndDate THEN a.DuringDepreciation
	     ELSE 0
	END +
	ISNULL(d.DuringPeriodDepreciationAmount, 0) Depreciation, 
		CASE 
	            WHEN t.AssetID is NOT null and t.WithDrawType <> 'Transfer' THEN 
	            	ISNULL(d.DuringPeriodDepreciationAmount,0) + ISNULL(sdd.Amount, 0)         	-ISNULL(d.BetweenBranchDepreciationAmount,0)    ELSE 0 
					End
	        MinusDep
	
	into #AssetTemp
	FROM 
	ast.Asset AS a 
	join #AssetCreation AS c on c.AssetID = a.AssetID
	join #AssetValues  AS vv on a.AssetID = vv.AssetID
	left join #DuringDepreciation AS d on vv.assetid = d.AssetID and vv.AssetCategoryID = d.AssetCategoryID and vv.AssetFullID = d.AssetFullID
	left join #StartDateDepreciation sdd on a.AssetID = sdd.AssetID and vv.AssetCategoryID = sdd.AssetCategoryID and vv.AssetFullID = sdd.AssetFullID
	left join #CurrentAssetsWithdrawn t on t.AssetFullID = vv.AssetFullID
	join #LastAssetSettingTemp LastAssetSetting on LastAssetSetting.AssetID = a.AssetID
	INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID
	WHERE a.AssetID not in (select assetid from #PreviousAssetsWithdrawn) AND 
	 c.Date <= @EndDate
	and (
	    @SelectedAssets is null
	    OR a.AssetID IN (SELECT VALUE
	                     FROM   CFG.R_FnCommaStr2Table(@SelectedAssets))
	)
	and (
	    @SelectedBranchs is null
	    OR c.BranchID IN (SELECT VALUE
	                      FROM   CFG.R_FnCommaStr2Table(@SelectedBranchs))
	)
	and (
	    @SelectedDeployPlaces is null
	    OR LastAssetSetting.DeployPlaceID IN (SELECT VALUE
	                                          FROM   CFG.R_FnCommaStr2Table(@SelectedDeployPlaces))
	)
	
	

	
	SELECT @ConfigValue = ConfigValue
	FROM   cfg.Configuration
	WHERE  ConfigKey = 'AssetCategoryLevelsCount' 
	
	IF @Level = 0
	    SET @Level = @ConfigValue
	
	IF OBJECT_ID('tempdb..#FilterCategory') IS NOT NULL
	    DROP TABLE #FilterCategory
	
	CREATE TABLE #FilterCategory
	(
		[level] INT
	)
	
	INSERT into #FilterCategory
	SELECT [CFG].[GetStringPartBySpliter](VALUE, 1, '#')
	FROM   [CFG].[Split] (@SelectedCategories, '|')
	
	
	SELECT @FilterCategoryIDs = STUFF(
	           (
	               SELECT DISTINCT ',' + [CFG].[GetStringPartBySpliter](VALUE, 2, '#')
	               FROM   [CFG].[Split] (@SelectedCategories, '|')
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	IF OBJECT_ID('tempdb..#FilterCategoryIDs') IS NOT NULL
	    DROP TABLE #FilterCategoryIDs
	
	CREATE TABLE #FilterCategoryIDs
	(
		AssetCategoryID INT
	)
	
	INSERT into #FilterCategoryIDs
	SELECT VALUE
	FROM   [CFG].[Split] (@FilterCategoryIDs, ',')
	
	SET @i = @ConfigValue
	SET @WhereClose = CASE 
	                       WHEN @SelectedDlTypes is NOT null THEN 
	                            N' 	 where  (ast.AssetSettingID in (	 
																 select distinct AssetSettingID 
																 from ast.AssetSettingDl a
																 join #FilteredDlTypes b
																 on a.DlTypeID = b.DlTypeID
																 where  a.DlID in (SELECT value FROM   cfg.R_FnCommaStr2Table(b.dlid) ))) and '
	                       ELSE '  where'
	                  END
	
	WHILE @i >= 1
	BEGIN
	    IF @i <> 1
	        SET @String = @String +
	            CHAR(13) +
	            'join ast.AssetCategory ac' +
	            CAST(@i -1 as VARCHAR(10)) +
	            ' on ac' + CAST(@i as VARCHAR(10)) +
	            '.ParentID = ac' + CAST(@i -1 as VARCHAR(10)) +
	            '.AssetCategoryID'
	    
	    SET @WhereClose = @WhereClose + N'  (' + CAST(@i as VARCHAR(10)) + 
	        ' not in (select level from #FilterCategory) or ac'
	        + CAST(@i as VARCHAR(10)) +
	        '.AssetCategoryID in (select AssetCategoryID from #FilterCategoryIDs)) and'
	    
	    SET @i = @i - 1
	END
	
	
	SET @WhereClose = STUFF(@WhereClose, LEN(@WhereClose) -2, 3, '')
	
	SET @query = N'create table ' + @tableName + 
	    '
	(
	AssetID int,
	AssetSettingID int,
	UsageDate Date,
	DeployPlaceID int,
	BranchID int,
	AssetCategoryID int,
	RootAssetCategoryID int,
	BaseValue decimal(36,10),
	Created decimal(36,10),	
	BetweenBranch decimal(36,10),
	Minus decimal(36,10),	
	SumAdd decimal(36,10),
	AccumulatedDepreciation decimal(36,10),
	Depreciation decimal(36,10),
	MinusDep decimal(36,10),
	BetweenBranchDep decimal(36,10),
	SumMinus decimal(36,10),
	Net decimal(36,10)
	)'
	
	EXEC (@query)
	
	
	SET @query = N'insert into  ' + @tableName + 
	    '
					select a.AssetID,
						   ast.AssetSettingID,
						   a.UsageDate,
						   ast.DeployPlaceID,
						   a.BranchID,
						   ac' + CAST(@Level as VARCHAR(10)) + 
	    '.AssetCategoryID,
						   ac1.AssetCategoryID RootAssetCategoryID,

						   a.BaseValue,
						   a.Created,
						   a.BetweenBranch,
						   -a.Minus Minus,
						   a.BaseValue+a.Created+a.BetweenBranch-Minus SumAdd,


						   -a.AccumulatedDepreciation AccumulatedDepreciation,
						   -a.Depreciation Depreciation,
						   a.MinusDep ,
						   a.BetweenBranchDep BetweenBranchDep,
						   -a.AccumulatedDepreciation - a.Depreciation + a.BetweenBranchDep+a.MinusDep  SumMinus,
						   
			(a.BaseValue+a.Created+a.BetweenBranch-Minus)+(-a.AccumulatedDepreciation - a.Depreciation + a.BetweenBranchDep+a.MinusDep) Net
	  from #LastAssetSettingTemp ast
	  join  #AssetTemp a on a.assetid = ast.assetid
	  join ast.AssetCategory ac' + CAST(@ConfigValue as VARCHAR(10)) + ' on a.AssetCategoryID = ac' + CAST(@ConfigValue as VARCHAR(10))
	    + '.AssetCategoryID '
	    + @String + @WhereClose
	
		
	
	EXEC (@query)	     
--	      EXEC (N'select * from '+@tableName)

