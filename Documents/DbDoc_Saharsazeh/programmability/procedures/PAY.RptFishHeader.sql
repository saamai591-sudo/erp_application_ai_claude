
CREATE     PROCEDURE [PAY].RptFishHeader(
    @CalendarMonthId      INT,
    @CalcTypeID           VARCHAR(MAX),
    @SelectedPersonel     VARCHAR(MAX) = NULL,
    @AdditionalParams     VARCHAR(MAX) = NULL
)

 
AS
	DECLARE @StartDate DATE,
	        @EndDate DATE,
	        @MonthName NVARCHAR(512),
	        @Year VARCHAR(10),
			@CultureNo varchar(10),
			@Culture varchar(10)

	set @Culture = CFG.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo
	where Culture = @Culture

	DECLARE @Hour INT
	DECLARE @tableName VARCHAR(255)

	SELECT @tableName = cfg.getTempTableName(1)
	DECLARE @payPaymnetTopicID TINYINT

	SELECT @payPaymnetTopicID = pt.PaymentTopicID
	FROM   hrm.PaymentTopic pt
	WHERE  pt.EngName = 'Payment'

	CREATE TABLE #selPersonel
	(
		PersonelID     INT,
		position       INT
	)

	INSERT INTO #selPersonel
	SELECT VALUE,
	       position
	FROM   cfg.R_FnCommaStr2Table(@SelectedPersonel) rfcst


	SELECT VALUE AS CalcTypeId
	INTO   #CalcTypes
	FROM   cfg.R_FnCommaStr2Table(@CalctypeID) rfhst


	declare @CalculationTypeTitle nvarchar(256)
	select top 1 @CalculationTypeTitle = case when @CultureNo = 1 then ct.Title else ct.Title2 end
	from pay.CalculationType ct
	INNER JOIN #CalcTypes
	    ON  #CalcTypes.CalcTypeId = ct.CalculationTypeID

	SELECT c.CalculationPersonelID
	INTO   #CalculationIDs
	FROM   pay.CalculationPersonel AS  c
	       INNER JOIN #CalcTypes
	            ON  #CalcTypes.CalcTypeId = c.CalculationTypeID
	WHERE  c.CalendarMonthID = @CalendarMonthId

	SELECT @StartDate = cm.StartDate,
	       @EndDate       = cm.EndDate,
	       @Hour          = c.WorkHours,
	       @Year          = c.[Year],
	       @MonthName     = cm.MonthName
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId


	DECLARE @params           VARCHAR(MAX),
	        @ParamsSelect     VARCHAR(MAX)



	SELECT DISTINCT  
	       CASE 
	            WHEN p.SystemName IS NULL THEN CAST(p.ParameterID AS VARCHAR(100))
	            ELSE p.SystemName
	       END  AS SystemName,
	       CASE 
	            WHEN p.SystemName IS NULL THEN 0
	            ELSE 1
	       END  AS IsSystemName,
	       DataEntryType
	INTO   #systemNames
	FROM   pay.Parameter AS p
	       INNER JOIN #CalcTypes
	            ON  #CalcTypes.calcTypeId = p.CalculationTypeID
	WHERE  p.SystemName IS NOT NULL
	       OR  p.ParameterID IN (SELECT VALUE
	                             FROM   cfg.R_FnCommaStr2Table(@AdditionalParams) 
	                                    rfcst)





	SELECT @params = STUFF(
	           (
	               SELECT ',' + QUOTENAME(systemName)
	               FROM   #systemNames
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
	                           WHEN DataEntryType = 2 THEN 'CFG.ConvertToHourMinute(' + QUOTENAME(systemName) 
	                                + ' * 60.00 ) '
	                           WHEN DataEntryType = 3 THEN 'CFG.ConvertToDayHourMinute(' + QUOTENAME(systemName) 
	                                + ' * ' + CAST(@Hour AS VARCHAR(10)) + ',' +
	                                CAST(@Hour AS VARCHAR(10)) + ')'
	                           ELSE QUOTENAME(systemName)
	                      END

	                      + ' as ' + QUOTENAME(
	                          CASE 
	                               WHEN IssystemName = 0 THEN 'P' + CAST(SystemName AS VARCHAR(24))
	                               ELSE SystemName
	                          END
	                      )
	               FROM   #systemNames
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )

	DECLARE @Query NVARCHAR(MAX)


	IF @ParamsSelect IS NOT NULL
	BEGIN
	    SET @Query = 'select PersonelID,' + @ParamsSelect + '
		into ' + @tableName +
	        '
		            FROM ( 

		            SELECT *
	FROM    (
	                SELECT #systemNames.SystemName,cp.PersonelID,[Value]
	                FROM Pay.CalculationResult cr
	                Inner join pay.CalculationPersonel cp on cr.CalculationPersonelID=cp.CalculationPersonelID
	                Inner join Pay.Parameter p
	                on p.ParameterId=cr.ParameterId
	                INNER JOIN #selPersonel selp
	         ON selp.PersonelID=cp.PersonelID
	         Inner join #CalculationIDs a
	         on a.CalculationPersonelID=cp.CalculationPersonelID
	         inner join  #systemNames
	         on  #systemNames.SystemName=
	          CASE 
	            WHEN p.SystemName IS NULL THEN CAST(p.ParameterID AS VARCHAR(100))
	            ELSE p.SystemName
	          END

	                where ParameterValueTypeID in (7,16)
	            ) x
	            PIVOT(
	                SUM(VALUE)
	                FOR  SystemName IN (' + @params +
	        ')
	            ) as T ) P 
	            ' 

	    EXEC (@Query)
	END
	ELSE
	BEGIN
	    SET @Query = 'SELECT PersonelID INTO ' + @tableName +
	        ' FROM #selPersonel'

	    EXEC (@Query)
	END




	DECLARE @paramsDef NVARCHAR(2048)

	SET @paramsDef = N'@payPaymnetTopicID int ,@EndDate Date,@CalendarMonthId int'

	SET @Query = '

	SELECT ' + @tableName +'.*,
	       AGG.EmploymentType,
	       AGG.CostCenter,
	       AGG.WorkPlace,
	       AGG.JobTitle,
		   AGG.JobID,
	       case when '+@CultureNo+'=1 then b.Title else b.title2 end    AS BankTitle,
	       p.Code    AS PersonelCode,
	       pBankAccount.AccountNumber,
	       case when '+@CultureNo+'=1 then p2.Title else p2.title2 end  PersonelName,
	       case when '+@CultureNo+'=1 then p2.LastName else p2.LastName2 end LastName,
	       p2.IdentificationCode,
		   '''+@CalculationTypeTitle+''' CalculationTypeTitle,
	       ' + @Year + ' as [Year],
	       ''' + @MonthName + ''' as MonthName
	FROM   #selPersonel
	       INNER JOIN ' + @tableName + '
	            ON  ' + @tableName +
	    '.personelId = #selPersonel.PersonelID
	       LEFT JOIN (
	                SELECT T.PersonelID,
	                       T.EmploymentType,
	                       CostCenter,
	                       WorkPlace,
	                       T.JobTitle,
						   JobID
	                FROM   (
	                           SELECT a.*,
	                                  case when '+@CultureNo+'=1 then et.Title else et.title2 end  EmploymentType,
	                                  case when '+@CultureNo+'=1 then cc.Title else cc.title2 end CostCenter,
	                                  case when '+@CultureNo+'=1 then wp.Title else wp.title2 end  WorkPlace,
	                                  case when '+@CultureNo+'=1 then j.Title else j.title2 end JobTitle,
	                                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.ExecuteDate DESC,a.IssueDate DESC) AS 
	                                  Rno
	                           FROM   hrm.Agreement a
	                                  INNER JOIN hrm.EmploymentType et
	                                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                                  INNER JOIN cfg.CostCenter cc
	                                       ON  cc.CostCenterID = a.CostCenterID
	                                  INNER JOIN hrm.WorkPlace wp
	                                       ON  wp.WorkPlaceID = a.WorkPlaceID
	                                  INNER JOIN hrm.[Job] j
	                                       ON  j.JobID = a.JobID
	                           WHERE  a.ExecuteDate <= @EndDate

	                       )T
	                WHERE  Rno = 1
	            ) AGG
	            ON  AGG.PersonelID = #selPersonel.PersonelID
	       INNER JOIN hrm.Personel p
	            ON  p.PersonelID = AGG.PersonelID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID

	       LEFT JOIN (
	                SELECT *,
	                       ROW_NUMBER() OVER(PARTITION BY pa.PersonelID ORDER BY pa.[Date] DESC) AS 
	                       RNO
	                FROM   hrm.PersonelAccount pa
	                WHERE  pa.PaymentTopicID = @payPaymnetTopicID
	                       AND pa.Date <= @EndDate
	            )pBankAccount
	            ON  p.PersonelID = pBankAccount.PersonelID
	            AND pBankAccount.RNO = 1
	       LEFT JOIN CFG.BankBranch bb
	            ON  bb.BankBranchID = pBankAccount.BankBranchID
	       LEFT JOIN CFG.Bank b
	            ON  b.BankID = bb.BankID

	ORDER BY
	       #selPersonel.position'




	EXECUTE sp_executesql @QUery,
	     @paramsDef,
	     @payPaymnetTopicID = @payPaymnetTopicID,
	     @EndDate = @EndDate,
	     @CalendarMonthId = @CalendarMonthId
