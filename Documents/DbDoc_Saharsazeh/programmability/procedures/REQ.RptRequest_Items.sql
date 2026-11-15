  
CREATE     PROC [REQ].RptRequest_Items
    (
        @FromDate DATE = NULL ,
        @ToDate DATE = NULL ,
        @SelectedBranch VARCHAR(MAX) = NULL ,
        @SelectedRequest VARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    DECLARE @Columns NVARCHAR(MAX) ,
            @ColumnsInSelectList NVARCHAR(MAX) ,
            @query NVARCHAR(MAX) ,
            @param NVARCHAR(MAX) ,
            @CodeAndTitleColumn NVARCHAR(MAX) ,
            @LeftJoin NVARCHAR(MAX) ,
            @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10),
			@CultureNo tinyint;

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(TraceID)
        FROM   STF.Trace
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]';

    SELECT @ColumnsInSelectList = STUFF(
    (   SELECT ',' + QUOTENAME(TraceID) + ' AS T'
               + CAST(TraceID AS VARCHAR(10))
        FROM   STF.Trace
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @ColumnsInSelectList IS NULL )
        SET @ColumnsInSelectList = '[-1]';

    SELECT @CodeAndTitleColumn = STUFF(
    (   SELECT ' ,d' + CAST(TraceID AS VARCHAR(10)) + '.Code AS [T'
               + CAST(TraceID AS VARCHAR(10)) + 'Code],d'
               + CAST(TraceID AS VARCHAR(10)) + '.Title AS [T'
               + CAST(TraceID AS VARCHAR(10)) + 'Title]'
        FROM   STF.Trace
        WHERE  DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE       ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );

    IF ( @CodeAndTitleColumn IS NULL )
        SET @CodeAndTitleColumn = '';


    SELECT @LeftJoin = STUFF(
    (   SELECT ' Left Join acc.dl d' + CAST(TraceID AS VARCHAR(10)) + ' on d'
               + CAST(TraceID AS VARCHAR(10)) + '.DlID = piv.'
               + QUOTENAME(TraceID)
        FROM   STF.Trace
        WHERE  DlTypeID IS NOT NULL
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
    1   ,
    1   ,
    ''  );
    IF ( @LeftJoin IS NULL )
        SET @LeftJoin = '';


    DECLARE @PurchaseRequest NVARCHAR(100) ,
            @ReturnRequest NVARCHAR(100) ,
            @StuffRequest NVARCHAR(100);

    SELECT @StuffRequest = lev.[Value]
    FROM   CFG.LocalizeEnum AS le
           JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'StuffRequest'
           AND lev.Culture = @Culture;


    SELECT @PurchaseRequest = lev.[Value]
    FROM   CFG.LocalizeEnum AS le
           JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'PurchaseRequest'
           AND lev.Culture = @Culture;


    SELECT @ReturnRequest = lev.[Value]
    FROM   CFG.LocalizeEnum AS le
           JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'ReturnRequest'
           AND lev.Culture = @Culture;

    CREATE TABLE #SelectedRequestAnalys
        (
            [Type] CHAR ,
            ID INT
        );

    INSERT INTO #SelectedRequestAnalys
                SELECT LEFT(value, 1) ,
                       SUBSTRING(value, 2, LEN(value) - 1)
                FROM   CFG.R_FnCommaStr2Table(@SelectedRequest);


    SET @query = N'
					select	@StuffRequest AS Type,
							''S-''+cast(SRI.StuffRequestItemID as varchar(100)) as ID, 
							sr.StuffRequestNumber as Number,
							sr.StuffRequestDate AS Date,
							CFG.GetCLRSaturnDate(sr.StuffRequestDate,@DateFormat,0,@DateType) as [Date_Date],							
							case when @CultureNo = 1 then u.Title else u.Title2 end as Applicator,
							case when @CultureNo = 1 then stf.Title else stf.Title2 end as StuffTitle,
							stf.code as StuffCode,
							stf.StuffGroupCode,
							stf.StuffGroupTitle,
							SRI.MainQuantity,
							sri.SubQuantity,
							SRI.AcceptRequestMainMeasureQuantity as Accepted ,
							srr.NonOutgoing as NotDone,'
                 + @ColumnsInSelectList + @CodeAndTitleColumn+ ',
							''S'' as DocType,
							SR.StuffRequestID as RequestID,
							SRI.Description,
							SRI.Description2,
							u1.Name AS CreatorUserName ,
							case when @CultureNo = 1 then stf.MainMeasureUnit else stf.MainMeasureUnit2 end as MainMeasureUnit,
							StuffRequestItemIndex RowIndex,
							stf.StuffID
					from REQ.StuffRequest SR
					JOIN CFG.[User] u1 ON u1.UserID = sr.Creator
						join REQ.StuffRequestItem SRI on SRI.StuffRequestID = SR.StuffRequestID
						INNER JOIN  req.StuffRequest_Remains AS srr ON srr.StuffRequestItemID = sri.StuffRequestItemID
						JOIN CFG.OrganizationUnit u ON u.OrganizationUnitID = SR.OrganizationUnitID
						join STF.vwStuff stf on stf.StuffID = SRI.StuffID
						INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = sr.BranchID
						INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID = sr.OrganizationUnitID
						left join
						( 
							select StuffRequestItemID,b.TraceID,case when DlID IS not null then  cast (DLID as nvarchar(max))
															when DlID is null and t.AccountLevelTypeID =5  then cfg.getCLRsaturndate(Value,@DateFormat,0,@DateType) else value end value

							 from REQ.StuffRequestItemTrace b
							 join stf.trace t on t.TraceID = b.TraceID
															 )x pivot
							(
							max(value)
							for traceid in (' + @Columns+ ')
							)piv on piv.StuffRequestItemID = SRI.StuffRequestItemID
						' + @LeftJoin+ '
					where sr.StuffRequestDate between @pFromDate and @pToDate
					and (@pSelectedBranch is null or SR.BranchID IN (
							SELECT VALUE
								 FROM   CFG.R_FnCommaStr2Table(@pSelectedBranch)
								 ))
					and (@pSelectedRequest is null or SR.StuffRequestID in (select ID from #SelectedRequestAnalys where [Type] = ''S''))

		 
					UNION ALL

					select	 @PurchaseRequest AS Type,
							''P-''+cast(PRI.PurchaseRequestItemID as varchar(100)) as ID,
							PurchaseRequestNumber as Number,
							PurchaseRequestDate AS Date,
							CFG.GetCLRSaturnDate(PurchaseRequestDate,@DateFormat,0,@DateType) as [Date_Date],
							case when @CultureNo = 1 then u.Title else u.Title2 end as Applicator,
							case when @CultureNo = 1 then stf.Title else stf.Title2 end as StuffTitle,							
							stf.code as StuffCode,
							stf.StuffGroupCode,
							stf.StuffGroupTitle,
							pri.MainQuantity,
							pri.SubQuantity,
							PRI.AcceptRequestMainMeasureQuantity as Accepted,
							prr.non as NotDone,' + @ColumnsInSelectList
                 + @CodeAndTitleColumn+ ',
							''P'' as DocType,
							PR.PurchaseRequestID as RequestID,
							PRI.Description,
							PRI.Description2,
							u1.Name AS CreatorUserName ,
							case when @CultureNo = 1 then stf.MainMeasureUnit else stf.MainMeasureUnit2 end as MainMeasureUnit,
							PurchaseRequestItemIndex RowIndex,
							stf.StuffID
					from REQ.PurchaseRequest PR
					JOIN CFG.[User] u1 ON u1.UserID = pr.Creator
						join REQ.PurchaseRequestItem PRI on PRI.PurchaseRequestID = PR.PurchaseRequestID
						INNER JOIN req.PurchaseRequest_Remains AS prr ON prr.PurchaseRequestItemID = pri.PurchaseRequestItemID
						JOIN CFG.OrganizationUnit u ON u.OrganizationUnitID = PR.OrganizationUnitID
						join STF.vwStuff stf on stf.StuffID = PRI.StuffID
						INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  PR.BranchID
						INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  pr.OrganizationUnitID
						left join
						(
							select PurchaseRequestItemID,b.TraceID,case when DlID IS not null then  cast (DLID as nvarchar(max))
															when DlID is null and t.AccountLevelTypeID =5  then cfg.getCLRsaturndate(Value,@DateFormat,0,@DateType) else value end value

							 from REQ.PurchaseRequestItemTrace b
							  join stf.trace t on t.TraceID = b.TraceID
															 )x pivot
						(
						max(value)
						for traceid in (' + @Columns+ ')
						)piv on piv.PurchaseRequestItemID = PRI.PurchaseRequestItemID								
					' + @LeftJoin+ '
					where PurchaseRequestDate between @pFromDate and @pToDate
					and (@pSelectedBranch is null or PR.BranchID IN (
							SELECT VALUE
								 FROM   CFG.R_FnCommaStr2Table(@pSelectedBranch)
								 ))
					and (@pSelectedRequest is null or PR.PurchaseRequestID in (select ID from #SelectedRequestAnalys where [Type] = ''P''))
						


					UNION ALL

					select	@ReturnRequest AS Type,
							''R-''+cast(RRI.ReturnRequestItemID as varchar(100)) as ID,
							ReturnRequestNumber as Number,
							ReturnRequestDate as Date,
							CFG.GetCLRSaturnDate(ReturnRequestDate,@DateFormat,0,@DateType) as [Date_Date],
							case when @CultureNo = 1 then u.Title else u.Title2 end as Applicator,
							case when @CultureNo = 1 then stf.Title else stf.Title2 end as StuffTitle,							
							stf.code  as StuffCode,
							stf.StuffGroupCode,
							stf.StuffGroupTitle,
							rri.MainQuantity,
							rri.SubQuantity,
							RRI.AcceptRequestMainMeasureQuantity as Accepted,
							rrr.Non as NotDone,' + @ColumnsInSelectList
                 + @CodeAndTitleColumn+ '
							,''R'' as DocType,
							RR.ReturnRequestID as RequestID,
							RRI.Description,
							RRI.Description2		,
							u1.Name AS CreatorUserName ,
							case when @CultureNo = 1 then stf.MainMeasureUnit else stf.MainMeasureUnit2 end as MainMeasureUnit,
							ReturnRequestItemIndex RowIndex,
							stf.StuffID
					from REQ.ReturnRequest RR
					JOIN CFG.[User] u1 ON u1.UserID = rr.Creator
						join REQ.ReturnRequestItem RRI on RRI.ReturnRequestID = RR.ReturnRequestID
						INNER JOIN req.ReturnRequest_Remains AS rrr ON rrr.ReturnRequestItemID = rri.ReturnRequestItemID
						JOIN CFG.OrganizationUnit u ON u.OrganizationUnitID = RR.OrganizationUnitID
						join STF.vwStuff stf on stf.StuffID = RRI.StuffID
						INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  RR.BranchID
						INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  rr.OrganizationUnitID
						left join
						(
							select ReturnRequestItemID ,
								   b.TraceID ,
								   case when DlID IS not null then cast(DLID as nvarchar(max))
										when DlID is null
											 and t.AccountLevelTypeID = 5 then
											cfg.getCLRsaturndate(Value, @DateFormat, 0, @DateType)
										else value
								   end value
							from   REQ.ReturnRequestItemTrace b
						   join stf.trace t on t.TraceID = b.TraceID
														 )x pivot
						(
						max(value)
						for traceid in (' + @Columns+ ')
						)piv on piv.ReturnRequestItemID = RRI.ReturnRequestItemID
					' + @LeftJoin+ '
					where ReturnRequestDate between @pFromDate and @pToDate
					and (@pSelectedBranch is null or RR.BranchID IN (
							SELECT VALUE
								 FROM   CFG.R_FnCommaStr2Table(@pSelectedBranch)
								 ))
					and (@pSelectedRequest is null or RR.ReturnRequestID in (select ID from #SelectedRequestAnalys where [Type] = ''R''))
						

					';

    SET @param = N'@pFromDate			date,
				   @pToDate				date ,
				   @pSelectedBranch		nvarchar(max),
				   @pSelectedRequest	nvarchar(max), 
				   @DateType			TINYINT, 
				   @DateFormat			VARCHAR(10),
				   @PurchaseRequest		nvarchar(100),
				   @ReturnRequest		nvarchar(100),
				   @StuffRequest		nvarchar(100),
				   @CultureNo char(1)';

    PRINT @query;
    EXECUTE sp_executesql @query ,
                          @param ,
                          @pFromDate = @FromDate ,
                          @pToDate = @ToDate ,
                          @pSelectedBranch = @SelectedBranch ,
                          @pSelectedRequest = @SelectedRequest ,
                          @DateType = @DateType ,
                          @DateFormat = @DateFormat ,
                          @PurchaseRequest = @PurchaseRequest ,
                          @StuffRequest = @StuffRequest ,
                          @ReturnRequest = @ReturnRequest,
						  @CultureNo = @CultureNo;

    IF OBJECT_ID('tempdb..#SelectedRequestAnalys') IS NOT NULL
        DROP TABLE #SelectedRequestAnalys;
