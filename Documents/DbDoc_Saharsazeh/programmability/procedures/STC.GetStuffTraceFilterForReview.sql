-----------------------------------Task 30775----------------------------------------------------
CREATE   PROCEDURE [STC].GetStuffTraceFilterForReview
    (
        @stuffTraceTableName NVARCHAR(MAX) ,
        @SelectedStuffTrace NVARCHAR(MAX)
    )
--WITH ENCRYPTION
AS
    DECLARE @Columns NVARCHAR(MAX) ,
            @selectTrace NVARCHAR(MAX) ,
            @query NVARCHAR(MAX);

    SELECT @Columns = STUFF((   SELECT   ',' + QUOTENAME(t.TraceID)
                                FROM     STF.Trace AS t
                                WHERE t.CheckInventory = 1
                                ORDER BY t.TraceID
                                FOR XML PATH('')) ,
                            1 ,
                            1 ,
                            '');

    IF @Columns IS NULL
        SET @Columns = '[-1]';
    SELECT @selectTrace = STUFF(
                          (   SELECT   ', CASE WHEN piv.'
                                       + QUOTENAME(t.TraceID)
                                       + ' = ''null'' THEN NULL ELSE piv.'
                                       + QUOTENAME(t.TraceID) + ' END AS'
                                       + QUOTENAME(t.TraceID)
                              FROM     STF.Trace AS t
                              WHERE t.CheckInventory = 1
                              ORDER BY t.TraceID
                              FOR XML PATH('')) ,
                          1 ,
                          1 ,
                          '');
    IF @selectTrace IS NULL
        SET @selectTrace = '[-1]';

    SELECT ROW_NUMBER() OVER ( ORDER BY t.TraceID ) rn ,
           t.TraceID ,
           t.Title
    INTO   #traces
    FROM   STF.Trace AS t
    WHERE t.CheckInventory = 1;

    SET @query = '	  
			SELECT piv.StuffID ,' + @selectTrace + '
						 into ' + @stuffTraceTableName
                 + '
			FROM   (   SELECT a.Position ,
							  CFG.GetStringPartBySpliter(a.VALUE, 1, ''#'') StuffID ,
							  t.TraceID ,
							  rfcst.value
					   FROM   CFG.R_FnStr2TableBySplitor(@SelectedStuffTrace, ''|'') a
							  OUTER APPLY CFG.R_FnCommaStr2Table(
											  CFG.GetStringPartBySpliter(a.VALUE, 2, ''#'')) AS rfcst
							  LEFT JOIN #traces AS t ON t.rn = rfcst.Position ) a
			PIVOT (   MAX(value)
					  FOR TraceID IN ( ' + @Columns + ' )) piv
		  ';
		  
    EXEC sp_executesql @query ,
                       N'@SelectedStuffTrace nvarchar(max)' ,
                       @SelectedStuffTrace = @SelectedStuffTrace;
                       
