
------------------------------------- START #7534
CREATE   PROCEDURE [VND].GetTenderCommissionItems @TenderCommissionId INT
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers INT,
            @UnauthorizedUsers NVARCHAR(MAX);

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
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @ViewRelatedToUser = UserID
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'TenderCommission'
          AND AccessKey = 'ViewRelatedToUser'
          AND UserID = @UserID;

    SELECT @ViewRelatedToOthers = UserID,
           @UnauthorizedUsers = Users
    FROM CFG.vwOperationLevelAccess
    WHERE EntityName = 'TenderCommission'
          AND AccessKey = 'ViewRelatedToOthers'
          AND UserID = @UserID;

    SELECT tci.TenderCommissionItemID,
           tci.TenderCommissionID,
           tci.RowIndex,
           tci.PartyID,
           PartyName = d.Title,
           PartyCode = d.Code,
           tci.Amount,
           tci.Creator,
           tci.CreationDate,
           tci.LastEditor,
           tci.LastEditionDate,
           tci.Version,
           case WHEN c.TenderID is NULL THEN 0 ELSE   c.Score END AS Score 
    FROM VND.TenderCommissionItem tci
        INNER JOIN VND.TenderCommission tc
            ON tc.TenderCommissionID = tci.TenderCommissionID
        INNER JOIN CFG.Party p
            ON p.PartyID = tci.PartyID
        INNER JOIN ACC.DL AS d
            ON d.DLID = p.DlID
        LEFT JOIN
        (
            SELECT a.TenderID,
                   b.PartyID,
                   b.Score
            FROM VND.FinalEvaluation a
                JOIN VND.FinalEvaluationItem b
                    ON a.FinalEvaluationID = b.FinalEvaluationID
        ) c
            ON c.TenderID = tc.TenderID
               AND tci.PartyID = c.PartyID
    WHERE tc.TenderCommissionID = @TenderCommissionId
          AND
          (
              @UserID = -1
              OR
              (
                  @ViewRelatedToUser IS NOT NULL
                  AND tc.Creator = @UserID
              )
              OR
              (
                  @ViewRelatedToOthers IS NOT NULL
                  AND NOT EXISTS
    (
        SELECT rfcst.value
        FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst
        WHERE rfcst.value = tc.Creator
    )
              )
          );
END;
