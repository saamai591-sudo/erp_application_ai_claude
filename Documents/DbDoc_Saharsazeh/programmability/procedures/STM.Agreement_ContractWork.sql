------------------------------------------------------------------------
CREATE   PROC [STM].[Agreement_ContractWork] 
 @ID NVARCHAR(MAX)

--WITH ENCRYPTION 
AS
CREATE TABLE #Ids
(
	id INT
)

INSERT INTO #Ids
SELECT [value]
FROM   CFG.R_FnCommaStr2Table(@ID)
								  

DECLARE @Employment        NVARCHAR(250),
		@EditAgreement     NVARCHAR(250),
		@Single            NVARCHAR(250),
		@Married           NVARCHAR(250)          
							  
						
		
------------------------------     
SELECT @Employment = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'Types'
	   AND L.Item = 'Employment '
	   AND LV.Culture = CFG.GetuserCulture() 
						---------------------------
SELECT @EditAgreement = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'Types'
	   AND L.Item = 'EditAgreement '
	   AND LV.Culture = CFG.GetuserCulture()       
------
SELECT @Single = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'MarriageStatus'
	   AND L.Item = 'Single  '
	   AND LV.Culture = CFG.GetuserCulture()       
------
SELECT @Married = LV.Value
FROM   CFG.LocalizeEnum L
	   JOIN CFG.LocalizeEnumValue LV
			ON  L.LocalizeEnumID = LV.LocalizeEnumID
WHERE  L.Enum = 'MarriageStatus'
	   AND L.Item = 'Married '
	   AND LV.Culture = CFG.GetuserCulture()       
------
	   DECLARE @UserID INT,
			@DateType                TINYINT,
			@DateFormat              VARCHAR(10)
		   

	SET @UserID = cfg.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	
	IF @DateType IS NULL
		SET @DateType = CASE cfg.GetuserCulture()
							 WHEN 'fa' THEN 0
							 WHEN 'en' THEN 1
							 WHEN 'ar' THEN 2
						END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
		SET @DATEFORMAT = 'YY/MM/DD'
	

	

