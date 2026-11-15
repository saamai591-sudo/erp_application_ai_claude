
---------------------------------------------------[CNT].GetContractsList------------------------------------------
CREATE   PROCEDURE [CNT].GetContractsList
(
    @CompanyRoll TINYINT,
    @Type TINYINT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    -- declare properties Here
    DECLARE @Employer NVARCHAR(250),
            @Contractor NVARCHAR(250),
            @EndOfMonth NVARCHAR(250),
            @EndOfPhase NVARCHAR(250),
            @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @ContractorContractDefinitionViewRelatedToUser INT,
            @ContractorContractDefinitionViewRelatedToOthers INT, 
            @EmployerContractDefinitionViewRelatedToUser INT, 
            @EmployerContractDefinitionViewRelatedToOthers INT, 
            @ContractorContractComplementViewRelatedToUser INT, 
            @ContractorContractComplementViewRelatedToOthers INT, 
            @EmployerContractComplementViewRelatedToUser INT, 
            @EmployerContractComplementViewRelatedToOthers INT,
            @clture VARCHAR(10),
            @confirm NVARCHAR(MAX),
            @Ended NVARCHAR(MAX),
            @Submit NVARCHAR(MAX),
            @ContractorContractDefinitionUnauthorizedUsers NVARCHAR(MAX),
            @EmployerContractDefinitionUnauthorizedUsers NVARCHAR(MAX),
            @ContractorContractComplementUnauthorizedUsers NVARCHAR(MAX),
            @EmployerContractComplementUnauthorizedUsers NVARCHAR(MAX);


    SET @UserID = CFG.GetuserID();
    SET @clture = CFG.GetuserCulture();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;
    IF @DateType IS NULL
        SET @DateType = CASE @clture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @Employer = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'CompanyRolls'
          AND L.Item = 'Employer'
          AND LV.Culture = @clture;

    SELECT @Contractor = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'CompanyRolls'
          AND L.Item = 'Contractor'
          AND LV.Culture = @clture;

    SELECT @EndOfMonth = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StatementDeliverySections'
          AND L.Item = 'EndOfMonth'
          AND LV.Culture = @clture;

    SELECT @EndOfPhase = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'StatementDeliverySections'
          AND L.Item = 'EndOfPhase'
          AND LV.Culture = @clture;


    SELECT @Submit = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'Statuses'
          AND L.Item = 'Submit'
          AND LV.Culture = @clture;

    SELECT @confirm = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'Statuses'
          AND L.Item = 'Confirmed'
          AND LV.Culture = @clture;

          
    SELECT @Ended = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'VendorStatus'
          AND L.Item = 'Ended'
          AND LV.Culture = @clture;
          
	SELECT @ContractorContractDefinitionViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractDefinition'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ContractorContractDefinitionViewRelatedToOthers = UserID ,
           @ContractorContractDefinitionUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractDefinition'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	SELECT @EmployerContractDefinitionViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractDefinition'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @EmployerContractDefinitionViewRelatedToOthers = UserID ,
           @EmployerContractDefinitionUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractDefinition'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	SELECT @ContractorContractComplementViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractComplement'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ContractorContractComplementViewRelatedToOthers = UserID ,
           @ContractorContractComplementUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractComplement'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

	SELECT @EmployerContractComplementViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractComplement'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @EmployerContractComplementViewRelatedToOthers = UserID ,
           @EmployerContractComplementUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractComplement'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;


    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';
        
        SELECT * INTO #vwBranchAccess 
        FROM cfg.vwBranchAccess AS vba

    DECLARE @Query NVARCHAR(MAX);
    SET @Query
        = N'
 		WITH Query_Result 
		(
			  ContractID ,
			  [Type],
			  ParentID,
			  CompanyRoll ,
			  CompanyRollTitle,
			  ContractTypeID ,
			  ContractTypeTitle,
			  ContractTypeTitle2,
			  Number,
			  [Date],
			  Date_Date,
			  Title,
			  Title2,
			  TenderID ,
			  TenderTitle,
			  TenderTitle2,
			  BranchID ,
			  BranchTitle,
			  BranchTitle2,
			  PartyID ,
			  PartyTitle,
			  PartyTitle2,
			  CustomerCode,
			  DLID ,
			  DlTitle,
			  DlTitle2,
			  DlCode,
			  Life,
			  StartDate,
			  Date_StartDate,
			  EndDate,
			  Date_EndDate,
			  StatementDeliverySection ,
			  StatementDeliverySectionTitle,
			  Creator ,
			  CreatorUserName,
			  CreationDate,
			  CreateDateString,
			  LastEditor ,
			  EditorName,
			  LastEditionDate,
			  EditionDateString,
			  Version,
			  IsNotInFlow,
			  IsActive,
			  ParentNumber,
			  Status,
			  StatusString,
              BaseType
		)
		as
		(
			 SELECT  c.ContractID ,
						c.[Type],
						c.ParentID,
                        c.CompanyRoll ,
                        CAST (CASE WHEN c.CompanyRoll = 1 THEN @Employer
                                   WHEN c.CompanyRoll = 2 THEN @Contractor
                              END AS NVARCHAR(512)) AS CompanyRollTitle ,
                        c.ContractTypeID ,
                        ct.Title ContractTypeTitle ,
                        ct.Title2 ContractTypeTitle2 ,
                        c.Number ,
                        c.[Date] ,
                        CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date_Date ,
                        c.Title ,
                        c.Title2 ,
                        c.TenderID ,
                        t.Title TenderTitle ,
                        t.Title2 TenderTitle2 ,
                        c.BranchID ,
                        b.Title BranchTitle ,
                        b.Title2 BranchTitle2 ,
                        c.PartyID ,
                        ISNULL(p.Title,'''') +'' ''+ ISNULL( p.LastName,'''') PartyTitle ,
                        ISNULL(p.Title2,'''') +'' ''+ ISNULL( p.LastName2,'''') PartyTitle2 ,
                        d1.Code CustomerCode ,
                        c.DLID ,
                        CASE c.Type WHEN  1 THEN  d.Title ELSE d2.Title END  DlTitle ,
                        CASE c.Type WHEN  1 THEN  d.Title2 ELSE d2.Title2 END DlTitle2 ,
                       CASE c.Type WHEN  1 THEN  d.Code ELSE d2.Code END  DlCode ,
                        c.Life ,
                        c.StartDate ,
                        CFG.GetCLRSaturnDate(c.StartDate, @DateFormat, 0, @DateType) Date_StartDate ,
                        c.EndDate ,
                        CFG.GetCLRSaturnDate(c.EndDate, @DateFormat, 0, @DateType) Date_EndDate ,
                        c.StatementDeliverySection ,
                        CAST (CASE WHEN c.StatementDeliverySection = 1
                                   THEN @EndOfPhase
                                   WHEN c.StatementDeliverySection = 2
                                   THEN @EndOfMonth
                              END AS NVARCHAR(512)) AS StatementDeliverySectionTitle ,
                        c.Creator ,
                        u1.Name AS CreatorUserName ,
                        c.CreationDate ,
                        CFG.GetCLRSaturnDate(c.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString ,
                        c.LastEditor ,
                        u2.Name AS EditorName ,
                        c.LastEditionDate ,
                        CFG.GetCLRSaturnDate(c.LastEditionDate, @DateFormat, 1,  @DateType) AS EditionDateString ,
                        c.Version,
						CAST( CASE WHEN CNT.ContractHasFlow(c.ContractID) = 0
					   THEN 1 ELSE 0 END  AS BIT) AS IsNotInFlow,
					   CNT.ContractIsActive(c.ContractID) IsActive,
					   c2.number as ParentNumber,
					   c.Status,
					   CASE c.Status
							WHEN 1 THEN @Submit
							WHEN 2 THEN @Confirm 
							WHEN 3 THEN @Ended 
                            END 
					   AS StatusString,
                       c.BaseType
                FROM    CNT.Contract c
                        INNER JOIN CNT.ContractType ct ON ct.ContractTypeID = c.ContractTypeID
                        LEFT JOIN VND.Tender t ON t.TenderID = c.TenderID
                        INNER JOIN CFG.Branch b ON b.BranchID = c.BranchID
                        INNER JOIN CFG.Party p ON p.PartyID = c.PartyID
						LEFT JOIN ACC.DL d1 ON d1.DLID = p.DlID
                        LEFT JOIN ACC.DL d ON d.DLID = c.DLID
                        INNER JOIN CFG.[User] u1 ON u1.UserID = c.Creator
                        INNER JOIN CFG.[User] u2 ON u2.UserID = c.LastEditor
						LEFT JOIN CNT.[Contract] AS c2 ON c2.ContractID = c.ParentID
						LEFT JOIN ACC.DL AS d2 ON d2.DLID = c2.DLID
						INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = c.BranchID
                WHERE c.type= @type AND c.CompanyRoll = @CompanyRoll

                      AND 
                      (
                          (c.CompanyRoll = 1 AND c.type = 1 AND (@UserID = -1
                            OR ( @ContractorContractDefinitionViewRelatedToUser IS NOT NULL AND c.Creator = @UserID )
                            OR ( @ContractorContractDefinitionViewRelatedToOthers IS NOT NULL AND c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ContractorContractDefinitionUnauthorizedUsers) AS rfcst)))
                          )
                          OR
                          (c.CompanyRoll = 2 AND c.type = 1 AND (@UserID = -1
                            OR ( @EmployerContractDefinitionViewRelatedToUser IS NOT NULL AND c.Creator = @UserID )
                            OR ( @EmployerContractDefinitionViewRelatedToOthers IS NOT NULL AND c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@EmployerContractDefinitionUnauthorizedUsers) AS rfcst)))
                          )
                          OR
                          (c.CompanyRoll = 1 AND c.type = 2 AND (@UserID = -1
                            OR ( @ContractorContractComplementViewRelatedToUser IS NOT NULL AND c.Creator = @UserID )
                            OR ( @ContractorContractComplementViewRelatedToOthers IS NOT NULL AND c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ContractorContractComplementUnauthorizedUsers) AS rfcst)))
                          )
                          OR
                          (c.CompanyRoll = 2 AND c.type = 2 AND (@UserID = -1
                            OR ( @EmployerContractComplementViewRelatedToUser IS NOT NULL AND c.Creator = @UserID )
                            OR ( @EmployerContractComplementViewRelatedToOthers IS NOT NULL AND c.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@EmployerContractComplementUnauthorizedUsers) AS rfcst)))
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
     
    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
    --PRINT @Query

    EXECUTE sp_executesql @Query,N'
			@Employer			    NVARCHAR(250) ,
            @Contractor			    NVARCHAR(250) ,
            @EndOfMonth			    NVARCHAR(250) ,
            @EndOfPhase			    NVARCHAR(250) ,
            @Submit			        NVARCHAR(250) ,
            @confirm			    NVARCHAR(250) ,
            @Ended                  NVARCHAR(MAX),
            @UserID				    INT ,
            @DateType			    TINYINT ,
            @DateFormat			    VARCHAR(10) ,
            @ContractorContractDefinitionViewRelatedToUser     INT,
            @ContractorContractDefinitionViewRelatedToOthers   INT, 
            @EmployerContractDefinitionViewRelatedToUser       INT, 
            @EmployerContractDefinitionViewRelatedToOthers     INT, 
            @ContractorContractComplementViewRelatedToUser     INT, 
            @ContractorContractComplementViewRelatedToOthers   INT, 
            @EmployerContractComplementViewRelatedToUser       INT, 
            @EmployerContractComplementViewRelatedToOthers     INT,
            @ContractorContractDefinitionUnauthorizedUsers     NVARCHAR(MAX),
            @EmployerContractDefinitionUnauthorizedUsers       NVARCHAR(MAX),
            @ContractorContractComplementUnauthorizedUsers     NVARCHAR(MAX),
            @EmployerContractComplementUnauthorizedUsers       NVARCHAR(MAX),
			@Type                   TINYINT,
            @CompanyRoll            TINYINT
	',
            @Employer = @Employer,
            @Contractor = @Contractor,
            @EndOfMonth = @EndOfMonth,
            @EndOfPhase = @EndOfPhase,
			@confirm = @confirm,
			@Submit = @Submit,
            @UserID = @UserID,
            @DateType = @DateType,
            @DateFormat = @DateFormat,
            @ContractorContractDefinitionViewRelatedToUser = @ContractorContractDefinitionViewRelatedToUser,
            @ContractorContractDefinitionViewRelatedToOthers = @ContractorContractDefinitionViewRelatedToOthers, 
            @EmployerContractDefinitionViewRelatedToUser = @EmployerContractDefinitionViewRelatedToUser, 
            @EmployerContractDefinitionViewRelatedToOthers = @EmployerContractDefinitionViewRelatedToOthers, 
            @ContractorContractComplementViewRelatedToUser = @ContractorContractComplementViewRelatedToUser, 
            @ContractorContractComplementViewRelatedToOthers = @ContractorContractComplementViewRelatedToOthers, 
            @EmployerContractComplementViewRelatedToUser = @EmployerContractComplementViewRelatedToUser, 
            @EmployerContractComplementViewRelatedToOthers = @EmployerContractComplementViewRelatedToOthers,

            @ContractorContractDefinitionUnauthorizedUsers = @ContractorContractDefinitionUnauthorizedUsers,
            @EmployerContractDefinitionUnauthorizedUsers = @EmployerContractDefinitionUnauthorizedUsers,
            @ContractorContractComplementUnauthorizedUsers = @ContractorContractComplementUnauthorizedUsers,
            @EmployerContractComplementUnauthorizedUsers = @EmployerContractComplementUnauthorizedUsers,

            @Ended= @Ended,
            @Type = @Type,
            @CompanyRoll = @CompanyRoll;

    DECLARE @Count INT;

    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;
