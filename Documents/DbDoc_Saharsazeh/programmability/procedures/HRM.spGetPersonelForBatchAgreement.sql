CREATE   PROCEDURE [HRM].spGetPersonelForBatchAgreement
(@AgreementTypeID INT, @ExecuteDate DATE, @BranchID INT,@IssueDate DATE)
AS
DECLARE
	@DateFormat     NVARCHAR(10),
	@DateType NVARCHAR(10),
	@user INT,
	@Culture NVARCHAR(10)
	
	SET @user = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture();
	
SELECT @DateFormat = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @user;
       
SELECT @DateType = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Type'
		AND us.UserID = @user;       

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

	CREATE TABLE #TT
	(
		PersonelID         INT,
		PartyID            BIGINT,
		Code               NVARCHAR(20),
		AgreementID        INT,
		FullName           NVARCHAR(500)
	)
	
	IF @DateType IS NULL
			SET @DateType = CASE @Culture
								WHEN 'fa' THEN
									0
								WHEN 'en' THEN
									1
								WHEN 'ar' THEN
									2
							END;
	
	INSERT INTO #TT
	EXEC [HRM].GetPersonelForAgreement 
		 @Type = @AgreementTypeID,
	     @date = @ExecuteDate,
		 @IssueDate = @IssueDate,
	     @branchId = @BranchID
	
	SELECT t.PersonelID,
	       t.PartyID,
	       t.Code,
	       t.FullName,
	       wp.Title                    WorkPlace,
	       j.Title                     JobTitle,
	       cc.Title                    CostCenter,
	       et.Title                    EmploymentType,
	       CFG.GetCLRSaturnDate(a.EmploymentDate, @DateFormat , 0,@DateType) EmploymentDate,
	       CFG.GetCLRSaturnDate(a.[ExpireDate], @DateFormat , 0,@DateType) [ExpireDate]
	       
	FROM   #TT                      AS t
	       LEFT JOIN hrm.Agreement       AS a
	            ON  a.AgreementID = t.AgreementID
	      LEFT  JOIN hrm.WorkPlace       AS wp
	            ON  wp.WorkPlaceID = a.WorkPlaceID
	      LEFT  JOIN hrm.[Job]           AS j
	            ON  j.JobID = a.JobID
	      LEFT JOIN cfg.CostCenter      AS cc
	            ON  cc.CostCenterID = a.CostCenterID
	      LEFT JOIN hrm.EmploymentType  AS et
	            ON  et.EmploymentTypeID = a.EmploymentTypeID