SELECT a.PartyID,
	   c.AgreementID,
	   c.PersonelID,
	   c.Specification                       Specification,
	   b.Title + ' ' + b.LastName            PersonelName,
	   CFG.GetCLRSaturnDate(a.Birthday,@DateFormat, 0,@DateType)      Birthday,
	   a.BirthCertificateNumber,
	   a.FatherName,
	   b.IdentificationCode,
	   wo.Title                              WorkPlace,
	   CFG.GetCLRSaturnDate(c.IssueDate,@DateFormat, 0,@DateType)     IssueDate,
	   CFG.GetCLRSaturnDate(c.EmploymentDate,@DateFormat, 0,@DateType) EmploymentDate,
		CFG.GetCLRSaturnDate(c.ExecuteDate,@DateFormat, 0,@DateType) ExecuteDate,
	   CFG.GetCLRSaturnDate(c.ExecuteDate,@DateFormat, 0,@DateType) EXPIREDATE,
	   DATEDIFF(DAY, c.ExecuteDate, c.ExpireDate) AS DiffDate,
	   JOB.Title                             JobTitle,
	   ad.Address,
	   fl.Title                              FlowChart,
	   po.Title                              Position,
	   JOB.JobSpecification,
	   a.Code                                PersonelCode,
	   cost.Title                            CostCenter,
	   b.Title                               FirstName,
	   b.LastName,
	   c.Number,
	   (
		   SELECT TOP 1 sd.Title
		   FROM   HRM.Education D
				  LEFT JOIN HRM.StudyDegree sd
					   ON  sd.StudyDegreeID = D.StudyDegreeID
		   WHERE  D.PersonelID = c.PersonelID
				  AND d.StartDate <= c.ExecuteDate
		   ORDER BY
				  D.StartDate DESC
	   )                                     Degree,
	   (
		   SELECT SUM(Amount)
		   FROM   HRM.AgreementParameter ap
		   WHERE  TYPE = 1
				  AND ap.AgreementID = c.AgreementID
	   )                                     Amount,
	   CASE (
				SELECT TOP 1 pms.MarriageStatus
				FROM   hrm.PersonelMarriageStatus AS pms
				WHERE  pms.PersonelID = a.PersonelID
					   AND pms.ApplyDate <= c.ExecuteDate
				ORDER BY
					   pms.ApplyDate DESC
			)
			WHEN 0 THEN 'ãÌÑÏ'
			WHEN 1 THEN 'ãÊÇåá'
			WHEN 2 THEN 'ãÚíá'
	   END                                   MarriageStatus 
	   ---------       
	   ,
	   emt.Title                             EmploymentType,
	   (
		   SELECT TOP 1
				  AccountNumber
		   FROM   HRM.PersonelAccount Br2
				  JOIN CFG.BankBranch Br
					   ON  Br.BankBranchID = Br2.BankBranchID
				  JOIN CFG.Bank Bank
					   ON  Bank.BankID = Br.BankID
		   WHERE  Br2.PersonelID = a.PersonelID
	   )                                     AccountNumber,
	   ---------------------------
	   (
		   SELECT TOP 1
				  Bank.Title
		   FROM   HRM.PersonelAccount Br2
				  JOIN CFG.BankBranch Br
					   ON  Br.BankBranchID = Br2.BankBranchID
				  JOIN CFG.Bank Bank
					   ON  Bank.BankID = Br.BankID
		   WHERE  Br2.PersonelID = a.PersonelID
	   )                                     Bankitle,
	   ----------------------------------                
	   dd.Value                              GradeTitle,
	   pb.Value                              Basetitle,
	   pg.Value                              GroupTitle,
	   at.Title                              AgreementType,
	   ----------------------------------------
	   (
		   SELECT TOP 1
				  sf.Title
		   FROM   HRM.Education ed
				  JOIN HRM.StudyField sf
					   ON  sf.StudyFieldID = ed.StudyFieldID
		   WHERE  Skill = 0
				  AND ed.PersonelID = c.PersonelID
				  AND ed.StartDate <= c.ExecuteDate
		   ORDER BY
				  ed.StudyDegreeID DESC
	   )                                     Field ------------آخرين رشته تحصيلي-----
	   ,
	   -------------------------------------------       
	   c.Serial,
	   JOB.Code                              JobCode,
	   po.Code                               PositionCode,
	   ------------------------------------------
	   (
		   SELECT TOP 1
				  pd.FromDate
		   FROM   HRM.PersonelDedication pd
		   WHERE  pd.PersonelID = c.PersonelID
		   ORDER BY
				  pd.ApplyDate DESC
	   )                                     FromDatePersonelDedication,
	   ---------------------------        
	   (
		   SELECT TOP 1
				  pd.ToDate
		   FROM   HRM.PersonelDedication pd
		   WHERE  pd.PersonelID = c.PersonelID
		   ORDER BY
				  pd.ApplyDate DESC
	   )                                     ToDatePersonelDedication,
	   DATEDIFF(
		   MONTH,
		   (
			   SELECT TOP 1
					  pd.FromDate
			   FROM   HRM.PersonelDedication pd
			   WHERE  pd.PersonelID = c.PersonelID
			   AND pd.DedicationType=0
			   ORDER BY
					  pd.ApplyDate DESC
		   ),
		   (
			   SELECT TOP 1
					  pd.ToDate
			   FROM   HRM.PersonelDedication pd
			   WHERE  pd.PersonelID = c.PersonelID
			   AND pd.DedicationType=0
			   ORDER BY
					  pd.ApplyDate DESC
		   )
	   )                                  AS DateSarbazi,
	   --------------------------------------------------
	   CASE pdd.DedicationType
			WHEN 0 THEN N'سربازي'
			WHEN 1 THEN N'جبهه'
			WHEN 2 THEN N'بسيج فعال'
			WHEN 3 THEN N'بسيج عادي'
			WHEN 4 THEN N'جانبازي'
	   END                                   PersonelDedication,
	   ----------------------------------------------------
	   (
		   SELECT COUNT(*)
		   FROM   HRM.Relative re
		   WHERE  re.PersonelID = c.PersonelID
				  AND re.Relation = 0
				  AND re.IsSponsored = 1
	   )                                     Children,
	   c.EmploymentTypeID,
	   --------------------------------              
	   (
		   SELECT TOP 1
				  bvd2.Value
		   FROM   HRM.BaseValueData bvd2
		   WHERE  bvd2.PersonelID = c.PersonelID
				  AND bvd2.BaseValueID = 10
				  AND c.IssueDate >= bvd2.ApplyDate
		   ORDER BY
				  bvd2.ApplyDate DESC
	   )                                     BaseValueNomreh,	------نمره ارزشيابي------
	   (
		   SELECT TOP 1
				  bvd2.Value
		   FROM   HRM.BaseValueData bvd2
		   WHERE  bvd2.PersonelID = c.PersonelID
				  AND bvd2.BaseValueID = 22
				  AND c.IssueDate >= bvd2.ApplyDate
		   ORDER BY
				  bvd2.ApplyDate DESC
	   )                                     BaseValue,	------ضريب سنواتي------
					-----------------                                                                     
	   (
		   SELECT TOP 1
				  Phone.Phone
		   FROM   CFG.Phone Phone
		   join CFG.AddressType t on Phone.AddressTypeID = t.AddressTypeID
		   WHERE  Phone.PartyID = b.PartyID
				  AND t.Nature = 1
	   )                                     Phone,
	   -------------------------------------------------------
	   (
		   SELECT TOP 1
				  Mobile.Phone
		   FROM   CFG.Phone Mobile
		   join CFG.AddressType t on Mobile.AddressTypeID = t.AddressTypeID
		   WHERE  Mobile.PartyID = b.PartyID
				  AND t.Nature = 2
	   )                                     Mobile,
	   JobGroup.Title                        Raste,
	   lo.Title                              Location,
	   (c.ExperienceLen / 360)               ExperienceLenYear, 
	   ((c.ExperienceLen -(360 * (c.ExperienceLen / 360))) / 30) 
	   ExperienceLenMonth,
	   c.ExperienceLen                       ExperienceLenDay,
	   es.Title                              EmploymentStatus,
	   CASE 
			WHEN c.IsCorrection = 0 THEN ' '
			  ELSE N'اصلاحيه'
	   END                                   IsCorrection,
	   a.InsuranceNumber,
	   b.NationalID,
	   lo2.Title                             BirthLocation,
	   pdd.DedicationType,
	   pdd.Amount                            PercentDedication -----درصد جانبازي----- 
	   ,
	   CASE 
			WHEN at.Code = 00 THEN 'True'--استخدام جديد----
			ELSE 'False' ----تمديد قرارداد-----
	   END                                   AgreementTypeCode,
	   (
		   SELECT TOP 1 ZipCode
		   FROM   cfg.Address
		   WHERE  PartyID = b.PartyID
	   ) ZipCode
	  
