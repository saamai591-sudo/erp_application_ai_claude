
--------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [HRM].[GetBaseValueDataList]
	@PageNumber INT,
	@RowspPage INT,
	@Sort NVARCHAR(MAX) = NULL,
	@Filter NVARCHAR(MAX) = NULL
AS
BEGIN
	DECLARE @UserID INT,
			@DateType TINYINT,
			@ViewRelatedToUser INT,
			@ViewRelatedToOthers INT,
			@UnauthorizedUsers NVARCHAR(MAX),
			@DateFormat VARCHAR(10);

	SET @UserID = CFG.GetuserID();

	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		  AND us.UserID = @UserID;

	IF @DateType IS NULL
		SET @DateType = CASE CFG.GetuserCulture()
							WHEN 'fa' THEN
								0
							WHEN 'en' THEN
								1
							WHEN 'ar' THEN
								2
							ELSE
								0
						END;

	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		  AND us.UserID = @UserID;

	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD';

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BaseValueData'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID,
		   @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'BaseValueData'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'BaseValueID ';

	DECLARE @Query NVARCHAR(MAX);
	SET @Query
		= N'
WITH Query_Result (
		BaseValueDataID,
		BaseValueID,
		PaymentSystemID,
		ApplyDate,
		IssueDate,
		GroupID,
		BaseID,
		OccupationGradeID,
		JobID,
		PersonelID,
		JobGroupID,
		[Value],
		Creator,
		CreationDate,
		LastEditor,
		LastEditionDate,
		Version,
		BaseValueTitle,
		BaseValueTitle2,
		PaymentSystemTitle,
		PaymentSystemTitle2,
		ApplyDateString,
		IssueDateString,
		GroupTitle,
		GroupTitle2,
		BaseTitle,
		BaseTitle2,
		OccupationGradeTitle,
		OccupationGradeTitle2,
		JobTitle,
		JobTitle2,
		JobCode,
		JobGroupTitle,
		JobGroupTitle2,
		JobGroupCode,
		PersonalCode,
		FirstName,
		FirstName2,
		LastName,
		LastName2,
		CreateDateString,
		EditionDateString,
		CreatorUserName,
		EditorName
	)
	AS
	(
		SELECT  bvd.BaseValueDataID,
				bvd.BaseValueID,
				bvd.PaymentSystemID,
				bvd.ApplyDate,
				bvd.IssueDate,
				bvd.GroupID,
				bvd.BaseID,
				bvd.OccupationGradeID,
				bvd.JobID,
				bvd.PersonelID,
				bvd.JobGroupID,
				bvd.[Value],
				bvd.Creator,
				bvd.CreationDate,
				bvd.LastEditor,
				bvd.LastEditionDate,
				bvd.Version,
				bv.Title AS BaseValueTitle,
				bv.Title2 AS BaseValueTitle2,
				ps.Title AS PaymentSystemTitle,
				ps.Title2 AS PaymentSystemTitle2,
				cfg.GetCLRSaturnDate(bvd.ApplyDate, @DateFormat, 0, @DateType) AS ApplyDateString,
				cfg.GetCLRSaturnDate(bvd.IssueDate, @DateFormat, 0, @DateType) AS IssueDateString,
				pg.Title AS GroupTitle,
				pg.Title2 AS GroupTitle2,
				pb.Title AS BaseTitle,
				pb.Title2 AS BaseTitle2,
				og.Title AS OccupationGradeTitle,
				og.Title2 AS OccupationGradeTitle2,
				j.title AS JobTitle,
				j.title2 AS JobTitle2,
				j.Code AS JobCode,
				jg.Title AS JobGroupTitle,
				jg.Title2 AS JobGroupTitle2,
				jg.Code AS JobGroupCode,
				p.Code AS PersonalCode,
				p2.Title AS FirstName,
				p2.Title2 AS FirstName2,
				p2.LastName,
				p2.LastName2,
				CFG.GetCLRSaturnDate(bvd.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
				CFG.GetCLRSaturnDate(bvd.LastEditionDate, @DateFormat, 1, @DateType) AS  EditionDateString,
				u.Name AS CreatorUserName,
				u2.Name AS EditorName
			FROM   hrm.BaseValueData  AS bvd
				JOIN CFG.[User]   AS u
					ON  u.UserID = bvd.Creator
				JOIN CFG.[User] AS u2
					ON  u2.UserID = bvd.LastEditor
				LEFT JOIN HRM.BaseValue        AS bv
					ON  bv.BaseValueID = bvd.BaseValueID
				LEFT JOIN HRM.PaymentSystem    AS ps
					ON  ps.PaymentSystemID = bvd.PaymentSystemID
				LEFT JOIN HRM.JobGroup         AS jg
					ON  jg.JobGroupID = bvd.JobGroupID
				LEFT JOIN hrm.PayrollGroup     AS pg
					ON  bvd.GroupID = pg.PayrollGroupID
				LEFT JOIN hrm.PayrollBase      AS pb
					ON  bvd.BaseID = pb.PayrollBaseID
				LEFT JOIN hrm.[Job]            AS j
					ON  j.JobID = bvd.JobID
				LEFT JOIN hrm.Personel         AS p
					ON  p.PersonelID = bvd.PersonelID
				LEFT JOIN hrm.OccupationGrade  AS og
					ON  og.OccupationGradeID = bvd.OccupationGradeID
				LEFT JOIN cfg.Party            AS p2
					ON  p2.PartyID = p.PartyID
			WHERE (@UserID = -1
							OR (@ViewRelatedToUser IS NOT NULL AND bvd.Creator = @UserID)
							OR (@ViewRelatedToOthers IS NOT NULL AND bvd.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
					)
	)';


	DECLARE @selectQuery NVARCHAR(MAX);

	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = '';
	ELSE
		SET @Filter = 'Where (' + @Filter + ')';


	DECLARE @tableName VARCHAR(100);
	SET @tableName = CFG.getTempTableName(1);

	SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
	
	PRINT @Query

	EXECUTE sys.sp_executesql @Query,
							  N'	@UserID INT ,
									@DateType TINYINT ,
									@DateFormat VARCHAR(10) ,
									@ViewRelatedToUser       INT,
									@ViewRelatedToOthers     INT,
									@UnauthorizedUsers NVARCHAR(MAX)',
							  @DateType = @DateType,
							  @DateFormat = @DateFormat,
							  @ViewRelatedToOthers = @ViewRelatedToOthers,
							  @ViewRelatedToUser = @ViewRelatedToUser,
							  @UnauthorizedUsers = @UnauthorizedUsers,
							  @UserID = @UserID;

	DECLARE @Count INT;

	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

	SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
	EXECUTE sys.sp_executesql @Query, N'@count int out', @Count = @Count OUT;

	RETURN ISNULL(@Count, 0);

END;
