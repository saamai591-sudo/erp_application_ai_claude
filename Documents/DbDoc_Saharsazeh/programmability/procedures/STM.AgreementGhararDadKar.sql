
-------------------------------------
CREATE   PROC [STM].AgreementGhararDadKar
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
     
DECLARE @CustomeFields          AS NVARCHAR(MAX),
		@CustomeFields2          AS NVARCHAR(MAX),
        @Culture                VARCHAR(10),
        @UserID                 INT,
        @DateType               VARCHAR(10),
        @DateFormat             VARCHAR(10),
        @Query NVARCHAR(MAX),
		@tempTable VARCHAR(50),
		@CulturenO INT

        
	SET @Culture = CFG.GetuserCulture()

	SET @UserID = cfg.GetuserID()

	SELECT @CulturenO = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture        
        
	SELECT @CustomeFields = STUFF(
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

	IF (@CustomeFields IS NULL)
		SET @CustomeFields = '[NoCustomeField]' 

	SELECT @CustomeFields2 = STUFF(
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

	IF (@CustomeFields2 IS NULL)
		SET @CustomeFields2 = '[NoCustomeField]' 

    
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID

	IF @DateType IS NULL
		SET @DateType = CASE @Culture
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
   
   SET @tempTable=cfg.getTempTableName(1)
		
	SET @Query='select CustomEntities.*,CustomEntities2.*,a.AgreementId as EEntityId into  '+@tempTable+' 
	from 
	hrm.Agreement a
	inner join  #Ids on  #Ids.Id=a.AgreementId
	left join 
	(
	SELECT ecf.EntityID,ecfd.Fieldname,
	case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType + ''') 
		 when ecfd.fieldtype is null and ecfd.LookupDataID is not null then li.Title
		 else  ecf.[Value] end as Value
	 FROM cfg.EntityCustomeField ecfd
	left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
	left join cfg.LookupDataItem li on li.LookupDataItemID = ecf.LookupDataItemID 
	WHERE ecfd.EntityName = ''Personel''
	)x
	pivot 
	(
		max(Value)
		for Fieldname IN (' + @CustomeFields + 
		')
	) CustomEntities on CustomEntities.EntityID = a.PersonelId
			left join 
	(
	SELECT ecf.EntityID EntityID2,ecfd.Fieldname Fieldname2,
	case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + '''  , 0, ''' + @DateType + 
		''') else  ecf.[Value] end as Value2
	 FROM cfg.EntityCustomeField ecfd
	left JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
	WHERE ecfd.EntityName = ''Agreement''
	)x
	pivot 
	(
		max(Value2)
		for Fieldname2 IN (' + @CustomeFields2 + 
		')
	) CustomEntities2 on CustomEntities2.EntityID2 = a.AgreementId
	'   
	EXEC( @Query)

--------------
       
       
      SELECT * into #vwEnum
      FROM cfg.VwEnums AS ve
      WHERE ve.Enum IN ('MarriageStatus','DedicationTypes','Blood','ExemptionCause') 

      
      SELECT 
		a.PartyID,
       c.AgreementID,
       case when @CulturenO = 1 then c.Specification else      c.Specification2 end                Specification,
	   CASE WHEN @CulturenO = 1 
				THEN b.Title + ' ' + b.LastName
			WHEN @CulturenO = 2
				THEN b.Title2 + ' ' + b.LastName2
		END                         PersonelName,
       CFG.GetCLRSaturnDate(a.Birthday,@DateFormat,@DateType, 0)      Birthday,
       left(cfg.GetCLRSaturnDate(a.Birthday,'yyyy/mm/dd',0,0),4) Birthday_year,
       SUBSTRING(CFG.GetCLRSaturnDate(a.Birthday,'yyyy/mm/dd',0, 0), 6, 2) BirthdayMonth,
       SUBSTRING(CFG.GetCLRSaturnDate(a.Birthday,'yyyy/mm/dd',0, 0), 9, 2) BirthdayDay,
       a.BirthCertificateNumber,
       case when @CulturenO = 1 then a.FatherName else a.FatherName2 end FatherName,
       b.IdentificationCode,
       case when @CulturenO = 1 then wo.Title else wo.Title2 end                             WorkPlace,
       CFG.GetCLRSaturnDate(c.IssueDate,@DateFormat,@DateType, 0)     IssueDate,
       CFG.GetCLRSaturnDate(c.EmploymentDate,@DateFormat,@DateType, 0) EmploymentDate,
       CFG.GetCLRSaturnDate(c.ExecuteDate,@DateFormat,@DateType, 0) ExecuteDate,
       CFG.GetCLRSaturnDate(c.ExpireDate,@DateFormat,@DateType, 0) EXPIREDATE,
       DATEDIFF(DAY, c.ExecuteDate, c.ExpireDate) AS DiffDate,
       case when @CulturenO = 1 then JOB.Title else JOB.Title2 end                           JobTitle,
       case when @CulturenO = 1 then ad.TitleAddress else ad.TitleAddress2 end Address,
	   ad.ZipCode,
       case when @CulturenO = 1 then fl.Title else fl.Title2 end                                FlowChart,
       case when @CulturenO = 1 then po.Title else po.Title2 end  Position,
       case when @CulturenO = 1 then JOB.JobSpecification else JOB.JobSpecification2 end JobSpecification ,
	   a.PersonelID,
       a.Code                                PersonelCode,
       case when @CulturenO = 1 then cost.Title     else  cost.Title2 end                       CostCenter,
       case when @CulturenO = 1 then b.Title else b.Title2 end        FirstName,
       case when @CulturenO = 1 then b.LastName else b.LastName2 end LastName,
       c.Number,
	   a.Sex,
	   ve.[Value]                    BloodType ,
       (
           SELECT SUM(Amount)
           FROM   HRM.AgreementParameter ap
           WHERE  TYPE = 1
                  AND ap.AgreementID = c.AgreementID
       )                                     Amount,
        (
                SELECT top 1 ve.[Value]
                FROM   hrm.PersonelMarriageStatus AS pms
                join #vwEnum ve on pms.MarriageStatus = ve.KeyValue and ve.Enum = 'MarriageStatus'
                WHERE  pms.PersonelID = a.PersonelID
                       AND pms.ApplyDate <= c.ExecuteDate
                ORDER BY
                       pms.ApplyDate DESC
            )
                                     MarriageStatus ,
        (
                SELECT TOP 1 pms.MarriageStatus
                FROM   hrm.PersonelMarriageStatus AS pms
                WHERE  pms.PersonelID = a.PersonelID
                       AND pms.ApplyDate <= c.ExecuteDate
                ORDER BY
                       pms.ApplyDate DESC
            )                                  MarriageStatusCode
      ,
       case when @CulturenO = 1 then  emt.Title else  emt.Title2 end                           EmploymentType,
       (
           SELECT TOP 1
                  AccountNumber
           FROM   HRM.PersonelAccount Br2
                  JOIN CFG.BankBranch Br
                       ON  Br.BankBranchID = Br2.BankBranchID
                  JOIN CFG.Bank Bank
                       ON  Bank.BankID = Br.BankID
           WHERE  Br2.PersonelID = a.PersonelID
		   order by br2.Date desc
       )                                     AccountNumber,
       (
           SELECT TOP 1
                  case when @CulturenO = 1 then  Bank.Title else  Bank.Title2 end Title
           FROM   HRM.PersonelAccount Br2
                  JOIN CFG.BankBranch Br
                       ON  Br.BankBranchID = Br2.BankBranchID
                  JOIN CFG.Bank Bank
                       ON  Bank.BankID = Br.BankID
           WHERE  Br2.PersonelID = a.PersonelID
		   order by br2.Date desc
       )                                     Bankitle,
       dd.Value                              GradeTitle,
       pb.Value                              Basetitle,
       pg.Value                              GroupTitle,
        case when @CulturenO = 1 then  at.Title      else at.Title2 end                        AgreementType,
       c.Serial,
       JOB.Code                              JobCode,
       po.Code                               PositionCode,
       (
           SELECT TOP 1
                  pd.FromDate
           FROM   HRM.PersonelDedication pd
           WHERE  pd.PersonelID = c.PersonelID
           ORDER BY
                  pd.ApplyDate DESC
       )                                     FromDatePersonelDedication,
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
       dt.Value                       PersonelDedication,
       (
           SELECT COUNT(*)
           FROM   HRM.Relative re
           WHERE  re.PersonelID = c.PersonelID
                  AND re.Relation = 0
       )                                     Children,
	    (
           SELECT COUNT(*)
           FROM   HRM.Relative re
           WHERE  re.PersonelID = c.PersonelID
                  AND re.Relation = 0
                  AND re.IsSponsored = 1
       )                                     SponsoredChildren,
       c.EmploymentTypeID,
       (
           SELECT TOP 1
                  bvd2.Value
           FROM   HRM.BaseValueData bvd2
           WHERE  bvd2.PersonelID = c.PersonelID
                  AND bvd2.BaseValueID = 10
                  AND c.IssueDate >= bvd2.ApplyDate
           ORDER BY
                  bvd2.ApplyDate DESC
       )                                     BaseValueNomreh,	
       (
           SELECT TOP 1
                  bvd2.Value
           FROM   HRM.BaseValueData bvd2
           WHERE  bvd2.PersonelID = c.PersonelID
                  AND bvd2.BaseValueID = 22
                  AND c.IssueDate >= bvd2.ApplyDate
           ORDER BY
                  bvd2.ApplyDate DESC
       )                                     BaseValue,
       ph.FixPhone Phone,
       ph.Mobile,
       case when @CulturenO = 1 then JobGroup.Title    else   JobGroup.Title2 end                 Raste,
       case when @CulturenO = 1 then lo.Title    else lo.Title2 end                          Location,
       (c.ExperienceLen / 360)               ExperienceLenYear,
       ((c.ExperienceLen -(360 * (c.ExperienceLen / 360))) / 30) ExperienceLenMonth,
       c.ExperienceLen                       ExperienceLenDay,
       case when @CulturenO = 1 then  es.Title   else es.Title2 end                           EmploymentStatus,
       a.InsuranceNumber,
       (
           SELECT TOP 1
                  case when @CulturenO = 1 then sd.Title
					   when @CulturenO = 2 then sd.Title2
					   end 
           FROM   HRM.Education D
                  LEFT JOIN HRM.StudyDegree sd
                       ON  sd.StudyDegreeID = D.StudyDegreeID
           WHERE  D.PersonelID = c.PersonelID
           ORDER BY
                  D.EndDate desc
       )                                     Degree,
       (
           SELECT TOP 1
                  case when @CulturenO = 1 then sf.Title
					   when @CulturenO = 2 then sf.Title2
					   end 
           FROM   HRM.Education ed
                  JOIN HRM.StudyField sf
                       ON  sf.StudyFieldID = ed.StudyFieldID
           WHERE  Skill = 0
                  AND ed.PersonelID = c.PersonelID
           ORDER BY
                  ed.EndDate DESC
       )                                     Field,
       (
           SELECT TOP 1
                  case when @CulturenO = 1 then sf.Title
					   when @CulturenO = 2 then sf.Title2
					   end 
           FROM   HRM.Education ed
                  JOIN HRM.Institue sf
                       ON  sf.InstitueID = ed.InstituteID
           WHERE  Skill = 0
                  AND ed.PersonelID = c.PersonelID
           ORDER BY
                  ed.EndDate DESC
       )                                     Institue,
       case when @CulturenO = 1 then lo1.Title    else lo1.Title2 end  BirthLocation,
        case when @CulturenO = 1 then ld.Title    else ld.Title2 end  InsuranceType,
		c.JobID,
		c.WorkPlaceID,
        ss.Value as soldiershipStatus

     INTO #TResult
FROM   HRM.Agreement c
       JOIN HRM.Personel a
            ON  a.PersonelID = c.PersonelID
       left join #vwEnum AS ve on a.Blood = ve.KeyValue and ve.Enum = 'Blood'           
       left join #vwEnum AS ss on a.ExemptionCause = ss.KeyValue and ss.Enum = 'ExemptionCause'  
       LEFT JOIN CFG.Location LO
            ON  a.IssueLocationID = LO.LocationID
       LEFT JOIN CFG.Location LO1
            ON  LO1.LocationID = a.BirthLocationID
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
       LEFT JOIN cfg.VwAddress ad on ad.PartyID = b.PartyID and ad.IsMain = 1
	   LEFT JOIN cfg.vwphone ph on ph.PartyID = b.PartyID
       LEFT JOIN HRM.Position po
            ON  po.PositionID = c.PositionID
       LEFT JOIN HRM.FlowChart fl
            ON  fl.FlowChartID = po.FlowChartID
       JOIN HRM.EmploymentType emt
            ON  emt.EmploymentTypeID = c.EmploymentTypeID
       JOIN HRM.AgreementType at
            ON  at.AgreementTypeID = c.AgreementTypeID
       LEFT JOIN(
       	SELECT ROW_NUMBER() OVER (PARTITION BY pdd.PersonelID ORDER BY pdd.ApplyDate desc) rno,pdd.PersonelID,ve.[Value]
       	 FROM  HRM.PersonelDedication pdd
       	join #vwEnum ve on pdd.DedicationType = ve.KeyValue and ve.Enum = 'DedicationTypes') dt
       	on a.PersonelID = dt.PersonelID and dt.rno = 1
	   left join
	   (
	   select ldi.* 
	   from cfg.LookupData ld
		join cfg.LookupDataItem ldi
			on ld.LookupDataID = ldi.LookupDataID
		where SystemName = 'InsuranceType'
	   )ld
	   on ld.LookupDataItemID =  a.InsuranceType
	   WHERE  c.AgreementID IN (SELECT id FROM   #Ids)--- 
    
        SET @Query='select  * from #TResult
					Left join ' + @tempTable +' t 
					on t.EEntityId=#TResult.AgreementID '
            
        EXEC (@Query)
