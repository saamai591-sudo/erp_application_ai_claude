
------------------------------------------------------------------------
CREATE    FUNCTION [HRM].GetActivePersonelFull
(
	@Date                 DATE = NULL,
	@EmploymentTypeID     INT = NULL
)
RETURNS @Result TABLE 
		(
			PersonelID INT NOT NULL,
			PartyID INT NOT NULL,
			Code NVARCHAR(100) NOT NULL,
			FullName NVARCHAR(1024) NOT NULL,
			WorkPlace NVARCHAR(1024),
			EmploymentType NVARCHAR(1024),
			EmploymentDate VARCHAR(10),
			EmploymentStatus NVARCHAR(1024),
			JobTitle NVARCHAR(1024),
			JobGroup NVARCHAR(1024),
			OccupationGradeTitle NVARCHAR(1024),
			GroupTitle NVARCHAR(1024),
			BaseTitle NVARCHAR(1024),
			CostCenter NVARCHAR(1024),
			FatherName NVARCHAR(512),
			PositionCode NVARCHAR(256),
			PositionTitle NVARCHAR(512),
			[ExpireDate] VARCHAR(10)
		)
		--WITH ENCRYPTION
AS




BEGIN
	IF @Date IS NULL
		SET @Date = GETDATE()
	
	DECLARE @UserID         INT,
			@DateType       TINYINT,
			@DateFormat     VARCHAR(10),
			@Culture        VARCHAR(10),
			@CultureNo tinyint
		
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
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
	
	
	DECLARE @NeedConfirm BIT
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	INSERT INTO @Result
	SELECT p.PersonelID,
		   P.PartyID,
		   P.Code,
		   P.FullName,
		   case @CultureNo
				when 1 then wp.Title
				when 2 then wp.Title2
		   end,		   
		   case @CultureNo
				when 1 then et.Title
				when 2 then et.Title2
		   end,	
		   cfg.GetCLRSaturnDate(a.EmploymentDate, @DATEformat, 0, @DateType),
		   case @CultureNo
				when 1 then es.Title
				when 2 then es.Title2
		   end,	
		   case @CultureNo
				when 1 then j.Title
				when 2 then j.Title2
		   end,
		   case @CultureNo
				when 1 then jg.Title
				when 2 then jg.Title2
		   end,
		   case @CultureNo
				when 1 then og.Title
				when 2 then og.Title2
		   end,
		   case @CultureNo
				when 1 then pg.Title
				when 2 then pg.Title2
		   end,
		   case @CultureNo
				when 1 then pb.Title
				when 2 then pb.Title2
		   end,
		   case @CultureNo
				when 1 then cc.Title
				when 2 then cc.Title2
		   end,
		   p.FatherName,
		   p2.Code,
		   case @CultureNo
				when 1 then p2.Title
				when 2 then p2.Title2
		   end,
		  cfg.GetCLRSaturnDate(a.[ExpireDate], @DATEformat, 0, @DateType)
	FROM   (
			   SELECT p.PersonelID,
					  p.PartyID,
					  P.Code,
					  p.Sex,
					  p.Birthday,
					  p.MarriageStatus,
					  p.BirthCertificateNumber,
					  P.FatherName,
					  case @CultureNo
						   when 1 then (pa.Title + ' ' + ISNULL(pa.LastName, ''))
						   when 2 then (pa.Title2 + ' ' + ISNULL(pa.LastName2, ''))
					  end AS FullName
			   FROM   HRM.Personel p
					  INNER JOIN CFG.Party pa
						   ON  p.PartyID = pa.PartyID
					  LEFT JOIN (
							   SELECT *
							   FROM   (
										  SELECT *,
												 ROW_NUMBER() OVER(PARTITION BY cps.PersonelID ORDER BY cps.IssueDate DESC) AS 
												 Rno
										  FROM   hrm.ChangePersonelStatus cps
										  WHERE  cps.ChangeDate <= @Date
									  )T1
							   WHERE  Rno = 1
						   )T
						   ON  T.PersonelID = p.PersonelID
						   AND t.Rno = 1
			   WHERE  T.[Status] = 5
		   )P
		   INNER JOIN (
					SELECT a.*,
						   ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS 
						   RNo
					FROM   hrm.Agreement AS a
					INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = a.BranchID AND vba.UserID=@UserID
					WHERE  a.IssueDate <= @Date
						   AND a.ExecuteDate <= @Date
						   AND (
								   @NeedConfirm = 0
								   OR (a.ConfirmDate IS NOT NULL AND a.ConfirmDate <= @Date)
						   )
				)a
				ON  a.PersonelID = p.PersonelID
				AND a.RNo = 1
		   INNER JOIN hrm.EmploymentType et
				ON  et.EmploymentTypeID = a.EmploymentTypeID
		   INNER JOIN cfg.CostCenter cc
				ON  cc.CostCenterID = a.CostCenterID
		   INNER JOIN hrm.WorkPlace wp
				ON  wp.WorkPlaceID = a.WorkPlaceID
		   LEFT JOIN HRM.[Job] AS j
				ON  j.JobID = a.JobID
		   LEFT JOIN hrm.JobGroup AS jg
				ON  jg.JobGroupID = j.[group]
		   LEFT JOIN hrm.OccupationGrade AS og
				ON  og.OccupationGradeID = a.OccupationGradeID
		   LEFT JOIN hrm.PayrollBase AS pb
				ON  a.PayrollBaseID = pb.PayrollBaseID
		   LEFT JOIN hrm.PayrollGroup AS pg
				ON  pg.PayrollGroupID = a.PayrollGroupID
		   LEFT JOIN hrm.EmploymentStatus AS es
				ON  es.EmploymentStatusID = a.EmploymentStatusID
		   LEFT JOIN hrm.Position AS p2
				ON  p2.PositionID = a.PositionID
	WHERE  (
			   @EmploymentTypeID =-1
			   OR a.EmploymentTypeID = @EmploymentTypeID
		   )
	
	RETURN
END;
