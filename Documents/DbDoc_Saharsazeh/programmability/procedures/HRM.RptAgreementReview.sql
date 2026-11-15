


CREATE   PROCEDURE [HRM].[RptAgreementReview](
	@isLastAgreement   BIT=0,
	@selectedPersonel VARCHAR(MAX) = NULL,
	@fromDate DATETIME,
    @toDate DATETIME,
	@activePersons BIT = 0)
--WITH ENCRYPTION
AS
	DECLARE @DateFormat     VARCHAR(50),
	        @dateType       INT,
			@Culture varchar(25),
			@CultureNo tinyint,
			@isAgreementNeedConfirm BIT

	SELECT @isAgreementNeedConfirm = [ConfigValue] FROM [CFG].[Configuration] 
	WHERE [ConfigKey] = 'AgreementNeedConfirm'

	SET @DateFormat = cfg.GetCurrentUserDateFormat()
	SET @dateType = cfg.GetCurrentUserDateType()

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	CREATE TABLE #SelPersonel
	(
		PersonelID INT
	)
	
	IF @selectedPersonel IS NOT NULL
	BEGIN
		INSERT INTO #SelPersonel
	    SELECT VALUE
	    FROM   cfg.R_FnCommaStr2Table(@selectedPersonel) rfcst
	    
	    CREATE TABLE #ValidPersonel(personelId int)
	
	
		INSERT INTO #ValidPersonel
		EXEC Hrm.GetValidPersonelWithBranchAccess null
	
		DELETE #SelPersonel
		WHERE PersonelID NOT IN (SELECT PersonelID FROM #ValidPersonel)
	END
	ELSE
	    INSERT INTO #SelPersonel
		EXEC Hrm.GetValidPersonelWithBranchAccess null
	
	


	SELECT a.AgreementID,
	       p.PersonelID,
	       p.Code,	       
		   case when @CultureNo = 1 then p2.Title
	            when @CultureNo = 2 then p2.Title2
	       end as Title,		   	       
		   case when @CultureNo = 1 then p2.LastName
	            when @CultureNo = 2 then p2.LastName2
	       end as LastName,
	       CFG.GetCLRSaturnDate(a.IssueDate, @DateFormat, 0, @dateType) AS IssueDate,
	       CFG.GetCLRSaturnDate(a.ExecuteDate, @DateFormat, 0, @dateType) AS ExecuteDate,
	       CFG.GetCLRSaturnDate(a.[ExpireDate], @DateFormat, 0, @dateType) AS [ExpireDate],
		   CFG.GetCLRSaturnDate(a.EmploymentDate, @DateFormat, 0, @dateType) AS EmploymentDate,
		   CFG.GetCLRSaturnDate(a.ConfirmDate, @DateFormat, 0, @dateType) AS ConfirmDate,
		   case when @CultureNo = 1 then at.Title
	            when @CultureNo = 2 then at.Title2
	       end as AggType,	       
		   case when @CultureNo = 1 then  cc.Title
	            when @CultureNo = 2 then  cc.Title2
	       end as CostCenter,	       
		   case when @CultureNo = 1 then et.Title
	            when @CultureNo = 2 then et.Title2
	       end as EmploymentType,	       
		   case when @CultureNo = 1 then j.Title
	            when @CultureNo = 2 then j.Title2
	       end as JOB,	       
		   case when @CultureNo = 1 then pb.Title
	            when @CultureNo = 2 then pb.Title2
	       end as PayrollBaseTitle,	       
		   case when @CultureNo = 1 then pg.Title
	            when @CultureNo = 2 then pg.Title2
	       end as PayrollGroupTitle,	       
		   case when @CultureNo = 1 then og.Title
	            when @CultureNo = 2 then og.Title2
	       end as OcuupationGradetitle,	       
		   case when @CultureNo = 1 then es.Title
	            when @CultureNo = 2 then es.Title2
	       end as EmploymentStatus,
		    p3.Code AS PositionCode,
		   case when @CultureNo = 1 then p3.Title
	            when @CultureNo = 2 then p3.Title2
	       end as PositionTitle,
		   case when @CultureNo = 1 then ou.Title
	       when @CultureNo = 2 then ou.Title2
	       end as OrganizationUnitTitle,
	       a.Serial,
		   case when @CultureNo = 1 then ps.Title
	            when @CultureNo = 2 then ps.Title2
	       end as PersonelStatus,
	       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate desc) AS Rno,
		   case when @CultureNo = 1 then wp.Title
	            when @CultureNo = 2 then wp.Title2
	       end as WorkPlaceTitle,
	       am.Amount
	INTO   #Agg
	FROM   hrm.Agreement a
	       INNER JOIN HRM.Personel p
	            ON  p.PersonelID = a.PersonelID
	       INNER JOIN #SelPersonel
	            ON  #SelPersonel.PersonelID = p.PersonelID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID
	       INNER JOIN CFG.CostCenter cc
	            ON  cc.CostCenterID = a.CostCenterID
	       INNER JOIN HRM.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN HRM.[Job] j
	            ON  j.JobID = a.JobID
	       INNER JOIN hrm.AgreementType at
	            ON  at.AgreementTypeID = a.AgreementTypeID
		   INNER JOIN HRM.WorkPlace wp
				ON a.WorkPlaceID = wp.WorkPlaceID
	       INNER JOIN HRM.PersonelStatus AS ps
	                  ON ps.PersonelStatusID = at.PrePersonelStatusID
	       LEFT JOIN HRM.OccupationGrade og
	            ON  og.OccupationGradeID = a.OccupationGradeID
	       LEFT JOIN hrm.PayrollBase pb
	            ON  pb.PayrollBaseID = a.PayrollBaseID
	       LEFT JOIN hrm.PayrollGroup pg
	            ON  pg.PayrollGroupID = a.PayrollGroupID 
	       LEFT JOIN hrm.EmploymentStatus AS es
				ON es.EmploymentStatusID = a.EmploymentStatusID
	       LEFT JOIN hrm.Position AS p3
				ON p3.PositionID = a.PositionID
		   LEFT JOIN CFG.OrganizationUnit AS ou
			    ON ou.OrganizationUnitID = a.OrganizationUnitID
	       LEFT JOIN (SELECT  ap.AgreementID,SUM(ap.Amount) AS Amount 
					  FROM hrm.AgreementParameter AS ap
					  GROUP BY ap.AgreementID) Am
				ON Am.AgreementID = a.AgreementID
	WHERE 
		(@isAgreementNeedConfirm = 1 AND a.ConfirmDate BETWEEN @fromDate AND @toDate) 
		OR (@isAgreementNeedConfirm = 0 AND a.IssueDate BETWEEN @fromDate AND @toDate)

	DECLARE @params           VARCHAR(MAX),
	        @ParamsSelect     VARCHAR(MAX),
	        @Query            NVARCHAR(MAX)
	
	SELECT @params = STUFF(
	           (
	               SELECT ',' + QUOTENAME(p.ParameterID)
	               FROM   pay.Parameter p
	               WHERE  p.ParameterTypeID = 4
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
	                      QUOTENAME(p.ParameterID) + ' as [P_' + CAST(p.ParameterID AS VARCHAR(50)) 
	                      + ']'
	               FROM   pay.Parameter p
	               WHERE  p.ParameterTypeID = 4
	                      FOR XML PATH(''),
	                      TYPE
	           ).value('.', 'NVARCHAR(MAX)'),
	           1,
	           1,
	           ''
	       )
	
	
	
	DECLARE @lastQuery  NVARCHAR(500),
			@activePersonsJoin NVARCHAR(150)

	SET @lastQuery = ' WHERE 1 = 1'
	SET @activePersonsJoin = ''

	IF @activePersons = 1
	BEGIN
		SET @activePersonsJoin = ' LEFT JOIN [HRM].[vwPersonelStatusInDate] b 
								  ON b.PersonelID = a.PersonelID'
		SET @lastQuery += 'AND b.Date = CAST(GETDATE() AS DATE) 
						   AND b.Status != 3'
	END 

	IF @isLastAgreement=1
		SET @lastQuery += 'AND a.Rno = 1'
	
	SET @Query = ' select a.*, ' 
	    + @ParamsSelect +
	    '  from (
	
	SELECT *
	FROM    (
	               SELECT ap.AgreementID, ap.ParameterID, ap.Amount FROM hrm.AgreementParameter ap
	            ) x
	            PIVOT(
	                MAX(Amount)
	                FOR ParameterID IN (' + @params +
	    ')
	            ) as T ) P 
	            Inner join #Agg a on  a.AgreementID=P.AgreementID' + 
				@activePersonsJoin + @lastQuery + '
	           
	    Order By a.Code,a.ExecuteDate
	' 
	
	PRINT @Query
	EXEC (@Query)
