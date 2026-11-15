------------------------------------- START #8141
CREATE   PROCEDURE [PRM].spGetProductionTableData
(
 @FromDate DATE,
 @ToDate DATE,
 @PageNumber INT,
 @RowspPage INT,
 @Sort NVARCHAR(MAX) = NULL,
 @Filter NVARCHAR(MAX) = NULL
)
AS
BEGIN

	DECLARE @UserID INT,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(25),
			@CultureNo tinyint
		
    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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
	
		  
	IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'ProductionPlanningNumber';

    DECLARE @Query NVARCHAR(MAX);
    SET @Query = ' 
	    WITH Query_Result 
			AS (
			select 
					 pr.Title CostCenterTitle
					,p.Number ProductionPlanningNumber
					,CFG.GetCLRSaturnDate(p.date, @DateFormat, 0, @DateType)  ProductionPlanningDate
					,CFG.GetCLRSaturnDate(p.StartDate, @DateFormat, 0, @DateType)  Date_StartDate
					,CFG.GetCLRSaturnDate(p.EndDate, @DateFormat, 0, @DateType)  Date_EndDate
					,isnull(p.StartDate , ''1900-01-01'') StartDate
					,isnull(p.EndDate , ''1900-01-01'') EndDate
					,s.Code StuffCode
					,case @CultureNo
						when 2 then s.Title2
						else s.Title
				     end as StuffTitle
					 ,i.MainQuantity ProductionPlanningQuantity
					 ,Produced ProducesedQuantity
					 ,Non RemainPlanned
	                 ,CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString
	                 ,CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1, @DateType) AS  EditionDateString
					 ,p.ProductionPlanningID AS ProductionTableID
			from PRM.ProductionPlanningItem i
			join PRM.ProductionPlanning p on i.ProductionPlanningID = p.ProductionPlanningID
			join cfg.costcenter  pr on i.costcenterid = pr.costcenterid
			join STF.[Stuff] s on i.StuffID = s.StuffID
			join prm.vwProductionPlanningItem_NONProduced n
				on n.ProductionPlanningItemid = i.ProductionPlanningItemid
			where p.State <> 2
			AND p.Date BETWEEN @fromDate AND @toDate
		)'

	DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(
                     @tableName ,
                     @Query ,
                     @PageNumber ,
                     @RowspPage ,
                     @Filter ,
                     @Sort);
					 print @Query
	EXECUTE sp_executesql @Query ,
           N'@dateFormat varchar(10),
		     @dateType int,
			 @fromDate DATE,
			 @toDate DATE,
             @UserID int,
		     @CultureNo varchar(25)',
			 @DateFormat = @DateFormat,
			 @DateType = @DateType,
			 @fromDate = @fromDate,
			 @toDate =@toDate,
			 @UserID = @UserID,
			 @CultureNo = @CultureNo

	DECLARE @Count INT;

    EXEC ( 'select * from ' + @tableName + ' ORDER BY _RN' );

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query ,
                          N'@count int out' ,
                          @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);

END;
