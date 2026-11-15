-------------------------------------
CREATE   PROCEDURE [PAY].GetPayPreparingList
(
    @PageNumber     INT,
    @RowspPage      INT,
    @Sort           NVARCHAR(MAX) = NULL,
    @Filter         NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Culture                 NVARCHAR(20),
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
			@ViewRelatedToUserID int,
			@cultureNo INT,
			@ViewRelatedToOthersID int,
            @UnauthorizedUsers NVARCHAR(MAX);

	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'CreationDate Desc'
	
	SET @UserID = cfg.GetuserID()	
	SET @Culture =  CFG.GetuserCulture()
	
    SELECT @cultureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = @Culture

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
		
	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'PayPreparing'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'PayPreparing'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;
		  
		  SELECT * into #vwPayPreparingRemain
		  FROM  pay.vwPayPreparingRemain AS vppr
		  

	DECLARE @Query NVARCHAR(MAX)
	
	SET @Query = 
	    '     
		select PayPreparingID
		into #Used
		from fin.PaymentSubject
		where PayPreparingID is not null
		group by PayPreparingID

		select PayPreparingID,sum(Value) Value
		into #PayPreparingItem
		from PAY.PayPreparingItem
		group by PayPreparingID

						;WITH Query_Result
							 AS
							 (
						SELECT       
								a.PayPreparingID, 
								a.Number,
								a.BranchID, 
								c.Code BranchCode,
								case when @cultureNo = 1 then c.Title else c.Title2 end BranchTitle,
								a.CalendarMonthID, 
								e.[Year] CalendarYear,
								d.[MonthName] CalendarMonthName,
								a.PayrollPaymentTypeID, 
								case when @cultureNo = 1 then f.Title else f.Title2 end PayrollPaymentTypeTitle,
								a.OrganizationItemID, 
								case when @cultureNo = 1 then i.Title else i.Title2 end OrganizationTitle,
								a.Version, 
								a.Creator, 
								j.Name CreatorUserName,
								a.CreationDate, 
								CFG.GetCLRSaturnDate(a.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
								a.LastEditor, 
								k.Name EditorName,
								a.LastEditionDate,
								CFG.GetCLRSaturnDate(a.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
								f.Type PaymentType,
								f.OrganizationId,
								cast(case when l.PayPreparingID is not null then 0 else 1 end as bit) IsNotInFlow,
								cast(case when vppr.Remain=0 then 1 else 0 end as bit) IsSetteled,
								b.Value + IsNull(a.PaymentRound,0) Total,
								a.PaymentRound
						FROM   PAY.PayPreparing AS a 
						Inner join #vwPayPreparingRemain vppr on a.PayPreparingID = vppr.PayPreparingID
							INNER JOIN #PayPreparingItem AS b ON a.PayPreparingID = b.PayPreparingID
							INNER JOIN CFG.Branch c on c.BranchID = a.BranchID
							INNER JOIN hrm.CalendarMonth d on d.CalendarMonthID = a.CalendarMonthID
							INNER JOIN  hrm.Calendar e on e.CalendarID = d.CalendarID
							INNER JOIN pay.PayrollPaymentType f on f.PayrollPaymentTypeID = a.PayrollPaymentTypeID
							LEFT JOIN  hrm.OrganizationItem g on g.OrganizationItemID = a.OrganizationItemID
							LEFT JOIN  cfg.Party h on h.PartyID = g.PartyID
							LEFT JOIN  acc.dl i on i.DLID = h.DlID
							INNER JOIN cfg.[user] j on j.UserID = a.Creator
							INNER JOIN cfg.[user] k on k.UserID = a.LastEditor
							INNER JOIN cfg.vwBranchAccess vba on a.BranchID=vba.BranchID
							LEFT JOIN  #Used l on l.PayPreparingID = a.PayPreparingID
						WHERE (
							@UserID = -1
							OR (@ViewRelatedToUser IS NOT NULL AND a.Creator = @UserID)
							OR ( @ViewRelatedToOthers IS NOT NULL AND a.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst) )
						)
		 )'

	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = N'Where (' + @Filter + ')'
	
	
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
	
	EXECUTE sp_executesql @Query,
	     N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @UserID int,
		 @ViewRelatedToUser int,
		 @cultureNo int
		 ',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @UserID = @UserID,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
		 @cultureNo = @cultureNo

	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
END