INTO                                         #TTT
	   -------------------------------------------------------
FROM   HRM.Agreement c
	   JOIN HRM.Personel a
			ON  a.PersonelID = c.PersonelID
	   LEFT JOIN CFG.Location LO
			ON  a.IssueLocationID = LO.LocationID
	   LEFT JOIN CFG.Location LO2
			ON  a.BirthLocationID = LO2.LocationID
	   LEFT JOIN hrm.EmploymentStatus es
			ON  es.EmploymentStatusID = c.EmploymentStatusID
	   JOIN CFG.Party b
			ON  b.PartyID = a.PartyID
	   LEFT JOIN HRM.OccupationGrade dd
			ON  dd.OccupationGradeID = c.OccupationGradeID
	   LEFT JOIN HRM.PayrollGroup pg
			ON  pg.PayrollGroupID = c.PayrollGroupID
	   LEFT JOIN hrm.PayrollBase pb
			ON  pb.PayrollBaseID = c.PayrollBaseID
	   JOIN CFG.CostCenter cost
			ON  cost.CostCenterID = c.CostCenterID
	   LEFT JOIN HRM.WorkPlace wo
			ON  wo.WorkPlaceID = c.WorkPlaceID
	   JOIN HRM.Job JOB
			ON  JOB.JobID = c.JobID
	   JOIN HRM.JobGroup JobGroup
			ON  JOB.[group] = JobGroup.JobGroupID
	   LEFT JOIN CFG.Address ad
			ON  ad.PartyID = b.PartyID
			AND ad.IsMain = 1
	   LEFT JOIN HRM.Position po
			ON  po.PositionID = c.PositionID
	   LEFT JOIN HRM.FlowChart fl
			ON  fl.FlowChartID = po.FlowChartID
	   JOIN HRM.EmploymentType emt
			ON  emt.EmploymentTypeID = c.EmploymentTypeID
	   JOIN HRM.AgreementType at
			ON  at.AgreementTypeID = c.AgreementTypeID
	   LEFT JOIN HRM.PersonelDedication pdd
			ON  pdd.PersonelID = c.PersonelID
