
CREATE   FUNCTION [HRM].GetPersonel()
RETURNS @Result TABLE
(
	   PersonelID INT NOT NULL,
       PersonelCode NVARCHAR(100) NOT NULL,
       PersonelName NVARCHAR(1024) NOT NULL,
       IdentificationCode NVARCHAR(1024)  NULL,
       LastName NVARCHAR(1024)  NULL,
       WorkPlace NVARCHAR(1024)  NULL,
       CostCenter NVARCHAR(1024)  NULL,
       JobTitle NVARCHAR(1024)  NULL,
       EmploymentStatus NVARCHAR(1024)  NULL,
       EmploymentType NVARCHAR(1024)  NULL,
       Serial NVARCHAR(1024)  NULL,
       FieldTitle NVARCHAR(1024)  NULL,
       FatherName NVARCHAR(1024)  NULL,
       PositionCode NVARCHAR(1024)  NULL,
       PersonelStatus NVARCHAR(1024)  NULL,
       PositionTitle NVARCHAR(1024)  NULL,
       Sex NVARCHAR(24)  NULL,
       MarriageStatus NVARCHAR(1024)  NULL,
       BirthCertificateNumber NVARCHAR(1024)  NULL,
       BirthLocation NVARCHAR(1024)  NULL,
       IssueLocation NVARCHAR(1024)  NULL,
       BirthdayDate NVARCHAR(1024)  NULL,
       Age INT NULL,
       eduTitle NVARCHAR(1024)  NULL,
       OccupationGradeTitle NVARCHAR(1024)  NULL,
       EmploymentDate NVARCHAR(1024)  NULL,
       RelationCount NVARCHAR(1024)  NULL,
       ChildCount NVARCHAR(1024)  NULL,
       ExperienceLenStr NVARCHAR(1024)  NULL,
       AgreementValue NVARCHAR(1024)  NULL,
       SoldLenStr NVARCHAR(1024)  NULL,
       soldiershipStatus NVARCHAR(1024)  NULL
)
--with encryption
AS 
begin
DECLARE @CultureNo INT,
        @culture NVARCHAR(100),
        @man NVARCHAR(100),
        @women NVARCHAR(10),
        @Married NVARCHAR(10),
        @Moeil NVARCHAR(10),
        @Single NVARCHAR(10),
        @NotDone NVARCHAR(10),
        @Done NVARCHAR(10),
        @Exemption NVARCHAR(10);

	SET @culture =  cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @culture;
	
	SELECT @Married = lev.Value FROM CFG.LocalizeEnum AS le
	JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = N'MarriageStatus' AND le.Item = N'Married' AND lev.Culture = @culture
	
	SELECT @Moeil = lev.Value FROM CFG.LocalizeEnum AS le
	JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = N'MarriageStatus' AND le.Item = N'Moeil' AND lev.Culture = @culture
	
	SELECT @Single = lev.Value FROM CFG.LocalizeEnum AS le
	JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = N'MarriageStatus' AND le.Item = N'Single' AND lev.Culture = @culture
	
	SELECT @man = lev.Value FROM CFG.LocalizeEnum AS le
	JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = N'sex' AND le.Item = N'Man' AND lev.Culture = @culture
	
	SELECT @women = lev.Value FROM CFG.LocalizeEnum AS le
	JOIN CFG.LocalizeEnumValue AS lev ON lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE le.Enum = N'sex' AND le.Item = N'Woman' AND lev.Culture = @culture

