CREATE PROCEDURE [STM].SettlementReport
(
    @settlementID INT,
    @IsHeader BIT = 1
)
AS
DECLARE @PersonelID INT,
        @calendarMonthid INT,
        @InDate DATETIME,
        @EndDate DATETIME,
        @CultureInfo VARCHAR(10),
        @CultureNo VARCHAR(10),
        @SettlementCalculationTypeID INT,
        @SettlementParam INT;

		SELECT @SettlementParam = p.ParameterID FROM pay.Parameter AS p
		WHERE p.SystemName = 'SettlementParam'

SELECT @SettlementCalculationTypeID = ct.CalculationTypeID
FROM pay.CalculationType AS ct
WHERE ct.EngName = 'Settlement';

SELECT cp.CalculationTypeID AS VALUE
INTO #CalcTypes
FROM pay.SettlementCalculation AS sc
JOIN pay.CalculationPersonel AS cp ON sc.BaseCalculationPersonelID = cp.CalculationPersonelID
WHERE sc.CalculationPersonelID = @settlementID;

SET @CultureInfo = cfg.GetuserCulture();

SELECT @CultureNo = CultureNo
FROM cfg.CultureInfo
WHERE Culture = @CultureInfo;

SELECT @PersonelID = s.PersonelID,
       @calendarMonthid = s.CalendarMonthID,
       @InDate = cm.EndDate
FROM pay.CalculationPersonel AS s
    INNER JOIN HRM.CalendarMonth AS cm
        ON cm.CalendarMonthID = s.CalendarMonthID
WHERE s.CalculationPersonelID = @settlementID;


DECLARE @UserID INT,
        @DateType VARCHAR(10),
        @DateFormat VARCHAR(10);

SET @UserID = cfg.GetuserID();

SELECT @DateType = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE @CultureInfo
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END;

SELECT @DateFormat = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';




DECLARE @Year INT,
        @MonthNumber INT,
        @MonthTitle NVARCHAR(128);


SELECT @MonthNumber = cm.MonthNumber,
       @MonthTitle = cm.[MonthName],
       @Year = c.[Year]
FROM hrm.CalendarMonth AS cm
    INNER JOIN HRM.Calendar AS c
        ON c.CalendarID = cm.CalendarID
WHERE cm.CalendarMonthID = @calendarMonthid;


SELECT *
INTO #lastAgg
FROM
(
    SELECT a.*,
           et.PaymentSystemID,
           j.[group] AS JobGroupId,
           ROW_NUMBER() OVER (PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
    FROM hrm.Agreement a
        INNER JOIN hrm.EmploymentType AS et
            ON et.EmploymentTypeID = a.EmploymentTypeID
        INNER JOIN HRM.AgreementType
            ON AgreementType.AgreementTypeID = a.AgreementTypeID
        INNER JOIN HRM.PersonelStatus
            ON PersonelStatus.PersonelStatusID = AgreementType.PrePersonelStatusID
        LEFT JOIN hrm.[Job] AS j
            ON j.JobID = a.JobID
    --SATURNNEW-6653
    WHERE a.ExecuteDate <= DATEADD(dd, 1, @InDate)
          AND a.PersonelID = @PersonelID
          AND StatusType = 3
) T
WHERE T.Rno = 1;


 DECLARE @Hour INT;

    SELECT @Hour = c.WorkHours
    FROM HRM.CalendarMonth cm
        INNER JOIN HRM.Calendar c
            ON c.CalendarID = cm.CalendarID
    WHERE cm.CalendarMonthID = @calendarMonthid;
    
  


IF @IsHeader = 1
BEGIN
  

  



    DECLARE @Query NVARCHAR(MAX),
            @TableName VARCHAR(100),
            @TableName0 VARCHAR(100),
            @TableName1 VARCHAR(100)



   

    SET @TableName1 = cfg.getTempTableName(1);


    DECLARE @CustomeFields VARCHAR(MAX);

    SELECT @CustomeFields = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(Fieldname)
        FROM cfg.EntityCustomeField
        WHERE EntityName = 'Settlement'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                 );

    IF (@CustomeFields IS NULL)
        SET @CustomeFields = '[NoCustomeField]';


    SET @Query
        = N'
