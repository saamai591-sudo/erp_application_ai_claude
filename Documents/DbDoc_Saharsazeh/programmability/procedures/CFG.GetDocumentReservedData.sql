		
------------Start of #NoTask		
CREATE   PROCEDURE [CFG].GetDocumentReservedData
(
    @StuffIDs              NVARCHAR(MAX),
    @branchID              INT,
    @financialPeriodID     INT,
    @tableName             NVARCHAR(100)
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @traceCols                   NVARCHAR(MAX),
	        @reserveInControl            NVARCHAR(10),
	        @reserveBaseForm             NVARCHAR(MAX),
	        @query                       NVARCHAR(MAX),
	        --@needConfirm NVARCHAR(MAX) ,
	        @consumeReserveInControl     NVARCHAR(10),
	        @consumReserveBaseForm       NVARCHAR(MAX); --,
	                                                    --@requestNeedConfirm NVARCHAR(MAX);
	
	SELECT CAST(rfcst.[value] AS INT) AS StuffID
	INTO   #StuffIds
	FROM   CFG.R_FnCommaStr2Table(@StuffIDs) AS rfcst;
	
	SELECT @reserveInControl = c.ConfigValue
	FROM   [CFG].[Configuration] AS [c]
	WHERE  c.ConfigKey = 'ReservedStoreIsControlable';
	
	SELECT @consumeReserveInControl = c.ConfigValue
	FROM   [CFG].[Configuration] AS [c]
	WHERE  c.ConfigKey = 'ConsumeReservedStoreIsControlable';
	
	SELECT @consumReserveBaseForm = c.ConfigValue
	FROM   CFG.[Configuration] AS c
	WHERE  c.ConfigKey = 'BaseDocumentForConsumeReserve';
	
	SELECT @traceCols = STUFF(
	           (
	               SELECT DISTINCT
	                      ',' + QUOTENAME(t.TraceID)
	               FROM   STF.Trace AS t
	               WHERE  t.CheckInventory = 1
	                      FOR XML PATH(''), TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       );
	
	IF @traceCols IS NULL
	   OR @traceCols = ''
	    SET @traceCols = N'[-1]';
	
	SET @query = 
	    N'
		SELECT   src.BranchID ,
         src.StuffID ,
        CAST(SUM(src.Non) AS Decimal(30,4)) AS MainReserved ,
         CAST(SUM(src.SubNon) AS Decimal(30,4)) SubReserved ,
         ' + @traceCols + N'
		INTO ' + @tableName + N'
FROM     (  ';
	
	IF @reserveInControl = 'true'
	BEGIN
	    SELECT @reserveBaseForm = c.ConfigValue
	    FROM   CFG.[Configuration] AS c
	    WHERE  c.ConfigKey = 'BaseDocumentForReserve';
	    
	    SET @query = @query
	        + 
	        N'  SELECT r.BranchID ,
                    ri.StuffID ,
                    rno.Non ,
                    ISNULL(rno.SubNon, 0) AS SubNon , ' + @traceCols + N'
		 FROM SLE.' + @reserveBaseForm + N'Item AS ri ';
	    
	    IF @StuffIDs IS NOT NULL
	    BEGIN
	        SET @query = @query + N' JOIN #StuffIds As si on si.StuffID = ri.StuffID ';
	    END;
	    
	    SET @query = @query + N' JOIN SLE.' + @reserveBaseForm + N' AS r ON r.' + @reserveBaseForm + N'ID = ri.'
	        + @reserveBaseForm + N'ID
                 JOIN SLE.' + @reserveBaseForm + N'_Non_Outgoing AS rno ON rno.' + @reserveBaseForm + N'ItemID = ri.'
	        + @reserveBaseForm + N'ItemID
                 LEFT JOIN (   SELECT rit.' + @reserveBaseForm
	        + 
	        N'ItemID ,
                                 rit.TraceID ,
                                 CASE WHEN rit.DlID IS NOT NULL THEN CAST(rit.DlID AS NVARCHAR(MAX))
                                      WHEN rit.TraceItemID IS NOT NULL THEN CAST(rit.TraceItemID AS NVARCHAR(MAX))
                                      ELSE rit.[Value]
                                 END AS [Value]
                          FROM   SLE.' + @reserveBaseForm
	        + N'ItemTrace AS rit ) t
                 PIVOT (   MAX([Value])  FOR TraceID IN ( ' + @traceCols + N' )) piv ON piv.' + @reserveBaseForm + 
	        N'ItemID = ri.'
	        + @reserveBaseForm
	        + 
	        N'ItemID
        WHERE    rno.Non > 0
				 AND  '+case when @reserveBaseForm = 'Invoice' then 
				 'r.SaleInvoiceStatus' else 
				 'r.Status' end+N' <> 2 
                 AND (   ri.SubQuantity IS NULL
                         OR rno.SubNon > 0 )
                 AND (@branchID is null or r.BranchID = @branchID)';
	    
	    IF @consumeReserveInControl = 'true'
	    BEGIN
	        SET @query = @query + N' UNION ';
	    END;
	END;

	IF @consumeReserveInControl = 'true'
	BEGIN
	    SET @query = @query
	        + 
	        N'
             SELECT r.BranchID ,
                    ri.StuffID ,
                    srno.NonOutgoing Non ,
                    ISNULL(srno.NonSubOutgoing, 0) AS SubNon ,
					' + @traceCols + N'
             FROM   REQ.' + @consumReserveBaseForm + N'Item AS ri';
	    
	    
	    IF @StuffIDs IS NOT NULL
	    BEGIN
	        SET @query = @query + N' JOIN #StuffIds As si on si.StuffID = ri.StuffID ';
	    END;
	    
	    SET @query = @query + N' JOIN REQ.' + @consumReserveBaseForm + N' AS r ON r.' + @consumReserveBaseForm + 
	        N'ID = ri.'
	        + @consumReserveBaseForm + N'ID
                    LEFT JOIN REQ.' + @consumReserveBaseForm + N'_Remains AS srno ON srno.' + @consumReserveBaseForm
	        + N'ItemID = ri.' + @consumReserveBaseForm + N'ItemID
                    LEFT JOIN (   SELECT rit.' + @consumReserveBaseForm
	        + 
	        N'ItemID ,
                                         rit.TraceID ,
                                         CASE WHEN rit.DlID IS NOT NULL THEN CAST(rit.DlID AS NVARCHAR(MAX))
                                              WHEN rit.TraceItemID IS NOT NULL THEN CAST(rit.TraceItemID AS NVARCHAR(MAX))
											  ELSE rit.[Value]
                                         END AS [Value]
                                  FROM   REQ.' + @consumReserveBaseForm
	        + 
	        N'ItemTrace AS rit ) t
                    PIVOT (   MAX([Value])
                              FOR TraceID IN ( ' + @traceCols + N' )) piv ON piv.' + @consumReserveBaseForm
	        + N'ItemID = ri.' + @consumReserveBaseForm
	        + N'ItemID
             WHERE  srno.NonOutgoing > 0
					AND r.' + @consumReserveBaseForm + N'State <> 3 and r.' + @consumReserveBaseForm
	        + 
	        N'State <> 4
                    AND (   ri.SubQuantity IS NULL
                            OR srno.NonSubOutgoing > 0 )
                 AND (@branchID is null or r.BranchID = @branchID)
               '+CASE WHEN @StuffIDs IS NOT NULL THEN N'  AND (@StuffIDs is null or si.StuffID IS NOT NULL)' ELSE '' END+N'
	' ;
	END;
	
	IF (
	       @consumeReserveInControl IS NULL
	       OR @consumeReserveInControl = 'false'
	   )
	   AND (@reserveInControl IS NULL OR @reserveInControl = 'false')
	BEGIN
	    DECLARE @selCol NVARCHAR(MAX);
	    SELECT @selCol = STUFF(
	               (
	                   SELECT DISTINCT
	                          ',NULL AS ' + QUOTENAME(t.TraceID)
	                   FROM   STF.Trace AS t
	                   WHERE  t.CheckInventory = 1
	                          FOR XML PATH(''), TYPE
	               ).value('.', 'NVARCHAR(MAX)'),
	               1,
	               1,
	               ''
	           );
	    
	    IF @selCol IS NULL
	       OR @selCol = ''
	        SET @selCol = N'NULL AS [-1]';
	    
	    SET @query = @query + N'select NULL  AS BranchID,NULL AS StuffID,0 AS Non, 0 AS SubNon,' + @selCol;
	END;
	
	SET @query = @query + N'
            ) src
GROUP BY src.BranchID ,
         src.StuffID ,
		' + @traceCols;
	
	--PRINT @query;
	EXEC sys.sp_executesql @query,
	     N'
	@StuffIDs			nvarchar(max) ,
    @branchID			INT ,
    @financialPeriodID	INT
',
	     @StuffIDs = @StuffIDs,
	     @branchID = @branchID,
	     @financialPeriodID = @financialPeriodID;
END;
