
------------------------------ START #8285
CREATE   PROCEDURE PAY.CreatePayrollFile
(
    @CalendarMonthID       INT,
    @CalcTypeID            VARCHAR(128) = '1',
    @FileID                INT,
    @BranchID              INT,
    @InputItems            NVARCHAR(MAX),
    @SelectedPersonnel     NVARCHAR(MAX) = NULL,
    @OrderByStr            NVARCHAR(MAX) = NULL,
    @IsForFile             BIT = 1,
	@PayPrepairingId	   INT = NULL
)
AS
	DECLARE @tableName VARCHAR(255),
			@CultureNo VARCHAR(10),
			@Culture VARCHAR(10),
			@userId INT,
			@DATEFORMAT VARCHAR(50),
	        @DateType INT,
	        @DateFormate6 VARCHAR(20), 	        
	        @DateFormate8 VARCHAR(20),
	        @DateFormate10 VARCHAR(20)
	        
	SET @Culture = CFG.GetuserCulture()

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture
	SELECT @tableName = cfg.getTempTableName(1)
	
	SET @userId = cfg.GetuserID()
	
	SELECT rfcst.[value] AS CalcTypeId
	INTO   #calcTypes
	FROM   cfg.R_FnCommaStr2Table(@CalcTypeID) AS rfcst
	
	IF @SelectedPersonnel = ''
	    SET @SelectedPersonnel = NULL
	
	IF @OrderByStr = ''
	    SET @OrderByStr = NULL
	
	IF @ISforFile = 1
		BEGIN
			IF CHARINDEX('F_',@OrderByStr)>=1
				SET @OrderByStr = NULL
		END
	
	SET @DATEFORMAT = 'YYYY/MM/DD'
	SET @DateFormate6 =  'YYMMDD'
	SET @DateFormate8 =  'YYYYMMDD'
	SET @DateFormate10 = 'YYYY/MM/DD'
	SET @DateType = cfg.GetCurrentUserDateType()
		
	DECLARE @Year VARCHAR(10),
	        @Month VARCHAR(10),
			@CalendarID INT,
			@OrgId INT,
			@Hour INT,
			@StartDate DATE,
	        @EndDate DATE,
	        @NextStartDate DATE,
			@payPaymnetTopicID TINYINT,
			@IsTamin BIT,
	        @IsLoan	BIT
		
	SELECT @payPaymnetTopicID = pf.PaymentTopicID
	FROM   pay.PayrollFile pf
	WHERE  pf.PayrollFileID = @FileID
	
	SET @IsTamin = 0
	SET @IsLoan = 0
	
	DECLARE @NeedConfirm     BIT,
	        @ISOrgan         BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	IF (
        SELECT pf.[FileName]
        FROM   pay.PayrollFile pf
        WHERE  pf.PayrollFileID = @FileID
    ) = 'DSKKAR00'
		SET @IsTamin = 1
	
	SELECT @OrgId = pf.OrganizationID,
	       @ISOrgan = pf.IsOrgan
	FROM pay.PayrollFile pf
	WHERE pf.PayrollFileID = @FileID
	
	CREATE TABLE #InputItems
	(
		Id        INT,
		VALUE     NVARCHAR(MAX)
	)

	INSERT INTO #InputItems
	SELECT cfg.GetStringPart(VALUE, 1),
	       cfg.GetStringPart(VALUE, 2)
	FROM   cfg.R_FnStr2TableBySplitor(@InputItems, '^') rfhst
		
	UPDATE #InputItems
	SET VALUE = CASE 
	                WHEN pfi.ItemRealType = 0 THEN ldi.Code
	                ELSE ldi.Title
	            END
	FROM #InputItems
	     INNER JOIN pay.PayrollFileItem AS pfi
	          ON  pfi.PayrollFileItemID = #InputItems.id
	     INNER JOIN cfg.LookupDataItem AS ldi
	          ON  ldi.LookupDataItemID = #InputItems.[VALUE]
	WHERE pfi.ItemType = 3
		
	DECLARE @radifColumn          NVARCHAR(512),
	        @radifLen             VARCHAR(10),
	        @RadifPaddingChar     VARCHAR(10),
			@CYear           INT,
	        @HasCalcYear     BIT
		
	SELECT @radifColumn = '['+pfi.EngName+']',
	       @radifLen             = pfi.ItemLength,
	       @RadifPaddingChar     = pfi.PaddingChar
	FROM pay.PayrollFileItem pfi
	WHERE pfi.PayrollFileID = @FileID
	      AND pfi.ItemType = 2
	      AND pfi.ItemValueType = 6
	      AND pfi.ItemValue = 'RadifNumber'
		
	SET @HasCalcYear = 0
		
	SELECT @CalendarID = c.CalendarID,
	       @StartDate = cm.StartDate,
	       @EndDate = cm.EndDate,
	       @NextStartDate = DATEADD(dd, 1, cm.EndDate),
	       @Hour = c.WorkHours,
	       @Year = SUBSTRING(CAST(c.[Year] AS VARCHAR(10)), 1, 4),
	       @CYear = c.[Year]
	FROM HRM.CalendarMonth cm
	     INNER JOIN HRM.Calendar c
			ON  c.CalendarID = cm.CalendarID
	WHERE cm.CalendarMonthID = @CalendarMonthId
	
	CREATE TABLE #ALLYearCalcs
	(
		CalcID       INT,
		CalcDate     DATE
	)
	
	CREATE TABLE #CustomFiledDataInfo
	(
		field             VARCHAR(100),
		Entity            VARCHAR(50),
		FieldName         VARCHAR(100),
		ItemValueType     BIT
	)
	
	INSERT INTO #CustomFiledDataInfo
	SELECT 'TaxDocCode',
	       'studyDegree',
	       'TaxDocCode',
	       0
	UNION
	SELECT 'VehicleStatus',
	       'Personel',
	       'VehicleStatus',
	       0
	UNION
	SELECT 'HousingStatus',
	       'Personel',
	       'HousingStatus',
	       0
	UNION
	SELECT 'TaxWorkPlaceStatus',
	       'WorkPlace',
	       'TaxWorkPlaceStatus',
	       0
	UNION
	SELECT 'TaxAgreementTypeCode',
	       'AgreementType',
	       'TaxAgreementType',
	       0
	UNION
	SELECT 'TaxEmploymentTypeCode',
	       'EmploymentType',
	       'TaxEmploymentType',
	       0
	UNION
	SELECT 'CountryCode',
	       'Location',
	       'TaxCode',
	       0
	
	IF EXISTS (
	    SELECT *
	    FROM   pay.PayrollFileItem pfi
	    WHERE  pfi.PayrollFileID = @FileID
	           AND pfi.ItemValueType = 7
	           AND pfi.ItemType <> 3
	)
		BEGIN
		    SET @IsLoan = 1
		    SELECT DISTINCT CAST(rfcst.[value] AS INT) AS ParameterID
		    INTO   #selParameterForLoan
		    FROM   pay.PayrollFileItem pfi
		           OUTER APPLY cfg.R_FnCommaStr2Table(pfi.ItemValue) rfcst
		    WHERE  pfi.PayrollFileID = @FileID
		           AND (pfi.ItemType = 2 AND pfi.ItemValueType = 4)
		           AND CAST(rfcst.[value] AS INT) > 0
		END
	
	IF EXISTS (
	    SELECT *
	    FROM   pay.PayrollFileItem pfi
	    WHERE  pfi.PayrollFileID = @FileID
	           AND pfi.ItemDataSourceType <> 0
	)
		SET @HasCalcYear = 1
		
	SELECT @Month = T.RNO
	FROM   (
	           SELECT *,
	                  ROW_NUMBER() OVER(ORDER BY cm.StartDate) AS RNO
	           FROM   hrm.CalendarMonth cm
	           WHERE  cm.CalendarID = @CalendarID
	       ) AS T
	WHERE  T.CalendarMonthID = @CalendarMonthID
	
	SET @Month = REPLACE(STR(@Month, 2), ' ', '0')
	
	DECLARE @FileNumber       VARCHAR(512),
	        @OrgAddress       NVARCHAR(2048),
	        @AgreementRow     VARCHAR(10),
	        @OrgEmployer   NVARCHAR(512)
	
	SELECT @FileNumber = oi.FileNumber,
	       @AgreementRow     = oi.AgreementRow,
	       @OrgEmployer =oi.Employer,
	       @OrgAddress  =oi.[Address]
	FROM   hrm.OrganizationItem oi
	WHERE  oi.OrganizationItemID = @BranchID
	
	-------------------- Start Some Localization --------------------
	DECLARE @AgricultureAndnvironment     NVARCHAR(2048),
	        @EducationAndCulture          NVARCHAR(2048),
	        @FacultyMembers               NVARCHAR(2048),
	        @FinancialOffice              NVARCHAR(2048),
	        @Healthcare                   NVARCHAR(2048),
	        @Investigations               NVARCHAR(2048),
	        @IT                           NVARCHAR(2048),
	        @Judges                       NVARCHAR(2048),
	        @Other                        NVARCHAR(2048),
	        @Production                   NVARCHAR(2048),
	        @Proletarian                  NVARCHAR(2048),
	        @QC                           NVARCHAR(2048),
	        @RecoveryAndSell              NVARCHAR(2048),
	        @SecurityAndGuarding          NVARCHAR(2048),
	        @Services                     NVARCHAR(2048),
	        @SocialAffairs                NVARCHAR(2048),
	        @TechnicalEngineering         NVARCHAR(2048),
	        @Transportation               NVARCHAR(2048),
	        @Warehousing                  NVARCHAR(2048)
	
	SELECT @AgricultureAndnvironment = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'AgricultureAndnvironment'
	
	SELECT @EducationAndCulture = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'EducationAndCulture'
	
	SELECT @FacultyMembers = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'FacultyMembers'
	
	SELECT @FinancialOffice = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'FinancialOffice'
	
	SELECT @Healthcare = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Healthcare'
	
	SELECT @Investigations = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Investigations'
	
	SELECT @IT = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'IT'
	
	SELECT @Judges = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Judges'
	
	SELECT @Other = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Other'
	
	SELECT @Production = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Production'
	
	SELECT @Proletarian = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Proletarian'
	
	SELECT @QC = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'QC'
	
	SELECT @RecoveryAndSell = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'RecoveryAndSell'
	
	SELECT @SecurityAndGuarding = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'SecurityAndGuarding'
	
	SELECT @Services = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Services'
	
	SELECT @SocialAffairs = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'SocialAffairs'
	
	SELECT @TechnicalEngineering = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'TechnicalEngineering'
	
	SELECT @Transportation = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Transportation'
	
	SELECT @Warehousing = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'JObGroups'
	       AND le.Item = 'Warehousing'    
	-------------------- End Some Localization --------------------

	CREATE TABLE #END
	(
		PersonelID     INT,
		ChangeDate     DATE,
		IsTark         BIT DEFAULT 1
	)
	
	CREATE TABLE #IsLastAgreement
	(
		PersonelId INT
	)
	
	IF EXISTS (
        SELECT 1
        FROM   pay.PayrollFileItem AS pfi
        WHERE  pfi.PayrollFileID = @FileID
               AND pfi.ItemValue = 'LastAgreement'
    )
	BEGIN
	    INSERT INTO #IsLastAgreement
	    SELECT PersonelID
	    FROM (
			SELECT cps.PersonelID,
			       cps.ChangeDate,
			       cps.[Status],
			       ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
			FROM   hrm.ChangePersonelStatus cps
			WHERE  cps.ChangeDate <= @NextStartDate
			       AND cps.IssueDate <= @EndDate
	    ) TCPS
	    WHERE  (
	               TCPS.[Status] IN (3, 6)
	               AND TCPS.ChangeDate BETWEEN @StartDate AND @NextStartDate
	           )
	           AND Rno = 1
	END
	
	CREATE TABLE #ChangeBranch
	(
		AgreementID INT,
		PersonelID INT,
		PartyID INT,
		OrganizationItemID0 INT,
		OrganizationItemID INT,
		AssignmentDate DATE,
		ExecuteDate DATE,
		Rno INT,
		Karkard INT,
		NextDate DATE,
		NextOrganizationItemID INT,
		HasNext INT,
		SumBefore INT,
		RadifPeymanChanged BIT
	)
	
	IF @IsTamin = 1
		BEGIN
		    CREATE TABLE #StartAgreementType
		    (
		    	Id INT
		    )
		    
		    INSERT INTO #StartAgreementType
		    EXEC Hrm.GetStartAgreementType 
		    
		    SELECT T.PersonelID,
		           T.IssueDate,
		           CASE 
		                WHEN T.EmploymentDate <@StartDate THEN T.EmploymentDate
		                ELSE @StartDate
		           END AS EmploymentDate
		    INTO   #Start
		    FROM   (
		               SELECT a.PersonelID,
		                      a.IssueDate,
		                      a.ExecuteDate,
		                      a.EmploymentDate,
		                      ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
		               FROM   HRM.Agreement a
		               WHERE  a.ExecuteDate <= @EndDate
		                      AND (a.IssueDate <= @EndDate)
		                      AND a.AgreementTypeID IN (SELECT id
		                                                FROM   #StartAgreementType)
		           ) T
		    WHERE  T.Rno = 1
		    
		    INSERT INTO #ChangeBranch
		    SELECT a.AgreementID,
		           a.PersonelID,
				   ao.PartyID,
		           ao.OrganizationItemID,
		           ao.OrganizationItemID,
		           ao.AssignmentDate,
		           a.ExecuteDate,
		           0 AS Rno,
		           0 AS Karkard,
		           NULL AS NextDate,
		           NULL AS NextOrganizationItemID,
		           0 AS HasNext,
		           0 AS SumBefore,
				   0 AS RadifPeymanChanged
		    FROM (
				SELECT a.PersonelID,
				       a.AgreementID,
				       a.ExecuteDate,
				       ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
				FROM hrm.Agreement a
				INNER JOIN #Start AS s
					ON  s.PersonelId = a.PersonelID AND A.ExecuteDate >= s.EmploymentDate
				WHERE (
				          (@NeedConfirm = 0 AND a.IssueDate < @EndDate)
				          OR (
				                 @NeedConfirm = 1
				                 AND a.ConfirmDate IS NOT NULL
				                 AND a.ConfirmDate <= @EndDate
				             )
				      )
				      AND a.ExecuteDate < @StartDate
		    ) AS a
		    LEFT JOIN (
				SELECT	aot.AgreementID,
						oi.PartyID,
						aot.OrganizationItemID,
						aot.AssignmentDate
				FROM HRM.AgreementOrganization AS aot
				JOIN HRM.OrganizationItem AS oi
					ON oi.OrganizationItemID = aot.OrganizationItemID
				WHERE  oi.OrganizationID = @OrgId
		    ) AS ao
				ON a.AgreementID = ao.AgreementID
		    WHERE a.rno = 1 
		    
		    INSERT INTO #ChangeBranch
		    SELECT a.AgreementID,
		           a.PersonelID,
				   ao.PartyID,
		           ao.OrganizationItemID,
		           ao.OrganizationItemID,
		           ao.AssignmentDate,
		           a.ExecuteDate,
		           ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate) AS Rno,
		           0,
		           NULL,
		           NULL,
		           0,
		           0,
				   0 -- RadifPeymanChanged
		    FROM HRM.Agreement a
		    LEFT JOIN (
		        SELECT	aot.AgreementID,
						oi.PartyID,
						aot.OrganizationItemID,
						aot.AssignmentDate
				FROM HRM.AgreementOrganization AS aot
				JOIN HRM.OrganizationItem AS oi
					ON oi.OrganizationItemID = aot.OrganizationItemID
				WHERE  oi.OrganizationID = @OrgId
		    ) AS ao
				ON  a.AgreementID = ao.AgreementID
		    WHERE (
					(@NeedConfirm = 0 AND a.IssueDate <= @EndDate)
		            OR (
						@NeedConfirm = 1
						AND a.ConfirmDate IS NOT NULL
						AND a.ConfirmDate <= @EndDate
					)
		          )
		          AND a.ExecuteDate BETWEEN @StartDate AND @EndDate
		    
		    UPDATE T
		    SET organizationItemId = NULL
		    FROM #ChangeBranch t
		    INNER JOIN (
				SELECT TCPS.AgreementID
				FROM (
					SELECT cps.AgreementID,
					       ChangeDate,
					       cps.[Status]
					FROM   hrm.ChangePersonelStatus cps
					WHERE  cps.ChangeDate <= @EndDate
					       AND cps.IssueDate <= @EndDate
				) TCPS
				WHERE  (
				           TCPS.[Status] IN (3, 1, 6)
				           AND TCPS.ChangeDate BETWEEN @StartDate AND @EndDate
				       )
		    ) AS TCPS1
				ON  TCPS1.AgreementID = t.AgreementID
		    


		    UPDATE #ChangeBranch
		    SET NextDate = CASE 
		                        WHEN n.OrganizationItemID IS NOT NULL THEN n.AssignmentDate
		                        ELSE n.ExecuteDate
		                   END,
		        NextOrganizationItemID = n.OrganizationItemID,
		        HasNext = 1,
				RadifPeymanChanged = CASE
										 WHEN n.PersonelId = #ChangeBranch.PersonelID AND #ChangeBranch.PartyID <> n.PartyID
										 	 THEN 0
										 ELSE 1
									 END
		    FROM #ChangeBranch
		    INNER JOIN #ChangeBranch n
				ON n.rno = #ChangeBranch.rno + 1
		           AND n.PersonelId = #ChangeBranch.PersonelID 
				   AND n.AssignmentDate < @EndDate
		    


		    INSERT INTO #END
		    SELECT PersonelID,
		           CASE 
		                WHEN OrganizationItemID IS NULL THEN ExecuteDate
		                ELSE NextDate
		           END,
		           1
		    FROM #ChangeBranch
		    WHERE OrganizationItemID0 = @BranchID
		          AND HasNext = 1 
				  AND OrganizationItemID0 <> ISNULL(NextOrganizationItemID, -1)
		    

		    INSERT INTO #END
		    SELECT PersonelID,
		           TCPS.ChangeDate,
		           0
		    FROM (
				SELECT cps.PersonelID,
				       cps.ChangeDate,
				       cps.[Status],
				       ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) Rno
				FROM   hrm.ChangePersonelStatus cps
				WHERE  cps.ChangeDate <= @EndDate
				       AND cps.IssueDate <= @EndDate
		    ) TCPS
		    WHERE TCPS.[Status] IN (0)
		          AND Rno = 1
		    
		    
		    
		    DECLARE @KarkardParam INT
		    
		    SELECT @KarkardParam = pfi.ItemValue
		    FROM   pay.PayrollFileItem AS pfi
		    WHERE  pfi.PayrollFileID = @FileID
		           AND pfi.EngName = 'DSW_DD'
		    
		    
		    
		    SELECT c.personelId,
		           c.value AS [Value]
		    INTO   #Karkard
		    FROM (
				SELECT PersonelID,
				       cr.[Value]
				FROM pay.CalculationResult cr
				INNER JOIN pay.CalculationPersonel AS cp 
					ON cr.CalculationPersonelID=cp.CalculationPersonelID
				INNER JOIN #calcTypes AS ct 
					ON cp.CalculationTypeID=ct.CalcTypeID   
				WHERE ParameterValueTypeID IN (7,16)
				      AND ParameterID = @KarkardParam
				      AND cp.CalendarMonthID=@CalendarMonthID
		                      
		    ) c
		    WHERE EXISTS (
		              SELECT 1
		              FROM   #ChangeBranch cc
		              WHERE  cc.personelId = c.personelId
		                     AND AssignmentDate > @StartDate
		          )
		    
		    
		    
		    
		    UPDATE #ChangeBranch
		    SET    Karkard = DATEDIFF(
		               dd,
		               CASE 
		                    WHEN AssignmentDate <= @StartDate THEN @StartDate
		                    ELSE AssignmentDate
		               END,
		               ISNULL(NextDate, DATEADD(dd, 1, @EndDate))
		           )
		    WHERE  personelId IN (SELECT personelId
		                          FROM   #Karkard)
		    
		    
		    UPDATE #ChangeBranch
		    SET    SumBefore = ISNULL(
		               (
		                   SELECT SUM(Karkard)
		                   FROM   #ChangeBranch c
		                   WHERE  c.personelId = #ChangeBranch.PersonelId
		                          AND c.Rno < #ChangeBranch.Rno
		               ),
		               0
		           )
		    WHERE  personelId IN (SELECT personelId
		                          FROM   #Karkard)

			


		    UPDATE #ChangeBranch
		    SET karkard =	CASE 
		                        WHEN #Karkard.Value > #ChangeBranch.Karkard + SumBefore THEN #ChangeBranch.Karkard
		                        ELSE 
									CASE 
		                                    WHEN #Karkard.Value - SumBefore < 0 THEN 0
		                                    ELSE #Karkard.Value - SumBefore
		                            END
							END
		    FROM #ChangeBranch
		    INNER JOIN #Karkard
				ON #Karkard.PersonelId = #ChangeBranch.PersonelId
				

		END
	ELSE
		BEGIN
		    INSERT INTO #END
		    SELECT TCPS1.PersonelID,
		           ChangeDate,
		           CASE 
		                WHEN TCPS1.[Status] = 0 THEN 0
		                ELSE 1
		           END
		    FROM (
				SELECT PersonelID,
				       ChangeDate,
				       [Status]
				FROM (
					SELECT cps.PersonelID,
					       cps.ChangeDate,
					       cps.[Status],
					       ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS Rno
					FROM   hrm.ChangePersonelStatus cps
					WHERE  cps.ChangeDate <= DATEADD(day,1,@EndDate)
					       AND cps.IssueDate <= DATEADD(day,1,@EndDate)
				) AS TCPS
				WHERE (
				          (
				              TCPS.[Status] IN (3, 1, 6)
				              AND TCPS.ChangeDate BETWEEN @StartDate AND DATEADD(day,1,@EndDate)
				          )
				          OR (TCPS.[Status] IN (0))
				      )
				      AND Rno = 1
		    ) AS TCPS1
		END
	
	---------- #AGG Temp Table ----------
	SELECT T.PersonelID,
	       T.AgreementTypeID,
	       T.EmploymentTypeID,
	       T.WorkPlaceID,
	       T.EmploymentType,
	       CAST(T.EmploymentTypeCode AS VARCHAR(10)) AS EmploymentTypeCode,
	       CostCenter,
	       WorkPlace,
	       T.JobTitle,
	       T.InsuranceCode,
	       CAST('' AS VARCHAR(50)) AS EndDate,
	       Org.AssignmentDate AS EmploymentDate,
	       T.EmploymentDate AS TaxEmploymentDate,
	       Org.AssignmentDate AS RealEmploymentDate,
	       CAST(t.[group] AS VARCHAR(10)) AS [GROUP],
	       CASE t.[group]
	            WHEN 0 THEN @Other
	            WHEN 1 THEN @FinancialOffice
	            WHEN 2 THEN @EducationAndCulture
	            WHEN 3 THEN @SocialAffairs
	            WHEN 4 THEN @IT
	            WHEN 5 THEN @Healthcare
	            WHEN 6 THEN @TechnicalEngineering
	            WHEN 7 THEN @Services
	            WHEN 8 THEN @AgricultureAndnvironment
	            WHEN 9 THEN @RecoveryAndSell
	            WHEN 10 THEN @SecurityAndGuarding
	            WHEN 11 THEN @Proletarian
	            WHEN 12 THEN @Transportation
	            WHEN 13 THEN @Production
	            WHEN 14 THEN @QC
	            WHEN 15 THEN @Investigations
	            WHEN 16 THEN @Warehousing
	            WHEN 17 THEN @Judges
	            WHEN 18 THEN @FacultyMembers
	       END AS JobClass
	INTO #AGG
	FROM (
		SELECT  a.*,
				CASE @CultureNo
					WHEN 1 THEN et.Title 
					ELSE et.Title2 
				END AS EmploymentType,
				et.Code AS EmploymentTypeCode,
				CASE @CultureNo
					WHEN 1 THEN cc.Title 
					ELSE cc.Title2 
				END AS CostCenter,
				CASE @CultureNo
					WHEN 1 THEN wp.Title 
					ELSE wp.Title2 
				END AS WorkPlace,
				CASE @CultureNo
					WHEN 1 THEN j.Title 
					ELSE j.Title2 
				END AS JobTitle,
				j.InsuranceCode,
				j.[group],
				ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
		FROM   hrm.Agreement a
	    INNER JOIN hrm.EmploymentType et
			ON  et.EmploymentTypeID = a.EmploymentTypeID
		INNER JOIN cfg.CostCenter cc
		     ON  cc.CostCenterID = a.CostCenterID
		INNER JOIN hrm.WorkPlace wp
		     ON  wp.WorkPlaceID = a.WorkPlaceID
		INNER JOIN 
	    (
			SELECT	a.JobID,
					a.Title,
					a.Title2,
					a.Code,
					jg.Code [Group],
					OccupationGradeID,
					CASE 
						WHEN InsuranceCode is not null THEN InsuranceCode
						ELSE d.Code 
					END InsuranceCode,
					FieldName
			FROM HRM.Job a
			LEFT JOIN hrm.JobGroup AS jg ON jg.JobGroupID = a.[group]
			LEFT JOIN (
				SELECT b.EntityID,
					   FieldName,
					   LookupDataItemID 
				FROM cfg.EntityCustomeFieldData b						
				JOIN cfg.EntityCustomeField c 
		  			ON c.EntityCustomeFieldID = b.EntityCustomeFieldID AND FieldName = 'InsuranceCode'
		  	) AS b	
				ON a.JobID = b.EntityID 
			LEFT JOIN cfg.LookupDataItem d
		  		ON d.LookupDataItemID = b.LookupDataItemID
	    ) AS j
			ON j.JobID = a.JobID
	    WHERE (
			      @SelectedPersonnel IS NULL
			      OR a.PersonelID IN (
										SELECT VALUE
										FROM cfg.R_FnCommaStr2Table(@SelectedPersonnel) rfcst
									 )
			  )
			  AND a.ExecuteDate <= @EndDate
			  AND (
			          @NeedConfirm = 0
			          OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @EndDate)
			      )
			  AND a.IssueDate <= @EndDate
	) AS T
	LEFT JOIN (
		SELECT *
		FROM   hrm.AgreementOrganization ao
		WHERE  ao.OrganizationItemID = @BranchID
	) AS Org
		ON org.AgreementID = T.AgreementID
	INNER JOIN cfg.vwBranchAccess AS vba 
		ON vba.BranchID = T.BranchID
	WHERE  Rno = 1
	       AND (
	               @ISOrgan = 0
	               OR @IsLoan = 1
	               OR @IsTamin = 1
	               OR org.AgreementOrganizationID IS NOT NULL
	           )
	       AND (
	               @IsTamin = 0
	               OR EXISTS (
	                      SELECT 1
	                      FROM   #ChangeBranch
	                      WHERE  OrganizationItemID0 = @BranchID
	                             AND T.PersonelID = #ChangeBranch.PersonelID
	                  )
	           )
	
	IF @IsTamin = 1
		BEGIN
		    UPDATE #AGG
		    SET EmploymentDate = CASE 
		                              WHEN #ChangeBranch.AssignmentDate < @StartDate
		                                   OR #ChangeBranch.AssignmentDate > @EndDate THEN NULL
		                              ELSE #ChangeBranch.AssignmentDate
		                         END
		    FROM #AGG
		    INNER JOIN #ChangeBranch
				ON  #AGG.PersonelId = #ChangeBranch.PersonelId
		    WHERE #ChangeBranch.OrganizationItemId = @BranchID
		    
		    
  
		       UPDATE #AGG
	    SET    EndDate     = #END.ChangeDate--  cfg.GetSaturnDate(#END.ChangeDate, 0)
	    FROM   #AGG
	           INNER JOIN #END
	                ON  #AGG.PersonelID = #END.PersonelID
	    WHERE  IsTark      = 1
		    
		    
		    
		END
	ELSE
		BEGIN
		    UPDATE #AGG
		    SET EndDate = #END.ChangeDate
		    FROM #AGG
		    INNER JOIN #END
				ON #AGG.PersonelID = #END.PersonelID
		END

	SELECT ppi.PersonnelID
	INTO #PayPreparingPersonnel
	FROM Pay.PayPreparingItem ppi
	where ppi.PayPreparingID = @PayPrepairingId
	
	CREATE TABLE #SelPersonel
	(
		PersonelID          INT,
		IsCalc              BIT,
		LoanID              INT,
		CalendarMonthID     INT
	)
	
	IF @HasCalcYear = 1
	    BEGIN
			INSERT INTO #SelPersonel
			SELECT DISTINCT calc.PersonelID,
			       1 AS IsCalc,
			       NULL,
			       CalendarMonthID
			FROM (
				SELECT cp.PersonelID,
				       ROW_NUMBER() OVER(
				           PARTITION BY cp.PersonelID ORDER BY cp.CalcDate 
				           DESC
				       ) AS RNO,
				       cp.CalendarMonthID
				FROM pay.CalculationPersonel cp
			    JOIN #calcTypes AS ct 
					ON cp.CalculationTypeID=ct.CalcTypeId
			) AS calc
			INNER JOIN #AGG
				ON  calc.PersonelID = #AGG.PersonelID AND calc.RNO = 1
			LEFT JOIN #PayPreparingPersonnel ppip
				ON ppip.PersonnelID =calc.PersonelID
			WHERE @PayPrepairingId IS NULL OR ppip.PersonnelID IS NOT NULL
		END
	ELSE
		BEGIN
		    IF @IsLoan = 1
		        INSERT INTO #SelPersonel
		        SELECT DISTINCT cp.PersonelID,
		               1 AS IsCalc,
		               cr.LoanID,
		               @CalendarMonthID
		        FROM pay.CalculationPersonel cp
		        INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeId
		        INNER JOIN #AGG
		            ON  cp.PersonelID = #AGG.PersonelID
		        INNER JOIN pay.CalculationResult cr
		            ON  cr.CalculationPersonelID=cp.CalculationPersonelID
		        INNER JOIN pay.Loan l2
		            ON  l2.LoanID = cr.LoanID
		        WHERE cr.ParameterValueTypeID IN (7,16)
		              AND l2.OrganizationItemID = @BranchID
		              AND cr.ParameterID IN (SELECT parameterid
		                                     FROM   #selparameterForLoan)
		              AND cp.CalendarMonthID=@CalendarMonthID
		    ELSE
		        INSERT INTO #SelPersonel
		        SELECT DISTINCT cp.PersonelID,
		               1 AS IsCalc,
		               NULL,
		               @CalendarMonthID
		        FROM pay.CalculationPersonel cp
		        INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeId
		        INNER JOIN #AGG
					ON  cp.PersonelID = #AGG.PersonelID
				LEFT JOIN #PayPreparingPersonnel ppip
					ON ppip.PersonnelID =cp.PersonelID
		        WHERE cp.CalendarMonthID=@CalendarMonthID 
				AND (@PayPrepairingId IS NULL OR ppip.PersonnelID IS NOT NULL)
		END
		
	IF @IsTamin = 1
		BEGIN
		    INSERT INTO #SelPersonel
		    SELECT e.PersonelID,
		           0,
		           NULL,
		           @CalendarMonthID
		    FROM #END e
		    LEFT JOIN #SelPersonel sel 
				ON e.PersonelID=sel.PersonelID
		    WHERE sel.PersonelID IS null
		    
		    UPDATE #SelPersonel
		    SET IsCalc = 0
		    FROM #SelPersonel
		    INNER JOIN #END
				ON #END.PersonelID = #SelPersonel.PersonelID
		END

	DECLARE @AboveDiploma NVARCHAR(2048),
	        @Bachelor NVARCHAR(2048),
	        @Diploma NVARCHAR(2048),
	        @IlliterateAndLowLiteracy NVARCHAR(2048),
	        @Masters NVARCHAR(2048),
	        @PhD NVARCHAR(2048),
	        @Postdoc NVARCHAR(2048),
	        @UnderDiploma NVARCHAR(2048)
	
	DECLARE @OtherI                NVARCHAR(1024),
	        @PensionInsuranceI     NVARCHAR(1024),
	        @MedicalInsuranceI     NVARCHAR(1024),
	        @UninsuredI            NVARCHAR(1024)
	
	SELECT @OtherI = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'InsuranceType'
	       AND le.Item = 'Other'
	
	SELECT @PensionInsuranceI = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'InsuranceType'
	       AND le.Item = 'PensionInsurance'
	
	SELECT @MedicalInsuranceI = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'InsuranceType'
	       AND le.Item = 'MedicalInsurance'
	
	SELECT @UninsuredI = lev.[Value]
	FROM   cfg.LocalizeEnum le
	       INNER JOIN cfg.LocalizeEnumValue lev
	            ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  lev.Culture = cfg.GetuserCulture()
	       AND le.Enum = 'InsuranceType'
	       AND le.Item = 'Uninsured'
		
	---------- #P Temp Table (Insert) ----------
	SELECT p.PersonelID,
	       CASE 
				WHEN @CultureNo = 1 THEN p2.Title 
				ELSE p2.Title2 
		   END AS FirstName,
	       CASE 
				WHEN @CultureNo = 1 THEN p2.LastName 
				ELSE p2.LastName2 
		   END AS LastName,
	      CASE WHEN ISNULL(ldi2.Code,0) = 1 then  p.BirthCertificateNumber else Null END BirthCertificateNumber,
	     CASE WHEN @IsTamin <> 1 THEN  ISNULL( p2.IdentificationCode,p2.FidaIdCode) 
	     ELSE p2.IdentificationCode END AS NationalID,
	       case when @CultureNo = 1 then ldi2.Title else ldi2.Title2 end  AS NationalTitle,
	       CAST(ldi2.Code AS VARCHAR(10)) AS Nationality,
	       p.Birthday AS Birthday,
	       ISNULL(CAST(e.Code AS VARCHAR(10)),'2') AS EducationDocCode,
	       e.StudyDegreeID,
	       account.AccountNumber,
	       p.ExemptionCause,
	       p.InsuranceNumber,
	       p.Code,
	       p.FatherName AS FatherName2,
	       CAST(ldi3.Code AS VARCHAR(10)) AS InuranceTypeCode,
	       CASE 
				WHEN @CultureNo = 1 THEN ldi3.Title 
				ELSE ldi3.Title2 
		   END AS InuranceTypeTitle,
	       addr.ZipCode AS PostCode,
	       e.Title AS Education,
	       CASE
	            WHEN p.Sex = 0 THEN N'مرد'
	            ELSE N'زن'
	       END AS Sex,
	       CAST(ldi.Code AS VARCHAR(10)) AS TaxExemptionCause,
	       CAST(ex.Sanavat AS VARCHAR(30)) AS Sanavat,
	       ISNULL(#selPersonel.LoanID, 0) AS LoanID,
	       #selPersonel.CalendarMonthID,
	       CASE
	            WHEN @CultureNo = 1 THEN l.Title 
				ELSE l.Title2 
		   END AS IssueLocation,
		    CASE
	            WHEN @CultureNo = 1 THEN l2.Title 
				ELSE l2.Title2 
		   END AS BirthLocation,
	       Cfg.GetCLRSaturnDate(p.BirthCertificateDate, @DATEFORMAT, 0, @DateType) AS BirthCertificateDate,
	       l4.ParentID AS CountryID,
	       addr.[Address] PersonelAddress
	INTO #P
	FROM #selPersonel
	INNER JOIN hrm.Personel p
		ON  p.PersonelID = #selPersonel.PersonelID
	INNER JOIN CFG.Party p2
		ON  p2.PartyID = p.PartyID
	LEFT JOIN (
		SELECT *,
			   ROW_NUMBER() OVER (PARTITION BY a.PartyID ORDER BY a.AddressID) AS ARNO
		FROM cfg.[Address] a
		WHERE a.IsMain = 1
	) AS addr
		ON  addr.PartyID = p2.PartyID AND addr.ARNO=1
	LEFT JOIN (
	    SELECT e.*,
	           sd.Title,
	           sd.Code,
	           ROW_NUMBER() OVER(PARTITION BY e.PersonelID ORDER BY e.EndDate DESC) AS Rno
	    FROM hrm.Education e
	    LEFT JOIN HRM.StudyDegree AS sd
			ON  sd.StudyDegreeID = e.StudyDegreeID
	    WHERE e.Skill = 0
	) AS e
		ON  e.PersonelID = p.PersonelID AND e.Rno = 1
	LEFT JOIN (
	    SELECT e2.PersonelID,
	           SUM(CAST(e2.History AS INT)) AS Sanavat
	    FROM   hrm.Experience e2
	    GROUP BY
	           e2.PersonelID
	) AS ex
		ON ex.PersonelID = p.PersonelID
	LEFT JOIN (
	    SELECT *,
	           ROW_NUMBER() OVER(PARTITION BY PersonelID ORDER BY [Date] DESC) AS RNO
	    FROM Hrm.PersonelAccount
	    WHERE Hrm.PersonelAccount.Date <= @ENDdate
	          AND Hrm.PersonelAccount.PaymentTopicID = @PayPaymnetTopicID
	      
	) AS account
		ON account.PersonelID = p.PersonelID AND account.RNO = 1 AND account.BankBranchID=@BranchID
	LEFT JOIN cfg.Location AS l
		ON  p.IssueLocationID = l.LocationID
	LEFT JOIN cfg.LookupDataItem AS ldi
		ON  ldi.LookupDataItemID = p.TaxExemptionCause
	LEFT JOIN cfg.LookupDataItem AS ldi2
		ON  ldi2.LookupDataItemID = p2.Nationality
	LEFT JOIN cfg.LookupDataItem AS ldi3
	    ON  ldi3.LookupDataItemID = p.InsuranceType
	LEFT JOIN cfg.Location AS l2
	    ON  l2.LocationID = p.BirthLocationID
	LEFT JOIN cfg.Location AS l3
	    ON  l3.LocationID = l2.ParentID
	LEFT JOIN cfg.Location AS l4
	    ON  l4.LocationID = l3.ParentID
	WHERE (
			  @ISOrgan = 1
			  OR @IsLoan = 1
			  OR account.PersonelID IS NOT NULL
	      )
	
	DECLARE @Query NVARCHAR(MAX)
	--  PARAMETERS
		
	---------- #Res Temp Table (Insert) ----------
	SELECT pfi.PayrollFileItemID,
	       pfi.Title,
	       CASE 
	            WHEN @IsForFile = 1 THEN TRIM(pfi.EngName)
	            ELSE 'F_' + CAST(pfi.PayrollFileItemID AS VARCHAR(50))
	       END AS EngName,
	       pfi.ItemOrder,
	       pfi.ItemType,
	       pfi.ItemValueType,
	       pfi.ItemValue,
	       pfi.PaddingChar,
	       pfi.ItemLength,
	       pfi.DisplayTarget,
	       pfi.ItemRealType,
	       pfi.AggFunc,
	       #selPersonel.PersonelID,
	       CAST('' AS NVARCHAR(2048)) COLLATE ARABIC_CI_AI AS VALUE,
	       #selPersonel.LoanID
	INTO #Res
	FROM PAY.PayrollFileItem pfi
	CROSS JOIN #selPersonel
	WHERE pfi.PayrollFileID = @FileID
	
	---------- #Res2 Temp Table (Insert) ----------
	SELECT pfi.PayrollFileItemID,
	       pfi.Title,
	       CASE 
	            WHEN @IsForFile = 1 THEN pfi.EngName
	            ELSE 'F_' + CAST(pfi.PayrollFileItemID AS VARCHAR(50))
	       END AS EngName,
	       pfi.ItemType,
	       pfi.ItemValueType,
	       rfcst.[value] AS ItemValue,
	       pfi.PaddingChar,
	       pfi.ItemLength,
	       pfi.ItemDataSourceType,
	       #selPersonel.PersonelID,
	       CAST(0 AS DECIMAL(18, 0)) AS VALUE,
	       #selPersonel.LoanID
	INTO #Res2
	FROM pay.PayrollFileItem pfi
	CROSS JOIN #selPersonel
	OUTER APPLY cfg.R_FnCommaStr2Table(pfi.ItemValue) rfcst
	WHERE pfi.PayrollFileID = @FileID
	      AND (pfi.ItemType = 2 AND pfi.ItemValueType = 4)
	
	CREATE TABLE #LoanInfo
	(
		LoanID         INT,
		AllLOan        DECIMAL(18, 0),
		LoanNumber     NVARCHAR(1024)
	)
	
	IF @IsLoan = 1
		BEGIN
		    UPDATE #res2
		    SET VALUE = CAST(CAST(cr.[Value] AS DECIMAL(18, 0)) AS VARCHAR(50))
		    FROM #Res2
		    LEFT JOIN (
				SELECT PersonelID,
				       ParameterID,
				       ParameterValueTypeID,
				       LoanID,
				       SUM(VALUE) AS VALUE
				FROM   pay.CalculationResult cr
				INNER JOIN pay.CalculationPersonel AS cp 
					ON cp.CalculationPersonelID = cr.CalculationPersonelID
				INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeID
				            
				WHERE  ParameterValueTypeID IN (7, 14)
				       AND LoanID IS NOT NULL
				       AND cp.CalendarMonthID=@CalendarMonthID
				GROUP BY
				       PersonelID,
				       ParameterID,
				       ParameterValueTypeID,
				       LoanID
		    ) AS cr
				ON  cr.PersonelID = #RES2.PersonelId
		            AND cr.LoanID = #RES2.LoanID
		            AND (
						(
						    cr.ParameterID = #RES2.ItemValue
						    AND cr.ParameterValueTypeID = 7
						)
						OR (
							cr.ParameterID = CAST(#RES2.ItemValue AS INT)
							* -1
							AND cr.ParameterValueTypeID = 14
						)
		            )
		            AND ItemType = 2
		            AND ItemValueType = 4
		            AND ItemDataSourceType = 0
		    
		    
		    INSERT INTO #LoanInfo
		    SELECT #RES2.LoanID,
		           l.TotalAmount,
		           l.FacilitiesNumber
		    FROM #RES2
		    INNER JOIN (SELECT * FROM Pay.Loan l) AS L
				ON  l.LoanID = #res2.LoanID
		END
	ELSE 
	IF @IsTamin = 1
		BEGIN
		    UPDATE #res2
		    SET VALUE = CAST(
				CAST(cr.[Value] AS DECIMAL(18, 0)) * (
				    CASE 
						WHEN #Karkard.PersonelId IS NULL OR p.SystemName = 'NoSharing' THEN 1
						WHEN #Karkard.Value = 0  THEN 1
						ELSE Karkard / #Karkard.Value
				    END
				) AS VARCHAR(50)
		    )
		    FROM #Res2
		    LEFT JOIN (
				SELECT PersonelID,
				       ParameterID,
				       SUM(VALUE) AS VALUE
				FROM   pay.CalculationResult cr
				INNER JOIN pay.CalculationPersonel AS cp 
					ON cr.CalculationPersonelID=cp.CalculationPersonelID
				INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeID
				WHERE ParameterValueTypeID IN (7,16)
					  AND cp.CalendarMonthID=@CalendarMonthID
				GROUP BY PersonelID,ParameterID
		    ) AS cr
				ON cr.PersonelID = #RES2.PersonelId
		           AND CAST(cr.ParameterID AS VARCHAR(10)) = #RES2.ItemValue
		           AND ItemType = 2
		           AND ItemValueType = 4
		           AND ItemDataSourceType = 0
		    LEFT JOIN pay.Parameter AS p
				ON  p.ParameterID = cr.parameterid
		    LEFT JOIN #Karkard
		         ON  #karkard.PersonelId = cr.personelId
		    LEFT JOIN (
				SELECT personelId,
				       SUM(Karkard) AS Karkard
				FROM #ChangeBranch
				WHERE organizationItemId = @BranchID
				GROUP BY personelId
		    ) AS t
				ON  t.personelId = cr.personelId
		END
	ELSE
		
	IF @PayPrepairingId IS NOT NULL
		
	    BEGIN
			UPDATE #res2
			SET VALUE = CAST(CAST(cr.[Value] AS DECIMAL(18, 0)) AS VARCHAR(50))
			FROM #Res2
			LEFT JOIN (
				SELECT ppi.PersonnelID,
				       ppi.ParameterID,
					    SUM(ppi.[Value]) VALUE
				FROM   PAY.PayPreparing pp
						JOIN PAY.PayPreparingItem ppi
					ON ppi.PayPreparingID = pp.PayPreparingID 
				WHERE   pp.PayPreparingID = @PayPrepairingId
				GROUP BY ppi.PersonnelID,ppi.ParameterID
			) AS cr
				ON  cr.PersonnelID = #RES2.PersonelId
					AND CAST(cr.ParameterID AS VARCHAR(10)) = #RES2.ItemValue
					AND ItemType = 2
					AND ItemValueType = 4
					AND ItemDataSourceType = 0
		END
		else 
			BEGIN
		UPDATE #res2
			SET VALUE = CAST(CAST(cr.[Value] AS DECIMAL(18, 0)) AS VARCHAR(50))
			FROM #Res2
			LEFT JOIN (
				SELECT cp.PersonelID,
					   cr.ParameterID,
					  SUM(cr.[Value])  VALUE
				FROM   pay.CalculationResult cr
				INNER JOIN pay.CalculationPersonel AS cp 
					ON cp.CalculationPersonelID = cr.CalculationPersonelID
				INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeID
				WHERE ParameterValueTypeID IN (7,16)
					  AND cp.CalendarMonthID=@CalendarMonthID
				GROUP BY cp.PersonelID,cr.ParameterID
			) AS cr
				ON  cr.PersonelID = #RES2.PersonelId
					AND CAST(cr.ParameterID AS VARCHAR(10)) = #RES2.ItemValue
					AND ItemType = 2
					AND ItemValueType = 4
					AND ItemDataSourceType = 0
			END
		
	IF @HasCalcYear = 1
	    BEGIN
			UPDATE #res2
			SET VALUE = CAST(CAST(cr.[Value] AS INT) AS VARCHAR(50))
			FROM #Res2
			LEFT JOIN (
				SELECT cp.PersonelID,
				       cr.ParameterID,
				       SUM(cr.[Value]) AS VALUE
				FROM pay.CalculationResult cr
				INNER JOIN pay.CalculationPersonel AS cp 
					ON cp.CalculationPersonelID = cr.CalculationPersonelID
				INNER JOIN #calcTypes ct 
					ON cp.CalculationTypeID=ct.CalcTypeID
				INNER JOIN #SelPersonel
					ON #SelPersonel.PersonelID = cp.PersonelID
				       AND ParameterValueTypeID IN (7,16)
				WHERE cp.CalendarMonthID = @CalendarMonthID 
				GROUP BY cp.PersonelID, cr.ParameterID
			) AS cr
				ON cr.PersonelID = #RES2.PersonelId
			       AND CAST(cr.ParameterID AS VARCHAR(10)) = #RES2.ItemValue
			WHERE ItemType = 2
			      AND ItemValueType = 4
			      AND ItemDataSourceType = 1
		END

	DROP TABLE IF EXISTS ##CustomFieldValues
	
	DECLARE @Fileds          VARCHAR(MAX),
	        @CustomCuery     NVARCHAR(MAX)
	
	IF EXISTS (
	       SELECT 1
	       FROM   #CustomFiledDataInfo
	       WHERE  field IN (SELECT itemValue
	                        FROM   pay.PayrollFileItem AS pfi
	                        WHERE  pfi.PayrollFileID = @FileID)
	)
		BEGIN
		    SELECT @Fileds = STUFF(
		        (
		            SELECT DISTINCT ',' + QUOTENAME('' + #CustomFiledDataInfo.field + '')
		            FROM   #CustomFiledDataInfo
		                   FOR XML PATH(''),
		                   TYPE
		        ).value('.', 'NVARCHAR(MAX)'),
		        1,
		        1,
		        ''
		    )
		    
		    
		    SET @CustomCuery = 
		        '
				SELECT *
				INTO ##CustomFieldValues
				FROM (
					SELECT #CustomFiledDataInfo.Entity,
						#CustomFiledDataInfo.Field,
						ecfd.EntityID,
						CASE 
						     WHEN ecf.LookupDataID IS NULL THEN ecfd.[Value]
						     ELSE CASE 
						               WHEN #CustomFiledDataInfo.ItemValueType = 0 THEN ldi.Code
						               ELSE ldi.Title
						          END
						END AS VALUE
					FROM cfg.EntityCustomeFieldData AS ecfd
					INNER JOIN CFG.EntityCustomeField AS ecf
		                ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
					INNER JOIN #CustomFiledDataInfo
						ON #CustomFiledDataInfo.FieldName = ecf.FieldName
						   AND #CustomFiledDataInfo.Entity = ecf.EntityName
					LEFT JOIN CFG.LookupDataItem AS ldi
						ON  ldi.LookupDataItemID = ecfd.LookupDataItemID
				) x
				PIVOT(
					MAX(VALUE)
					FOR Field IN (' + @Fileds + ')
				) vial
				'
		    
		   
		    EXEC (@CustomCuery)
		END
	ELSE
		BEGIN
		    SELECT @Fileds = STUFF(
				(
				    SELECT DISTINCT 
				           ','' '' as ' 
				           + QUOTENAME('' + #CustomFiledDataInfo.field + '')
				    FROM #CustomFiledDataInfo
						FOR XML PATH(''),
						TYPE
				).value('.', 'NVARCHAR(MAX)'),
				1,
				1,
				''
		    )
		    
		    SET @CustomCuery = 'SELECT 1 AS EntityID,'' '' AS Entity, ' +
		        @Fileds + '
				INTO ##CustomFieldValues'
		    
		    
		    
		    EXEC (@CustomCuery)
		END
	
	-- ItemRealType = 0 => parameter type is String
	-- ItemRealType = 1 => parameter type is Integer
	UPDATE #RES
	SET [Value] = CASE 
	                  WHEN ItemType = 0 THEN CAST(ItemValue AS NVARCHAR(2048))
	                  WHEN ItemType = 1 OR ItemType = 3 THEN #InputItems.[VALUE]
	                  WHEN ItemType = 2 
						THEN 
							CASE 
							  	WHEN ItemValueType = 4 THEN CAST(CAST(ISNULL(cr.[Value], 0) AS BIGINT) AS VARCHAR(50))
							  	WHEN ItemValueType = 3 
							  		THEN
							  			CASE ItemValue
							  				WHEN 'LastAgreement' 
							  					THEN CASE 
							  						      WHEN #IsLastAgreement.PersonelID IS NULL THEN '0'
							  						      ELSE '1'
							  						 END
							  				WHEN 'FirstAgreement' 
							  					THEN CASE 
							  							WHEN #AGG.TaxEmploymentDate BETWEEN @StartDate AND @EndDate THEN '1'
							  							ELSE '2'
							  			             END
							  				WHEN 'WorkPlaceF' THEN #AGG.WorkPlace
											WHEN 'TaxWorkPlaceStatus' THEN workPlaceCustomField.TaxWorkPlaceStatus
											WHEN 'TaxAgreementTypeCode' THEN agreementTypeCustomField.TaxAgreementTypeCode
											WHEN 'TaxEmploymentTypeCode' THEN employmentTypeCustomField.TaxEmploymentTypeCode
											WHEN 'JobTitle' THEN #AGG.JobTitle
											WHEN 'JobCode' THEN #AGG.InsuranceCode
											WHEN 'JobClass' THEN #AGG.[Group]
											WHEN 'EmploymentDate' 
							  					THEN cfg.GetCLRSaturnDate(#AGG.EmploymentDate,CASE  ItemLength WHEN 6 THEN @DateFormate6 WHEN 8 THEN @DateFormate8
										     ELSE @DateFormate10 END,0,@dateType) 											           
											WHEN 'EndDate' THEN CASE WHEN ISNULL(#AGG.EndDate,'')<>'' THEN 
							  					     cfg.GetCLRSaturnDate(#AGG.EndDate,CASE  ItemLength WHEN 6 THEN @DateFormate6 WHEN 8 THEN @DateFormate8
										     ELSE @DateFormate10 END,0,@dateType) ELSE '' end			
											WHEN 'JobClassCode' THEN #AGG.[Group]
											WHEN 'EmploymentTypeCode' THEN #AGG.EmploymentTypeCode
											WHEN 'EmploymentType' THEN #AGG.EmploymentType
											WHEN 'CostCenter2' THEN #AGG.CostCenter
											ELSE NULL
	                                    END
								WHEN ItemValueType = 1 
									THEN
								    (
								        SELECT c.ConfigValue
								        FROM   cfg.Configuration 
								                c
								        WHERE  c.ConfigKey = ItemValue
								    )
								WHEN ItemValueType = 2 
									THEN
										CASE ItemValue
										     WHEN 'F_FullName' THEN #P.FirstName + ' ' + #P.LastName
										     WHEN 'CountryCode' THEN locationCustomField.CountryCode
										     WHEN 'PersonelCode' THEN #P.Code
										     WHEN 'FirstName' THEN #P.FirstName
										     WHEN 'FatherName' THEN #P.FatherName2
										     WHEN 'Sex' THEN #P.Sex
										     WHEN 'CertificateIssueDate' THEN RIGHT(#P.BirthCertificateDate, ItemLength)
										     WHEN 'Nationality' THEN #P.NationalTitle
										     WHEN 'LastName' THEN #P.LastName
										     WHEN 'BirthCertificateNumber' THEN #P.BirthCertificateNumber
										     WHEN 'NationalCode' THEN #P.NationalID
										     WHEN 'BirthDate' THEN cfg.GetCLRSaturnDate(#P.birthday,CASE  ItemLength WHEN 6 THEN @DateFormate6 WHEN 8 THEN @DateFormate8
										     ELSE @DateFormate10 END,0,@DateType) 
										     WHEN 'ExportationPlace' THEN #P.IssueLocation
										     WHEN 'Education' THEN CAST(#P.Education AS VARCHAR(1024))
										     WHEN 'AccountNumber' THEN #P.AccountNumber
										     WHEN 'ExemptionType' THEN CAST(#P.ExemptionCause AS VARCHAR(10))
										     WHEN 'InsuranceNumber' THEN #P.InsuranceNumber
										     WHEN 'PostCode' THEN #P.PostCode
										     WHEN 'Sanavat' THEN CAST(#P.Sanavat AS NVARCHAR(2048))
										     WHEN 'EducationDocCode' THEN #P.EducationDocCode
										     WHEN 'EducationTaxDocCode' THEN educationCustomField.TaxDocCode
										     WHEN 'NationalityCode' THEN #P.Nationality
										     WHEN 'InuranceTypeCode' THEN #p.InuranceTypeCode
										     WHEN 'InuranceTypeTitle' THEN #P.InuranceTypeTitle
										     WHEN 'TaxTypeCode' THEN #P.TaxExemptionCause 
										     WHEN 'VehicleStatus' THEN personelCustomField.VehicleStatus
										     WHEN 'HousingStatus' THEN personelCustomField.HousingStatus 										     
										     WHEN 'PersonelAddress' THEN #P.PersonelAddress										     
										     WHEN 'BirthLocation' THEN #P.BirthLocation
										     ELSE NULL
										END
								WHEN ItemValueType = 5 
									THEN
										CASE ItemValue
										     WHEN 'Address' THEN @OrgAddress
										     WHEN 'Radif' THEN @AgreementRow
										     WHEN 'Number' THEN @FileNumber
										     WHEN 'Employer' THEN @OrgEmployer
										     ELSE NULL
										END
								WHEN ItemValueType = 6 
									THEN
										CASE ItemValue
										     WHEN 'YearMonth' THEN RIGHT(@Year + '/' + @Month, ItemLength)
										     WHEN 'Year' THEN RIGHT(@Year, ItemLength)
										     WHEN 'Month' 
												THEN 
													CASE 
														WHEN ItemRealType = 0 THEN RIGHT(@Month, ItemLength)
														ELSE CAST(CAST(@Month AS INT) AS VARCHAR(10))
													END
										     ELSE NULL
										END
								WHEN ItemValueType = 7 
									THEN
								         CASE ItemValue
								              WHEN 'LoanValue' THEN CAST(#LoanInfo.AllLoan AS VARCHAR(50))
								              WHEN 'FacilitiesNumber' THEN #LoanInfo.LoanNumber
								              ELSE NULL
								         END
								ELSE NULL
							END
	                  ELSE NULL
	              END
	FROM #RES
	LEFT JOIN #AGG
		ON  #AGG.PersonelId = #RES.PersonelId
    LEFT JOIN #P
        ON  #P.PersonelId = #RES.PersonelId
    LEFT JOIN #InputItems
        ON  Id = #RES.PayrollFileItemID
    LEFT JOIN (
		SELECT PayrollFileItemID,
		       PersonelId,
		       LoanID,
		       SUM(VALUE) AS VALUE
		FROM #res2
		GROUP BY PayrollFileItemID, PersonelId, LoanID
	) AS cr
		ON cr.PayrollFileItemID = #res.PayrollFileItemID
		   AND cr.PersonelId = #res.PersonelId
	       AND ISNULL(cr.LoanID, 0) = ISNULL(#res.LoanID, 0)
	LEFT JOIN #LoanInfo
		ON #LoanInfo.LoanID = #RES.LoanID
    LEFT JOIN #IsLastAgreement
        ON #IsLastAgreement.personelId = #RES.PersonelId
    LEFT JOIN ##CustomFieldValues personelCustomField
        ON personelCustomField.EntityID = #RES.PersonelId
           AND personelCustomField.Entity = 'Personel'
    LEFT JOIN ##CustomFieldValues agreementTypeCustomField
        ON agreementTypeCustomField.EntityID = #AGG.agreementTypeID
           AND agreementTypeCustomField.Entity = 'AgreementType'
    LEFT JOIN ##CustomFieldValues employmentTypeCustomField
		ON employmentTypeCustomField.EntityID = #AGG.EmploymentTypeID
           AND employmentTypeCustomField.Entity = 'EmploymentType'
    LEFT JOIN ##CustomFieldValues workPlaceCustomField
		ON workPlaceCustomField.EntityID = #AGG.WorkPlaceID
           AND workPlaceCustomField.Entity = 'WorkPlace'
    LEFT JOIN ##CustomFieldValues locationCustomField
		ON locationCustomField.EntityID = #P.CountryID
		   AND locationCustomField.Entity = 'Location'
    LEFT JOIN ##CustomFieldValues educationCustomField
		ON educationCustomField.EntityID = #P.StudyDegreeID
           AND educationCustomField.Entity = 'studyDegree'
	
	DROP TABLE IF EXISTS ##CustomFieldValues	
	
	UPDATE #Res
	SET VALUE = CASE VALUE
	                 WHEN '1' THEN N'وزارتخانه'
	                 WHEN '2' THEN N'موسسه دولتي'
	                 WHEN '3' THEN N'شرکت دولتي'
	                 WHEN '4' THEN N'ساير دستگاههاي دولتي'
	                 WHEN '5' THEN N'نهادهاي عمومي غيردولتي'
	                 WHEN '6' THEN N'بخش خصوصي'
	                 WHEN '7' THEN N'ساير پرداخت کنندگان حقوق'
	            END
	WHERE ItemValueType = 1
	      AND ItemValue = 'EmployerCompanyTypeTitle'
	
	UPDATE #RES
	SET VALUE = REPLACE(
		RIGHT(SPACE(ItemLength) + VALUE, ItemLength),
		' ',
		PaddingChar
	)
	WHERE ItemLength IS NOT NULL
	      AND PaddingChar IS NOT NULL
	      AND ItemLength <> 0
	      AND DATALENGTH(PaddingChar) <> 0
	
	IF @IsTamin = 1
		BEGIN
			UPDATE #res
		    SET VALUE = 0
		    FROM #res
		    INNER JOIN #END
				ON #end.PersonelID = #res.PersonelID
		           AND #END.ChangeDate <= @StartDate
		    WHERE ItemType = 2
		          AND ItemValueType = 4
		END
	
	DECLARE @Items            NVARCHAR(MAX),
	        @ItemsSelect      NVARCHAR(MAX),
	        @HeaderSelect     NVARCHAR(MAX),
	        @FooterSelect     NVARCHAR(MAX)
	
	SELECT @Items = STUFF(
		(
		    SELECT DISTINCT ',' + QUOTENAME(EngName)
		    FROM #REs pa
		         FOR XML PATH(''),
		         TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1,
		1,
		''
	)
	
	SELECT DISTINCT EngName,
	       ItemOrder,
	       DisplayTarget,
	       AGGFunc,
	       ItemType,
	       ItemValue,
	       ItemValueType,
	       Itemlength,
	       PaddingChar
	INTO #Tpt
	FROM #res
	ORDER BY ItemOrder
	
	SELECT @ItemsSelect = STUFF(
		(
		    SELECT 
				CASE 
					WHEN ItemType <> 2
						 OR ItemValueType <> 4
						 OR (Itemlength IS NOT NULL AND PaddingChar IS NOT NULL)
						THEN ',' + QUOTENAME(EngName) 
					ELSE ',Cast(' + QUOTENAME(EngName) + ' as BigInt) as ' + QUOTENAME(EngName)
				END
		    FROM #Tpt
		    WHERE DisplayTarget = 2
				  AND ItemValue <> 'RadifNumber'
		         FOR XML PATH(''),
				 TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1,
		1,
		''
	)
	
	SELECT @HeaderSelect = STUFF(
		(
		    SELECT 
				',' +
				CASE 
		            WHEN ItemLength <> 0
						 AND ItemLength IS NOT NULL
						 AND PaddingChar IS NOT NULL
						 AND DATALENGTH(PaddingChar) <> 0
						 AND AGGFunc <> 'WithoutOperation'
						THEN 'REPLACE(RIGHT(SPACE(' + CAST(ItemLength AS VARCHAR(10)) + ') + Cast('
					ELSE ''
				END
		    
				+ '(' +
				CASE AGGFunc
				     WHEN 'WithoutOperation' THEN 'Max'
				     WHEN 'Count' THEN 'Sum'
				     ELSE AGGFunc
				END
				+
				CASE AGGFunc
				     WHEN 'WithoutOperation' THEN '(' + QUOTENAME(EngName) + ')'
				     WHEN 'Count' THEN '(Case WHEN CalendarMonthID=' + (CAST(@CalendarMonthID AS VARCHAR(5))) + ' THEN 1  Else 0 END) '
				     ELSE '(Cast(' + QUOTENAME(EngName) + ' as BigInt)) '
				END +
				')' +
		        CASE 
		            WHEN ItemLength <> 0
						 AND ItemLength IS NOT NULL
						 AND PaddingChar IS NOT NULL
						 AND DATALENGTH(PaddingChar) <> 0
						 AND AGGFunc <> 'WithoutOperation'
						THEN ' as nvarchar(MAX)) , ' + CAST(ItemLength AS VARCHAR(10)) + '),'' '',''' + CAST(PaddingChar AS VARCHAR(10)) + ''')'
					ELSE ''
		        END
		        +
		        ' as ' + QUOTENAME(EngName)
		    FROM #Tpt
		    WHERE DisplayTarget = 1
				  AND ItemValue <> 'RadifNumber'
		        
				FOR XML PATH(''),
				TYPE
		).value('.', 'NVARCHAR(MAX)'),
		1,
		1,
		''
	)
	
	SELECT @FooterSelect = STUFF(
		(
			SELECT 
				',' +
				  
				CASE 
					WHEN ItemLength <> 0
						 AND ItemLength IS NOT NULL
						 AND PaddingChar IS NOT NULL
						 AND DATALENGTH(PaddingChar) <> 0
						 AND AGGFunc <> 'WithoutOperation'
						THEN 'REPLACE(RIGHT(SPACE(' + CAST(ItemLength AS VARCHAR(10)) + ') + Cast('
					ELSE ''
				END
				+ '(' +
				CASE AGGFunc
				     WHEN 'WithoutOperation' THEN 'Max'
				     WHEN 'Count' THEN 'Sum'
				     ELSE AGGFunc
				END
				+
	            CASE AGGFunc
	                WHEN 'WithoutOperation' THEN '(' + QUOTENAME(EngName) + ')'
	                WHEN 'Count' THEN '(Case WHEN CalendarMonthID=' + (CAST(@CalendarMonthID AS VARCHAR(5))) + ' THEN 1  Else 0 END) '
	                ELSE '(Cast(' + QUOTENAME(EngName) + ' as BigInt)) '
	            END 
				+ ')' +
	            CASE 
					WHEN ItemLength <> 0
						 AND ItemLength IS NOT NULL
						 AND PaddingChar IS NOT NULL
						 AND DATALENGTH(PaddingChar) <> 0
						 AND AGGFunc <> 'WithoutOperation'
						THEN ' as nvarchar(MAX)) , ' + CAST(ItemLength AS VARCHAR(10)) + '),'' '',''' + CAST(PaddingChar AS VARCHAR(10)) + ''')'
					ELSE ''
	            END
	            + ' as ' + QUOTENAME(EngName)
	        FROM #Tpt
	        WHERE DisplayTarget = 3
	              AND ItemValue <> 'RadifNumber'
				FOR XML PATH(''),
	            TYPE
	    ).value('.', 'NVARCHAR(MAX)'),
	    1,
	    1,
	    ''
	)
	

		
	SET @Query = 
	    '
		SELECT #P.PersonelId,
			   FirstName,
			   LastName,
			   #p.CalendarMonthID,
			   Code,
			   EmploymentType,
			   CostCenter,
			   WorkPlace,
			   Row_number() over(order by #P.PersonelId) as RadifNumber,
			   '+ @Items +'  
        INTO ' + @tableName + '
        FROM (
				SELECT *
				FROM(
					SELECT EngName,PersonelID,LoanID,[Value]
					FROM #res
				) x
				PIVOT(
					MAX(VALUE)
					FOR EngName IN (' + @Items + ')
				) as T ) P 
				INNER JOIN #P
					on #P.PersonelId=p.PersonelID
                       AND isNull(#P.LoanId,0)=isNull(p.LoanID,0)
				INNER JOIN #Agg
					on #Agg.PersonelId=p.PersonelID
        ' 
	
	
	EXEC (@Query)

	print @radifColumn + N'333333'
	print @HeaderSelect
	
	SET @Query = 
		'
		SELECT  ' + @HeaderSelect +
			CASE 
			     WHEN @radifColumn IS NULL THEN ''
			     ELSE CASE 
			               WHEN @radifLen <> 0 AND @radifLen IS NOT NULL 
								AND @RadifPaddingChar IS NOT NULL
								AND DATALENGTH(@RadifPaddingChar) <> 0 THEN
								', REPLACE(RIGHT(SPACE(' + @radifLen +') + Cast( Max(RadifNumber) as varchar(100) ), ' 
									+ @radifLen + '),'' '',''' + @RadifPaddingChar + ''')    '
			               ELSE ',Max(RadifNumber) '
			          END + ' as ' + @radifColumn
			END 
		+ 
		' FROM ' + @tableName

	IF @Query IS NOT NULL
	    EXEC (@Query)
	ELSE
	    SELECT NULL AS NullColumn 

	SET @Query = 
		'SELECT ' 
		+ 
		CASE 
	        WHEN @radifColumn IS NULL THEN ''
	        ELSE CASE 
	                WHEN @radifLen <> 0 AND @radifLen IS NOT NULL 
				 		 AND @RadifPaddingChar IS NOT NULL 
				 		 AND DATALENGTH(@RadifPaddingChar) <> 0 
				 			THEN ' REPLACE(RIGHT(SPACE(' + @radifLen + ') +Cast( (RadifNumber) as varchar(100) ), '
				 				 + @radifLen + '),'' '',''' + @RadifPaddingChar + ''')    '
				 	ELSE ' (RadifNumber) '
	             END + 'as ' + @radifColumn + ','
	    END +
	    ' PersonelID,
		  FirstName as ''SC_FirstName'',
		  LastName as ''SC_LastName'',
          Code as ''SC_Code'',
		  EmploymentType as ''SC_EmploymentType'',
		  CostCenter as ''SC_CostCenter'',
		  WorkPlace as ''SC_WorkPlace'',
		  ' + @ItemsSelect + 
		' FROM ' + @tableName
	
	IF @OrderByStr IS NOT NULL
	   AND @OrderByStr <> ''
		SET @Query = @Query + ' Order BY  ' + @OrderByStr
	
	--PRINT @Query
	EXEC (@Query)

	SET @Query = 
		'
		SELECT' + @FooterSelect +
				CASE 
					WHEN @radifColumn IS NULL THEN ''
					ELSE CASE 
							WHEN @radifLen <> 0 
								 AND @radifLen IS NOT NULL 
								 AND @RadifPaddingChar IS NOT NULL 
								 AND DATALENGTH(@RadifPaddingChar) <> 0 
								THEN ', REPLACE(RIGHT(SPACE(' + @radifLen +') +Cast( Max(RadifNumber) as varchar(100) ), ' 
									 + @radifLen + '),'' '',''' + @RadifPaddingChar + ''')    '
			                ELSE ',Max(RadifNumber) '
						 END + ' as ' + @radifColumn
				END + ' 
		FROM ' + @tableName
	
	--PRINT @Query
	IF @Query IS NOT NULL
	    EXEC (@Query)
	ELSE
	    SELECT NULL AS NullColumn 