INSERT INTO @Result
SELECT p.PersonelID,
       p.Code                  AS PersonelCode,
       case when @CultureNo = 1 then p2.Title else p2.Title2 end AS PersonelName,
       p2.IdentificationCode,
       case when @CultureNo = 1 then p2.LastName else p2.LastName2 end AS LastName,
       a.WorkPlace,
       a.CostCenter,
       a.JobTitle,
       a.EmploymentStatus,
       a.EmploymentType,
       a.Serial,
       edu.FieldTitle,
       case when @CultureNo = 1 then p.FatherName else p.FatherName2 end AS   FatherName,
       a.PositionCode,
       a.PersonelStatus,
       a.PositionTitle,
       CASE 
            WHEN p.Sex = 0 THEN @man
            ELSE @women
       END                     AS Sex,
       CASE p.MarriageStatus
            WHEN 0 THEN @Single
            WHEN 1 THEN @Married
            ELSE @Moeil
       END                     AS MarriageStatus,
       p.BirthCertificateNumber,
       case when @CultureNo = 1 then l.Title else l.Title2 end AS   BirthLocation,
       case when @CultureNo = 1 then l2.Title else l2.Title2 end AS   IssueLocation,
       Cfg.GetCLRSaturnDate(p.Birthday, 'YY/MM/DD', 0, 0) AS BirthdayDate,
	   CASE
		    WHEN p.Birthday IS NULL THEN NULL
		    ELSE DATEDIFF(YEAR, p.Birthday, GETDATE())
		         - CASE
		               WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.Birthday, GETDATE()), p.Birthday) > GETDATE()
		                   THEN 1
		               ELSE 0
		           END
	   END AS Age,
       edu.eduTitle,
       a. OccupationGradeTitle,
       cfg.GetCLRSaturnDate(a.EmploymentDate, 'YY/MM/DD', 0, 0) AS 
       EmploymentDate,
       (
           SELECT COUNT(*)
           FROM   hrm.[Relative] AS r
           WHERE  r.IsSponsored = 1
                  AND r.PersonelID = a.PersonelID
       )                       AS RelationCount,
       (
           SELECT COUNT(*)
           FROM   hrm.[Relative] AS r
           WHERE  r.Relation = 0
                  AND r.PersonelID = a.PersonelID
       )                       AS ChildCount
       ,
        a.ExperienceLenStr,
       REPLACE(CONVERT(VARCHAR,CONVERT(MONEY,a.AgreementValue),1), '.00','') AS AgreementValue,
          Cast(Dedication.SoldLen /365 AS VARCHAR(2)) + ':' +CAST( (Dedication.SoldLen%365)/30 AS VARCHAR(2))
                                  AS SoldLenStr,
        CASE  p.ExemptionCause 
            WHEN 0 THEN N'کفالت' 
            WHEN 1 THEN N'پزشکی' 
            WHEN 2 THEN N'ایثارگر' 
            WHEN 3 THEN N'سایر موارد'
            WHEN 4 THEN N'معافیت تحصیلی' 
            WHEN 5 THEN N'پایان خدمت' 
        END AS soldiershipStatus
