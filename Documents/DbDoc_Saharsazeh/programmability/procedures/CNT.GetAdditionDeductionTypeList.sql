---------------------------------------------------[CNT].[GetAdditionDeductionTypeList]----------------------------
CREATE   PROCEDURE [CNT].[GetAdditionDeductionTypeList]
    (   @CompanyRoll INT = NULL ,
        @PageNumber INT ,
        @RowspPage INT ,
        @Sort NVARCHAR(MAX) = NULL ,
        @Filter NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
BEGIN
    
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
			@Culture VARCHAR(10) ,
            @ContractorViewRelatedToUser       INT,
	        @ContractorViewRelatedToOthers     INT,           
            @EmployerViewRelatedToUser         INT,
	        @EmployerViewRelatedToOthers       INT,
            @ContractorUnauthorizedUsers NVARCHAR(MAX),
            @EmployerUnauthorizedUsers NVARCHAR(MAX),
            @Addition NVARCHAR(500) ,
            @Deduction NVARCHAR(500) ,
            @Prepayment NVARCHAR(500) ,
            @OnAccount NVARCHAR(500) ,
            @GrossOperating NVARCHAR(500),
            @PreReceive NVARCHAR(500);

    SET @UserID = CFG.GetuserID();
	SET @Culture = CFG.GetuserCulture()

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                             ELSE 0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @Addition = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'AdditionDeductionType'
           AND L.Item = 'Addition'
           AND LV.Culture = @Culture;

    SELECT @Deduction = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'AdditionDeductionType'
           AND L.Item = 'Deduction'
           AND LV.Culture = @Culture;

    -- Prepayment localization 
    SELECT @Prepayment = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'IssueRequestSubjects'
           AND L.Item = 'Prepayment'
           AND LV.Culture = @Culture;

    -- Prepayment localization 
    SELECT @OnAccount = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'IssueRequestSubjects'
           AND L.Item = 'OnAccount'
           AND LV.Culture = @Culture;
    -- Prepayment localization 
    SELECT @GrossOperating = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'AdditionDeductionCriterion'
           AND L.Item = 'GrossOperating'
           AND LV.Culture = @Culture;
		   
    -- PreReceive localization 
    SELECT @PreReceive = LV.Value
    FROM   CFG.LocalizeEnum L
           JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE  L.Enum = 'AdditionDeductionCriterion'
           AND L.Item = 'PreReceive'
           AND LV.Culture = @Culture;
    
	SELECT @ContractorViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorAdditionDeductionType'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ContractorViewRelatedToOthers = UserID ,
           @ContractorUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorAdditionDeductionType'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    SELECT @EmployerViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerAdditionDeductionType'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @EmployerViewRelatedToOthers = UserID ,
           @EmployerUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerAdditionDeductionType'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'IsActive ';

    SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
    SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');

    DECLARE @Query NVARCHAR(MAX);
    SET @Query = '
	 WITH Query_Result 
			(
				AdditionDeductionTypeID ,
				IsActive ,
				Type  ,
				Title  ,
				Title2,
                CompanyRoll,
				Creator  ,
				CreationDate  ,
				LastEditor  ,
				LastEditionDate  ,
				Version  ,
				TypeString  ,
				CreatorUserName ,
				EditorName ,
				CreateDateString ,
				EditionDateString ,
				Criterion  ,
				CriterionString ,
				Payable 
			)
			As (
				SELECT  adt.AdditionDeductionTypeID ,
                        adt.IsActive ,
                        adt.Type ,
                        adt.Title ,
                        adt.Title2 ,
                        adt.CompanyRoll,
                        adt.Creator ,
                        adt.CreationDate ,
                        adt.LastEditor ,
                        adt.LastEditionDate ,
                        adt.Version ,
                        CAST(CASE WHEN adt.Type = 1 THEN @Addition
                                  WHEN adt.Type = 2 THEN @Deduction
                             END AS NVARCHAR(500)) TypeString ,
                        u.Name CreatorUserName ,
                        u2.Name EditorName ,
                        CFG.GetCLRSaturnDate(adt.CreationDate, @DateFormat, 1,
                                             @DateType) CreateDateString ,
                        CFG.GetCLRSaturnDate(adt.LastEditionDate, @DateFormat,
                                             1, @DateType) EditionDateString,
						adt.Criterion,
						CAST(CASE adt.Criterion 
							WHEN  1 THEN @GrossOperating 
							WHEN  2 THEN @Prepayment
							WHEN  3 THEN @OnAccount
							WHEN  4 THEN @PreReceive
						END AS NVARCHAR(500)) CriterionString,
						adt.Payable
                FROM    CNT.AdditionDeductionType adt
                        INNER JOIN CFG.[User] u ON u.UserID = adt.Creator
                        INNER JOIN CFG.[User] u2 ON u2.UserID = adt.LastEditor
                WHERE 	(@CompanyRoll IS NULL OR adt.CompanyRoll = @CompanyRoll) 
                        AND
                        (                
	                        (adt.CompanyRoll = 1 AND (@UserID = -1
		                        OR (@ContractorViewRelatedToUser IS NOT NULL AND adt.Creator = @UserID)
		                        OR (@ContractorViewRelatedToOthers IS NOT NULL AND adt.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ContractorUnauthorizedUsers) AS rfcst)))
	                        )
	                        OR
	                        (adt.CompanyRoll = 2 AND (@UserID = -1
		                        OR (@EmployerViewRelatedToUser IS NOT NULL AND adt.Creator = @UserID)
		                        OR (@EmployerViewRelatedToOthers IS NOT NULL AND adt.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@EmployerUnauthorizedUsers) AS rfcst)))
	                        )
                        )
			     )';



    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';

    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);

    SET @Query = CFG.ApplyPaging(
                     @tableName ,
                     @Query ,
                     @PageNumber ,
                     @RowspPage ,
                     @Filter ,
                     @Sort);

    EXECUTE sp_executesql @Query ,
                          N'
			@UserID INT ,
			@DateType TINYINT ,
			@DateFormat VARCHAR(10) ,
            @ContractorViewRelatedToUser       INT,
	        @ContractorViewRelatedToOthers     INT,
            @EmployerViewRelatedToUser         INT,
	        @EmployerViewRelatedToOthers       INT,
            @ContractorUnauthorizedUsers NVARCHAR(MAX) ,
            @EmployerUnauthorizedUsers NVARCHAR(MAX) ,
			@Addition NVARCHAR(500) ,
			@Deduction NVARCHAR(500) ,
			@Prepayment NVARCHAR(500) ,
			@OnAccount NVARCHAR(500) ,
            @CompanyRoll INT,
			@GrossOperating NVARCHAR(500),
			@PreReceive NVARCHAR(500)
	      ' ,
            @UserID = @UserID ,
            @DateType = @DateType ,
            @DateFormat = @DateFormat ,
            @ContractorViewRelatedToUser = @ContractorViewRelatedToUser ,
            @ContractorViewRelatedToOthers = @ContractorViewRelatedToOthers ,
            @EmployerViewRelatedToUser = @EmployerViewRelatedToUser ,
            @EmployerViewRelatedToOthers = @EmployerViewRelatedToOthers ,
            @ContractorUnauthorizedUsers =  @ContractorUnauthorizedUsers,
            @EmployerUnauthorizedUsers =  @EmployerUnauthorizedUsers,
            @Addition = @Addition ,
            @Deduction = @Deduction ,
            @Prepayment = @Prepayment ,
            @OnAccount = @OnAccount ,
            @CompanyRoll = @CompanyRoll,
            @GrossOperating = @GrossOperating,
			@PreReceive = @PreReceive;


    DECLARE @Count INT;

    EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query ,
                          N'@count int out' ,
                          @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);

END