select a.CalculationPersonelID,a.PersonelID,' + @CustomeFields + N' into ' + @TableName1
          + N'
from pay.CalculationPersonel a
left join 
(
SELECT ecf.EntityID,ecfd.Fieldname,
case when b.LookupDataItemID is not null then b.title
 when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + N'''  , 0, ''' + @DateType
          + N''') else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
left join cfg.LookupDataItem b on ecf.LookupDataItemID = b.LookupDataItemID
WHERE ecfd.EntityName = ''Settlement''
)x
pivot 
(
	max(Value)
	for Fieldname IN (' + @CustomeFields
          + N')
) CustomEntities on CustomEntities.EntityID = a.CalculationPersonelID
WHERE  a.CalculationPersonelID = ' + CAST(@settlementID AS VARCHAR(10));

 EXEC (@Query);


 SELECT cr.[Value]                     SettlementParamValue,
        cp.PersonelID
 INTO   #SettlementParamValue
 FROM   pay.CalculationPersonel     AS cp
        JOIN pay.CalculationResult  AS cr
             ON  cr.CalculationPersonelID = cp.CalculationPersonelID
 WHERE  cp.CalculationPersonelID = @settlementID
        AND cr.ParameterID = @SettlementParam

    SET @Query
        = N'SELECT CASE ' + @CultureNo
          + N'
	                    WHEN 1 THEN pa.Title + '' '' + pa.LastName
	                    ELSE pa.Title2 + '' '' + pa.LastName2
	               END                     PersonelName,
	               p.Code                  PersonelCode,
	               p.PersonelID,
	               -- p.FatherName,
	               ' + CAST(@MonthNumber AS VARCHAR(10)) + N'          AS MonthNumber,
	            ''' + @MonthTitle
          + N''' as MonthTitle,
	               pa.IdentificationCode,
	               p.FatherName,
	               p.BirthCertificateNumber,
	               lo.Title                IssueLocation,
	               CFG.GetCLRSaturnDate(t.EmploymentDate, ''' + @DateFormat + N''', 0, ' + @DateType
          + N') AS EmploymentDate,
	               et.Title             AS EmploymentTitle,
	               CASE ' + @CultureNo
          + N' WHEN 1 then cc.Title  else   cc.Title2 end         AS CostCenterTitle,
	               wp.Title             AS WorkPlaceTitle,
	               j.Title              AS jobTitle,
	               p2.Title             AS PositionTitle,
	               pb.Title             AS PayrollBase,
	               pg.Title             AS PayrollGroup,
	               og.Title             AS OccupationGrade,
	               spv.SettlementParamValue,
	               CAST(t.ExperienceLen / 360 AS VARCHAR(10)) + ''/'' + CAST(
	                   (t.ExperienceLen / 360 - t.ExperienceLen / 360) / 30 AS VARCHAR(10)
	               ) +
	               ''/'' + CAST(t.ExperienceLen%30 AS VARCHAR(10)) AS ExperienceLen,
	               CFG.GetCLRSaturnDate(t.ExecuteDate, ''' + @DateFormat + N''', 0, ' + @DateType + N') AS EndDate,'
          + @CustomeFields + N'
	        FROM   hrm.Personel p
	               JOIN CFG.Party pa
	                    ON  p.PartyID = pa.PartyID
	               JOIN #lastAgg        AS t
	                    ON  p.PersonelID = t.personelID
	               LEFT JOIN HRM.EmploymentType AS et
	                    ON  et.EmploymentTypeID = t.EmploymentTypeID
	               LEFT JOIN CFG.CostCenter AS cc
	                    ON  cc.CostCenterID = t.CostCenterID
	               LEFT JOIN HRM.WorkPlace AS wp
	                    ON  wp.WorkPlaceID = t.WorkPlaceID
	               LEFT JOIN HRM.[Job]  AS j
	                    ON  j.JobID = t.JobID
	               LEFT JOIN HRM.Position AS p2
	                    ON  p2.PositionID = t.PositionID
	               LEFT JOIN HRM.PayrollBase AS pb
	                    ON  pb.PayrollBaseID = t.PayrollBaseID
	               LEFT JOIN HRM.PayrollGroup AS pg
	                    ON  pg.PayrollGroupID = t.PayrollGroupID
	               LEFT JOIN HRM.OccupationGrade AS og
	                    ON  og.OccupationGradeID = t.OccupationGradeID
	               LEFT JOIN CFG.Location lo
	                    ON  lo.LocationID = p.IssueLocationID
	               LEFT JOIN #SettlementParamValue  spv on p.PersonelID = spv.PersonelID   
	               Left join  ' + @TableName1
          + N' cf
					on cf.PersonelID = p.PersonelId 
	        WHERE  p.PersonelID = ' + CAST(@PersonelID AS VARCHAR(10)) + N'
					
	        ';

    EXEC (@Query);
END;
ELSE
BEGIN
    SELECT par.Title,
           cr.[Value],
           cp.PersonelID,
           par.CategoryID,
           cp.CalendarMonthID,
            CASE 
      WHEN par.DataEntryType = 2 THEN CFG.ConvertToHourMinute(cr.[Value] * 60.00)
      WHEN par.DataEntryType = 3 THEN CFG.ConvertToDayHourMinute(cr.[Value]*@Hour, @Hour)
      ELSE CAST(CAST(cr.[Value] AS DECIMAL(36,10)) AS VARCHAR(512))
 END AS StringValue,
           c.[Year]
    INTO #values
    FROM pay.CalculationPersonel AS cp
        JOIN pay.CalculationResult cr
            ON cr.CalculationPersonelID = cp.CalculationPersonelID
        JOIN pay.Parameter par
            ON par.ParameterID = cr.ParameterID
        JOIN pay.Category cat
            ON cat.CategoryID = par.CategoryID
        JOIN HRM.CalendarMonth cam
            ON cam.CalendarMonthID = cp.CalendarMonthID
        JOIN hrm.Calendar c
            ON c.CalendarID = cam.CalendarID
    WHERE cp.PersonelID = @PersonelID
          AND cam.CalendarMonthID = @calendarMonthid
          AND cat.CategoryID IN ( 1, 2, 3 )
          AND cp.CalculationTypeID IN
              (
                  SELECT VALUE FROM #CalcTypes
              );


			  
			

    INSERT INTO #values
    SELECT p.Title,
           si.[Value],
           @PersonelID,
           3,
           @calendarMonthid,
           NULL,
           @Year
    FROM pay.CalculationResult  AS si
    JOIN pay.Parameter AS p ON p.ParameterID = si.ParameterID
        INNER JOIN PAY.Loan AS l
            ON l.LoanID = si.LoanID
    WHERE si.CalculationPersonelID = @settlementID
    AND si.ParameterValueTypeID <>14
          AND si.LoanID IS NOT NULL;

    INSERT INTO #values
    SELECT ct.Title,
           sc.Paid,
           @PersonelID,
           3,
           @calendarMonthid,
           NULL,
           @Year
    FROM pay.SettlementCalculation AS sc
    JOIN pay.CalculationPersonel AS cp ON sc.BaseCalculationPersonelID = cp.CalculationPersonelID
        JOIN pay.CalculationType AS ct
            ON ct.CalculationTypeID = cp.CalculationTypeID
    WHERE sc.CalculationPersonelID = @settlementID;

    INSERT INTO #values
    SELECT sp.Title,
           si.[Value],
           @PersonelID,
           sp.CategoryID,
           @calendarMonthid,
           NULL,
           @Year
    FROM pay.CalculationResult  AS si
        INNER JOIN PAY.Parameter  AS sp
            ON sp.ParameterID = si.ParameterID
    WHERE si.CalculationPersonelID = @settlementID
          AND si.LoanID IS NULL
          AND ISNULL(sp.SystemName,'')<>'SettlementParam';





    SELECT CalendarMonthID,
           CategoryID,
           Title ParameterTitle,
           VALUE ParameterValue,
           --  MonthNumber,
           v.StringValue,
           YEAR
    FROM #values AS v
    WHERE [v].[Value] <> 0;
END;