WHERE  c.AgreementID IN (SELECT id
						 FROM   #Ids)


DECLARE @Columns            AS NVARCHAR(MAX),
		@Query              AS NVARCHAR(MAX),
		@CustomeFields      AS NVARCHAR(MAX),
		@CustomeFields2     AS NVARCHAR(MAX)
							  
	   
SELECT @CustomeFields = STUFF(
		   (
			   SELECT DISTINCT ',' + QUOTENAME(Fieldname)
			   FROM   cfg.EntityCustomeField
			   WHERE  EntityName = 'Agreement'
					  FOR XML PATH(''), TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   )

IF (@CustomeFields IS NULL)
	SET @CustomeFields = '[NoCustomeField]' 		

SELECT @CustomeFields2 = STUFF(
		   (
			   SELECT DISTINCT ',' + QUOTENAME(Fieldname)
			   FROM   cfg.EntityCustomeField
			   WHERE  EntityName = 'Personel'
					  FOR XML PATH(''), TYPE
		   ).value('.', 'NVARCHAR(MAX)'),
		   1,
		   1,
		   ''
	   )

IF (@CustomeFields2 IS NULL)
	SET @CustomeFields2 = '[NoCustomeField2]' 			   


	

SET @Query = 
	N'		select * from #TTT c
left join 
(
SELECT ecf.EntityID,ecfd.Fieldname, case when ecfd.fieldtype = 2 then cfg.getClrsaturndate(ecf.[Value],'''+@DateFormat+''', 0,'+CAST(@DateType AS VARCHAR(10))+') 
else  ecf.[Value] end as Value 
FROM cfg.EntityCustomeField ecfd 
left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''Agreement'' )x
pivot 
(max(Value)
for Fieldname IN (' + @CustomeFields + 
	')
) CustomEntities on CustomEntities.EntityID = c.Agreementid

left join 
(
SELECT ecf.EntityID,ecfd.Fieldname, case when ecfd.fieldtype = 2 then cfg.getClrsaturndate(ecf.[Value],'''+@DateFormat+''', 0,'+CAST(@DateType AS VARCHAR(10))+') else  ecf.[Value] end as Value 
FROM cfg.EntityCustomeField ecfd 
left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''Personel'' )x
pivot 
(max(Value)
for Fieldname IN (' + @CustomeFields2 + 
	')
) CustomEntities2 on CustomEntities2.EntityID = c.PersonelID'

						
EXECUTE sp_executesql @Query;
