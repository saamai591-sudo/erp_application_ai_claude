CREATE PROC CNT.SpContractorsContractAmendment
(@SelectedContracts NVARCHAR(MAX) = NULL)
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @Culture VARCHAR(10),
            @DateFormat VARCHAR(10);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

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
                            ELSE
                                0
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    BEGIN --Translation
        DECLARE @Submit NVARCHAR(MAX),
                @Confirm NVARCHAR(MAX);

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

    END;

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

    SELECT c.ContractID,
           p.Number ContractNumber,
           c.Number AmendmentNumber,
           c.[Date],
           CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) Date_Date,
           c.StartDate,
           CFG.GetCLRSaturnDate(c.StartDate, @DateFormat, 0, @DateType) Date_StartDate,
           c.Life,
           c.EndDate,
           CFG.GetCLRSaturnDate(c.EndDate, @DateFormat, 0, @DateType) Date_EndDate,
           CASE
               WHEN c.Status = 1 THEN
                   @Submit
               WHEN c.Status = 2 THEN
                   @Confirm
               ELSE
                   ''
           END Status
    FROM CNT.Contract c
    JOIN CNT.Contract p
        ON p.ContractID = c.ParentID
    JOIN  #vwBranchAccess Branch on Branch.BranchID = C.BranchID
    WHERE c.ParentID IS NOT NULL
          AND c.CompanyRoll = 1
          AND
          (
              @SelectedContracts IS NULL
              OR c.ParentID IN
                 (
                     SELECT value FROM CFG.R_FnCommaStr2Table(@SelectedContracts)
                 )
          );
END;
