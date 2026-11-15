
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 1/27/2019 11:11:14 AM
 ************************************************************/

CREATE  PROCEDURE [ACC].[ApplySlTreeLevelFilter](@selectedItems VARCHAR(MAX), @IsCurrency BIT)
AS
	IF @selectedItems IS NULL
	   OR @selectedItems = ''
	    RETURN
	
	CREATE TABLE #SelectedItems
	(
		LevelId      INT,
		id           INT,
		currency     INT
	)
	
	
	
	INSERT INTO #SelectedItems
	SELECT cfg.GetStringPart(VALUE, 1),
	       cfg.GetStringPart(VALUE, 2),
	       cfg.GetStringPart(VALUE, 3)
	FROM   cfg.Split(@selectedItems, '|')
	
	
	
	
	CREATE TABLE #sl_tempTable
	(
		slId              INT,
		ItemId            INT,
		ParentId          INT,
		SlTreelevelId     INT
	) 
	
	INSERT INTO #sl_tempTable
	SELECT s.SlID,
	       s.SlID,
	       s.ParentID,
	       s.SlTreeLevelID
	FROM   acc.SL                      AS s
	WHERE  s.IsMoeen=1
	
	
	
	WHILE @@ROWCOUNT <> 0
	BEGIN
	    INSERT INTO #sl_tempTable
	    SELECT DISTINCT #sl_tempTable.SlID,
	           s.SlID,
	           s.ParentID,
	           s.SlTreeLevelID
	    FROM   acc.SL AS s
	           INNER JOIN #sl_tempTable
	                ON  #sl_tempTable.ParentId = s.SlID
	    WHERE  NOT EXISTS (
	               SELECT 1
	               FROM   #sl_tempTable ss
	               WHERE  ss.ItemId = s.SlID
	                 AND #sl_tempTable.SlID=ss.slid
	           )
	END 
	
	DECLARE @Columns VARCHAR(MAX),
	        @Query NVARCHAR(MAX),
	        @WhereQuery VARCHAR(MAX)
	
	DECLARE @constValue DECIMAL(30, 0)
	SET @constValue = 1000000000000000
	
	SELECT @Columns = STUFF(
	           (
	               SELECT DISTINCT ',' + QUOTENAME(stl.SlTreeLevelID)
	               FROM   acc.SlTreeLevel AS stl
	               WHERE  stl.SlTreeLevelID IN (SELECT #SelectedItems.LevelId
	                                            FROM   #SelectedItems)
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	
	IF @IsCurrency = 1
	    SELECT @WhereQuery = STUFF(
	               (
	                   SELECT DISTINCT 'AND  ' + ' CurrencyID ' +
	                          ' * ' + CAST(@constValue AS VARCHAR(50)) +
	                          ' + [' 
	                          + CAST(LEVELId AS VARCHAR(10)) +
	                          '] in (select currency *' + CAST(@constValue AS VARCHAR(50))
	                          + '+id from #selectedItems where levelId=' +
	                          CAST(LEVELId AS VARCHAR(10)) + ') '
	                   FROM   #selectedItems
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               4,
	               ''
	           )
	ELSE
	    SELECT @WhereQuery = STUFF(
	               (
	                   SELECT DISTINCT 'AND  ' +
	                          
	                          '  [' 
	                          + CAST(LEVELId AS VARCHAR(10)) +
	                          '] in (select id from #selectedItems where levelId=' 
	                          +
	                          CAST(LEVELId AS VARCHAR(10)) + ') '
	                   FROM   #selectedItems
	                          FOR XML PATH(''),
	                          TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               4,
	               ''
	           )
	
	
	
	
	

	
	
	SET @Query = 
	    'insert into #VoucherItemIds0 select VoucherItemID  from (
	        	SELECT  vi.VoucherItemID,#sl_tempTable.slId,ItemId,SlTreeLevelID,currencyId FROM #V
		INNER JOIN acc.VoucherItem AS vi
		ON vi.VoucherID=#V.voucherid
		INNER JOIN #sl_tempTable
		          ON #sl_tempTable.SlId = vi.SlId)T
		          	PIVOT(
					MAX(ItemId)
					FOR SlTreeLevelID IN (' + @Columns + ')) vial where ' + @WhereQuery + ' group by VoucherItemID'
	
	EXEC (@Query)
	


	
	
	
	
	
	
