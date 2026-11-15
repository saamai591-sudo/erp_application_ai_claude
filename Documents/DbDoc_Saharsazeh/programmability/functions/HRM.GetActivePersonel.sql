
CREATE   FUNCTION [HRM].GetActivePersonel
(
	@Date DATE = NULL
)
RETURNS @Result TABLE
(
	PersonelID INT NOT NULL,
	PartyID INT NOT NULL,
	Code NVARCHAR(100) NOT NULL,
	FullName NVARCHAR(1024) NOT NULL,
	IdentificationCode VARCHAR(50),
	WorkPlace NVARCHAR(1024),
	EmploymentType NVARCHAR(1024),
	EmploymentStatus NVARCHAR(1024),
	JobTitle NVARCHAR(1024),
	JobGroup NVARCHAR(1024),
	OccupationGradeTitle NVARCHAR(1024),
	GroupTitle NVARCHAR(1024),
	BaseTitle NVARCHAR(1024),
	CostCenter NVARCHAR(1024),
	EmploymentDate VARCHAR(10),
	RelationCount INT,
	FatherName NVARCHAR(512),
	PositionCode NVARCHAR(256),
	PositionTitle NVARCHAR(512),
	FlowChart NVARCHAR(512),
	Sex NVARCHAR(50),
	MarriageStatus NVARCHAR(50),
	BirthCertificateNumber NVARCHAR(50),
	BirthLocation NVARCHAR(1024),
	IssueLocation NVARCHAR(1024),
	BirthdayDate NVARCHAR(50),
	Age INT,
	eduTitle NVARCHAR(100),
    PersonelStatus NVARCHAR(100),
	ChildCount INT,
	soldiershipStatus NVARCHAR(50),
	ExperienceLenStr NVARCHAR(50),
	AgreementValue NVARCHAR(50),
	SoldLenStr NVARCHAR(50),
	Serial INT,
	FieldTitle NVARCHAR(512),
	[Address] NVARCHAR(512),
	ZipCode NVARCHAR(512),
	Mobile NVARCHAR(512)
)
--WITH ENCRYPTION
AS
BEGIN
	IF @Date IS NULL
		SET @Date = GETDATE();



	DECLARE @NeedConfirm BIT,
			@userId INT,
			@CultureNo int;


	SET @userId = cfg.GetuserID();

	SET @NeedConfirm = 0;

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = cfg.GetuserCulture();

	INSERT INTO @Result
	SELECT p.PersonelID,
		   p.PartyID,
		   p.Code,
		   p.FullName,
		   p.IdentificationCode,
		   case when @CultureNo = 1 then wp.Title else wp.Title2 end,
		   case when @CultureNo = 1 then et.Title else et.Title2 end,
		   case when @CultureNo = 1 then es.Title else es.Title2 end,
		   case when @CultureNo = 1 then j.Title else j.Title2 end,
		   case when @CultureNo = 1 then jg.Title else jg.Title2 end,
		   case when @CultureNo = 1 then og.Title else og.Title2 end,
		   case when @CultureNo = 1 then pg.Title else pg.Title2 end,
		   case when @CultureNo = 1 then pb.Title else pb.Title2 end,
		   case when @CultureNo = 1 then cc.Title else cc.Title2 end,
		   cfg.GetCLRSaturnDate(a.EmploymentDate, 'YY/MM/DD', 0, 0),
		   (
			   SELECT COUNT(*)
			   FROM hrm.[Relative] AS r
			   WHERE r.IsSponsored = 1
					 AND r.PersonelId = p.PersonelID
		   ),
		   p.FatherName,
		   p2.Code,
		   case when @CultureNo = 1 then p2.Title else p2.Title2 end,
		   case when @CultureNo = 1 then fc.Title else fc.Title2 end  AS FlowChart,
		   CASE
			   WHEN p.Sex = 0 THEN
				   N'مرد'
			   ELSE
				   N'زن'
		   END AS Sex,
		   CASE p.MarriageStatus
			   WHEN 0 THEN
				   N'مجرد'
			   WHEN 1 THEN
				   N'متاهل'
			   ELSE
				   N'معیل'
		   END AS MarriageStatus,
		   p.BirthCertificateNumber,
		   p.BirthLocation,
		   p.IssueLocation,
		   cfg.GetCLRSaturnDate(p.Birthday, 'YY/MM/DD', 0, 0) AS BirthdayDate,
		   CASE
		   	    WHEN p.Birthday IS NULL THEN NULL
		   	    ELSE DATEDIFF(YEAR, p.Birthday, GETDATE())
		   	         - CASE
		   	               WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.Birthday, GETDATE()), p.Birthday) > GETDATE()
		   	                   THEN 1
		   	               ELSE 0
		   	           END
		   END AS Age,
		   (
			   SELECT TOP 1
					  case when @CultureNo = 1 then sd.Title else sd.Title2 end Title
			   FROM hrm.Education AS E
				   INNER JOIN HRM.StudyDegree AS sd
					   ON sd.StudyDegreeID = E.StudyDegreeID
			   WHERE E.PersonelID = p.PersonelID
			   ORDER BY E.EndDate DESC
		   ),		   
           case when @CultureNo = 1 then ps.Title else ps.Title2 end,
		    (
			   SELECT COUNT(*)
			   FROM hrm.[Relative]
			   WHERE hrm.[Relative].Relation = 0
					 AND hrm.[Relative].PersonelID = P.PersonelID
		   ) AS ChildCount,
		   case  p.ExemptionCause when 0 then N'کفالت' when 1 then N'پزشکی' when 2 then N'ایثارگر' when 3 then N'سایر موارد' when 4 then N'معافیت تحصیلی' when 5 then N'پایان خدمت' end,		  
		   CAST(A.ExperienceLen / 365 AS VARCHAR(2)) + ':' + CAST((A.ExperienceLen % 365) / 30 AS VARCHAR(2)) AS ExperienceLenStr,
		   REPLACE(CONVERT(VARCHAR,
						   CONVERT(   MONEY,
						   (
							   SELECT SUM(ap.Amount)
							   FROM hrm.AgreementParameter AS ap
							   WHERE ap.AgreementID = A.AgreementID
						   )
								  ),
						   1
						  ),
				   '.00',
				   ''
				  ) AS AgreementValue,
		   CAST(Dedication.SoldLen / 365 AS VARCHAR(2)) + ':' + CAST((Dedication.SoldLen % 365) / 30 AS VARCHAR(2)) AS SoldLenStr,
		   A.Serial,
		   (
			   SELECT TOP 1
					  case when @CultureNo = 1 then sf.Title else sf.Title2 end Title
			   FROM hrm.Education AS E
				   INNER JOIN HRM.StudyField AS sf
					   ON sf.StudyFieldID = E.StudyFieldID
			   WHERE E.PersonelID = p.PersonelID
			   ORDER BY E.EndDate DESC
		   ),
		   case when @CultureNo = 1 then [address].TitleAddress else [address].TitleAddress2 end  ,
		   [Address].ZipCode,
		   Phone.Mobile
	FROM
	(
		SELECT p.PersonelID,
			   p.PartyID,
			   P.Code,
			   pa.IdentificationCode,
			   p.Sex,
			   p.Birthday,
			   ISNULL(ms.MarriageStatus,0) MarriageStatus,
			   p.BirthCertificateNumber,
			   case when @CultureNo = 1 then P.FatherName else P.FatherName2 end AS FatherName,
			   case when @CultureNo = 1 then (pa.Title + ' ' + ISNULL(pa.LastName, '')) else  (pa.Title2 + ' ' + ISNULL(pa.LastName2, ''))  end AS FullName,
			   case when @CultureNo = 1 then l.Title else l.Title2 end AS BirthLocation,
			   case when @CultureNo = 1 then l2.Title else l2.Title2 end  AS IssueLocation,
			   p.ExemptionCause
		FROM HRM.Personel p
		
		LEFT JOIN (
			SELECT pms.MarriageStatus,pms.PersonelID,pms.ApplyDate,row_number() OVER (PARTITION BY pms.PersonelID ORDER BY pms.ApplyDate desc) rno
			  FROM hrm.PersonelMarriageStatus AS pms
			WHERE pms.ApplyDate<=@Date
		) ms ON p.PersonelID = ms.PersonelID AND rno = 1
			
			INNER JOIN CFG.Party pa
				ON p.PartyID = pa.PartyID
			LEFT JOIN cfg.Location AS l
				ON l.LocationID = p.BirthLocationID
			LEFT JOIN cfg.Location AS l2
				ON l2.LocationID = p.IssueLocationID
			LEFT JOIN
			(
				SELECT *
				FROM
				(
					SELECT *,
						   ROW_NUMBER() OVER (PARTITION BY cps.PersonelID ORDER BY cps.ChangeDate DESC) AS Rno
					FROM hrm.ChangePersonelStatus cps
					WHERE cps.ChangeDate <= @Date
				) T1
				WHERE Rno = 1
			) T
				ON T.PersonelID = p.PersonelID
				   AND t.Rno = 1
		WHERE T.[Status] <> 3
	) P
		INNER JOIN
		(
			SELECT *,
				   ROW_NUMBER() OVER (PARTITION BY A.PersonelID ORDER BY A.IssueDate DESC) AS RNo
			FROM hrm.Agreement AS A
			WHERE A.IssueDate <= @Date
				  AND A.ExecuteDate <= @Date
				  AND
				  (
					  @NeedConfirm = 0
					  OR
					  (
						  A.ConfirmDate IS NOT NULL
						  AND A.ConfirmDate <= @Date
					  )
				  )
		) A
			ON A.PersonelID = p.PersonelID
			   AND A.RNo = 1
INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = A.BranchID AND vba.UserID=@userId
		INNER JOIN hrm.EmploymentType et
			ON et.EmploymentTypeID = A.EmploymentTypeID
		INNER JOIN cfg.CostCenter cc
			ON cc.CostCenterID = A.CostCenterID
		INNER JOIN hrm.WorkPlace wp
			ON wp.WorkPlaceID = A.WorkPlaceID
		LEFT JOIN HRM.[Job] AS j
			ON j.JobID = A.JobID
		LEFT JOIN hrm.JobGroup AS jg
			ON jg.JobGroupID = j.[group]
		LEFT JOIN hrm.OccupationGrade AS og
			ON og.OccupationGradeID = A.OccupationGradeID
		LEFT JOIN hrm.PayrollBase AS pb
			ON A.PayrollBaseID = pb.PayrollBaseID
		LEFT JOIN hrm.PayrollGroup AS pg
			ON pg.PayrollGroupID = A.PayrollGroupID
		LEFT JOIN hrm.EmploymentStatus AS es
			ON es.EmploymentStatusID = A.EmploymentStatusID
		LEFT JOIN hrm.POSITION AS p2
			ON p2.PositionID = A.PositionID
		LEFT JOIN hrm.FlowChart fc
			on fc.FlowChartID = p2.FlowChartID
		LEFT JOIN hrm.AgreementType AS AT
			ON AT.AgreementTypeID = A.AgreementTypeID
		LEFT JOIN hrm.PersonelStatus AS ps
			ON ps.PersonelStatusID = AT.PrePersonelStatusID
		LEFT JOIN
		(
			SELECT SUM(DATEDIFF(DAY, pd.FromDate, pd.ToDate)) AS SoldLen,
				   pd.PersonelID
			FROM hrm.PersonelDedication AS pd
			WHERE pd.DedicationType = 0
			GROUP BY pd.PersonelID
		) Dedication
			ON Dedication.PersonelID = p.PersonelID
		LEFT JOIN [CFG].[VwAddress] [Address] ON [Address].PartyID = P.PartyID and [Address].IsMain = 1
		LEFT JOIN  [CFG].[vwphone] Phone ON Phone.PartyID = P.PartyID


	RETURN;
END;

