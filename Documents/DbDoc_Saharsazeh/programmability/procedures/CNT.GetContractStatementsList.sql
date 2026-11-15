
---------------------------------------------------[CNT].GetContractStatementsList---------------------------------
CREATE   PROCEDURE [CNT].GetContractStatementsList
    (
        @financialPeriodID INT ,
        @CompanyRoll INT,
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
                @ContractorViewRelatedToUser INT ,
                @ContractorViewRelatedToOthers NVARCHAR(MAX),                
                @EmployerViewRelatedToUser INT ,
                @EmployerViewRelatedToOthers NVARCHAR(MAX),
                @ContractorUnauthorizedUsers NVARCHAR(MAX),
                @EmployerUnauthorizedUsers NVARCHAR(MAX),
				@CultureNo char(1)

        SET @UserID = CFG.GetuserID();

		SELECT @CultureNo = CultureNo
		FROM   CFG.CultureInfo
		WHERE  Culture = CFG.GetuserCulture();



        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;
        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
                                 WHEN 'fa' THEN 0
                                 WHEN 'en' THEN 1
                                 WHEN 'ar' THEN 2
                            END;

        SELECT @DateFormat = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @UserID;

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';

	    SELECT @ContractorViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ContractorContractStatement'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;

	    SELECT @ContractorViewRelatedToOthers = UserID ,
               @ContractorUnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'ContractorContractStatement'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;


        SELECT @EmployerViewRelatedToUser = UserID
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'EmployerContractStatement'
		      AND AccessKey = 'ViewRelatedToUser'
		      AND UserID = @UserID;

	    SELECT @EmployerViewRelatedToOthers = UserID ,
               @EmployerUnauthorizedUsers = Users
	    FROM CFG.vwOperationLevelAccess
	    WHERE EntityName = 'EmployerContractStatement'
		      AND AccessKey = 'ViewRelatedToOthers'
		      AND UserID = @UserID;

        IF @Sort IS NULL
           OR @Sort = ''
            SET @Sort = 'Number ';

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 
	

        DECLARE @Query NVARCHAR(MAX);
        SET @Query = '
	    WITH Query_Result 
			(
				FinancialPeriodID,
				ContractStatementID ,
				ContractStatementTypeID,
				ContractStatementTypeString,
				ContractID,
				Number,
				FromDate,
				EndDate,
				Creator,
				CreationDate ,
				LastEditor ,
				LastEditionDate,
				Version,
				Date_FromDate ,
				Date_EndDate,
				ContractTitle ,
				ContractNumber ,
				CreatorUserName ,
				CreateDateString,
				EditorName ,
				EditionDateString,
				StatementNumber,
				ContractDlCode ,
				IsNotInFlow	,
				IsLast,
				PartyCode ,
				PartyDlTitle,
				Date,
				Date_Date,
                BaseType,
                ContractStatementAnalysisID
			)
			As (
				 SELECT cs.FinancialPeriodID,
						cs.ContractStatementID ,
						cs.ContractStatementTypeID,
						CASE WHEN @CultureNo = 1 THEN cst.Title else cst.Title2 end,
                        cs.ContractID ,
                        cs.Number ,
                        cs.FromDate ,
                        cs.EndDate ,
                        cs.Creator ,
                        cs.CreationDate ,
                        cs.LastEditor ,
                        cs.LastEditionDate ,
                        cs.[Version] ,
                        CFG.GetCLRSaturnDate(cs.FromDate, @DateFormat, 0, @DateType) Date_FromDate ,
                        CFG.GetCLRSaturnDate(cs.EndDate, @DateFormat, 0,  @DateType) Date_EndDate ,
                        CASE WHEN @CultureNo = 1 THEN c.Title else c.Title end ContractTitle ,
                        c.Number ContractNumber ,
                        CASE WHEN @CultureNo = 1 THEN u.Name else u.Name2 end AS CreatorUserName ,
                        CFG.GetCLRSaturnDate(cs.CreationDate, @DateFormat, 0, @DateType) AS CreateDateString ,
                        CASE WHEN @CultureNo = 1 THEN u1.Name else u1.Name2 end AS EditorName ,
                        CFG.GetCLRSaturnDate(cs.LastEditionDate, @DateFormat, 0, @DateType) AS EditionDateString,
						cs.Number StatementNumber,
						d.Code ContractDlCode,                                                 
						CAST( CASE WHEN CNT.ContractStatementHasFlow(cs.ContractStatementID) = 0 THEN 1 ELSE 0 END  AS BIT) AS IsNotInFlow,
						CNT.IsLastContractStatement(cs.ContractStatementID)  IsLast,
						pd.Code AS PartyCode,
						CASE WHEN @CultureNo = 1 THEN pd.Title else pd.Title2 end as PartyTitle,
						cs.Date,
                        CFG.GetCLRSaturnDate(cs.Date, @DateFormat, 0,  @DateType) Date_Date,
                        cs.BaseType,
                        cs.ContractStatementAnalysisID
                FROM    CNT.ContractStatement cs
						join cnt.ContractStatementType cst on cs.ContractStatementTypeID = cst.ContractStatementTypeID
                        INNER JOIN CNT.[Contract] c ON c.ContractID = cs.ContractID		
						INNER JOIN  #vwBranchAccess Branch on Branch.BranchID = c.BranchID
						JOIN CFG.Party AS p ON p.PartyID = cs.PartyID
						JOIN ACC.DL AS pd ON pd.DLID = p.DlID
                        INNER JOIN CFG.[User] u ON u.UserID = cs.Creator
                        INNER JOIN CFG.[User] u1 ON u1.UserID = cs.LastEditor
						INNER JOIN ACC.DL d ON d.DLID = c.DLID
                WHERE  cs.FinancialPeriodID = @financialPeriodID AND c.CompanyRoll = @CompanyRoll
					    AND 
                        (                
	                        (c.CompanyRoll = 1 AND (@UserID = -1
		                        OR (@ContractorViewRelatedToUser IS NOT NULL AND cs.Creator = @UserID)
		                        OR (@ContractorViewRelatedToOthers IS NOT NULL AND cs.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ContractorUnauthorizedUsers) AS rfcst)))
	                        )
	                        OR
	                        (c.CompanyRoll = 2 AND (@UserID = -1
		                        OR (@EmployerViewRelatedToUser IS NOT NULL AND cs.Creator = @UserID)
		                        OR (@EmployerViewRelatedToOthers IS NOT NULL AND cs.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@EmployerUnauthorizedUsers) AS rfcst)))
	                        )
                        )
			)
	    ';

        DECLARE @selectQuery NVARCHAR(MAX);

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
        --PRINT @Query

        EXECUTE sp_executesql @Query ,
        N'
		@UserID INT ,
        @DateType TINYINT ,
        @DateFormat VARCHAR(10) ,
        @ContractorViewRelatedToUser INT ,
		@ContractorViewRelatedToOthers NVARCHAR(MAX),      
		@EmployerViewRelatedToUser INT ,
		@EmployerViewRelatedToOthers NVARCHAR(MAX),
		@ContractorUnauthorizedUsers NVARCHAR(MAX) ,
		@EmployerUnauthorizedUsers NVARCHAR(MAX) ,
		@financialPeriodID  INT,
        @CompanyRoll INT, 
		@CultureNo char(1)' ,
        @financialPeriodID = @financialPeriodID ,
        @UserID = @UserID ,
        @DateType = @DateType ,
        @DateFormat = @DateFormat ,
        @ContractorViewRelatedToOthers = @ContractorViewRelatedToOthers,
        @ContractorViewRelatedToUser = @ContractorViewRelatedToUser,
        @EmployerViewRelatedToOthers = @EmployerViewRelatedToOthers,
        @EmployerViewRelatedToUser = @EmployerViewRelatedToUser,
        @ContractorUnauthorizedUsers = @ContractorUnauthorizedUsers,
        @EmployerUnauthorizedUsers = @EmployerUnauthorizedUsers,
        @CompanyRoll = @CompanyRoll,
		@CultureNo = @CultureNo;

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);

    END;
