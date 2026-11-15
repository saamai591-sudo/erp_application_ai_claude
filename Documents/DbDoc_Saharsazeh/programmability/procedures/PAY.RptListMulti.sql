
-----------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [PAY].RptListMulti
(
    @YearInput            INT,
    @MonthNumber          INT,
    @CalcTypeID           VARCHAR(MAX),
    @SelectedPersonel     VARCHAR(MAX) = NULL,
    @AdditionalParams     VARCHAR(MAX) = NULL,
    @valueType            TINYINT = NULL --null åãå
                              --, 7 ÌÇÑí
                              --, 16  ãÚæÞå
)
--WITH ENCRYPTION
AS
	DECLARE @StartDate DATE,
	        @EndDate DATE,
			@Culture varchar(50),
			@DateType varchar(50),
			@DateFormat varchar(50),
			@CreatorId int,
			@CultureNo varchar(50)

	SET @Culture = cfg.GetuserCulture()
	set @CreatorId = cfg.GetuserID()

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @CreatorId
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @CreatorId
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 
	
	DECLARE @CalendarMonthId INT
	
	SELECT @CalendarMonthId = T.CalendarMonthID
	FROM   (
	           SELECT CalendarMonthID,
	                  ROW_NUMBER() OVER(ORDER BY cm.StartDate) AS Rno
	           FROM   hrm.Calendar c
	                  INNER JOIN HRM.CalendarMonth cm
	                       ON  cm.CalendarID = c.CalendarID
	           WHERE  c.[Year] = @YearInput
	       )T
	WHERE  T.Rno = @MonthNumber
	
	DECLARE @Hour INT
	
	DECLARE @tableName VARCHAR(255)
	SELECT @tableName = cfg.getTempTableName(1)
		
	CREATE TABLE #selPersonel
	(
		PersonelID     INT,
		position       INT
	)
	
	DECLARE @payPaymnetTopicID TINYINT
	
	SELECT @payPaymnetTopicID = pt.PaymentTopicID
	FROM   hrm.PaymentTopic pt
	WHERE  pt.EngName = 'Payment'
	
	DECLARE @MonthName     NVARCHAR(100),
	        @Year          NVARCHAR(100)
	
	SELECT @MonthName = cm.MonthName,
	       @Year = c.Year
	FROM   hrm.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	IF @SelectedPersonel IS NULL
	   OR @SelectedPersonel = ''
	    INSERT INTO #selPersonel
	    SELECT p.PersonelID,
	           1
	    FROM   hrm.Personel p
	ELSE
	    INSERT INTO #selPersonel
	    SELECT VALUE,
	           position
	    FROM   cfg.R_FnCommaStr2Table(@SelectedPersonel) rfcst
	
	SELECT @StartDate = cm.StartDate,
	       @EndDate     = cm.EndDate,
	       @Hour        = c.WorkHours
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	
	DECLARE @params VARCHAR(MAX),
	        @ParamsSelect VARCHAR(MAX)
	
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	SELECT PersonelID
	INTO   #ValidPersonel
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   HRM.Agreement a
	           WHERE  a.ExecuteDate <= @EndDate
	                  AND (
	                          @NeedConfirm = 0
	                          OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @EndDate)
	                      )
	                  AND a.IssueDate <= @EndDate
	                  AND (
	                          @SelectedPersonel IS NULL
	                          OR a.PersonelID IN (SELECT PersonelID
	                                              FROM   #selPersonel)
	                      )
	       ) T
	       INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = T.BranchID
	WHERE  T.Rno = 1
	       AND (T.[ExpireDate] IS NULL OR T.[ExpireDate] >= @STArtDate)
	
	DELETE 
	FROM   #selPersonel
	WHERE  PersonelID NOT IN (SELECT PersonelID
	                          FROM   #ValidPersonel AS vp)
	
	SELECT VALUE
	INTO   #calcTypes
	FROM   cfg.R_FnCommaStr2Table(@CalcTypeID) rfcst
	
	SELECT @params = STUFF(
	           (
	               SELECT ',' + QUOTENAME(pa.ParameterID)
	               FROM   pay.Parameter pa
	                      
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
	                           WHEN pa.DataEntryType = 2 THEN 'CFG.ConvertToHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + ' * 60.00) '
	                           WHEN pa.DataEntryType = 3 THEN 'CFG.ConvertToDayHourMinute(' + QUOTENAME(pa.ParameterID) 
	                                + '*'+ CAST(@Hour AS VARCHAR(10))+',' + CAST(@Hour AS VARCHAR(10)) + ')'
	                           ELSE QUOTENAME(pa.ParameterID)
	                      END
	                      
	                      + ' as ' + QUOTENAME('P_' + CAST(pa.ParameterID AS VARCHAR(24)))
	               FROM   pay.Parameter pa
	                      
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
		   ----print @Hour
	
	DECLARE @Query NVARCHAR(MAX)
	
	DECLARE @parameterValueTypeStr NVARCHAR(100)
	SET @parameterValueTypeStr = ''
	
	IF @valueType IS NOT NULL
	    SET @parameterValueTypeStr = 'Pay.CalculationResult.ParameterValueTypeID=' + CAST(@valueType AS VARCHAR(5)) + 
	        ' AND '
	
	SET @Query = 'select PersonelID,' + @ParamsSelect + ' into ' + @tableName + 
	    '
                            FROM ( SELECT * FROM    (
                        SELECT  ParameterID,cp.PersonelID,[Value]
                        FROM Pay.CalculationResult cr
                        INNER JOIN pay.CalculationPersonel cp on cr.CalculationPersonelID=cp.CalculationPersonelID
                        INNER JOIN #selPersonel
                                        ON #selPersonel.PersonelID=cp.PersonelID
                        where ' + @parameterValueTypeStr + 
	    '  cp.CalculationTypeID in (SELECT VALUE
	                              FROM   #calcTypes)  and cp.CalendarMonthID='+CAST(@CalendarMonthID        AS VARCHAR(50))       +'
                    ) x
                    PIVOT(
                        SUM(VALUE)
                        FOR ParameterID IN (' + @params +
	    ')
                    ) as T ) P 
                    ' 
	
	EXEC (@Query)
	
	IF OBJECT_ID('tempdb..' + @tableName) IS NOT NULL
	BEGIN
	    SET @Query = N'SELECT row_number() over(Order by #selPersonel.position) as RowIndex, ' + @tableName + 
	        '.*,AGG.EmploymentType,
				    cfg.GetCLRSaturnDate(EmploymentDate,'''+@DateFormat+''',0,'+@DateType+') EmploymentDate,
                   AGG.CostCenter,AGG.WorkPlace,AGG.JobTitle,AGG.PositionTitle,AGG.FlowChartTitle,
                    case when '+@CultureNo+'=1 then b.Title else b.Title2 end  AS BankTitle,
                   p.Code    AS PersonelCode,pBankAccount.AccountNumber,
                    case when '+@CultureNo+'=1 then p2.Title else p2.Title2 end  AS PersonelName,
					 case when '+@CultureNo+'=1 then  p2.Title + '' '' + p2.LastName else  p2.Title2 + '' '' + p2.LastName2 end AS FullName,
                    case when '+@CultureNo+'=1 then p2.LastName else p2.LastName end  LastName,
                   p2.IdentificationCode,''' + @Year + ''' as Year,''' + @MonthName + ''' as MonthName
            FROM  #selPersonel INNER JOIN ' + @tableName + ' ON  ' + @tableName + 
	        '.personelId = #selPersonel.PersonelID                      
                   LEFT JOIN (
                            SELECT T.PersonelID,T.EmploymentType,EmploymentDate,CostCenter,WorkPlace,PositionTitle,FlowChartTitle,T.JobTitle
                            FROM   (SELECT a.*,
                                             case when '+@CultureNo+'=1 then et.Title else et.Title2 end AS EmploymentType,
                                             case when '+@CultureNo+'=1 then cc.Title else cc.Title2 end AS CostCenter,
                                             case when '+@CultureNo+'=1 then wp.Title else wp.Title2 end AS WorkPlace,
                                              case when '+@CultureNo+'=1 then j.Title else j.Title2 end  AS JobTitle,
                                              case when '+@CultureNo+'=1 then p.Title else p.Title2 end  as PositionTitle,
                                              case when '+@CultureNo+'=1 then fc.Title else fc.Title2 end as FlowChartTitle,
                                              ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.ExecuteDate DESC,a.IssueDate Desc) AS 
                                              Rno
                                       FROM   hrm.Agreement a
                                              INNER JOIN hrm.EmploymentType et ON  et.EmploymentTypeID = a.EmploymentTypeID
                                              INNER JOIN cfg.CostCenter cc ON  cc.CostCenterID = a.CostCenterID
                                              INNER JOIN hrm.WorkPlace wp ON  wp.WorkPlaceID = a.WorkPlaceID
                                              INNER JOIN hrm.[Job] j ON  j.JobID = a.JobID
                                                Left JOIN HRM.Position p  ON p.PositionID = a.PositionID
                                                Left JOIN HRM.FlowChart fc  ON fc.FlowChartID = p.FlowChartID
                                       WHERE  a.ExecuteDate <= @EndDate
                                              
                                   )T
                            WHERE  Rno = 1
                        ) AGG
                        ON  AGG.PersonelID = #selPersonel.PersonelID
                   INNER JOIN hrm.Personel p ON  p.PersonelID = AGG.PersonelID
                   INNER JOIN CFG.Party p2 ON  p2.PartyID = p.PartyID                  
                   LEFT JOIN (
                            SELECT *,
                                   ROW_NUMBER() OVER(PARTITION BY pa.PersonelID ORDER BY pa.CreationDate DESC) AS RNO
                            FROM   hrm.PersonelAccount pa
                            WHERE  pa.PaymentTopicID = @payPaymnetTopicID
                                   AND pa.Date <= @EndDate
                        )pBankAccount
                        ON  p.PersonelID = pBankAccount.PersonelID AND pBankAccount.RNO = 1
                   LEFT JOIN CFG.BankBranch bb ON  bb.BankBranchID = pBankAccount.BankBranchID
                   LEFT JOIN CFG.Bank b ON  b.BankID = bb.BankID ORDER BY   #selPersonel.position'
	    
	    DECLARE @paramsDef NVARCHAR(2048)
	    
	    SET @paramsDef = N'@payPaymnetTopicID int ,@EndDate Date,@CalendarMonthId int'
	    
	    ----print @QUery
	    EXECUTE sp_executesql @QUery,
	         @paramsDef,
	         @payPaymnetTopicID = @payPaymnetTopicID,
	         @EndDate = @EndDate,
	         @CalendarMonthId = @CalendarMonthId
	END