FROM   Hrm.Personel p
       INNER JOIN (
                SELECT T.PersonelID,
                       T.EmploymentTypeID,
                       T.EmploymentType,
                       T.EmploymentStatus,
                       T.CostCenter,
                       T.WorkPlace,
                       T.Jobtitle,
                       T.OccupationGradeTitle,
                       T.EmploymentDate,
                       T.PersonelStatus,
                       T.PositionCode,
                       T.PositionTitle,
                       T.ExperienceLenStr,
                       T.Serial,
                       (SELECT SUM(ap.Amount) FROM hrm.AgreementParameter AS ap
                        WHERE ap.AgreementID=t.AgreementID)AS AgreementValue
                FROM   (
                           SELECT a.*,
                                  case when @CultureNo = 1 then et.Title else et.Title2 end AS   EmploymentType,
                                  case when @CultureNo = 1 then es.Title else es.Title2 end AS  EmploymentStatus,
                                  case when @CultureNo = 1 then cc.Title else cc.Title2 end AS  CostCenter,
                                  case when @CultureNo = 1 then wp.Title else wp.Title2 end AS WorkPlace,
                                  case when @CultureNo = 1 then j.Title else j.Title2 end AS Jobtitle,
                                  case when @CultureNo = 1 then og.Title else og.Title2 end AS  OccupationGradeTitle,
								  p2.Code PositionCode,
                                  case when @CultureNo = 1 then p2.Title else p2.Title2 end AS PositionTitle,
                                  case when @CultureNo = 1 then ps.Title else ps.Title2 end AS PersonelStatus,
                                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
                                  Rno,
                                  Cast(a.ExperienceLen/365 AS VARCHAR(2)) + ':' +CAST( (a.ExperienceLen%365)/30 AS VARCHAR(2))
                                  AS ExperienceLenStr
                           FROM   hrm.Agreement a
                                  INNER JOIN hrm.Personel AS p
                                       ON  a.PersonelID = p.PersonelID
                                  INNER JOIN hrm.EmploymentType et
                                       ON  et.EmploymentTypeID = a.EmploymentTypeID
                                  INNER JOIN cfg.CostCenter cc
                                       ON  cc.CostCenterID = a.CostCenterID
                                  INNER JOIN hrm.WorkPlace wp
                                       ON  wp.WorkPlaceID = a.WorkPlaceID
                                  LEFT JOIN HRM.[Job] AS j
                                       ON  j.JobID = a.JobID
                                  LEFT JOIN hrm.OccupationGrade AS og
                                       ON  og.OccupationGradeID = a.OccupationGradeID
                                  LEFT JOIN hrm.EmploymentStatus AS es
                                       ON  es.EmploymentStatusID = a.EmploymentStatusID
                                  LEFT JOIN hrm.Position AS p2
                                       ON  p2.PositionID = a.PositionID
                                   LEFT JOIN hrm.AgreementType AS at
                                   ON at.AgreementTypeID = a.AgreementTypeID
                                   LEFT JOIN hrm.PersonelStatus AS ps
                                   ON ps.PersonelStatusID = at.PrePersonelStatusID
                           WHERE  a.IssueDate <= GETDATE()
                                 
                       ) T
                       INNER JOIN cfg.vwBranchAccess AS vba ON t.BranchID=vba.BranchID AND vba.UserID=cfg.GetuserID()
                WHERE  T.Rno = 1
            ) a
            ON  a.PersonelID = p.PersonelID
       INNER JOIN Hrm.EmploymentType et
            ON  et.EmploymentTypeID = a.EmploymentTypeID
       INNER JOIN CFG.Party p2
            ON  p2.PartyID = p.PartyID
       LEFT JOIN cfg.Location  AS l
            ON  p.BirthLocationID = l.LocationID
       LEFT JOIN cfg.Location  AS l2
            ON  p.IssueLocationID = l2.LocationID
       LEFT JOIN (
                SELECT e.PersonelID,
					   case when @CultureNo = 1 then sd.Title else sd.Title2 end AS  eduTitle,
                       case when @CultureNo = 1 then sf.Title else sf.Title2 end AS FieldTitle,
                       ROW_NUMBER() OVER(PARTITION BY e.PersonelID ORDER BY e.EndDate DESC) AS 
                       Rno
                FROM   hrm.Education AS e
                       INNER JOIN HRM.StudyDegree AS sd
                            ON  sd.StudyDegreeID = e.StudyDegreeID
                        LEFT JOIN HRM.StudyField AS sf
                    ON sf.StudyFieldID = e.StudyFieldID
            ) edu
            ON  edu.Rno = 1
            AND edu.PersonelID = p.PersonelID
        LEFT JOIN (
        SELECT SUM( DATEDIFF(day,pd.FromDate,pd.ToDate)) AS SoldLen,pd.PersonelID
        FROM   hrm.PersonelDedication AS pd 
        WHERE pd.DedicationType=2 
        GROUP BY pd.PersonelID     
    ) Dedication
    On Dedication.PersonelID = p.PersonelID

	RETURN 
END;

