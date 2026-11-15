CREATE      PROC [REQ].[RptRequest_Requests]
    (
        @FromDate DATE = NULL ,
        @ToDate DATE = NULL ,
        @SelectedBranch VARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION 
AS
    DECLARE @StuffRequest NVARCHAR(100) ,
            @UnSubmited NVARCHAR(100) ,
            @Submited NVARCHAR(100) ,
            @Ended NVARCHAR(100) ,
            @Confirmed NVARCHAR(100) ,
            @Rejected NVARCHAR(100) ,
            @PurchaseRequest NVARCHAR(100) ,
            @ReturnRequest NVARCHAR(100) ,
            @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10) ,
            @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
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

    SELECT @StuffRequest = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'StuffRequest'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @UnSubmited = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RequestStates'
           AND le.Item = 'UnSubmitted'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Submited = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RequestStates'
           AND le.Item = 'Submitted'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Ended = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RequestStates'
           AND le.Item = 'Ended'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Confirmed = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RequestStates'
           AND le.Item = 'Confirmed'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @Rejected = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'RequestStates'
           AND le.Item = 'Rejected'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @PurchaseRequest = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'PurchaseRequest'
           AND lev.Culture = CFG.GetuserCulture();

    SELECT @ReturnRequest = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'DocumentNumTypes'
           AND le.Item = 'ReturnRequest'
           AND lev.Culture = CFG.GetuserCulture();




    SELECT 'S' + CAST(StuffRequestID AS VARCHAR(10)) AS RowIndex ,
           @StuffRequest AS [Type] ,
           StuffRequestNumber AS Number ,
		   SR.StuffRequestDate AS [Date],
           CFG.GetCLRSaturnDate(StuffRequestDate, @DateFormat, 0, @DateType) AS [Date_Date] ,
           CASE StuffRequestState
                WHEN 0 THEN @UnSubmited
                WHEN 1 THEN @Submited
                WHEN 2 THEN @Confirmed
                WHEN 3 THEN @Rejected
                WHEN 4 THEN @Ended
           END AS [State] ,
           SR.StuffRequestID AS RequestID ,
           u1.Name AS CreatorUserName ,
           u2.Name AS EditorName ,
		   SR.CreationDate,
		   SR.LastEditionDate,
           CFG.GetCLRSaturnDate(SR.CreationDate, @DateFormat, 1, @DateType) AS Date_CreateDate ,
           CFG.GetCLRSaturnDate(SR.LastEditionDate, @DateFormat, 1, @DateType) AS Date_LastEditionDate
    FROM   REQ.StuffRequest SR
           JOIN CFG.[User] u1 ON u1.UserID = SR.Creator
           JOIN CFG.[User] u2 ON u2.UserID = SR.LastEditor
			INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = sr.BranchID
			INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  sr.OrganizationUnitID
    WHERE  StuffRequestDate
           BETWEEN @FromDate AND @ToDate
           AND (   @SelectedBranch IS NULL
                   OR SR.BranchID IN (   SELECT value
                                         FROM   CFG.R_FnCommaStr2Table(
                                                    @SelectedBranch) ))
          
    UNION ALL
    SELECT 'P' + CAST(pr.PurchaseRequestID AS VARCHAR(10)) AS RowIndex ,
           @PurchaseRequest AS [Type] ,
           pr.PurchaseRequestNumber AS Number ,
		   pr.PurchaseRequestDate AS [Date],
           CFG.GetCLRSaturnDate(pr.PurchaseRequestDate, @DateFormat, 0, @DateType) AS [Date_Date] ,
           CASE pr.PurchaseRequestState
                WHEN 0 THEN @UnSubmited
                WHEN 1 THEN @Submited
                WHEN 2 THEN @Confirmed
                WHEN 3 THEN @Rejected
                WHEN 4 THEN @Ended
           END AS [State] ,
           pr.PurchaseRequestID AS RequestID ,
           u1.Name AS CreatorUserName ,
           u2.Name AS EditorName ,
		   pr.CreationDate,
		   pr.LastEditionDate,
           CFG.GetCLRSaturnDate(pr.CreationDate, @DateFormat, 1, @DateType) AS Date_CreationDate ,
           CFG.GetCLRSaturnDate(pr.LastEditionDate, @DateFormat, 1, @DateType) AS Date_LastEditionDate
    FROM   REQ.PurchaseRequest pr
           JOIN CFG.[User] u1 ON u1.UserID = pr.Creator
           JOIN CFG.[User] u2 ON u2.UserID = pr.LastEditor
			INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  pR.BranchID
			INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  pr.OrganizationUnitID
    WHERE  PurchaseRequestDate
           BETWEEN @FromDate AND @ToDate
           AND (   @SelectedBranch IS NULL
                   OR pr.BranchID IN (   SELECT value
                                      FROM   CFG.R_FnCommaStr2Table(
                                                 @SelectedBranch) ))
          
    UNION ALL
    SELECT 'R' + CAST(RR.ReturnRequestID AS VARCHAR(10)) AS RowIndex ,
           @ReturnRequest AS [Type] ,
           RR.ReturnRequestNumber AS Number ,
		   RR.ReturnRequestDate AS [Date],
           CFG.GetCLRSaturnDate(RR.ReturnRequestDate, @DateFormat, 0, @DateType) AS [Date_Date] ,
           CASE RR.ReturnRequestState
                WHEN 1 THEN @Submited
                WHEN 2 THEN @Confirmed
                WHEN 3 THEN @Rejected
                WHEN 4 THEN @Ended
                ELSE @UnSubmited
           END AS [State] ,
           RR.ReturnRequestID AS RequestID ,
           u1.Name AS CreatorUserName ,
           u2.Name AS EditorName ,
		   RR.CreationDate,
		   RR.LastEditionDate,
           CFG.GetCLRSaturnDate(RR.CreationDate, @DateFormat, 1, @DateType) AS Date_CreationDate ,
           CFG.GetCLRSaturnDate(RR.LastEditionDate, @DateFormat, 1, @DateType) AS Date_LastEditionDate
    FROM   REQ.ReturnRequest RR
           JOIN CFG.[User] u1 ON u1.UserID = RR.Creator
           JOIN CFG.[User] u2 ON u2.UserID = RR.LastEditor
			INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID =  rR.BranchID
			INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID =  rr.OrganizationUnitID
    WHERE  RR.ReturnRequestDate
           BETWEEN @FromDate AND @ToDate
           AND (   @SelectedBranch IS NULL
                   OR exists (   SELECT 1
                                         FROM   CFG.R_FnCommaStr2Table(
                                                    @SelectedBranch) where value =RR.BranchID ))
