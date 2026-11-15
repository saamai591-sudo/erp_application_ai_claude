
CREATE   PROCEDURE [HRM].RptAgreementPersonelReview
(
	@applyBranchAccess BIT = 1,
    @activePersons BIT = 0
)
--WITH ENCRYPTION
AS
	DECLARE @UserId INT
	
	SET @UserId = cfg.GetuserID()
	
	DECLARE @DateFormat     VARCHAR(50),
	        @dateType       INT,
			@Culture varchar(25),
		   @CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	DECLARE @personnels TAble (personnelID INT)

	select BranchID
	into #branches
	from cfg.vwBranchAccess


	IF @activePersons = 1
	BEGIN
		INSERT @personnels
		SELECT DISTINCT a.PersonelID FROM HRM.vwPersonelStatusInDate a
		WHERE a.STATUS <> 3 AND  a.DATE = cast(GETDATE() AS DATE)
	END 
	ELSE 
	BEGIN
		INSERT @personnels
		SELECT a.PersonelID  FROM HRM.Personel a
	END 
	
	SET @DateFormat = cfg.GetCurrentUserDateFormat()
	SET @dateType = cfg.GetCurrentUserDateType()
	SELECT T.PersonelID,
	       T.EmploymentTypeID,
	       T.EmploymentType,
	       T.EmploymentStatus,
	       CostCenter,
	       WorkPlace,
	       JobTitle,
	       OccupationGradeTitle,
	       T.EmploymentDate
	INTO   #validAgg
	FROM   (
	           SELECT a.*,	                  
					  case when @CultureNo = 1 then et.Title
	                       when @CultureNo = 2 then et.Title2
	                  end as EmploymentType,	                  
					  case when @CultureNo = 1 then es.Title
	                       when @CultureNo = 2 then es.Title2
	                  end as EmploymentStatus,	                  
					  case when @CultureNo = 1 then cc.Title
	                       when @CultureNo = 2 then cc.Title2
	                  end as CostCenter,	                  
					  case when @CultureNo = 1 then wp.Title
	                       when @CultureNo = 2 then wp.Title2
	                  end as WorkPlace,	                  
					  case when @CultureNo = 1 then j.Title
	                       when @CultureNo = 2 then j.Title2
	                  end as JobTitle,	                  
					  case when @CultureNo = 1 then og.Title
	                       when @CultureNo = 2 then og.Title2
	                  end as OccupationGradeTitle,
	                  ROW_NUMBER() OVER(PARTITION BY a.PersonelID ORDER BY a.IssueDate DESC) AS Rno
	           FROM   hrm.Agreement a
	                  INNER JOIN hrm.EmploymentType et
	                       ON  et.EmploymentTypeID = a.EmploymentTypeID
	                  INNER JOIN cfg.CostCenter cc
	                       ON  cc.CostCenterID = a.CostCenterID
	                  INNER JOIN hrm.WorkPlace wp
	                       ON  wp.WorkPlaceID = a.WorkPlaceID
	                  LEFT JOIN hrm.[Job] AS j
	                       ON  j.JobID = a.JobID
	                  LEFT JOIN hrm.OccupationGrade AS og
	                       ON  og.OccupationGradeID = a.OccupationGradeID
	                  LEFT JOIN hrm.EmploymentStatus AS es
	                       ON  es.EmploymentStatusID = a.EmploymentStatusID
	       ) T
	       INNER JOIN #branches AS vba ON vba.BranchID = T.BranchID
	WHERE  Rno = 1

	SELECT p.PersonelID,
	       p.Code    AS PersonelCode,
		   case when @CultureNo = 1 then p2.Title
	            when @CultureNo = 2 then p2.Title2
	       end as PersonelName,
		   case when @CultureNo = 1 then p2.LastName
	            when @CultureNo = 2 then p2.LastName2
	       end as LastName,
	       a.WorkPlace,
	       a.CostCenter,
	       a.EmploymentType,
	       a.EmploymentStatus,
	       JobTitle,
	       OccupationGradeTitle,
	       CFG.GetCLRSaturnDate(a.EmploymentDate, @DateFormat, 0, @dateType) AS EmploymentDate,
		   CASE
		       WHEN p.Birthday IS NULL THEN NULL
		       ELSE DATEDIFF(YEAR, p.Birthday, GETDATE())
		            - CASE
		                  WHEN DATEADD(YEAR, DATEDIFF(YEAR, p.Birthday, GETDATE()), p.Birthday) > GETDATE()
		                      THEN 1
		                  ELSE 0
		              END
		   END AS Age
	FROM   Hrm.Personel p
		   JOIN @personnels v 
				on p.PersonelID = v.personnelID 
	       INNER JOIN #validAgg a
	            ON  a.PersonelID = p.PersonelID
	       INNER JOIN Hrm.EmploymentType et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
	       INNER JOIN CFG.Party p2
	            ON  p2.PartyID = p.PartyID;

