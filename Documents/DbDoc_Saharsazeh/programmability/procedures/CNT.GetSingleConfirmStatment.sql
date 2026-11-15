-------------------------------------
CREATE   PROCEDURE [CNT].GetSingleConfirmStatment(@ID INT)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Submit NVARCHAR(100),
            @Confirm nvarchar(100),
            @Voucher NVARCHAR(100),
            @PreVoucher NVARCHAR(100),
            @Culture VARCHAR(10),
            @CultureNo TINYINT;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @Submit = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'Statuses'
          AND L.Item = 'Submit'
          AND LV.Culture = @Culture;

    SELECT @Confirm = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'ConfirmationStates'
		AND L.Item = 'Confirm'
		AND LV.Culture = @Culture;

    SELECT @Voucher = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'PreVoucherStatuses'
          AND L.Item = 'Voucher'
          AND LV.Culture = @Culture;

    SELECT @PreVoucher = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'PreVoucherStatuses'
          AND L.Item = 'PreVoucher'
          AND LV.Culture = @Culture;

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
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT cs.FinancialPeriodID,
           cs.ConfirmStatementID,
           cs.ContractID,
           cs.ContractStatementID,
           cs.Initial,
           cs.Amount,
           cs.Number,
           cs.Date,
           CFG.GetCLRSaturnDate(cs.Date, @DateFormat, 0, @DateType) AS Date_Date,
           cs.PaidAmount,
           cs.Creator,
           cs.CreationDate,
           cs.LastEditor,
           cs.LastEditionDate,
           cs.Version,
           c.Title ContractTitle,
           c.Title2 ContractTitle2,
           c.Number ContractNumber,
           cst.Number StatementNumber,
           CFG.GetCLRSaturnDate(cs.CreationDate, @DateFormat, 1, @DateType) AS CreateDateString,
           CFG.GetCLRSaturnDate(cs.LastEditionDate, @DateFormat, 1, @DateType) AS EditionDateString,
           u.Name AS CreatorUserName,
           u2.Name AS EditorName,
           CAST(CASE
                    WHEN c.ParentID IS NULL THEN
                        d.Code
                    ELSE
                        d2.Code
                END AS NVARCHAR(500)) ContractDlCode,
           CAST(CASE
                    WHEN CNT.ConfirmStatementHasFlow(cs.ConfirmStatementID) = 0 THEN
                        1
                    ELSE
                        0
                END AS BIT) AS IsNotInFlow,
           CNT.IsLastConfirmStatement(cs.ConfirmStatementID) IsLast,
           cs.CurrencyRate,
           cs.PreVoucherID,
           vp.VoucherID AS VoucherID,
           CASE
               WHEN vp.VoucherID IS NOT NULL THEN
                   3
               WHEN cs.PreVoucherID IS NOT NULL THEN
                   2
               ELSE
                   1
           END AS Status,
           CAST(CASE
                    WHEN vp.VoucherID IS NOT NULL THEN
                        @Voucher
                    WHEN cs.PreVoucherID IS NOT NULL THEN
                        @PreVoucher
                    ELSE
                        @Submit
                END AS NVARCHAR(512)) AS StatusString,
           cst.CurrencyID,
           CASE
               WHEN @CultureNo = 1 THEN
                   cst1.Title
               ELSE
                   cst1.Title2
           END + ' (' + CFG.GetCLRSaturnDate(cst.FromDate, @DateFormat, 0, @DateType) + ' - '
           + CFG.GetCLRSaturnDate(cst.EndDate, @DateFormat, 0, @DateType) + ')' StatementString,
           cs.ConfirmStatus,
					   CASE 
							WHEN cs.ConfirmStatus = 1 THEN @Confirm
							WHEN cs.ConfirmStatus = 0 THEN @Submit
							ELSE NULL
						END AS ConfirmStatusString
    FROM CNT.ConfirmStatement cs
        JOIN CNT.ContractStatement cst
            ON cst.ContractStatementID = cs.ContractStatementID
        JOIN CNT.[Contract] c
            ON c.ContractID = cs.ContractID
        JOIN CFG.Party AS p
            ON p.PartyID = cst.PartyID
        JOIN ACC.DL AS dp
            ON dp.DLID = p.DlID
        JOIN CNT.ContractStatementType cst1
            ON cst.ContractStatementTypeID = cst1.ContractStatementTypeID
        JOIN CFG.[User] u
            ON u.UserID = cs.Creator
        JOIN CFG.[User] u2
            ON u2.UserID = cs.LastEditor
        JOIN ACC.DL d
            ON d.DLID = c.DLID
        LEFT JOIN CNT.Contract c2
            ON c2.ContractID = c.ParentID
        LEFT JOIN ACC.DL d2
            ON d2.DLID = c2.DLID
        LEFT JOIN
        (
            SELECT PrevoucherID,
                   VoucherID
            FROM ACC.VoucherPrevoucher
            GROUP BY PrevoucherID,
                     VoucherID
        ) vp
            ON vp.PrevoucherID = cs.PreVoucherID
        LEFT JOIN ACC.Voucher v
            ON v.VoucherID = vp.VoucherID
    WHERE cs.ConfirmStatementID = @ID
END;
