
CREATE   PROC CNT.SpContractorsContractInfo
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @Culture VARCHAR(10),
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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



    BEGIN --Translation
        DECLARE @Submit NVARCHAR(MAX),
                @Confirm NVARCHAR(MAX),
                @Contract NVARCHAR(MAX),
                @Protocol NVARCHAR(MAX),
                @Consortium NVARCHAR(MAX),
                @ManagementContracting NVARCHAR(MAX),
                @EndOfPhase NVARCHAR(MAX),
                @EndOfMonth NVARCHAR(MAX);

        SELECT @Submit = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractStatus'
              AND le.Item = 'Submit'
              AND lev.Culture = @Culture;

        SELECT @Confirm = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractStatus'
              AND le.Item = 'Confirm'
              AND lev.Culture = @Culture;

        SELECT @Contract = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractNature'
              AND le.Item = 'Contract'
              AND lev.Culture = @Culture;

        SELECT @Protocol = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractNature'
              AND le.Item = 'Protocol'
              AND lev.Culture = @Culture;

        SELECT @Consortium = N'''' + lev.Value + N''''
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractNature'
              AND le.Item = 'Consortium'
              AND lev.Culture = @Culture;

        SELECT @ManagementContracting = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'ContractNature'
              AND le.Item = 'ManagementContracting'
              AND lev.Culture = @Culture;

        SELECT @EndOfPhase = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'statementDeliverySections'
              AND le.Item = 'EndOfPhase'
              AND lev.Culture = @Culture;

        SELECT @EndOfMonth = lev.Value
        FROM CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev
                ON lev.LocalizeEnumID = le.LocalizeEnumID
        WHERE le.Enum = 'statementDeliverySections'
              AND le.Item = 'EndOfMonth'
              AND lev.Culture = @Culture;

    END;

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

    SELECT c.ContractID,
           CASE
               WHEN c.ContractNature = 1 THEN
                   @Contract
               WHEN c.ContractNature = 2 THEN
                   @Protocol
               WHEN c.ContractNature = 3 THEN
                   @Consortium
               WHEN c.ContractNature = 4 THEN
                   @ManagementContracting
           END ContractNature,
           CASE
               WHEN c.Status = 1 THEN
                   @Submit
               WHEN c.Status = 2 THEN
                   @Confirm
           END Status,
           CASE
               WHEN @CultureNo = 1 THEN
                   ct.Title
               ELSE
                   ct.Title2
           END ContractType,
           DL.Code ContractDlCode,
           c.Number,
           CASE
               WHEN @CultureNo = 1 THEN
                   c.Title
               ELSE
                   c.Title2
           END ContractTitle,
           dl1.Code PartyDlCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   dl1.Title
               ELSE
                   dl1.Title2
           END PartyDlTitle,
           b.Code BranchCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   b.Title
               ELSE
                   b.Title2
           END BranchTitle,
           CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) Date_Date,
           c.Date,
           CFG.GetCLRSaturnDate(c.StartDate, @DateFormat, 0, @DateType) Date_StartDate,
           c.StartDate,
           CASE
               WHEN Amendment.ParentID IS NULL THEN
                   c.Life
               ELSE
                   Amendment.Life
           END Life,
           CASE
               WHEN Amendment.ParentID IS NULL THEN
                   c.EndDate
               ELSE
                   Amendment.EndDate
           END AS EndDate,
           CFG.GetCLRSaturnDate(   CASE
                                       WHEN Amendment.ParentID IS NULL THEN
                                           c.EndDate
                                       ELSE
                                           Amendment.EndDate
                                   END,
                                   @DateFormat,
                                   0,
                                   @DateType
                               ) Date_EndDate,
           CASE
               WHEN c.StatementDeliverySection = 1 THEN
                   @EndOfPhase
               WHEN c.StatementDeliverySection = 2 THEN
                   @EndOfMonth
           END StatementDeliverySection
    FROM CNT.Contract c
        INNER JOIN CNT.ContractType ct
            ON c.ContractTypeID = ct.ContractTypeID
        INNER JOIN ACC.DL
            ON DL.DLID = c.DLID
        INNER JOIN CFG.Party p
            ON p.PartyID = c.PartyID
        INNER JOIN ACC.DL dl1
            ON dl1.DLID = p.DlID
        INNER JOIN CFG.Branch b
            ON b.BranchID = c.BranchID
        JOIN  #vwBranchAccess Branch on Branch.BranchID = C.BranchID
        LEFT JOIN
        (
            SELECT ROW_NUMBER() OVER (PARTITION BY ParentID ORDER BY Date DESC) Rno,
                   ParentID,
                   Life,
                   EndDate
            FROM CNT.Contract
            WHERE ParentID IS NOT NULL
        ) Amendment
            ON Amendment.Rno = 1
               AND Amendment.ParentID = c.ContractID
    WHERE c.CompanyRoll = 1 AND c.ParentID IS NULL;


END;

