
---------------------------------------------------------
CREATE   PROCEDURE [PAY].GetLoanList
(
	@Type           BIT,
	@PageNumber     INT,
	@RowspPage      INT,
	@Sort           NVARCHAR(MAX) = NULL,
	@Filter         NVARCHAR(MAX) = NULL
)
AS
Begin
	DECLARE @UserID                  INT,
			@DateType                TINYINT,
			@ViewRelatedToUser       INT,
			@ViewRelatedToOthers     NVARCHAR(MAX),
			@DateFormat              VARCHAR(10),
			@UnauthorizedUsers		 NVARCHAR(MAX);
	
	
	SET @UserID = cfg.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
		
	CREATE TABLE #ValidPersonel(personelId int)
		
	INSERT INTO #ValidPersonel
	EXEC Hrm.GetValidPersonelWithBranchAccess NULL
		
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
	
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Loan'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
		   @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'Loan'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	IF @Sort IS NULL
	   OR @Sort = ''
		SET @Sort = 'PersonelCode '
	
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = N'
	WITH Query_Result 
	(
		LoanID  ,
		[Type]  ,
		BaseParentID  ,
		ParentID  ,
		PersonelID  ,
		ParameterID  ,
		Number  ,
		FacilitiesNumber  ,
		[Date]  ,
		TotalAmount ,
		Settlement ,
		InstallmentCount  ,
		InstallmentAmount ,
		CalendarMonthID  ,
		TotalRound ,
		RoundPayment  ,
		[Description]  ,
		Description2  ,
		OrganizationItemID  ,
		[Version]  ,
		Creator  ,
		CreationDate ,	
		LastEditionDate,
		PersianDate  ,
		CreateDateString  ,
		EditionDateString  ,
		CreatorUserName  ,
		EditorName  ,
		PersonelCode  ,
		PersonelName  ,
		PersonelName2 ,
		ParameterTitle  ,
		ParameterTitle2 ,
		ParameterOrganizationID,  
		CalendarYear  ,
		ParentNumber  ,
		FirstDate  ,
		FirstTotalAmount  ,
		IsNotInCalculation  ,
		IsNotInFlow  ,
		TypeString ,
		OrganizationItemTitle ,
		PaymentSubjectId,
		PettyCashCostItemId,
		DebitCreditNoteItemId,
		DocumentTitle		
	)
	As (
		SELECT  l.LoanID,
				l.[Type],
				l.BaseParentID,
				l.ParentID,
				l.PersonelID,
				l.ParameterID,
				l.Number,
				l.FacilitiesNumber,
				l.[Date],
				l.TotalAmount,
				l.Settlement,
				l.InstallmentCount,
				l.InstallmentAmount,
				l.CalendarMonthID,
				l.TotalRound,
				l.RoundPayment,
				l.[Description],
				l.Description2,
				l.OrganizationItemID,
				l.[Version],
				l.Creator,
				l.CreationDate,   
				l.LastEditionDate,
				CFG.GetCLRSaturnDate(l.[Date], @DateFormat  , 0, @DateType) AS PersianDate, 
				CFG.GetCLRSaturnDate(l.CreationDate, @DateFormat  , 1, @DateType) AS CreateDateString, 
				CFG.GetCLRSaturnDate(l.LastEditionDate, @DateFormat  , 1, @DateType) AS EditionDateString,
				u.Name AS CreatorUserName, 
				u2.Name AS EditorName,
				p.Code AS PersonelCode,
				(pa.Title) + '' '' + ISNULL(pa.LastName, '''') AS PersonelName,
				(pa.Title2) + '' '' + ISNULL(pa.LastName2, '''') AS PersonelName2,
				par.Title AS ParameterTitle,
				par.Title2 AS ParameterTitle2,	
				par.OrganizationID   ParameterOrganizationID,            
				ca.[Year] AS CalendarYear,
				lo.Number AS ParentNumber,
				CFG.GetCLRSaturnDate(BaseParent.[Date], @DateFormat , 0, @DateType) AS FirstDate,
				BaseParent.TotalAmount AS FirstTotalAmount,
				CASE WHEN cp.PersonelID is null THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsNotInCalculation,
				CASE WHEN loan.ParentID is null THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS IsNotInFlow,
				CASE l.[Type] WHEN 2 THEN N''قسط'' 
							  WHEN 3 THEN N''مانده''
							  ELSE '''' 
				END AS TypeString,
				p1.Title ,
				l.PaymentSubjectId,
				l.PettyCashCostItemId,
				l.DebitCreditNoteItemId,
				vpld.Title
			FROM PAY.Loan l
				inner join #ValidPersonel
				on #ValidPersonel.PersonelId=l.PersonelID
				INNER JOIN CFG.[User] AS u ON u.UserID = l.Creator 
				INNER JOIN CFG.[User] AS u2 ON u2.UserID = l.LastEditor
				LEFT JOIN  PAY.Loan lo ON lo.LoanID = l.ParentID
				INNER JOIN PAY.Loan BaseParent on BaseParent.LoanID = l.BaseParentID
				INNER JOIN HRM.Personel p ON p.PersonelID = l.PersonelID
				INNER JOIN CFG.Party pa ON pa.PartyID = p.PartyID
				INNER JOIN PAY.Parameter par ON par.ParameterID = l.ParameterID
				LEFT JOIN HRM.CalendarMonth c ON c.CalendarMonthID = l.CalendarMonthID
				INNER JOIN HRM.Calendar ca ON c.CalendarID = ca.CalendarID
				LEFT JOIN
				(	select c1.PersonelID,c1.CalendarMonthID 
					from PAY.CalculationPersonel c1
					WHERE c1.CalculationTypeID=1 
					group by c1.PersonelID,c1.CalendarMonthID 
				) cp on cp.PersonelID = l.PersonelID  and cp.CalendarMonthID = l.CalendarMonthID
				LEFT JOIN(select ParentID from PAY.Loan) loan on loan.ParentID = l.LoanID
				LEFT JOIN HRM.OrganizationItem AS oi ON oi.OrganizationItemID = l.OrganizationItemID
				LEFT JOIN CFG.Party AS p1 ON p1.PartyID = oi.PartyID
				LEFT JOIN pay.vwPersonelLoanDebit AS vpld 
					ON (vpld.ItemType=1 AND vpld.Id=l.PaymentSubjectID)	OR  (vpld.ItemType=2 AND vpld.Id=l.DebitCreditNoteItemID) OR (vpld.ItemType=3 AND vpld.Id=l.PettyCashCostItemID)

			WHERE (
				(@Type = 1 and l.Type = 1)
				or  (@Type = 0 and l.Type in (2,3)))
				and (@UserID = -1 
				or  (@ViewRelatedToUser is not null   and l.Creator = @UserID)
				or  (@ViewRelatedToOthers IS NOT NULL AND l.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
		)
	)	
	'
	
	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
		SET @Filter = ''
	ELSE
		SET @Filter = 'Where (' + @Filter + ')'
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	SET @Query = Cfg.ApplyPaging (
			@tableName,
			@Query,
			@PageNumber,
			@RowspPage,
			@Filter,
			@Sort
		)
	--PRINT @Query
	
	EXECUTE sp_executesql @Query,
		 N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @Type bit, 
		 @UserID int,
		 @ViewRelatedToUser int
		 ',
		 @DateType = @DateType,
		 @Type = @Type,
		 @DateFormat = @DateFormat,
		 @ViewRelatedToUser = @ViewRelatedToUser,
		 @ViewRelatedToOthers = @ViewRelatedToOthers,
		 @UnauthorizedUsers = @UnauthorizedUsers,
		 @UserID = @UserID
	
	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
		 N'@count int out',
		 @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
END;
