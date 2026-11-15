

Create     proc [PRM].WorkingInventoryReview_CostCenter
(
    @FromDate Date,
    @ToDate   Date,
    @SelectedStuffTrace NVARCHAR(MAX) = NULL
	-- پارامتر @SelectedStuffTrace به این صورت پاس داده می شود:
	-- "StuffID1#trace1,trace2,...|StuffID2#trace1,trace2,..."
)

--WITH ENCRYPTION
AS
BEGIN

    DECLARE @Columns NVARCHAR(MAX),
            @query NVARCHAR(MAX),
			@queryParams NVARCHAR(MAX),
			@tableName NVARCHAR(20),
			@stuffTraceTableName NVARCHAR(15),
			@joinColumns NVARCHAR(MAX);

	SET @tableName = CFG.getTempTableName(1);
	SET @stuffTraceTableName = CFG.getTempTableName(1);

    EXEC STC.GetStuffTraceFilterForReview @stuffTraceTableName = @stuffTraceTableName, -- nvarchar(max)
                                          @SelectedStuffTrace = @SelectedStuffTrace;   -- nvarchar(max)

										  
    SELECT @Columns = STUFF(
								(
									SELECT DISTINCT
										   ',' + QUOTENAME(TraceID) + ' varchar(256)'
									FROM STF.Trace
									where CheckInventory = 1
									FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,''
						   );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';


    SELECT @joinColumns
        = STUFF(
          (
              SELECT ' AND ISNULL(st.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(ii.' + QUOTENAME(t.TraceID) + ', 0) '
              FROM STF.Trace AS t
			  where CheckInventory = 1
              ORDER BY t.TraceID
              FOR XML PATH('')
          ),
          1,
          0,
          ''
               );

    IF @joinColumns IS NULL
        SET @joinColumns = N'AND 1 = 1';


	set @query = N'
	create table '+@tableName+'
	(
	DocName varchar(50),
	Number int,
	Date Date,
	CostCenterID int,
	StuffID int,
	MainQuantity decimal(30,4),
	SubQuantity decimal(30,4),
	'+ @Columns +'
	)
	'
	exec(@query)



	set @query = N'
	insert into '+@tableName+'
	exec  PRM.SpWorkingInventoryReviewDataSource
	'
	exec(@query)
	print 2
	set @query = N'
	select b.CostCenterID,c.Code,c.Title, MainInventory,SubInventory
	from
	(
	select costcenterid,sum(MainQuantity) MainInventory,sum(SubQuantity) SubInventory
	from '+@tableName+' ii
	LEFT JOIN ' + @stuffTraceTableName + N' AS st 
		on st.StuffID = ii.StuffID ' + @joinColumns + '
	where date between @FromDate and @ToDate
	AND (@SelectedStuffTrace IS NULL OR st.StuffID is not null)
	group by costcenterid
	)a
	join cfg.costcenter b
		on a.costcenterid = b.costcenterid
	join acc.dl c
		on c.dlid = b.dlid
		where b.costcentertype = 1
	'

	print @Query

	set @queryParams = N'@FromDate date, @ToDate date,@SelectedStuffTrace NVARCHAR(MAX) '

	print @query
    EXEC sp_executesql @query,
                       @queryParams,
                       @FromDate = @FromDate,
                       @ToDate = @ToDate,
					   @SelectedStuffTrace	= @SelectedStuffTrace;


end
