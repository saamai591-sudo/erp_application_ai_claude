
-------------------------------------------------------
CREATE   PROCEDURE HRM.GetAgreementList
(
    @PageNumber     INT,
    @RowspPage      INT,
    @Sort           NVARCHAR(MAX) = NULL,
    @Filter         NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @AgreementHasCal         INT,
	        @Employment              NVARCHAR(50),
	        @EditAgreement           NVARCHAR(50),
	        @Submit                  NVARCHAR(20),
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @Confirm                 NVARCHAR(20),
			@CultureInfo  VARCHAR(10),
			@CultureNo VARCHAR(10),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID =  cfg.GetuserID()
	set @CultureInfo = cfg.GetuserCulture()

	select @CultureNo = CultureNo 
	from cfg.CultureInfo
	where Culture = @CultureInfo	

	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'IssueDate Desc'
		
	DECLARE @NeedConfirm BIT
	
	SELECT @NeedConfirm = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'AgreementNeedConfirm'
	
	
	SELECT @Submit = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Submit'
	       AND LV.Culture = @CultureInfo
	
	SELECT @Confirm = LV.Value
	FROM   cfg.LocalizeEnum L
	       JOIN cfg.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'Statuses'
	       AND L.Item = 'Confirmed'
	       AND LV.Culture = @CultureInfo

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @CultureInfo
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
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName  = 'Agreement'
		   AND AccessKey = 'ViewRelatedToUser'
	       AND UserID         = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName  = 'Agreement'
		   AND AccessKey = 'ViewRelatedToOthers'
	       AND UserID         = @UserID
	
	SELECT * INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess AS vba	
		
	DECLARE @Query NVARCHAR(MAX)
	
	SET @Query = 
	    '
		;WITH Query_Result
		 AS
     (SELECT    a.AgreementID,
                a.Number,
				a.ConfirmDate,
				a.IssueDate,
				a.ExecuteDate,
				a.EmploymentDate,
				a.[ExpireDate],
				CASE  WHEN @NeedConfirm = 0 THEN NULL
					  ELSE CFG.GetCLRSaturnDate(a.ConfirmDate, @DateFormat, 0, @DateType)
				END AS Date_ConfirmDate,
                CFG.GetCLRSaturnDate(a.IssueDate, @DateFormat, 0, @DateType) AS Date_IssueDate,
                CFG.GetCLRSaturnDate(a.EmploymentDate, @DateFormat, 0, @DateType) AS Date_EmploymentDate,
                CFG.GetCLRSaturnDate(a.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
                CFG.GetCLRSaturnDate(a.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
				CFG.GetCLRSaturnDate(a.ExecuteDate, @DateFormat, 0, @DateType) AS Date_ExecuteDate,
				CFG.GetCLRSaturnDate(a.[ExpireDate], @DateFormat, 0, @DateType) AS Date_ExpireDate,
                u.Name   AS CreatorUserName,
                u2.Name  AS EditorName,
				case when @CultureNo = 1 then 
						  pa.Title + '' '' + ISNULL(pa.LastName, '''')
					 else 
						  pa.Title2 + '' '' + ISNULL(pa.LastName2, '''') end AS FullName,
                p.Code AS PersonalCode,
                CASE WHEN ConfirmDate IS NOT NULL AND @NeedConfirm = 1 THEN u3.Name ELSE '''' END AS ConfirmerString,
				CASE when @CultureNo = 1 then e.Title else e.Title2 end AS EmploymentTypeTitle,
				CASE when @CultureNo = 1 then at.Title else at.Title2 end AS AgreementTypeTitle,
				CASE WHEN ConfirmDate IS NULL OR @NeedConfirm = 0 THEN @Submit ELSE @Confirm END AS StateString,
				a.Serial,
				CASE when @CultureNo = 1 then b.Title else b.Title2 end AS BranchTitle,
				a.Version,
				a.CreationDate,
				a.LastEditor,
				a.LastEditionDate
         FROM HRM.Agreement a
			 INNER JOIN HRM.Personel P ON A.PersonelID = P.PersonelID
			 INNER JOIN CFG.[Party]AS pa ON pa.PartyID = P.PartyID 
			 INNER JOIN CFG.[User] AS u ON u.UserID = a.Creator 
			 INNER JOIN CFG.[User] AS u2 ON u2.UserID = a.LastEditor
			 INNER JOIN HRM.EmploymentType e ON a.EmploymentTypeID = e.EmploymentTypeID
			 INNER JOIN Hrm.AgreementType at ON at.AgreementTypeID = a.AgreementTypeID
			 LEFT JOIN CFG.[User] AS u3 ON u3.UserID = a.ConfirmedBy
			 LEFT JOIN CFG.Branch b on b.BranchID=a.BranchID
			 INNER join #vwBranchAccess  rl on  rl.BranchID = a.branchid 
         WHERE (
             @UserID = -1
             OR (@ViewRelatedToUser IS NOT NULL AND a.Creator = @UserID)
             OR (@ViewRelatedToOthers IS NOT NULL AND a.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)  )
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
	
	--PRINT @Query
	
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
	     N'@dateFormat varchar(10),
		   @dateType int,
		   @needConfirm bit,
		   @submit nvarchar(100),
		   @ViewRelatedToOthers NVARCHAR(MAX),
		   @UnauthorizedUsers NVARCHAR(MAX),
		   @Confirm nvarchar(100),
		   @UserID int,
		   @ViewRelatedToUser int,
		   @CultureNo varchar(10)',
	       @DateType = @DateType,
	       @DateFormat = @DateFormat,
	       @NeedConfirm = @NeedConfirm,
	       @Submit = @Submit,
	       @ViewRelatedToUser = @ViewRelatedToUser,
	       @Confirm = @Confirm,
	       @UserID = @UserID,
	       @ViewRelatedToOthers = @ViewRelatedToOthers,
	       @UnauthorizedUsers = @UnauthorizedUsers,
		   @CultureNo = @CultureNo

	DECLARE @Count INT
	
	EXEC ('select * from ' + @tableName + ' ORDER BY _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
