
CREATE    PROCEDURE [PAY].RptCalcReview
(
    @FromCalendarMonthId     INT,
    @ToCalendarMonthId       INT,
    @CalcTypeID              VARCHAR(128) = '1',
    @ValueType				TINYINT=0,
    @CategoryID              INT = NULL,
    @SelPersonnel VARCHAR(MAX)=NULL,
    @SelectedParameter   VARCHAR(MAX)=NULL,
    @SelectedParameter100   VARCHAR(MAX)=null
)

--WITH ENCRYPTION
AS
	DECLARE @StartDate Date,
	        @EndDate Date,
			@Culture varchar(25),
		    @CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	DECLARE @Hour INT
	
	
	SELECT rfcst.[value] AS CalcTypeId INTO #calcTypes FROM cfg.R_FnCommaStr2Table(@CalcTypeID) AS rfcst
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'





	
	SELECT @StartDate = cm.StartDate,
	       @Hour = c.WorkHours
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @FromCalendarMonthId
	
	
	
	SELECT @EndDate = cm.EndDate
	FROM   HRM.CalendarMonth cm
	WHERE  cm.CalendarMonthID = @ToCalendarMonthId
	
	
	CREATE TABLE #SelPersonelIn(PersonelId int)
	
	
	IF @SelPersonnel IS NOT NULL
	BEGIN
			INSERT INTO #SelPersonelIn
			SELECT
			rfcst.[value]
			FROM
			cfg.R_FnCommaStr2Table(@SelPersonnel) rfcst
			
			  CREATE TABLE #ValidPersonel(personelId int)
	
	
			INSERT INTO #ValidPersonel
			EXEC Hrm.GetValidPersonelWithBranchAccess @EndDate
	
			DELETE #SelPersonelIn
			WHERE PersonelID NOT IN (SELECT PersonelID FROM #ValidPersonel)
		
	END
	ELSE 
		BEGIN
			 INSERT INTO #SelPersonelIn
			EXEC Hrm.GetValidPersonelWithBranchAccess @EndDate
			
		END
		
	
	SELECT cm.CalendarMonthID,
	       c.[Year],
	       cm.[MonthName],
	       cm.MonthNumber,
		   cm.StartDate,
		   cm.EndDate
	    INTO #CalcMonth
	FROM   hrm.CalendarMonth cm
	       INNER JOIN hrm.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.StartDate >= @StartDate
	       AND cm.StartDate < @EndDate
	
	
	
	SELECT T.PersonelID,
	       T.EmploymentTypeID,
	       T.EmploymentType,
	       CostCenter,
	       WorkPlace,
		   CalendarMonthID
	       INTO     #validAgg
	FROM   (
	           SELECT a.*,
					  case when @CultureNo = 1 then et.Title
	                       when @CultureNo = 2 then et.Title2
	                  end as EmploymentType,
					  case when @CultureNo = 1 then cc.Title
	                       when @CultureNo = 2 then cc.Title2
	                  end as CostCenter,
					  case when @CultureNo = 1 then wp.Title
	                       when @CultureNo = 2 then wp.Title2
	                  end as WorkPlace,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID,#CalcMonth.StartDate 
					  ORDER BY case when @NeedConfirm=1 then a.ConfirmDate Else a.IssueDate END DESC) AS 
	                  Rno,
					  #CalcMonth.CalendarMonthID
	           FROM   hrm.Agreement a
	                  INNER JOIN hrm.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  INNER JOIN cfg.CostCenter cc
	                       ON  cc.CostCenterID = a.CostCenterID
	                  INNER JOIN hrm.WorkPlace wp
	                       ON  wp.WorkPlaceID = a.WorkPlaceID
					  inner join #CalcMonth
					  on #CalcMonth.EndDate>=case when @NeedConfirm=1 then a.ConfirmDate Else a.IssueDate END
	           WHERE  a.IssueDate <= @EndDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (
	                                 a.ConfirmDate IS NOT NULL
	                                 AND a.ConfirmDate <= @EndDate
	                             )
	                      )
	                  AND  (a.PersonelID IN (SELECT personelId FROM #SelPersonelIn) )
	       )        T
	WHERE  Rno = 1
	

	
	SELECT p.PersonelID,
	       p.Code    AS PersonelCode,
		   case when @CultureNo = 1 then p2.Title
	            when @CultureNo = 2 then p2.Title2
	       end as PersonelName,
		   case when @CultureNo = 1 then p2.LastName
	            when @CultureNo = 2 then p2.LastName2
	       end as LastName,
		   p2.IdentificationCode,
	       a.WorkPlace,
	       a.CostCenter,
	       a.EmploymentType,
	       --  p3.ParameterID,
	       calc.CalendarMonthID,
	       --  p3.Title AS parameterTitle,
	       [YEAR],
	       [MonthName]
	       ,MonthNumber
	       --  p3.DataEntryType
	       INTO         #selPersonel
	FROM   Hrm.Personel p
	       INNER JOIN #validAgg a
	            ON  a.PersonelID = p.PersonelID
	       INNER JOIN Hrm.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN (
	                SELECT DISTINCT cp.PersonelID,
	                       cp.CalendarMonthID,
	                       [YEAR],
	                       MonthNumber,
	                      [MonthName] AS MonthName
	                FROM   pay.CalculationPersonel cp
	                       INNER JOIN #CalcMonth
	                            ON  #CalcMonth.CalendarMonthID = cp.CalendarMonthID
	                WHERE (cp.CalculationTypeID IN (SELECT CalcTypeId FROM #calcTypes ))
	            ) calc
	            ON  calc.PersonelID = p.PersonelID
				and calc.CalendarMonthID=a.CalendarMonthID
	
	
	
	SELECT cp.PersonelID,
	       cr.ParameterID,
	       cp.CalendarMonthID,
	       SUM(VALUE) AS VALUE 
	       INTO #TempResult
	FROM   pay.CalculationPersonel AS cp
	       INNER JOIN #CalcMonth
	            ON  #CalcMonth.CalendarMonthID = cp.CalendarMonthID
	       INNER JOIN pay.CalculationResult cr
	            ON  cr.CalculationPersonelID = cp.CalculationPersonelID
	       INNER JOIN PAY.Parameter p
	            ON  p.ParameterID = cr.ParameterID
	WHERE --( @CategoryID=100 OR p.CategoryID <> 1 )
	       --AND  SATURNNEW-2028
	        (@CategoryID IS NULL OR @CategoryID =100 OR p.CategoryID = @CategoryID)
	       AND cr.[Value] <> 0
	       AND ( (@ValueType=0 AND cr.ParameterValueTypeID IN (7, 16)) OR (@ValueType=1 AND  cr.ParameterValueTypeID =7  )
	       OR (@ValueType=2 AND  cr.ParameterValueTypeID =16  )
	       )
	       AND (p.CalculationTypeID IN (SELECT CalcTypeId FROM #calcTypes ))
		   AND (@SelectedParameter IS NULL OR p.ParameterID IN (SELECT VALUE FROM cfg.R_FnCommaStr2Table(@SelectedParameter) rfcst))  
		   AND (@CategoryID<>100  OR p.ParameterID IN (SELECT VALUE FROM cfg.R_FnCommaStr2Table(@SelectedParameter100) rfcst))  
	GROUP BY
	       cp.CalendarMonthID,
	       cp.PersonelID,
	       cr.ParameterID
	
	
	
	
	
	SELECT #TempResult.PersonelID,
	       #TempResult.[Value],
	       #TempResult.ParameterID,
	       #TempResult.CalendarMonthID,
	       #CalcMonth.[YEAR],
	       #CalcMonth.[MonthName],
	      #CalcMonth.MonthNumber,	       
		   case when @CultureNo = 1 then p.Title
	           when @CultureNo = 2 then p.Title2
	      end as parameterTitle,
	       p.DataEntryType
	       INTO        #values
	FROM   #TempResult
	       INNER JOIN #selPersonel
	            ON  #TempResult.PersonelID = #selPersonel.PersonelID
	            AND #TempResult.CalendarMonthID = #selPersonel.CalendarMonthID
	       INNER JOIN #CalcMonth
	            ON  #CalcMonth.CalendarMonthID = #TempResult.CalendarMonthID
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = #TempResult.ParameterID
	
	
	
	
	
	
	
	
	
	SELECT DISTINCT     ParameterId,
	       DataEntryType,
	       ParameterTitle
	       INTO         #selParameter
	FROM   #values
	
	IF (@CategoryID=100)
	BEGIN
		INSERT INTO #selParameter
		SELECT p.ParameterID,p.DataEntryType,
		case when @CultureNo = 1 then p.Title
	         when @CultureNo = 2 then p.Title2
	    end as Title
		FROM cfg.R_FnCommaStr2Table(@SelectedParameter100) r
		INNER JOIN pay.Parameter AS p
		ON p.ParameterID=r.[value]
		WHERE p.ParameterID NOT IN (SELECT ParameterId FROM #selParameter)
	END
	
	
	DECLARE @params           VARCHAR(MAX),
	        @ParamsSelect     VARCHAR(MAX)
	
	SELECT @params = STUFF(
	           (
	               SELECT ',' + QUOTENAME(pa.ParameterID)
	               FROM   #selParameter Pa
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	SELECT @ParamsSelect = STUFF(
	           (
	               SELECT ',' +
	                      CASE 
	                           WHEN p.DataEntryType = 2 THEN 
	                                'CFG.ConvertToHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + ' * 60.00) as P_' + CAST(pa.ParameterID AS VARCHAR(20))
	                           WHEN p.DataEntryType = 3 THEN 
	                                'CFG.ConvertToDayHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + ' * '+CAST(@Hour AS VARCHAR(10))+',' + CAST(@Hour AS VARCHAR(10)) + 
	                                ') as P_' + CAST(pa.ParameterID AS VARCHAR(20))
	                           ELSE QUOTENAME(pa.ParameterID) + ' as P_' + CAST(pa.ParameterID AS VARCHAR(20))
	                      END
	               FROM   #selParameter Pa
	                      INNER JOIN Pay.Parameter p
	                           ON  p.ParameterID = pa.ParameterID
	                               FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	--PRINT @params
	--PRINT @ParamsSelect
	DECLARE @Query NVARCHAR(MAX)
	DECLARE @selColumns VARCHAR(MAX)
	
	SET @selColumns = ''
	
	SET @selColumns = @selColumns + 'PersonelCode,'
	
	SET @selColumns = @selColumns + 'PersonelName,'
	
	SET @selColumns = @selColumns + 'LastName,'

	SET @selColumns = @selColumns + 'IdentificationCode,'
	
	SET @selColumns = @selColumns + 'WorkPlace,'
	
	SET @selColumns = @selColumns + 'CostCenter,'
	
	SET @selColumns = @selColumns + 'EmploymentType,'
	
	
	SET @Query = ' select cast(#selPersonel.CalendarMonthID as bigint)*100000000 + P.PersonelID as ItemKey, P.PersonelID,[MonthName],MonthNumber,[Year],' + @selColumns + ' ' 
	    + @ParamsSelect +
	    '  from (
	
	SELECT *
	FROM    (
	                SELECT ParameterID,PersonelID,CalendarMonthID,[Value]
	                FROM #Values
	            ) x
	            PIVOT(
	                MAX(VALUE)
	                FOR ParameterID IN (' + @params +
	    ')
	            ) as T ) P 
	            Inner join #SelPersonel on #selPersonel.PersonelID=P.PersonelID
	            AND #selPersonel.CalendarMonthID=P.CalendarMonthID
	              
	            ' 
	
	PRINT @Query
	EXEC (@Query)


